import { describe, expect, it } from 'vitest';
import { Engine } from '../../src/engine/engine';
import { EASY_001 } from '../fixtures';

describe('begin (spec 5.2)', () => {
  it('starting on an endpoint discards any previous path of that colour', () => {
    const engine = new Engine(EASY_001);
    engine.begin([0, 0]);
    engine.extend([0, 1]);
    engine.extend([0, 2]);
    engine.end();
    expect(engine.paths[0]).toHaveLength(3);

    engine.begin([0, 0]);
    expect(engine.paths[0]).toEqual([[0, 0]]);
    expect(engine.strokeActive).toBe(true);
    expect(engine.activeColor).toBe(0);
  });

  it('starting on the far endpoint discards a completed path and redraws from there', () => {
    const engine = new Engine(EASY_001);
    engine.begin([1, 0]);
    engine.extend([1, 1]);
    engine.extend([1, 2]);
    engine.extend([1, 3]);
    engine.end();
    expect(engine.isComplete(1)).toBe(true);

    engine.begin([1, 3]);
    expect(engine.paths[1]).toEqual([[1, 3]]);
    expect(engine.isComplete(1)).toBe(false);
  });

  it('starting mid-path truncates the path to end at that cell', () => {
    const engine = new Engine(EASY_001);
    engine.begin([0, 0]);
    engine.extend([0, 1]);
    engine.extend([0, 2]);
    engine.extend([0, 3]);
    engine.end();

    engine.begin([0, 1]);
    expect(engine.paths[0]).toEqual([
      [0, 0],
      [0, 1],
    ]);
    expect(engine.activeColor).toBe(0);
    expect(engine.occupantAt([0, 2])).toBe(-1);
    expect(engine.occupantAt([0, 3])).toBe(-1);
  });

  it('starting on an empty cell does nothing and leaves no active stroke', () => {
    const engine = new Engine(EASY_001);
    expect(engine.begin([2, 2])).toBe(false);
    expect(engine.strokeActive).toBe(false);
    expect(engine.paths.every((p) => p.length === 0)).toBe(true);
  });

  it('starting off the board does nothing', () => {
    const engine = new Engine(EASY_001);
    expect(engine.begin([-1, 0])).toBe(false);
    expect(engine.begin([0, 5])).toBe(false);
    expect(engine.strokeActive).toBe(false);
  });

  it('a new begin ends the previous stroke', () => {
    const engine = new Engine(EASY_001);
    engine.begin([0, 0]);
    engine.extend([0, 1]);
    engine.begin([1, 0]);
    expect(engine.activeColor).toBe(1);
    expect(engine.moves).toBe(1);
    expect(engine.canUndo).toBe(false);
  });
});
