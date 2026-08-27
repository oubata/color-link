import { Engine } from '../engine/engine';
import { cellEquals, cellIndex, isAdjacent, type Level } from '../engine/types';
import { MAX_COLORS, MIN_PATH_LENGTH, maxPathLength } from './difficulty';

/**
 * Structural checks plus a full replay of the solution through the engine.
 * A level that passes is guaranteed solvable, because the solution is the
 * partition the generator started from.
 */
export function validateLevel(level: Level): string[] {
  const problems: string[] = [];
  const { size, pairs, solution } = level;
  const cells = size * size;

  if (pairs.length !== solution.length) {
    problems.push(
      `pairs (${pairs.length}) and solution (${solution.length}) disagree`,
    );
    return problems;
  }
  if (pairs.length > MAX_COLORS) {
    problems.push(
      `${pairs.length} pairs exceeds the ${MAX_COLORS}-colour palette`,
    );
  }

  const seen = new Set<number>();
  for (let c = 0; c < solution.length; c++) {
    const path = solution[c];
    const pair = pairs[c];
    if (!path || !pair) {
      problems.push(`colour ${c} is missing its path or pair`);
      continue;
    }
    if (pair.color !== c)
      problems.push(`pair ${c} carries colour ${pair.color}`);
    if (path.length < MIN_PATH_LENGTH) {
      problems.push(`colour ${c} path has length ${path.length}`);
    }
    if (path.length > maxPathLength(size)) {
      problems.push(
        `colour ${c} path has length ${path.length}, over the maximum`,
      );
    }

    const first = path[0];
    const last = path[path.length - 1];
    if (!first || !last) {
      problems.push(`colour ${c} path is empty`);
      continue;
    }
    if (!cellEquals(first, pair.a))
      problems.push(`colour ${c} does not start at endpoint a`);
    if (!cellEquals(last, pair.b))
      problems.push(`colour ${c} does not end at endpoint b`);

    for (let i = 0; i < path.length; i++) {
      const cell = path[i];
      if (!cell) {
        problems.push(`colour ${c} path has a hole at ${i}`);
        continue;
      }
      if (cell[0] < 0 || cell[0] >= size || cell[1] < 0 || cell[1] >= size) {
        problems.push(`colour ${c} leaves the board at ${cell.join(',')}`);
        continue;
      }
      const index = cellIndex(size, cell);
      if (seen.has(index))
        problems.push(`cell ${cell.join(',')} is used twice`);
      seen.add(index);
      const previous = i > 0 ? path[i - 1] : undefined;
      if (previous && !isAdjacent(previous, cell)) {
        problems.push(
          `colour ${c} jumps between ${previous.join(',')} and ${cell.join(',')}`,
        );
      }
    }
  }

  if (seen.size !== cells) {
    problems.push(`solution covers ${seen.size} of ${cells} cells`);
  }

  if (problems.length === 0 && !replaysToWin(level)) {
    problems.push('replaying the solution through the engine does not win');
  }

  return problems;
}

/** Drag every solution path exactly as a player would, then check the win flag. */
export function replaysToWin(level: Level): boolean {
  const engine = new Engine(level);
  for (const path of level.solution) {
    const first = path[0];
    if (!first) return false;
    engine.begin(first);
    for (let i = 1; i < path.length; i++) {
      const cell = path[i];
      if (cell) engine.extend(cell);
    }
    engine.end();
  }
  return engine.won;
}

export function assertValidLevel(level: Level): void {
  const problems = validateLevel(level);
  if (problems.length > 0) {
    throw new Error(`Invalid level ${level.id}: ${problems.join('; ')}`);
  }
}
