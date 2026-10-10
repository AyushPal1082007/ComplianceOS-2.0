import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SchemeRecordSchema, type SchemeRecord } from './schemas.ts';

const schemesDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), 'schemes');

export async function loadSchemes(): Promise<SchemeRecord[]> {
  const files = (await readdir(schemesDirectory))
    .filter((file) => file.endsWith('.json'))
    .sort();
  const schemes: SchemeRecord[] = [];

  for (const file of files) {
    const content = await readFile(path.join(schemesDirectory, file), 'utf8');
    const scheme = SchemeRecordSchema.parse(JSON.parse(content));

    if (scheme.status !== 'closed') {
      schemes.push(scheme);
    }
  }

  return schemes;
}