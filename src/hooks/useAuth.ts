import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState({ hasAccess: false, canManageStock: false });
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [accessError, setAccessError] = useState('');
  const userId = user?.id;

  useEffect(() => {
    let active = true;
    setPermissionsLoading(true);
    setPermissions({ hasAccess: false, canManageStock: false });
    setAccessError('');
    if (!userId) { setPermissionsLoading(false); return; }
    supabase.rpc('inventory_permissions').then(({data,error}) => {
      if (!active) return;
      const result = data as { has_access?: boolean; can_manage_stock?: boolean } | null;
      setPermissions({ hasAccess: result?.has_access === true, canManageStock: result?.can_manage_stock === true });
      setAccessError(error ? 'Unable to check account access. Please try again.' : result?.has_access ? '' : 'Your account is waiting for administrator approval.');
      setPermissionsLoading(false);
    });
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  return { user, session, loading: loading || permissionsLoading, ...permissions, accessError, signIn, signUp, signOut };
};
