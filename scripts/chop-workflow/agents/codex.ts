import { CodexAgent } from "smithers";

const CODEX_MODEL = process.env.CODEX_MODEL ?? "gpt-5.2-codex";
const REPO_ROOT = new URL("../../..", import.meta.url).pathname.replace(/\/$/, "");

const CODEX_INSTRUCTIONS = `We are building chop — an Ethereum CLI/TUI/MCP tool in TypeScript with Effect.ts.
Planning docs are in docs/. Research docs in research/. Follow Effect.ts patterns from docs/engineering.md.
Use voltaire-effect primitives. Use @effect/vitest for tests. Always-green mandate.
Run: bun test after every change.

KEY RULES:
- NEVER use Effect.runPromise except at application edge
- Use Effect.gen(function* () { ... }) for sequential composition
- Define services as Context.Tag — never use global mutable state
- Use Layer for DI — Layer.succeed, Layer.effect, Layer.scoped
- Use Data.TaggedError for all domain errors
- Test with @effect/vitest — it.effect() for Effect-returning tests

GIT COMMIT RULES:
- Make atomic commits — one logical change per commit
- Use emoji prefixes: 🐛 fix, ♻️ refactor, 🧪 test, ⚡ perf, ✨ feat
- Format: "EMOJI type(scope): description"

CRITICAL OUTPUT REQUIREMENT:
When you have completed your work, you MUST end your response with a JSON object
wrapped in a code fence. The JSON format is specified in your task prompt.
Example:
\`\`\`json
{"key": "value", "other": "data"}
\`\`\`
This JSON output is REQUIRED. The workflow cannot continue without it.
ALWAYS include the JSON at the END of your final response.`;

export function makeCodex() {
  return new CodexAgent({
    model: CODEX_MODEL,
    systemPrompt: CODEX_INSTRUCTIONS,
    yolo: true,
    cwd: REPO_ROOT,
    config: { model_reasoning_effort: "xhigh" },
  });
}

export function makeCodexReadonly() {
  return new CodexAgent({
    model: CODEX_MODEL,
    systemPrompt: CODEX_INSTRUCTIONS,
    yolo: true,
    cwd: REPO_ROOT,
    sandbox: "read-only",
    config: { model_reasoning_effort: "xhigh" },
  });
}
