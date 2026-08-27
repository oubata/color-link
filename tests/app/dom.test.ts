import { describe, expect, it } from 'vitest';
import { attrValue } from '../../src/app/dom';

describe('attribute values', () => {
  it('writes aria booleans as words, so a switch can read back "false"', () => {
    expect(attrValue(true)).toBe('true');
    expect(attrValue(false)).toBe('false');
  });

  it('skips only null', () => {
    expect(attrValue(null)).toBeNull();
    expect(attrValue(0)).toBe('0');
    expect(attrValue('')).toBe('');
  });
});
