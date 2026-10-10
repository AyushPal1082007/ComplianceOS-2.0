import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { transcribe } from '../../../services/sarvam.js';
import { recordEval } from './report.js';

const audioDirectory = fileURLToPath(new URL('../fixtures/audio/', import.meta.url));
let files = [];
try { files = (await readdir(audioDirectory)).filter((name) => /\.(ogg|wav|webm|mp3)$/i.test(name)); } catch {}
if (!files.length) {
  console.log('WER skipped: no audio fixtures exist in src/agents/aria/fixtures/audio/.');
  await recordEval('wer', { status: 'skipped', reason: 'No labeled audio fixtures exist.' });
  process.exit(0);
}
let totalWords = 0;
let totalErrors = 0;
for (const file of files) {
  const reference = (await readFile(path.join(audioDirectory, file.replace(/\.(ogg|wav|webm|mp3)$/i, '.txt')), 'utf8')).trim();
  const buffer = await readFile(path.join(audioDirectory, file));
  const actual = (await transcribe(buffer, `audio/${path.extname(file).slice(1)}`, 'hi', { mock: false })).text;
  const refWords = reference.toLowerCase().split(/\s+/);
  const hypWords = actual.toLowerCase().split(/\s+/);
  const distance = levenshtein(refWords, hypWords);
  totalWords += refWords.length;
  totalErrors += distance;
}
const wer = totalWords ? totalErrors / totalWords : 0;
console.table([{ audioFixtures: files.length, wordErrors: totalErrors, referenceWords: totalWords, wer }]);
await recordEval('wer', { status: 'measured', audioFixtures: files.length, wordErrors: totalErrors, referenceWords: totalWords, wer });

function levenshtein(left, right) {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const previous = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (left[i - 1] === right[j - 1] ? 0 : 1));
      diagonal = previous;
    }
  }
  return row[right.length];
}
