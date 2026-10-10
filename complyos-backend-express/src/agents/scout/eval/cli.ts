import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { z } from 'zod';
import { loadSchemes } from '../loadSchemes.ts';
import { BusinessProfileSchema, SchemeRecordSchema, type EvalLabelEntry } from '../schemas.ts';
import { formatEvalReport, runEval } from './runEval.ts';

const dataDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');

const LabelsFileSchema = z.object({
  'TODO(owner)': z.string().optional(),
  labels: z.array(z.object({
    profileId: z.string().min(1),
    schemeId: z.string().min(1),
    label: z.enum(['likely_eligible', 'possible', 'not_eligible']).nullable(),
  }).strict()),
}).passthrough();

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
}

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

async function main(): Promise<void> {
  const schemeSource = argument('schemes') ?? 'fixtures';
  if (schemeSource !== 'fixtures' && schemeSource !== 'real') {
    throw new Error('--schemes must be either fixtures or real.');
  }

  const profilePath = path.resolve(argument('profiles') ?? path.join(dataDirectory, 'profiles.json'));
  const labelsPath = path.resolve(argument('labels') ?? path.join(dataDirectory, 'labels.json'));
  const profiles = z.array(BusinessProfileSchema).parse(await readJson(profilePath));
  const labelsFile = LabelsFileSchema.parse(await readJson(labelsPath));
  const labels: EvalLabelEntry[] = labelsFile.labels;

  const rawSchemes = schemeSource === 'fixtures'
    ? await readJson(path.join(dataDirectory, 'test-schemes.json'))
    : await loadSchemes();
  const schemes = z.array(SchemeRecordSchema).parse(rawSchemes);
  const report = runEval(profiles, schemes, labels);

  console.log(formatEvalReport(report, schemeSource));
  if (report.labelledPairs === 0) process.exitCode = 1;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : undefined;
if (invokedPath && pathToFileURL(invokedPath).href === import.meta.url) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown evaluation error.';
    console.error(`SCOUT evaluation failed: ${message}`);
    process.exitCode = 1;
  });
}