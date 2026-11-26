import { PROMOTION_SLOT_MS } from '../../../../shared/utils/promotion-rotation.util';

const UNKNOWN_DURATION = 'Não foi possível confirmar a duração do vídeo. Use um arquivo MP4 ou WebM ou um link direto.';

export function validateVideoDuration(seconds: number): number {
  const milliseconds = Math.ceil(seconds * 1000);
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) throw new Error(UNKNOWN_DURATION);
  if (milliseconds > PROMOTION_SLOT_MS) throw new Error('O vídeo da campanha deve ter no máximo 1 minuto.');
  return milliseconds;
}

export async function campaignVideoDuration(source: File | string): Promise<number> {
  if (typeof source === 'string') return validateVideoDuration(await onlineDuration(source));

  const { BlobSource, Input, MP4, WEBM } = await import('mediabunny');
  const input = new Input({ formats: [MP4, WEBM], source: new BlobSource(source) });
  try {
    if (!await input.getPrimaryVideoTrack().catch(() => null)) throw new Error(UNKNOWN_DURATION);
    const seconds = await input.computeDuration().catch(() => NaN);
    return validateVideoDuration(seconds);
  } finally {
    input.dispose();
  }
}

async function onlineDuration(source: string): Promise<number> {
  const url = new URL(source, document.baseURI);
  if (url.protocol !== 'https:' && url.origin !== window.location.origin) throw new Error(UNKNOWN_DURATION);
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const timeout = window.setTimeout(() => finish(NaN), 12_000);
    const finish = (seconds: number) => {
      window.clearTimeout(timeout);
      video.onloadedmetadata = null;
      video.onerror = null;
      video.removeAttribute('src');
      video.load();
      if (Number.isFinite(seconds)) resolve(seconds);
      else reject(new Error(UNKNOWN_DURATION));
    };
    video.preload = 'metadata';
    video.onloadedmetadata = () => finish(video.videoWidth > 0 ? video.duration : NaN);
    video.onerror = () => finish(NaN);
    video.src = url.href;
  });
}
