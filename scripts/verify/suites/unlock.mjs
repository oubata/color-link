import {
  createChecks,
  sleep,
  solveWithHints,
  waitForScreen,
} from '../helpers.mjs';

/**
 * Criterion 8, precisely: seed 19 Hard solves, solve the 20th in the running
 * app, and confirm Extreme is open the next time Home is shown. No reload after
 * the seed, so this really is the live unlock path.
 */
export default {
  name: 'tier unlock without a reload',
  async run({ page, url, shot }) {
    const { results, check } = createChecks();

    await page.setViewport(360, 640, 3);
    await page.blank();
    await page.clearOriginData(new URL(url).origin);
    await page.navigate(url);
    await page.evaluate(`
      const tiers = {};
      for (const id of ['easy','normal','hard','extreme','expert','master']) tiers[id] = { solved: {} };
      for (let i = 1; i <= 19; i++) {
        tiers.hard.solved[i] =
          { bestMs: 1000, hint: false, perfect: false, at: '2026-08-27T00:00:00.000Z' };
      }
      localStorage.setItem('colorlink:v1:progress', JSON.stringify({ tiers }));
      return 1;
    `);
    await page.reload();
    if (!(await waitForScreen(page, '.screen--home'))) {
      throw new Error('the app never reached Home after seeding progress');
    }

    const before = await page.evaluate(`
      const rows = [...document.querySelectorAll('.tier')];
      return {
        hard: rows[2].querySelector('.tier__progress').textContent,
        extremeLocked: rows[3].classList.contains('tier--locked'),
        unlockText: rows[3].querySelector('.tier__unlock')?.textContent ?? null,
      };
    `);
    check(
      'Extreme is still locked at 19 Hard solves',
      before.hard === '19/100' && before.extremeLocked === true,
      `${before.hard}, locked=${before.extremeLocked}`,
    );
    check(
      'the lock explains itself',
      before.unlockText === 'Solve 20 Hard levels to unlock',
      String(before.unlockText),
    );
    await shot('40-locked-at-19');

    await page.evaluate(
      `document.querySelectorAll('.tier__button')[2].click(); return 1;`,
    );
    await sleep(400);
    await page.evaluate(
      `document.querySelectorAll('.level-tile')[19].click(); return 1;`,
    );
    await sleep(500);
    const playing = await page.evaluate(
      `return document.querySelector('.topbar__title').textContent;`,
    );
    check(
      'Hard level 20 opens',
      playing === 'Hard · Level 20',
      String(playing),
    );

    await solveWithHints(page);
    const solved = await page.evaluate(
      `return document.querySelector('.modal__title')?.textContent ?? null;`,
    );
    check('it solves', solved === 'Solved', String(solved));

    // Back to Home through the UI. No reload anywhere after the seed.
    await page.evaluate(`
      [...document.querySelectorAll('.modal__panel button')]
        .find(b => b.textContent === 'Level list').click();
      return 1;
    `);
    await sleep(400);
    await page.evaluate(
      `document.querySelector('.topbar .icon-button').click(); return 1;`,
    );
    await sleep(400);

    const after = await page.evaluate(`
      const rows = [...document.querySelectorAll('.tier')];
      const extreme = rows[3].querySelector('.tier__button');
      return {
        hard: rows[2].querySelector('.tier__progress').textContent,
        extremeLocked: rows[3].classList.contains('tier--locked'),
        extremeClickable: extreme.tagName === 'BUTTON'
          && !extreme.classList.contains('tier__button--locked'),
        expertLocked: rows[4].classList.contains('tier--locked'),
      };
    `);
    check(
      'the 20th Hard solve unlocks Extreme without a reload',
      after.hard === '20/100' &&
        after.extremeLocked === false &&
        after.extremeClickable,
      `${after.hard}, locked=${after.extremeLocked}, clickable=${after.extremeClickable}`,
    );
    check('Expert stays locked behind Extreme', after.expertLocked === true);
    await shot('41-unlocked-at-20');

    await page.evaluate(
      `document.querySelectorAll('.tier__button')[3].click(); return 1;`,
    );
    await sleep(400);
    const extreme = await page.evaluate(
      `return document.querySelector('.topbar__title')?.textContent ?? null;`,
    );
    check(
      'Extreme opens once unlocked',
      extreme === 'Extreme · 10×10',
      String(extreme),
    );

    return results;
  },
};
