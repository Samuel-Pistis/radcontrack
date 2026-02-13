export type ContrastType = 'jodascan300' | 'hexopack350' | 'gastrolux' | 'mriContrast';

export type ShiftType = 'morning' | 'afternoon' | 'night';

export interface ContrastValues {
  mls: number;
  bottles: number;
}

export interface ShiftContrastData {
  received: ContrastValues;
  additionalReceived: ContrastValues;
  consumption: ContrastValues;
  outstanding: ContrastValues;
}

export interface ShiftMetadata {
  handedOverTo: string;
  calculatedBy: string;
  attestation: boolean;
}

export interface ShiftData {
  jodascan300: ShiftContrastData;
  hexopack350: ShiftContrastData;
  gastrolux: ShiftContrastData;
  mriContrast: ShiftContrastData;
  metadata: ShiftMetadata;
}

export interface DailyData {
  date: string;
  morning: ShiftData;
  afternoon: ShiftData;
  night: ShiftData;
}

export const CONTRAST_LABELS: Record<ContrastType, string> = {
  jodascan300: 'Jodascan 300',
  hexopack350: 'Hexopack 350',
  gastrolux: 'Gastrolux',
  mriContrast: 'MRI Contrast',
};

export const SHIFT_LABELS: Record<ShiftType, string> = {
  morning: 'Morning Shift (8am - 4pm)',
  afternoon: 'Afternoon Shift (4pm - 7pm)',
  night: 'Night Shift (7pm - 8am)',
};

export const SHIFT_TIMES: Record<ShiftType, string> = {
  morning: '8:00 AM - 4:00 PM',
  afternoon: '4:00 PM - 7:00 PM',
  night: '7:00 PM - 8:00 AM',
};

export const createEmptyContrastData = (): ShiftContrastData => ({
  received: { mls: 0, bottles: 0 },
  additionalReceived: { mls: 0, bottles: 0 },
  consumption: { mls: 0, bottles: 0 },
  outstanding: { mls: 0, bottles: 0 },
});

export const createEmptyShiftData = (): ShiftData => ({
  jodascan300: createEmptyContrastData(),
  hexopack350: createEmptyContrastData(),
  gastrolux: createEmptyContrastData(),
  mriContrast: createEmptyContrastData(),
  metadata: {
    handedOverTo: '',
    calculatedBy: '',
    attestation: false,
  },
});

export const createEmptyDailyData = (date: string): DailyData => ({
  date,
  morning: createEmptyShiftData(),
  afternoon: createEmptyShiftData(),
  night: createEmptyShiftData(),
});
