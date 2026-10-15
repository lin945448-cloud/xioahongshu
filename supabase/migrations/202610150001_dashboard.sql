-- Apply once in Supabase SQL Editor. Existing legacy `datasets` records are untouched.
begin;

create table public.dashboard_members (
  email text primary key check (email = lower(trim(email)) and length(email) between 3 and 254),
  role text not null check (role in ('admin', 'viewer')),
  created_at timestamptz not null default now()
);
create table public.dashboard_batches (
  id uuid primary key default gen_random_uuid(),
  account text not null check (length(account) between 1 and 100),
  reporting_month date not null check (extract(day from reporting_month) = 1),
  file_name text not null check (length(file_name) between 1 and 255),
  file_hash text not null check (file_hash ~ '^[a-f0-9]{64}$'),
  notes jsonb not null check (jsonb_typeof(notes) = 'array' and jsonb_array_length(notes) between 1 and 20000),
  note_count integer generated always as (jsonb_array_length(notes)) stored,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (account, reporting_month),
  unique (account, file_hash)
);
create index on public.dashboard_batches (reporting_month desc, id);

-- Read the confirmed identity from Auth, never user-editable metadata or a client-supplied email.
create function public.dashboard_role() returns text
language sql stable security definer set search_path = '' as $$
  select m.role from public.dashboard_members m join auth.users u on lower(u.email) = m.email
  where u.id = auth.uid() and u.email_confirmed_at is not null;
$$;

alter table public.dashboard_members enable row level security;
alter table public.dashboard_batches enable row level security;
revoke all on public.dashboard_members, public.dashboard_batches from public, anon, authenticated;
grant select on public.dashboard_members, public.dashboard_batches to authenticated;
create policy members_admin_read on public.dashboard_members for select to authenticated
  using ((select public.dashboard_role()) = 'admin');
create policy batches_member_read on public.dashboard_batches for select to authenticated
  using ((select public.dashboard_role()) in ('admin', 'viewer'));

create function public.dashboard_import(p_account text, p_month date, p_file_name text, p_hash text, p_notes jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
  if public.dashboard_role() is distinct from 'admin' then
    raise exception '仅管理员可以上传数据' using errcode = '42501';
  end if;
  if p_account is null or length(trim(p_account)) not between 1 and 100 or
     p_month is null or extract(day from p_month) <> 1 or
     p_month < date '2000-01-01' or p_month > date '2100-12-01' or
     p_file_name is null or length(p_file_name) not between 1 and 255 or
     p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then
    raise exception '账号、月份或文件信息无效';
  end if;
  if p_notes is null or jsonb_typeof(p_notes) <> 'array' then raise exception '数据必须为数组'; end if;
  if jsonb_array_length(p_notes) not between 1 and 20000 or octet_length(p_notes::text) > 10000000 then
    raise exception '单批次限 1–20000 条，解析后数据限 10MB';
  end if;
  -- Validate types before data reaches calculations, charts, or exported reports.
  if exists (
    select 1 from jsonb_array_elements(p_notes) n where
      jsonb_typeof(n) <> 'object' or
      not (n ?& array['title','publishAt','ym','month','seq','genre','category','impressions','views','ctr','likes','comments','collects','followers','shares']) or
      jsonb_typeof(n->'title') <> 'string' or length(n->>'title') > 2000 or
      jsonb_typeof(n->'genre') <> 'string' or jsonb_typeof(n->'category') <> 'string' or
      coalesce(n->>'ym','') !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' or
      exists (select 1 from unnest(array['publishAt','month','seq','impressions','views','ctr','likes','comments','collects','followers','shares']) k
        where jsonb_typeof(n->k) is distinct from 'number')
  ) then raise exception '数据字段缺失或类型错误'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_notes) n where
      (n->>'publishAt')::numeric not between 0 and 4133980800000 or
      (n->>'month')::numeric not between 1 and 12 or (n->>'seq')::numeric < 1 or
      (n->>'ctr')::numeric not between 0 and 1 or
      exists (select 1 from unnest(array['impressions','views','likes','comments','collects','shares']) k
        where (n->>k)::numeric < 0)
  ) then raise exception '数值超出有效范围'; end if;
  insert into public.dashboard_batches(account, reporting_month, file_name, file_hash, notes, uploaded_by)
    values(trim(p_account), p_month, p_file_name, p_hash, p_notes, auth.uid()) returning id into new_id;
  return new_id;
end;
$$;

create function public.dashboard_delete_batch(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.dashboard_role() is distinct from 'admin' then
    raise exception '仅管理员可以撤销批次' using errcode = '42501'; end if;
  delete from public.dashboard_batches where id = p_id;
end;
$$;

-- Application administrators may grant/revoke viewer access, never create more administrators.
-- The initial administrator is bootstrapped explicitly in SQL Editor.
create function public.dashboard_set_viewer(p_email text, p_allowed boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare target text := lower(trim(p_email));
begin
  if public.dashboard_role() is distinct from 'admin' then
    raise exception '仅管理员可以管理授权' using errcode = '42501'; end if;
  if target is null or length(target) > 254 or target !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or p_allowed is null then
    raise exception '请输入有效邮箱'; end if;
  if exists(select 1 from public.dashboard_members where email = target and role = 'admin') then
    raise exception '不能在页面中修改管理员权限'; end if;
  if p_allowed then
    insert into public.dashboard_members(email, role) values(target, 'viewer')
      on conflict (email) do nothing;
  else delete from public.dashboard_members where email = target and role = 'viewer'; end if;
end;
$$;

revoke all on function public.dashboard_role(), public.dashboard_import(text,date,text,text,jsonb),
  public.dashboard_delete_batch(uuid), public.dashboard_set_viewer(text,boolean) from public, anon;
grant execute on function public.dashboard_role(), public.dashboard_import(text,date,text,text,jsonb),
  public.dashboard_delete_batch(uuid), public.dashboard_set_viewer(text,boolean) to authenticated;
commit;
