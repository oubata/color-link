/** Display name of the app. Rename here and nowhere else. */
export const APP_NAME = 'Color Link';

/** Human-facing version string, shown in Settings. */
export const APP_VERSION = '1.0.0';

/** localStorage key prefix; the `v1` segment is the storage schema version. */
export const STORAGE_PREFIX = 'colorlink:v1:';

export const STORAGE_KEYS = {
  progress: `${STORAGE_PREFIX}progress`,
  settings: `${STORAGE_PREFIX}settings`,
  inProgress: `${STORAGE_PREFIX}inProgress`,
} as const;

/** Board layout (spec 9). */
export const BOARD_LAYOUT = {
  /**
   * Chrome the board cannot use. On a phone every board size is width-limited,
   * so these two numbers are what decide how big the board gets. They must stay
   * in step with the padding on `.screen--play` and the height of the top bar,
   * stats row and toolbar; `tests/render/layout.test.ts` pins the arithmetic.
   */
  viewportPaddingX: 16,
  viewportPaddingY: 196,
  /**
   * Landscape turns the column into a row: the controls move beside the board
   * instead of under it, so the board is limited by height, not width.
   * Without this the 20px floor forced a board taller than the screen and the
   * page scrolled, which spec 9 forbids.
   */
  landscapePaddingX: 184,
  landscapePaddingY: 64,
  minCellPx: 20,
  maxCellPx: 72,
} as const;

/** Animation durations in ms (spec 9 feedback table). Zeroed when reduced motion is on. */
export const ANIM = {
  endpointPop: 120,
  segmentGrow: 60,
  pathPulse: 200,
  cutFade: 120,
  winStagger: 40,
  cardSlide: 200,
  hintPerCell: 30,
} as const;

/** Web Audio master gain (spec 10). */
export const AUDIO_MASTER_GAIN = 0.25;

/** Number of level tiles per row in the level grid (spec 9). */
export const LEVEL_GRID_COLUMNS = 5;
