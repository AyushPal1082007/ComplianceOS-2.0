import config from '../config.js';
import { uploadBuffer } from '../services/cloudinaryService.js';
import { transcribeHindi } from '../services/sarvamService.js';
import { downloadWhatsAppMedia } from '../services/whatsappService.js';

const MAX_MEDIA_BYTES = 20 * 1024 * 1024;

function requireMediaBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new TypeError('WhatsApp media downloader must return a non-empty Buffer');
  }
  if (buffer.length > MAX_MEDIA_BYTES) throw new RangeError('WhatsApp media exceeds the 20 MB limit');
  return buffer;
}

export async function prepareWhatsAppMediaEvent(event, dependencies = {}) {
  if (event.type === 'VOICE') {
    const mediaId = event.audio?.mediaId;
    if (!mediaId) throw new TypeError('WhatsApp audio event is missing its provider media id');
    const buffer = requireMediaBuffer(await (dependencies.downloadMedia || downloadWhatsAppMedia)(mediaId));
    const transcribe = dependencies.transcribe || (async (bytes, mime) => {
      if (!config.sarvam.apiKey) throw new Error('Sarvam speech recognition is not configured');
      return transcribeHindi(bytes, mime);
    });
    const result = await transcribe(buffer, event.audio.mime);
    if (result?.source === 'sarvam_demo_fallback') {
      throw new Error('Demo speech transcripts are not accepted for WhatsApp media');
    }
    const text = String(result?.transcript || '').trim();
    if (!text) throw new Error('Sarvam did not return a transcript for WhatsApp audio');
    const { audio, ...inbound } = event;
    return { ...inbound, type: 'TEXT', text };
  }

  if (event.type === 'DOCUMENT') {
    const mediaId = event.document?.providerMediaId;
    if (!mediaId) throw new TypeError('WhatsApp document event is missing its provider media id');
    const buffer = requireMediaBuffer(await (dependencies.downloadMedia || downloadWhatsAppMedia)(mediaId));
    const upload = await (dependencies.uploadDocument || uploadBuffer)(buffer, {
      folder: 'complianceos/whatsapp',
      resource_type: 'auto',
      mimeType: event.document.mime,
    });
    if (upload?.mockDataUri) {
      throw new Error('Cloudinary-backed storage is required for WhatsApp document processing');
    }
    let url;
    try {
      url = new URL(upload?.secure_url);
    } catch {
      throw new Error('WhatsApp document upload did not return a valid Cloudinary URL');
    }
    if (url.protocol !== 'https:') throw new Error('WhatsApp document upload URL must use HTTPS');
    const document = { ...event.document, url: url.toString() };
    delete document.providerMediaId;
    return { ...event, document };
  }

  return event;
}

export default { prepareWhatsAppMediaEvent };
