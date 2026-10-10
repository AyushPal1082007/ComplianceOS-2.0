import { spawn } from 'node:child_process';
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

export class MediaUnavailable extends Error {
  constructor(message = 'Audio media could not be downloaded') {
    super(message);
    this.name = 'MediaUnavailable';
  }
}

export class MediaConversionError extends Error {
  constructor(message = 'Audio conversion failed') {
    super(message);
    this.name = 'MediaConversionError';
  }
}

export async function fetchAudio(mediaRef, options = {}) {
  if (Buffer.isBuffer(mediaRef)) return mediaRef;
  if (mediaRef?.buffer && Buffer.isBuffer(mediaRef.buffer)) return mediaRef.buffer;
  if (!mediaRef?.url) {
    // TODO(owner): Integrate the verified WhatsApp media-id download contract.
    throw new MediaUnavailable('Provide audio bytes or a verified HTTPS media URL');
  }
  const url = new URL(mediaRef.url);
  if (url.protocol !== 'https:') throw new MediaUnavailable('Audio download URL must use HTTPS');
  const response = await (options.fetchImpl || fetch)(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new MediaUnavailable(`Audio download failed with HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_AUDIO_BYTES) throw new MediaUnavailable('Audio exceeds the 20 MB limit');
  return bytes;
}

export async function toWav16kMono(buffer, mime, options = {}) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new MediaConversionError('Audio input is empty');
  // TODO(verify): Confirm Sarvam's required sample rate/channel/encoding.
  if (mime === 'audio/wav' || mime === 'audio/wave') return buffer;
  return new Promise((resolve, reject) => {
    const child = (options.spawnImpl || spawn)(options.ffmpegPath || 'ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-ar', '16000', '-ac', '1', '-f', 'wav', 'pipe:1',
    ], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const output = [];
    let outputBytes = 0;
    let spawnFailed = false;
    child.stdout.on('data', (chunk) => {
      outputBytes += chunk.length;
      if (outputBytes > MAX_AUDIO_BYTES) {
        child.kill();
        reject(new MediaConversionError('Converted audio exceeds the 20 MB limit'));
        return;
      }
      output.push(chunk);
    });
    child.once('error', (error) => {
      spawnFailed = true;
      reject(new MediaConversionError(error.code === 'ENOENT' ? 'ffmpeg is not installed' : 'Audio conversion failed'));
    });
    child.once('close', (code) => {
      if (!spawnFailed && code === 0) resolve(Buffer.concat(output));
      else if (!spawnFailed) reject(new MediaConversionError('Audio format could not be converted'));
    });
    child.stdin.end(buffer);
  });
}
