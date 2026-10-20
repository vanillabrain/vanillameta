/** A UI-only bookmark, never an authorization result or a retained data view. */
export type PublicationFocus = {
  anchor: 'basis' | 'block' | 'link';
  blockId: string | null;
  position: number;
  signature: string;
  disclosures: boolean[];
};
const controls = 'a[href], button, summary, [tabindex]';
const signature = (element: Element) =>
  JSON.stringify([
    element.tagName,
    element.getAttribute('role'),
    element.getAttribute('aria-label'),
    element.hasAttribute('aria-label') ? '' : element.matches('button, a, summary') ? element.textContent : '',
  ]);
export function capturePublicationFocus(root: HTMLElement | null, active: Element | null): PublicationFocus | null {
  if (!root || !active || !root.contains(active)) return null;
  const anchor = active.closest('[data-analysis-basis], [data-publication-block], [data-publication-link]');
  if (!anchor) return null;
  const targets = anchor.matches(controls) ? [anchor] : Array.from(anchor.querySelectorAll(controls));
  const position = targets.indexOf(active);
  if (position < 0) return null;
  return {
    anchor: anchor.hasAttribute('data-analysis-basis')
      ? 'basis'
      : anchor.hasAttribute('data-publication-block')
      ? 'block'
      : 'link',
    blockId: anchor.getAttribute('data-publication-block'),
    position,
    signature: signature(active),
    disclosures: Array.from(anchor.querySelectorAll('details')).map(element => element.open),
  };
}
export function publicationFocusTarget(root: HTMLElement | null, bookmark: PublicationFocus): HTMLElement | null {
  const anchor =
    bookmark.anchor === 'basis'
      ? root?.querySelector('[data-analysis-basis]')
      : bookmark.anchor === 'link'
      ? root?.querySelector('[data-publication-link]')
      : Array.from(root?.querySelectorAll('[data-publication-block]') ?? []).find(
          element => element.getAttribute('data-publication-block') === bookmark.blockId,
        );
  if (!anchor) return null;
  const target = (anchor.matches(controls) ? [anchor] : Array.from(anchor.querySelectorAll(controls)))[bookmark.position];
  if (!(target instanceof HTMLElement) || signature(target) !== bookmark.signature) return null;
  // The caller has re-authorized the same snapshot before restoring disclosure state.
  anchor.querySelectorAll('details').forEach((element, index) => {
    element.open = bookmark.disclosures[index] ?? false;
  });
  return target;
}
