import { Engine } from '../../engine/engine';
import { completedCount, coveragePercent } from '../../engine/queries';
import type { Cell, Level } from '../../engine/types';
import type { TierConfig } from '../../generator/difficulty';
import { attachKeyboardInput } from '../../input/keyboard';
import { attachPointerInput } from '../../input/pointer';
import { BoardRenderer } from '../../render/BoardRenderer';
import { ANIM } from '../config';
import { el, type View } from '../dom';
import type { Feedback } from '../feedback';
import { formatTime } from '../format';
import { ICONS } from '../icons';
import { S } from '../strings';

export interface PlaySnapshot {
  paths: Cell[][];
  elapsedMs: number;
  moves: number;
  hintUsed: boolean;
  hintCount: number;
}

export interface PlayProps {
  level: Level;
  tier: TierConfig;
  restore: PlaySnapshot | null;
  colorBlindLabels: boolean;
  reducedMotion: boolean;
  feedback: Feedback;
  onBack(): void;
  onPause(): void;
  onWin(snapshot: PlaySnapshot): void;
  onPersist(snapshot: PlaySnapshot | null): void;
  onConfirmRestart(): void;
}

/**
 * The board screen: canvas, HUD and toolbar, plus the per-attempt clock. The
 * timer does not start until the first pointer-down (spec 6).
 */
export class PlayView implements View {
  readonly el: HTMLElement;
  readonly engine: Engine;

  private readonly props: PlayProps;
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: BoardRenderer;
  private readonly statLines: HTMLElement;
  private readonly statFilled: HTMLElement;
  private readonly statTime: HTMLElement;
  private readonly undoButton: HTMLButtonElement;
  private readonly hintButton: HTMLButtonElement;
  private readonly restartButton: HTMLButtonElement;

  private detach: (() => void)[] = [];
  private elapsedBase = 0;
  private runningSince: number | null = null;
  private ticker = 0;
  private winTimer = 0;
  private finished = false;

  constructor(props: PlayProps) {
    this.props = props;
    this.engine = new Engine(props.level);

    this.canvas = el('canvas', {
      class: 'board',
      attrs: {
        role: 'application',
        tabindex: '0',
        'aria-label': S.boardLabel(
          props.tier.name,
          props.level.index,
          props.level.size,
          props.level.pairs.length,
        ),
      },
    });

    this.statLines = el('span', { class: 'stat' });
    this.statFilled = el('span', { class: 'stat' });
    this.statTime = el('span', { class: 'stat' });

    this.undoButton = toolButton(ICONS.undo, S.undo, () => this.undo());
    this.hintButton = toolButton(ICONS.hint, S.hint, () => this.hint());
    this.restartButton = toolButton(ICONS.restart, S.restart, () =>
      this.askRestart(),
    );

    this.el = el('main', { class: 'screen screen--play' }, [
      el('header', { class: 'topbar' }, [
        el('button', {
          class: 'icon-button',
          html: ICONS.back,
          attrs: { type: 'button', 'aria-label': S.back },
          on: { click: () => this.leave() },
        }),
        el('h1', {
          class: 'topbar__title',
          text: S.playTitle(props.tier.name, props.level.index),
        }),
        el('button', {
          class: 'icon-button',
          html: ICONS.pause,
          attrs: { type: 'button', 'aria-label': S.pause },
          on: { click: () => this.props.onPause() },
        }),
      ]),
      el('div', { class: 'board-wrap' }, [this.canvas]),
      el(
        'p',
        {
          class: 'stats',
          attrs: { 'aria-live': 'polite', 'aria-atomic': 'true' },
        },
        [this.statLines, this.statFilled, this.statTime],
      ),
      el('div', { class: 'toolbar' }, [
        this.undoButton,
        this.hintButton,
        this.restartButton,
      ]),
    ]);

    this.renderer = new BoardRenderer(this.canvas, document.documentElement);
    this.renderer.setOptions({
      colorBlindLabels: props.colorBlindLabels,
      reducedMotion: props.reducedMotion,
    });
    this.renderer.setEngine(this.engine);

    if (props.restore) {
      this.engine.restore(props.restore.paths);
      if (props.restore.hintUsed) {
        this.engine.markHintUsed(props.restore.hintCount);
      }
      this.elapsedBase = props.restore.elapsedMs;
    }

    this.wire();
    this.update();
  }

