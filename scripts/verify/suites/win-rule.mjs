import {
  createChecks,
  freshStart,
  seedSolved,
  sleep,
  solveWithHints,
  waitForScreen,
} from '../helpers.mjs';

/**
 * In the page: find the dots, pair them by colour, and drag each pair along a
 * breadth-first SHORTEST route rather than the intended one. That joins every
 * pair while leaving cells empty, which is exactly the state the win rule must
 * reject. Greedy routing in a fixed order can block itself, so the caller tries
 * several boards until one joins every pair.
 */
const PLAY_SHORTEST = `
  const canvas = document.querySelector('.board');
  const ctx = canvas.getContext('2d');
  const size = Number(canvas.getAttribute('aria-label').match(/(\\d+) by/)[1]);
  const cell = canvas.width / size;
  const rect = canvas.getBoundingClientRect();
  const cssCell = rect.width / size;

  const byColour = new Map();
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const d = ctx.getImageData(Math.floor((c + 0.5) * cell), Math.floor((r + 0.5) * cell), 1, 1).data;
      if (Math.max(d[0], d[1], d[2]) - Math.min(d[0], d[1], d[2]) <= 40) continue;
      const key = d[0] + ',' + d[1] + ',' + d[2];
      if (!byColour.has(key)) byColour.set(key, []);
      byColour.get(key).push([r, c]);
    }
  }
  const pairs = [...byColour.values()].filter((cells) => cells.length === 2);

  const claimed = new Array(size * size).fill(-1);
  pairs.forEach(([a, b], i) => {
    claimed[a[0] * size + a[1]] = i;
    claimed[b[0] * size + b[1]] = i;
  });

  const send = (type, [r, c]) => {
    canvas.dispatchEvent(new PointerEvent(type, {
      pointerId: 1, isPrimary: true, bubbles: true, cancelable: true,
      clientX: rect.left + (c + 0.5) * cssCell,
      clientY: rect.top + (r + 0.5) * cssCell,
    }));
  };

  pairs.forEach(([a, b], i) => {
    const from = new Map([[a[0] * size + a[1], null]]);
    const queue = [a];
    let found = false;
    while (queue.length && !found) {
      const [r, c] = queue.shift();
      for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
        const at = nr * size + nc;
        if (from.has(at)) continue;
        if (claimed[at] !== -1 && claimed[at] !== i) continue;
        from.set(at, [r, c]);
        if (nr === b[0] && nc === b[1]) { found = true; break; }
        queue.push([nr, nc]);
      }
    }
    if (!found) return;

    const path = [];
    let at = b;
    while (at) { path.unshift(at); at = from.get(at[0] * size + at[1]); }
    for (const [r, c] of path) claimed[r * size + c] = i;

    send('pointerdown', path[0]);
    for (const step of path.slice(1)) send('pointermove', step);
    send('pointerup', path[path.length - 1]);
  });

  return { size, pairCount: pairs.length };
`;

const READ_STATE = `
  const stats = [...document.querySelectorAll('.stat')].map(s => s.textContent);
  const panel = document.querySelector('.modal__panel');
  return {
    lines: stats[0],
    filled: Number((stats[1] || '').replace(/\\D/g, '')),
    card: panel ? panel.querySelector('.modal__title').textContent : null,
    buttons: panel
      ? [...panel.querySelectorAll('button')].map(b => b.textContent)
      : [],
  };
`;

/**
 * Criterion 11: joining every pair is not enough — the board must also be full.
 * Spec assumption 4, confirmed against spec 15 open question 2.
 */
export default {
  name: 'win rule',
  async run({ page, url, shot, results }) {
    const { check } = createChecks(results);
    await freshStart(page, url);

    // Levels open one at a time now, and greedy routing blocks itself on some
    // boards, so open a run of them and take the first it joins completely.
    await seedSolved(page, 'normal', 11);
    await page.reload();
    await waitForScreen(page, '.screen--home');
    await page.evaluate(
      `document.querySelectorAll('.tier__button')[1].click(); return 1;`,
    );
    await sleep(350);

    let played = null;
    let state = null;
    let usedLevel = 0;

    for (let level = 1; level <= 12; level++) {
      await page.evaluate(
        `document.querySelectorAll('.level-tile')[${level - 1}].click(); return 1;`,
      );
      await sleep(500);

      played = await page.evaluate(PLAY_SHORTEST);
      await sleep(500);
      state = await page.evaluate(READ_STATE);

      if (state.lines === `Lines ${played.pairCount}/${played.pairCount}`) {
        usedLevel = level;
        break;
      }

      // Not every pair joined on this board; back out and try the next.
      await page.evaluate(`
        const modal = document.querySelector('.modal__panel');
        if (modal) {
          [...modal.querySelectorAll('button')].find(b => b.textContent === 'Level list').click();
        } else {
          document.querySelector('.topbar .icon-button').click();
        }
        return 1;
      `);
      await sleep(400);
    }

    check(
      'found a board where shortest routes join every pair',
      usedLevel > 0,
      usedLevel > 0
        ? `Normal level ${usedLevel}`
        : 'none in the first 12 Normal levels',
    );

    if (usedLevel === 0) return results;

    check(
      'every pair joined but the board unfilled does NOT win',
      state.card === null && state.filled < 100,
      `${state.lines}, ${state.filled}% filled, card = ${state.card}`,
    );
    await shot('30-all-joined-not-won');

    // Now fill the rest. Hint replaces each short route with the solution one,
    // which is what picks up the stranded cells.
    await solveWithHints(page);
    const finished = await page.evaluate(READ_STATE);
    check(
      'filling the last cells then wins',
      (finished.card === 'Solved' || finished.card === 'Perfect') &&
        finished.filled === 100,
      `${finished.filled}% filled, card = ${finished.card}`,
    );
    check(
      'the won card offers the next level',
      finished.buttons[0] === 'Next level',
      finished.buttons.join(','),
    );
    await shot('31-won-full-coverage');

    return results;
  },
};
