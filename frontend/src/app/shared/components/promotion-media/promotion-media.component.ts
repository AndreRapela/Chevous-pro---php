import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { PromotionMediaFrame } from '../../../core/models';

@Component({
  selector: 'cvp-promotion-media',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.media-background]': 'isBackground()' },
  template: `
    <div class="media-frame" [style.width.%]="frame().size" [style.height.%]="isBackground() ? frame().size : null">
      @if (mediaType() === 'video') {
        @for (keyed of [useKey()]; track keyed) {
          <video #mediaVideo [attr.crossorigin]="keyed ? 'anonymous' : null" [attr.src]="videoSource()"
            [attr.poster]="posterUrl() === undefined ? frame().posterUrl : posterUrl()"
            [style.object-fit]="frame().fit" [style.object-position]="position()" [class.keyed-video]="keyReady()"
            [autoplay]="motionEnabled() && inView()" [muted]="true" playsinline loop preload="none" disablepictureinpicture aria-hidden="true"></video>
          @if (keyed) {
            <canvas #mediaCanvas [hidden]="!keyReady()" [style.object-fit]="frame().fit" [style.object-position]="position()" aria-hidden="true"></canvas>
          }
        }
      } @else {
        <img [src]="src()" [style.object-fit]="frame().fit" [style.object-position]="position()" [alt]="label()"
          [attr.loading]="preview() ? null : 'lazy'" decoding="async">
      }
    </div>
    @if (preview() && keyFailed()) {
      <p class="media-error" role="status">Não foi possível remover o fundo deste vídeo. Se o endereço online bloquear a edição, use um arquivo do computador.</p>
    }
  `,
  styles: `
    :host { display: block; min-width: 0; }
    :host(.media-background) { position: absolute; inset: 0; display: grid; place-items: center; }
    .media-frame { position: relative; margin-inline: auto; aspect-ratio: 16 / 9; overflow: hidden; border-radius: .55rem; }
    :host(.media-background) .media-frame { margin: 0; aspect-ratio: auto; border-radius: 0; }
    .media-frame > img, .media-frame > video, .media-frame > canvas {
      position: absolute; inset: 0; display: block; width: 100%; height: 100%; max-width: none; max-height: none; object-fit: contain; filter: none;
    }
    .media-frame > canvas[hidden] { display: none; }
    .media-frame > video, .media-frame > canvas { pointer-events: none; }
    .keyed-video { opacity: 0; }
    .media-error { position: relative; z-index: 3; margin: .5rem 0 0; padding: .3rem; background: #fff; color: #8e2925; font-size: .75rem; }
  `
})
export class PromotionMediaComponent {
  readonly src = input.required<string>();
  readonly frame = input.required<PromotionMediaFrame>();
  readonly mediaType = input<'image' | 'video'>('image');
  readonly label = input('');
  readonly preview = input(false);
  readonly posterUrl = input<string | null>();
  readonly isBackground = computed(() => this.frame().layout === 'background');
  readonly position = computed(() => `${this.frame().x}% ${this.frame().y}%`);
  readonly useKey = computed(() => !!this.frame().backgroundKey);
  readonly keyReady = signal(false);
  readonly keyFailed = signal(false);
  readonly motionEnabled = signal(false);
  readonly inView = signal(false);
  private readonly loadedSource = signal<string | null>(null);
  readonly videoSource = computed(() => this.motionEnabled() && this.loadedSource() === this.src() ? this.src() : null);

  private readonly mediaVideo = viewChild<ElementRef<HTMLVideoElement>>('mediaVideo');
  private readonly mediaCanvas = viewChild<ElementRef<HTMLCanvasElement>>('mediaCanvas');
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  constructor() {
    afterNextRender(() => {
      const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
      const update = () => this.motionEnabled.set(!preference.matches);
      update();
      preference.addEventListener('change', update);
      this.destroyRef.onDestroy(() => preference.removeEventListener('change', update));

      if (typeof IntersectionObserver === 'undefined') {
        this.inView.set(true);
        return;
      }
      const observer = new IntersectionObserver(([entry]) => this.inView.set(!!entry?.isIntersecting));
      observer.observe(this.host);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });

    effect(() => {
      if (this.mediaType() === 'video' && this.motionEnabled() && this.inView()) this.loadedSource.set(this.src());
    });

    effect(() => {
      const video = this.mediaVideo()?.nativeElement;
      if (!video) return;
      if (this.videoSource() && this.inView()) void video.play().catch(() => undefined);
      else video.pause();
    });

    effect((onCleanup) => {
      const key = this.frame().backgroundKey;
      const video = this.mediaVideo()?.nativeElement;
      const canvas = this.mediaCanvas()?.nativeElement;
      this.src();
      this.keyReady.set(false);
      this.keyFailed.set(false);
      if (!key || !video || !canvas || typeof window === 'undefined') return;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return;

      const rgb = Number.parseInt(key.color.slice(1), 16);
      const red = (rgb >> 16) & 255;
      const green = (rgb >> 8) & 255;
      const blue = rgb & 255;
      const maxDistance = key.tolerance;
      const softEdge = Math.min(18, maxDistance);
      let pending: number | undefined;
      let stopped = false;
      let previousTime = -1;
      const fail = () => {
        stopped = true;
        this.keyReady.set(false);
        this.keyFailed.set(true);
      };
      const render = () => {
        if (stopped || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0) return;
        const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
        const width = Math.max(1, Math.round(video.videoWidth * scale));
        const height = Math.max(1, Math.round(video.videoHeight * scale));
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        try {
          context.drawImage(video, 0, 0, width, height);
          const frame = context.getImageData(0, 0, width, height);
          for (let offset = 0; offset < frame.data.length; offset += 4) {
            const distance = Math.max(Math.abs(frame.data[offset]! - red), Math.abs(frame.data[offset + 1]! - green), Math.abs(frame.data[offset + 2]! - blue));
            if (distance < maxDistance) frame.data[offset + 3] = Math.round(255 * Math.max(0, (distance - maxDistance + softEdge) / softEdge));
          }
          context.putImageData(frame, 0, 0);
          this.keyReady.set(true);
        } catch {
          fail();
        }
      };
      const tick = () => {
        pending = undefined;
        if (stopped || video.paused || video.ended) return;
        if (video.currentTime !== previousTime) {
          previousTime = video.currentTime;
          render();
        }
        if (!stopped) pending = window.requestAnimationFrame(tick);
      };
      const start = () => { if (!stopped && pending === undefined) pending = window.requestAnimationFrame(tick); };
      video.addEventListener('loadeddata', render);
      video.addEventListener('play', start);
      video.addEventListener('error', fail);
      render();
      if (!video.paused) start();
      onCleanup(() => {
        if (pending !== undefined) window.cancelAnimationFrame(pending);
        video.removeEventListener('loadeddata', render);
        video.removeEventListener('play', start);
        video.removeEventListener('error', fail);
      });
    });
  }
}
