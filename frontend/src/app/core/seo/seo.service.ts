import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { SEO_SITE_ORIGIN } from './seo-site-origin.token';

export interface SeoPage {
  title: string;
  description: string;
  canonicalPath?: string;
  noindex?: boolean;
  type?: 'website' | 'article' | 'profile';
  imagePath?: string;
  structuredData?: Record<string, unknown> | Array<Record<string, unknown>>;
}

const DEFAULT_IMAGE_PATH = '/images/profissional-limpeza-hero-887.webp';

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly document = inject(DOCUMENT);
  private readonly meta = inject(Meta);
  private readonly title = inject(Title);
  private readonly siteOrigin = inject(SEO_SITE_ORIGIN);

  update(page: SeoPage): void {
    const title = this.clean(page.title, 60);
    const description = this.clean(page.description, 160);
    const canonical = this.absoluteUrl(page.canonicalPath ?? this.document.location?.pathname ?? '/');
    const robots = page.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large';
    const type = page.type ?? 'website';

    this.title.setTitle(title);
    this.setName('description', description);
    this.setName('robots', robots);
    this.setProperty('og:locale', 'pt_BR');
    this.setProperty('og:site_name', 'ChezVoust Pro');
    this.setProperty('og:type', type);
    this.setProperty('og:title', title);
    this.setProperty('og:description', description);
    this.setProperty('og:url', canonical);
    this.setName('twitter:card', 'summary_large_image');
    this.setName('twitter:title', title);
    this.setName('twitter:description', description);

    const image = page.imagePath === '' ? '' : this.absoluteUrl(page.imagePath ?? DEFAULT_IMAGE_PATH);
    if (image) {
      this.setProperty('og:image', image);
      this.setName('twitter:image', image);
    } else {
      this.meta.removeTag('property="og:image"');
      this.meta.removeTag('name="twitter:image"');
    }

    this.setCanonical(canonical);
    this.setStructuredData(page.structuredData);
  }

  private setName(name: string, content: string): void {
    this.meta.updateTag({ name, content }, `name="${name}"`);
  }

  private setProperty(property: string, content: string): void {
    this.meta.updateTag({ property, content }, `property="${property}"`);
  }

  private setCanonical(url: string): void {
    let canonical = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = this.document.createElement('link');
      canonical.rel = 'canonical';
      this.document.head.appendChild(canonical);
    }
    canonical.href = url;
  }

  private setStructuredData(data: SeoPage['structuredData']): void {
    const id = 'chezvoust-structured-data';
    const existing = this.document.getElementById(id);
    if (!data) {
      existing?.remove();
      return;
    }
    const script = existing ?? this.document.createElement('script');
    script.id = id;
    script.setAttribute('type', 'application/ld+json');
    script.textContent = JSON.stringify(data, (key, value) => this.structuredDataValue(key, value)).replace(/</g, '\\u003c');
    if (!existing) this.document.head.appendChild(script);
  }

  /** Também é usada ao produzir URLs absolutas no JSON-LD dos componentes. */
  absoluteUrl(path: string): string {
    if (/^https?:\/\//i.test(path)) return path;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const origin = this.siteOrigin.replace(/\/$/, '');
    return origin ? `${origin}${cleanPath}` : cleanPath;
  }

  private structuredDataValue(key: string, value: unknown): unknown {
    if (typeof value === 'string' && ['url', 'item', 'target', 'image'].includes(key) && value.startsWith('/')) {
      return this.absoluteUrl(value);
    }
    return value;
  }

  private clean(value: string, maximumLength: number): string {
    const normalized = value.replace(/\s+/g, ' ').trim();
    return normalized.length > maximumLength ? `${normalized.slice(0, maximumLength - 1).trimEnd()}…` : normalized;
  }
}
