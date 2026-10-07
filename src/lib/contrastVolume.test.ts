import { describe, it, expect } from 'vitest';
import { convertContrast } from './contrastVolume';
import { stockAmount, toRoomUnits } from './roomStock';

describe('contrast volume and bottle equivalents', () => {
  it('preserves administered volume without rounding up to a bottle', () => {
    expect(convertContrast('jodascan300','mls',514)).toEqual({mls:514,bottles:5.14});
    expect(convertContrast('hexopack350','mls',49)).toEqual({mls:49,bottles:0.49});
    expect(convertContrast('mriContrast','mls',38).bottles).toBeCloseTo(38/15,12);
  });
  it('moves base units unchanged, without multiplying ml or individual films again', () => {
    expect(toRoomUnits('ct_contrast',200)).toBe(200);
    expect(toRoomUnits('mri_contrast',45)).toBe(45);
    expect(toRoomUnits('gastrolux',175.5)).toBe(175.5);
    expect(toRoomUnits('film1714',200)).toBe(200);
    expect(toRoomUnits('cd',100)).toBe(100);
    expect(stockAmount('mri_contrast',38)).toContain('2.533 bottles equivalent');
    expect(convertContrast('gastrolux','mls',180)).toEqual({mls:180,bottles:1.8});
  });
});
