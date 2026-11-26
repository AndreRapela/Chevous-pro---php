import { BlobSource, BufferTarget, Conversion, Input, MP4, Mp4OutputFormat, Output, WEBM, WebMOutputFormat, canEncodeVideo } from 'mediabunny';
import type { VideoCodec } from 'mediabunny';
import { MAX_CAMPAIGN_VIDEO_INPUT } from './campaign-media-limits';
import { validateVideoDuration } from './campaign-video-duration';

const presets = {
  '480p': { width: 854, height: 480, bitrate: 650_000 },
  '720p': { width: 1280, height: 720, bitrate: 1_350_000 },
  '1080p': { width: 1920, height: 1080, bitrate: 2_800_000 }
};

export type VideoQuality = keyof typeof presets;

export interface OptimizedCampaignVideo {
  file: File;
  originalBytes: number;
  width: number;
  height: number;
}

export class CampaignVideoError extends Error {
  override readonly name = 'CampaignVideoError';
}

export async function optimizeCampaignVideo(
  source: File | string,
  quality: VideoQuality,
  signal: AbortSignal,
  onProgress: (progress: number) => void
): Promise<OptimizedCampaignVideo> {
  if (typeof VideoEncoder === 'undefined' || typeof VideoDecoder === 'undefined') {
    throw new CampaignVideoError('Este navegador não oferece suporte à otimização de vídeo.');
  }
  const original = typeof source === 'string' ? await readOnlineVideo(source, signal) : source;
  const input = new Input({ formats: [MP4, WEBM], source: new BlobSource(original) });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track || !(await track.canDecode())) {
      throw new CampaignVideoError('Este vídeo não pode ser convertido neste navegador.');
    }
    try {
      validateVideoDuration(await input.computeDuration());
    } catch (failure) {
      throw new CampaignVideoError(failure instanceof Error ? failure.message : 'Não foi possível confirmar a duração do vídeo.');
    }

    const [sourceWidth, sourceHeight, transparent] = await Promise.all([
      track.getDisplayWidth(), track.getDisplayHeight(), track.canBeTransparent()
    ]);
    const preset = presets[quality];
    const portrait = sourceHeight > sourceWidth;
    const scale = Math.min(1, (portrait ? preset.height : preset.width) / sourceWidth,
      (portrait ? preset.width : preset.height) / sourceHeight);
    const width = Math.max(2, Math.floor(sourceWidth * scale / 2) * 2);
    const height = Math.max(2, Math.floor(sourceHeight * scale / 2) * 2);
    const bitrate = preset.bitrate;
    const codecs: VideoCodec[] = transparent ? ['vp9'] : ['avc', 'vp9', 'vp8'];
    const encoding = { width, height, bitrate };
    let codec: VideoCodec | undefined;
    for (const candidate of codecs) {
      if (await canEncodeVideo(candidate, encoding)) {
        codec = candidate;
        break;
      }
    }
    if (!codec) throw new CampaignVideoError('Este navegador não oferece suporte à otimização de vídeo.');

    const mp4 = codec === 'avc';
    const target = new BufferTarget();
    const format = mp4 ? new Mp4OutputFormat({ fastStart: 'in-memory' }) : new WebMOutputFormat();
    const conversion = await Conversion.init({
      input,
      output: new Output({ target, format }),
      tracks: 'primary',
      video: { ...encoding, codec, fit: 'contain', alpha: transparent ? 'keep' : 'discard', forceTranscode: true },
      audio: { discard: true },
      tags: {},
      showWarnings: false
    });
    if (!conversion.isValid) throw new CampaignVideoError('Este vídeo não pode ser convertido neste navegador.');
    signal.throwIfAborted();

    conversion.onProgress = onProgress;
    const cancel = () => { void conversion.cancel().catch(() => undefined); };
    signal.addEventListener('abort', cancel, { once: true });
    try {
      await conversion.execute();
    } finally {
      signal.removeEventListener('abort', cancel);
    }
    signal.throwIfAborted();
    if (!target.buffer?.byteLength) throw new CampaignVideoError('A otimização não gerou um vídeo utilizável.');

    const stem = original.name.replace(/\.[^.]+$/, '') || 'campanha';
    const file = new File([target.buffer], `${stem}-${quality}.${mp4 ? 'mp4' : 'webm'}`, { type: mp4 ? 'video/mp4' : 'video/webm' });
    return { file, originalBytes: original.size, width, height };
  } finally {
    input.dispose();
  }
}

async function readOnlineVideo(source: string, signal: AbortSignal): Promise<File> {
  const unavailable = 'Não foi possível ler o vídeo pelo endereço. Baixe o vídeo e escolha o arquivo no computador.';
  let response: Response;
  let url: URL;
  try {
    url = new URL(source, document.baseURI);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error();
    response = await fetch(url, { credentials: 'omit', signal });
  } catch {
    throw new CampaignVideoError(unavailable);
  }
  if (!response.ok || !response.body) throw new CampaignVideoError(unavailable);

  const reader = response.body.getReader();
  const chunks: BlobPart[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_CAMPAIGN_VIDEO_INPUT) throw new CampaignVideoError('Escolha um vídeo de até 100 MB para otimizar.');
      chunks.push(value);
    }
  } finally {
    void reader.cancel().catch(() => undefined);
  }
  return new File(chunks, url.pathname.split('/').at(-1) || 'campanha');
}
