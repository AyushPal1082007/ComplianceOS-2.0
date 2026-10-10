import { run as runReal } from './index.ts';
import { run as runMock } from './mock.ts';
import type { AgentInput, AgentOutput } from './contractsPlaceholder.ts';

type ScoutRunner = (input: AgentInput) => Promise<AgentOutput>;

export function selectScoutRunner(
  realFlag: string | undefined,
  realRunner: ScoutRunner = runReal,
  mockRunner: ScoutRunner = runMock,
): ScoutRunner {
  return realFlag === 'true' ? realRunner : mockRunner;
}

export const run = selectScoutRunner(process.env.SCOUT_REAL);