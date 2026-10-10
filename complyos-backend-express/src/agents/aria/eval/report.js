import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const resultsFile = fileURLToPath(new URL('./results.json', import.meta.url));

export async function recordEval(name, result) {
  let allResults = {};
  try { allResults = JSON.parse(await readFile(resultsFile, 'utf8')); } catch {}
  delete allResults.summary;
  delete allResults.results;
  allResults[name] = { measuredAt: new Date().toISOString(), ...result };
  await writeFile(resultsFile, `${JSON.stringify(allResults, null, 2)}\n`);
}
