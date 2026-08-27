import { describe, expect, it } from 'vitest';
import { APP_NAME, STORAGE_KEYS, STORAGE_PREFIX } from '../../src/app/config';
import { S } from '../../src/app/strings';

describe('config', () => {
  it('exposes an app name that the strings table reuses', () => {
    expect(APP_NAME).toBeTruthy();
    expect(S.appName).toBe(APP_NAME);
  });

  it('namespaces every storage key under the schema prefix', () => {
    for (const key of Object.values(STORAGE_KEYS)) {
      expect(key.startsWith(STORAGE_PREFIX)).toBe(true);
    }
  });
});
