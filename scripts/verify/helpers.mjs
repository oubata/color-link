import { sleep } from './cdp.mjs';

/** Collects pass/fail lines for one suite. */
export function createChecks() {
  const results = [];
  return {
    results,
    check(name, pass, detail = '') {
      results.push({ name, pass: Boolean(pass), detail: String(detail) });
      return Boolean(pass);
    },
  };
}

/** The three HUD readings, as text. */
export function stats(page) {
  return page.evaluate(
    `return [...document.querySelectorAll('.stat')].map(s => s.textContent);`,
  );
}

/** Coverage percentage as a number. */
export async function filled(page) {
  const values = await stats(page);
  return Number((values[1] ?? 'Filled 0%').replace(/\D/g, ''));
}

/** What the browser would read out for the focused element. */
export function focused(page) {
  return page.evaluate(`
    const a = document.activeElement;
    return a ? (a.getAttribute('aria-label') || a.textContent || a.tagName) : null;
  `);
}

/** Press Hint until the board is solved. Returns whether the card appeared. */
export async function solveWithHints(page, limit = 20) {
  for (let i = 0; i < limit; i++) {
    const done = await page.evaluate(
      `return document.querySelector('.modal') !== null;`,
    );
    if (done) return true;
    await page.evaluate(`
      const hint = [...document.querySelectorAll('.tool')]
        .find(b => b.getAttribute('aria-label') === 'Hint');
      if (hint && !hint.disabled) hint.click();
      return 1;
    `);
    await sleep(180);
  }
  await sleep(800);
  return page.evaluate(`return document.querySelector('.modal') !== null;`);
}

/** Back out of whatever is open until Home is showing. */
export async function goHome(page) {
  for (let i = 0; i < 6; i++) {
    const atHome = await page.evaluate(`
      return document.querySelector('.screen--home') !== null
        && document.querySelector('.modal') === null;
    `);
    if (atHome) return true;
    await page.evaluate(`
      const modal = document.querySelector('.modal__panel');
      if (modal) {
        const out = [...modal.querySelectorAll('button')]
          .find(b => ['Level list', 'Close', 'Cancel', 'Resume'].includes(b.textContent));
        if (out) { out.click(); return 1; }
      }
      const back = document.querySelector('.topbar .icon-button');
      if (back) back.click();
      return 1;
    `);
    await sleep(350);
  }
  return false;
}

/**
 * Poll until the page satisfies `expression` (a function body returning a
 * boolean). Fixed sleeps are fine for animations; screen changes need this.
 */
export async function waitFor(page, expression, { timeout = 8000 } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      if (await page.evaluate(expression)) return true;
    } catch {
      // Mid-navigation; try again.
    }
    await sleep(100);
  }
  return false;
}

export function waitForScreen(page, selector) {
  return waitFor(
    page,
    `return document.querySelector('${selector}') !== null;`,
  );
}

/** Start every suite from a clean slate, whatever the last one left behind. */
export async function freshStart(page, url) {
  await page.setViewport(360, 640, 3);
  await page.blank();
  await page.clearOriginData(new URL(url).origin);
  await page.navigate(url);
  const home = await waitForScreen(page, '.screen--home');
  if (!home)
    throw new Error(`the app never reached Home: ${await describe(page)}`);
  return true;
}

/** What is actually on screen, for when a wait times out. */
export function describe(page) {
  return page
    .evaluate(
      `
      return JSON.stringify({
        url: location.href,
        readyState: document.readyState,
        app: document.querySelector('#app')?.innerHTML.slice(0, 120) ?? null,
        screen: document.querySelector('#app > .screen')?.className ?? null,
        modal: document.querySelector('.modal__title')?.textContent ?? null,
        keys: Object.keys(localStorage),
      });
    `,
    )
    .catch((error) => `could not inspect the page: ${error.message}`);
}

export function consoleNoise(page) {
  return page.logs.filter(
    (line) => line.level === 'error' || line.level === 'warning',
  );
}

export { sleep };
