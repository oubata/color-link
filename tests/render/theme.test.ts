import { describe, expect, it } from 'vitest';
import { MAX_COLORS } from '../../src/generator/difficulty';
import {
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
