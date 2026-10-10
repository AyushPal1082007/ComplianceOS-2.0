import crypto from 'crypto';
import { runSentinelCrawl, runSingleSource, loadSources } from './pipeline.js';
import { buildAlert } from './buildAlert.js';
import prisma from '../../db.js';

export async function run(input = {}) {
  const source = input.source || { id: 'manual-run', name: 'Manual SENTINEL run', url: 'https://example.com', simulated: false };
  const result = await runSingleSource(source);
  return {
    status: result.status === 'ALERTED' ? 'OK' : result.status === 'NEEDS_REVIEW' ? 'NEEDS_INPUT' : 'OK',
    messages: [{
      role: 'assistant',
      text: result.status === 'ALERTED'
        ? `SENTINEL found a change and notified ${result.alerts || 0} profile(s).`
        : 'SENTINEL checked the source and found no actionable alert to deliver.',
    }],
    claims: result.change ? [{
      text: result.change.summary,
      sourceUrl: result.change.sourceUrl,
      lastVerified: result.change.lastVerified,
      basis: 'live_fetch',
      confidence: result.change.confidence,
    }] : [],
    trace: [{
      runId: crypto.randomUUID(),
      agent: 'SENTINEL',
      node: 'pipeline',
      startedAt: new Date().toISOString(),
      durationMs: 0,
      inputSummary: source.id,
      outputSummary: result.status,
      status: result.status,
    }],
    costs: {
      tinyfishAgentCalls: 0,
    },
  };
}

export async function injectSimulatedAlert(userId, options = {}) {
  const title = options.title || 'Simulated alert: GST filing window update';
  const summary = options.summary || 'This is a simulated alert used to validate the alert builder and user targeting logic.';

  if (prisma && typeof prisma.sentinelAlert?.create === 'function') {
    return prisma.sentinelAlert.create({
      data: {
        userId,
        title,
        summary: `Simulated alert — ${summary}`,
        sourceUrl: options.sourceUrl || 'https://simulated.local/regulations/gst-update',
        lastVerifiedAt: new Date(),
        isSimulated: true,
        affectedAttributes: { states: ['all'], sectors: ['all'] },
        status: 'unread',
      },
    });
  }

  return {
    userId,
    title,
    summary: `Simulated alert — ${summary}`,
    sourceUrl: options.sourceUrl || 'https://simulated.local/regulations/gst-update',
    lastVerifiedAt: new Date().toISOString(),
    isSimulated: true,
    status: 'unread',
  };
}

export { buildAlert, runSentinelCrawl, runSingleSource, loadSources };

export default {
  run,
  runSentinelCrawl,
  injectSimulatedAlert,
  buildAlert,
};
