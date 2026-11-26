import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, map, of } from 'rxjs';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';

@Component({
  selector: 'cvp-campaign-poster',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="poster-field">
      <label>Endereço da capa do vídeo
        <input data-cvp-no-localize maxlength="1024" placeholder="https://..." [ngModel]="url()"
          [ngModelOptions]="{ standalone: true }" (ngModelChange)="setUrl($event)">
      </label>
      <input #picker type="file" hidden accept="image/jpeg,image/png,image/webp" (change)="chooseFile(picker)">
      <div class="poster-actions">
        <button type="button" class="btn btn-secondary btn-small" (click)="picker.click()">Escolher capa</button>
        @if (previewUrl()) { <button type="button" class="text-button" (click)="setUrl('')">Remover capa</button> }
      </div>
      @if (file(); as image) { <small data-cvp-no-localize>{{ image.name }}</small> }
      @if (error()) { <small class="field-error" role="alert">{{ error() }}</small> }
    </div>
  `,
  styles: `
    .poster-field { display: grid; gap: .5rem; margin-block: .65rem; }
    .poster-actions { display: flex; flex-wrap: wrap; align-items: center; gap: .65rem; }
  `
})
export class CampaignPosterComponent {
  private readonly marketplace = inject(MarketplaceService);
  readonly savedUrl = input<string | null>(null);
  readonly url = linkedSignal(() => this.savedUrl() ?? '');
  readonly file = signal<File | null>(null);
  readonly error = signal('');
  private readonly objectUrl = signal<string | null>(null);
  readonly previewUrl = computed(() => this.objectUrl() ?? (this.url().trim() || null));

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clearFile());
  }

  chooseFile(picker: HTMLInputElement): void {
    const file = picker.files?.[0];
    picker.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 25 * 1024 * 1024) {
      this.error.set('Escolha uma capa JPG, PNG ou WebP de até 25 MB.');
      return;
    }
    this.clearFile();
    this.error.set('');
    this.file.set(file);
    this.objectUrl.set(URL.createObjectURL(file));
  }

  setUrl(url: string): void {
    this.clearFile();
    this.error.set('');
    this.url.set(url);
  }

  save(): Observable<string | null> {
    const file = this.file();
    if (!file) return of(this.url().trim() || null);
    return this.marketplace.adminUploadPromotionMedia(file).pipe(map((media) => {
      this.setUrl(media.url);
      return media.url;
    }));
  }

  private clearFile(): void {
    const url = this.objectUrl();
    if (url) URL.revokeObjectURL(url);
    this.objectUrl.set(null);
    this.file.set(null);
  }
}
