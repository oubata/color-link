import { beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '../../src/app/config';
import {
  Persistence,
  defaultProgress,
  defaultSettings,
  parseInProgress,
  parseProgress,
  parseSettings,
  type StorageLike,
} from '../../src/storage/persistence';

class MemoryStorage implements StorageLike {
  readonly map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

describe('persistence (spec 11.2)', () => {
  let storage: MemoryStorage;
  let store: Persistence;

  beforeEach(() => {
    storage = new MemoryStorage();
    store = new Persistence(storage);
  });

  it('returns defaults when nothing is stored', () => {
    expect(store.loadProgress()).toEqual(defaultProgress());
    expect(store.loadSettings()).toEqual(defaultSettings());
    expect(store.loadInProgress()).toBeNull();
  });

  it('round-trips progress', () => {
    const progress = defaultProgress();
    progress.tiers.hard.solved[42] = {
      bestMs: 84000,
      hint: false,
      perfect: true,
      at: '2026-08-27T10:00:00.000Z',
    };
    store.saveProgress(progress);
    expect(store.loadProgress()).toEqual(progress);
  });

  it('round-trips settings', () => {
    const settings = {
      theme: 'dark',
      sound: false,
      haptics: false,
      colorBlind: true,
      reducedMotion: 'on',
    } as const;
    store.saveSettings(settings);
    expect(store.loadSettings()).toEqual(settings);
  });

  it('round-trips an in-progress board', () => {
    const value = {
      levelId: 'hard-003',
      paths: [
        [
          [0, 0],
          [0, 1],
        ],
        [],
      ] as [number, number][][],
      elapsedMs: 12345,
      moves: 3,
      hintUsed: true,
    };
    store.saveInProgress(value);
    expect(store.loadInProgress()).toEqual(value);
  });

  it('clears the in-progress key on null', () => {
    store.saveInProgress({
      levelId: 'easy-001',
      paths: [],
      elapsedMs: 0,
      moves: 0,
      hintUsed: false,
    });
    store.saveInProgress(null);
    expect(store.loadInProgress()).toBeNull();
    expect(storage.getItem(STORAGE_KEYS.inProgress)).toBeNull();
  });

  it('falls back to defaults on corrupt JSON', () => {
    storage.setItem(STORAGE_KEYS.progress, '{not json');
    storage.setItem(STORAGE_KEYS.settings, 'nope');
    storage.setItem(STORAGE_KEYS.inProgress, '[[[');
    expect(store.loadProgress()).toEqual(defaultProgress());
    expect(store.loadSettings()).toEqual(defaultSettings());
    expect(store.loadInProgress()).toBeNull();
  });

  it('falls back to defaults on the wrong shape', () => {
    expect(parseProgress({ tiers: 'nope' })).toBeNull();
    expect(parseProgress(42)).toBeNull();
    expect(parseSettings([])).toBeNull();
    expect(parseInProgress({ levelId: 'x' })).toBeNull();
    expect(
      parseInProgress({ levelId: '', paths: [], elapsedMs: 0 }),
    ).toBeNull();
  });

  it('drops individual records that are malformed but keeps the rest', () => {
    const parsed = parseProgress({
      tiers: {
        easy: {
          solved: {
            1: { bestMs: 1000, hint: false, perfect: true, at: 'x' },
            2: { bestMs: 'slow' },
            zzz: { bestMs: 10 },
          },
        },
      },
    });
    expect(parsed).not.toBeNull();
    expect(Object.keys(parsed?.tiers.easy.solved ?? {})).toEqual(['1']);
    expect(parsed?.tiers.master.solved).toEqual({});
  });

  it('rejects paths that are not pairs of integers', () => {
    expect(
      parseInProgress({
        levelId: 'easy-001',
        paths: [[[0, 'x']]],
        elapsedMs: 0,
      }),
    ).toBeNull();
    expect(
      parseInProgress({ levelId: 'easy-001', paths: [[[0]]], elapsedMs: 0 }),
    ).toBeNull();
  });

  it('keeps unknown settings values from leaking in', () => {
    const parsed = parseSettings({ theme: 'neon', reducedMotion: 7, sound: 1 });
    expect(parsed?.theme).toBe('system');
    expect(parsed?.reducedMotion).toBe('system');
    expect(parsed?.sound).toBe(true);
  });

  it('resetAll clears all three keys', () => {
    store.saveProgress(defaultProgress());
    store.saveSettings(defaultSettings());
    store.saveInProgress({
      levelId: 'easy-001',
      paths: [],
      elapsedMs: 1,
      moves: 0,
      hintUsed: false,
    });
    store.resetAll();
    expect(storage.map.size).toBe(0);
  });

  it('never throws when there is no storage at all', () => {
    const none = new Persistence(null);
    expect(() => none.saveProgress(defaultProgress())).not.toThrow();
    expect(none.loadProgress()).toEqual(defaultProgress());
    expect(none.loadInProgress()).toBeNull();
  });
});
