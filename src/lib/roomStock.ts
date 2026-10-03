export const STOCK_ROOMS = ['X-ray', 'CT', 'MRI', 'Fluoroscopy'] as const;
export const STOCK_SHIFTS = ['morning', 'afternoon', 'night'] as const;
export const isFilm = (id: string) => id === 'film1714' || id === 'film1210';
export const bottleCapacity = (id: string) => id === 'ct_contrast' ? 100 : id === 'mri_contrast' ? 15 : 0;
export const roomUnit = (id: string, unit: string) => bottleCapacity(id) ? 'ml' : isFilm(id) ? 'films' : unit;
export const toRoomUnits = (id: string, quantity: number) => quantity * (bottleCapacity(id) || (isFilm(id) ? 100 : 1));
export const stockAmount = (id: string, quantity: number) => bottleCapacity(id)
  ? `${Number(quantity.toFixed(2))} ml (${Number((quantity / bottleCapacity(id)).toFixed(3))} bottles equivalent)`
  : String(quantity);
