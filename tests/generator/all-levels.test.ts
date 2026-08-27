import { describe, expect, it } from 'vitest';
import {
  MAX_COLORS,
  MIN_PATH_LENGTH,
  PAIR_TOLERANCE,
  TIERS,
  maxPathLength,
  targetPairs,
} from '../../src/generator/difficulty';
import { generateWithStats } from '../../src/generator/generate';
import { validateLevel } from '../../src/generator/validate';

const TOTAL_BUDGET_MS = 20_000;

describe('every level in the game (spec 12.3-12.5)', () => {
  it(
    'generates, validates and stays inside the difficulty envelope',
    () => {
      const started = performance.now();
      const problems: string[] = [];
      const report: string[] = [];
      let slowest = { id: '', ms: 0 };

      for (const tier of TIERS) {
        const histogram = [0, 0, 0];
        let attempts = 0;
        const tierStart = performance.now();

        for (let index = 1; index <= tier.levelCount; index++) {
          const at = performance.now();
          const {
            level,
            relax,
            attempts: used,
          } = generateWithStats(tier, index);
          const took = performance.now() - at;
          if (took > slowest.ms) slowest = { id: level.id, ms: took };

          histogram[relax] = (histogram[relax] ?? 0) + 1;
          attempts += used;

          for (const problem of validateLevel(level)) {
            problems.push(`${level.id}: ${problem}`);
          }

          // Criterion 3: shape of the solution.
          const covered = new Set(
            level.solution.flat().map(([r, c]) => r * level.size + c),
          );
          if (covered.size !== level.size * level.size) {
            problems.push(`${level.id}: covers ${covered.size} cells`);
          }
          for (const path of level.solution) {
            if (path.length < MIN_PATH_LENGTH) {
              problems.push(`${level.id}: path of length ${path.length}`);
            }
            if (path.length > maxPathLength(level.size)) {
              problems.push(
                `${level.id}: path of length ${path.length} is too long`,
              );
            }
          }
          if (level.pairs.length > MAX_COLORS) {
            problems.push(`${level.id}: ${level.pairs.length} pairs`);
          }
          const drift = Math.abs(level.pairs.length - targetPairs(tier, index));
          if (drift > PAIR_TOLERANCE + 2) {
            problems.push(
              `${level.id}: ${level.pairs.length} pairs is ${drift} off target`,
            );
          }
        }

        const tierMs = performance.now() - tierStart;
        const relax2Rate = ((histogram[2] ?? 0) / tier.levelCount) * 100;
        report.push(
          `${tier.name.padEnd(8)} ${tier.size}×${tier.size}  ` +
            `relax 0/1/2 = ${histogram[0]}/${histogram[1]}/${histogram[2]}  ` +
            `relax-2 ${relax2Rate.toFixed(1)}%  ` +
            `${(attempts / tier.levelCount).toFixed(1)} attempts/level  ` +
            `${tierMs.toFixed(0)} ms`,
        );
      }

      const totalMs = performance.now() - started;
      report.push(
        `total ${totalMs.toFixed(0)} ms · slowest level ${slowest.id} at ${slowest.ms.toFixed(1)} ms`,
      );
      console.log(`\n${report.join('\n')}\n`);

      expect(problems.slice(0, 20)).toEqual([]);
      expect(totalMs).toBeLessThan(TOTAL_BUDGET_MS);
    },
    { timeout: 120_000 },
  );
});
