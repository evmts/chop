export default function renderReview(props: {
  taskDesc: string;
  reviewer: string;
}): string {
  return `CODE REVIEW — Review the latest changes for correctness and quality.

TASK: ${props.taskDesc}
REVIEWER: ${props.reviewer}

STEP 1: Read the standards:
- docs/engineering.md (architecture patterns, Effect conventions)
- docs/tasks.md (acceptance criteria for this task)

STEP 2: Examine what changed:
- Run: git log --oneline -10 to see recent commits
- Run: git diff HEAD~3 to see recent changes (adjust range as needed)
- Read all new and modified files

STEP 3: Review checklist — check EVERY item:

CORRECTNESS:
- [ ] Implementation matches the task description and acceptance criteria
- [ ] Logic is correct — no off-by-one, no missing cases
- [ ] Error handling covers all failure modes

EFFECT.TS PATTERNS:
- [ ] Services use Context.Tag + Layer (not global state)
- [ ] Errors use Data.TaggedError (not throw/catch)
- [ ] Composition uses Effect.gen(function* () { ... })
- [ ] No Effect.runPromise except at application edge
- [ ] Layer composition is correct (provide, merge, etc.)
- [ ] Resource management uses acquireRelease where needed

TYPES & IMPORTS:
- [ ] Uses voltaire-effect types (Address, Hash, Hex) — no custom duplicates
- [ ] No 'any' types
- [ ] Imports are clean — no unused imports
- [ ] Export surface is minimal — internals are private

TESTING:
- [ ] Tests exist for all public functions
- [ ] Tests use @effect/vitest it.effect() pattern
- [ ] Tests cover happy path AND error cases
- [ ] Tests are not trivial (actually assert meaningful behavior)
- [ ] bun test passes

CODE QUALITY:
- [ ] No code duplication
- [ ] Functions are small and focused
- [ ] Naming is clear (PascalCase for types/services, camelCase for functions)
- [ ] No dead code
- [ ] Comments only where logic is non-obvious

STEP 4: Verdict:
- If ALL checklist items pass: approved = true
- If ANY item fails: approved = false, list specific issues with file:line references

Be STRICT. Flag anything that can be improved. This is a high-quality Ethereum tool.

After review, output:
\`\`\`json
{
  "approved": false,
  "feedback": "Overall assessment of code quality...",
  "issues": ["src/shared/types.ts:5 — missing re-export of Hex type", "No test for error case in..."]
}
\`\`\``;
}
