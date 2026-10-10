'use strict';
/**
 * ComplianceOS — SCOUT Agent (Scheme Compatibility and Opportunity Underwriting Tool)
 * Deterministic rules engine over verified scheme DB
 * LLM only generates explanation in Hindi (never generates eligibility decisions)
 * Per PDF Section 7: "Precision + recall vs hand labels on synthetic profiles"
 */
import { createRequire } from 'module';
import Groq from 'groq-sdk';
import config from '../config.js';
import logger from '../logger.js';
import { isVerifiedScheme } from '../channels/schemeVerification.js';

const require = createRequire(import.meta.url);
const schemesData = require('../data/schemes.json').filter(isVerifiedScheme);

const groq = new Groq({ apiKey: config.groq.apiKey });

// ── Deterministic Matching Engine ─────────────────────────────────────────────

/**
 * Evaluate a single criterion against business profile
 * Returns: { met: boolean, info: string, confident: boolean }
 */
function evaluateCriterion(key, criterionValue, profile) {
  switch (key) {
    case 'turnover_max_crore': {
      if (profile.annualTurnover == null) return { met: null, info: 'turnover unknown', confident: false };
      const turnoverCrore = profile.annualTurnover / 100;
      return { met: turnoverCrore <= criterionValue, info: `turnover ≤ ₹${criterionValue} Cr`, confident: true };
    }

    case 'turnover_min_crore': {
      if (profile.annualTurnover == null) return { met: null, info: 'turnover unknown', confident: false };
      const turnoverCrore = profile.annualTurnover / 100;
      return { met: turnoverCrore >= criterionValue, info: `turnover ≥ ₹${criterionValue} Cr`, confident: true };
    }

    case 'business_type': {
      if (!profile.businessType) return { met: null, info: 'business type unknown', confident: false };
      return {
        met: criterionValue.includes(profile.businessType.toLowerCase()),
        info: `business type: ${criterionValue.join(' or ')}`,
        confident: true,
      };
    }

    case 'state': {
      if (!profile.state) return { met: null, info: 'state unknown', confident: false };
      const stateMatch = criterionValue.some(s =>
        profile.state.toLowerCase().includes(s.toLowerCase())
      );
      return { met: stateMatch, info: `state: ${criterionValue.join(' or ')}`, confident: true };
    }

    case 'is_women_led': {
      if (profile.isWomenLed == null) return { met: null, info: 'women-led status unknown', confident: false };
      return { met: profile.isWomenLed === criterionValue, info: 'women-led business', confident: true };
    }

    case 'udyam_required': {
      if (!criterionValue) return { met: true, info: 'Udyam not required', confident: true };
      return {
        met: !!profile.udyamNumber,
        info: 'Udyam registration required',
        confident: !!profile.udyamNumber,
      };
    }

    case 'gstin_required': {
      if (!criterionValue) return { met: true, info: 'GSTIN not required', confident: true };
      return {
        met: !!profile.gstin,
        info: 'GSTIN required',
        confident: !!profile.gstin,
      };
    }

    case 'pan_required': {
      if (!criterionValue) return { met: true, info: 'PAN not required', confident: true };
      return {
        met: !!profile.pan,
        info: 'PAN required',
        confident: true,
      };
    }

    case 'age_min': {
      // Cannot verify age from profile without date of birth — mark as possible
      return { met: null, info: `minimum age ${criterionValue} required`, confident: false };
    }

    case 'age_max': {
      return { met: null, info: `maximum age ${criterionValue}`, confident: false };
    }

    case 'employee_count_min': {
      if (profile.employeeCount == null) return { met: null, info: 'employee count unknown', confident: false };
      return {
        met: profile.employeeCount >= criterionValue,
        info: `min ${criterionValue} employees`,
        confident: true,
      };
    }

    case 'esic_registered': {
      // Cannot determine from profile — mark as possible
      return { met: null, info: 'ESIC registration needed', confident: false };
    }

    case 'has_pending_payments': {
      return { met: null, info: 'pending payments status unknown', confident: false };
    }

    case 'is_new_business':
    case 'new_or_expanding':
    case 'existing_business': {
      return { met: null, info: 'business stage — check application', confident: false };
    }

    default:
      return { met: null, info: `criterion '${key}' not evaluated`, confident: false };
  }
}

/**
 * Match business profile against a single scheme
 * Returns structured match result with criteria breakdown
 */
function matchScheme(scheme, profile) {
  const criteria = scheme.eligibilityCriteria || {};
  const criteriaKeys = Object.keys(criteria);
  
  const results = [];
  let metCount = 0;
  let notMetCount = 0;
  let unknownCount = 0;
  const missingInfo = [];

  for (const key of criteriaKeys) {
    const result = evaluateCriterion(key, criteria[key], profile);
    results.push({ criterion: key, ...result });

    if (result.met === true) {
      metCount++;
    } else if (result.met === false) {
      notMetCount++;
    } else {
      unknownCount++;
      missingInfo.push(result.info);
    }
  }

  // A scheme is disqualified if any criterion is definitively NOT met
  if (notMetCount > 0) {
    return {
      schemeId: scheme.id,
      eligible: false,
      matchScore: 0,
      criteriaMetCount: metCount,
      criteriaTotalCount: criteriaKeys.length,
      missingInfo,
      criteriaResults: results,
    };
  }

  // Score: (met + 0.5*unknown) / total
  const score = criteriaKeys.length > 0
    ? (metCount + unknownCount * 0.5) / criteriaKeys.length
    : 0.5;

  return {
    schemeId: scheme.id,
    eligible: score > 0,
    matchScore: Math.round(score * 100) / 100,
    criteriaMetCount: metCount,
    criteriaTotalCount: criteriaKeys.length,
    missingInfo,
    criteriaResults: results,
    isPossible: unknownCount > 0,
  };
}

