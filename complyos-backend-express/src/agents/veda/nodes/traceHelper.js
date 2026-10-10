/**
 * ComplianceOS — VEDA Node Trace Helper
 * Produces structured TraceEvent records per node execution.
 */

export function createTraceEvent({
  runId,
  node,
  startedAt,
  inputSummary,
  outputSummary,
  status = 'done',
  error,
}) {
  const now = Date.now();
  const startMs = typeof startedAt === 'number' ? startedAt : new Date(startedAt || now).getTime();
  const durationMs = Math.max(0, now - startMs);

  const stringifySummary = (val) => {
    if (val === undefined || val === null) return '';
    if (typeof val === 'string') return val.substring(0, 200);
    try {
      return JSON.stringify(val).substring(0, 200);
    } catch {
      return String(val).substring(0, 200);
    }
  };

  return {
    runId: runId || 'veda-run',
    agent: 'VEDA',
    node,
    startedAt: new Date(startMs).toISOString(),
    durationMs,
    inputSummary: stringifySummary(inputSummary),
    outputSummary: stringifySummary(outputSummary),
    status,
    ...(error ? { error: String(error) } : {}),
  };
}

export default createTraceEvent;
