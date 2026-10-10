## AI Context Rules (for all AI agents)

BEFORE starting any task:

- Read .ai/AI_CONTEXT.md first. Do not scan the whole repo.
- Use .ai/file_index.json and .ai/project_graph.json only via grep/jq lookups. Never load them in full.
- Open source files only when the task needs them.

AFTER making changes:

- If you added, removed, or renamed a route, model, module, component, command, env variable, or dependency, update .ai/AI_CONTEXT.md in the same change.
- Add a one-line entry to .ai/CHANGELOG.md: date, what changed, files touched.
- Keep AI_CONTEXT.md under ~4000 tokens. Replace outdated info instead of only adding.
- Never put secrets or .env values in .ai/.
- Do not paste large code blocks into .ai/.
