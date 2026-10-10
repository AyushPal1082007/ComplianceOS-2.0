/**
 * ComplianceOS — VEDA Subgraph State Definition
 * Uses LangGraph Annotation.Root
 */

import { Annotation } from '@langchain/langgraph';

export const VedaState = Annotation.Root({
  // Input fields
  runId: Annotation({ default: () => '' }),
  userId: Annotation({ default: () => '' }),
  event: Annotation({ default: () => ({}) }),
  profile: Annotation({ default: () => ({}) }),
  locale: Annotation({ default: () => 'hinglish' }),

  // Document fields
  docId: Annotation({ default: () => '' }),
  url: Annotation({ default: () => '' }),
  mime: Annotation({ default: () => '' }),
  ocrText: Annotation({ default: () => '' }),
  docType: Annotation({ default: () => '' }),

  // Extraction & Trust fields
  extractedFields: Annotation({ default: () => ({}) }),
  validatorResults: Annotation({ default: () => ({}) }),
  gatedFields: Annotation({ default: () => ({}) }),

  // Confirmations
  pendingConfirmations: Annotation({ default: () => [] }),
  resolvedConfirmations: Annotation({
    reducer: (prev, next) => [...(prev || []), ...(next || [])],
    default: () => [],
  }),

  // Result outputs
  profilePatch: Annotation({ default: () => ({}) }),
  calendarItems: Annotation({ default: () => [] }),
  claims: Annotation({ default: () => [] }),
  messages: Annotation({
    reducer: (prev, next) => [...(prev || []), ...(next || [])],
    default: () => [],
  }),
  penalty: Annotation({ default: () => null }),
  healthScore: Annotation({ default: () => 100 }),

  // Trace & telemetry
  trace: Annotation({
    reducer: (prev, next) => {
      const items = Array.isArray(next) ? next : (next ? [next] : []);
      return [...(prev || []), ...items];
    },
    default: () => [],
  }),
  costs: Annotation({
    reducer: (prev, next) => ({
      llmTokens: ((prev && prev.llmTokens) || 0) + ((next && next.llmTokens) || 0),
      tinyfishAgentCalls: ((prev && prev.tinyfishAgentCalls) || 0) + ((next && next.tinyfishAgentCalls) || 0),
    }),
    default: () => ({ llmTokens: 0, tinyfishAgentCalls: 0 }),
  }),
  status: Annotation({
    reducer: (prev, next) => next || prev || 'OK',
    default: () => 'OK',
  }),
});

export default VedaState;
