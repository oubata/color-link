import { tierById, type TierConfig } from '../../generator/difficulty';
import type { Progress } from '../../storage/persistence';
import type { TierId } from '../../engine/types';
import { el, type View } from '../dom';
import { ICONS } from '../icons';
import { firstUnsolved, solvedCount, solvedRecord } from '../progress';
import { S } from '../strings';

export interface LevelSelectProps {
  tier: TierId;
  progress: Progress;
  onBack(): void;
  onLevel(index: number): void;
}

export function createLevelSelect(props: LevelSelectProps): View {
  const tier: TierConfig = tierById(props.tier);
  const solved = solvedCount(props.progress, tier.id);
  const suggested = firstUnsolved(props.progress, tier.id);

  const tiles: HTMLElement[] = [];
  for (let index = 1; index <= tier.levelCount; index++) {
    tiles.push(tile(tier, index, suggested, props));
  }

  const root = el('main', { class: 'screen screen--levels' }, [
    el('header', { class: 'topbar' }, [
      el('button', {
        class: 'icon-button',
        html: ICONS.back,
        attrs: { type: 'button', 'aria-label': S.back },
        on: { click: props.onBack },
      }),
      el('h1', {
        class: 'topbar__title',
        text: S.levelSelectTitle(tier.name, tier.size),
      }),
      el('span', {
        class: 'topbar__trailing',
        text: S.tierProgress(solved, tier.levelCount),
      }),
    ]),
    el('ul', { class: 'levels' }, tiles),
  ]);

  return { el: root };
}

function tile(
  tier: TierConfig,
  index: number,
  suggested: number,
  props: LevelSelectProps,
): HTMLElement {
  const record = solvedRecord(props.progress, tier.id, index);
  const classes = ['level-tile'];
  if (record && record.hint) classes.push('level-tile--hinted');
  else if (record) classes.push('level-tile--solved');
  if (!record && index === suggested) classes.push('level-tile--suggested');

  const label = record
    ? `${S.levelTileLabel(index)}, solved${record.hint ? ' with a hint' : ''}`
    : S.levelTileLabel(index);

  const button = el(
    'button',
    {
      class: classes.join(' '),
      attrs: { type: 'button', 'aria-label': label },
      on: { click: () => props.onLevel(index) },
    },
    [el('span', { class: 'level-tile__number', text: String(index) })],
  );

  if (record?.hint) button.append(el('span', { class: 'level-tile__dot' }));

  return el('li', {}, [button]);
}
