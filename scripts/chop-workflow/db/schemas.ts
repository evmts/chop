import { z } from "zod";

export const sprintPlanSchema = z.object({
  task1: z.object({
    id: z.string().describe("Task ID like T1.1, T2.3, etc."),
    title: z.string().describe("Short task title"),
    description: z.string().describe("Detailed task description with acceptance criteria"),
    acceptance: z.string().describe("How to verify this task is done"),
  }),
  task2: z.object({
    id: z.string().describe("Task ID"),
    title: z.string().describe("Short task title"),
    description: z.string().describe("Detailed task description with acceptance criteria"),
    acceptance: z.string().describe("How to verify this task is done"),
  }),
  task3: z.object({
    id: z.string().describe("Task ID"),
    title: z.string().describe("Short task title"),
    description: z.string().describe("Detailed task description with acceptance criteria"),
    acceptance: z.string().describe("How to verify this task is done"),
  }),
  projectComplete: z.boolean().describe("True if ALL tasks in docs/tasks.md are satisfied"),
  reasoning: z.string().describe("Why these 3 tasks were chosen and what state the project is in"),
});

export const taskPlanSchema = z.object({
  plan: z.string().describe("Detailed implementation plan"),
  filesToCreate: z.array(z.string()).describe("Files that need to be created"),
  filesToModify: z.array(z.string()).describe("Existing files that need modification"),
  testStrategy: z.string().describe("How to test this task"),
});

export const implementSchema = z.object({
  filesCreated: z.array(z.string()).nullable().describe("Files that were created"),
  filesModified: z.array(z.string()).nullable().describe("Files that were modified"),
  commitMessage: z.string().describe("Git commit message for the implementation"),
  whatWasDone: z.string().describe("Description of what was implemented"),
  testsPassing: z.boolean().describe("Whether all tests pass after implementation"),
});

export const reviewSchema = z.object({
  approved: z.boolean().describe("Whether the code passes review"),
  feedback: z.string().describe("Overall review feedback"),
  issues: z.array(z.string()).nullable().describe("List of issues found, null if approved"),
});

export const fixSchema = z.object({
  fixesMade: z.array(z.string()).nullable().describe("List of fixes applied"),
  commitMessage: z.string().describe("Git commit message for fixes"),
  summary: z.string().describe("Summary of what was fixed"),
});

export const testCoverageSchema = z.object({
  coveragePercent: z.number().describe("Test coverage percentage"),
  testsAdded: z.number().describe("Number of tests added"),
  summary: z.string().describe("Summary of test coverage improvements"),
  allPass: z.boolean().describe("Whether all tests pass"),
});
