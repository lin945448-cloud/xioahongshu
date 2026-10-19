import { useEffect, useState } from 'react';
import { getRole, loadHistory, supabase, type AccessRole, type BatchMeta } from '@/lib/supabase';
import { useStore } from '@/store/useStore';
import { create } from 'zustand';

interface Workspace {
  needsPasswordSetup: boolean;
  passwordSetupUserId: string | null;
  email: string | null;
  role: AccessRole;
  checking: boolean;
  error: string;
  batches: BatchMeta[];
}
export const useWorkspace = create<Workspace>(() => ({ needsPasswordSetup: false, passwordSetupUserId: null, email: null, role: null, checking: false, error: '', batches: [] }));
let revision = 0;

export async function refreshWorkspace() {
  if (!supabase) return;
  const request = ++revision;
  if (!useStore.getState().isDemo) useStore.getState().clearAll();
  useWorkspace.setState({ checking: true, error: '', role: null, batches: [] });
  try {
    const { data, error } = await supabase.auth.getUser();
    if (request !== revision) return;
    if (error && error.name !== 'AuthSessionMissingError') throw error;
    const user = data.user;
    useWorkspace.setState({ email: user?.email ?? null });
    if (!user) return;
    const role = await getRole();
    if (request !== revision || !role) return;
    const history = await loadHistory();
    if (request !== revision) return;
    if (!await getRole() || request !== revision) return;
    useWorkspace.setState({ role, batches: history.batches });
    useStore.getState().loadCloudDataset(history.files, history.notes);
  } catch (e) {
    if (request === revision) useWorkspace.setState({ error: (e as Error).message });
  } finally {
    if (request === revision) useWorkspace.setState({ checking: false });
  }
}

export function useWorkspaceSession() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => { void refreshWorkspace().finally(() => { if (active) setReady(true); }); };
    if (!supabase) { setReady(true); return; }
    const setupToken = new URLSearchParams(window.location.hash.slice(1)).get('setup_token');
    const requestedType = new URLSearchParams(window.location.hash.slice(1)).get('setup_type');
    // Supabase creates a signup token when magiclink is requested for a brand-new email.
    const setupType = requestedType === 'signup' ? 'signup' : requestedType === 'magiclink' ? 'magiclink' : 'recovery';
    if (setupToken) {
      // A one-time recovery token stays in the fragment, never in server access logs.
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      useWorkspace.setState({ needsPasswordSetup: true, passwordSetupUserId: null });
      void supabase.auth.verifyOtp({ token_hash: setupToken, type: setupType }).then(({ data, error }) => {
        if (error || !data.user) {
          useWorkspace.setState({ error: '密码设置链接已失效或已使用，请联系管理员重新生成。', needsPasswordSetup: false, passwordSetupUserId: null });
        } else {
          useWorkspace.setState({ passwordSetupUserId: data.user.id, email: data.user.email ?? null });
        }
      });
    }
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'TOKEN_REFRESHED') return;
      if (event === 'SIGNED_OUT') useWorkspace.setState({ needsPasswordSetup: false, passwordSetupUserId: null });
      ++revision;
      if (!useStore.getState().isDemo) useStore.getState().clearAll();
      useWorkspace.setState({ role: null, email: null, batches: [], checking: true });
      clearTimeout(timer);
      // Never await Supabase calls inside the auth event callback (auth lock).
      timer = setTimeout(refresh, 0);
    });
    const recheck = async () => {
      const request = revision;
      if (!useWorkspace.getState().email || useWorkspace.getState().checking) return;
      try {
        const role = await getRole();
        if (request !== revision) return;
        if (role !== useWorkspace.getState().role) refresh();
      } catch {
        if (request !== revision) return;
        ++revision;
        if (!useStore.getState().isDemo) useStore.getState().clearAll();
        useWorkspace.setState({ role: null, batches: [], error: '无法验证当前访问权限，请刷新重试' });
      }
    };
    const onFocus = () => { void recheck(); };
    window.addEventListener('focus', onFocus);
    const interval = setInterval(() => { void recheck(); }, 60_000);
    refresh();
    return () => { active = false; ++revision; clearTimeout(timer); clearInterval(interval);
      data.subscription.unsubscribe(); window.removeEventListener('focus', onFocus); };
  }, []);
  return ready;
}
