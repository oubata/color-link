import type { Settings } from '../../storage/persistence';
import { APP_VERSION } from '../config';
import { el, type View } from '../dom';
import { GENERATOR_VERSION } from '../../generator/difficulty';
import { S } from '../strings';
import { createModal, pillButton } from './modal';

export interface SettingsProps {
  settings: Settings;
  hapticsAvailable: boolean;
  onChange(patch: Partial<Settings>): void;
  onReset(): void;
  onClose(): void;
}

export function createSettings(props: SettingsProps): View {
  const body: HTMLElement[] = [
    segmented(
      S.theme,
      [
        { value: 'system', label: S.themeSystem },
        { value: 'light', label: S.themeLight },
        { value: 'dark', label: S.themeDark },
      ],
      props.settings.theme,
      (value) => props.onChange({ theme: value as Settings['theme'] }),
    ),
    toggle(S.sound, props.settings.sound, (on) =>
      props.onChange({ sound: on }),
    ),
  ];

  if (props.hapticsAvailable) {
    body.push(
      toggle(S.haptics, props.settings.haptics, (on) =>
        props.onChange({ haptics: on }),
      ),
    );
  }

  body.push(
    toggle(S.colorBlindLabels, props.settings.colorBlind, (on) =>
      props.onChange({ colorBlind: on }),
    ),
    segmented(
      S.reducedMotion,
      [
        { value: 'system', label: S.themeSystem },
        { value: 'on', label: S.on },
        { value: 'off', label: S.off },
      ],
      props.settings.reducedMotion,
      (value) =>
        props.onChange({ reducedMotion: value as Settings['reducedMotion'] }),
    ),
    el('div', { class: 'settings__danger' }, [
      el('button', {
        class: 'text-button text-button--danger',
        text: S.resetProgress,
        attrs: { type: 'button' },
        on: { click: props.onReset },
      }),
    ]),
    el('p', {
      class: 'settings__version',
      text: S.versionLine(APP_VERSION, GENERATOR_VERSION),
    }),
  );

  return createModal({ title: S.settings, onClose: props.onClose }, [
    el('div', { class: 'settings' }, body),
    el('div', { class: 'modal__actions' }, [
      pillButton(S.close, props.onClose),
    ]),
  ]);
}

interface Option {
  value: string;
  label: string;
}

function segmented(
  label: string,
  options: Option[],
  selected: string,
  onSelect: (value: string) => void,
): HTMLElement {
  const group = el('div', {
    class: 'segmented',
    attrs: { role: 'radiogroup', 'aria-label': label },
  });

  const buttons = options.map((option) => {
    const button = el('button', {
      class: 'segmented__option',
      text: option.label,
      attrs: {
        type: 'button',
        role: 'radio',
        'aria-checked': option.value === selected,
      },
    });
    button.addEventListener('click', () => {
      for (const other of buttons) {
        other.setAttribute('aria-checked', String(other === button));
      }
      onSelect(option.value);
    });
    return button;
  });
  for (const button of buttons) group.append(button);

  return el('div', { class: 'settings__row' }, [
    el('span', { class: 'settings__label', text: label }),
    group,
  ]);
}

function toggle(
  label: string,
  on: boolean,
  onChange: (value: boolean) => void,
): HTMLElement {
  const button = el('button', {
    class: 'switch',
    attrs: {
      type: 'button',
      role: 'switch',
      'aria-checked': on,
      'aria-label': label,
    },
    on: {
      click: () => {
        const next = button.getAttribute('aria-checked') !== 'true';
        button.setAttribute('aria-checked', String(next));
        onChange(next);
      },
    },
  });
  button.append(el('span', { class: 'switch__knob' }));

  return el('div', { class: 'settings__row' }, [
    el('span', { class: 'settings__label', text: label }),
    button,
  ]);
}
