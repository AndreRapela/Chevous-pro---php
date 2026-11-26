import { ChangeDetectionStrategy, Component, computed, effect, inject, input, linkedSignal, signal } from '@angular/core';
import { LocalizationService } from '../../../../core/localization/localization.service';
import { MAX_CAMPAIGN_UPLOAD } from './campaign-media-limits';
import type { OptimizedCampaignVideo, VideoQuality } from './campaign-video-optimization';

@Component({
  selector: 'cvp-campaign-video-optimizer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset class="video-quality">
      <legend>Qualidade do vídeo</legend>
      <label>
        Perfil de otimização
        <select [value]="quality()" [disabled]="running()" (change)="chooseQuality($event)">
          <option value="original">Manter original</option>
          <option value="480p">Mais leve (até 480p)</option>
          <option value="720p">Equilibrado (até 720p)</option>
          <option value="1080p">Mais definição (até 1080p)</option>
        </select>
      </label>
      @if (quality() !== 'original') {
        <small>A versão otimizada é gerada no navegador, sem áudio para o banner.</small>
        <div class="video-quality-actions">
          @if (running()) {
            <progress max="100" [value]="progress()" aria-label="Progresso da otimização"></progress>
            <button class="text-button" type="button" (click)="cancel()">Cancelar otimização</button>
          } @else {
            <button class="btn btn-secondary btn-small" type="button" (click)="optimize()">Otimizar vídeo</button>
          }
        </div>
      }
      @if (processed(); as result) {
        <output class="video-quality-result" role="status">
          @if (result.file) {
            <span>Tamanho do vídeo</span>
            <strong data-cvp-no-localize>{{ size(result.originalBytes) }} → {{ size(result.file.size) }}</strong>
            <span data-cvp-no-localize>{{ result.width }} × {{ result.height }} px</span>
          } @else {
            <span>O original já é menor. Ele será usado na campanha.</span>
          }
        </output>
      }
      @if (originalTooLarge() && quality() === 'original') {
        <small class="field-error">Otimize o vídeo para enviá-lo em até 25 MB.</small>
      }
      @if (error()) { <small class="field-error" role="alert">{{ error() }}</small> }
    </fieldset>
  `,
  styles: `
    .video-quality { display: grid; gap: .55rem; min-width: 0; margin: .85rem 0; border: 1px solid var(--ink-200); border-radius: .75rem; padding: .75rem; }
    .video-quality legend { padding-inline: .25rem; font-weight: 700; }
    .video-quality-actions, .video-quality-result { display: flex; flex-wrap: wrap; align-items: center; gap: .4rem .75rem; }
    progress { width: min(100%, 12rem); accent-color: var(--brand-700); }
  `
})
export class CampaignVideoOptimizerComponent {
  private readonly localization = inject(LocalizationService);
  readonly source = input.required<File | string>();
  readonly quality = linkedSignal<VideoQuality | 'original'>(() => {
    this.source();
    return 'original';
  });
  readonly error = signal('');
  readonly progress = signal<number | null>(null);
  readonly running = computed(() => this.progress() !== null);
  readonly processed = signal<(Omit<OptimizedCampaignVideo, 'file'> & { file: File | null }) | null>(null);
  readonly originalTooLarge = computed(() => {
    const source = this.source();
    return typeof source !== 'string' && source.size > MAX_CAMPAIGN_UPLOAD;
  });
  readonly blocksSave = computed(() => this.quality() === 'original' ? this.originalTooLarge() : !this.processed());
  readonly previewUrl = signal<string | null>(null);
  private operation: AbortController | null = null;

  constructor() {
    effect((onCleanup) => {
      this.source();
      onCleanup(() => {
        this.cancel();
        this.clearResult();
      });
    });
  }

  chooseQuality(event: Event): void {
    this.quality.set((event.target as HTMLSelectElement).value as VideoQuality | 'original');
    this.clearResult();
  }

  async optimize(): Promise<void> {
    const quality = this.quality();
    if (quality === 'original' || this.running()) return;
    this.clearResult();
    const source = this.source();
    const operation = new AbortController();
    this.operation = operation;
    this.progress.set(0);
    try {
      const { optimizeCampaignVideo } = await import('./campaign-video-optimization');
      operation.signal.throwIfAborted();
      const result = await optimizeCampaignVideo(source, quality, operation.signal, (fraction) => {
        if (this.operation === operation) this.progress.set(Math.floor(fraction * 100));
      });
      if (this.operation !== operation || this.source() !== source) return;
      if (result.file.size >= result.originalBytes && !this.originalTooLarge()) {
        this.processed.set({ ...result, file: null });
      } else if (result.file.size > MAX_CAMPAIGN_UPLOAD) {
        this.error.set('O vídeo ainda passa de 25 MB. Escolha um perfil mais leve ou um vídeo mais curto.');
      } else {
        this.previewUrl.set(URL.createObjectURL(result.file));
        this.processed.set(result);
      }
    } catch (error: unknown) {
      if (this.operation === operation) {
        this.error.set(error instanceof Error && error.name === 'CampaignVideoError'
          ? error.message : 'Não foi possível otimizar este vídeo. Escolha outro arquivo ou mantenha o original.');
      }
    } finally {
      if (this.operation === operation) {
        this.operation = null;
        this.progress.set(null);
      }
    }
  }

  cancel(): void {
    this.operation?.abort();
    this.operation = null;
    this.progress.set(null);
  }

  size(bytes: number): string {
    return new Intl.NumberFormat(this.localization.locale(), {
      style: 'unit', unit: 'megabyte', unitDisplay: 'short', maximumFractionDigits: 2
    }).format(bytes / 1_000_000);
  }

  private clearResult(): void {
    const url = this.previewUrl();
    if (url) URL.revokeObjectURL(url);
    this.previewUrl.set(null);
    this.processed.set(null);
    this.error.set('');
  }
}
