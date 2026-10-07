import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Session } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from './AuthProvider';
import { useAuth } from '@/hooks/useAuth';

const api = vi.hoisted(() => ({ getSession: vi.fn(), onAuthStateChange: vi.fn(), rpc: vi.fn(), signInWithPassword: vi.fn(), signUp: vi.fn(), signOut: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: api, rpc: api.rpc } }));
const honey = { user: { id: 'honey' } } as Session;
let authEvent: (event: string, session: Session | null) => void;
let count = 0;
function Probe({ name = 'state' }: {name?: string}) {
  const auth = useAuth(); count += 1;
  return <><output data-testid={name}>{JSON.stringify({loading:auth.loading,hasAccess:auth.hasAccess,canManageStock:auth.canManageStock,canManageStaff:auth.canManageStaff,user:auth.user?.id,error:auth.accessError})}</output><button onClick={auth.retryAccess}>Retry</button><button onClick={()=>void auth.signIn('honey@example.com','test-password').then(result=>{document.body.dataset.signInError=result.error?.message||'';})}>Sign in</button></>;
}
const state = () => JSON.parse(screen.getByTestId('state').textContent || '{}');
async function tick(ms = 0) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }

beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); count = 0;
  api.getSession.mockResolvedValue({data:{session:honey},error:null});
  api.onAuthStateChange.mockImplementation(callback => { authEvent=callback; return {data:{subscription:{unsubscribe:vi.fn()}}}; });
  api.rpc.mockReturnValue({abortSignal:()=>Promise.resolve({data:{has_access:true,can_manage_stock:true,can_manage_staff:false},error:null})});
});
afterEach(() => { cleanup(); vi.useRealTimers(); delete document.body.dataset.signInError; });

describe('shared login and access checks', () => {
  it('uses one subscription and permission request for multiple screens', async () => {
    render(<AuthProvider><Probe/><Probe name="second"/></AuthProvider>);
    await tick(); await tick();
    expect(api.onAuthStateChange).toHaveBeenCalledTimes(1);
    expect(api.getSession).toHaveBeenCalledTimes(1);
    expect(api.rpc).toHaveBeenCalledTimes(1);
    expect(state()).toMatchObject({loading:false,hasAccess:true,canManageStock:true,canManageStaff:false});
  });
  it('ends a stalled access spinner without granting access, then retries successfully', async () => {
    api.rpc.mockReturnValueOnce({abortSignal:()=>new Promise(()=>{})});
    render(<AuthProvider><Probe/></AuthProvider>);
    await tick(); await tick();
    expect(state().loading).toBe(true);
    await tick(12000);
    expect(state()).toMatchObject({loading:false,hasAccess:false,canManageStock:false});
    expect(state().error).toContain('Unable to check your account access');
    fireEvent.click(screen.getByText('Retry'));
    await tick(); await tick();
    expect(state()).toMatchObject({loading:false,hasAccess:true,canManageStock:true,error:''});
  });
  it('ends a stalled initial session check and rejected permission checks', async () => {
    api.getSession.mockReturnValueOnce(new Promise(()=>{}));
    render(<AuthProvider><Probe/></AuthProvider>);
    await tick(12000);
    expect(state()).toMatchObject({loading:false,hasAccess:false});
    expect(state().error).toContain('Unable to check your login');
    api.rpc.mockReturnValueOnce({abortSignal:()=>Promise.reject(new Error('offline'))});
    await act(async()=>{authEvent('SIGNED_IN',honey);});
    await tick();
    expect(state()).toMatchObject({loading:false,hasAccess:false});
    expect(state().error).toContain('Unable to check your account access');
  });
  it('ignores a previous user’s late permission result after an account switch', async () => {
    let release: (value: unknown) => void;
    api.rpc.mockReturnValueOnce({abortSignal:()=>new Promise(resolve=>{release=resolve;})});
    render(<AuthProvider><Probe/></AuthProvider>);
    await tick(); await tick();
    api.rpc.mockReturnValueOnce({abortSignal:()=>Promise.resolve({data:{has_access:true,can_manage_stock:false,can_manage_staff:true},error:null})});
    await act(async()=>{authEvent('SIGNED_IN',{user:{id:'shared'}} as Session);});
    await tick();
    await act(async()=>{release({data:{has_access:true,can_manage_stock:true,can_manage_staff:false},error:null});});
    expect(state()).toMatchObject({user:'shared',hasAccess:true,canManageStock:false,canManageStaff:true});
  });
  it('returns a failed sign-in instead of leaving the submit button waiting forever', async () => {
    api.getSession.mockResolvedValue({data:{session:null},error:null});
    api.signInWithPassword.mockReturnValue(new Promise(()=>{}));
    render(<AuthProvider><Probe/></AuthProvider>);
    await tick();
    fireEvent.click(screen.getByText('Sign in'));
    await tick(12000);
    expect(document.body.dataset.signInError).toContain('Sign-in timed out');
    expect(state().hasAccess).toBe(false);
  });
});