// ── Hindi Explanation via Groq ────────────────────────────────────────────────

async function generateHindiExplanation(scheme, matchResult, profile) {
  const prompt = `You are SCOUT, a Hindi-language scheme advisor for Indian MSMEs.

Scheme: ${scheme.name}
Business profile: ${profile.businessName || 'MSME'}, ${profile.businessType}, ${profile.state}, turnover ₹${profile.annualTurnover || '?'} lakhs
Match score: ${Math.round(matchResult.matchScore * 100)}%
Criteria met: ${matchResult.criteriaMetCount} of ${matchResult.criteriaTotalCount}
Missing info: ${matchResult.missingInfo.join(', ') || 'none'}
Max benefit: ${scheme.maxBenefit}

Write a 2-3 sentence explanation in Hindi/Hinglish:
1. Why this scheme matches (or partially matches)
2. What to check/provide if there's missing info
3. Main benefit they can get

Keep it simple — write like explaining to a small shop owner.`;

  try {
    const response = await groq.chat.completions.create({
      model: config.groq.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 200,
    });
    return response.choices[0]?.message?.content || '';
  } catch (err) {
    logger.warn('SCOUT Hindi explanation failed', { error: err.message });
    return `यह योजना आपके लिए उपयुक्त हो सकती है। अधिक जानकारी के लिए ${scheme.officialUrl} पर जाएं।`;
  }
}

// ── Main SCOUT function ───────────────────────────────────────────────────────

async function scoutSchemes(profile, options = {}) {
  const { includeExplanations = true, limit = 5 } = options;
  const traceSteps = [];

  traceSteps.push({ agent: 'SCOUT', step: 'rules_engine', status: 'started', schemesEvaluated: schemesData.length });

  // Step 1: Run deterministic rules engine over all schemes
  const allMatches = schemesData
    .filter(s => s.isActive)
    .map(scheme => ({
      scheme,
      match: matchScheme(scheme, profile),
    }))
    .filter(({ match }) => match.eligible)
    .sort((a, b) => b.match.matchScore - a.match.matchScore);

  traceSteps.push({
    agent: 'SCOUT', step: 'rules_engine', status: 'done',
    eligible: allMatches.length,
    topScore: allMatches[0]?.match.matchScore || 0,
  });

  // Step 2: Take top N matches
  const topMatches = allMatches.slice(0, limit);

  // Step 3: Generate Hindi explanations via Groq (only for matches)
  const results = [];
  for (const { scheme, match } of topMatches) {
    let explanationHindi = null;

    if (includeExplanations && config.groq.apiKey) {
      traceSteps.push({ agent: 'SCOUT', step: 'groq_explain', status: 'started', scheme: scheme.id });
      explanationHindi = await generateHindiExplanation(scheme, match, profile);
      traceSteps.push({ agent: 'SCOUT', step: 'groq_explain', status: 'done', scheme: scheme.id });

      // Delay to respect Groq 30 RPM free tier
      await new Promise(r => setTimeout(r, config.groq.rateLimitDelay));
    }

    results.push({
      schemeId: scheme.id,
      name: scheme.name,
      nameHindi: scheme.nameHindi,
      description: scheme.description,
      descriptionHindi: scheme.descriptionHindi,
      schemeType: scheme.schemeType,
      maxBenefit: scheme.maxBenefit,
      matchScore: match.matchScore,
      criteriaMetCount: match.criteriaMetCount,
      criteriaTotalCount: match.criteriaTotalCount,
      matchLabel: `${match.criteriaMetCount} of ${match.criteriaTotalCount} criteria met`,
      isPossible: match.isPossible,
      missingInfo: match.missingInfo,
      explanationHindi,
      officialUrl: scheme.officialUrl,
      // Trust layer: citation required per PDF
      sourceUrl: scheme.sourceUrl,
      retrievedOn: scheme.retrievedOn,
      checkedBy: scheme.checkedBy,
      checklist: scheme.checklist,
      state: scheme.state,
    });
  }

  return {
    totalSchemesEvaluated: schemesData.length,
    eligibleSchemesFound: allMatches.length,
    topMatches: results,
    traceSteps,
    trustLayer: {
      note: 'Scheme eligibility determined by deterministic rules engine, not LLM guesses.',
      citationOnEvery: true,
      disclaimer: 'Verify current eligibility and caps on official portal before applying.',
    },
  };
}

export { scoutSchemes, matchScheme };
export default { scoutSchemes, matchScheme };
