import { ANIM } from '../app/config';
import type { Engine } from '../engine/engine';
import { EMPTY, type Cell, type EngineEvent } from '../engine/types';
import {
  cellCenter,
  cellOrigin,
  computeLayout,
  sizeCanvas,
  type BoardLayout,
} from './layout';
import {
  BOARD_STYLE,
  cellColor,
  labelColorOn,
  lineColor,
  readBoardColors,
  UI_FONT_STACK,
  withAlpha,
  type BoardColors,
} from './theme';

export interface RenderOptions {
  colorBlindLabels: boolean;
  reducedMotion: boolean;
}

interface CutEffect {
  color: number;
  cells: readonly Cell[];
  /** The still-attached cell the removed run grew from, or null. */
  anchor: Cell | null;
  start: number;
}

/**
 * Draws a read-only view of the engine onto a canvas (spec 10). It owns no game
 * state; every frame reads the engine afresh.
 */
export class BoardRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly root: HTMLElement;
  private engine: Engine | null = null;
  private unsubscribe: (() => void) | null = null;

  private layout: BoardLayout = { size: 1, cellPx: 1, boardPx: 1, dpr: 1 };
  private colors: BoardColors;
  private options: RenderOptions = {
    colorBlindLabels: false,
    reducedMotion: false,
  };

  private cursor: Cell | null = null;
  private cursorVisible = false;

  private pops = new Map<number, number>();
  private pulses = new Map<number, number>();
  private cuts: CutEffect[] = [];
  private winStart: number | null = null;
  private hintReveal: { color: number; start: number } | null = null;

  private frame = 0;
  private dirty = false;

  constructor(canvas: HTMLCanvasElement, root: HTMLElement) {
    this.canvas = canvas;
    this.root = root;
    this.colors = readBoardColors(root);
  }

  setEngine(engine: Engine | null): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.engine = engine;
    this.clearEffects();
    if (engine) {
      this.unsubscribe = engine.on((event) => this.onEngineEvent(event));
    }
    this.requestDraw();
  }

  setOptions(options: Partial<RenderOptions>): void {
    this.options = { ...this.options, ...options };
    this.requestDraw();
  }

  setCursor(cell: Cell | null, visible: boolean): void {
    this.cursor = cell;
    this.cursorVisible = visible;
    this.requestDraw();
  }

  /** Re-read the CSS custom properties after a theme change. */
  refreshColors(): void {
    this.colors = readBoardColors(this.root);
    this.requestDraw();
  }

  resize(viewportWidth: number, viewportHeight: number): void {
    const size = this.engine?.level.size ?? 1;
    this.layout = computeLayout(
      viewportWidth,
      viewportHeight,
      size,
      Math.min(window.devicePixelRatio || 1, 3),
    );
    this.requestDraw();
  }

  get boardPx(): number {
    return this.layout.boardPx;
  }

  get currentLayout(): BoardLayout {
    return this.layout;
  }

  /** Board-local coordinates for a pointer event. */
  toBoardSpace(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  playWin(): void {
    this.winStart = now();
    this.requestDraw();
  }

  revealHint(color: number): void {
    this.hintReveal = { color, start: now() };
    this.requestDraw();
  }

  requestDraw(): void {
    if (this.dirty) return;
    this.dirty = true;
    this.frame = requestAnimationFrame(() => {
      this.dirty = false;
      this.draw();
    });
  }

  destroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    cancelAnimationFrame(this.frame);
    this.clearEffects();
  }

  // ---- Animation bookkeeping -------------------------------------------

  private onEngineEvent(event: EngineEvent): void {
    switch (event.type) {
      case 'pathCompleted':
        this.pulses.set(event.color, now());
        break;
      case 'pathCut':
        if (event.removed.length > 0) {
          this.cuts.push({
            color: event.color,
            cells: event.removed.slice(),
            anchor: this.anchorFor(event.color),
            start: now(),
          });
        }
        break;
      case 'won':
        this.winStart = now();
        break;
      case 'change':
        break;
    }
    this.requestDraw();
  }

  private anchorFor(color: number): Cell | null {
    const path = this.engine?.paths[color];
    if (!path || path.length === 0) return null;
    return path[path.length - 1] ?? null;
  }

  popEndpoint(color: number): void {
    this.pops.set(color, now());
    this.requestDraw();
  }

  private clearEffects(): void {
    this.pops.clear();
    this.pulses.clear();
    this.cuts = [];
    this.winStart = null;
    this.hintReveal = null;
  }

  private duration(base: number): number {
    return this.options.reducedMotion ? 0 : base;
  }

  private animating(at: number): boolean {
    if (this.options.reducedMotion) return false;
    for (const start of this.pops.values()) {
      if (at - start < ANIM.endpointPop) return true;
    }
    for (const start of this.pulses.values()) {
      if (at - start < ANIM.pathPulse) return true;
    }
    if (this.cuts.length > 0) return true;
    if (this.hintReveal) return true;
    if (this.winStart !== null) {
      const colors = this.engine?.level.pairs.length ?? 0;
      if (at - this.winStart < ANIM.winStagger * colors + ANIM.pathPulse) {
        return true;
      }
    }
    return false;
  }

  // ---- Drawing ----------------------------------------------------------

  draw(): void {
    const engine = this.engine;
    const context = sizeCanvas(this.canvas, this.layout);
    if (!context || !engine) return;

    const at = now();
    this.expireEffects(at);

    const { boardPx, cellPx } = this.layout;
    context.clearRect(0, 0, boardPx, boardPx);

    context.save();
    roundedRectPath(
      context,
      0.5,
      0.5,
      boardPx - 1,
      boardPx - 1,
      BOARD_STYLE.cornerRadius,
    );
    context.clip();

    context.fillStyle = this.colors.cellBackground;
    context.fillRect(0, 0, boardPx, boardPx);

    this.drawGrid(context);
    this.drawTints(context, engine);
    this.drawCuts(context, at);
    this.drawPaths(context, engine, at);
    this.drawEndpoints(context, engine, at);
    context.restore();

    context.strokeStyle = this.colors.hairline;
    context.lineWidth = BOARD_STYLE.borderWidth;
    roundedRectPath(
      context,
      1,
      1,
      boardPx - 2,
      boardPx - 2,
      BOARD_STYLE.cornerRadius,
    );
    context.stroke();

    if (this.cursorVisible && this.cursor) {
      const { x, y } = cellOrigin(this.layout, this.cursor);
      context.strokeStyle = this.colors.accent;
      context.lineWidth = BOARD_STYLE.cursorWidth;
      context.strokeRect(x + 2, y + 2, cellPx - 4, cellPx - 4);
    }

    if (this.animating(at)) this.requestDraw();
  }

  private expireEffects(at: number): void {
    const cutFade = this.duration(ANIM.cutFade);
    this.cuts = this.cuts.filter((cut) => at - cut.start < cutFade);
    for (const [color, start] of this.pops) {
      if (at - start >= this.duration(ANIM.endpointPop))
        this.pops.delete(color);
    }
    for (const [color, start] of this.pulses) {
      if (at - start >= this.duration(ANIM.pathPulse))
        this.pulses.delete(color);
    }
    if (this.hintReveal) {
      const path = this.engine?.paths[this.hintReveal.color];
      const total = this.duration(ANIM.hintPerCell) * (path?.length ?? 0);
      if (at - this.hintReveal.start >= total) this.hintReveal = null;
    }
  }

  private drawGrid(context: CanvasRenderingContext2D): void {
    const { size, cellPx, boardPx } = this.layout;
    context.strokeStyle = this.colors.gridLine;
    context.lineWidth = BOARD_STYLE.gridWidth;
    context.beginPath();
    for (let i = 1; i < size; i++) {
      const at = Math.round(i * cellPx) + 0.5;
      context.moveTo(at, 0);
      context.lineTo(at, boardPx);
      context.moveTo(0, at);
      context.lineTo(boardPx, at);
    }
    context.stroke();
  }

  /** The fill for a cell this colour occupies, whatever state its line is in. */
  private tintFor(color: number): string {
    return withAlpha(
      cellColor(color, this.colors.cellBackground),
      BOARD_STYLE.tintAlpha,
    );
  }

  private drawTints(context: CanvasRenderingContext2D, engine: Engine): void {
    const { size, cellPx } = this.layout;
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const cell: Cell = [row, col];
        const occupant = engine.occupantAt(cell);
        if (occupant === EMPTY) continue;
        const { x, y } = cellOrigin(this.layout, cell);
        context.fillStyle = this.tintFor(occupant);
        context.fillRect(x, y, cellPx, cellPx);
      }
    }
  }

  private drawCuts(context: CanvasRenderingContext2D, at: number): void {
    const fade = this.duration(ANIM.cutFade);
    if (fade <= 0) return;
    for (const cut of this.cuts) {
      const progress = (at - cut.start) / fade;
      const alpha = Math.max(0, 1 - progress) * BOARD_STYLE.pathAlpha;
      const cells = cut.anchor ? [cut.anchor, ...cut.cells] : [...cut.cells];
      this.strokePath(context, cells, lineColor(cut.color), alpha);
    }
  }

  private drawPaths(
    context: CanvasRenderingContext2D,
    engine: Engine,
    at: number,
  ): void {
    for (let color = 0; color < engine.paths.length; color++) {
      const path = engine.paths[color];
      if (!path || path.length < 2) continue;

      let cells: readonly Cell[] = path;
      if (this.hintReveal?.color === color) {
        const per = this.duration(ANIM.hintPerCell);
        if (per > 0) {
          const shown = Math.floor((at - this.hintReveal.start) / per) + 1;
          cells = path.slice(0, Math.max(2, Math.min(path.length, shown)));
        }
      }

      this.strokePath(
        context,
        cells,
        lineColor(color),
        this.pathAlpha(color, engine, at),
      );
    }
  }

  private pathAlpha(color: number, engine: Engine, at: number): number {
    if (engine.activeColor === color) return BOARD_STYLE.activePathAlpha;
    if (this.winStart !== null) {
      const delay = this.duration(ANIM.winStagger) * color;
      const elapsed = at - this.winStart - delay;
      if (elapsed >= 0) return BOARD_STYLE.activePathAlpha;
    }
    return BOARD_STYLE.pathAlpha;
  }

  private strokePath(
    context: CanvasRenderingContext2D,
    cells: readonly Cell[],
    color: string,
    alpha: number,
  ): void {
    if (cells.length < 2 || alpha <= 0) return;
    context.save();
    context.globalAlpha = alpha;
    context.strokeStyle = color;
    context.lineWidth = BOARD_STYLE.strokeWidth * this.layout.cellPx;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.beginPath();
    cells.forEach((cell, index) => {
      const { x, y } = cellCenter(this.layout, cell);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();
    context.restore();
  }

  private drawEndpoints(
    context: CanvasRenderingContext2D,
    engine: Engine,
    at: number,
  ): void {
    const { cellPx } = this.layout;
    const baseRadius = (BOARD_STYLE.endpointDiameter * cellPx) / 2;

    for (const pair of engine.level.pairs) {
      const scale = this.endpointScale(pair.color, at);
      const radius = baseRadius * scale;
      const fill = lineColor(pair.color);

      const ringWidth = BOARD_STYLE.endpointRingWidth * cellPx * scale;
      const holeRadius = Math.max(0, radius - ringWidth);
      const labelled = this.options.colorBlindLabels;

      for (const cell of [pair.a, pair.b]) {
        const { x, y } = cellCenter(this.layout, cell);

        // The path is already drawn and runs to the cell centre, so the middle
        // of the O has to be reclaimed or the letter fills in the moment a
        // line is attached. Repainting the cell underneath keeps the hole
        // matching its neighbours, tint included.
        if (holeRadius > 0) {
          if (labelled) {
            // A numeral needs a solid field. At a 20px cell the hole is 6px
            // across, far too small to read a digit in, so colour-blind mode
            // keeps the filled dot and gives up the O.
            context.fillStyle = fill;
          } else {
            context.fillStyle = this.colors.cellBackground;
            context.beginPath();
            context.arc(x, y, holeRadius, 0, Math.PI * 2);
            context.fill();
            context.fillStyle = this.tintFor(pair.color);
          }
          context.beginPath();
          context.arc(x, y, holeRadius, 0, Math.PI * 2);
          context.fill();
        }

        context.strokeStyle = fill;
        context.lineWidth = ringWidth;
        context.beginPath();
        context.arc(x, y, radius - ringWidth / 2, 0, Math.PI * 2);
        context.stroke();

        if (labelled) {
          context.fillStyle = labelColorOn(fill);
          context.font = `bold ${BOARD_STYLE.labelSize}px ${UI_FONT_STACK}`;
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          context.fillText(String(pair.color + 1), x, y + 0.5);
        }
      }
    }
  }

  private endpointScale(color: number, at: number): number {
    const pop = this.pops.get(color);
    const popMs = this.duration(ANIM.endpointPop);
    if (pop !== undefined && popMs > 0) {
      const t = clamp01((at - pop) / popMs);
      return 1 + 0.15 * Math.sin(Math.PI * t);
    }
    const pulse = this.pulses.get(color);
    const pulseMs = this.duration(ANIM.pathPulse);
    if (pulse !== undefined && pulseMs > 0) {
      const t = clamp01((at - pulse) / pulseMs);
      return 1 + 0.2 * Math.sin(Math.PI * t);
    }
    return 1;
  }
}

function now(): number {
  return performance.now();
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function roundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}
