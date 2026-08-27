import { describe, expect, it } from 'vitest';
import { BOARD_LAYOUT } from '../../src/app/config';
import { TIERS } from '../../src/generator/difficulty';
import {
  cellAt,
  cellCenter,
  computeCellPx,
  computeLayout,
} from '../../src/render/layout';

describe('board layout (spec 9, criterion 10)', () => {
  it('fits every board size on a 360×640 viewport with tappable cells', () => {
    for (const tier of TIERS) {
      const layout = computeLayout(360, 640, tier.size, 3);
      expect(layout.cellPx).toBeGreaterThanOrEqual(BOARD_LAYOUT.minCellPx);
      expect(layout.boardPx).toBeLessThanOrEqual(
        360 - BOARD_LAYOUT.viewportPaddingX,
      );
    }
  });

  it('follows the cell-size formula', () => {
    expect(computeCellPx(360, 640, 14)).toBe(23);
    expect(computeCellPx(360, 640, 5)).toBe(65);
  });

  it('clamps the cell size at both ends', () => {
    expect(computeCellPx(4000, 4000, 5)).toBe(BOARD_LAYOUT.maxCellPx);
    expect(computeCellPx(200, 300, 14)).toBe(BOARD_LAYOUT.minCellPx);
  });

  it('is limited by height on a short, wide viewport', () => {
    expect(computeCellPx(1200, 400, 8)).toBe(Math.floor((400 - 220) / 8));
  });

  it('maps pixels back to the cell they fall in', () => {
    const layout = computeLayout(360, 640, 8, 2);
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const { x, y } = cellCenter(layout, [row, col]);
        expect(cellAt(layout, x, y)).toEqual([row, col]);
      }
    }
  });

  it('treats the whole cell area as active, with no dead zone', () => {
    const layout = computeLayout(360, 640, 5, 1);
    expect(cellAt(layout, 0, 0)).toEqual([0, 0]);
    expect(cellAt(layout, layout.cellPx - 0.01, layout.cellPx - 0.01)).toEqual([
      0, 0,
    ]);
    expect(cellAt(layout, layout.cellPx, layout.cellPx)).toEqual([1, 1]);
  });

  it('returns null outside the board', () => {
    const layout = computeLayout(360, 640, 5, 1);
    expect(cellAt(layout, -1, 0)).toBeNull();
    expect(cellAt(layout, 0, -1)).toBeNull();
    expect(cellAt(layout, layout.boardPx, 0)).toBeNull();
    expect(cellAt(layout, 0, layout.boardPx)).toBeNull();
  });
});
