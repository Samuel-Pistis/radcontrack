import { format } from 'date-fns';
import { type DailyData, type ContrastType } from '@/types/contrast';
import { clinicalBottleCapacity } from './contrastVolume';

export const clinicalDateKey = (date: Date) => format(date, 'yyyy-MM-dd');
const types: ContrastType[] = ['jodascan300','hexopack350','gastrolux','mriContrast'];

// Stored outstanding values can be stale when an earlier shift is corrected.
// Always rebuild the entire chain from receipts and actual consumption.
export function recalculateClinicalDay(source: DailyData): DailyData {
 const day = structuredClone(source);
 for (const type of types) {
  let remaining = Number(day.morning[type].received.mls || 0);
  for (const shift of ['morning','afternoon','night'] as const) {
   const entry = day[shift][type];
   remaining += Number(entry.additionalReceived?.mls || 0) - Number(entry.consumption?.mls || 0);
   entry.outstanding = {mls: Number(remaining.toFixed(2)), bottles: remaining / clinicalBottleCapacity(type)};
  }
 }
 return day;
}

export function carryClinicalDay(previous: DailyData, next: DailyData): DailyData {
 const prior = recalculateClinicalDay(previous);
 const day = structuredClone(next);
 for (const type of types) day.morning[type].received = {...prior.night[type].outstanding};
 return recalculateClinicalDay(day);
}
