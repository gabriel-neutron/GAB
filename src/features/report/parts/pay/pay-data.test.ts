import { describe, expect, it } from 'vitest';
import { crossing, monthIndex, payData } from './pay-data';

describe('pay data', () => {
  it('puts the months of figure 4 on one axis from December 2022', () => {
    expect(monthIndex('2022-12')).toBe(0);
    expect(monthIndex('2026-09')).toBe(45);
    expect(monthIndex('2025-09-03')).toBeCloseTo(33 + 2 / 30);
  });

  it('keeps a missing value missing', () => {
    // No Urals price is published for December 2022; no defence figure for 2023.
    expect(payData.f4.urals[0]).toBeNull();
    expect(payData.f5.defence[2023 - 2014]).toBeNull();
  });

  it('marks estimates and plans as hollow', () => {
    const china = payData.f3b.find((row) => row.key === 'China');
    expect(china?.points.map((point) => point?.hollow)).toEqual([false, false, true, false, false]);
    expect(payData.f5.defence.at(-1)).toEqual({ x: 2025, y: 9.2272, hollow: true });
  });

  it('reads the August and September 2026 values in date order', () => {
    expect(payData.f4.urals[44]?.y).toBe(67.11);
    expect(payData.f4.urals[45]?.y).toBe(92.08);
  });

  it('puts the designation in October 2025', () => {
    // 22 October 2025: the ring of step 3 marks the Urals value of that month.
    const month = Math.floor(payData.f4.event);
    expect(month).toBe(monthIndex('2025-10'));
    expect(payData.f4.urals[month]?.y).toBe(53.68);
    expect(payData.f4.last).toBe(monthIndex('2026-09'));
  });

  it('finds where the coalition line goes below the line of China', () => {
    const line = (key: string) => payData.f3a.find((row) => row.key === key)?.points ?? [];
    const cross = crossing(line('Coalition'), line('China'));
    // 2022: 272.13 against 112.22; 2023: 80.1 against 127.65.
    expect(cross?.x).toBeGreaterThan(2022);
    expect(cross?.x).toBeLessThan(2023);
    expect(crossing(line('China'), line('Coalition'))).toBeUndefined();
  });
});
