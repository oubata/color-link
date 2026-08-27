/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import {
  attrValue,
  clear,
  el,
  focusableWithin,
  trapFocus,
} from '../../src/app/dom';

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

describe('element builder', () => {
  it('puts aria booleans on the element in both directions', () => {
    const on = el('button', { attrs: { 'aria-checked': true } });
    const off = el('button', { attrs: { 'aria-checked': false } });
    expect(on.getAttribute('aria-checked')).toBe('true');
    expect(off.getAttribute('aria-checked')).toBe('false');
  });

  it('sets class, text and html', () => {
    expect(el('div', { class: 'a b' }).className).toBe('a b');
    expect(el('p', { text: 'hi' }).textContent).toBe('hi');
    expect(el('p', { html: '<b>hi</b>' }).querySelector('b')).not.toBeNull();
  });

  it('skips null and undefined children', () => {
    const node = el('div', {}, [el('span'), null, undefined, 'text']);
    expect(node.childNodes).toHaveLength(2);
  });

  it('attaches listeners', () => {
    let clicks = 0;
    const node = el('button', { on: { click: () => clicks++ } });
    node.click();
    expect(clicks).toBe(1);
  });

  it('clears every child', () => {
    const node = el('div', {}, [el('span'), el('span')]);
    clear(node);
    expect(node.childNodes).toHaveLength(0);
  });
});

describe('focus handling', () => {
  function dialog(): HTMLElement {
    return el('div', {}, [
      el('button', { text: 'first' }),
      el('button', { text: 'middle' }),
      el('button', { text: 'disabled', attrs: { disabled: 'true' } }),
      el('button', { text: 'last' }),
    ]);
  }

  it('lists the focusable children and skips disabled ones', () => {
    const node = dialog();
    document.body.append(node);
    expect(focusableWithin(node).map((n) => n.textContent)).toEqual([
      'first',
      'middle',
      'last',
    ]);
    node.remove();
  });

  it('skips hidden children', () => {
    const node = el('div', {}, [
      el('button', { text: 'shown' }),
      el('button', { text: 'gone', attrs: { hidden: 'true' } }),
      el('button', { text: 'masked', attrs: { 'aria-hidden': 'true' } }),
    ]);
    document.body.append(node);
    expect(focusableWithin(node).map((n) => n.textContent)).toEqual(['shown']);
    node.remove();
  });

  it('wraps Tab from the last child back to the first', () => {
    const node = dialog();
    document.body.append(node);
    const buttons = focusableWithin(node);
    const last = buttons[buttons.length - 1];
    const first = buttons[0];
    if (!last || !first) throw new Error('no buttons');

    last.focus();
    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      cancelable: true,
    });
    trapFocus(node, event);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
    node.remove();
  });

  it('wraps Shift+Tab from the first child to the last', () => {
    const node = dialog();
    document.body.append(node);
    const buttons = focusableWithin(node);
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (!first || !last) throw new Error('no buttons');

    first.focus();
    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      cancelable: true,
    });
    trapFocus(node, event);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
    node.remove();
  });

  it('leaves Tab alone in the middle of the dialog', () => {
    const node = dialog();
    document.body.append(node);
    const middle = focusableWithin(node)[1];
    if (!middle) throw new Error('no button');
    middle.focus();
    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      cancelable: true,
    });
    trapFocus(node, event);
    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(middle);
    node.remove();
  });

  it('ignores keys that are not Tab', () => {
    const node = dialog();
    document.body.append(node);
    const event = new KeyboardEvent('keydown', { key: 'a', cancelable: true });
    trapFocus(node, event);
    expect(event.defaultPrevented).toBe(false);
    node.remove();
  });
});
