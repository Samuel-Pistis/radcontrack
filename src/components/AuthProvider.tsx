import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AuthContext } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const WAIT_MS = 12000;
async function bounded<T>(work: PromiseLike<T>, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      Promise.resolve(work),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(message)), WAIT_MS); }),
    ]);
  } finally { clearTimeout(timer!); }
}

type Permissions = { userId: string | null; pending: boolean; hasAccess: boolean; canManageStock: boolean; canManageStaff: boolean; error: string };
const emptyPermissions: Permissions = { userId: null, pending: false, hasAccess: false, canManageStock: false, canManageStaff: false, error: '' };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const [permissions, setPermissions] = useState(emptyPermissions);
  const [retry, setRetry] = useState(0);
  const userId = session?.user.id;
  const eventRevision = useRef(0);

  useEffect(() => {
    let active = true;
    const revision = eventRevision.current;
    setSessionLoading(true); setSessionError('');
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      eventRevision.current += 1;
      setSession(next); setSessionLoading(false); setSessionError('');
    });
    void (async () => {
      try {
        const result = await bounded(supabase.auth.getSession(), 'The login check timed out. Please retry.');
        if (!active || eventRevision.current !== revision) return;
        if (result.error) throw result.error;
        setSession(result.data.session);
      } catch {
        if (active && eventRevision.current === revision) setSessionError('Unable to check your login. Please retry or refresh this page.');
      } finally {
        if (active) setSessionLoading(false);
      }
    })();
    return () => { active = false; subscription.unsubscribe(); };
  }, [retry]);

  useEffect(() => {
    if (!userId) { setPermissions(emptyPermissions); return; }
    let active = true;
    const controller = new AbortController();
    setPermissions({ ...emptyPermissions, userId, pending: true });
    // Auth events must finish before another Supabase call tries to acquire its lock.
    const start = setTimeout(() => { void (async () => {
      try {
        const { data, error } = await bounded(supabase.rpc('inventory_permissions').abortSignal(controller.signal), 'Access check timed out.');
        if (!active) return;
        if (error) throw error;
        const result = data as { has_access?: boolean; can_manage_stock?: boolean; can_manage_staff?: boolean } | null;
        const hasAccess = result?.has_access === true;
        setPermissions({ userId, pending: false, hasAccess, canManageStock: hasAccess && result?.can_manage_stock === true, canManageStaff: hasAccess && result?.can_manage_staff === true, error: hasAccess ? '' : 'Your account is waiting for administrator approval.' });
      } catch {
        controller.abort();
        if (active) setPermissions({ ...emptyPermissions, userId, error: 'Unable to check your account access. Please retry. Your permissions have not been changed.' });
      }
    })(); }, 0);
    return () => { active = false; clearTimeout(start); controller.abort(); };
  }, [userId, retry]);

  const authAction = useCallback(async (work: () => PromiseLike<{ error: Error | null }>, message: string) => {
    try { const { error } = await bounded(work(), message); return { error }; }
    catch (error) { return { error: error instanceof Error ? error : new Error(message) }; }
  }, []);
  const signIn = (email: string, password: string) => authAction(() => supabase.auth.signInWithPassword({ email, password }), 'Sign-in timed out. Please refresh the page and try again.');
  const signUp = (email: string, password: string) => authAction(() => supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } }), 'Registration timed out. Please check your email before trying again.');
  const signOut = () => authAction(() => supabase.auth.signOut(), 'Sign-out timed out. Please refresh the page.');
  const current = permissions.userId === userId ? permissions : emptyPermissions;
  return <AuthContext.Provider value={{
    user: session?.user || null, session,
    loading: sessionLoading || (!!userId && (permissions.userId !== userId || permissions.pending)),
    hasAccess: current.hasAccess, canManageStock: current.canManageStock, canManageStaff: current.canManageStaff,
    accessError: sessionError || current.error, retryAccess: () => setRetry(value => value + 1), signIn, signUp, signOut,
  }}>{children}</AuthContext.Provider>;
}
