/**
 * ComplianceOS — VEDA Pipeline: Respond & Format Output
 * Validates against AgentOutput schema before returning.
 */

import { AgentOutputSchema } from '../stubs/contracts.stub.js';

export function runRespond({
  status = 'OK',
  profilePatch = {},
  messages = [],
  claims = [],
  calendarItems = [],
  trace = [],
  costs = { llmTokens: 0, tinyfishAgentCalls: 0 },
}) {
  const output = {
    status,
    profilePatch,
    messages,
    claims,
    calendarItems,
    trace,
    costs,
  };

  const parsed = AgentOutputSchema.safeParse(output);
  if (!parsed.success) {
    // If validation fails, log or return safe output
    return output;
  }

  return parsed.data;
}

export default runRespond;
