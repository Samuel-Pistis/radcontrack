import { render, screen, waitFor, cleanup, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SharedStock from './SharedStock';
import { supabase } from '@/integrations/supabase/client';

const access = vi.hoisted(() => ({ canManageStock: false, canManageStaff: false, user: { id: 'honey' }, movements: [] as Record<string, unknown>[], roomMovements: [] as Record<string, unknown>[] }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ ...access, loading: false }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  from: (name: string) => {
    const result = Promise.resolve({ error: null, data: name === 'stock_items' ? [{ id: 'gastrolux', name: 'Gastrolux', unit: 'ml', balance: 200, opening_recorded: true, active: true }] : name === 'stock_movements' ? access.movements : name === 'room_stock_movements' ? access.roomMovements : [] });
    const query = { select: () => query, eq: () => query, order: () => query, limit: () => query, then: result.then.bind(result) };
    return query;
  }, rpc: vi.fn(),
} }));
beforeEach(() => { vi.stubGlobal('crypto', { randomUUID: () => 'test-line' }); access.movements = []; access.roomMovements = []; vi.mocked(supabase.rpc).mockReset(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('shared stock access', () => {
  it('shows count corrections and pick editing beside records, then submits a versioned correction', async () => {
    access.canManageStock = true; access.canManageStaff = false;
    access.movements = [
      { id:'count-1',item_id:'gastrolux',movement_type:'opening',quantity:200,occurred_on:'2026-10-07',recipient_name:'Honey',version:1,recorded_by:'honey' },
      { id:'pick-1',item_id:'gastrolux',movement_type:'issue',quantity:100,occurred_on:'2026-10-07',recipient_name:'George',version:2,recorded_by:'other' },
    ];
    vi.mocked(supabase.rpc).mockResolvedValue({error:null,data:3} as never);
    render(<MemoryRouter><SharedStock /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button',{name:'Correct count'}));
    expect(within(screen.getByRole('region',{name:'Correct stock entry'})).getByLabelText('Date')).toBeDisabled();
    expect(screen.queryByRole('button',{name:'Delete entry'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Cancel'}));
    fireEvent.click(screen.getByRole('button',{name:'Edit / delete'}));
    fireEvent.change(screen.getByLabelText('Quantity (ml)'),{target:{value:'50'}});
    fireEvent.change(screen.getByLabelText('Reason for correction'),{target:{value:'Wrong quantity'}});
    fireEvent.click(screen.getByRole('button',{name:'Save correction'}));
    await waitFor(()=>expect(supabase.rpc).toHaveBeenCalledWith('correct_stock_movement',expect.objectContaining({p_source:'store',p_id:'pick-1',p_version:2,p_quantity:50,p_reason:'Wrong quantity',p_delete:false})));
  });
  it('lets staff correct their own picks but hides store counts and other staff picks', async () => {
    access.canManageStock = false; access.canManageStaff = false;
    access.movements = [
      {id:'own',item_id:'gastrolux',movement_type:'issue',recorded_by:'honey'},
      {id:'other',item_id:'gastrolux',movement_type:'issue',recorded_by:'other'},
      {id:'count',item_id:'gastrolux',movement_type:'opening',recorded_by:'honey'},
    ];
    render(<MemoryRouter><SharedStock /></MemoryRouter>);
    await screen.findByRole('button',{name:'Edit / delete'});
    expect(screen.getAllByRole('button',{name:'Edit / delete'})).toHaveLength(1);
    expect(screen.queryByRole('button',{name:'Correct count'})).not.toBeInTheDocument();
  });
  it('opens a room count with its counted amount rather than its change', async () => {
    access.canManageStock = true; access.canManageStaff = false;
    access.roomMovements = [{id:'room-1',room:'MRI',item_id:'gastrolux',movement_type:'count',change:-20,balance_after:80,occurred_on:'2026-10-07',staff_name:'Honey',version:1}];
    render(<MemoryRouter><SharedStock /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button',{name:'Correct room count'}));
    expect(screen.getByLabelText('Quantity (ml)')).toHaveValue(80);
    expect(screen.queryByRole('button',{name:'Delete entry'})).not.toBeInTheDocument();
  });
  it('lets staff pick and count rooms, while hiding store-management controls', async () => {
    access.canManageStock = false;
    access.canManageStaff = false;
    render(<MemoryRouter><SharedStock /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Gastrolux')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Picked for daily use' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Count room stock now' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Collected from store' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Count store stock now' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve staff login' })).not.toBeInTheDocument();
  });
  it('honours the independent stock and staff permissions', async () => {
    access.canManageStock = true;
    access.canManageStaff = true;
    render(<MemoryRouter><SharedStock /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Gastrolux')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Collected from store' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Count store stock now' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve staff login' })).toBeInTheDocument();
  });
  it('gives a stock editor collection access without staff-approval controls', async () => {
    access.canManageStock = true;
    access.canManageStaff = false;
    render(<MemoryRouter><SharedStock /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Gastrolux')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Collected from store' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve staff login' })).not.toBeInTheDocument();
  });
  it('keeps staff approval for the shared administrator without store editing', async () => {
    access.canManageStock = false;
    access.canManageStaff = true;
    render(<MemoryRouter><SharedStock /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Gastrolux')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Approve staff login' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Picked for daily use' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Collected from store' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Count store stock now' })).not.toBeInTheDocument();
  });
});