  mounted(): void {
    this.relayout();
    this.canvas.focus();
  }

  destroy(): void {
    this.stopTimer();
    window.clearTimeout(this.winTimer);
    for (const off of this.detach) off();
    this.detach = [];
    this.renderer.destroy();
  }

  // ---- Timer ------------------------------------------------------------

  get elapsedMs(): number {
    const live =
      this.runningSince === null ? 0 : performance.now() - this.runningSince;
    return this.elapsedBase + live;
  }

  startTimer(): void {
    if (this.runningSince !== null || this.finished) return;
    this.runningSince = performance.now();
    this.ticker = window.setInterval(() => this.updateTime(), 250);
  }

  stopTimer(): void {
    if (this.runningSince !== null) {
      this.elapsedBase += performance.now() - this.runningSince;
      this.runningSince = null;
    }
    window.clearInterval(this.ticker);
    this.ticker = 0;
    this.updateTime();
  }

  /** True once the clock has been started at least once this attempt. */
  get timerStarted(): boolean {
    return this.runningSince !== null || this.elapsedBase > 0;
  }

  resumeTimer(): void {
    if (this.timerStarted) this.startTimer();
  }

  // ---- Options ----------------------------------------------------------

  setOptions(options: {
    colorBlindLabels: boolean;
    reducedMotion: boolean;
  }): void {
    this.renderer.setOptions(options);
    this.renderer.refreshColors();
  }

  relayout(): void {
    this.renderer.resize(window.innerWidth, window.innerHeight);
  }

  snapshot(): PlaySnapshot {
    return {
      paths: this.engine.snapshotPaths(),
      elapsedMs: this.elapsedMs,
      moves: this.engine.moves,
      hintUsed: this.engine.hintUsed,
      hintCount: this.engine.hintCount,
    };
  }

  restartLevel(): void {
    this.engine.restart();
    this.props.feedback.tick();
    this.persist();
    this.update();
  }

  // ---- Internals --------------------------------------------------------

