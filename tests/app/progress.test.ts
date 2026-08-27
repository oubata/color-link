import { describe, expect, it } from 'vitest';
import {
  firstUnsolved,
  isPerfect,
  isSolved,
  isUnlocked,
  nextLevel,
  recordSolve,
  solvedCount,
  unlockedTiers,
} from '../../src/app/progress';
import { TIERS, tierById } from '../../src/generator/difficulty';
import { defaultProgress, type Progress } from '../../src/storage/persistence';

const AT = '2026-08-27T10:00:00.000Z';

function solve(
  progress: Progress,
  tier: 'easy' | 'normal' | 'hard' | 'extreme' | 'expert' | 'master',
  index: number,
  elapsedMs = 60_000,
): Progress {
  return recordSolve(
    progress,
    tier,
    index,
    { elapsedMs, hintUsed: false, perfect: false },
    AT,
  ).progress;
}

describe('unlock rules (spec 11.2)', () => {
  it('opens Easy, Normal and Hard from the start', () => {
    const progress = defaultProgress();
    expect(unlockedTiers(progress).map((t) => t.id)).toEqual([
      'easy',
      'normal',
      'hard',
    ]);
  });

  it('opens Extreme after 20 Hard solves, and not at 19', () => {
    let progress = defaultProgress();
    for (let i = 1; i <= 19; i++) progress = solve(progress, 'hard', i);
    expect(isUnlocked(tierById('extreme'), progress)).toBe(false);
    progress = solve(progress, 'hard', 20);
    expect(isUnlocked(tierById('extreme'), progress)).toBe(true);
  });

  it('chains Expert behind Extreme and Master behind Expert', () => {
    let progress = defaultProgress();
    for (let i = 1; i <= 20; i++) progress = solve(progress, 'extreme', i);
    expect(isUnlocked(tierById('expert'), progress)).toBe(true);
    expect(isUnlocked(tierById('master'), progress)).toBe(false);
    for (let i = 1; i <= 20; i++) progress = solve(progress, 'expert', i);
    expect(isUnlocked(tierById('master'), progress)).toBe(true);
  });

  it('counts solves per tier', () => {
    let progress = defaultProgress();
    progress = solve(progress, 'easy', 3);
    progress = solve(progress, 'easy', 7);
    expect(solvedCount(progress, 'easy')).toBe(2);
    expect(solvedCount(progress, 'normal')).toBe(0);
  });
});

describe('best times', () => {
  it('records a first solve as the best', () => {
    const { progress, newBest } = recordSolve(
      defaultProgress(),
      'easy',
      1,
      { elapsedMs: 30_000, hintUsed: false, perfect: true },
      AT,
    );
    expect(newBest).toBe(true);
    expect(progress.tiers.easy.solved[1]?.bestMs).toBe(30_000);
  });

  it('only lowers the best time', () => {
    let progress = solve(defaultProgress(), 'easy', 1, 30_000);
    const slower = recordSolve(
      progress,
      'easy',
      1,
      { elapsedMs: 45_000, hintUsed: false, perfect: false },
      AT,
    );
    expect(slower.newBest).toBe(false);
    expect(slower.progress.tiers.easy.solved[1]?.bestMs).toBe(30_000);

    progress = slower.progress;
    const faster = recordSolve(
      progress,
      'easy',
      1,
      { elapsedMs: 20_000, hintUsed: false, perfect: false },
      AT,
    );
    expect(faster.newBest).toBe(true);
    expect(faster.progress.tiers.easy.solved[1]?.bestMs).toBe(20_000);
  });

  it('clears the hint marker once the level is solved without one', () => {
    const hinted = recordSolve(
      defaultProgress(),
      'easy',
      1,
      { elapsedMs: 30_000, hintUsed: true, perfect: false },
      AT,
    ).progress;
    expect(hinted.tiers.easy.solved[1]?.hint).toBe(true);

    const clean = recordSolve(
      hinted,
      'easy',
      1,
      { elapsedMs: 40_000, hintUsed: false, perfect: true },
      AT,
    ).progress;
    expect(clean.tiers.easy.solved[1]?.hint).toBe(false);
    expect(clean.tiers.easy.solved[1]?.perfect).toBe(true);
    // The slower clean run must not overwrite the faster time.
    expect(clean.tiers.easy.solved[1]?.bestMs).toBe(30_000);
  });

  it('does not mutate the progress it was given', () => {
    const before = defaultProgress();
    const snapshot = JSON.stringify(before);
    recordSolve(
      before,
      'easy',
      1,
      { elapsedMs: 1000, hintUsed: false, perfect: false },
      AT,
    );
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe('perfect rule', () => {
  it('needs one move per pair and no hint', () => {
    expect(isPerfect(8, 8, false)).toBe(true);
    expect(isPerfect(8, 8, true)).toBe(false);
    expect(isPerfect(9, 8, false)).toBe(false);
    expect(isPerfect(7, 8, false)).toBe(false);
  });
});

describe('level suggestions', () => {
  it('suggests the first unsolved level', () => {
    let progress = defaultProgress();
    expect(firstUnsolved(progress, 'easy')).toBe(1);
    progress = solve(progress, 'easy', 1);
    progress = solve(progress, 'easy', 2);
    expect(firstUnsolved(progress, 'easy')).toBe(3);
    progress = solve(progress, 'easy', 4);
    expect(firstUnsolved(progress, 'easy')).toBe(3);
  });

  it('falls back to level 1 once a tier is complete', () => {
    let progress = defaultProgress();
    for (let i = 1; i <= 100; i++) progress = solve(progress, 'easy', i);
    expect(firstUnsolved(progress, 'easy')).toBe(1);
    expect(isSolved(progress, 'easy', 100)).toBe(true);
  });

  it('stops offering a next level at the end of a tier', () => {
    for (const tier of TIERS) {
      expect(nextLevel(tier, 1)).toBe(2);
      expect(nextLevel(tier, tier.levelCount)).toBeNull();
    }
  });
});
