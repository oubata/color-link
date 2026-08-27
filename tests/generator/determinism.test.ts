import { describe, expect, it } from 'vitest';
import { TIERS, GENERATOR_VERSION } from '../../src/generator/difficulty';
import { generate, levelSeed } from '../../src/generator/generate';
import { fnv1a32 } from '../../src/generator/prng';

const easy = TIERS[0];
const hard = TIERS[2];

describe('determinism (spec 12.2)', () => {
  it('the same tier and index always produce a deep-equal level', () => {
    if (!easy) throw new Error('missing tier');
    for (const index of [1, 42, 100]) {
      expect(generate(easy, index)).toEqual(generate(easy, index));
    }
  });

  it('different levels in a tier differ', () => {
    if (!hard) throw new Error('missing tier');
    const a = generate(hard, 1);
    const b = generate(hard, 2);
    expect(a.seed).not.toBe(b.seed);
    expect(a.solution).not.toEqual(b.solution);
  });

  it('the same index in different tiers differs', () => {
    if (!easy || !hard) throw new Error('missing tier');
    expect(generate(easy, 7).seed).not.toBe(generate(hard, 7).seed);
  });

  it('the seed is derived from the generator version, tier and index', () => {
    expect(levelSeed('easy', 1)).toBe(fnv1a32(`v${GENERATOR_VERSION}|easy|1`));
    expect(levelSeed('master', 100)).toBe(
      fnv1a32(`v${GENERATOR_VERSION}|master|100`),
    );
  });

  it('a generator version bump would change every seed', () => {
    const current = fnv1a32(`v${GENERATOR_VERSION}|easy|1`);
    const next = fnv1a32(`v${GENERATOR_VERSION + 1}|easy|1`);
    expect(current).not.toBe(next);
  });

  it('stamps the level with its id, seed and generator version', () => {
    if (!hard) throw new Error('missing tier');
    const level = generate(hard, 42);
    expect(level.id).toBe('hard-042');
    expect(level.tier).toBe('hard');
    expect(level.index).toBe(42);
    expect(level.size).toBe(8);
    expect(level.seed).toBe(levelSeed('hard', 42));
    expect(level.generatorVersion).toBe(GENERATOR_VERSION);
  });
});