  private wire(): void {
    this.detach.push(
      this.engine.on((event) => {
        if (event.type === 'pathCompleted') this.props.feedback.connect();
        if (event.type === 'pathCut') this.props.feedback.cut();
        if (event.type === 'won') this.onWon();
        this.update();
      }),
    );

    const started = (): void => {
      this.props.feedback.unlock();
      this.startTimer();
    };

    this.detach.push(
      attachPointerInput(this.canvas, this.renderer, () => this.engine, {
        onStrokeStart: started,
        onStrokeEnd: () => this.persist(),
      }),
      attachKeyboardInput(this.canvas, this.renderer, () => this.engine, {
        undo: () => this.undo(),
        restart: () => this.askRestart(),
        hint: () => this.hint(),
        togglePause: () => this.props.onPause(),
        onStrokeStart: started,
        onStrokeEnd: () => this.persist(),
      }),
    );

    const onResize = (): void => this.relayout();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    this.detach.push(() => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    });
  }

  private undo(): void {
    if (this.engine.strokeActive || !this.engine.canUndo) return;
    this.engine.undo();
    this.props.feedback.tick();
    this.persist();
    this.update();
  }

  private hint(): void {
    if (this.engine.strokeActive || this.engine.won) return;
    const color = this.firstDifferingColor();
    if (!this.engine.hint()) return;
    this.props.feedback.unlock();
    this.startTimer();
    if (color >= 0) this.renderer.revealHint(color);
    this.persist();
    this.update();
  }

  private firstDifferingColor(): number {
    for (let c = 0; c < this.props.level.pairs.length; c++) {
      const solution = this.props.level.solution[c];
      const path = this.engine.paths[c];
      if (!solution || !path) continue;
      if (path.length !== solution.length) return c;
    }
    return -1;
  }

  private askRestart(): void {
    if (this.engine.strokeActive) return;
    if (!this.engine.hasDrawnCells) {
      this.restartLevel();
      return;
    }
    this.props.onConfirmRestart();
  }

  private leave(): void {
    this.stopTimer();
    this.props.onPersist(this.engine.won ? null : this.snapshot());
    this.props.onBack();
  }

  private onWon(): void {
    if (this.finished) return;
    this.finished = true;
    this.stopTimer();
    this.props.feedback.win();
    this.renderer.playWin();
    this.props.onPersist(null);

    const snapshot = this.snapshot();
    const stagger = this.props.reducedMotion
      ? 0
      : ANIM.winStagger * this.props.level.pairs.length + ANIM.cardSlide;
    this.winTimer = window.setTimeout(
      () => this.props.onWin(snapshot),
      stagger,
    );
  }

  private persist(): void {
    if (this.engine.won) return;
    this.props.onPersist(this.snapshot());
  }

  private update(): void {
    const { level } = this.props;
    this.statLines.textContent = S.statLines(
      completedCount(level, this.engine.paths),
      level.pairs.length,
    );
    this.statFilled.textContent = S.statFilled(
      coveragePercent(level, this.engine.paths),
    );
    this.updateTime();

    const busy = this.engine.strokeActive || this.engine.won;
    setDisabled(this.undoButton, busy || !this.engine.canUndo);
    setDisabled(this.restartButton, busy);

    // Hints are capped, so the button carries what is left and goes flat when
    // there is none, the same way Undo does with an empty stack.
    const remaining = this.engine.hintsRemaining;
    setDisabled(this.hintButton, busy || remaining === 0);
    setToolLabel(
      this.hintButton,
      S.hintWithCount(remaining),
      S.hintLabel(remaining),
    );
  }

  /**
   * Replay the level's own solution, as a player would drag it.
   *
   * Only reachable through the dev-only hook in App, and only exists because
   * hints are capped at two: the verification harness used to finish a board by
   * pressing Hint until it was solved, and no longer can.
   */
  solveFromSolution(): boolean {
    if (this.engine.won) return true;
    this.engine.restart();
    for (const path of this.props.level.solution) {
      const first = path[0];
      if (!first) continue;
      this.engine.begin(first);
      for (let i = 1; i < path.length; i++) {
        const cell = path[i];
        if (cell) this.engine.extend(cell);
      }
      this.engine.end();
    }
    return this.engine.won;
  }

  private updateTime(): void {
    this.statTime.textContent = formatTime(this.elapsedMs);
  }
}

function toolButton(
  icon: string,
  label: string,
  onClick: () => void,
): HTMLButtonElement {
  const button = el(
    'button',
    {
      class: 'tool',
      attrs: { type: 'button', 'aria-label': label },
      on: { click: onClick },
    },
    [
      el('span', { class: 'tool__icon', html: icon }),
      el('span', { class: 'tool__label', text: label }),
    ],
  );
  return button;
}

/** Update a tool's visible text and the label a screen reader announces. */
function setToolLabel(
  button: HTMLButtonElement,
  text: string,
  ariaLabel: string,
): void {
  const label = button.querySelector('.tool__label');
  if (label && label.textContent !== text) label.textContent = text;
  if (button.getAttribute('aria-label') !== ariaLabel) {
    button.setAttribute('aria-label', ariaLabel);
  }
}

function setDisabled(button: HTMLButtonElement, disabled: boolean): void {
  button.disabled = disabled;
  button.classList.toggle('tool--disabled', disabled);
}
