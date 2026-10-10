import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SchemeRecordSchema, type SchemeRecord } from './schemas.ts';
import { hasSchemeVerificationMetadata, isOfficialSchemeSourceUrl } from '../../channels/schemeVerification.js';

const schemesDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), 'schemes');

export async function loadSchemes(): Promise<SchemeRecord[]> {
  const files = (await readdir(schemesDirectory))
    .filter((file) => file.endsWith('.json'))
    .sort();
  const schemes: SchemeRecord[] = [];

  for (const file of files) {
    const content = await readFile(path.join(schemesDirectory, file), 'utf8');
    const rawScheme = JSON.parse(content) as Record<string, unknown>;
    const sourceUrl = typeof rawScheme.sourceUrl === 'string' ? rawScheme.sourceUrl : '';
    if (
      !hasSchemeVerificationMetadata(rawScheme)
      || !isOfficialSchemeSourceUrl(sourceUrl)
    ) continue;
    const scheme = SchemeRecordSchema.parse(rawScheme);

    if (scheme.status !== 'closed') {
      schemes.push(scheme);
    }
  }

  return schemes;
}