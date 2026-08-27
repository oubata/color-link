import { describe, expect, it } from 'vitest';
import { Engine } from '../../src/engine/engine';
import type { EngineEvent } from '../../src/engine/types';
import { EASY_001 } from '../fixtures';

describe('extend (spec 5.2)', () => {
  it('does nothing without an active stroke', () => {
    const engine = new Engine(EASY_001);
    engine.extend([0, 1]);
    expect(engine.paths[0]).toHaveLength(0);
  });

  it('appends an empty adjacent cell', () => {
    const engine = new Engine(EASY_001);
    engine.begin([0, 0]);
    engine.extend([0, 1]);
    expect(engine.paths[0]).toEqual([
      [0, 0],
      [0, 1],
    ]);
    expect(engine.occupantAt([0, 1])).toBe(0);
  });

  it('re-extending onto the head is a no-op', () => {
    const engine = new Engine(EASY_001);
    engine.begin([0, 0]);
    engine.extend([0, 1]);
    engine.extend([0, 1]);
    expect(engine.paths[0]).toHaveLength(2);
  });

  it('backtracks by truncating to the revisited cell', () => {
    const engine = new Engine(EASY_001);
    engine.begin([0, 0]);
    engine.extend([0, 1]);
    engine.extend([0, 2]);
    engine.extend([0, 1]);
    expect(engine.paths[0]).toEqual([
      [0, 0],
      [0, 1],
    ]);
    expect(engine.occupantAt([0, 2])).toBe(-1);
  });

  it('is blocked by a foreign endpoint', () => {
    const engine = new Engine(EASY_001);
    engine.begin([0, 0]);
    engine.extend([1, 0]);
    expect(engine.paths[0]).toEqual([[0, 0]]);
    expect(engine.occupantAt([1, 0])).toBe(1);
  });

  it('completes on the twin endpoint and refuses further extension', () => {
    const events: EngineEvent[] = [];
    const engine = new Engine(EASY_001);
    engine.on((e) => events.push(e));

    engine.begin([1, 0]);
    engine.extend([1, 1]);
    engine.extend([1, 2]);
    engine.extend([1, 3]);
    expect(engine.isComplete(1)).toBe(true);
    expect(
      events.some((e) => e.type === 'pathCompleted' && e.color === 1),
    ).toBe(true);

    engine.extend([2, 3]);
    expect(engine.paths[1]).toHaveLength(4);
  });

  it('cuts another colour back to the cell before the collision, then appends', () => {
    const events: EngineEvent[] = [];
    const engine = new Engine(EASY_001);

    engine.begin([1, 0]);
    engine.extend([1, 1]);
    engine.extend([1, 2]);
    engine.end();

    engine.on((e) => events.push(e));
    engine.begin([0, 0]);
    engine.extend([0, 1]);
    engine.extend([1, 1]);

    expect(engine.paths[1]).toEqual([[1, 0]]);
    expect(engine.paths[0]).toEqual([
      [0, 0],
      [0, 1],
      [1, 1],
    ]);
    expect(engine.occupantAt([1, 2])).toBe(-1);
    expect(engine.occupantAt([1, 1])).toBe(0);
    expect(events.some((e) => e.type === 'pathCut' && e.color === 1)).toBe(
      true,
    );
  });

  it('cutting the first cell after an endpoint leaves that path at length 1', () => {
    const engine = new Engine(EASY_001);
    engine.begin([1, 0]);
    engine.extend([1, 1]);
    engine.end();

    engine.begin([0, 0]);
    engine.extend([0, 1]);
    engine.extend([1, 1]);
    expect(engine.paths[1]).toEqual([[1, 0]]);
    expect(engine.occupantAt([1, 0])).toBe(1);
  });

  it('interpolates a non-adjacent cell that shares a row', () => {
    const engine = new Engine(EASY_001);
    engine.begin([0, 0]);
    engine.extend([0, 4]);
    expect(engine.paths[0]).toEqual([
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
    ]);
    expect(engine.isComplete(0)).toBe(true);
  });

  it('interpolates a non-adjacent cell that shares a column', () => {
    const engine = new Engine(EASY_001);
    engine.begin([1, 3]);
    engine.extend([4, 3]);
    expect(engine.paths[1]).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
      [4, 3],
    ]);
  });

  it('interpolation stops at the first cell that has no effect', () => {
    const engine = new Engine(EASY_001);
    engine.begin([0, 0]);
    engine.extend([4, 0]);
    expect(engine.paths[0]).toEqual([[0, 0]]);
  });

  it('ignores a diagonal jump', () => {
    const engine = new Engine(EASY_001);
    engine.begin([0, 0]);
    engine.extend([2, 2]);
    expect(engine.paths[0]).toEqual([[0, 0]]);
  });

  it('ignores cells outside the board', () => {
    const engine = new Engine(EASY_001);
    engine.begin([0, 0]);
    engine.extend([-1, 0]);
    engine.extend([0, -1]);
    expect(engine.paths[0]).toEqual([[0, 0]]);
  });

  it('a complete path cannot be extended until it is begun again', () => {
    const engine = new Engine(EASY_001);
    engine.begin([0, 0]);
    engine.extend([0, 4]);
    expect(engine.isComplete(0)).toBe(true);
    engine.extend([1, 4]);
    expect(engine.paths[0]).toHaveLength(5);
  });
});
