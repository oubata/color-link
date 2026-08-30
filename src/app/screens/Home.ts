import type { TierId } from '../../engine/types';
import { TIERS, tierById, type TierConfig } from '../../generator/difficulty';
import type { Progress } from '../../storage/persistence';
import { APP_NAME } from '../config';
import { el, type View } from '../dom';
import { APP_MARK, ICONS } from '../icons';
import { tierColor, withAlpha } from '../../render/theme';
import { isUnlocked, solvedCount } from '../progress';
import { S } from '../strings';

export interface HomeProps {
  progress: Progress;
  onTier(tier: TierId): void;
  onHowToPlay(): void;
  onSettings(): void;
}

export function createHome(props: HomeProps): View {
  const rows = TIERS.map((tier) => tierRow(tier, props));

  const root = el('main', { class: 'screen screen--home' }, [
    el('header', { class: 'home__header' }, [
      el('div', { class: 'home__mark', html: APP_MARK }),
      el('h1', { class: 'home__title', text: APP_NAME }),
      el('p', { class: 'home__tagline', text: S.tagline }),
    ]),
    el('ul', { class: 'tiers' }, rows),
    el('footer', { class: 'home__footer' }, [
      el('button', {
        class: 'text-button',
        text: S.howToPlay,
        attrs: { type: 'button' },
        on: { click: props.onHowToPlay },
      }),
      el('button', {
        class: 'icon-button',
        html: ICONS.gear,
        attrs: { type: 'button', 'aria-label': S.settings },
        on: { click: props.onSettings },
      }),
    ]),
  ]);

  return { el: root };
}

function tierRow(tier: TierConfig, props: HomeProps): HTMLElement {
  const unlocked = isUnlocked(tier, props.progress);
  const solved = solvedCount(props.progress, tier.id);
  const fraction = solved / tier.levelCount;

  const content = [
    el('span', { class: 'tier__name', text: tier.name }),
    el('span', { class: 'tier__size', text: S.tierSize(tier.size) }),
    el('span', {
      class: 'tier__progress',
      text: S.tierProgress(solved, tier.levelCount),
    }),
    el('div', { class: 'tier__bar' }, [
      el('div', {
        class: 'tier__bar-fill',
        attrs: { style: `width: ${(fraction * 100).toFixed(1)}%` },
      }),
    ]),
  ];

  if (!unlocked && tier.unlock) {
    const gate = tierById(tier.unlock.tier);
    content.push(
      el('span', { class: 'tier__lock', html: ICONS.lock }),
      el('span', {
        class: 'tier__unlock',
        text: S.unlockHint(tier.unlock.solved, gate.name),
      }),
    );
  }

  // No aria-label: the row's own text already reads "Easy 5×5 0/100", and an
  // added label that does not contain the visible text confuses voice control.
  const inner = unlocked
    ? el(
        'button',
        {
          class: 'tier__button',
          attrs: { type: 'button' },
          on: { click: () => props.onTier(tier.id) },
        },
        content,
      )
    : el(
        'div',
        {
          class: 'tier__button tier__button--locked',
          attrs: { 'aria-disabled': 'true' },
        },
        content,
      );

  // The row carries its tier's colour as a custom property, so the rail, the
  // wash and the progress bar all read from one value.
  const color = tierColor(tier.id);
  return el(
    'li',
    {
      class: `tier${unlocked ? '' : ' tier--locked'}`,
      attrs: {
        style: `--tier-color: ${color}; --tier-wash: ${withAlpha(color, 0.09)}`,
      },
    },
    [inner],
  );
}
