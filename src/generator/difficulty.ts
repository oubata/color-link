import type { TierId } from '../engine/types';

/**
 * Bumping this changes every level in the game. Never do it without adding a
 * changelog line to the spec (see CLAUDE.md).
 */
export const GENERATOR_VERSION = 1;

export interface TierConfig {
  id: TierId;
  /** Display name. */
  name: string;
  size: number;
  levelCount: number;
  pairs: { atFirst: number; atLast: number };
  minAvgBends: { atFirst: number; atLast: number };
  unlock: { tier: TierId; solved: number } | null;
}

/** The ladder, in order of increasing difficulty (spec 7.1). */
export const TIERS: readonly TierConfig[] = [
  {
    id: 'easy',
    name: 'Easy',
    size: 5,
    levelCount: 100,
    pairs: { atFirst: 6, atLast: 4 },
    minAvgBends: { atFirst: 0.5, atLast: 1.5 },
    unlock: null,
  },
  {
    id: 'normal',
    name: 'Normal',
    size: 6,
    levelCount: 100,
    pairs: { atFirst: 7, atLast: 5 },
    minAvgBends: { atFirst: 0.8, atLast: 2.0 },
    unlock: null,
  },
  {
    id: 'hard',
    name: 'Hard',
    size: 8,
    levelCount: 100,
    pairs: { atFirst: 9, atLast: 6 },
    minAvgBends: { atFirst: 1.0, atLast: 2.5 },
    unlock: null,
  },
  {
    id: 'extreme',
    name: 'Extreme',
    size: 10,
    levelCount: 100,
    pairs: { atFirst: 12, atLast: 8 },
    minAvgBends: { atFirst: 1.2, atLast: 3.0 },
    unlock: { tier: 'hard', solved: 20 },
  },
  {
    id: 'expert',
    name: 'Expert',
    size: 12,
    levelCount: 100,
    pairs: { atFirst: 14, atLast: 10 },
    minAvgBends: { atFirst: 1.5, atLast: 3.5 },
    unlock: { tier: 'extreme', solved: 20 },
  },
  {
    id: 'master',
    name: 'Master',
    size: 14,
    levelCount: 100,
    pairs: { atFirst: 16, atLast: 12 },
    minAvgBends: { atFirst: 1.8, atLast: 4.0 },
    unlock: { tier: 'expert', solved: 20 },
  },
];

export const TIER_BY_ID: Readonly<Record<TierId, TierConfig>> =
  Object.fromEntries(TIERS.map((t) => [t.id, t])) as Record<TierId, TierConfig>;

export function tierById(id: TierId): TierConfig {
  const tier = TIER_BY_ID[id];
  if (!tier) throw new Error(`Unknown tier: ${id}`);
  return tier;
}

/** A length-2 path means adjacent endpoints, which is no puzzle at all. */
export const MIN_PATH_LENGTH = 3;

export function maxPathLength(size: number): number {
  return Math.floor(0.5 * size * size);
}

/** How far the pair count may stray from the target before relaxing. */
export const PAIR_TOLERANCE = 1;

export const MAX_ATTEMPTS_PER_RELAX = 400;

/**
 * Chance a walk voluntarily stops once it is long enough.
 *
 * Spec 7.1 gives this as the flat constant 0.12 and sanctions tuning it per
 * tier when acceptance is poor. Acceptance was poor: one probability cannot
 * serve a 5×5 board that wants 4-cell paths and a 14×14 board that wants
 * 16-cell ones, and Easy/Master both missed their pair targets by miles. It is
 * therefore derived per level from the average path length that level needs.
 * Walk length is roughly MIN_PATH_LENGTH + Geometric(p), whose mean is
 * MIN_PATH_LENGTH - 1 + 1/p, so invert that for p.
 */
export function stopProbability(size: number, pairs: number): number {
  const wantedLength = (size * size) / Math.max(1, pairs);
  const tail = Math.max(
    1,
    wantedLength * lengthCorrection(size) - MIN_PATH_LENGTH + 1,
  );
  return Math.min(0.9, Math.max(0.02, 1 / tail));
}

/**
 * Walks also stop when they run out of empty neighbours, which the geometric
 * model above does not see. Those forced stops shorten walks and so inflate the
 * pair count, and they get commoner as the board grows. Measured against the
 * six board sizes, asking for this much extra length cancels them out.
 */
function lengthCorrection(size: number): number {
  return 1 + 0.035 * (size - 6);
}

/**
 * Chance a walk prefers the neighbour with the fewest exits. This bias is what
 * stops random walks from stranding single cells. Spec 7.1 suggests 0.6 and
 * sanctions tuning it; a sweep over all six board sizes put the knee at 0.95,
 * which roughly halves the rate at which a fill leaves an unmergeable runt.
 */
export const WARNSDORFF_PROBABILITY = 0.95;

/** Number of palette colours, and therefore the hard ceiling on pairs. */
export const MAX_COLORS = 16;

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Position within a tier, 0 at level 1 and 1 at the last level. */
export function tierProgress(tier: TierConfig, levelIndex: number): number {
  if (tier.levelCount <= 1) return 0;
  return (levelIndex - 1) / (tier.levelCount - 1);
}

export function targetPairs(tier: TierConfig, levelIndex: number): number {
  return Math.round(
    lerp(tier.pairs.atFirst, tier.pairs.atLast, tierProgress(tier, levelIndex)),
  );
}

export function minAvgBends(tier: TierConfig, levelIndex: number): number {
  return lerp(
    tier.minAvgBends.atFirst,
    tier.minAvgBends.atLast,
    tierProgress(tier, levelIndex),
  );
}
