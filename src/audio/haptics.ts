import { HAPTICS } from '../app/config';

/** Vibration patterns from config, where the device supports them. */
export class Haptics {
  static get available(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      typeof navigator.vibrate === 'function'
    );
  }

  connect(): void {
    this.pulse(HAPTICS.connect);
  }

  win(): void {
    this.pulse([...HAPTICS.win]);
  }

  private pulse(pattern: number | number[]): void {
    if (!Haptics.available) return;
    try {
      navigator.vibrate(pattern);
    } catch {
      // Some browsers reject vibration outside a user gesture; never fatal.
    }
  }
}
