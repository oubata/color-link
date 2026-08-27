import './styles/base.css';
import './styles/screens.css';
import { Engine } from './engine/engine';
import { coveragePercent, completedCount } from './engine/queries';
import { TIERS } from './generator/difficulty';
import { generate } from './generator/generate';
import { attachKeyboardInput } from './input/keyboard';
import { attachPointerInput } from './input/pointer';
import { BoardRenderer } from './render/BoardRenderer';

// Phase 3 dev harness. Replaced by the App bootstrap in phase 4.
const appRoot = document.querySelector<HTMLDivElement>('#app');
if (!appRoot) throw new Error('#app not found');
const root: HTMLDivElement = appRoot;

const tier = TIERS[2];
if (!tier) throw new Error('missing tier');
const level = generate(tier, 1);
const engine = new Engine(level);

root.innerHTML = `
  <div class="harness">
    <h1>${tier.name} · Level ${level.index}</h1>
    <div class="board-wrap"><canvas id="board" tabindex="0"></canvas></div>
    <p id="stats"></p>
    <p class="harness-hint">Arrows move · Enter grabs and drops · U undo · R restart · H hint</p>
  </div>
`;

const canvasEl = root.querySelector<HTMLCanvasElement>('#board');
const statsEl = root.querySelector<HTMLParagraphElement>('#stats');
if (!canvasEl || !statsEl) throw new Error('harness markup missing');
const canvas: HTMLCanvasElement = canvasEl;
const stats: HTMLParagraphElement = statsEl;

const renderer = new BoardRenderer(canvas, document.documentElement);
renderer.setEngine(engine);

const relayout = (): void => {
  renderer.resize(window.innerWidth, window.innerHeight);
};
relayout();
window.addEventListener('resize', relayout);

const update = (): void => {
  stats.textContent =
    `Lines ${completedCount(level, engine.paths)}/${level.pairs.length} · ` +
    `Filled ${coveragePercent(level, engine.paths)}%`;
};
update();

engine.on((event) => {
  update();
  if (event.type === 'won') console.log('WON');
});

attachPointerInput(canvas, renderer, () => engine);
attachKeyboardInput(canvas, renderer, () => engine, {
  undo: () => engine.undo(),
  restart: () => engine.restart(),
  hint: () => {
    if (engine.hint()) renderer.revealHint(0);
  },
  togglePause: () => console.log('pause'),
});
canvas.focus();

// Self-driving smoke check for headless verification: ?smoke=1
if (new URLSearchParams(location.search).has('smoke')) {
  void runSmoke();
}

async function runSmoke(): Promise<void> {
  const results: string[] = [];
  const check = (name: string, pass: boolean): void => {
    results.push(`${pass ? 'PASS' : 'FAIL'} ${name}`);
  };

  const at = (cell: readonly [number, number]) => {
    const rect = canvas.getBoundingClientRect();
    const cellPx = renderer.currentLayout.cellPx;
    return {
      clientX: rect.left + (cell[1] + 0.5) * cellPx,
      clientY: rect.top + (cell[0] + 0.5) * cellPx,
    };
  };
  const send = (type: string, cell: readonly [number, number]): void => {
    canvas.dispatchEvent(
      new PointerEvent(type, {
        pointerId: 1,
        isPrimary: true,
        bubbles: true,
        cancelable: true,
        ...at(cell),
      }),
    );
  };
  const drag = (path: readonly (readonly [number, number])[]): void => {
    const first = path[0];
    if (!first) return;
    send('pointerdown', first);
    for (let i = 1; i < path.length; i++) {
      const cell = path[i];
      if (cell) send('pointermove', cell);
    }
    send('pointerup', path[path.length - 1] ?? first);
  };

  // Let the first frame size the canvas, so the drag uses real geometry.
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const sized = canvas.getBoundingClientRect();
  check(
    'canvas is laid out at the computed size',
    Math.round(sized.width) === renderer.currentLayout.boardPx,
  );

  const zero = level.solution[0] ?? [];
  drag(zero);
  check('drag joins a pair', engine.isComplete(0));
  check('cells are tinted', coveragePercent(level, engine.paths) > 0);

  // Draw colour 1 across colour 0 and confirm the cut.
  const crossed = zero[Math.floor(zero.length / 2)];
  const one = level.solution[1] ?? [];
  const beforeLength = engine.paths[0]?.length ?? 0;
  const detour = one[0];
  if (detour && crossed) {
    send('pointerdown', detour);
    for (const cell of one.slice(1)) send('pointermove', cell);
    send('pointerup', one[one.length - 1] ?? detour);
    check('second pair joins', engine.isComplete(1));
  }
  check(
    'first path survived an independent drag',
    (engine.paths[0]?.length ?? 0) === beforeLength,
  );

  // Backtracking shortens the active path.
  if (zero.length >= 3) {
    const a = zero[0];
    const b = zero[1];
    const c = zero[2];
    if (a && b && c) {
      send('pointerdown', a);
      send('pointermove', b);
      send('pointermove', c);
      const grown = engine.paths[0]?.length ?? 0;
      send('pointermove', b);
      check(
        'backtrack shortens the path',
        (engine.paths[0]?.length ?? 0) === grown - 1,
      );
      send('pointerup', b);
    }
  }

  // Keyboard: walk the cursor to an endpoint, grab it, and trace the path.
  engine.restart();
  const key = (name: string): void => {
    canvas.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: name,
        bubbles: true,
        cancelable: true,
      }),
    );
  };
  const stepTo = (
    from: readonly [number, number],
    to: readonly [number, number],
  ): void => {
    for (let i = 0; i < to[0] - from[0]; i++) key('ArrowDown');
    for (let i = 0; i < from[0] - to[0]; i++) key('ArrowUp');
    for (let i = 0; i < to[1] - from[1]; i++) key('ArrowRight');
    for (let i = 0; i < from[1] - to[1]; i++) key('ArrowLeft');
  };
  const kbPath = level.solution[0] ?? [];
  const kbStart = kbPath[0];
  if (kbStart) {
    stepTo([0, 0], kbStart);
    key('Enter');
    check('keyboard grabs an endpoint', engine.strokeActive);
    let at = kbStart;
    for (const cell of kbPath.slice(1)) {
      stepTo(at, cell);
      at = cell;
    }
    check('keyboard traces a full path', engine.isComplete(0));
    key('Enter');
    check('keyboard drops the stroke', !engine.strokeActive);
  }

  // Hint plus solve completes the board.
  engine.restart();
  for (let i = 0; i < level.pairs.length + 2; i++) engine.hint();
  check('hints solve the board', engine.won);
  check('coverage reaches 100%', coveragePercent(level, engine.paths) === 100);

  const rect = canvas.getBoundingClientRect();
  results.push(
    `innerWidth=${window.innerWidth} innerHeight=${window.innerHeight} dpr=${window.devicePixelRatio}`,
    `cellPx=${renderer.currentLayout.cellPx} boardPx=${renderer.currentLayout.boardPx}`,
    `rect=${rect.left.toFixed(0)},${rect.top.toFixed(0)} ${rect.width.toFixed(0)}x${rect.height.toFixed(0)}`,
    `docScrollWidth=${document.documentElement.scrollWidth}`,
  );

  await new Promise((resolve) => requestAnimationFrame(resolve));
  const out = document.createElement('pre');
  out.id = 'smoke';
  out.textContent = results.join('\n');
  out.style.cssText = 'font:11px monospace;padding:8px;white-space:pre';
  root.prepend(out);
  console.log(results.join('\n'));
}
