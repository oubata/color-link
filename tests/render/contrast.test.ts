import { describe, expect, it } from 'vitest';
import { MAX_COLORS } from '../../src/generator/difficulty';
import {
  BOARD_STYLE,
  cellColor,
  contrastRatio,
  darken,
  lighten,
  lineColor,
  pathColor,
} from '../../src/render/theme';

/** Composite `hex` at `alpha` over an opaque `ground`, as canvas would. */
function over(hex: string, alpha: number, ground: string): string {
  const parse = (value: string): [number, number, number] => [
    Number.parseInt(value.slice(1, 3), 16),
    Number.parseInt(value.slice(3, 5), 16),
    Number.parseInt(value.slice(5, 7), 16),
  ];
  const [r, g, b] = parse(hex);
  const [gr, gg, gb] = parse(ground);
  const mix = (c: number, d: number): string =>
    Math.round(c * alpha + d * (1 - alpha))
      .toString(16)
      .padStart(2, '0');
  return `#${mix(r, gr)}${mix(g, gg)}${mix(b, gb)}`;
}

const GROUNDS = [
  { name: 'light', cellBackground: '#F7F7F7' },
  { name: 'dark', cellBackground: '#1A1A1A' },
];

describe('board colour contrast (spec 10)', () => {
  for (const ground of GROUNDS) {
    it(`keeps the line readable on its own cell in ${ground.name}`, () => {
      const weak: string[] = [];
      for (let c = 0; c < MAX_COLORS; c++) {
        const cell = over(
          cellColor(c, ground.cellBackground),
          BOARD_STYLE.tintAlpha,
          ground.cellBackground,
        );
        // Lightness only: the line and its cell share a hue, so hue does
        // no work here. Measured worst case is lime at 1.47 (light) and 1.60
        // (dark); lightening the line further barely moves it, because lime is
        // already pale.
        const ratio = contrastRatio(lineColor(c), cell);
        if (ratio < 1.4) {
          weak.push(`${c} ${pathColor(c)} ${ratio.toFixed(2)}:1`);
        }
      }
      expect(weak).toEqual([]);
    });

    it(`makes an occupied cell stand out from an empty one in ${ground.name}`, () => {
      const weak: string[] = [];
      for (let c = 0; c < MAX_COLORS; c++) {
        const cell = over(
          cellColor(c, ground.cellBackground),
          BOARD_STYLE.tintAlpha,
          ground.cellBackground,
        );
        const ratio = contrastRatio(cell, ground.cellBackground);
        if (ratio < 1.35) {
          weak.push(`${c} ${pathColor(c)} ${ratio.toFixed(2)}:1`);
        }
      }
      expect(weak).toEqual([]);
    });
  }
});

describe('colour maths', () => {
  it('hands hex back, so the next comparison does not silently read black', () => {
    expect(lighten('#D62828', 0.5)).toMatch(/^#[0-9a-f]{6}$/);
    expect(darken('#D62828', 0.5)).toMatch(/^#[0-9a-f]{6}$/);
    // The bug this pins: an rgb() string parses as black, which made every
    // contrast comparison downstream meaningless.
    expect(contrastRatio(lighten('#FFFFFF', 0), '#FFFFFF')).toBeCloseTo(1, 2);
    expect(contrastRatio(darken('#000000', 0), '#000000')).toBeCloseTo(1, 2);
  });
});
