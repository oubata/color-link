/**
 * Palette and theme tokens (spec 10). The neutrals live in CSS so the DOM chrome
 * and the canvas cannot drift apart; this module reads them back out.
 */

export type ThemeMode = 'system' | 'light' | 'dark';
export type MotionMode = 'system' | 'on' | 'off';

/**
 * 16 path colours, ordered so that any prefix stays as mutually distinct as
 * possible. Identical in light and dark themes.
 */
export const PATH_PALETTE: readonly string[] = [
  '#D62828', // 0 red
  '#118AB2', // 1 blue
  '#F2B705', // 2 yellow
  '#3FA34D', // 3 green
  '#8338EC', // 4 purple
  '#FF7A00', // 5 orange
  '#06D6A0', // 6 mint
  '#073B4C', // 7 navy
  '#2A9D8F', // 8 teal
  '#FF3D8A', // 9 pink
  '#6A4C93', // 10 violet
  '#B5E048', // 11 lime
  '#A0522D', // 12 sienna
  '#48CAE4', // 13 sky
  '#8C8C8C', // 14 gray
  '#F4A3B5', // 15 blush
];

export function pathColor(index: number): string {
  return PATH_PALETTE[index % PATH_PALETTE.length] ?? '#8C8C8C';
}

/** Canvas cannot resolve CSS custom properties, so the stack is repeated here. */
export const UI_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/** Board drawing constants from spec 10. */
export const BOARD_STYLE = {
  endpointDiameter: 0.62,
  /**
   * Endpoints are drawn as the letter O, not a filled dot (the O of pOZ-Link).
   * A fraction of the cell, like every other measurement here, so the ring
   * stays legible from a 20px Master cell up to a 72px Easy one.
   */
  endpointRingWidth: 0.15,
  strokeWidth: 0.36,
  pathAlpha: 1,
  activePathAlpha: 1,
  /**
   * The cell carries the colour and the line is the pale figure on top, so
   * these are strong rather than the wash they used to be. A finished line
   * still fills harder than one in progress, so what is done reads at a glance.
   */
  tintAlpha: 0.55,
  completedTintAlpha: 0.92,
  /** How far the line is mixed toward white, away from its cell. */
  lineLighten: 0.75,
  /**
   * The least a filled cell may differ from an empty one. Now that the cell
   * carries the colour, one that sinks into the board is a cell you cannot see
   * you have covered. Navy on the dark theme and lime on the light one are the
   * two that need help; the rest clear this untouched.
   */
  minCellContrast: 1.45,
  cornerRadius: 8,
  borderWidth: 2,
  gridWidth: 1,
  cursorWidth: 2,
  labelSize: 12,
} as const;

export interface BoardColors {
  background: string;
  cellBackground: string;
  gridLine: string;
  hairline: string;
  accent: string;
  text: string;
}

const FALLBACK_COLORS: BoardColors = {
  background: '#FFFFFF',
  cellBackground: '#F7F7F7',
  gridLine: '#E8E8E8',
  hairline: '#DCDCDC',
  accent: '#121212',
  text: '#121212',
};

export function readBoardColors(root: HTMLElement): BoardColors {
  const styles = getComputedStyle(root);
  const read = (name: string, fallback: string): string => {
    const value = styles.getPropertyValue(name).trim();
    return value.length > 0 ? value : fallback;
  };
  return {
    background: read('--bg', FALLBACK_COLORS.background),
    cellBackground: read('--cell-bg', FALLBACK_COLORS.cellBackground),
    gridLine: read('--grid-line', FALLBACK_COLORS.gridLine),
    hairline: read('--hairline', FALLBACK_COLORS.hairline),
    accent: read('--accent', FALLBACK_COLORS.accent),
    text: read('--text', FALLBACK_COLORS.text),
  };
}

/** `system` removes the override and lets `prefers-color-scheme` decide. */
export function applyThemeMode(root: HTMLElement, mode: ThemeMode): void {
  if (mode === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', mode);
}

export function applyMotionMode(root: HTMLElement, mode: MotionMode): void {
  if (mode === 'system') root.removeAttribute('data-motion');
  else root.setAttribute('data-motion', mode === 'on' ? 'reduced' : 'full');
}

export function prefersReducedMotion(mode: MotionMode): boolean {
  if (mode === 'on') return true;
  if (mode === 'off') return false;
  return (
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

// ---- Colour maths -------------------------------------------------------

export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Mix a colour toward white. Raising lightness this way also drops how vivid it
 * reads, which is what the line wants: brighter and calmer than the cell it
 * runs through.
 */
export function lighten(hex: string, amount: number): string {
  const { r, g, b } = parseHex(hex);
  const mix = (channel: number): number =>
    Math.round(channel + (255 - channel) * amount);
  return toHex(mix(r), mix(g), mix(b));
}

/** Mix a colour toward black, the counterpart to `lighten`. */
export function darken(hex: string, amount: number): string {
  const { r, g, b } = parseHex(hex);
  const mix = (channel: number): number => Math.round(channel * (1 - amount));
  return toHex(mix(r), mix(g), mix(b));
}

const cellColorCache = new Map<string, string>();

/**
 * The fill for a cell this colour occupies. Usually the palette colour itself,
 * but nudged away from the board background when the two are too close to tell
 * apart: away from white on the light theme, away from black on the dark one.
 */
export function cellColor(index: number, background: string): string {
  const key = `${index}|${background}`;
  const cached = cellColorCache.get(key);
  if (cached !== undefined) return cached;

  const base = pathColor(index);
  const groundIsLight = relativeLuminance(background) > 0.5;
  let result = base;
  for (let step = 1; step <= 14; step++) {
    if (contrastRatio(result, background) >= BOARD_STYLE.minCellContrast) break;
    const amount = step * 0.05;
    result = groundIsLight ? darken(base, amount) : lighten(base, amount);
  }
  cellColorCache.set(key, result);
  return result;
}

/**
 * The colour a path and its endpoint ring are drawn in. The cell beneath keeps
 * the full palette colour, so the line reads as the pale figure on a saturated
 * ground rather than the other way round.
 */
export function lineColor(index: number): string {
  return lighten(pathColor(index), BOARD_STYLE.lineLighten);
}

/** Whichever of white or near-black clears 4.5:1 against the given colour. */
export function labelColorOn(hex: string): string {
  const onWhite = contrastRatio(hex, '#FFFFFF');
  const onBlack = contrastRatio(hex, '#121212');
  return onWhite >= onBlack ? '#FFFFFF' : '#121212';
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  const channel = (value: number): number => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function toHex(r: number, g: number, b: number): string {
  const channel = (value: number): string =>
    Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const clean = hex.trim().replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const value = Number.parseInt(full.slice(0, 6), 16);
  if (!Number.isFinite(value)) return { r: 0, g: 0, b: 0 };
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
  };
}
