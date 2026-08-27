import { describe, expect, it } from 'vitest';
import { Engine } from '../../src/engine/engine';
import { EASY_001 } from '../fixtures';

describe('undo / restart (spec 5.2)', () => {
  it('a stroke that changed nothing pushes nothing and counts no move', () => {
    const engine = new Engine(EASY_001);
    engine.begin([2, 2]);
    engine.end();
    expect(engine.canUndo).toBe(false);
    expect(engine.moves).toBe(0);
  });

  it('re-beginning on an untouched endpoint counts no move', () => {
    const engine = new Engine(EASY_001);
    engine.begin([0, 0]);
    engine.end();
    expect(engine.moves).toBe(0);
    expect(engine.canUndo).toBe(false);
  });

  it('restores the board as it stood before the stroke', () => {
    const engine = new Engine(EASY_001);
    engine.begin([0, 0]);
    engine.extend([0, 1]);
    engine.end();
    engine.begin([1, 0]);
    engine.extend([1, 1]);
    engine.end();
    expect(engine.moves).toBe(2);

    expect(engine.undo()).toBe(true);
    expect(engine.paths[1]).toHaveLength(0);
    expect(engine.paths[0]).toHaveLength(2);

    expect(engine.undo()).toBe(true);
    expect(engine.paths[0]).toHaveLength(0);
    expect(engine.occupantAt([0, 1])).toBe(-1);

    expect(engine.undo()).toBe(false);
  });

  it('restores a path that another colour cut', () => {
    const engine = new Engine(EASY_001);
    engine.begin([1, 0]);
    engine.extend([1, 2]);
    engine.end();

    engine.begin([0, 0]);
    engine.extend([0, 1]);
    engine.extend([1, 1]);
    engine.end();
    expect(engine.paths[1]).toHaveLength(0);

    engine.undo();
    expect(engine.paths[1]).toEqual([
      [1, 0],
      [1, 1],
      [1, 2],
    ]);
    expect(engine.paths[0]).toHaveLength(0);
  });

  it('is refused while a stroke is active', () => {
    const engine = new Engine(EASY_001);
    engine.begin([0, 0]);
    engine.extend([0, 1]);
    engine.end();
    engine.begin([1, 0]);
    expect(engine.undo()).toBe(false);
  });

  it('restart clears the board, the stack and the move count but not hintUsed', () => {
    const engine = new Engine(EASY_001);
    engine.begin([0, 0]);
    engine.extend([0, 1]);
    engine.end();
    engine.hint();
    expect(engine.hintUsed).toBe(true);

    engine.restart();
    expect(engine.paths.every((p) => p.length === 0)).toBe(true);
    expect(engine.moves).toBe(0);
    expect(engine.canUndo).toBe(false);
    expect(engine.hintUsed).toBe(true);
    expect(engine.hasDrawnCells).toBe(false);
  });
});
