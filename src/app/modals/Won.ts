import { el, type View } from '../dom';
import { formatTime } from '../format';
import type { WonResult } from '../state';
import { S } from '../strings';
import { createModal, modalRow, pillButton } from './modal';

export interface WonProps {
  result: WonResult;
  hasNext: boolean;
  onNext(): void;
  onReplay(): void;
  onLevelList(): void;
}

export function createWon(props: WonProps): View {
  const { result } = props;

  const rows: HTMLElement[] = [modalRow(S.time, formatTime(result.elapsedMs))];
  if (result.newBest) {
    rows.push(
      el('div', { class: 'modal__row' }, [
        el('span', { class: 'modal__row-label', text: S.best }),
        el('span', { class: 'badge', text: S.newBest }),
      ]),
    );
  } else {
    rows.push(modalRow(S.best, formatTime(result.bestMs)));
  }
  if (result.hintUsed) {
    rows.push(el('p', { class: 'modal__note', text: S.hintUsed }));
  }

  const actions = el('div', { class: 'modal__actions' }, [
    props.hasNext
      ? pillButton(S.nextLevel, props.onNext)
      : pillButton(S.levelList, props.onLevelList),
    pillButton(S.replay, props.onReplay, 'text'),
    props.hasNext ? pillButton(S.levelList, props.onLevelList, 'text') : null,
  ]);

  return createModal(
    {
      title: result.perfect ? S.perfect : S.solved,
      onClose: props.onLevelList,
      // Spec 9: the solved board stays visible behind at full opacity, and
      // only the explicit buttons leave the card.
      clear: true,
      dismissible: false,
    },
    [
      result.perfect
        ? el('p', { class: 'modal__note', text: S.perfectExplainer })
        : null,
      el('div', { class: 'modal__rows' }, rows),
      actions,
    ],
  );
}
