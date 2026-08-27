import { describe, expect, it } from 'vitest';
import { Engine } from '../../src/engine/engine';
import { drawPath, EASY_001, TINY_3x3 } from '../fixtures';

describe('hint (spec 5.2)', () => {
  it('draws the lowest colour whose path differs from the solution', () => {
    const engine = new Engine(EASY_001);
    expect(engine.hint()).toBe(true);
    expect(engine.paths[0]).toEqual(EASY_001.solution[0]);
    expect(engine.hintUsed).toBe(true);
    expect(engine.moves).toBe(1);
    expect(engine.isComplete(0)).toBe(true);
  });

  it('skips a colour already drawn as its solution, in either direction', () => {
    const engine = new Engine(EASY_001);
    const reversed = [...(EASY_001.solution[0] ?? [])].reverse();
    drawPath(engine, reversed);

    engine.hint();
    expect(engine.paths[1]).toEqual(EASY_001.solution[1]);
    expect(engine.paths[0]).toEqual(reversed);
  });

  it('cuts a conflicting path back to the cell before the conflict', () => {
    const engine = new Engine(EASY_001);
    // Colour 1 squats on (0,2), which colour 0's solution needs.
    drawPath(engine, [
      [1, 3],
      [1, 2],
      [0, 2],
      [0, 3],
    ]);
    expect(engine.paths[1]).toHaveLength(4);

    engine.hint();
    expect(engine.paths[0]).toEqual(EASY_001.solution[0]);
    expect(engine.paths[1]).toEqual([
      [1, 3],
      [1, 2],
    ]);
  });

  it('is a no-op once the level is won', () => {
    const engine = new Engine(TINY_3x3);
    for (const path of TINY_3x3.solution) drawPath(engine, path);
    expect(engine.won).toBe(true);
    expect(engine.hint()).toBe(false);
  });

  it('can finish a level on its own', () => {
    const engine = new Engine(TINY_3x3);
    engine.hint();
    engine.hint();
    expect(engine.won).toBe(true);
  });

  it('drops a cut path that is left holding only its endpoint', () => {
    const engine = new Engine(EASY_001);
    drawPath(engine, [
      [1, 3],
      [0, 3],
    ]);
    engine.hint();
    expect(engine.paths[1]).toHaveLength(0);
    expect(engine.occupantAt([1, 3])).toBe(1);
  });

  it('is undoable', () => {
    const engine = new Engine(EASY_001);
    engine.hint();
    expect(engine.canUndo).toBe(true);
    engine.undo();
    expect(engine.paths[0]).toHaveLength(0);
    expect(engine.hintUsed).toBe(true);
  });

  it('is refused while a stroke is active', () => {
    const engine = new Engine(EASY_001);
    engine.begin([0, 0]);
    expect(engine.hint()).toBe(false);
  });
});
