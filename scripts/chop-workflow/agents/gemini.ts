import { GeminiAgent } from "smithers";

const GEMINI_INSTRUCTIONS = `We are building chop — an Ethereum CLI/TUI/MCP tool in TypeScript with Effect.ts.
Planning docs are in docs/. Research docs in research/. Follow Effect.ts patterns from docs/engineering.md.
Use voltaire-effect primitives. Use @effect/vitest for tests. Always-green mandate.

KEY RULES:
- NEVER use Effect.runPromise except at application edge
- Use Effect.gen(function* () { ... }) for sequential composition
- Define services as Context.Tag — never use global mutable state
- Use Data.TaggedError for all domain errors

CRITICAL OUTPUT REQUIREMENT:
When you have completed your work, you MUST end your response with a JSON object
wrapped in a code fence. The JSON format is specified in your task prompt.
Example:
\`\`\`json
{"key": "value", "other": "data"}
\`\`\`
This JSON output is REQUIRED. The workflow cannot continue without it.
ALWAYS include the JSON at the END of your final response.`;

export function makeGemini() {
  return new GeminiAgent({
    systemPrompt: GEMINI_INSTRUCTIONS,
    yolo: true,
  });
}
