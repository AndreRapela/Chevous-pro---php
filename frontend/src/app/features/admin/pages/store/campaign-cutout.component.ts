import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, inject, input, output, signal, viewChild } from '@angular/core';

interface BackgroundSample {
  pixel: number;
  tolerance: number;
}

@Component({
  selector: 'cvp-campaign-cutout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cutout-editor">
      <p>Clique em uma área do fundo para apagá-la. Aumente a tolerância para incluir tons parecidos no próximo clique.</p>
      <label>Tolerância
        <input type="range" min="5" max="100" [value]="tolerance()" (input)="setTolerance($event)" [disabled]="!ready() || applying()">
        <output>{{ tolerance() }}</output>
      </label>
      @if (failure()) { <p class="field-error" role="alert">{{ failure() }}</p> }
      @else if (!ready()) { <p role="status">Carregando imagem…</p> }
      <div class="cutout-stage" [hidden]="!ready()">
        <canvas #canvas (click)="sampleBackground($event)" aria-label="Prévia do fundo da imagem"></canvas>
      </div>
      <div class="cutout-actions">
        <button type="button" class="btn btn-secondary btn-small" (click)="sampleCorners()" [disabled]="!ready() || applying()">Limpar fundo pelos cantos</button>
        <button type="button" class="text-button" (click)="undo()" [disabled]="!changed() || applying()">Desfazer</button>
        <button type="button" class="text-button" (click)="cancelled.emit()" [disabled]="applying()">Cancelar</button>
        <button type="button" class="btn btn-primary btn-small" (click)="apply()" [disabled]="!changed() || applying()">Usar imagem sem fundo</button>
      </div>
    </div>
  `,
  styles: `
    .cutout-editor { display: grid; gap: .65rem; padding: .85rem; margin-top: .65rem; border: 1px solid var(--ink-200); border-radius: .75rem; background: #fff; }
    .cutout-editor p { margin: 0; font-size: .8rem; }
    .cutout-editor label { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: .55rem; }
    .cutout-editor input[type="range"] { width: 100%; min-width: 0; padding: 0; }
    .cutout-stage { text-align: center; }
    canvas { display: block; max-width: 100%; max-height: 22rem; margin: 0 auto; cursor: crosshair; border: 1px solid var(--ink-300); background: repeating-conic-gradient(#e4e9e6 0% 25%, #fff 0% 50%) 50% / 1rem 1rem; }
    .cutout-actions { display: flex; flex-wrap: wrap; align-items: center; gap: .45rem .65rem; }
  `
})
export class CampaignCutoutComponent {
  readonly src = input.required<string>();
  readonly applied = output<File>();
  readonly cancelled = output<void>();

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly destroyRef = inject(DestroyRef);
  private original?: ImageData;
  private readonly steps: BackgroundSample[][] = [];
  readonly tolerance = signal(35);
  readonly ready = signal(false);
  readonly changed = signal(false);
  readonly applying = signal(false);
  readonly failure = signal('');

  constructor() {
    afterNextRender(() => { void this.loadImage(); });
  }

  setTolerance(event: Event): void {
    this.tolerance.set((event.target as HTMLInputElement).valueAsNumber);
  }

  sampleBackground(event: MouseEvent): void {
    if (!this.original || this.applying()) return;
    const canvas = this.canvas().nativeElement;
    const bounds = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(canvas.width - 1, Math.floor((event.clientX - bounds.left) * canvas.width / bounds.width)));
    const y = Math.max(0, Math.min(canvas.height - 1, Math.floor((event.clientY - bounds.top) * canvas.height / bounds.height)));
    this.addSamples([y * canvas.width + x]);
  }

  sampleCorners(): void {
    if (!this.original) return;
    const { width, height, data } = this.original;
    const corners = [0, width - 1, (height - 1) * width, width * height - 1];
    const visible = corners.filter((pixel) => data[pixel * 4 + 3] !== 0);
    if (visible.length === 0) return;
    const limit = 3 * this.tolerance() ** 2;
    const groups = visible.map((reference) => visible.filter((pixel) => colorDistance(data, pixel * 4, reference * 4) <= limit));
    const largest = groups.reduce((best, group) => group.length > best.length ? group : best, []);
    if (largest.length < 2) {
      this.failure.set('As cores dos cantos são diferentes. Clique diretamente no fundo para selecionar uma área.');
      return;
    }
    this.addSamples(largest);
  }

  undo(): void {
    this.steps.pop();
    this.render();
  }

  apply(): void {
    if (!this.changed() || this.applying()) return;
    const source = this.canvas().nativeElement;
    const context = source.getContext('2d');
    if (!context) return;
    const { width, height } = source;
    const pixels = context.getImageData(0, 0, width, height).data;
    const bounds = opaqueBounds(pixels, width, height);
    if (!bounds) {
      this.failure.set('Todo o conteúdo ficou transparente. Desfaça o último recorte e tente com uma tolerância menor.');
      return;
    }

    const result = document.createElement('canvas');
    result.width = bounds.width;
    result.height = bounds.height;
    const outputContext = result.getContext('2d');
    if (!outputContext) return;
    outputContext.drawImage(source, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);

    this.applying.set(true);
    result.toBlob((blob) => {
      if (this.destroyRef.destroyed) return;
      this.applying.set(false);
      if (blob) this.applied.emit(new File([blob], 'campanha-sem-fundo.png', { type: 'image/png' }));
      else this.failure.set('Não foi possível gerar a imagem transparente.');
    }, 'image/png');
  }

  private async loadImage(): Promise<void> {
    try {
      const url = new URL(this.src(), window.location.href);
      if (url.protocol !== 'https:' && url.protocol !== 'blob:' && url.origin !== window.location.origin) throw new Error();
      const image = new Image();
      if (url.protocol !== 'blob:' && url.origin !== window.location.origin) image.crossOrigin = 'anonymous';
      image.referrerPolicy = 'no-referrer';
      image.src = url.href;
      await image.decode();
      if (this.destroyRef.destroyed) return;

      const canvas = this.canvas().nativeElement;
      const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error();
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      this.original = context.getImageData(0, 0, canvas.width, canvas.height);
      this.ready.set(true);
    } catch {
      if (!this.destroyRef.destroyed) this.failure.set('Não foi possível editar esta imagem. Se o endereço online bloquear a edição, use um arquivo do computador.');
    }
  }

  private addSamples(pixels: number[]): void {
    this.steps.push(pixels.map((pixel) => ({ pixel, tolerance: this.tolerance() })));
    if (!this.render()) this.steps.pop();
  }

  private render(): boolean {
    const original = this.original;
    const context = this.canvas().nativeElement.getContext('2d');
    if (!original || !context) return false;

    const { width, height } = original;
    const result = new ImageData(new Uint8ClampedArray(original.data), width, height);
    const queue = new Int32Array(width * height);
    let changedInLastStep = false;
    for (const step of this.steps) {
      changedInLastStep = false;
      for (const sample of step) {
        changedInLastStep = eraseRegion(result, sample, queue) || changedInLastStep;
      }
    }
    context.putImageData(result, 0, 0);
    this.changed.set(this.steps.length > 1 || changedInLastStep);
    this.failure.set('');
    return changedInLastStep;
  }
}

function colorDistance(data: Uint8ClampedArray, a: number, b: number): number {
  return (data[a]! - data[b]!) ** 2 + (data[a + 1]! - data[b + 1]!) ** 2 + (data[a + 2]! - data[b + 2]!) ** 2;
}

function eraseRegion(image: ImageData, sample: BackgroundSample, queue: Int32Array): boolean {
  const { data, width, height } = image;
  const reference = sample.pixel * 4;
  if (data[reference + 3] === 0) return false;
  const limit = 3 * sample.tolerance ** 2;
  let tail = 0;
  const enqueue = (pixel: number): void => {
    const offset = pixel * 4;
    if (data[offset + 3] === 0 || colorDistance(data, offset, reference) > limit) return;
    data[offset + 3] = 0;
    queue[tail++] = pixel;
  };
  enqueue(sample.pixel);
  for (let head = 0; head < tail; head++) {
    const pixel = queue[head]!;
    const column = pixel % width;
    if (column > 0) enqueue(pixel - 1);
    if (column + 1 < width) enqueue(pixel + 1);
    if (pixel >= width) enqueue(pixel - width);
    if (pixel < width * (height - 1)) enqueue(pixel + width);
  }
  return tail > 0;
}

function opaqueBounds(data: Uint8ClampedArray, width: number, height: number): { x: number; y: number; width: number; height: number } | null {
  let left = width, right = -1, top = height, bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] === 0) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  return right < 0 ? null : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}
