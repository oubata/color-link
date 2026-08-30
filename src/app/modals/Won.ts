import { el, type View } from '../dom';
import { formatTime } from '../format';
import type { WonResult } from '../state';
import { S } from '../strings';
import { createModal, pillButton } from './modal';

export interface WonProps {
  result: WonResult;
  hasNext: boolean;
  onNext(): void;
  onReplay(): void;
  onLevelList(): void;
}

export function createWon(props: WonProps): View {
  const { result } = props;

  // Time and best share one line. The card has to clear the board on a 640px
  // screen, and two bordered rows cost more height than they earn.
  const summary = el('div', { class: 'modal__summary' }, [
    el('span', { class: 'modal__summary-item' }, [
      el('span', { class: 'modal__row-label', text: S.time }),
      el('span', {
        class: 'modal__row-value',
        text: formatTime(result.elapsedMs),
      }),
    ]),
    result.newBest
      ? el('span', { class: 'badge', text: S.newBest })
      : el('span', { class: 'modal__summary-item' }, [
          el('span', { class: 'modal__row-label', text: S.best }),
          el('span', {
            class: 'modal__row-value',
            text: formatTime(result.bestMs),
          }),
        ]),
  ]);

  // Replay and Level list share a row: the card has to stay short enough to
  // sit under the board without covering it, even on a 640px-tall screen.
  const actions = el('div', { class: 'modal__actions' }, [
    props.hasNext
      ? pillButton(S.nextLevel, props.onNext)
      : pillButton(S.levelList, props.onLevelList),
    el('div', { class: 'modal__actions-row' }, [
      pillButton(S.replay, props.onReplay, 'text'),
      props.hasNext ? pillButton(S.levelList, props.onLevelList, 'text') : null,
    ]),
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
      summary,
      result.hintUsed
        ? el('p', {
            class: 'modal__note',
            // A board saved before the tally existed knows a hint happened but
            // not how many, so one is the least it can honestly say.
            text: S.hintsUsed(Math.max(1, result.hintCount)),
          })
        : null,
      actions,
    ],
  );
}
