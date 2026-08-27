export type Cell = readonly [row: number, col: number];

export type TierId =
  'easy' | 'normal' | 'hard' | 'extreme' | 'expert' | 'master';

export interface LevelPair {
  color: number;
  a: Cell;
  b: Cell;
}

export interface Level {
  /** e.g. "hard-042" */
  id: string;
  tier: TierId;
  /** 1-based, 1..levelCount */
  index: number;
  size: number;
  /** length K; `color` always equals the array index */
  pairs: LevelPair[];
  /** solution[c] is the full path for colour c, endpoints included */
  solution: Cell[][];
  /** uint32 */
  seed: number;
  generatorVersion: number;
}

export type Paths = readonly (readonly Cell[])[];

export type EngineEvent =
  | { type: 'change' }
  | { type: 'pathCompleted'; color: number }
  | { type: 'pathCut'; color: number; removed: readonly Cell[] }
  | { type: 'won' };

export type EngineListener = (event: EngineEvent) => void;

export const EMPTY = -1;

export function cellIndex(size: number, cell: Cell): number {
  return cell[0] * size + cell[1];
}

export function cellFromIndex(size: number, index: number): Cell {
  return [Math.floor(index / size), index % size];
}

export function cellEquals(a: Cell, b: Cell): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

export function isAdjacent(a: Cell, b: Cell): boolean {
  const dr = Math.abs(a[0] - b[0]);
  const dc = Math.abs(a[1] - b[1]);
  return dr + dc === 1;
}

export function clonePaths(paths: Paths): Cell[][] {
  return paths.map((p) => p.slice());
}

export function pathsEqual(a: Paths, b: Paths): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const pa = a[i];
    const pb = b[i];
    if (pa === undefined || pb === undefined) return false;
    if (pa.length !== pb.length) return false;
    for (let j = 0; j < pa.length; j++) {
      const ca = pa[j];
      const cb = pb[j];
      if (ca === undefined || cb === undefined) return false;
      if (!cellEquals(ca, cb)) return false;
    }
  }
  return true;
}
