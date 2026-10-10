import { buildMessages } from './engine/buildMessages.ts';
import { explainMatch } from './engine/explain.ts';
import { matchSchemes } from './engine/match.ts';
import { rankMissingFields } from './engine/missingFields.ts';
import { buildTeaser, CORE_PROFILE_FIELDS } from './engine/teaser.ts';
import { loadSchemes } from './loadSchemes.ts';
import type { SchemeMatch, SchemeRecord, TeaserLanguage } from './schemas.ts';
import type {
  AgentInput,
  AgentOutput,
  Claim,
  TraceEvent,
} from './contractsPlaceholder.ts';
import { AgentOutputSchema } from './contractsPlaceholder.ts';
import type { GroqClient } from './groqPlaceholder.ts';

type SchemeLoader = () => Promise<SchemeRecord[]>;
type Delay = (milliseconds: number) => Promise<void>;

const inputPrompts: Record<TeaserLanguage, string> = {
  hi: 'कृपया अपनी जानकारी के बारे में कुछ और विवरण साझा करें।',
  en: 'Please share a few more details about your business.',
  hinglish: 'Apne business ke baare mein kuch aur details share karein.',
};

const apologyMessages: Record<TeaserLanguage, string> = {
  hi: 'क्षमा करें, SCOUT अभी यह अनुरोध पूरा नहीं कर सका। कृपया फिर से प्रयास करें।',
  en: 'Sorry, SCOUT could not complete this request. Please try again.',
  hinglish: 'Maaf kijiye, SCOUT yeh request poori nahi kar saka. Kripya phir try karein.',
};

function getLanguage(input: AgentInput): TeaserLanguage {
  const preferredLanguage = input.profile.preferredLanguage;
  if (preferredLanguage === 'hi' || preferredLanguage === 'en' || preferredLanguage === 'hinglish') {
    return preferredLanguage;
  }

  const locale = input.locale.toLowerCase();
  if (locale.startsWith('hi')) return 'hi';
  if (locale.startsWith('en')) return 'en';
  return 'hinglish';
}

function knownCoreFieldCount(input: AgentInput): number {
  return CORE_PROFILE_FIELDS.filter((key) => {
    const field = input.profile[key];
    return Boolean(
      field &&
        typeof field === 'object' &&
        field.value !== null &&
        (field.status === 'VERIFIED' || field.status === 'SELF_REPORTED'),
    );
  }).length;
}

function isVerifiedForDisplay(scheme: SchemeRecord | undefined): scheme is SchemeRecord {
  if (!scheme) return false;
  const sourceUrl = scheme.sourceUrl.trim();
  const retrievedOn = scheme.retrievedOn.trim();
  return Boolean(
    sourceUrl &&
      retrievedOn &&
      !/TODO\s*\(\s*owner\s*\)/i.test(sourceUrl) &&
      !/TODO\s*\(\s*owner\s*\)/i.test(retrievedOn),
  );
}

function getDisplayMatches(matches: SchemeMatch[], schemes: SchemeRecord[]): SchemeMatch[] {
  const schemesById = new Map(schemes.map((scheme) => [scheme.id, scheme]));
  return matches.filter((match) => isVerifiedForDisplay(schemesById.get(match.schemeId)));
}

function claimsFor(
  matches: SchemeMatch[],
  schemes: SchemeRecord[],
  lang: TeaserLanguage,
  explanations: Map<string, Awaited<ReturnType<typeof explainMatch>>>,
): Claim[] {
  const schemesById = new Map(schemes.map((scheme) => [scheme.id, scheme]));
  return matches.flatMap((match) => {
    const scheme = schemesById.get(match.schemeId);
    if (!isVerifiedForDisplay(scheme)) return [];

    const name = scheme.name[lang === 'hi' ? 'hi' : 'en'];
    const result = match.result === 'possible' ? 'possible' : 'likely eligible';
    const explanation = explanations.get(match.schemeId);
    return [{
      text: explanation?.text ?? `${name}: ${result} based on the recorded criteria.`,
      sourceUrl: scheme.sourceUrl,
      lastVerified: scheme.retrievedOn,
      basis: explanation?.basis ?? 'code_rule',
      confidence: 0.9,
    }];
  });
}

function makeTrace(
  input: AgentInput,
  node: string,
  startedAt: string,
  startedMs: number,
  inputSummary: string,
  outputSummary: string,
  status: TraceEvent['status'] = 'OK',
): TraceEvent {
  return {
    runId: input.runId,
    agent: 'scout',
    node,
    startedAt,
    durationMs: Math.max(0, Date.now() - startedMs),
    inputSummary,
    outputSummary,
    status,
  };
}

function newStep(): { startedAt: string; startedMs: number } {
  return { startedAt: new Date().toISOString(), startedMs: Date.now() };
}

