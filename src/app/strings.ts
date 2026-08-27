import { APP_NAME } from './config';

/**
 * Every user-facing string in the app. Keeping them here makes a later
 * localisation a drop-in replacement of this module.
 */
export const S = {
  appName: APP_NAME,
  tagline: 'Connect the dots. Fill the board.',

  // Home
  howToPlay: 'How to play',
  settings: 'Settings',
  tierProgress: (solved: number, total: number) => `${solved}/${total}`,
  tierSize: (size: number) => `${size}×${size}`,
  unlockHint: (count: number, tierName: string) =>
    `Solve ${count} ${tierName} levels to unlock`,

  // Level select
  back: 'Back',
  levelSelectTitle: (tierName: string, size: number) =>
    `${tierName} · ${size}×${size}`,
  levelTileLabel: (index: number) => `Level ${index}`,

  // Play
  playTitle: (tierName: string, index: number) =>
    `${tierName} · Level ${index}`,
  pause: 'Pause',
  statLines: (done: number, total: number) => `Lines ${done}/${total}`,
  statFilled: (percent: number) => `Filled ${percent}%`,
  undo: 'Undo',
  hint: 'Hint',
  restart: 'Restart',
  boardLabel: (tierName: string, index: number, size: number, pairs: number) =>
    `${tierName} level ${index}. ${size} by ${size} board with ${pairs} colour pairs.`,

  // Paused
  pausedTitle: 'Paused',
  resume: 'Resume',
  levelList: 'Level list',

  // Won
  solved: 'Solved',
  perfect: 'Perfect',
  perfectExplainer: 'No hints, every line drawn once',
  time: 'Time',
  best: 'Best',
  newBest: 'New best',
  hintUsed: 'Hint used',
  nextLevel: 'Next level',
  replay: 'Replay',

  // Settings
  theme: 'Theme',
  themeSystem: 'System',
  themeLight: 'Light',
  themeDark: 'Dark',
  sound: 'Sound',
  haptics: 'Haptics',
  colorBlindLabels: 'Colour-blind labels',
  reducedMotion: 'Reduced motion',
  on: 'On',
  off: 'Off',
  resetProgress: 'Reset progress',
  versionLine: (appVersion: string, generatorVersion: number) =>
    `Version ${appVersion} · Generator v${generatorVersion}`,
  close: 'Close',

  // Confirm dialogs
  confirmResetTitle: 'Reset progress?',
  confirmResetBody:
    'This clears every solved level, best time and saved board. It cannot be undone.',
  confirmResetConfirm: 'Reset everything',
  confirmRestartTitle: 'Restart level?',
  confirmRestartBody: 'This clears every line you have drawn on this board.',
  confirmRestartConfirm: 'Restart',
  cancel: 'Cancel',

  // How to play
  howToPlayTitle: 'How to play',
  howToPlaySteps: [
    'Drag from a coloured dot to its twin to join them with a line.',
    "Lines can't cross. Drawing over another line cuts it back.",
    'Fill every cell on the board to solve the puzzle.',
  ],
} as const;
