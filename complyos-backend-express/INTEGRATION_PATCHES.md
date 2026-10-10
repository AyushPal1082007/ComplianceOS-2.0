# Integration Patches

| File | Why | Diff summary |
| --- | --- | --- |
| `src/agents/veda/stubs/rules.stub.js` | Reuse the new shared rules wrappers without changing VEDA's public API or test expectations. | Re-export statutory deadline generation and delegate existing late-fee/health-score exports to `src/rules/`; preserve the stub's three exported functions. |
| `src/agents/sentinel/pipeline.js` | Fix the undefined `profiles` reference during approved-change delivery. | Load active, consented profiles through `profileRepo` and pass them to the guarded SENTINEL delivery node. |
| `src/jobs/sentinelCrawler.js` | Restore compatibility with the Express ES module backend so `server.js` can start. | Convert the crawler job from CommonJS to ES module imports/exports. |
