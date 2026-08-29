import { describe, expect, it } from 'vitest';
import { Engine } from '../../src/engine/engine';
import {
  completedCount,
  coveragePercent,
  isWon,
  occupiedCount,
} from '../../src/engine/queries';
import type { EngineEvent } from '../../src/engine/types';
import { drawPath, EASY_001, TINY_3x3 } from '../fixtures';

describe('win condition (spec 5.3)', () => {
  it('replaying the spec 7.2 solution wins the level', () => {
    const events: EngineEvent[] = [];
    const engine = new Engine(EASY_001);
    engine.on((e) => events.push(e));

    for (const path of EASY_001.solution) drawPath(engine, path);

    expect(engine.won).toBe(true);
    expect(events.filter((e) => e.type === 'won')).toHaveLength(1);
    expect(coveragePercent(EASY_001, engine.paths)).toBe(100);
  });

  it('is not won while a single cell is uncovered, even with every pair connected', () => {
    const engine = new Engine(TINY_3x3);
    drawPath(engine, TINY_3x3.solution[0] ?? []);
    // Colour 1 takes the short way home, stranding (1,1) and (2,1).
    drawPath(engine, [
      [1, 0],
      [2, 0],
    ]);

    expect(completedCount(TINY_3x3, engine.paths)).toBe(2);
    expect(occupiedCount(TINY_3x3, engine.paths)).toBe(7);
    expect(coveragePercent(TINY_3x3, engine.paths)).toBe(77);
    expect(engine.won).toBe(false);
  });

  it('is won once the stranded cells are picked up', () => {
    const engine = new Engine(TINY_3x3);
    drawPath(engine, TINY_3x3.solution[0] ?? []);
    drawPath(engine, [
      [1, 0],
      [2, 0],
    ]);
    expect(engine.won).toBe(false);

    // Redraw colour 1 the long way, through the cells it had skipped.
    drawPath(engine, TINY_3x3.solution[1] ?? []);
    expect(engine.won).toBe(true);
    expect(coveragePercent(TINY_3x3, engine.paths)).toBe(100);
  });

  it('the full solution wins and covers the board', () => {
    const engine = new Engine(TINY_3x3);
    for (const path of TINY_3x3.solution) drawPath(engine, path);
    expect(engine.won).toBe(true);
    expect(occupiedCount(TINY_3x3, engine.paths)).toBe(9);
  });

  it('is not won while any pair is still unconnected', () => {
    const engine = new Engine(TINY_3x3);
    drawPath(engine, TINY_3x3.solution[0] ?? []);
    expect(completedCount(TINY_3x3, engine.paths)).toBe(1);
    expect(engine.won).toBe(false);
  });

  it('counts endpoints as occupied even with no path drawn', () => {
    const engine = new Engine(EASY_001);
    expect(occupiedCount(EASY_001, engine.paths)).toBe(10);
    expect(coveragePercent(EASY_001, engine.paths)).toBe(40);
  });

  it('rounds coverage down to a whole percent', () => {
    const engine = new Engine(EASY_001);
    engine.begin([0, 0]);
    engine.extend([0, 1]);
    engine.end();
    // 11 of 25 cells = 44%
    expect(coveragePercent(EASY_001, engine.paths)).toBe(44);
  });

  it('fires mid-stroke and force-ends the stroke', () => {
    const engine = new Engine(EASY_001);
    const solution = EASY_001.solution;
    for (let c = 0; c < 4; c++) {
      const path = solution[c];
      if (path) drawPath(engine, path);
    }

    const last = solution[4];
    if (!last) throw new Error('missing path');
    const first = last[0];
    if (!first) throw new Error('empty path');
    engine.begin(first);
    for (let i = 1; i < last.length; i++) {
      const cell = last[i];
      if (cell) engine.extend(cell);
    }

    expect(engine.won).toBe(true);
    expect(engine.strokeActive).toBe(false);

    // Movement after the win is ignored.
    engine.extend([3, 4]);
    expect(engine.paths[4]).toHaveLength(5);
  });

  it('queries agree with the engine flag', () => {
    const engine = new Engine(EASY_001);
    for (const path of EASY_001.solution) drawPath(engine, path);
    expect(isWon(EASY_001, engine.paths)).toBe(engine.won);
  });
});
