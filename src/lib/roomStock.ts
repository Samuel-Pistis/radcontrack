export const STOCK_ROOMS = ['X-ray', 'CT', 'MRI', 'Fluoroscopy'] as const;
export const STOCK_SHIFTS = ['morning', 'afternoon', 'night'] as const;
export const isFilm = (id: string) => id === 'film1714' || id === 'film1210';
export const roomUnit = (id: string, unit: string) => isFilm(id) ? 'films' : unit;
export const toRoomUnits = (id: string, quantity: number) => isFilm(id) ? quantity * 100 : quantity;
