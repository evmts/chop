import { ClaudeCodeAgent } from "smithers";

const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-4-6";
const CLAUDE_SONNET = process.env.CLAUDE_SONNET_MODEL ?? "claude-sonnet-4-20250514";

const BASE_INSTRUCTIONS = `We are building chop — an Ethereum CLI/TUI/MCP tool in TypeScript with Effect.ts.
You have access to the full codebase. Planning docs are in docs/, research docs in research/.
You ALWAYS use voltaire-effect primitives — NEVER create custom Address/Hash/Hex types.
You follow Effect.ts patterns: Context.Tag + Layer for DI, Data.TaggedError for errors, Effect.gen for composition.
You write small, atomic, testable units. One service or function per commit.
Run: bun test after every change. Always-green mandate.

KEY RULES:
- NEVER use Effect.runPromise except at application edge
- Use Effect.gen(function* () { ... }) for sequential composition
- Define services as Context.Tag — never use global mutable state
- Use Layer for DI — Layer.succeed, Layer.effect, Layer.scoped
- Use Data.TaggedError for all domain errors
- Test with @effect/vitest — it.effect() for Effect-returning tests
- Use 'satisfies' to type-check service implementations

GIT COMMIT RULES:
- Make atomic commits — one logical change per commit
- Use emoji prefixes: 🐛 fix, ♻️ refactor, 🧪 test, ⚡ perf, ✨ feat
- Format: "EMOJI type(scope): description"
- git add specific files, then git commit

CRITICAL OUTPUT REQUIREMENT:
When you have completed your work, you MUST end your response with a JSON object
wrapped in a code fence. The JSON format is specified in your task prompt.
Example:
\`\`\`json
{"key": "value", "other": "data"}
\`\`\`
This JSON output is REQUIRED. The workflow cannot continue without it.
ALWAYS include the JSON at the END of your final response.`;

export function makeClaudeOpus() {
  return new ClaudeCodeAgent({
    model: CLAUDE_MODEL,
    systemPrompt: BASE_INSTRUCTIONS,
    dangerouslySkipPermissions: true,
  });
}

export function makeClaudeSonnet() {
  return new ClaudeCodeAgent({
    model: CLAUDE_SONNET,
    systemPrompt: BASE_INSTRUCTIONS,
    dangerouslySkipPermissions: true,
  });
}
