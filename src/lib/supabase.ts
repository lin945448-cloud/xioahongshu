import { createClient } from '@supabase/supabase-js';
import type { Note, UploadedFile } from '@/types';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const isSupabaseConfigured = Boolean(url && key);
const clientUrl = import.meta.env.PROD ? `${window.location.origin}/api/supabase` : url!;
export const supabase = isSupabaseConfigured ? createClient(clientUrl, key!) : null;

export async function setPasswordAndVerify(password: string, expectedUserId?: string): Promise<void> {
  const current = client();
  const identity = await current.auth.getUser();
  if (identity.error || !identity.data.user?.email) throw new Error('登录已失效，请重新打开密码设置链接');
  if (expectedUserId && identity.data.user.id !== expectedUserId) throw new Error('当前登录账号与密码重置账号不一致，请重新打开设置链接');
  const changed = await current.auth.updateUser({ password });
  if (changed.error) throw changed.error;
  // Verify the password through a fresh login, independent of the recovery session.
  const verifier = createClient(clientUrl, key!, { auth: {
    persistSession: false, autoRefreshToken: false, detectSessionInUrl: false,
    storageKey: `password-verification-${crypto.randomUUID()}`,
  } });
  const checked = await verifier.auth.signInWithPassword({ email: identity.data.user.email, password });
  if (checked.error) throw new Error(`密码更新后重新登录验证失败，请暂时不要退出：${checked.error.message}`);
  if (checked.data.user?.id !== identity.data.user.id) throw new Error('密码验证账号不一致，请重新设置');
  await verifier.auth.signOut({ scope: 'local' });
}
export type AccessRole = 'admin' | 'viewer' | null;
export interface BatchMeta {
  id: string;
  account: string;
  reporting_month: string;
  file_name: string;
  note_count: number;
  created_at: string;
}
export interface Member { email: string; role: 'admin' | 'viewer'; created_at: string }

function client() {
  if (!supabase) throw new Error('内部数据库尚未配置，请联系管理员');
  return supabase;
}

export async function getRole(): Promise<AccessRole> {
  const { data, error } = await client().rpc('dashboard_role');
  if (error) throw error;
  return data as AccessRole;
}

export async function listBatches(): Promise<BatchMeta[]> {
  const all: BatchMeta[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await client().from('dashboard_batches')
      .select('id,account,reporting_month,file_name,note_count,created_at')
      .order('reporting_month', { ascending: false }).order('id').range(offset, offset + 99);
    if (error) throw error;
    all.push(...data as BatchMeta[]);
    if (data.length < 100) return all;
  }
}

export async function loadHistory(): Promise<{ files: UploadedFile[]; notes: Note[]; batches: BatchMeta[] }> {
  const batches = await listBatches();
  const files: UploadedFile[] = [];
  const notes: Note[] = [];
  for (const batch of batches) {
    const { data, error } = await client().from('dashboard_batches').select('notes').eq('id', batch.id).single();
    if (error) throw error;
    const rows = (data.notes as Note[]).map((n, i) => ({ ...n, id: `${batch.id}-${i}`, fileId: batch.id,
      account: batch.account, reportingMonth: batch.reporting_month.slice(0, 7) }));
    notes.push(...rows);
    const dates = rows.map(n => n.publishAt);
    files.push({ id: batch.id, fileName: batch.file_name, account: batch.account, noteCount: rows.length,
      minDate: Math.min(...dates), maxDate: Math.max(...dates) });
  }
  return { files, notes, batches };
}

export async function importBatch(account: string, month: string, fileName: string, hash: string, notes: Note[]) {
  const { error } = await client().rpc('dashboard_import', {
    p_account: account.trim(), p_month: `${month}-01`, p_file_name: fileName,
    p_hash: hash, p_notes: notes,
  });
  if (error?.code === '23505') throw new Error('该账号该月份已有数据，或这个文件已经导入。请先核对历史批次；需要更正时撤销原批次再上传。');
  if (error) throw error;
}

export async function deleteBatch(id: string) {
  const { error } = await client().rpc('dashboard_delete_batch', { p_id: id });
  if (error) throw error;
}

export async function listMembers(): Promise<Member[]> {
  const { data, error } = await client().from('dashboard_members').select('email,role,created_at').order('email');
  if (error) throw error;
  return data as Member[];
}

export async function setViewer(email: string, allowed: boolean) {
  const { error } = await client().rpc('dashboard_set_viewer', { p_email: email.trim().toLowerCase(), p_allowed: allowed });
  if (error) throw error;
}
