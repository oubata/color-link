import { describe, expect, it } from 'vitest';
import { TIERS } from '../../src/generator/difficulty';
import { generate } from '../../src/generator/generate';
import { replaysToWin } from '../../src/generator/validate';
import { Engine } from '../../src/engine/engine';
import {
  coveragePercent,
  WIN_REQUIRES_FULL_COVERAGE,
} from '../../src/engine/queries';

describe('completability under the full-coverage rule', () => {
  it('every one of the 600 levels is solvable to 100% coverage', () => {
    expect(WIN_REQUIRES_FULL_COVERAGE).toBe(true);

    const failures: string[] = [];
    const perTier: string[] = [];
    let checked = 0;
    let minCoverage = 100;

    for (const tier of TIERS) {
      let tierMin = 100;
      for (let i = 1; i <= tier.levelCount; i++) {
        const level = generate(tier, i);
        checked++;

        // Replay the solution exactly as a player would drag it.
        const engine = new Engine(level);
        for (const path of level.solution) {
          const first = path[0];
          if (!first) continue;
          engine.begin(first);
          for (let k = 1; k < path.length; k++) {
            const cell = path[k];
            if (cell) engine.extend(cell);
          }
          engine.end();
        }

        const pct = coveragePercent(level, engine.paths);
        if (pct < tierMin) tierMin = pct;
        if (pct < minCoverage) minCoverage = pct;
        if (!engine.won) failures.push(`${level.id}: won=false at ${pct}%`);
        if (pct !== 100) failures.push(`${level.id}: only ${pct}% covered`);
        if (!replaysToWin(level)) {
          failures.push(`${level.id}: validator replay failed`);
        }
      }
      perTier.push(
        `${tier.name.padEnd(8)} 100/100 solvable, min coverage ${tierMin}%`,
      );
    }

    console.log(
      `\n${perTier.join('\n')}\n${checked} levels replayed, all won\n`,
    );
    expect(failures.slice(0, 10)).toEqual([]);
    expect(checked).toBe(600);
    expect(minCoverage).toBe(100);
  }, 120_000);
});
