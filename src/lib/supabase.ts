import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { Note, UploadedFile } from '@/types';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** 是否已配置云端数据库。未配置时所有函数安全降级（返回空/抛友好错误，不崩溃） */
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;

/** 列表展示用的轻量元信息（不含完整数据） */
export interface CloudDatasetMeta {
  id: string;
  name: string;
  note_count: number;
  account: string | null;
  date_min: string | null;
  date_max: string | null;
  created_at: string;
}

/** 一份完整数据集：文件列表 + 笔记列表 */
export interface CloudDatasetPayload {
  files: UploadedFile[];
  notes: Note[];
}

export interface CloudDatasetRow extends CloudDatasetMeta {
  payload: CloudDatasetPayload;
}

// ───────────────────────── 鉴权（邮箱 + 密码） ─────────────────────────
// 必须用登录后的会话才能读写数据：anon key 虽公开，但没有登录会话就没有 uid，
// 而 RLS 策略要求 auth.uid() = owner，因此陌生人即使拿到 key 也读不到任何数据。

export async function getCurrentUser(): Promise<User | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function signIn(email: string, password: string): Promise<User> {
  if (!supabase) throw new Error('未配置云端数据库（请设置 VITE_SUPABASE_URL 与 VITE_SUPABASE_ANON_KEY）');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.user) throw new Error('登录失败');
  return data.user;
}

export async function signUp(
  email: string,
  password: string
): Promise<{ user: User | null; needsConfirm: boolean }> {
  if (!supabase) throw new Error('未配置云端数据库');
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  // 若开启了「注册需邮件确认」，则 signUp 后 data.session 为 null
  return { user: data.user, needsConfirm: !data.session };
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** 订阅登录状态变化，返回取消订阅函数 */
export function onAuthChange(cb: (user: User | null) => void): () => void {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session?.user ?? null));
  return () => data.subscription.unsubscribe();
}

// ───────────────────────── 数据集读写（均受 RLS 约束） ─────────────────────────

async function requireUid(): Promise<string> {
  if (!supabase) throw new Error('未配置云端数据库');
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const uid = data.user?.id;
  if (!uid) throw new Error('请先登录后再操作云端数据');
  return uid;
}

export async function listDatasets(): Promise<CloudDatasetMeta[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('datasets')
    .select('id,name,note_count,account,date_min,date_max,created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as CloudDatasetMeta[];
}

export async function saveDataset(name: string, payload: CloudDatasetPayload): Promise<CloudDatasetMeta> {
  const uid = await requireUid();
  const dates = payload.notes.map((n) => n.publishAt).sort((a, b) => a - b);
  const row = {
    name,
    payload,
    owner: uid,
    note_count: payload.notes.length,
    account: payload.files[0]?.account ?? null,
    date_min: dates.length ? new Date(dates[0]).toISOString().slice(0, 10) : null,
    date_max: dates.length ? new Date(dates[dates.length - 1]).toISOString().slice(0, 10) : null,
  };
  const { data, error } = await supabase!
    .from('datasets')
    .insert(row)
    .select('id,name,note_count,account,date_min,date_max,created_at')
    .single();
  if (error) throw error;
  return data as CloudDatasetMeta;
}

export async function loadDataset(id: string): Promise<CloudDatasetPayload> {
  if (!supabase) throw new Error('未配置云端数据库');
  const { data, error } = await supabase.from('datasets').select('payload').eq('id', id).single();
  if (error) throw error;
  return (data as CloudDatasetRow).payload;
}

export async function deleteDataset(id: string): Promise<void> {
  if (!supabase) throw new Error('未配置云端数据库');
  const { error } = await supabase.from('datasets').delete().eq('id', id);
  if (error) throw error;
}

export async function renameDataset(id: string, name: string): Promise<void> {
  if (!supabase) throw new Error('未配置云端数据库');
  const { error } = await supabase.from('datasets').update({ name }).eq('id', id);
  if (error) throw error;
}
