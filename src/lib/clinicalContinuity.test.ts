import { describe, it, expect } from 'vitest';
import { createEmptyDailyData } from '@/types/contrast';
import { clinicalDateKey, carryClinicalDay, recalculateClinicalDay } from './clinicalContinuity';

describe('existing clinical record continuity', () => {
 it('uses the calendar day selected locally, including midnight in Lagos', () => {
  expect(clinicalDateKey(new Date(2026, 9, 7, 0, 0))).toBe('2026-10-07');
 });
 it('recalculates every later shift when morning consumption changes', () => {
  const day = createEmptyDailyData('2026-10-07');
  day.morning.hexopack350.received.mls = 1200;
  day.morning.hexopack350.consumption.mls = 685;
  day.afternoon.hexopack350.additionalReceived.mls = 200;
  day.afternoon.hexopack350.consumption.mls = 380;
  day.night.hexopack350.outstanding.mls = 9999;
  const result = recalculateClinicalDay(day);
  expect(result.morning.hexopack350.outstanding.mls).toBe(515);
  expect(result.afternoon.hexopack350.outstanding.mls).toBe(335);
  expect(result.night.hexopack350.outstanding.mls).toBe(335);
  expect(day.night.hexopack350.outstanding.mls).toBe(9999);
 });
 it('carries saved usage forward even when night was never filled or attested', () => {
  const previous = createEmptyDailyData('2026-10-07');
  previous.morning.mriContrast.received.mls = 53;
  previous.morning.mriContrast.consumption.mls = 40;
  previous.afternoon.mriContrast.consumption.mls = 9;
  const next = carryClinicalDay(previous, createEmptyDailyData('2026-10-08'));
  expect(next.morning.mriContrast.received.mls).toBe(4);
  expect(next.morning.mriContrast.consumption.mls).toBe(0);
  expect(next.night.mriContrast.outstanding.mls).toBe(4);
 });
});
