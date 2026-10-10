/**
 * ARIA Decision Engine - Akinator-style adaptive questioning
 * 
 * Principles:
 * 1. Maximize information gain (entropy reduction) per question
 * 2. Skip branches that become irrelevant based on previous answers
 * 3. Build a dynamic decision tree based on user responses
 */

import { QUESTIONS } from '../questionBank/loader.js';
import { getProfileField, completeness } from './completeness.js';
import { CORE_FIELDS } from '../config.js';

/**
 * Calculate entropy (uncertainty) for a probability distribution
 * Lower entropy = more certain
 */
function entropy(probabilities) {
  return -probabilities
    .filter(p => p > 0)
    .reduce((sum, p) => sum + p * Math.log2(p), 0);
}

/**
 * Calculate information gain from asking a question
 */
function calculateInformationGain(question, profile, session) {
  const currentField = getProfileField(profile, question.field);
  
  if (!['EMPTY', 'NEEDS_CONFIRMATION'].includes(currentField.status)) return 0;
  if (session.skippedIds?.includes(question.id)) return 0;
  
  if (question.askOnlyIf) {
    const dependentValue = getProfileField(profile, question.askOnlyIf.field)?.value;
    if (dependentValue !== question.askOnlyIf.eq) return 0;
  }
  
  const options = question.options || [];
  const answerOptions = options.filter(opt => opt.value !== null);
  if (answerOptions.length === 0) return 0;
  
  const priorProbabilities = answerOptions.map(() => 1 / answerOptions.length);
  const baseGain = entropy(priorProbabilities);
  const isCore = CORE_FIELDS.includes(question.field);
  
  return baseGain * (isCore ? 1.5 : 1.0) * (question.sensitivity > 0 ? 0.8 : 1.0);
}

/**
 * Get the discriminating power of a question
 */
function getDiscriminatingPower(question) {
  const options = question.options || [];
  const answerCount = options.filter(o => o.value !== null).length;
  
  if (answerCount <= 2) return 0.5;
  if (answerCount <= 5) return 0.8;
  if (answerCount <= 10) return 1.0;
  return 0.9;
}

/**
 * Check if a question is still relevant
 */
function isQuestionRelevant(question, profile, session) {
  const current = getProfileField(profile, question.field);
  if (current.status === 'CONFIRMED' || current.status === 'VERIFIED') return false;
  if (session.skippedIds?.includes(question.id)) return false;
  
  if (question.askOnlyIf) {
    const dependentValue = getProfileField(profile, question.askOnlyIf.field)?.value;
    if (dependentValue !== question.askOnlyIf.eq) return false;
  }
  
  if (question.tier === 'extended' && session.phase === 'asking') return false;
  
  if (question.sensitivity === 2) {
    const otherRemaining = QUESTIONS.some(
      other => other.id !== question.id && 
      other.sensitivity < 2 && 
      getProfileField(profile, other.field).status === 'EMPTY'
    );
    if (otherRemaining) return false;
  }
  
  return true;
}

/**
 * Build decision path to eliminate irrelevant questions
 */
function buildDecisionPath(profile, session) {
  const irrelevantIds = [];
  
  const profileState = {
    sector: getProfileField(profile, 'sector')?.value,
    gstRegistered: getProfileField(profile, 'gstRegistered')?.value,
    turnoverBand: getProfileField(profile, 'turnoverBand')?.value,
  };
  
  // Rule: If GST not registered, skip GST frequency question
  if (profileState.gstRegistered === false) {
    const gstFreqQuestion = QUESTIONS.find(q => q.field === 'gstFilingFrequency');
    if (gstFreqQuestion) irrelevantIds.push(gstFreqQuestion.id);
  }
  
  // Rule: If turnover is very low, some compliance questions may be irrelevant
  if (profileState.turnoverBand === 'lt3l') {
    // Micro enterprises have simplified compliance
  }
  
  return irrelevantIds;
}

/**
 * Main selection function - Akinator-style adaptive questioning
 */
export function selectNext(profile, session, options = {}) {
  const phase = options.phase || session.phase;
  const irrelevantIds = buildDecisionPath(profile, session);
  
  const relevantQuestions = QUESTIONS.filter(q => 
    isQuestionRelevant(q, profile, session) && 
    !irrelevantIds.includes(q.id)
  );
  
  if (relevantQuestions.length === 0) return null;
  
  const scored = relevantQuestions.map(question => {
    const infoGain = calculateInformationGain(question, profile, session);
    const discPower = getDiscriminatingPower(question);
    const isCore = CORE_FIELDS.includes(question.field);
    
    const recentAsked = session.askedQuestionIds?.slice(-3) || [];
    const recencyPenalty = recentAsked.includes(question.id) ? 0.7 : 1.0;
    
    const schemeGain = typeof options.schemeGain === 'function' 
      ? Number(options.schemeGain(question.field)) || 1 
      : 1;
    
    const score = infoGain * discPower * (isCore ? 1.3 : 1.0) * recencyPenalty * schemeGain;
    
    return { question, score, infoGain, discPower, isCore };
  });
  
  scored.sort((a, b) => b.score - a.score);
  
  if (process.env.DEBUG_ARIA === 'true') {
    console.log('[ARIA Decision Engine]', {
      phase,
      candidates: scored.length,
      topChoice: scored[0]?.question?.id,
      topScore: scored[0]?.score?.toFixed(4),
    });
  }
  
  return scored[0]?.question || null;
}

/**
 * Get expected information gain from remaining questions
 */
export function getExpectedRemainingInformation(profile, session) {
  const relevant = QUESTIONS.filter(q => isQuestionRelevant(q, profile, session));
  return relevant.reduce((sum, q) => sum + (calculateInformationGain(q, profile, session) || 0), 0);
}

/**
 * Check if profile is sufficient for recommendations
 */
export function isProfileSufficient(profile, session, threshold = 0.8) {
  const completion = completeness(profile);
  return completion.core >= threshold;
}

/**
 * Suggest optimal path within constraints
 */
export function suggestOptimalPath(profile, session, maxQuestions = 5) {
  const relevant = QUESTIONS.filter(q => isQuestionRelevant(q, profile, session));
  
  const scored = relevant.map(q => ({
    question: q,
    score: calculateInformationGain(q, profile, session) * getDiscriminatingPower(q)
  })).sort((a, b) => b.score - a.score);
  
  return scored.slice(0, maxQuestions).map(s => s.question);
}