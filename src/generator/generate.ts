import type { Cell, Level } from '../engine/types';
import {
  GENERATOR_VERSION,
  MAX_ATTEMPTS_PER_RELAX,
  MAX_COLORS,
  MIN_PATH_LENGTH,
  PAIR_TOLERANCE,
  WARNSDORFF_PROBABILITY,
  maxPathLength,
  minAvgBends,
  stopProbability,
  targetPairs,
  type TierConfig,
} from './difficulty';
import { fnv1a32, mulberry32, randomInt, shuffle, type Rng } from './prng';

export class GeneratorError extends Error {}

/** How much each relax round loosens the constraints. */
const BENDS_FLOOR_BY_RELAX = [1, 0.5, 0];

export function levelSeed(tierId: string, levelIndex: number): number {
  return fnv1a32(`v${GENERATOR_VERSION}|${tierId}|${levelIndex}`);
}

export interface GenerateResult {
  level: Level;
  /** Which relax round produced the level; 0 means no constraints were loosened. */
  relax: number;
  attempts: number;
}

export function generate(tier: TierConfig, levelIndex: number): Level {
  return generateWithStats(tier, levelIndex).level;
}

export function generateWithStats(
  tier: TierConfig,
  levelIndex: number,
): GenerateResult {
  const seed = levelSeed(tier.id, levelIndex);
  const rng = mulberry32(seed);
  const wantedPairs = targetPairs(tier, levelIndex);
  const wantedBends = minAvgBends(tier, levelIndex);
  const longest = maxPathLength(tier.size);
  const stopP = stopProbability(tier.size, wantedPairs);
  let attempts = 0;

  for (let relax = 0; relax < BENDS_FLOOR_BY_RELAX.length; relax++) {
    const tolerance = PAIR_TOLERANCE + relax;
    const bendsFloor = wantedBends * (BENDS_FLOOR_BY_RELAX[relax] ?? 0);

    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_RELAX; attempt++) {
      attempts++;
      const walked = fillWithRandomWalks(
        rng,
        tier.size,
        stopP,
        WARNSDORFF_PROBABILITY,
      );
      const paths = mergeShortPaths(walked, tier.size);
      if (!paths) continue;
      if (paths.length > MAX_COLORS) continue;
      if (paths.some((p) => p.length > longest)) continue;
      if (Math.abs(paths.length - wantedPairs) > tolerance) continue;
      if (averageBends(paths) < bendsFloor) continue;
      return {
        level: buildLevel(tier, levelIndex, paths, rng, seed),
        relax,
        attempts,
      };
    }
  }

  throw new GeneratorError(
    `Could not generate ${tier.id} level ${levelIndex} in ${attempts} attempts`,
  );
}

// ---- Fill ---------------------------------------------------------------

const USED = 1;

export function fillWithRandomWalks(
  rng: Rng,
  size: number,
  stopP: number,
  warnsdorffP: number,
): Cell[][] {
  const grid = new Uint8Array(size * size);
  const empties: number[] = [];
  for (let i = 0; i < size * size; i++) empties.push(i);

  const paths: Cell[][] = [];
  let remaining = size * size;

  while (remaining > 0) {
    const start = takeRandomEmpty(empties, grid, rng);
    if (start < 0) break;
    grid[start] = USED;
    remaining--;

    const path: number[] = [start];
    let head = start;

    for (;;) {
      const candidates = emptyNeighbours(grid, size, head);
      if (candidates.length === 0) break;
      if (path.length >= MIN_PATH_LENGTH && rng() < stopP) break;

      const next =
        rng() < warnsdorffP
          ? fewestExits(grid, size, candidates, rng)
          : (candidates[randomInt(rng, candidates.length)] ?? -1);
      if (next < 0) break;

      grid[next] = USED;
      remaining--;
      path.push(next);
      head = next;
    }

    paths.push(path.map((i) => indexToCell(size, i)));
  }

  return paths;
}

function takeRandomEmpty(
  empties: number[],
  grid: Uint8Array,
  rng: Rng,
): number {
  while (empties.length > 0) {
    const at = randomInt(rng, empties.length);
    const value = empties[at];
    const last = empties[empties.length - 1];
    if (value === undefined || last === undefined) return -1;
    empties[at] = last;
    empties.pop();
    if (grid[value] !== USED) return value;
  }
  return -1;
}

function emptyNeighbours(
  grid: Uint8Array,
  size: number,
  index: number,
): number[] {
  const row = Math.floor(index / size);
  const col = index % size;
  const out: number[] = [];
  if (row > 0 && grid[index - size] !== USED) out.push(index - size);
  if (row < size - 1 && grid[index + size] !== USED) out.push(index + size);
  if (col > 0 && grid[index - 1] !== USED) out.push(index - 1);
  if (col < size - 1 && grid[index + 1] !== USED) out.push(index + 1);
  return out;
}

