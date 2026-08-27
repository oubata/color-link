import type { Cell, Level } from '../src/engine/types';

/** The hand-checked 5×5 example from spec 7.2. */
export const EASY_001: Level = {
  id: 'easy-001',
  tier: 'easy',
  index: 1,
  size: 5,
  pairs: [
    { color: 0, a: [0, 0], b: [0, 4] },
    { color: 1, a: [1, 0], b: [1, 3] },
    { color: 2, a: [2, 0], b: [1, 4] },
    { color: 3, a: [3, 0], b: [3, 4] },
    { color: 4, a: [4, 0], b: [4, 4] },
  ],
  solution: [
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
    ],
    [
      [1, 0],
      [1, 1],
      [1, 2],
      [1, 3],
    ],
    [
      [2, 0],
      [2, 1],
      [2, 2],
      [2, 3],
      [2, 4],
      [1, 4],
    ],
    [
      [3, 0],
      [3, 1],
      [3, 2],
      [3, 3],
      [3, 4],
    ],
    [
      [4, 0],
      [4, 1],
      [4, 2],
      [4, 3],
      [4, 4],
    ],
  ],
  seed: 0,
  generatorVersion: 1,
};

/**
 * A 3×3 board whose two pairs can also be joined the short way, which leaves
 * cells uncovered. Used to separate "all pairs connected" from "solved".
 */
export const TINY_3x3: Level = {
  id: 'tiny-001',
  tier: 'easy',
  index: 1,
  size: 3,
  pairs: [
    { color: 0, a: [0, 0], b: [2, 2] },
    { color: 1, a: [1, 0], b: [2, 0] },
  ],
  solution: [
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 2],
      [2, 2],
    ],
    [
      [1, 0],
      [1, 1],
      [2, 1],
      [2, 0],
    ],
  ],
  seed: 0,
  generatorVersion: 1,
};

/**
 * A trivially valid level of any size: one horizontal path per row. Used by the
 * property tests so every board size has a level before the generator exists.
 */
export function makeRowLevel(size: number): Level {
  const solution: Cell[][] = [];
  for (let r = 0; r < size; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < size; c++) row.push([r, c]);
    solution.push(row);
  }
  return {
    id: `rows-${size}`,
    tier: 'easy',
    index: 1,
    size,
    pairs: solution.map((path, color) => {
      const a = path[0];
      const b = path[path.length - 1];
      if (!a || !b) throw new Error('empty row');
      return { color, a, b };
    }),
    solution,
    seed: 0,
    generatorVersion: 1,
  };
}

/** Replay a full path through the engine the way a player would drag it. */
export function drawPath(
  engine: { begin(c: Cell): boolean; extend(c: Cell): void; end(): void },
  path: readonly Cell[],
): void {
  const first = path[0];
  if (!first) return;
  engine.begin(first);
  for (let i = 1; i < path.length; i++) {
    const cell = path[i];
    if (cell) engine.extend(cell);
  }
  engine.end();
}
