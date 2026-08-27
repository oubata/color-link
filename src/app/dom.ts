export interface ElementProps {
  class?: string;
  text?: string;
  html?: string;
  attrs?: Record<string, string | number | boolean | null>;
  on?: Record<string, (event: Event) => void>;
}

/** Terse element builder, so the screens read as structure rather than plumbing. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElementProps = {},
  children: (Node | string | null | undefined)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props.class) node.className = props.class;
  if (props.text !== undefined) node.textContent = props.text;
  if (props.html !== undefined) node.innerHTML = props.html;

  for (const [name, value] of Object.entries(props.attrs ?? {})) {
    if (value === null || value === false) continue;
    node.setAttribute(name, value === true ? '' : String(value));
  }
  for (const [name, handler] of Object.entries(props.on ?? {})) {
    node.addEventListener(name, handler);
  }
  for (const child of children) {
    if (child === null || child === undefined) continue;
    node.append(child);
  }
  return node;
}

export function clear(node: HTMLElement): void {
  while (node.firstChild) node.firstChild.remove();
}

/** Every view the app can mount. */
export interface View {
  el: HTMLElement;
  destroy?(): void;
  /** Called after the view is in the document, for focus and measurement. */
  mounted?(): void;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function focusableWithin(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (node) => node.offsetParent !== null || node === document.activeElement,
  );
}

/** Keeps Tab inside a dialog, per the accessibility pass in spec 12.19. */
export function trapFocus(root: HTMLElement, event: KeyboardEvent): void {
  if (event.key !== 'Tab') return;
  const focusable = focusableWithin(root);
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!first || !last) return;

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
