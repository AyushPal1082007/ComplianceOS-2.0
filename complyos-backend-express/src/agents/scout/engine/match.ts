import {
  type BusinessProfile,
  type Criterion,
  type SchemeMatch,
  SchemeMatchSchema,
  type SchemeRecord,
} from '../schemas.ts';

type KnownStatus = 'VERIFIED' | 'SELF_REPORTED';

function evaluateCriterion(value: unknown, criterion: Criterion): boolean | null {
  if ('eq' in criterion) return Object.is(value, criterion.eq);
  if ('in' in criterion) return criterion.in.some((candidate) => Object.is(value, candidate));
  if ('notIn' in criterion) return !criterion.notIn.some((candidate) => Object.is(value, candidate));
  if ('gte' in criterion) {
    return typeof value === 'number' ? value >= criterion.gte : null;
  }

  return null;
}

function getBasedOn(statuses: Set<KnownStatus>): SchemeMatch['basedOn'] {
  if (statuses.size > 1) return 'mixed';
  if (statuses.has('SELF_REPORTED')) return 'self_reported';
  if (statuses.size === 0) return 'none';

  return 'verified';
}

export function matchSchemes(
  profile: BusinessProfile,
  schemes: SchemeRecord[],
): SchemeMatch[] {
  const matches: SchemeMatch[] = [];

  for (const scheme of schemes) {
    if (scheme.status === 'closed') continue;

    let metCount = 0;
    let excluded = false;
    const missingFields = new Set<string>();
    const metStatuses = new Set<KnownStatus>();

    for (const criterion of scheme.criteria) {
      const field = profile[criterion.field];
      if (
        !field || typeof field !== 'object' ||
        field.value === null ||
        (field.status !== 'VERIFIED' && field.status !== 'SELF_REPORTED')
      ) {
        missingFields.add(criterion.field);
        continue;
      }

      const result = evaluateCriterion(field.value, criterion);
      if (result === null) {
        missingFields.add(criterion.field);
      } else if (!result) {
        excluded = true;
        break;
      } else {
        metCount++;
        metStatuses.add(field.status);
      }
    }

    if (excluded) continue;

    const hasNoCriteria = scheme.criteria.length === 0;
    const match = SchemeMatchSchema.parse({
      schemeId: scheme.id,
      name: scheme.name,
      result: !hasNoCriteria && missingFields.size === 0 ? 'likely_eligible' : 'possible',
      metCount,
      totalCount: scheme.criteria.length,
      missingFields: [...missingFields],
      benefit: scheme.benefit,
      applyUrl: scheme.applyUrl,
      sourceUrl: scheme.sourceUrl,
      lastVerified: scheme.retrievedOn,
      stale: scheme.status === 'stale',
      basedOn: getBasedOn(metStatuses),
      priority: scheme.priority,
      ...(hasNoCriteria && {
        note: 'TODO(owner): confirm eligibility criteria before treating this scheme as a match.',
      }),
    });

    matches.push(match);
  }

  return matches.sort((left, right) => {
    const resultOrder = Number(right.result === 'likely_eligible') - Number(left.result === 'likely_eligible');
    if (resultOrder !== 0) return resultOrder;

    const priorityOrder = right.priority - left.priority;
    if (priorityOrder !== 0) return priorityOrder;

    const leftRatio = left.totalCount === 0 ? 0 : left.metCount / left.totalCount;
    const rightRatio = right.totalCount === 0 ? 0 : right.metCount / right.totalCount;
    return rightRatio - leftRatio;
  });
}