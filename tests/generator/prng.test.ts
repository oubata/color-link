import { describe, expect, it } from 'vitest';
import {
  fnv1a32,
  mulberry32,
  randomInt,
  shuffle,
} from '../../src/generator/prng';

describe('prng', () => {
  it('mulberry32 reproduces its known-answer vector for seed 1', () => {
    const rng = mulberry32(1);
    const first = [rng(), rng(), rng(), rng(), rng()];
    expect(first.map((n) => Number(n.toFixed(10)))).toEqual([
      0.6270739406, 0.0027357212, 0.52744704, 0.9810509675, 0.9683778982,
    ]);
  });

  it('mulberry32 is a pure function of its seed', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it('mulberry32 stays inside [0, 1)', () => {
    const rng = mulberry32(99);
    for (let i = 0; i < 10_000; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('fnv1a32 matches the published FNV-1a 32-bit test vectors', () => {
    expect(fnv1a32('')).toBe(0x811c9dc5);
    expect(fnv1a32('a')).toBe(0xe40c292c);
    expect(fnv1a32('foobar')).toBe(0xbf9cf968);
  });

  it('fnv1a32 reproduces its known answer for the level-1 seed string', () => {
    expect(fnv1a32('v1|easy|1')).toBe(4238550361);
  });

  it('fnv1a32 returns an unsigned 32-bit integer', () => {
    for (const input of ['', 'a', 'v1|master|100', 'x'.repeat(1000)]) {
      const hash = fnv1a32(input);
      expect(Number.isInteger(hash)).toBe(true);
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it('randomInt stays inside the requested bound', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const value = randomInt(rng, 6);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(6);
    }
  });

  it('shuffle is a permutation and is seed-stable', () => {
    const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const a = shuffle(items.slice(), mulberry32(3));
    const b = shuffle(items.slice(), mulberry32(3));
    expect(a).toEqual(b);
    expect(a.slice().sort((x, y) => x - y)).toEqual(items);
  });
});
