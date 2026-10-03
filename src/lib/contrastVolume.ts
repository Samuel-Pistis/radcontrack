import type { ContrastType } from '@/types/contrast';

export const clinicalBottleCapacity = (type: ContrastType) => type === 'mriContrast' ? 15 : type === 'gastrolux' ? 0 : 100;
export const contrastEquivalent = (type: ContrastType, ml: number) => ml / clinicalBottleCapacity(type);
export const convertContrast = (type: ContrastType, field: 'mls' | 'bottles', value: number) => field === 'mls'
  ? { mls: value, bottles: contrastEquivalent(type, value) }
  : { mls: Number((value * clinicalBottleCapacity(type)).toFixed(2)), bottles: value };
