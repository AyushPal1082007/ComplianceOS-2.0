# Integration Patches

| File | Why | Diff summary |
| --- | --- | --- |
| `src/agents/veda/stubs/rules.stub.js` | Reuse the new shared rules wrappers without changing VEDA's public API or test expectations. | Re-export statutory deadline generation and delegate existing late-fee/health-score exports to `src/rules/`; preserve the stub's three exported functions. |
