import { smithers, Workflow, Task, Sequence, Parallel, Ralph } from "smithers";
import { db, schema } from "./db";
import { makeClaudeOpus, makeClaudeSonnet } from "./agents/claude";
import { makeCodex, makeCodexReadonly } from "./agents/codex";
import { makeGemini } from "./agents/gemini";
import {
  sprintPlanSchema,
  taskPlanSchema,
  implementSchema,
  reviewSchema,
  fixSchema,
  testCoverageSchema,
} from "./db/schemas";
import renderSprintPlan from "./steps/sprint-plan";
import renderTaskPlan from "./steps/task-plan";
import renderImplement from "./steps/implement";
import renderReview from "./steps/review";
import renderFix from "./steps/fix";
import renderTestCoverage from "./steps/test-coverage";

const MAX_SPRINTS = 25;

type SprintPlanRow = {
  task1?: { id: string; title: string; description: string; acceptance: string } | null;
  task2?: { id: string; title: string; description: string; acceptance: string } | null;
  task3?: { id: string; title: string; description: string; acceptance: string } | null;
  projectComplete?: boolean;
  reasoning?: string;
};

type TaskPlanRow = {
  plan?: string;
};

type ReviewRow = {
  approved?: boolean;
  issues?: string[] | null;
};

type OutputRow = {
  sprintsCompleted?: number;
};

export default smithers(db, (ctx) => {
  const claudeOpus = makeClaudeOpus();
  const claudeSonnet = makeClaudeSonnet();
  const codex = makeCodex();
  const codexRO = makeCodexReadonly();
  const gemini = makeGemini();

  // Query sprint tracker to know how many sprints we've done
  const passTracker = ctx.outputMaybe(schema.output, { nodeId: "sprint-tracker" }) as OutputRow | undefined;
  const currentSprint = passTracker?.sprintsCompleted ?? 0;

  // Query latest sprint plan to check if project is complete
  const latestSprint = ctx.outputMaybe(schema.sprint_plan, { nodeId: "sprint-plan" }) as SprintPlanRow | undefined;
  const projectComplete = latestSprint?.projectComplete ?? false;

  // Helper: check if all 3 reviewers approved for a given task suffix
  const allApproved = (suffix: string): boolean => {
    const rc = ctx.outputMaybe(schema.review, { nodeId: `rev-${suffix}-claude` }) as ReviewRow | undefined;
    const rx = ctx.outputMaybe(schema.review, { nodeId: `rev-${suffix}-codex` }) as ReviewRow | undefined;
    const rg = ctx.outputMaybe(schema.review, { nodeId: `rev-${suffix}-gemini` }) as ReviewRow | undefined;
    return (rc?.approved && rx?.approved && rg?.approved) ?? false;
  };

  // Build task pipeline for a given task number (1, 2, 3)
  const taskPipeline = (n: 1 | 2 | 3) => {
    const taskKey = `task${n}` as const;
    const task = latestSprint?.[taskKey];
    const taskDesc = task ? `${task.id}: ${task.title} — ${task.description}\n\nAcceptance: ${task.acceptance}` : "No task assigned";
    const suffix = String(n);
    const approved = allApproved(suffix);

    // Get latest plan for implementation prompt
    const latestPlan = ctx.outputMaybe(schema.task_plan, { nodeId: `plan-${suffix}` }) as TaskPlanRow | undefined;

    // Collect issues from all reviewers for fix prompt
    const reviews = [
      ctx.outputMaybe(schema.review, { nodeId: `rev-${suffix}-claude` }) as ReviewRow | undefined,
      ctx.outputMaybe(schema.review, { nodeId: `rev-${suffix}-codex` }) as ReviewRow | undefined,
      ctx.outputMaybe(schema.review, { nodeId: `rev-${suffix}-gemini` }) as ReviewRow | undefined,
    ];
    const issues = reviews.flatMap((r) => r?.issues ?? []);

    return (
      <Sequence key={`task-${suffix}`}>
        {/* Step 1: Plan the task (Claude Sonnet — fast + good at planning) */}
        <Task
          id={`plan-${suffix}`}
          output={schema.task_plan}
          outputSchema={taskPlanSchema}
          agent={claudeSonnet}
        >
          {renderTaskPlan({ taskDesc })}
        </Task>

        {/* Step 2: Implement with TDD (Codex — strong at code generation) */}
        <Task
          id={`impl-${suffix}`}
          output={schema.implement}
          outputSchema={implementSchema}
          agent={codex}
        >
          {renderImplement({ taskDesc, plan: latestPlan?.plan ?? "" })}
        </Task>

        {/* Step 3: Triple review loop — all 3 must LGTM */}
        <Ralph
          id={`review-loop-${suffix}`}
          until={approved}
          maxIterations={3}
          onMaxReached="return-last"
        >
          <Sequence>
            {/* 3 parallel reviews */}
            <Parallel>
              <Task
                id={`rev-${suffix}-claude`}
                output={schema.review}
                outputSchema={reviewSchema}
                agent={claudeSonnet}
              >
                {renderReview({ taskDesc, reviewer: "Claude" })}
              </Task>
              <Task
                id={`rev-${suffix}-codex`}
                output={schema.review}
                outputSchema={reviewSchema}
                agent={codexRO}
              >
                {renderReview({ taskDesc, reviewer: "Codex" })}
              </Task>
              <Task
                id={`rev-${suffix}-gemini`}
                output={schema.review}
                outputSchema={reviewSchema}
                agent={gemini}
              >
                {renderReview({ taskDesc, reviewer: "Gemini" })}
              </Task>
            </Parallel>

            {/* Fix issues if not all approved */}
            <Task
              id={`fix-${suffix}`}
              output={schema.fix}
              outputSchema={fixSchema}
              agent={codex}
              skipIf={approved}
            >
              {renderFix({ taskDesc, issues })}
            </Task>
          </Sequence>
        </Ralph>
      </Sequence>
    );
  };

  return (
    <Workflow name="chop-build">
      <Ralph until={projectComplete} maxIterations={MAX_SPRINTS} onMaxReached="return-last">
        <Sequence>
          {/* Sprint planner — reads everything, picks next 3 tasks */}
          <Task
            id="sprint-plan"
            output={schema.sprint_plan}
            outputSchema={sprintPlanSchema}
            agent={claudeOpus}
          >
            {renderSprintPlan()}
          </Task>

          {/* 3 task pipelines — sequential (each builds on previous) */}
          {taskPipeline(1)}
          {taskPipeline(2)}
          {taskPipeline(3)}

          {/* Test coverage — Claude adds comprehensive tests after all 3 tasks */}
          <Task
            id="test-coverage"
            output={schema.test_coverage}
            outputSchema={testCoverageSchema}
            agent={claudeSonnet}
          >
            {renderTestCoverage()}
          </Task>

          {/* Sprint tracker — records completion for outer loop */}
          <Task id="sprint-tracker" output={schema.output}>
            {{
              sprintsCompleted: currentSprint + 1,
              summary: `Sprint ${currentSprint + 1} complete. ${projectComplete ? "Project complete!" : "Continuing to next sprint."}`,
            }}
          </Task>
        </Sequence>
      </Ralph>
    </Workflow>
  );
});