/** Warnsdorff's rule: head for the corner that is about to close. */
function fewestExits(
  grid: Uint8Array,
  size: number,
  candidates: number[],
  rng: Rng,
): number {
  let best = Number.POSITIVE_INFINITY;
  let tied: number[] = [];
  for (const candidate of candidates) {
    const exits = emptyNeighbours(grid, size, candidate).length;
    if (exits < best) {
      best = exits;
      tied = [candidate];
    } else if (exits === best) {
      tied.push(candidate);
    }
  }
  return tied[randomInt(rng, tied.length)] ?? -1;
}

// ---- Merge --------------------------------------------------------------

/**
 * Absorb paths shorter than MIN_PATH_LENGTH into a neighbour they can be
 * concatenated with. Returns null when a runt has no partner.
 */
export function mergeShortPaths(
  paths: Cell[][],
  size: number,
): Cell[][] | null {
  const working = paths.map((p) => p.slice());
  const guard = working.length * working.length + 16;

  for (let round = 0; round < guard; round++) {
    const shortAt = working.findIndex((p) => p.length < MIN_PATH_LENGTH);
    if (shortAt < 0) return working;

    const short = working[shortAt];
    if (!short || short.length === 0) return null;

    const joined = joinWithNeighbour(working, shortAt, size);
    if (!joined) return null;
  }

  return working.some((p) => p.length < MIN_PATH_LENGTH) ? null : working;
}

function joinWithNeighbour(
  paths: Cell[][],
  shortAt: number,
  size: number,
): boolean {
  const short = paths[shortAt];
  if (!short) return false;
  const shortEnds = endsOf(short);

  for (let other = 0; other < paths.length; other++) {
    if (other === shortAt) continue;
    const candidate = paths[other];
    if (!candidate) continue;
    const otherEnds = endsOf(candidate);

    for (const shortTail of [false, true]) {
      for (const otherHead of [true, false]) {
        const a = shortTail ? shortEnds[1] : shortEnds[0];
        const b = otherHead ? otherEnds[0] : otherEnds[1];
        if (!orthogonallyAdjacent(a, b)) continue;

        // Orient so the touching ends meet in the middle of the new path.
        const left = shortTail ? short.slice() : short.slice().reverse();
        const right = otherHead
          ? candidate.slice()
          : candidate.slice().reverse();
        const merged = left.concat(right);
        if (merged.length > size * size) return false;

        paths[shortAt] = merged;
        paths.splice(other, 1);
        return true;
      }
    }
  }

  return false;
}

function endsOf(path: Cell[]): [Cell, Cell] {
  const first = path[0];
  const last = path[path.length - 1];
  if (!first || !last) throw new GeneratorError('empty path');
  return [first, last];
}

function orthogonallyAdjacent(a: Cell, b: Cell): boolean {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;
}

// ---- Shape measures -----------------------------------------------------

/** Direction changes along a path. */
export function bends(path: readonly Cell[]): number {
  let count = 0;
  for (let i = 2; i < path.length; i++) {
    const a = path[i - 2];
    const b = path[i - 1];
    const c = path[i];
    if (!a || !b || !c) continue;
    const dr1 = b[0] - a[0];
    const dc1 = b[1] - a[1];
    const dr2 = c[0] - b[0];
    const dc2 = c[1] - b[1];
    if (dr1 !== dr2 || dc1 !== dc2) count++;
  }
  return count;
}

export function averageBends(paths: readonly (readonly Cell[])[]): number {
  if (paths.length === 0) return 0;
  let total = 0;
  for (const path of paths) total += bends(path);
  return total / paths.length;
}

// ---- Assembly -----------------------------------------------------------

function buildLevel(
  tier: TierConfig,
  levelIndex: number,
  paths: Cell[][],
  rng: Rng,
  seed: number,
): Level {
  const ordered = shuffle(paths.slice(), rng);
  const solution = ordered.map((path) =>
    rng() < 0.5 ? path.slice().reverse() : path.slice(),
  );

  return {
    id: `${tier.id}-${pad3(levelIndex)}`,
    tier: tier.id,
    index: levelIndex,
    size: tier.size,
    pairs: solution.map((path, color) => {
      const a = path[0];
      const b = path[path.length - 1];
      if (!a || !b) throw new GeneratorError('empty path in solution');
      return { color, a, b };
    }),
    solution,
    seed,
    generatorVersion: GENERATOR_VERSION,
  };
}

function indexToCell(size: number, index: number): Cell {
  return [Math.floor(index / size), index % size];
}

function pad3(value: number): string {
  return String(value).padStart(3, '0');
}
