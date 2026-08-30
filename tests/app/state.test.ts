import { describe, expect, it } from 'vitest';
import { AppStateMachine, type WonResult } from '../../src/app/state';
import { formatTime } from '../../src/app/format';

const RESULT: WonResult = {
  elapsedMs: 84_000,
  bestMs: 62_000,
  newBest: false,
  hintUsed: false,
  hintCount: 0,
  perfect: true,
};

describe('screen machine (spec 6)', () => {
  it('starts at boot and walks Home to a board', () => {
    const machine = new AppStateMachine();
    expect(machine.screen.name).toBe('boot');
    machine.toHome();
    machine.toLevelSelect('hard');
    expect(machine.screen).toEqual({ name: 'levelSelect', tier: 'hard' });
    machine.toPlaying('hard', 42);
    expect(machine.screen).toEqual({
      name: 'playing',
      tier: 'hard',
      index: 42,
    });
  });

  it('notifies subscribers with the previous state', () => {
    const machine = new AppStateMachine();
    const seen: string[] = [];
    machine.subscribe((next, previous) =>
      seen.push(`${previous.screen.name}->${next.screen.name}`),
    );
    machine.toHome();
    machine.toLevelSelect('easy');
    expect(seen).toEqual(['boot->home', 'home->levelSelect']);
  });

  it('ignores a repeat transition to the same state', () => {
    const machine = new AppStateMachine();
    let calls = 0;
    machine.subscribe(() => calls++);
    machine.toHome();
    machine.toHome();
    expect(calls).toBe(1);
  });

  it('only reaches Won from a live board', () => {
    const machine = new AppStateMachine();
    machine.toHome();
    machine.toWon(RESULT);
    expect(machine.screen.name).toBe('home');

    machine.toPlaying('easy', 1);
    machine.toWon(RESULT);
    expect(machine.screen).toEqual({
      name: 'won',
      tier: 'easy',
      index: 1,
      result: RESULT,
    });
  });

  it('only pauses over a board', () => {
    const machine = new AppStateMachine();
    machine.toHome();
    machine.pause();
    expect(machine.isPaused).toBe(false);

    machine.toPlaying('normal', 5);
    machine.pause();
    expect(machine.isPaused).toBe(true);
    machine.resume();
    expect(machine.modal).toBeNull();
  });

  it('keeps the screen when a modal opens and closes', () => {
    const machine = new AppStateMachine();
    machine.toPlaying('hard', 7);
    machine.openModal('settings');
    expect(machine.screen).toEqual({ name: 'playing', tier: 'hard', index: 7 });
    expect(machine.modal).toBe('settings');
    machine.closeModal();
    expect(machine.modal).toBeNull();
  });

  it('drops any modal when the screen changes', () => {
    const machine = new AppStateMachine();
    machine.toPlaying('hard', 7);
    machine.openModal('paused');
    machine.toLevelSelect('hard');
    expect(machine.modal).toBeNull();
  });
});

describe('time formatting', () => {
  it('renders minutes and seconds', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(1000)).toBe('0:01');
    expect(formatTime(84_000)).toBe('1:24');
    expect(formatTime(62_000)).toBe('1:02');
    expect(formatTime(599_000)).toBe('9:59');
  });

  it('adds hours only when needed', () => {
    expect(formatTime(3_600_000)).toBe('1:00:00');
    expect(formatTime(3_723_000)).toBe('1:02:03');
  });

  it('never shows a negative clock', () => {
    expect(formatTime(-5000)).toBe('0:00');
  });
});
