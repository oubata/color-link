import { describe, expect, it } from 'vitest';
import {
  MAX_COLORS,
  TIERS,
  minAvgBends,
  targetPairs,
  tierById,
} from '../../src/generator/difficulty';

describe('difficulty ladder (spec 7.1)', () => {
  it('lists six tiers in ladder order with strictly growing boards', () => {
    expect(TIERS.map((t) => t.id)).toEqual([
      'easy',
      'normal',
      'hard',
      'extreme',
      'expert',
      'master',
    ]);
    for (let i = 1; i < TIERS.length; i++) {
      const previous = TIERS[i - 1];
      const tier = TIERS[i];
      if (!previous || !tier) throw new Error('missing tier');
      expect(tier.size).toBeGreaterThan(previous.size);
    }
  });

  it('never asks for more pairs than the palette has colours', () => {
    for (const tier of TIERS) {
      expect(tier.pairs.atFirst).toBeLessThanOrEqual(MAX_COLORS);
      expect(tier.pairs.atLast).toBeLessThanOrEqual(MAX_COLORS);
      expect(tier.pairs.atLast).toBeLessThan(tier.pairs.atFirst);
    }
  });

  it('asks for more bends as levels progress', () => {
    for (const tier of TIERS) {
      expect(tier.minAvgBends.atLast).toBeGreaterThan(tier.minAvgBends.atFirst);
    }
  });

  it('unlocks each tier from the tier immediately before it', () => {
    for (let i = 0; i < TIERS.length; i++) {
      const tier = TIERS[i];
      if (!tier) throw new Error('missing tier');
      if (i < 3) {
        expect(tier.unlock).toBeNull();
        continue;
      }
      const previous = TIERS[i - 1];
      if (!previous) throw new Error('missing tier');
      expect(tier.unlock?.tier).toBe(previous.id);
      expect(tier.unlock?.solved).toBe(20);
    }
  });

  it('gives every tier 100 levels', () => {
    for (const tier of TIERS) expect(tier.levelCount).toBe(100);
  });

  it('interpolates the per-level targets across the tier', () => {
    const hard = tierById('hard');
    expect(targetPairs(hard, 1)).toBe(9);
    expect(targetPairs(hard, 100)).toBe(6);
    expect(targetPairs(hard, 50)).toBeLessThanOrEqual(9);
    expect(targetPairs(hard, 50)).toBeGreaterThanOrEqual(6);
    expect(minAvgBends(hard, 1)).toBeCloseTo(1.0);
    expect(minAvgBends(hard, 100)).toBeCloseTo(2.5);
  });

  it('looks tiers up by id', () => {
    expect(tierById('master').size).toBe(14);
    expect(() => tierById('nope' as 'easy')).toThrow();
  });
});
