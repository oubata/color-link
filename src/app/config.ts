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
  viewportPaddingX: 32,
  viewportPaddingY: 220,
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
