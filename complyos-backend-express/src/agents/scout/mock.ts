import { AgentOutputSchema, type AgentInput, type AgentOutput } from './contractsPlaceholder.ts';
import { SCOUT_FIXTURES } from './fixtures/index.ts';

export async function run(input: AgentInput): Promise<AgentOutput> {
  const fixtureId = input.profile.fixtureId;
  const fixture = typeof fixtureId === 'string' && Object.hasOwn(SCOUT_FIXTURES, fixtureId)
    ? SCOUT_FIXTURES[fixtureId as keyof typeof SCOUT_FIXTURES]
    : SCOUT_FIXTURES.empty;

  return AgentOutputSchema.parse(structuredClone(fixture.expected));
}