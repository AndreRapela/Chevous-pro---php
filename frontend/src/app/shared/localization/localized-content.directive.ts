import { isPlatformBrowser } from '@angular/common';
import { AfterViewInit, DestroyRef, Directive, ElementRef, PLATFORM_ID, effect, inject } from '@angular/core';
import { LocalizationService } from '../../core/localization/localization.service';

const LOCALIZED_ATTRIBUTES = ['aria-label', 'placeholder', 'title', 'alt'] as const;

@Directive({ selector: '[cvpLocalizedContent]', standalone: true })
export class LocalizedContentDirective implements AfterViewInit {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly localization = inject(LocalizationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly sourceText = new WeakMap<Text, string>();
  private readonly renderedText = new WeakMap<Text, string>();
  private readonly sourceAttributes = new WeakMap<Element, Map<string, string>>();
  private readonly renderedAttributes = new WeakMap<Element, Map<string, string>>();
  private observer?: MutationObserver;

  constructor() {
    effect(() => {
      this.localization.language();
      if (!isPlatformBrowser(this.platformId)) return;
      queueMicrotask(() => this.localizeTree(this.host));
    });
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.localizeTree(this.host);
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData' && mutation.target instanceof Text) this.localizeText(mutation.target);
        if (mutation.type === 'attributes' && mutation.target instanceof Element) this.localizeAttribute(mutation.target, mutation.attributeName ?? '');
        mutation.addedNodes.forEach((node) => this.localizeTree(node));
      }
    });
    this.observer.observe(this.host, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...LOCALIZED_ATTRIBUTES] });
    this.destroyRef.onDestroy(() => this.observer?.disconnect());
  }

  private localizeTree(root: Node): void {
    if (root instanceof Text) {
      this.localizeText(root);
      return;
    }
    if (root instanceof Element) this.localizeElement(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      if (node instanceof Text) this.localizeText(node);
      if (node instanceof Element) this.localizeElement(node);
      node = walker.nextNode();
    }
  }

  private localizeElement(element: Element): void {
    for (const attribute of LOCALIZED_ATTRIBUTES) this.localizeAttribute(element, attribute);
  }

  private localizeText(node: Text): void {
    if (node.parentElement?.closest('[data-cvp-no-localize]')) return;
    const current = node.data;
    const previousRender = this.renderedText.get(node);
    if (!this.sourceText.has(node) || (previousRender !== undefined && current !== previousRender)) this.sourceText.set(node, current);
    const source = this.sourceText.get(node) ?? current;
    const translated = this.localization.translate(source);
    this.renderedText.set(node, translated);
    if (current !== translated) node.data = translated;
  }

  private localizeAttribute(element: Element, attribute: string): void {
    if (element.closest('[data-cvp-no-localize]')) return;
    if (!LOCALIZED_ATTRIBUTES.includes(attribute as typeof LOCALIZED_ATTRIBUTES[number]) || !element.hasAttribute(attribute)) return;
    const current = element.getAttribute(attribute) ?? '';
    const previousRender = this.renderedAttributes.get(element)?.get(attribute);
    let sourceMap = this.sourceAttributes.get(element);
    if (!sourceMap) {
      sourceMap = new Map<string, string>();
      this.sourceAttributes.set(element, sourceMap);
    }
    if (!sourceMap.has(attribute) || (previousRender !== undefined && current !== previousRender)) sourceMap.set(attribute, current);
    const translated = this.localization.translate(sourceMap.get(attribute) ?? current);
    let renderedMap = this.renderedAttributes.get(element);
    if (!renderedMap) {
      renderedMap = new Map<string, string>();
      this.renderedAttributes.set(element, renderedMap);
    }
    renderedMap.set(attribute, translated);
    if (current !== translated) element.setAttribute(attribute, translated);
  }
}
