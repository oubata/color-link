import {
  cellEquals,
  cellIndex,
  EMPTY,
  type Cell,
  type Level,
  type Paths,
} from './types';

/**
 * Occupancy derived from scratch: endpoints are always occupied by their own
 * colour, plus every cell of every drawn path. The engine maintains the same
 * information incrementally; the invariant tests assert the two agree.
 */
export function buildOccupancy(level: Level, paths: Paths): Int32Array {
  const grid = new Int32Array(level.size * level.size).fill(EMPTY);
  for (const pair of level.pairs) {
    grid[cellIndex(level.size, pair.a)] = pair.color;
    grid[cellIndex(level.size, pair.b)] = pair.color;
  }
  for (let c = 0; c < paths.length; c++) {
    const path = paths[c];
    if (!path) continue;
    for (const cell of path) {
      grid[cellIndex(level.size, cell)] = c;
    }
  }
  return grid;
}

export function occupiedCount(level: Level, paths: Paths): number {
  const grid = buildOccupancy(level, paths);
  let n = 0;
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] !== EMPTY) n++;
  }
  return n;
}

/** Fraction of the board covered, 0..1. */
export function coverage(level: Level, paths: Paths): number {
  return occupiedCount(level, paths) / (level.size * level.size);
}

/** Coverage as an integer percentage, rounded down (spec 5.5). */
export function coveragePercent(level: Level, paths: Paths): number {
  return Math.floor(coverage(level, paths) * 100);
}

export function endpointsOf(level: Level, color: number): [Cell, Cell] | null {
  const pair = level.pairs[color];
  return pair ? [pair.a, pair.b] : null;
}

/** A path is complete when it runs from one endpoint of its colour to the other. */
export function isPathComplete(
  level: Level,
  paths: Paths,
  color: number,
): boolean {
  const path = paths[color];
  const pair = level.pairs[color];
  if (!path || !pair || path.length < 2) return false;
  const first = path[0];
  const last = path[path.length - 1];
  if (!first || !last) return false;
  return (
    (cellEquals(first, pair.a) && cellEquals(last, pair.b)) ||
    (cellEquals(first, pair.b) && cellEquals(last, pair.a))
  );
}

export function completedCount(level: Level, paths: Paths): number {
  let n = 0;
  for (let c = 0; c < level.pairs.length; c++) {
    if (isPathComplete(level, paths, c)) n++;
  }
  return n;
}

/** Spec 5.3: every pair connected AND every cell covered. */
export function isWon(level: Level, paths: Paths): boolean {
  if (completedCount(level, paths) !== level.pairs.length) return false;
  return occupiedCount(level, paths) === level.size * level.size;
}
