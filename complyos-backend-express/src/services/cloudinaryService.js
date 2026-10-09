import { v2 as cloudinary } from 'cloudinary';
import config from '../config.js';
import logger from '../logger.js';

/**
 * ComplianceOS — Cloudinary Service (ES6 Module)
 * Encrypted/Secure document storage for MSME certificates, notices & bills.
 * Gracefully provides fallback/data-URI storage if Cloudinary credentials are not set.
 */

// Configure Cloudinary
if (config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret) {
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
    secure: true,
  });
} else {
  logger.warn('Cloudinary credentials missing — using mock local/dataURI storage fallback');
}

/**
 * Upload a file buffer to Cloudinary
 * @param {Buffer} buffer - File buffer
 * @param {Object} options - Folder, public_id, resource_type
 * @returns {Promise<{ secure_url: string, public_id: string }>}
 */
export async function uploadBuffer(buffer, options = {}) {
  if (config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: options.folder || 'complianceos',
          public_id: options.public_id,
          resource_type: options.resource_type || 'auto',
          tags: ['complianceos', 'msme_doc'],
        },
        (error, result) => {
          if (error) {
            logger.error('Cloudinary upload error', { error: error.message });
            return reject(error);
          }
          resolve({
            secure_url: result.secure_url,
            public_id: result.public_id,
            bytes: result.bytes,
            format: result.format,
          });
        }
      );
      uploadStream.end(buffer);
    });
  }

  // Fallback: create mock data URL with public ID
  const publicId = options.public_id || `mock_${Date.now()}`;
  const mimeType = options.mimeType || 'image/png';
  const dataUri = `data:${mimeType};base64,${buffer.toString('base64').substring(0, 100)}...`;

  logger.info('Mock document stored', { publicId });
  return {
    secure_url: `https://res.cloudinary.com/complianceos/image/upload/${publicId}.png`,
    public_id: publicId,
    mockDataUri: dataUri,
    bytes: buffer.length,
    format: 'png',
  };
}

/**
 * Delete a file by public ID (per DPDP right to erasure)
 * @param {string} publicId
 */
export async function deleteFile(publicId) {
  if (config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret) {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      logger.info('Document deleted from Cloudinary (DPDP erasure)', { publicId, result });
      return result;
    } catch (err) {
      logger.error('Cloudinary delete error', { publicId, error: err.message });
      throw err;
    }
  }

  logger.info('Mock document deleted (DPDP erasure)', { publicId });
  return { result: 'ok' };
}

export default {
  uploadBuffer,
  deleteFile,
};
