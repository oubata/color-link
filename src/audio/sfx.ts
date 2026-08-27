import { AUDIO_MASTER_GAIN } from '../app/config';

type Wave = OscillatorType;

interface Note {
  hz: number;
  ms: number;
  wave: Wave;
}

const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;

/**
 * The four sounds of spec 9, synthesised with Web Audio. No audio files, so no
 * network request and no decode cost.
 *
 * The AudioContext is created on the first sound, which by construction only
 * happens after a user gesture.
 */
export class Sfx {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private failed = false;

  /** Called on the first gesture so the context is warm before the first note. */
  unlock(): void {
    const context = this.ensure();
    if (context && context.state === 'suspended') void context.resume();
  }

  /** Two-note rising blip: a pair just joined. */
  connect(): void {
    this.play([
      { hz: C5, ms: 80, wave: 'sine' },
      { hz: E5, ms: 80, wave: 'sine' },
    ]);
  }

  /** Soft low tick: another colour's line was cut. */
  cut(): void {
    this.play([{ hz: 120, ms: 40, wave: 'triangle' }]);
  }

  /** Four-note arpeggio: the board is solved. */
  win(): void {
    this.play([
      { hz: C5, ms: 90, wave: 'sine' },
      { hz: E5, ms: 90, wave: 'sine' },
      { hz: G5, ms: 90, wave: 'sine' },
      { hz: C6, ms: 90, wave: 'sine' },
    ]);
  }

  /** Chrome tap: undo, restart. */
  tick(): void {
    this.play([{ hz: 1000, ms: 20, wave: 'sine' }]);
  }

  close(): void {
    void this.context?.close();
    this.context = null;
    this.master = null;
  }

  private ensure(): AudioContext | null {
    if (this.context) return this.context;
    if (this.failed) return null;
    try {
      const context = new AudioContext();
      const master = context.createGain();
      master.gain.value = AUDIO_MASTER_GAIN;
      master.connect(context.destination);
      this.context = context;
      this.master = master;
      return context;
    } catch {
      this.failed = true;
      return null;
    }
  }

  private play(notes: Note[]): void {
    const context = this.ensure();
    const master = this.master;
    if (!context || !master) return;
    if (context.state === 'suspended') void context.resume();

    let at = context.currentTime;
    for (const note of notes) {
      const seconds = note.ms / 1000;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = note.wave;
      oscillator.frequency.value = note.hz;

      // Short ramps at both ends; a bare start/stop clicks.
      const attack = Math.min(0.008, seconds / 4);
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(1, at + attack);
      gain.gain.setValueAtTime(1, at + seconds - attack);
      gain.gain.linearRampToValueAtTime(0, at + seconds);

      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(at);
      oscillator.stop(at + seconds);
      at += seconds;
    }
  }
}
