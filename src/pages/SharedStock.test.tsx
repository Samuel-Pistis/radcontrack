import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SharedStock from './SharedStock';

const access = vi.hoisted(() => ({ canManageStock: false, canManageStaff: false }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ ...access, loading: false }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  from: (name: string) => {
    const result = Promise.resolve({ error: null, data: name === 'stock_items' ? [{ id: 'gastrolux', name: 'Gastrolux', unit: 'ml', balance: 200, opening_recorded: true, active: true }] : [] });
    const query = { select: () => query, eq: () => query, order: () => query, limit: () => query, then: result.then.bind(result) };
    return query;
  }, rpc: vi.fn(),
} }));
beforeEach(() => { vi.stubGlobal('crypto', { randomUUID: () => 'test-line' }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('shared stock access', () => {
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
  it('provides store-management and staff-approval controls to the administrator', async () => {
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
});
