const ATTRIBUTES = ['aria-label', 'placeholder', 'title', 'alt', 'data-label'];
const NON_INTERFACE_ELEMENTS = new Set(['SCRIPT', 'STYLE']);

/** Translate the completed SSR view in place; never change its hydration structure. */
export function localizeServerContent(root: Node, translate: (value: string) => string): void {
  const pending: Node[] = [root];
  while (pending.length) {
    const node = pending.pop()!;
    if (node.nodeType === 1) {
      const element = node as Element;
      if (element.hasAttribute('data-cvp-no-localize') || NON_INTERFACE_ELEMENTS.has(element.tagName.toUpperCase())) continue;
      for (const attribute of ATTRIBUTES) {
        const source = element.getAttribute(attribute);
        if (source === null) continue;
        const translated = translate(source);
        if (translated !== source) element.setAttribute(attribute, translated);
      }
      if (element.tagName.toUpperCase() === 'TEXTAREA') continue;
    }
    if (node.nodeType === 3) {
      const text = node as Text;
      const translated = translate(text.data);
      if (translated !== text.data) text.data = translated;
    }
    for (let index = node.childNodes.length - 1; index >= 0; index--) pending.push(node.childNodes[index]);
  }
}
