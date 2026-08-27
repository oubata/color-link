/**
 * Inline 24×24 icons, 1.75 px stroke, `currentColor` (spec 10). No icon package,
 * no network request.
 */

const OPEN =
  '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" ' +
  'stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">';

function icon(body: string): string {
  return `${OPEN}${body}</svg>`;
}

export const ICONS = {
  back: icon('<path d="M15 5 8 12l7 7"/>'),
  pause: icon('<path d="M9 5v14M15 5v14"/>'),
  play: icon('<path d="M8 5l11 7-11 7z"/>'),
  undo: icon('<path d="M4 9h10a5 5 0 0 1 0 10H8"/><path d="M8 5 4 9l4 4"/>'),
  hint: icon(
    '<path d="M9.5 17h5"/><path d="M10 20.5h4"/>' +
      '<path d="M12 3a6 6 0 0 0-3.6 10.8c.5.4.9 1 1 1.7h5.2c.1-.7.5-1.3 1-1.7A6 6 0 0 0 12 3Z"/>',
  ),
  restart: icon(
    '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4 4v4h4"/>',
  ),
  gear: icon(
    '<circle cx="12" cy="12" r="3"/>' +
      '<path d="M12 2.5v2M12 19.5v2M21.5 12h-2M4.5 12h-2M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4M18.7 18.7l-1.4-1.4M6.7 6.7 5.3 5.3"/>',
  ),
  lock: icon(
    '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/>' +
      '<path d="M8.5 10.5V7a3.5 3.5 0 0 1 7 0v3.5"/>',
  ),
  close: icon('<path d="M6 6l12 12M18 6 6 18"/>'),
} as const;

export type IconName = keyof typeof ICONS;
