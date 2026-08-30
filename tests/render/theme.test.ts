import { describe, expect, it } from 'vitest';
import { MAX_COLORS } from '../../src/generator/difficulty';
import {
  BOARD_STYLE,
  PATH_PALETTE,
  contrastRatio,
  labelColorOn,
  pathColor,
  withAlpha,
} from '../../src/render/theme';

describe('palette (spec 10)', () => {
  it('has one colour per possible pair', () => {
    expect(PATH_PALETTE).toHaveLength(MAX_COLORS);
    expect(new Set(PATH_PALETTE).size).toBe(MAX_COLORS);
  });

  it('gives every colour-blind label at least 4.5:1 against its dot', () => {
    for (const hex of PATH_PALETTE) {
      expect(contrastRatio(hex, labelColorOn(hex))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('stays visible against both page backgrounds', () => {
    for (const hex of PATH_PALETTE) {
      const best = Math.max(
        contrastRatio(hex, '#FFFFFF'),
        contrastRatio(hex, '#121212'),
      );
      expect(best).toBeGreaterThanOrEqual(3);
    }
  });

  it('wraps rather than falling off the end', () => {
    expect(pathColor(0)).toBe(PATH_PALETTE[0]);
    expect(pathColor(MAX_COLORS)).toBe(PATH_PALETTE[0]);
  });

  it('converts hex to rgba for the cell tint', () => {
    expect(withAlpha('#D62828', 0.14)).toBe('rgba(214, 40, 40, 0.14)');
    expect(withAlpha('#FFF', 1)).toBe('rgba(255, 255, 255, 1)');
  });
});

describe('board style (spec 10)', () => {
  it('fills a finished line more strongly than one still being drawn', () => {
    expect(BOARD_STYLE.completedTintAlpha).toBeGreaterThan(
      BOARD_STYLE.tintAlpha,
    );
  });

  it('keeps both tints under the path stroke, so the line still leads', () => {
    expect(BOARD_STYLE.completedTintAlpha).toBeLessThan(BOARD_STYLE.pathAlpha);
    expect(BOARD_STYLE.tintAlpha).toBeLessThan(BOARD_STYLE.pathAlpha);
  });

  it('leaves the endpoint ring inside its own diameter', () => {
    // Two ring widths have to fit across the O with a hole left over, or the
    // letter closes up into a dot.
    expect(BOARD_STYLE.endpointRingWidth * 2).toBeLessThan(
      BOARD_STYLE.endpointDiameter,
    );
  });
});
