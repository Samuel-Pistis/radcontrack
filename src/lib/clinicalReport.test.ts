import { describe, it, expect, vi } from 'vitest';
import { createEmptyDailyData } from '@/types/contrast';
const mock = vi.hoisted(() => ({from: vi.fn()}));
vi.mock('@/integrations/supabase/client', () => ({supabase: mock}));
import { loadClinicalReport } from './clinicalReport';

describe('clinical recovery reporting', () => {
 it('counts the editable recovered entry once and retains untouched historical days', async () => {
  const recovered = createEmptyDailyData('2026-10-07');
  recovered.morning.hexopack350.consumption.mls = 685;
  const historical = createEmptyDailyData('2026-10-06');
  historical.morning.hexopack350.consumption.mls = 100;
  mock.from.mockImplementation((table: string) => {
   const data = table === 'daily_contrast_data' ? [{date:historical.date,data:historical},{date:recovered.date,data:recovered}]
    : table === 'clinical_stock_transitions' ? [{date:recovered.date}]
    : [{date:recovered.date,room:'CT',shift:'morning',details:{ct_contrast:{used:700,waste:5,patients:10}}}];
   const query = {select:()=>query,gte:()=>query,lte:()=>query,order:()=>query,range:()=>Promise.resolve({data,error:null}),then:(resolve:(value:unknown)=>unknown)=>Promise.resolve({data,error:null}).then(resolve)};
   return query;
  });
  const result = await loadClinicalReport('2026-10-06','2026-10-07');
  expect(result.error).toBeNull();
  expect((result.data?.[0].data as unknown as typeof historical).morning.hexopack350.consumption.mls).toBe(100);
  expect((result.data?.[1].data as unknown as typeof recovered).morning.hexopack350.consumption.mls).toBe(700);
 });
});
