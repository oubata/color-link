import type { TierId } from '../engine/types';
import { TIERS, tierById, type TierConfig } from '../generator/difficulty';
import type { Progress, SolvedRecord } from '../storage/persistence';

export interface SolveResult {
  elapsedMs: number;
  hintUsed: boolean;
  perfect: boolean;
}

export function solvedCount(progress: Progress, tier: TierId): number {
  return Object.keys(progress.tiers[tier]?.solved ?? {}).length;
}

export function solvedRecord(
  progress: Progress,
  tier: TierId,
  index: number,
): SolvedRecord | null {
  return progress.tiers[tier]?.solved[index] ?? null;
}

export function isSolved(
  progress: Progress,
  tier: TierId,
  index: number,
): boolean {
  return solvedRecord(progress, tier, index) !== null;
}

/** Spec 11.2: a tier opens once its gate tier has enough solves. */
export function isUnlocked(tier: TierConfig, progress: Progress): boolean {
  if (tier.unlock === null) return true;
  return solvedCount(progress, tier.unlock.tier) >= tier.unlock.solved;
}

export function unlockedTiers(progress: Progress): TierConfig[] {
  return TIERS.filter((tier) => isUnlocked(tier, progress));
}

/**
 * A solve is perfect when no hint was used and every colour was drawn exactly
 * once, which is what a move count equal to the pair count means.
 */
export function isPerfect(
  moves: number,
  pairCount: number,
  hintUsed: boolean,
): boolean {
  return !hintUsed && moves === pairCount;
}

/**
 * Records a solve, keeping the best time. Returns the updated progress and
 * whether this attempt set a new best. Never mutates the input.
 */
export function recordSolve(
  progress: Progress,
  tier: TierId,
  index: number,
  result: SolveResult,
  at: string,
): { progress: Progress; newBest: boolean } {
  const existing = solvedRecord(progress, tier, index);
  const newBest = existing === null || result.elapsedMs < existing.bestMs;

  const record: SolvedRecord = {
    bestMs: newBest ? result.elapsedMs : existing.bestMs,
    // Once earned without a hint, the clean solve stands.
    hint: existing ? existing.hint && result.hintUsed : result.hintUsed,
    perfect: (existing?.perfect ?? false) || result.perfect,
    at: existing?.at ?? at,
  };

  const tiers = { ...progress.tiers };
  const current = tiers[tier] ?? { solved: {} };
  tiers[tier] = { solved: { ...current.solved, [index]: record } };
  return { progress: { tiers }, newBest };
}

/** The level the grid suggests next: the first unsolved one, else level 1. */
export function firstUnsolved(progress: Progress, tier: TierId): number {
  const config = tierById(tier);
  for (let index = 1; index <= config.levelCount; index++) {
    if (!isSolved(progress, tier, index)) return index;
  }
  return 1;
}

/** The next level to play after a solve, or null at the end of a tier. */
export function nextLevel(tier: TierConfig, index: number): number | null {
  return index < tier.levelCount ? index + 1 : null;
}
