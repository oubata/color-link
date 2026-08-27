import { describe, expect, it } from 'vitest';
import { Engine } from '../../src/engine/engine';
import { buildOccupancy } from '../../src/engine/queries';
import {
  cellEquals,
  cellIndex,
  EMPTY,
  isAdjacent,
  type Cell,
  type Level,
} from '../../src/engine/types';
import { mulberry32, randomInt } from '../../src/generator/prng';
import { makeRowLevel } from '../fixtures';

/** The three invariants from spec 5.2, plus agreement with the query layer. */
function violations(level: Level, engine: Engine): string[] {
  const found: string[] = [];
  const paths = engine.paths;
  const owner = new Map<number, number>();

  for (let c = 0; c < paths.length; c++) {
    const path = paths[c];
    const pair = level.pairs[c];
    if (!path || !pair) {
      found.push(`colour ${c} has no path or pair`);
      continue;
    }
    if (path.length === 0) continue;

    const first = path[0];
    if (!first) {
      found.push(`colour ${c} has a hole`);
      continue;
    }
    if (!cellEquals(first, pair.a) && !cellEquals(first, pair.b)) {
      found.push(`colour ${c} starts at ${first.join(',')}, not an endpoint`);
    }

    for (let i = 0; i < path.length; i++) {
      const cell = path[i];
      if (!cell) {
        found.push(`colour ${c} has a hole at ${i}`);
        continue;
      }
      const index = cellIndex(level.size, cell);
      const existing = owner.get(index);
      if (existing !== undefined) {
        found.push(`cell ${cell.join(',')} claimed by ${existing} and ${c}`);
      }
      owner.set(index, c);

      const endpoint = engine.endpointColorAt(cell);
      if (endpoint !== EMPTY && endpoint !== c) {
        found.push(`colour ${c} covers endpoint of ${endpoint}`);
      }

      const previous = i > 0 ? path[i - 1] : undefined;
      if (previous && !isAdjacent(previous, cell)) {
        found.push(`colour ${c} jumps at index ${i}`);
      }
    }
  }

  const expected = buildOccupancy(level, paths);
  for (let i = 0; i < expected.length; i++) {
    const cell: Cell = [Math.floor(i / level.size), i % level.size];
    if (engine.occupantAt(cell) !== expected[i]) {
      found.push(`occupancy drift at ${cell.join(',')}`);
      break;
    }
  }

  return found;
}

const SIZES = [5, 6, 8, 10, 12, 14];
const OPERATIONS = 10_000;

describe('engine invariants (spec 12.6)', () => {
  for (const size of SIZES) {
    it(`holds across ${OPERATIONS} random operations on a ${size}×${size} board`, () => {
      const level = makeRowLevel(size);
      const engine = new Engine(level);
      const rng = mulberry32(0x5eed + size);

      const randomCell = (): Cell => [
        randomInt(rng, size),
        randomInt(rng, size),
      ];

      for (let op = 0; op < OPERATIONS; op++) {
        const roll = rng();
        if (roll < 0.2) {
          engine.begin(randomCell());
        } else if (roll < 0.75) {
          engine.extend(randomCell());
        } else if (roll < 0.9) {
          engine.end();
        } else if (roll < 0.95) {
          engine.undo();
        } else if (roll < 0.98) {
          engine.hint();
        } else {
          engine.end();
          engine.restart();
        }

        if (op % 25 === 0) {
          const found = violations(level, engine);
          expect(found, `after operation ${op}`).toEqual([]);
        }
      }

      expect(violations(level, engine)).toEqual([]);
    });
  }
});