function emptyOutput(status: AgentOutput['status'], messages: AgentOutput['messages'], trace: TraceEvent[]): AgentOutput {
  return AgentOutputSchema.parse({
    status,
    messages,
    claims: [],
    trace,
    costs: { llmTokens: 0, tinyfishAgentCalls: 0 },
  });
}

export function createScoutRunner(
  loader: SchemeLoader = loadSchemes,
  groqClient?: GroqClient,
  delay?: Delay,
) {
  return async function run(input: AgentInput): Promise<AgentOutput> {
    const runStartedAt = new Date().toISOString();
    const runStartedMs = Date.now();

    try {
      const eventType = input.event.type;
      if (!['SCHEME_REQUEST', 'TEASER', 'REFRESH'].includes(eventType)) {
        return emptyOutput('OK', [], [makeTrace(
          input,
          'run',
          runStartedAt,
          runStartedMs,
          `event=${eventType}`,
          'ignored event; no messages',
        )]);
      }

      const lang = getLanguage(input);
      const traces: TraceEvent[] = [];

      const loadStep = newStep();
      const schemes = await loader();
      traces.push(makeTrace(
        input,
        'load',
        loadStep.startedAt,
        loadStep.startedMs,
        'load scheme records',
        `loaded=${schemes.length}`,
      ));

      const matchStep = newStep();
      const matches = matchSchemes(input.profile, schemes);
      const displayMatches = getDisplayMatches(matches, schemes);
      traces.push(makeTrace(
        input,
        'match',
        matchStep.startedAt,
        matchStep.startedMs,
        `schemes=${schemes.length}`,
        `matches=${matches.length}; displayable=${displayMatches.length}`,
      ));

      const buildStep = newStep();
      if (knownCoreFieldCount(input) < 4) {
        const missingFieldRanks = rankMissingFields(matches);
        const prompt = inputPrompts[lang];
        traces.push(makeTrace(
          input,
          'build_messages',
          buildStep.startedAt,
          buildStep.startedMs,
          `event=${eventType}`,
          `status=NEEDS_INPUT; missingFields=${JSON.stringify(missingFieldRanks)}`,
          'NEEDS_INPUT',
        ));
        return emptyOutput('NEEDS_INPUT', [{ type: 'text', text: prompt }], traces);
      }

      if (eventType === 'TEASER') {
        const teaser = buildTeaser(input.profile, displayMatches, lang);
        const messages = teaser.show && teaser.text
          ? [{ type: 'text' as const, text: teaser.text }]
          : [];
        traces.push(makeTrace(
          input,
          'build_messages',
          buildStep.startedAt,
          buildStep.startedMs,
          'build teaser message',
          `shown=${teaser.show}; count=${teaser.count}`,
        ));
        return AgentOutputSchema.parse({
          status: 'OK',
          messages,
          claims: teaser.show ? claimsFor(displayMatches, schemes, lang, new Map()) : [],
          trace: traces,
          costs: { llmTokens: 0, tinyfishAgentCalls: 0 },
        });
      }

      // TODO(owner): connect the injected client to services/groq.ts when it exists.
      const explanations = new Map<string, Awaited<ReturnType<typeof explainMatch>>>();
      let llmTokens = 0;
      let explanationFailed = false;
      const schemesById = new Map(schemes.map((scheme) => [scheme.id, scheme]));
      for (const match of displayMatches.slice(0, 3)) {
        const scheme = schemesById.get(match.schemeId);
        if (!scheme) continue;
        const explanation = await explainMatch(match, scheme, lang, groqClient, delay);
        explanations.set(match.schemeId, explanation);
        llmTokens += explanation.llmTokens;
        explanationFailed ||= explanation.degraded;
      }

      const explanationTexts = new Map(
        [...explanations].map(([schemeId, explanation]) => [schemeId, explanation.text]),
      );
      const messages = buildMessages(displayMatches, lang, explanationTexts);
      traces.push(makeTrace(
        input,
        'build_messages',
        buildStep.startedAt,
        buildStep.startedMs,
        `event=${eventType}`,
        `listRows=${displayMatches.length}`,
      ));

      return AgentOutputSchema.parse({
        status: explanationFailed ? 'DEGRADED' : 'OK',
        messages,
        claims: claimsFor(displayMatches, schemes, lang, explanations),
        trace: traces,
        costs: { llmTokens, tinyfishAgentCalls: 0 },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const lang = input?.profile?.preferredLanguage === 'hi' || input?.profile?.preferredLanguage === 'hinglish'
        ? input.profile.preferredLanguage
        : 'en';
      const failedTrace: TraceEvent = {
        runId: input?.runId ?? 'unknown',
        agent: 'scout',
        node: 'run',
        startedAt: runStartedAt,
        durationMs: Math.max(0, Date.now() - runStartedMs),
        inputSummary: 'SCOUT request',
        outputSummary: 'request failed',
        status: 'FAILED',
        error: message,
      };
      return emptyOutput('FAILED', [{ type: 'text', text: apologyMessages[lang] }], [failedTrace]);
    }
  };
}

export const run = createScoutRunner();