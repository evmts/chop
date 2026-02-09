export default function renderSprintPlan(): string {
  return `SPRINT PLANNING — Read everything, determine next 3 tasks.

STEP 1: Read all planning documents:
- docs/prd.md (product requirements)
- docs/design.md (UX/UI design)
- docs/engineering.md (architecture, module breakdown, Effect patterns)
- docs/tasks.md (master task list with checkboxes)

STEP 2: Read research documents for technical details:
- research/ directory (all .md files — architecture patterns, Effect.ts patterns, guillotine-mini integration, etc.)

STEP 3: Examine current codebase state:
- package.json (dependencies installed)
- tsconfig.json, vitest.config.ts, tsup.config.ts, biome.json (build config)
- src/ directory tree (what modules exist)
- All test files (what tests exist and pass)
- README.md (current state of documentation)
- Run: bun test to see current test status

STEP 4: Determine what has been implemented vs. what remains:
- Cross-reference docs/tasks.md checkboxes against actual codebase
- Tasks with [ ] are NOT done, tasks with [x] are done
- Note which phase the project is currently in

STEP 5: Pick the next 3 SMALLEST ATOMIC tasks:
- Follow the dependency graph in docs/tasks.md
- Pick tasks whose dependencies are already satisfied
- Each task should be completable by a single agent in one session
- Prefer tasks from the same phase (unless phase is complete)
- If all tasks in docs/tasks.md are [x], set projectComplete: true

RULES:
- Be precise — reference exact task IDs (T1.1, T2.3, etc.)
- Include the full acceptance criteria from docs/tasks.md
- If a task is partially done, note what remains
- Consider test coverage — a task is not done until tests pass

After analysis, output:
\`\`\`json
{
  "task1": { "id": "T1.1", "title": "Project Scaffolding", "description": "Full description...", "acceptance": "How to verify..." },
  "task2": { "id": "T1.2", "title": "CLI Framework Setup", "description": "Full description...", "acceptance": "How to verify..." },
  "task3": { "id": "T1.3", "title": "ABI Encoding Commands", "description": "Full description...", "acceptance": "How to verify..." },
  "projectComplete": false,
  "reasoning": "Currently in Phase 1. T1.1 scaffolding not yet created..."
}
\`\`\``;
}
