export default function renderTaskPlan(props: {
  taskDesc: string;
}): string {
  return `TASK PLANNING — Create a detailed implementation plan.

TASK: ${props.taskDesc}

STEP 1: Read planning documents for context:
- docs/engineering.md (architecture, module breakdown, Effect service graph, error patterns)
- docs/tasks.md (acceptance criteria for this specific task)
- docs/design.md (if this task has UI components)

STEP 2: Read relevant research documents:
- research/architecture-patterns.md (Effect.ts patterns reference)
- research/project-setup.md (build configuration details)
- Any other research/ files relevant to this task

STEP 3: Examine existing codebase:
- What files already exist that this task depends on?
- What interfaces/types are already defined?
- What patterns do existing files follow?

STEP 4: Create a detailed plan:
- List every file to create with its purpose
- List every file to modify with what changes are needed
- Define the Effect services, Layers, and error types needed
- Specify the exact import paths (voltaire-effect, effect, etc.)
- Plan the test strategy: what tests, what assertions

RULES:
- Follow docs/engineering.md patterns EXACTLY
- Use Context.Tag + Layer for all services
- Use Data.TaggedError for all errors
- Plan @effect/vitest it.effect() tests for every public function
- Keep it atomic — this plan should be completable in one session

After planning, output:
\`\`\`json
{
  "plan": "Detailed step-by-step implementation plan...",
  "filesToCreate": ["src/shared/types.ts", "src/shared/errors.ts"],
  "filesToModify": ["package.json", "tsconfig.json"],
  "testStrategy": "Unit tests with @effect/vitest for each function..."
}
\`\`\``;
}
