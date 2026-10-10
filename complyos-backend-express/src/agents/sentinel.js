import { run as runSentinelAgent, runSentinelCrawl, runSingleSource, loadSources, injectSimulatedAlert as injectAlert, buildAlert } from './sentinel/index.js';

export const MONITORED_SOURCES = [
  {
    id: 'gst-portal-updates',
    name: 'GST portal updates',
    url: 'TODO_VERIFY_OFFICIAL_URL',
    type: 'html',
    stateScope: 'all',
    fetchVia: 'fetch',
    checkEvery: '6h',
    checkFrequency: '6h',
    owner: 'Government of India',
    simulated: false,
  },
  {
    id: 'msme-ministry-updates',
    name: 'MSME ministry updates',
    url: 'TODO_VERIFY_OFFICIAL_URL',
    type: 'html',
    stateScope: 'all',
    fetchVia: 'fetch',
    checkEvery: '6h',
    checkFrequency: '6h',
    owner: 'Ministry of MSME',
    simulated: false,
  },
  {
    id: 'simulated-regulatory-notice',
    name: 'Simulated regulatory notice',
    url: 'https://simulated.local/regulations/notice',
    type: 'html',
    stateScope: 'all',
    fetchVia: 'agent',
    checkEvery: '6h',
    checkFrequency: '6h',
    owner: 'ComplianceOS internal sim',
    simulated: true,
  },
];

export async function injectSimulatedAlert(userId, options = {}) {
  return injectAlert(userId, options);
}

export async function run(input = {}) {
  return runSentinelAgent(input);
}

export { runSingleSource, runSentinelCrawl, loadSources, buildAlert };

export default {
  MONITORED_SOURCES,
  run,
  runSentinelCrawl,
  runSingleSource,
  injectSimulatedAlert,
  loadSources,
  buildAlert,
};
