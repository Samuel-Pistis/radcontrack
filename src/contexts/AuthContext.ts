import { createContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';

export type AuthState = {
  user: User | null; session: Session | null; loading: boolean;
  hasAccess: boolean; canManageStock: boolean; canManageStaff: boolean;
  accessError: string; retryAccess: () => void;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;
};
export const AuthContext = createContext<AuthState | null>(null);
