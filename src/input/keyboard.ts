import type { Engine } from '../engine/engine';
import { EMPTY, type Cell } from '../engine/types';
import type { BoardRenderer } from '../render/BoardRenderer';

export interface KeyboardActions {
  undo(): void;
  restart(): void;
  hint(): void;
  togglePause(): void;
  onStrokeStart?(color: number, cell: Cell): void;
  onStrokeEnd?(): void;
}

/**
 * Keyboard play (spec 8). The cursor only appears once a key has been used, so
 * touch and mouse players never see it.
 */
export function attachKeyboardInput(
  target: HTMLElement,
  renderer: BoardRenderer,
  getEngine: () => Engine | null,
  actions: KeyboardActions,
): () => void {
  let cursor: Cell = [0, 0];
  let visible = false;

  const show = (): void => {
    visible = true;
    renderer.setCursor(cursor, true);
  };

  const move = (dr: number, dc: number): void => {
    const engine = getEngine();
    if (!engine) return;
    const size = engine.level.size;
    cursor = [
      Math.max(0, Math.min(size - 1, cursor[0] + dr)),
      Math.max(0, Math.min(size - 1, cursor[1] + dc)),
    ];
    show();
    if (engine.strokeActive) engine.extend(cursor);
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    const engine = getEngine();
    if (!engine) return;

    switch (event.key) {
      case 'ArrowUp':
        move(-1, 0);
        break;
      case 'ArrowDown':
        move(1, 0);
        break;
      case 'ArrowLeft':
        move(0, -1);
        break;
      case 'ArrowRight':
        move(0, 1);
        break;
      case 'Enter':
      case ' ':
        show();
        if (engine.strokeActive) {
          engine.end();
          actions.onStrokeEnd?.();
        } else if (engine.begin(cursor)) {
          const color = engine.activeColor;
          if (color !== EMPTY) {
            renderer.popEndpoint(color);
            actions.onStrokeStart?.(color, cursor);
          }
        }
        break;
      case 'Escape':
        if (engine.strokeActive) {
          engine.end();
          actions.onStrokeEnd?.();
        } else {
          actions.togglePause();
        }
        break;
      case 'u':
      case 'U':
        actions.undo();
        break;
      case 'z':
      case 'Z':
        if (event.ctrlKey || event.metaKey) actions.undo();
        else return;
        break;
      case 'r':
      case 'R':
        actions.restart();
        break;
      case 'h':
      case 'H':
        actions.hint();
        break;
      default:
        return;
    }

    event.preventDefault();
  };

  target.addEventListener('keydown', onKeyDown);

  return () => {
    target.removeEventListener('keydown', onKeyDown);
    if (visible) renderer.setCursor(null, false);
  };
}
