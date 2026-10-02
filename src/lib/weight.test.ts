import { describe, expect, test } from 'bun:test';
import fixture from './__fixtures__/weights.json';
import { chart, convert, formatWeight, latest, parseWeight, series, trend, type WeightUnit } from './weight';

const load = (rows: { at: string; value: number; unit: string }[]) => rows.map((r) => ({ at: new Date(r.at).getTime(), value: r.value, unit: r.unit as WeightUnit }));
const dog = load(fixture.dog);
const cat = load(fixture.cat);

describe('units', () => {
  test('pounds and kilograms', () => {
    expect(convert(10, 'kg', 'lb')).toBeCloseTo(22.046, 3);
    expect(convert(22.046226218, 'lb', 'kg')).toBeCloseTo(10, 6);
    expect(convert(5, 'kg', 'kg')).toBe(5);
  });

  test('one decimal', () => {
    expect(formatWeight(26.1, 'lb')).toBe('26.1 lb');
    expect(formatWeight(4, 'kg')).toBe('4.0 kg');
    expect(formatWeight(4.449, 'kg')).toBe('4.4 kg');
  });

  test('what people type', () => {
    expect(parseWeight('11.8')).toBe(11.8);
    expect(parseWeight(' 4,25 ')).toBe(4.25);
    expect(parseWeight('0')).toBeNull();
    expect(parseWeight('-3')).toBeNull();
    expect(parseWeight('heavy')).toBeNull();
    expect(parseWeight('')).toBeNull();
  });
});

describe('the log', () => {
  test('latest and oldest-first series in the pet’s unit', () => {
    expect(latest(dog)?.value).toBe(26.1);
    const s = series(cat, 'kg');
    expect(s.map((e) => Math.round(e.shown * 100) / 100)).toEqual([4.4, 4.42, 4.4]);
    expect(latest([])).toBeNull();
  });

  test('a gain over six months', () => {
    expect(trend(dog, 'lb')).toEqual({ direction: 'up', change: 1.9, days: 180, text: 'Up 1.9 lb in 6 months' });
  });

  test('a loss over a shorter window', () => {
    expect(trend(dog.slice(0, 3).map((e, i) => ({ ...e, value: [26, 25.0, 24.6][i] })), 'lb', 90)).toEqual({
      direction: 'down',
      change: -0.4,
      days: 57,
      text: 'Down 0.4 lb in 8 weeks',
    });
  });

  test('changes under 1% are steady, across units', () => {
    expect(trend(cat, 'kg')?.text).toBe('Steady over 2 months');
  });

  test('one weighing has no trend', () => {
    expect(trend(dog.slice(-1), 'lb')).toBeNull();
    expect(trend([], 'lb')).toBeNull();
  });
});

describe('chart', () => {
  test('points span the width, heavier is higher', () => {
    const g = chart(dog, 'lb', 300, 120, 10)!;
    expect(g.points).toHaveLength(4);
    expect(g.points[0].x).toBe(10);
    expect(g.points.at(-1)!.x).toBe(290);
    expect(g.points.at(-1)!.y).toBeLessThan(g.points[0].y);
    expect(g.min).toBeLessThan(24.2);
    expect(g.max).toBeGreaterThan(26.1);
    expect(g.path.startsWith('M10 ')).toBe(true);
  });

  test('a single weighing sits in the middle; none draws nothing', () => {
    expect(chart(dog.slice(0, 1), 'lb', 300, 120)!.points[0].x).toBe(150);
    expect(chart([], 'lb', 300, 120)).toBeNull();
  });
});
