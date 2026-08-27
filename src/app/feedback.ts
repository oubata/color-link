/**
 * Sound and haptics, behind an interface so the screens never touch the Web
 * Audio API directly. Phase 5 supplies the synthesising implementation.
 */
export interface Feedback {
  /** A pair was joined. */
  connect(): void;
  /** Another colour's line was cut. */
  cut(): void;
  /** The board is solved. */
  win(): void;
  /** Undo, restart, and other chrome taps. */
  tick(): void;
  /** Called on the first user gesture, to unlock audio. */
  unlock(): void;
}

export const silentFeedback: Feedback = {
  connect() {},
  cut() {},
  win() {},
  tick() {},
  unlock() {},
};
