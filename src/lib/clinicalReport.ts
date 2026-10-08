import { supabase } from '@/integrations/supabase/client';
import { createEmptyDailyData, createEmptyShiftData, createEmptyContrastData, type DailyData, type ContrastType, type ShiftType } from '@/types/contrast';
import type { Json } from '@/integrations/supabase/types';
import type { ShiftDetails } from './shiftWorkflow';

// Legacy clinical entries are retained. The server rejects duplicate connected
// contrast usage for a shift that already has legacy clinical consumption.
export async function loadClinicalReport(start: string, end: string) {
 const legacy=await supabase.from('daily_contrast_data').select('date,data').gte('date',start).lte('date',end).order('date');
 if(legacy.error)return {data:null,error:legacy.error};
 const recovered=await supabase.from('clinical_stock_transitions').select('date').gte('date',start).lte('date',end);
 if(recovered.error)return {data:null,error:recovered.error};
 const recoveredDates=new Set((recovered.data||[]).map(row=>row.date));
 const days=new Map<string,DailyData>((legacy.data||[]).filter(row=>!recoveredDates.has(row.date)).map(row=>[row.date,structuredClone(row.data) as unknown as DailyData]));
 for(let offset=0;;offset+=1000) {
  const result=await supabase.from('room_shift_reviews').select('*').gte('date',start).lte('date',end).order('date').order('room').order('shift').range(offset,offset+999);
  if(result.error)return {data:null,error:result.error};
  for(const row of result.data||[]) {
   const daily=days.get(row.date)||createEmptyDailyData(row.date);
   const map:Record<string,ContrastType>={ct_contrast:'hexopack350',mri_contrast:'mriContrast',gastrolux:'gastrolux'};
   for(const [id,detail] of Object.entries(row.details as ShiftDetails)) {
    if(!map[id])continue;
    daily[row.shift as ShiftType] ||= createEmptyShiftData();
    const target=daily[row.shift as ShiftType][map[id]] ||= createEmptyContrastData();
    target.consumption={mls:Number(target.consumption?.mls||0)+(detail.used||0),bottles:Number(target.consumption?.bottles||0)+(detail.used||0)/(id==='mri_contrast'?15:100)};
    target.patients=Number(target.patients||0)+(detail.patients||0);
   }
   days.set(row.date,daily);
  }
  if(result.data.length<1000)break;
 }
 return {data:[...days].sort(([a],[b])=>a.localeCompare(b)).map(([date,data])=>({date,data:data as unknown as Json})),error:null};
}
