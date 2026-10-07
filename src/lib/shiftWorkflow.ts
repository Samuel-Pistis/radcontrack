export type UsageDetail = { used?: number; waste?: number; patients?: number; reviewed?: boolean };
export type ShiftDetails = Record<string, UsageDetail>;
export const contrasts = ['ct_contrast', 'mri_contrast', 'gastrolux'];
export function routineItem(id: string, room: string) {
  if (id === 'a4_paper' || id === 'gloves_piece') return false;
  if (id === 'mri_contrast') return room === 'MRI';
  if (id === 'ct_contrast' || id === 'gastrolux') return room === 'CT' || room === 'Fluoroscopy';
  return true;
}
export const quantityUsed = (detail: UsageDetail = {}) => Number(((detail.used || 0) + (detail.waste || 0)).toFixed(2));
export function validateDetail(id: string, detail: UsageDetail, finish: boolean): string | null {
  const film = id === 'film1714' || id === 'film1210';
  if (finish && !detail.reviewed) return 'Review every item, including those not used.';
  if (finish && detail.used === undefined) return 'Enter the quantity used, or choose None used. A blank is not zero.';
  for (const n of [detail.used, detail.waste, detail.patients]) {
    if (n !== undefined && (!Number.isFinite(n) || n < 0)) return 'Enter a valid non-negative quantity.';
  }
  if ((film || contrasts.includes(id)) && (detail.used || 0) > 0 && !(detail.patients! > 0)) return 'Enter the number of patients for each film size or contrast used.';
  if ((detail.patients || 0) > 0 && !(detail.used! > 0)) return 'Record the amount used for these patients.';
  if (film && (detail.patients || 0) > (detail.used || 0)) return 'Patients printed for cannot exceed films printed.';
  return null;
}
