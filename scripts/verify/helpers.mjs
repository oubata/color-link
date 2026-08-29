import { sleep } from './cdp.mjs';

/**
 * Collects pass/fail lines for one suite. Pass an array in and the caller keeps
 * hold of it, so checks already collected survive a suite throwing part way.
 */
export function createChecks(results = []) {
  return {
    results,
    check(name, pass, detail = '') {
      results.push({ name, pass: Boolean(pass), detail: String(detail) });
      return Boolean(pass);
    },
  };
}

const TIER_IDS = ['easy', 'normal', 'hard', 'extreme', 'expert', 'master'];

/**
 * Mark levels 1..upTo of a tier solved. Levels open one at a time now, so a
 * suite that needs a later level has to earn its way there or seed it.
 */
export function seedSolved(page, tier, upTo) {
  return page.evaluate(`
    const KEY = 'colorlink:v1:progress';
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null') || { tiers: {} };
    for (const id of ${JSON.stringify(TIER_IDS)}) {
      if (!raw.tiers[id]) raw.tiers[id] = { solved: {} };
    }
    for (let i = 1; i <= ${upTo}; i++) {
      raw.tiers['${tier}'].solved[i] =
        { bestMs: 1000, hint: false, perfect: false, at: '2026-08-27T00:00:00.000Z' };
    }
    localStorage.setItem(KEY, JSON.stringify(raw));
    localStorage.removeItem('colorlink:v1:inProgress');
    return 1;
  `);
}

/**
 * Page-side helper, to be prepended to an evaluate() that reads the board.
 *
 * Endpoints are drawn as hollow O's, so the centre pixel of an endpoint cell is
 * the pale cell tint, not the colour. Sample the ring as well and keep the most
 * saturated hit. The ring's mid-radius is (endpointDiameter - ringWidth) / 2 of
 * a cell, which is 0.235 with the values in src/render/theme.ts.
 */
export const SAMPLE_CELL = `
  const RING_R = 0.235;
  function sampleCell(ctx, cell, r, c) {
    const cx = (c + 0.5) * cell;
    const cy = (r + 0.5) * cell;
    const ring = RING_R * cell;
    const points = [[0, 0], [ring, 0], [-ring, 0], [0, ring], [0, -ring]];
    let best = null;
    let bestSat = -1;
    for (const [dx, dy] of points) {
      const d = ctx.getImageData(Math.floor(cx + dx), Math.floor(cy + dy), 1, 1).data;
      const sat = Math.max(d[0], d[1], d[2]) - Math.min(d[0], d[1], d[2]);
      if (sat > bestSat) { bestSat = sat; best = d; }
    }
    return { data: best, saturation: bestSat };
  }
`;

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
