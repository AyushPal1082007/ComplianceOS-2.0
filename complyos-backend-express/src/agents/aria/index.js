import { AgentInputSchema, AgentOutputSchema } from '../../contracts/aria.js';
import { runTurn } from './engine/runTurn.js';
import { runMock } from './mock.js';

function failedOutput(input, message) {
  const runId = input?.runId || `aria_${Date.now()}`;
  const language = input?.locale || 'hinglish';
  const text = language === 'en' ? 'A technical issue occurred. Please try again shortly.'
    : language === 'hi' ? 'अभी तकनीकी दिक्कत है। कृपया थोड़ी देर बाद फिर कोशिश करें।'
      : 'Abhi technical dikkat hai. Thodi der baad phir try karein.';
  return AgentOutputSchema.parse({
    status: 'DEGRADED', profilePatch: {}, messages: [{ type: 'text', text }], claims: [],
    trace: [{ runId, agent: 'ARIA', node: 'input', startedAt: new Date().toISOString(), durationMs: 0, status: 'error', error: message }],
    costs: { llmTokens: 0 }, session: input?.session,
  });
}

/** Run ARIA for one user turn. ARIA_REAL must be exactly "true" to enable live extraction. */
export async function run(input = {}, options = {}) {
  const candidate = {
    ...input,
    runId: input.runId || `aria_${Date.now()}`,
    userId: input.userId || 'user_default',
    event: input.event || { type: 'START' },
    profile: input.profile || {},
    locale: input.locale || input.profile?.preferredLanguage || 'hinglish',
  };
  const parsed = AgentInputSchema.safeParse(candidate);
  if (!parsed.success) return failedOutput(candidate, 'Invalid ARIA AgentInput');

  const executionOptions = { ...options, agentInput: parsed.data };
  const output = process.env.ARIA_REAL === 'true' && !options.mock
    ? await runTurn(parsed.data, executionOptions)
    : await runMock(parsed.data, executionOptions);
  return AgentOutputSchema.parse(output);
}

export { AgentInputSchema, AgentOutputSchema, runTurn };
export default { run };
