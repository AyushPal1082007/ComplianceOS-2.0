const AGENT_ENV_FLAGS = {
  ARIA: 'ARIA_REAL',
  VEDA: 'VEDA_REAL',
  SCOUT: 'SCOUT_REAL',
  SENTINEL: 'SENTINEL_REAL',
  PATHWAY: 'PATHWAY_REAL',
};

export function isReal(agent) {
  const envName = AGENT_ENV_FLAGS[agent];
  if (!envName) {
    throw new Error(`Unknown agent flag: ${agent}`);
  }
  return process.env[envName] === 'true';
}

export const TEMPLATE_MODE = process.env.TEMPLATE_MODE === 'true';
export const DEMO_MODE = process.env.DEMO_MODE !== 'false';
export const CHANNELS = Object.freeze(['whatsapp', 'web']);

export default { isReal, TEMPLATE_MODE, DEMO_MODE, CHANNELS };
