/** Vibration patterns from spec 9, where the device supports them. */
export class Haptics {
  static get available(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      typeof navigator.vibrate === 'function'
    );
  }

  connect(): void {
    this.pulse(10);
  }

  win(): void {
    this.pulse([10, 40, 20]);
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
