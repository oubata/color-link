import {
  createChecks,
  freshStart,
  sleep,
  seedSolved,
  solveWithHints,
  stats,
  waitForScreen,
} from '../helpers.mjs';

/** Spec 5.5 edge cases plus criterion 10: the biggest board on the smallest phone. */
export default {
  name: 'edge cases',
  async run({ page, url, shot, results }) {
    const { check } = createChecks(results);
    await freshStart(page, url);

    // ---- Auto-pause when the tab is hidden --------------------------------
    await page.evaluate(
      `document.querySelectorAll('.tier__button')[0].click(); return 1;`,
    );
    await sleep(300);
    await page.evaluate(
      `document.querySelectorAll('.level-tile')[0].click(); return 1;`,
    );
    await sleep(400);
    await page.evaluate(`
      [...document.querySelectorAll('.tool')]
        .find(b => b.getAttribute('aria-label') === 'Hint').click();
      return 1;
    `);
    await sleep(1300);

    const running = (await stats(page))[2];
    await page.evaluate(`
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      return 1;
    `);
    await sleep(400);
    const hiddenState = await page.evaluate(`
      const panel = document.querySelector('.modal__panel');
      return panel ? panel.querySelector('.modal__title').textContent : null;
    `);
    check(
      'hiding the tab pauses the game',
      hiddenState === 'Paused',
      String(hiddenState),
    );

    await sleep(1400);
    const pausedTime = await page.evaluate(
      `return document.querySelector('.modal__time').textContent;`,
    );
    check(
      'the clock is stopped while hidden',
      pausedTime === running,
      `${running} -> ${pausedTime}`,
    );

    await page.evaluate(`
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
      return 1;
    `);
    await sleep(400);
    const stillPaused = await page.evaluate(`
      return document.querySelector('.modal__panel')?.querySelector('.modal__title')?.textContent ?? null;
    `);
    check(
      'coming back does not silently unpause',
      stillPaused === 'Paused',
      String(stillPaused),
    );
    await page.evaluate(`
      [...document.querySelectorAll('.modal__panel button')]
        .find(b => b.textContent === 'Resume').click();
      return 1;
    `);
    await sleep(300);

    // ---- The last level of a tier returns to the grid ---------------------
    // Levels open one at a time now, so reaching 100 means 1..99 are solved.
    await seedSolved(page, 'easy', 99);
    await page.reload();
    await waitForScreen(page, '.screen--home');
    await page.evaluate(
      `document.querySelectorAll('.tier__button')[0].click(); return 1;`,
    );
    await sleep(350);
    await page.evaluate(`
      const tiles = [...document.querySelectorAll('.level-tile')];
      tiles[tiles.length - 1].click();
      return 1;
    `);
    await sleep(450);
    const lastLevel = await page.evaluate(
      `return document.querySelector('.topbar__title').textContent;`,
    );
    check(
      'level 100 opens',
      lastLevel === 'Easy · Level 100',
      String(lastLevel),
    );

    await solveWithHints(page);
    const endOfTier = await page.evaluate(`
      const panel = document.querySelector('.modal__panel');
      return panel ? [...panel.querySelectorAll('button')].map(b => b.textContent) : null;
    `);
    check(
      'the last level offers Level list instead of Next level',
      endOfTier !== null &&
        !endOfTier.includes('Next level') &&
        endOfTier[0] === 'Level list',
      (endOfTier ?? []).join(','),
    );

    await page.evaluate(`
      [...document.querySelectorAll('.modal__panel button')]
        .find(b => b.textContent === 'Level list').click();
      return 1;
    `);
    await sleep(400);
    check(
      'it lands back on the level grid',
      (await page.evaluate(
        `return document.querySelector('.screen--levels') !== null;`,
      )) === true,
    );

    // ---- Every tier open, for the Master check ----------------------------
    await page.evaluate(`
      const raw = JSON.parse(localStorage.getItem('colorlink:v1:progress'));
      for (const tier of ['hard', 'extreme', 'expert']) {
        for (let i = 1; i <= 20; i++) {
          raw.tiers[tier].solved[i] =
            { bestMs: 1000, hint: false, perfect: false, at: '2026-08-27T00:00:00.000Z' };
        }
      }
      localStorage.setItem('colorlink:v1:progress', JSON.stringify(raw));
      localStorage.removeItem('colorlink:v1:inProgress');
      return 1;
    `);
    await page.reload();
    await waitForScreen(page, '.screen--home');
    const unlocked = await page.evaluate(`
      const rows = [...document.querySelectorAll('.tier')];
      return {
        locked: rows.filter(r => r.classList.contains('tier--locked')).length,
        progress: rows.map(r => r.querySelector('.tier__progress').textContent),
      };
    `);
    check(
      'solving 20 of each gate tier unlocks the rest',
      unlocked.locked === 0,
      `${unlocked.locked} still locked`,
    );
    check(
      'home shows the seeded progress',
      unlocked.progress[2] === '20/100',
      unlocked.progress.join(' '),
    );
    await shot('20-all-unlocked');

    // ---- Master 14x14 on a 360px phone (criterion 10) ---------------------
    await seedSolved(page, 'master', 99);
    await page.reload();
    await waitForScreen(page, '.screen--home');
    await page.evaluate(
      `document.querySelectorAll('.tier__button')[5].click(); return 1;`,
    );
    await sleep(350);
    await page.evaluate(`
      const tiles = [...document.querySelectorAll('.level-tile')];
      tiles[tiles.length - 1].click();
      return 1;
    `);
    await sleep(700);
    const master = await page.evaluate(`
      const canvas = document.querySelector('.board');
      const rect = canvas.getBoundingClientRect();
      const size = Number(canvas.getAttribute('aria-label').match(/(\\d+) by/)[1]);
      const tools = [...document.querySelectorAll('.tool')].map(t => {
        const r = t.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height), inView: r.bottom <= window.innerHeight };
      });
      return {
        title: document.querySelector('.topbar__title').textContent,
        size,
        cellPx: rect.width / size,
        boardWidth: Math.round(rect.width),
        docScrollWidth: document.documentElement.scrollWidth,
        docScrollHeight: document.documentElement.scrollHeight,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        backingWidth: canvas.width,
        tools,
      };
    `);
    check(
      'Master level 100 opens at 14×14',
      master.title === 'Master · Level 100' && master.size === 14,
      `${master.title} size ${master.size}`,
    );
    check(
      'cells stay at least 20px',
      master.cellPx >= 20,
      `${master.cellPx.toFixed(1)}px`,
    );
    check(
      'the board fits the width without scrolling',
      master.docScrollWidth <= master.innerWidth,
      `${master.docScrollWidth} vs ${master.innerWidth}`,
    );
    check(
      'nothing scrolls vertically either',
      master.docScrollHeight <= master.innerHeight,
      `${master.docScrollHeight} vs ${master.innerHeight}`,
    );
    check(
      'the canvas is rendered at device resolution',
      master.backingWidth === master.boardWidth * 3,
      `${master.backingWidth} backing for ${master.boardWidth} css`,
    );
    check(
      'every toolbar button keeps a 44px hit area and stays on screen',
      master.tools.length === 3 &&
        master.tools.every((t) => t.w >= 44 && t.h >= 44 && t.inView),
      JSON.stringify(master.tools),
    );
    await shot('21-master-100');

    return results;
  },
};
