import { matchSchemes } from '../engine/match.ts';
import type {
  BusinessProfile,
  EvalClass,
  EvalLabel,
  EvalLabelEntry,
  EvalMetric,
  EvalReport,
  SchemeRecord,
} from '../schemas.ts';

const classes: EvalClass[] = ['likely_eligible', 'possible', 'not_eligible'];

function pairKey(profileId: string, schemeId: string): string {
  return `${profileId}\u0000${schemeId}`;
}

function metric(numerator: number, denominator: number): EvalMetric {
  return {
    numerator,
    denominator,
    value: denominator === 0 ? null : numerator / denominator,
  };
}

function actualClass(
  profile: BusinessProfile,
  scheme: SchemeRecord,
  matches: ReturnType<typeof matchSchemes>,
): EvalClass {
  const match = matches.find((candidate) => candidate.schemeId === scheme.id);
  if (!match) return 'not_eligible';
  return match.result;
}

function unknownWithoutNotMet(profile: BusinessProfile, scheme: SchemeRecord): boolean {
  let hasUnknown = false;

  for (const criterion of scheme.criteria) {
    const field = profile[criterion.field];
    if (
      !field ||
      typeof field !== 'object' ||
      field.value === null ||
      (field.status !== 'VERIFIED' && field.status !== 'SELF_REPORTED')
    ) {
      hasUnknown = true;
      continue;
    }

    let met: boolean | null = null;
    if ('eq' in criterion) met = Object.is(field.value, criterion.eq);
    else if ('in' in criterion) met = criterion.in.some((value) => Object.is(field.value, value));
    else if ('notIn' in criterion) met = !criterion.notIn.some((value) => Object.is(field.value, value));
    else if ('gte' in criterion) met = typeof field.value === 'number' ? field.value >= criterion.gte : null;

    if (met === false) return false;
    if (met === null) hasUnknown = true;
  }

  return hasUnknown;
}

export function runEval(
  profiles: Array<BusinessProfile & { profileId: string }>,
  schemes: SchemeRecord[],
  labels: EvalLabelEntry[],
): EvalReport {
  const labelByPair = new Map(labels.map((entry) => [pairKey(entry.profileId, entry.schemeId), entry.label]));
  const totalPairs = profiles.length * schemes.length;
  let labelledPairs = 0;
  let unlabelledPairs = 0;
  let likelyTruePositive = 0;
  let predictedLikely = 0;
  let labelledLikely = 0;
  let possibleCorrect = 0;
  let possibleDueToUnknownCount = 0;
  let dangerousErrorCount = 0;
  const dangerousErrors: EvalReport['dangerousErrors'] = [];
  const confusionMatrix = Object.fromEntries(
    classes.map((predicted) => [predicted, Object.fromEntries(classes.map((label) => [label, 0]))]),
  ) as EvalReport['confusionMatrix'];

  for (const profile of profiles) {
    const matches = matchSchemes(profile, schemes);
    for (const scheme of schemes) {
      const label = labelByPair.get(pairKey(profile.profileId, scheme.id)) ?? null;
      if (label === null) {
        unlabelledPairs++;
        continue;
      }

      labelledPairs++;
      const predicted = actualClass(profile, scheme, matches);
      confusionMatrix[predicted][label]++;

      if (predicted === 'likely_eligible') predictedLikely++;
      if (label === 'likely_eligible') labelledLikely++;
      if (predicted === 'likely_eligible' && label === 'likely_eligible') likelyTruePositive++;
      if (label === 'possible' && unknownWithoutNotMet(profile, scheme)) {
        possibleDueToUnknownCount++;
        if (predicted === 'possible') possibleCorrect++;
      }
      if (predicted === 'likely_eligible' && label !== 'likely_eligible') {
        dangerousErrorCount++;
        dangerousErrors.push({ profileId: profile.profileId, schemeId: scheme.id, label });
      }
    }
  }

  const heading = labelledPairs === 0
    ? [
        ...(unlabelledPairs > 0 ? [`PARTIAL: ${unlabelledPairs} of ${totalPairs} pairs unlabelled`] : []),
        'NOT MEASURED: no labels provided',
      ].join('\n')
    : unlabelledPairs > 0
      ? `PARTIAL: ${unlabelledPairs} of ${totalPairs} pairs unlabelled`
      : `MEASURED: all ${totalPairs} pairs labelled`;

  return {
    heading,
    totalPairs,
    labelledPairs,
    unlabelledPairs,
    precision: metric(likelyTruePositive, predictedLikely),
    recall: metric(likelyTruePositive, labelledLikely),
    possibleRate: metric(possibleCorrect, possibleDueToUnknownCount),
    dangerousErrorCount,
    dangerousErrors,
    confusionMatrix,
  };
}

function formatMetric(value: EvalMetric): string {
  return value.value === null
    ? 'n/a'
    : `${value.value.toFixed(3)} (${value.numerator}/${value.denominator})`;
}

export function formatEvalReport(report: EvalReport, schemeSource: 'fixtures' | 'real'): string {
  const lines = [
    ...report.heading.split('\n'),
    `Scheme source: ${schemeSource}`,
  ];
  if (schemeSource === 'fixtures') lines.push('Fixture results measure engine logic only.');
  lines.push(
    `Dangerous errors (predicted likely_eligible, labelled possible/not_eligible): ${report.dangerousErrorCount}`,
    `Likely-eligible precision: ${formatMetric(report.precision)}`,
    `Likely-eligible recall: ${formatMetric(report.recall)}`,
    `Possible rate for unknown-field labels: ${formatMetric(report.possibleRate)}`,
    'Confusion matrix (rows=engine, columns=label):',
  );

  for (const predicted of classes) {
    lines.push(`${predicted}: ${classes.map((label) => `${label}=${report.confusionMatrix[predicted][label]}`).join(', ')}`);
  }
  if (report.dangerousErrors.length > 0) {
    lines.push('Dangerous error pairs:');
    for (const error of report.dangerousErrors) {
      lines.push(`${error.profileId} / ${error.schemeId}: predicted likely_eligible, label ${error.label}`);
    }
  }

  return lines.join('\n');
}