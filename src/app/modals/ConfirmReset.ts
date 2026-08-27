import { el, type View } from '../dom';
import { S } from '../strings';
import { createModal, pillButton } from './modal';

export interface ConfirmProps {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm(): void;
  onCancel(): void;
}

export function createConfirm(props: ConfirmProps): View {
  return createModal({ title: props.title, onClose: props.onCancel }, [
    el('p', { class: 'modal__note', text: props.body }),
    el('div', { class: 'modal__actions' }, [
      el('button', {
        class: 'pill pill--danger',
        text: props.confirmLabel,
        attrs: { type: 'button' },
        on: { click: props.onConfirm },
      }),
      pillButton(S.cancel, props.onCancel, 'text'),
    ]),
  ]);
}

export function createConfirmReset(handlers: {
  onConfirm(): void;
  onCancel(): void;
}): View {
  return createConfirm({
    title: S.confirmResetTitle,
    body: S.confirmResetBody,
    confirmLabel: S.confirmResetConfirm,
    ...handlers,
  });
}

export function createConfirmRestart(handlers: {
  onConfirm(): void;
  onCancel(): void;
}): View {
  return createConfirm({
    title: S.confirmRestartTitle,
    body: S.confirmRestartBody,
    confirmLabel: S.confirmRestartConfirm,
    ...handlers,
  });
}
