import {
  createChecks,
  freshStart,
  sleep,
  solveWithHints,
} from '../helpers.mjs';

/**
 * In the page: find the dots, pair them by colour, and drag each pair along a
 * breadth-first SHORTEST route rather than the intended one. On a level with any
 * slack that joins every pair while stranding cells, which is the state
 * criterion 11 is about.
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

/** Criterion 11: joining every pair is not enough — the board must also be full. */
export default {
  name: 'win rule',
  async run({ page, url, shot }) {
    const { results, check } = createChecks();
    await freshStart(page, url);

    await page.evaluate(
      `document.querySelectorAll('.tier__button')[1].click(); return 1;`,
    );
    await sleep(350);

    let demonstrated = false;

    for (let level = 1; level <= 12 && !demonstrated; level++) {
      await page.evaluate(
        `document.querySelectorAll('.level-tile')[${level - 1}].click(); return 1;`,
      );
      await sleep(500);

      const played = await page.evaluate(PLAY_SHORTEST);
      await sleep(400);

      const state = await page.evaluate(`
        const stats = [...document.querySelectorAll('.stat')].map(s => s.textContent);
        return {
          lines: stats[0],
          filled: Number((stats[1] || '').replace(/\\D/g, '')),
          won: document.querySelector('.modal') !== null,
        };
      `);

      const allJoined =
        state.lines === 'Lines ' + played.pairCount + '/' + played.pairCount;

      if (allJoined && state.filled < 100) {
        demonstrated = true;
        check(
          'every pair joined but the board unfilled does NOT win',
          state.won === false,
          `${state.lines}, ${state.filled}% filled, card shown = ${state.won}`,
        );
        await shot('30-all-joined-not-won');

        await solveWithHints(page);
        const finished = await page.evaluate(`
          const stats = [...document.querySelectorAll('.stat')].map(s => s.textContent);
          return {
            filled: Number((stats[1] || '').replace(/\\D/g, '')),
            won: document.querySelector('.modal__title')?.textContent ?? null,
          };
        `);
        check(
          'filling the last cells then wins',
          finished.won === 'Solved' && finished.filled === 100,
          `${finished.filled}% filled, card = ${finished.won}`,
        );
        break;
      }

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

    if (!demonstrated) {
      check(
        'found a level where every pair joins without filling the board',
        false,
        'no slack found in the first 12 Normal levels',
      );
    }

    return results;
  },
};
