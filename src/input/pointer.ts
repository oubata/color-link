import type { Engine } from '../engine/engine';
import { EMPTY, type Cell } from '../engine/types';
import type { BoardRenderer } from '../render/BoardRenderer';
import { cellAt } from '../render/layout';

export interface PointerHooks {
  /** Fired when a stroke actually starts, with the colour that was grabbed. */
  onStrokeStart?: (color: number, cell: Cell) => void;
  onStrokeEnd?: () => void;
}

/**
 * Maps Pointer Events on the board canvas to engine operations (spec 8).
 * Only the first active pointer is tracked; the rest are ignored until it ends.
 */
export function attachPointerInput(
  canvas: HTMLCanvasElement,
  renderer: BoardRenderer,
  getEngine: () => Engine | null,
  hooks: PointerHooks = {},
): () => void {
  let activePointer: number | null = null;

  const resolve = (event: PointerEvent): Cell | null => {
    const { x, y } = renderer.toBoardSpace(event.clientX, event.clientY);
    return cellAt(renderer.currentLayout, x, y);
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (activePointer !== null) return;
    const engine = getEngine();
    if (!engine || engine.won) return;

    const cell = resolve(event);
    if (!cell) return;

    if (engine.begin(cell)) {
      activePointer = event.pointerId;
      capture(canvas, event.pointerId);
      event.preventDefault();
      const color = engine.activeColor;
      if (color !== EMPTY) {
        renderer.popEndpoint(color);
        hooks.onStrokeStart?.(color, cell);
      }
    }
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== activePointer) return;
    const engine = getEngine();
    if (!engine) return;
    const cell = resolve(event);
    // Off the board is simply "no cell": the stroke waits for the pointer back.
    if (cell) engine.extend(cell);
    event.preventDefault();
  };

  const finish = (event: PointerEvent): void => {
    if (event.pointerId !== activePointer) return;
    activePointer = null;
    release(canvas, event.pointerId);
    getEngine()?.end();
    hooks.onStrokeEnd?.();
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', finish);
  canvas.addEventListener('lostpointercapture', finish);

  return () => {
    activePointer = null;
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', finish);
    canvas.removeEventListener('pointercancel', finish);
    canvas.removeEventListener('lostpointercapture', finish);
  };
}

/** Capture keeps the stroke alive off the edge of the canvas, but a pointer
 * that is already gone makes the call throw, and that must not kill the drag. */
function capture(canvas: HTMLCanvasElement, pointerId: number): void {
  try {
    canvas.setPointerCapture(pointerId);
  } catch {
    // No capture available; pointermove on the canvas still drives the stroke.
  }
}

function release(canvas: HTMLCanvasElement, pointerId: number): void {
  try {
    if (canvas.hasPointerCapture(pointerId)) {
      canvas.releasePointerCapture(pointerId);
    }
  } catch {
    // Already released.
  }
}
