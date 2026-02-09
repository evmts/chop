import { drizzle } from "drizzle-orm/bun-sqlite";
import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

// --- Table definitions ---

const inputTable = sqliteTable("input", {
  runId: text("run_id").primaryKey(),
  projectDir: text("project_dir").notNull(),
});

const sprintPlanTable = sqliteTable(
  "sprint_plan",
  {
    runId: text("run_id").notNull(),
    nodeId: text("node_id").notNull(),
    iteration: integer("iteration").notNull().default(0),
    task1: text("task1", { mode: "json" }).$type<{ id: string; title: string; description: string; acceptance: string }>(),
    task2: text("task2", { mode: "json" }).$type<{ id: string; title: string; description: string; acceptance: string }>(),
    task3: text("task3", { mode: "json" }).$type<{ id: string; title: string; description: string; acceptance: string }>(),
    projectComplete: integer("project_complete", { mode: "boolean" }).notNull(),
    reasoning: text("reasoning").notNull(),
  },
  (t) => [primaryKey({ columns: [t.runId, t.nodeId, t.iteration] })],
);

const taskPlanTable = sqliteTable(
  "task_plan",
  {
    runId: text("run_id").notNull(),
    nodeId: text("node_id").notNull(),
    iteration: integer("iteration").notNull().default(0),
    plan: text("plan").notNull(),
    filesToCreate: text("files_to_create", { mode: "json" }).$type<string[]>(),
    filesToModify: text("files_to_modify", { mode: "json" }).$type<string[]>(),
    testStrategy: text("test_strategy").notNull(),
  },
  (t) => [primaryKey({ columns: [t.runId, t.nodeId, t.iteration] })],
);

const implementTable = sqliteTable(
  "implement",
  {
    runId: text("run_id").notNull(),
    nodeId: text("node_id").notNull(),
    iteration: integer("iteration").notNull().default(0),
    filesCreated: text("files_created", { mode: "json" }).$type<string[]>(),
    filesModified: text("files_modified", { mode: "json" }).$type<string[]>(),
    commitMessage: text("commit_message").notNull(),
    whatWasDone: text("what_was_done").notNull(),
    testsPassing: integer("tests_passing", { mode: "boolean" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.runId, t.nodeId, t.iteration] })],
);

const reviewTable = sqliteTable(
  "review",
  {
    runId: text("run_id").notNull(),
    nodeId: text("node_id").notNull(),
    iteration: integer("iteration").notNull().default(0),
    approved: integer("approved", { mode: "boolean" }).notNull(),
    feedback: text("feedback").notNull(),
    issues: text("issues", { mode: "json" }).$type<string[]>(),
  },
  (t) => [primaryKey({ columns: [t.runId, t.nodeId, t.iteration] })],
);

const fixTable = sqliteTable(
  "fix",
  {
    runId: text("run_id").notNull(),
    nodeId: text("node_id").notNull(),
    iteration: integer("iteration").notNull().default(0),
    fixesMade: text("fixes_made", { mode: "json" }).$type<string[]>(),
    commitMessage: text("commit_message").notNull(),
    summary: text("summary").notNull(),
  },
  (t) => [primaryKey({ columns: [t.runId, t.nodeId, t.iteration] })],
);

const testCoverageTable = sqliteTable(
  "test_coverage",
  {
    runId: text("run_id").notNull(),
    nodeId: text("node_id").notNull(),
    iteration: integer("iteration").notNull().default(0),
    coveragePercent: integer("coverage_percent").notNull(),
    testsAdded: integer("tests_added").notNull(),
    summary: text("summary").notNull(),
    allPass: integer("all_pass", { mode: "boolean" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.runId, t.nodeId, t.iteration] })],
);

const outputTable = sqliteTable(
  "output",
  {
    runId: text("run_id").notNull(),
    nodeId: text("node_id").notNull(),
    sprintsCompleted: integer("sprints_completed").notNull(),
    summary: text("summary").notNull(),
  },
  (t) => [primaryKey({ columns: [t.runId, t.nodeId] })],
);

// --- Schema export ---

export const schema = {
  input: inputTable,
  output: outputTable,
  sprint_plan: sprintPlanTable,
  task_plan: taskPlanTable,
  implement: implementTable,
  review: reviewTable,
  fix: fixTable,
  test_coverage: testCoverageTable,
};

// --- Database init ---

export const db = drizzle("./chop-workflow.db", { schema });

// Create tables
(db as any).$client.exec(`
  CREATE TABLE IF NOT EXISTS input (
    run_id TEXT PRIMARY KEY,
    project_dir TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sprint_plan (
    run_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    iteration INTEGER NOT NULL DEFAULT 0,
    task1 TEXT,
    task2 TEXT,
    task3 TEXT,
    project_complete INTEGER NOT NULL,
    reasoning TEXT NOT NULL,
    PRIMARY KEY (run_id, node_id, iteration)
  );
  CREATE TABLE IF NOT EXISTS task_plan (
    run_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    iteration INTEGER NOT NULL DEFAULT 0,
    plan TEXT NOT NULL,
    files_to_create TEXT,
    files_to_modify TEXT,
    test_strategy TEXT NOT NULL,
    PRIMARY KEY (run_id, node_id, iteration)
  );
  CREATE TABLE IF NOT EXISTS implement (
    run_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    iteration INTEGER NOT NULL DEFAULT 0,
    files_created TEXT,
    files_modified TEXT,
    commit_message TEXT NOT NULL,
    what_was_done TEXT NOT NULL,
    tests_passing INTEGER NOT NULL,
    PRIMARY KEY (run_id, node_id, iteration)
  );
  CREATE TABLE IF NOT EXISTS review (
    run_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    iteration INTEGER NOT NULL DEFAULT 0,
    approved INTEGER NOT NULL,
    feedback TEXT NOT NULL,
    issues TEXT,
    PRIMARY KEY (run_id, node_id, iteration)
  );
  CREATE TABLE IF NOT EXISTS fix (
    run_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    iteration INTEGER NOT NULL DEFAULT 0,
    fixes_made TEXT,
    commit_message TEXT NOT NULL,
    summary TEXT NOT NULL,
    PRIMARY KEY (run_id, node_id, iteration)
  );
  CREATE TABLE IF NOT EXISTS test_coverage (
    run_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    iteration INTEGER NOT NULL DEFAULT 0,
    coverage_percent INTEGER NOT NULL,
    tests_added INTEGER NOT NULL,
    summary TEXT NOT NULL,
    all_pass INTEGER NOT NULL,
    PRIMARY KEY (run_id, node_id, iteration)
  );
  CREATE TABLE IF NOT EXISTS output (
    run_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    sprints_completed INTEGER NOT NULL,
    summary TEXT NOT NULL,
    PRIMARY KEY (run_id, node_id)
  );
`);
