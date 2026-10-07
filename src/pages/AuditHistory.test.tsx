import {render,screen,cleanup,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import AuditHistory from './AuditHistory';
import {auditChanges} from '@/lib/auditHistory';
import {supabase} from '@/integrations/supabase/client';
const auth=vi.hoisted(()=>({canManageStock:false,canManageStaff:false}));
vi.mock('@/hooks/useAuth',()=>({useAuth:()=>({...auth,user:{email:'honey@example.com'},signOut:vi.fn()})}));
vi.mock('@/hooks/useTheme',()=>({useTheme:()=>({theme:'dark',toggleTheme:vi.fn()})}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{rpc:vi.fn()}}));
beforeEach(()=>vi.mocked(supabase.rpc).mockReset());
afterEach(cleanup);
describe('audit history',()=>{
  it('does not request private history for ordinary staff',()=>{
    auth.canManageStock=false;auth.canManageStaff=false;
    render(<MemoryRouter><AuditHistory /></MemoryRouter>);
    expect(screen.getByRole('alert')).toHaveTextContent('Only authorised');
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
  it('shows an authorised editor the actor, reason and before/after values',async()=>{
    auth.canManageStock=true;auth.canManageStaff=false;
    vi.mocked(supabase.rpc).mockResolvedValue({error:null,data:[{id:'1',source:'store',record_id:'r',before_record:{item_id:'film1714',quantity:10000},after_record:{item_id:'film1714',quantity:100},reason:'Wrong quantity',changed_by:'honey.onabanjo@bthdc.com.ng',changed_at:'2026-10-07T12:00:00Z'}]} as never);
    render(<MemoryRouter><AuditHistory /></MemoryRouter>);
    await screen.findByText('Wrong quantity');
    expect(screen.getByText('10000')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText(/honey.onabanjo@bthdc.com.ng/)).toBeInTheDocument();
    await waitFor(()=>expect(supabase.rpc).toHaveBeenCalledWith('stock_audit_history',expect.objectContaining({p_offset:0,p_limit:50})));
  });
  it('explains that a missing migration prevents loading',async()=>{
    auth.canManageStock=true;
    vi.mocked(supabase.rpc).mockResolvedValue({data:null,error:{message:'Could not find the function public.stock_audit_history'}} as never);
    render(<MemoryRouter><AuditHistory /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('database update has not been applied');
  });
  it('includes usage changes and deletion status',()=>{
    const changes=auditChanges({quantities:{film1714:10},patients:3,voided_at:null},{quantities:{film1714:4},patients:2,voided_at:'2026-10-07'});
    expect(changes).toEqual(expect.arrayContaining([{label:'17 × 14 films',before:'10',after:'4'},{label:'Patients',before:'3',after:'2'},{label:'Status',before:'Active',after:'Deleted'}]));
  });
});
