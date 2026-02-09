export default function renderImplement(props: {
  taskDesc: string;
  plan: string;
}): string {
  return `IMPLEMENTATION — Build this task using TDD.

TASK: ${props.taskDesc}

PLAN:
${props.plan}

STEP 1: Read docs/ for patterns:
- docs/engineering.md for architecture patterns
- Existing source files for style consistency

STEP 2: Write failing tests FIRST:
- Use @effect/vitest with it.effect() for Effect-returning tests
- Use describe/it structure
- Cover: happy path, edge cases, error cases
- Pattern:
  import { it, describe } from "@effect/vitest"
  import { Effect } from "effect"
  describe("ModuleName", () => {
    it.effect("does something", () =>
      Effect.gen(function* () {
        // test body
      }).pipe(Effect.provide(TestLayer))
    )
  })

STEP 3: Implement until tests pass:
- Follow the plan exactly
- Use Effect Context.Tag + Layer for services
- Use Data.TaggedError for errors
- Import from voltaire-effect for Ethereum types
- Use Effect.gen(function* () { ... }) for composition
- NEVER use Effect.runPromise except at application edge

STEP 4: Verify everything works:
- Run: bun test — ALL tests must pass
- Run: bun run typecheck — no type errors (if configured)
- Run: bun run lint — no lint errors (if configured)

STEP 5: Commit with atomic commits:
- One logical change per commit
- Use emoji prefixes: ✨ feat, 🐛 fix, ♻️ refactor, 🧪 test, ⚡ perf
- Format: "EMOJI type(scope): description"
- git add specific files, then git commit

STEP 6: Update docs/tasks.md:
- Check off [x] the task checkbox if acceptance criteria are met
- Only check off if ALL sub-items are satisfied

After implementation, output:
\`\`\`json
{
  "filesCreated": ["src/shared/types.ts"],
  "filesModified": ["package.json"],
  "commitMessage": "✨ feat(shared): add base types re-exporting voltaire-effect",
  "whatWasDone": "Created shared types module...",
  "testsPassing": true
}
\`\`\``;
}
