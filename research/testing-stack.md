# Testing Stack Research: Vitest + @effect/vitest, Microsoft tui-test, Charmbracelet VHS

> Research compiled 2026-02-09 for the `chop` TypeScript/Effect TUI project.

---

## Table of Contents

1. [Vitest + @effect/vitest (Unit & Integration Testing)](#1-vitest--effectvitest)
   - [Overview & Why Vitest](#11-overview--why-vitest)
   - [Installation & Configuration](#12-installation--configuration)
   - [Testing Effect Programs](#13-testing-effect-programs)
   - [Mocking Effect Services & Layers](#14-mocking-effect-services--layers)
   - [Property-Based Testing](#15-property-based-testing)
   - [Snapshot Testing](#16-snapshot-testing)
   - [Coverage Reporting](#17-coverage-reporting)
   - [Project Structure for Large Codebases](#18-project-structure-for-large-codebases)
   - [Performance & Parallelism](#19-performance--parallelism)
2. [Microsoft tui-test (TUI E2E Testing)](#2-microsoft-tui-test)
   - [Overview](#21-overview)
   - [Installation & Setup](#22-installation--setup)
   - [Architecture & How It Works](#23-architecture--how-it-works)
   - [Terminal Context API](#24-terminal-context-api)
   - [Assertions & Locators](#25-assertions--locators)
   - [Snapshot / Golden File Support](#26-snapshot--golden-file-support)
   - [Configuration](#27-configuration)
   - [CI Integration](#28-ci-integration)
   - [Maturity & Current Status](#29-maturity--current-status)
   - [Alternatives](#210-alternatives)
   - [Full Example Tests](#211-full-example-tests)
3. [Charmbracelet VHS (Demo Generation & Visual Regression)](#3-charmbracelet-vhs)
   - [Overview](#31-overview)
   - [Installation & Dependencies](#32-installation--dependencies)
   - [Tape File Syntax](#33-tape-file-syntax)
   - [Output Formats](#34-output-formats)
   - [Settings Reference](#35-settings-reference)
   - [Golden File Testing](#36-golden-file-testing)
   - [CI Integration with vhs-action](#37-ci-integration-with-vhs-action)
   - [Parameterization & Templating](#38-parameterization--templating)
   - [Real-World Tape Examples](#39-real-world-tape-examples)
4. [Recommended Setup for Chop](#4-recommended-setup-for-chop)

---

## 1. Vitest + @effect/vitest

### 1.1 Overview & Why Vitest

Vitest is the dominant JavaScript/TypeScript testing framework as of 2025-2026. Angular 21 adopted it as its default test runner, and an estimated 80%+ of new projects use it. Key advantages:

- **Native TypeScript support** -- no `ts-jest` configuration, no SWC wrappers, no `tsconfig` gymnastics
- **Vite-powered** -- reuses Vite's transform pipeline and dev server for instant HMR-like test reruns
- **ESM-native** -- first-class support for ES modules, critical for Effect which is ESM-only
- **Jest-compatible API** -- `describe`, `it`, `expect`, `vi.mock()`, `vi.fn()` all work as expected
- **Built-in watch mode** -- file-level and test-level granularity
- **Vitest 4.0** (stable Dec 2025) -- rewrote pool architecture, removed Tinypool, added stable browser mode and visual regression testing

The `@effect/vitest` package (maintained by the Effect team) provides first-class integration between Vitest and Effect, making it trivial to run Effect programs in tests with proper service injection and resource management.

### 1.2 Installation & Configuration

```bash
# Install vitest and the Effect integration
pnpm add -D vitest @effect/vitest
```

**vitest.config.ts:**

```ts
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    // Use the default 'forks' pool for maximum compatibility
    // Switch to 'threads' for better performance in large suites
    pool: "forks",

    // Include test files matching this pattern
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],

    // Coverage configuration
    coverage: {
      provider: "v8", // or "istanbul"
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/index.ts"],
      reporter: ["text", "html", "lcov"],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },

    // Snapshot settings
    snapshotFormat: {
      printBasicPrototype: false,
    },

    // Global test timeout (Effect tests default to 5000ms)
    testTimeout: 10_000,
  },
})
```

**package.json scripts:**

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui",
    "test:watch": "vitest --watch"
  }
}
```

### 1.3 Testing Effect Programs

The `@effect/vitest` package provides enhanced test runners that understand Effect's type system. The main import replaces vitest's standard `it`:

```ts
import { it, expect } from "@effect/vitest"
```

**Available test runners:**

| Runner          | Description                                                  |
|-----------------|--------------------------------------------------------------|
| `it.effect`     | Runs an Effect with TestContext (TestClock, TestRandom, etc.) |
| `it.live`       | Runs an Effect with the live runtime (real clock, real I/O)  |
| `it.scoped`     | Like `it.effect` but provides a `Scope` for resource mgmt   |
| `it.scopedLive` | Like `it.live` but provides a `Scope`                        |
| `it.flakyTest`  | Retries a flaky Effect until success or timeout              |

#### Basic Effect Test

```ts
import { it, expect } from "@effect/vitest"
import { Effect } from "effect"

function divide(a: number, b: number) {
  if (b === 0) return Effect.fail("Cannot divide by zero")
  return Effect.succeed(a / b)
}

it.effect("divides two numbers", () =>
  Effect.gen(function* () {
    const result = yield* divide(10, 2)
    expect(result).toBe(5)
  })
)
```

#### Testing Failures with Exit

```ts
import { it, expect } from "@effect/vitest"
import { Effect, Exit } from "effect"

it.effect("fails on division by zero", () =>
  Effect.gen(function* () {
    const result = yield* Effect.exit(divide(4, 0))
    expect(result).toStrictEqual(Exit.fail("Cannot divide by zero"))
  })
)
```

#### Using TestClock for Time-Dependent Code

```ts
import { it } from "@effect/vitest"
import { Clock, Effect, TestClock } from "effect"

it.effect("simulates passage of time", () =>
  Effect.gen(function* () {
    const before = yield* Clock.currentTimeMillis
    yield* TestClock.adjust("5 seconds")
    const after = yield* Clock.currentTimeMillis
    expect(after - before).toBe(5000)
  })
)

// Use it.live when you need real system time
it.live("uses real system clock", () =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis
    expect(now).toBeGreaterThan(0)
  })
)
```

#### Scoped Tests for Resource Management

```ts
import { it } from "@effect/vitest"
import { Console, Effect } from "effect"

const resource = Effect.acquireRelease(
  Console.log("acquire").pipe(Effect.as("resource-handle")),
  () => Console.log("release")
)

it.scoped("manages resource lifecycle", () =>
  Effect.gen(function* () {
    const handle = yield* resource
    expect(handle).toBe("resource-handle")
    // Resource is automatically released after the test
  })
)
```

#### Controlling Logging in Tests

By default, `it.effect` suppresses log output. To enable it:

```ts
import { it } from "@effect/vitest"
import { Effect, Logger } from "effect"

// Logging suppressed (default for it.effect)
it.effect("quiet test", () =>
  Effect.gen(function* () {
    yield* Effect.log("this won't print")
  })
)

// Provide a custom logger to see output
it.effect("verbose test", () =>
  Effect.gen(function* () {
    yield* Effect.log("this will print")
  }).pipe(Effect.provide(Logger.pretty))
)

// it.live always shows logs
it.live("live test with logs", () =>
  Effect.gen(function* () {
    yield* Effect.log("this will print")
  })
)
```

### 1.4 Mocking Effect Services & Layers

Effect's architecture makes mocking elegant: services are declared as interfaces via `Context.Tag`, and test implementations are provided via `Layer`. No monkey-patching required.

#### Pattern 1: Providing a Test Layer Inline

```ts
import { it, expect } from "@effect/vitest"
import { Effect, Context, Layer } from "effect"

// Service definition
class UserRepo extends Context.Tag("UserRepo")<
  UserRepo,
  {
    readonly findById: (id: string) => Effect.Effect<{ name: string }>
  }
>() {}

// Production implementation
const UserRepoLive = Layer.succeed(UserRepo, {
  findById: (id) => Effect.succeed({ name: "Real User" }),
})

// Test implementation
const UserRepoTest = Layer.succeed(UserRepo, {
  findById: (id) => Effect.succeed({ name: "Test User" }),
})

// Function under test
const getUser = (id: string) =>
  Effect.gen(function* () {
    const repo = yield* UserRepo
    return yield* repo.findById(id)
  })

it.effect("fetches user from test repo", () =>
  Effect.gen(function* () {
    const user = yield* getUser("123")
    expect(user.name).toBe("Test User")
  }).pipe(Effect.provide(UserRepoTest))
)
```

#### Pattern 2: Using `layer()` to Share Across Tests

The `layer()` function from `@effect/vitest` creates a shared layer for all tests in a describe block. The layer is constructed once and shared across all tests in the block.

```ts
import { it, describe } from "@effect/vitest"
import { Effect, Context, Layer } from "effect"

class Database extends Context.Tag("Database")<
  Database,
  { readonly query: (sql: string) => Effect.Effect<Array<unknown>> }
>() {}

class Cache extends Context.Tag("Cache")<
  Cache,
  { readonly get: (key: string) => Effect.Effect<string | null> }
>() {}

// Compose test layers
const TestDatabase = Layer.succeed(Database, {
  query: (sql) => Effect.succeed([{ id: 1, name: "test" }]),
})

const TestCache = Layer.succeed(Cache, {
  get: (key) => Effect.succeed(null),
})

const TestLayer = Layer.merge(TestDatabase, TestCache)

// All tests in this block share the TestLayer
const test = it.layer(TestLayer)

describe("UserService", () => {
  test("queries database", () =>
    Effect.gen(function* () {
      const db = yield* Database
      const results = yield* db.query("SELECT * FROM users")
      expect(results).toHaveLength(1)
    })
  )

  test("checks cache first", () =>
    Effect.gen(function* () {
      const cache = yield* Cache
      const result = yield* cache.get("user:123")
      expect(result).toBeNull()
    })
  )
})
```

#### Pattern 3: Named Layer Blocks with `layer()`

When you pass a name to `layer()`, it automatically wraps the tests in a `describe` block:

```ts
import { it } from "@effect/vitest"
import { Effect, Layer } from "effect"

const TestEnv = Layer.mergeAll(TestDatabase, TestCache, TestLogger)

it.layer(TestEnv)("with test environment", (test) => {
  test("test one", () =>
    Effect.gen(function* () {
      // All services from TestEnv available here
    })
  )

  test("test two", () =>
    Effect.gen(function* () {
      // Same shared layer instance
    })
  )
})
```

#### Pattern 4: Fresh Layers Per Test

If you need test isolation with a fresh layer per test (no shared state), create a helper:

```ts
import { it, expect } from "@effect/vitest"
import { Effect, Layer } from "effect"

// Helper that provides a fresh layer for each test
const withFreshLayer = <A, E>(
  testLayer: Layer.Layer<A, E>,
  effect: Effect.Effect<void, E, A>
) => effect.pipe(Effect.provide(testLayer))

it.effect("fresh layer test", () =>
  withFreshLayer(
    TestLayer,
    Effect.gen(function* () {
      // This gets a completely fresh layer instance
    })
  )
)
```

#### Pattern 5: Mocking Config

```ts
import { it, expect } from "@effect/vitest"
import { Effect, Config, ConfigProvider, Layer } from "effect"

const program = Effect.gen(function* () {
  const host = yield* Config.string("DATABASE_HOST")
  const port = yield* Config.number("DATABASE_PORT")
  return `${host}:${port}`
})

it.effect("uses mock config", () =>
  program.pipe(
    Effect.map((result) => expect(result).toBe("localhost:5432")),
    Effect.provide(
      Layer.setConfigProvider(
        ConfigProvider.fromMap(
          new Map([
            ["DATABASE_HOST", "localhost"],
            ["DATABASE_PORT", "5432"],
          ])
        )
      )
    )
  )
)
```

### 1.5 Property-Based Testing

`@effect/vitest` integrates with `effect/FastCheck` (a bundled version of fast-check) and supports using Effect `Schema` definitions as arbitrary generators.

```ts
import { it, expect } from "@effect/vitest"
import { Effect, Schema } from "effect"

// Define a schema
const User = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(1)),
  age: Schema.Number.pipe(Schema.int(), Schema.between(0, 150)),
})

// Use schema as property-based test input
it.effect.prop(
  [User],
  "all valid users have non-empty names",
  ([user]) =>
    Effect.gen(function* () {
      expect(user.name.length).toBeGreaterThan(0)
      expect(user.age).toBeGreaterThanOrEqual(0)
      expect(user.age).toBeLessThanOrEqual(150)
    })
)
```

You can also mix fast-check arbitraries with schemas:

```ts
import * as FC from "effect/FastCheck"

it.effect.prop(
  { name: Schema.String, count: FC.integer({ min: 1, max: 100 }) },
  "generates valid inputs",
  ({ name, count }) =>
    Effect.gen(function* () {
      expect(typeof name).toBe("string")
      expect(count).toBeGreaterThanOrEqual(1)
    })
)
```

### 1.6 Snapshot Testing

Vitest provides three snapshot mechanisms:

#### File Snapshots (stored in `__snapshots__/`)

```ts
import { expect, test } from "vitest"

test("serializes AST node", () => {
  const ast = parseCommand("chop build --watch")
  expect(ast).toMatchSnapshot()
})
```

Run `vitest -u` or press `u` in watch mode to update snapshots.

#### Inline Snapshots (stored in the test file itself)

```ts
test("serializes AST node", () => {
  const ast = parseCommand("chop build")
  expect(ast).toMatchInlineSnapshot(`
    {
      "command": "build",
      "args": [],
      "flags": {}
    }
  `)
})
```

Vitest auto-updates the inline string when you run with `-u`.

#### File Snapshots (explicit file path)

```ts
test("generates help text", async () => {
  const help = await generateHelp("chop")
  await expect(help).toMatchFileSnapshot("./golden/help-output.txt")
})
```

This is particularly useful for golden-file testing of CLI output.

### 1.7 Coverage Reporting

Vitest supports two coverage providers: **v8** (default, faster) and **istanbul** (traditional, more mature). Since Vitest v3.2, v8 uses AST-based coverage remapping that produces identical reports to Istanbul with better performance.

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.d.ts",
        "src/**/index.ts",
      ],
      reporter: ["text", "html", "lcov", "json-summary"],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
      // Show files with no test coverage
      all: true,
    },
  },
})
```

Run coverage:

```bash
vitest run --coverage
```

For CI, use `lcov` reporter and upload to Codecov/Coveralls.

### 1.8 Project Structure for Large Codebases

Vitest supports **projects** (formerly workspaces) for monorepo-style setups and mixed test configurations.

**Recommended directory structure for chop:**

```
chop/
  src/
    cli/
      commands/
        build.ts
        build.test.ts          # co-located unit tests
      parser.ts
      parser.test.ts
    tui/
      components/
        StatusBar.ts
        StatusBar.test.ts
      App.ts
    core/
      services/
        FileSystem.ts
        FileSystem.test.ts
  test/
    e2e/
      tui.test.ts              # tui-test E2E tests
    integration/
      cli-flow.test.ts         # integration tests
    golden/
      help-output.txt           # golden files
  tapes/
    demo.tape                   # VHS tapes
    help.tape
  vitest.config.ts
  tui-test.config.ts
```

**Multi-project configuration:**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    projects: [
      {
        // Unit tests -- fast, parallel
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          pool: "threads",
          isolate: false, // faster for pure unit tests
        },
      },
      {
        // Integration tests -- isolated
        test: {
          name: "integration",
          include: ["test/integration/**/*.test.ts"],
          pool: "forks",
          testTimeout: 30_000,
        },
      },
    ],
  },
})
```

### 1.9 Performance & Parallelism

#### Pool Types (Vitest 4.0+)

| Pool        | Mechanism                    | Best For                              |
|-------------|------------------------------|---------------------------------------|
| `forks`     | Child processes (default)    | Maximum compatibility, hanging tests  |
| `threads`   | Worker threads               | Faster for large suites               |
| `vmForks`   | Child processes + VM context | Module-level isolation                |
| `vmThreads` | Worker threads + VM context  | Fast module-level isolation           |

#### Key Performance Settings

```ts
// vitest.config.ts
export default defineConfig({
  test: {
    pool: "threads",           // Faster than forks for most workloads
    maxWorkers: "75%",         // Use 75% of CPU cores
    minWorkers: 1,
    isolate: false,            // Disable for pure unit tests (big speedup)
    fileParallelism: true,     // Run test files in parallel (default)
    sequence: {
      concurrent: true,        // Run tests within a file concurrently
    },
  },
})
```

#### Per-Test Concurrency

```ts
describe.concurrent("parallel tests", () => {
  it.effect("test A", () => /* ... */)
  it.effect("test B", () => /* ... */) // Runs at the same time as A
})
```

#### Vitest UI

Vitest ships with a browser-based UI for visualizing test runs:

```bash
pnpm vitest --ui
```

---

## 2. Microsoft tui-test

### 2.1 Overview

`@microsoft/tui-test` is an end-to-end testing framework for terminal applications built by Microsoft. It provides a Playwright-inspired API for writing tests that interact with real terminal processes. It uses xterm.js (the same terminal emulator powering VS Code's integrated terminal) for rendering, and node-pty for pseudo-terminal management.

- **Repository:** https://github.com/microsoft/tui-test
- **npm:** `@microsoft/tui-test`
- **License:** MIT
- **Stars:** ~114
- **Latest Version:** 0.0.1-rc.5 (March 2024)

### 2.2 Installation & Setup

```bash
pnpm add -D @microsoft/tui-test
```

**tui-test.config.ts:**

```ts
import { defineConfig } from "@microsoft/tui-test"

export default defineConfig({
  retries: 3,
  trace: true,
})
```

**Run tests:**

```bash
npx @microsoft/tui-test
```

tui-test has its own test runner; it does NOT run inside vitest. Tests are written in separate files that import from `@microsoft/tui-test`.

### 2.3 Architecture & How It Works

The architecture has several layers:

1. **CLI Entry Point** -- parses arguments, discovers test files, orchestrates execution
2. **Test Framework Core** -- manages test registration, lifecycle, describe/test blocks
3. **Terminal Management** -- creates isolated terminal contexts per test using node-pty + xterm.js
4. **Worker Pool** -- leverages `workerpool` for parallel test execution across processes

For each test:
- A fresh pseudo-terminal (PTY) is created via `node-pty`
- A headless `@xterm/headless` terminal emulator renders the PTY output
- The test interacts with the terminal via the fixture API
- After assertions, the PTY is killed and resources released

This gives **full test isolation** -- each test gets its own terminal process, environment variables, and working directory. Context creation takes only a few milliseconds.

### 2.4 Terminal Context API

Every test receives a `terminal` fixture:

```ts
import { test, expect } from "@microsoft/tui-test"

test("example", async ({ terminal }) => {
  // Input methods
  terminal.write("hello")           // Send raw text
  terminal.submit("echo hi")        // Send text + Enter
  terminal.submit()                 // Just press Enter

  // Keyboard
  terminal.keyUp(3)                 // Press Up arrow 3 times
  terminal.keyDown()
  terminal.keyLeft(2)
  terminal.keyRight()
  terminal.keyBackspace(5)
  terminal.keyDelete(2)
  terminal.keyEscape()
  terminal.keyCtrlC()
  terminal.keyCtrlD()

  // Terminal state
  terminal.resize(80, 24)           // Resize to 80 cols x 24 rows
  const cursor = terminal.getCursor() // { x, y, baseY }
  const buffer = terminal.getBuffer()
  const visible = terminal.getViewableBuffer()
  const snapshot = terminal.serialize()

  // Locators (Playwright-style)
  const locator = terminal.getByText("pattern")
  const regexLocator = terminal.getByText(/regex/g)

  // Kill the terminal
  terminal.kill()
})
```

### 2.5 Assertions & Locators

tui-test provides custom matchers that auto-wait for terminal renders:

```ts
import { test, expect } from "@microsoft/tui-test"

test("rich assertions", async ({ terminal }) => {
  terminal.submit("echo hello")

  // Text visibility (auto-waits for render)
  await expect(terminal.getByText("hello")).toBeVisible()
  await expect(terminal.getByText("goodbye")).not.toBeVisible()

  // Regex matching
  await expect(terminal.getByText(/hello\s+world/g)).toBeVisible()

  // Full-line matching
  await expect(terminal.getByText("usage: git", { full: true })).toBeVisible()

  // Strict mode (text must appear exactly once)
  await expect(terminal.getByText("unique", { strict: true })).toBeVisible()

  // Color assertions
  await expect(terminal.getByText(">")).toHaveBgColor(0)        // By index
  await expect(terminal.getByText(">")).toHaveBgColor([0, 0, 0]) // By RGB
  await expect(terminal.getByText("error")).toHaveFgColor(1)     // Red

  // Snapshot
  await expect(terminal).toMatchSnapshot()
})
```

### 2.6 Snapshot / Golden File Support

tui-test supports snapshot testing similar to Jest/Vitest snapshots:

```ts
import { test, expect, Shell } from "@microsoft/tui-test"

test.use({ shell: Shell.Zsh, rows: 10, columns: 40 })

test("take a screenshot", async ({ terminal }) => {
  terminal.write("foo")
  await expect(terminal.getByText("foo")).toBeVisible()
  await expect(terminal).toMatchSnapshot()
})
```

Snapshots are stored in `__snapshots__/` directories adjacent to the test file. Update with:

```bash
npx @microsoft/tui-test -u
```

### 2.7 Configuration

**tui-test.config.ts:**

```ts
import { defineConfig } from "@microsoft/tui-test"

export default defineConfig({
  retries: 3,         // Retry failed tests
  trace: true,        // Enable trace recording
})
```

**Per-test configuration via `test.use()`:**

```ts
import { test, Shell } from "@microsoft/tui-test"

// Set shell
test.use({ shell: Shell.Zsh })

// Set terminal dimensions
test.use({ rows: 24, columns: 80 })

// Set environment variables
test.use({ env: { NODE_ENV: "test", TERM: "xterm-256color" } })

// Run a specific program instead of a shell
test.use({ program: { file: "node", args: ["./dist/cli.js", "--help"] } })
```

**Supported shells:**

| Platform | Shells                                          |
|----------|-------------------------------------------------|
| macOS    | bash, zsh, fish, pwsh                           |
| Linux    | bash, zsh, fish, xonsh                          |
| Windows  | cmd, powershell, windows powershell, git-bash   |

### 2.8 CI Integration

tui-test works in CI environments. Enable tracing for debugging failures:

```yaml
# .github/workflows/tui-test.yml
name: TUI E2E Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: pnpm install
      - run: npx @microsoft/tui-test --trace
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: tui-traces-${{ matrix.os }}
          path: tui-traces/
```

**Trace replay:**

```bash
npx @microsoft/tui-test show-trace tui-traces/<trace-file>
```

Traces contain a full replay of everything the terminal received and are invaluable for diagnosing platform-specific failures.

### 2.9 Maturity & Current Status

**Status: Early / Pre-release**

- Latest release: `0.0.1-rc.5` (March 11, 2024)
- Last commit: March 11, 2024
- No commits in approximately 2 years
- 0 dependents in the npm registry
- 114 GitHub stars, 10 forks
- Node.js requirement: 16.6.0+ (max below 21.0.0)

**Assessment:** tui-test is a well-designed framework with a clean API inspired by Playwright. However, it is in **pre-release** status with **no activity for ~2 years**. The API surface is small but functional. For our purposes, it is worth using because:

1. It solves exactly the problem we have (testing TUI applications end-to-end)
2. The API is stable enough for our needs
3. There is no mature alternative in the TypeScript ecosystem for TUI testing
4. The xterm.js foundation is rock-solid (VS Code uses it)

**Risks:**
- No upstream maintenance means we own any bugs we find
- Breaking changes in node-pty or xterm.js could require us to patch
- TypeScript version bumps might cause issues

### 2.10 Alternatives

| Tool           | Language   | Type        | Notes                                           |
|----------------|------------|-------------|--------------------------------------------------|
| **tui-test**   | TypeScript | E2E         | Playwright-style API, xterm.js, pre-release     |
| **BATS**       | Bash       | CLI testing | Mature, TAP-compliant, no TUI support           |
| **Expect**     | Tcl        | CLI testing | Ancient but battle-tested, no screenshot/color  |
| **tmux-based** | Any        | E2E         | DIY approach: spawn in tmux, capture pane       |
| **VHS**        | Go         | Recording   | Not a test runner but can produce golden files  |

For TypeScript TUI E2E testing specifically, tui-test is the only dedicated option. The alternatives are either for CLI-only (not full TUI) testing, or require significant DIY scaffolding.

### 2.11 Full Example Tests

**Testing a TUI application (chop):**

```ts
import { test, expect, Shell } from "@microsoft/tui-test"
import os from "node:os"

const shell = os.platform() === "darwin" ? Shell.Zsh : Shell.Bash

test.use({
  shell,
  columns: 120,
  rows: 30,
  env: { TERM: "xterm-256color" },
})

test("chop launches and shows welcome screen", async ({ terminal }) => {
  terminal.submit("./dist/chop")
  await expect(terminal.getByText("chop")).toBeVisible()
  await expect(terminal).toMatchSnapshot()
})

test("chop responds to keyboard navigation", async ({ terminal }) => {
  terminal.submit("./dist/chop")
  await expect(terminal.getByText("chop")).toBeVisible()

  terminal.keyDown(3)
  terminal.keyUp(1)
  await expect(terminal).toMatchSnapshot()
})

test("chop exits cleanly with q", async ({ terminal }) => {
  terminal.submit("./dist/chop")
  await expect(terminal.getByText("chop")).toBeVisible()

  terminal.write("q")
  // Terminal should return to shell prompt
  await expect(terminal.getByText(">")).toBeVisible()
})

test("chop help flag shows usage", async ({ terminal }) => {
  terminal.submit("./dist/chop --help")
  await expect(terminal.getByText("Usage:", { full: true })).toBeVisible()
  await expect(terminal).toMatchSnapshot()
})
```

**Testing program mode directly:**

```ts
import { test, expect } from "@microsoft/tui-test"

test.use({
  program: { file: "node", args: ["./dist/chop.js"] },
  columns: 120,
  rows: 30,
})

test("renders initial state", async ({ terminal }) => {
  await expect(terminal.getByText("chop")).toBeVisible()
  await expect(terminal).toMatchSnapshot()
})
```

**Testing across shells:**

```ts
import { test, expect, Shell } from "@microsoft/tui-test"
import os from "node:os"

const shells = os.platform() === "win32"
  ? [Shell.Cmd, Shell.Powershell]
  : [Shell.Bash, Shell.Zsh]

shells.forEach((shell) => {
  test.describe(`[${shell}]`, () => {
    test.use({ shell })

    test("chop runs in this shell", async ({ terminal }) => {
      terminal.submit("./dist/chop --version")
      await expect(terminal.getByText(/\d+\.\d+\.\d+/g)).toBeVisible()
    })
  })
})
```

---

## 3. Charmbracelet VHS

### 3.1 Overview

VHS (Video Home System) by Charmbracelet is a tool for writing terminal GIFs as code. You author declarative `.tape` files that script terminal interactions, and VHS renders them into GIF, MP4, WebM, PNG sequences, or plain ASCII text. It is particularly useful for:

- **Demo generation** -- keep README GIFs up to date automatically
- **Golden file testing** -- generate `.ascii` or `.txt` output and diff against stored golden files
- **Visual regression** -- detect rendering changes in CI

- **Repository:** https://github.com/charmbracelet/vhs
- **License:** MIT
- **Latest Version:** v0.10.0 (June 2025)
- **Written in:** Go

### 3.2 Installation & Dependencies

VHS requires `ttyd` and `ffmpeg` to be installed.

**macOS (Homebrew):**

```bash
brew install vhs
# This also installs ttyd and ffmpeg as dependencies
```

**Linux (apt):**

```bash
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://repo.charm.sh/apt/gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/charm.gpg
echo "deb [signed-by=/etc/apt/keyrings/charm.gpg] https://repo.charm.sh/apt/ * *" | sudo tee /etc/apt/sources.list.d/charm.list
# Install ttyd from https://github.com/tsl0922/ttyd/releases
sudo apt update && sudo apt install vhs ffmpeg
```

**Docker (dependencies included):**

```bash
docker run --rm -v $PWD:/vhs ghcr.io/charmbracelet/vhs demo.tape
```

**Go:**

```bash
go install github.com/charmbracelet/vhs@latest
```

### 3.3 Tape File Syntax

Tape files are declarative scripts. Each line is a command. Comments start with `#`.

#### Command Reference

| Command                        | Description                                   |
|-------------------------------|-----------------------------------------------|
| `Output <path>`              | Set output file (gif/mp4/webm/frames/)       |
| `Require <program>`          | Fail early if program not in PATH             |
| `Set <Setting> <Value>`      | Configure terminal settings                   |
| `Type "<text>"`              | Type characters into terminal                 |
| `Type@<time> "<text>"`       | Type with custom speed per character          |
| `Enter [count]`             | Press Enter                                   |
| `Backspace [count]`         | Press Backspace                               |
| `Delete [count]`            | Press Delete                                  |
| `Tab [count]`               | Press Tab                                     |
| `Space [count]`             | Press Space                                   |
| `Up [count]`                | Press Up arrow                                |
| `Down [count]`              | Press Down arrow                              |
| `Left [count]`              | Press Left arrow                              |
| `Right [count]`             | Press Right arrow                             |
| `PageUp [count]`            | Press Page Up                                 |
| `PageDown [count]`          | Press Page Down                               |
| `Ctrl+<key>`                | Press Ctrl+key combo                          |
| `Escape [count]`            | Press Escape                                  |
| `Sleep <duration>`          | Pause (e.g., `500ms`, `2s`, `1.5`)           |
| `Wait /regex/`              | Wait for text to appear on screen             |
| `Wait+Screen /regex/`       | Wait checking full screen                     |
| `Wait+Line /regex/`         | Wait checking last line only                  |
| `Wait@<timeout> /regex/`    | Wait with custom timeout                      |
| `Hide`                       | Stop capturing frames                         |
| `Show`                       | Resume capturing frames                       |
| `Screenshot <path>`         | Capture current frame as PNG                  |
| `Copy "<text>"`             | Copy text to clipboard                        |
| `Paste`                      | Paste from clipboard                          |
| `Source <file.tape>`        | Include commands from another tape             |
| `Env <KEY> <value>`         | Set environment variable                      |

All key commands accept optional `@<time>` for repeat interval and optional `count`:

```
Key[@<time>] [count]

# Examples:
Enter                    # Press Enter once
Enter 3                  # Press Enter 3 times
Down@500ms 5             # Press Down every 500ms, 5 times
Backspace@100ms 10       # Press Backspace every 100ms, 10 times
```

#### Escaping Quotes

Use backticks to escape quotes:

```
Type `echo "hello world"`
Type `VAR='value'`
```

### 3.4 Output Formats

```
Output demo.gif          # Animated GIF (most common)
Output demo.mp4          # MP4 video
Output demo.webm         # WebM video
Output frames/           # Directory of PNG frames
Output golden.ascii      # Plain text (for golden file testing)
Output golden.txt        # Same as .ascii
```

You can specify **multiple outputs** in a single tape:

```
Output demo.gif
Output demo.mp4
Output golden.ascii
```

### 3.5 Settings Reference

Settings must appear at the top of the tape, before any interaction commands. Exception: `TypingSpeed` can be set anywhere.

```
# Terminal dimensions
Set Width 1200             # Pixel width of the rendered output
Set Height 600             # Pixel height of the rendered output

# Font
Set FontSize 16            # Font size in pixels
Set FontFamily "JetBrains Mono"
Set LetterSpacing 1        # Tracking (pixels between letters)
Set LineHeight 1.2         # Line height multiplier

# Shell
Set Shell "bash"           # Shell to use (bash, zsh, fish, etc.)

# Typing
Set TypingSpeed 50ms       # Delay between keystrokes (default: 50ms)

# Rendering
Set Framerate 30           # Frames per second
Set PlaybackSpeed 1.0      # 0.5 = half speed, 2.0 = double speed
Set LoopOffset 5           # GIF loop starts at frame 5
Set LoopOffset 50%         # GIF loop starts at 50%

# Appearance
Set Theme "Catppuccin Mocha"  # Named theme (run `vhs themes` for list)
Set Theme { "name": "Custom", "background": "#1e1e2e", ... }
Set Padding 20             # Terminal padding in pixels
Set Margin 20              # Video margin in pixels
Set MarginFill "#6B50FF"   # Margin background color
Set BorderRadius 10        # Terminal border radius in pixels
Set WindowBar Colorful     # Window bar style: Colorful, ColorfulRight, Rings, RingsRight
Set WindowBarSize 40       # Window bar height in pixels
Set CursorBlink false      # Disable cursor blinking
```

### 3.6 Golden File Testing

VHS can generate `.ascii` or `.txt` output for deterministic text comparison. This is the key integration point for CI-based visual regression testing.

**golden-test.tape:**

```
Output golden/chop-help.ascii

Require node

Set Shell "bash"
Set Width 1200
Set Height 600

Hide
Type "node ./dist/chop.js --help"
Enter
Sleep 1s
Show

Sleep 2s
```

**CI workflow to check for golden file drift:**

```bash
#!/bin/bash
# scripts/golden-test.sh

vhs tapes/chop-help.tape

if ! git diff --exit-code golden/; then
  echo "Golden files have changed! Run 'vhs tapes/chop-help.tape' and commit the updated golden files."
  exit 1
fi
```

**Using with Vitest's `toMatchFileSnapshot`:**

```ts
// test/golden/golden.test.ts
import { readFileSync } from "fs"
import { execSync } from "child_process"
import { test, expect } from "vitest"

test("chop help output matches golden file", () => {
  // Regenerate the golden file
  execSync("vhs tapes/chop-help.tape", { stdio: "inherit" })

  const golden = readFileSync("golden/chop-help.ascii", "utf-8")
  expect(golden).toMatchFileSnapshot("./golden/chop-help.ascii.snap")
})
```

### 3.7 CI Integration with vhs-action

Charmbracelet provides an official GitHub Action for running VHS in CI.

**Auto-commit workflow (regenerate GIFs on push):**

```yaml
# .github/workflows/vhs.yml
name: VHS
on:
  push:
    paths:
      - "tapes/*.tape"
      - "src/**"

jobs:
  vhs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: charmbracelet/vhs-action@v2
        with:
          path: "tapes/demo.tape"

      - uses: stefanzweifel/git-auto-commit-action@v5
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          commit_message: "chore: update generated VHS GIF"
          branch: main
          file_pattern: "*.gif *.ascii"
```

**Golden file check workflow:**

```yaml
# .github/workflows/golden-test.yml
name: Golden File Check
on: [pull_request]

jobs:
  golden:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: charmbracelet/vhs-action@v2
        with:
          path: "tapes/golden-help.tape"

      - name: Check for golden file drift
        run: |
          if ! git diff --exit-code golden/; then
            echo "::error::Golden files have changed. Please regenerate and commit."
            git diff golden/
            exit 1
          fi
```

**Comment on PR with generated GIF:**

```yaml
name: PR Demo GIF
on:
  pull_request:
    paths:
      - "tapes/demo.tape"

jobs:
  pr:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: charmbracelet/vhs-action@v2
        with:
          path: "tapes/demo.tape"
      - uses: devicons/public-upload-to-imgur@v2.2.2
        id: imgur
        with:
          path: ./demo.gif
          client_id: ${{ secrets.IMGUR_CLIENT_ID }}
      - uses: github-actions-up-and-running/pr-comment@v1.0.1
        with:
          repo-token: ${{ secrets.GITHUB_TOKEN }}
          message: |
            ![Demo GIF](${{ fromJSON(steps.imgur.outputs.imgur_urls)[0] }})
```

**vhs-action inputs:**

| Input           | Default                     | Description                       |
|----------------|-----------------------------|-----------------------------------|
| `path`         | `""` (install only)         | Path to `.tape` file              |
| `version`      | `"latest"`                  | VHS version to install            |
| `token`        | `${{ github.token }}`       | GitHub token                      |
| `install-fonts`| `"false"`                   | Install extra fonts (Nerd Fonts)  |

### 3.8 Parameterization & Templating

VHS does not have built-in templating. However, there are several effective patterns:

#### Pattern 1: Environment Variables via `Env`

```
# tapes/versioned-demo.tape
Output demo.gif

Env VERSION "1.0.0"

Set Shell "bash"
Set Width 1200
Set Height 600

Type "echo $VERSION"
Enter
Sleep 2s
```

#### Pattern 2: Shell Environment Pass-Through

VHS inherits the parent shell's environment, so you can set variables before running:

```bash
VERSION=$(node -p "require('./package.json').version") vhs tapes/demo.tape
```

#### Pattern 3: `Source` for Shared Configuration

Create a shared config tape and source it:

**tapes/config.tape:**

```
Set Shell "bash"
Set FontSize 16
Set FontFamily "JetBrains Mono"
Set Width 1200
Set Height 600
Set Theme "Catppuccin Mocha"
Set TypingSpeed 30ms
```

**tapes/demo.tape:**

```
Source tapes/config.tape
Output demo.gif

Type "chop --help"
Enter
Sleep 3s
```

#### Pattern 4: Script-Generated Tapes

Generate tape files programmatically for parameterized demos:

```bash
#!/bin/bash
# scripts/gen-tapes.sh

for cmd in "build" "dev" "test" "lint"; do
  cat > "tapes/cmd-${cmd}.tape" <<EOF
Source tapes/config.tape
Output demos/chop-${cmd}.gif
Output golden/chop-${cmd}.ascii

Require node

Hide
Type "node ./dist/chop.js ${cmd} --help"
Enter
Sleep 1s
Show

Sleep 3s
EOF
done
```

#### Pattern 5: `envsubst` for Templates

```bash
# tapes/template.tape.tmpl
Source tapes/config.tape
Output demos/chop-${COMMAND}.gif

Type "chop ${COMMAND} ${ARGS}"
Enter
Sleep 3s
```

```bash
COMMAND=build ARGS="--watch" envsubst < tapes/template.tape.tmpl | vhs -
```

(Note: VHS reads from stdin when you pass `-` as the tape argument.)

### 3.9 Real-World Tape Examples

#### Demo for a TUI Application

```
# tapes/chop-demo.tape
Output demos/chop-demo.gif
Output demos/chop-demo.mp4

Require node

Set Shell "bash"
Set FontSize 18
Set FontFamily "JetBrains Mono"
Set Width 1200
Set Height 700
Set Theme "Catppuccin Mocha"
Set TypingSpeed 40ms
Set WindowBar Colorful
Set Padding 20
Set Margin 20
Set MarginFill "#1e1e2e"
Set BorderRadius 8

# Build first (hidden)
Hide
Type "npm run build && clear"
Enter
Sleep 2s
Show

# Launch the TUI
Type "chop"
Sleep 500ms
Enter

# Wait for it to render
Sleep 2s

# Navigate with arrow keys
Down@300ms 3
Sleep 500ms
Up@300ms 1
Sleep 500ms

# Select an item
Enter
Sleep 2s

# Exit
Type "q"
Sleep 1s
```

#### Recording a CLI Help Screen

```
# tapes/chop-help.tape
Output demos/chop-help.gif
Output golden/chop-help.ascii

Require node

Set Shell "bash"
Set FontSize 16
Set Width 1000
Set Height 400
Set TypingSpeed 30ms
Set CursorBlink false

Type "chop --help"
Sleep 500ms
Enter
Sleep 3s
```

#### Interactive Prompt Demo

```
# tapes/chop-init.tape
Output demos/chop-init.gif

Set Shell "bash"
Set FontSize 18
Set Width 1200
Set Height 600
Set TypingSpeed 50ms

Type "chop init"
Enter

# Wait for the prompt to appear
Wait /Project name/
Sleep 500ms

Type "my-project"
Enter

Wait /Select template/
Sleep 500ms

Down 2
Enter

Wait /Install dependencies/
Sleep 500ms

Type "y"
Enter

Sleep 3s
```

#### Bubbletea-style TUI (build + run + cleanup)

```
# tapes/chop-tui.tape
Output demos/chop-tui.gif

Set Shell "bash"
Set Width 1200
Set Height 700

# Build (hidden from output)
Hide
Type "npm run build && clear"
Enter
Sleep 2s
Show

# Run the TUI
Type "./dist/chop"
Enter
Sleep 2s

# Interact
Down 3
Enter
Sleep 2s
Tab
Sleep 1s

# Exit
Ctrl+C
Sleep 1s

# Cleanup (hidden)
Hide
Type "clear"
Enter
```

#### Recording with `vhs record`

You can also record a tape interactively:

```bash
vhs record > tapes/recorded.tape
# Perform actions in the terminal...
# Type 'exit' to stop recording
```

Then edit the generated tape and re-run:

```bash
vhs tapes/recorded.tape
```

---

## 4. Recommended Setup for Chop

### Directory Structure

```
chop/
  src/
    cli/
      commands/
        *.ts
        *.test.ts           # Vitest unit tests (co-located)
    tui/
      components/
        *.ts
        *.test.ts           # Vitest unit tests (co-located)
    core/
      services/
        *.ts
        *.test.ts           # Vitest unit tests (co-located)
  test/
    e2e/
      chop-tui.test.ts      # tui-test E2E tests
      chop-cli.test.ts      # tui-test CLI E2E tests
    golden/
      chop-help.ascii       # Golden files (generated by VHS)
      chop-version.ascii
  tapes/
    config.tape             # Shared VHS settings
    demo.tape               # Main demo GIF
    chop-help.tape          # Help output tape
    chop-init.tape          # Init flow tape
  demos/
    demo.gif                # Generated GIFs (gitignored or committed)
  vitest.config.ts
  tui-test.config.ts
  package.json
```

### package.json Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui",
    "test:e2e": "npx @microsoft/tui-test",
    "test:e2e:trace": "npx @microsoft/tui-test --trace",
    "test:e2e:update": "npx @microsoft/tui-test -u",
    "test:all": "vitest run && npx @microsoft/tui-test",
    "demo": "vhs tapes/demo.tape",
    "demo:all": "for f in tapes/*.tape; do vhs \"$f\"; done",
    "golden": "vhs tapes/chop-help.tape && vhs tapes/chop-version.tape",
    "golden:check": "bash scripts/golden-check.sh"
  }
}
```

### CI Workflow

```yaml
# .github/workflows/test.yml
name: Test Suite
on: [push, pull_request]

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: pnpm install
      - run: pnpm test:run
      - run: pnpm test:coverage
      - uses: codecov/codecov-action@v4
        with:
          files: coverage/lcov.info

  e2e:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: pnpm install
      - run: pnpm build
      - run: pnpm test:e2e --trace
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: tui-traces-${{ matrix.os }}
          path: tui-traces/

  golden:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: pnpm install && pnpm build
      - uses: charmbracelet/vhs-action@v2
        with:
          path: "tapes/chop-help.tape"
      - name: Check golden files
        run: |
          if ! git diff --exit-code test/golden/; then
            echo "::error::Golden files have drifted"
            git diff test/golden/
            exit 1
          fi

  demo:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: pnpm install && pnpm build
      - uses: charmbracelet/vhs-action@v2
        with:
          path: "tapes/demo.tape"
      - uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: "chore: regenerate demo GIF"
          file_pattern: "demos/*.gif"
```

### Summary of the Three-Tool Stack

| Concern                    | Tool                 | Purpose                                    |
|---------------------------|----------------------|--------------------------------------------|
| Unit / integration tests   | Vitest + @effect/vitest | Test Effect services, layers, pure logic |
| Property-based testing     | @effect/vitest + FastCheck | Schema-driven generative testing       |
| TUI E2E tests             | @microsoft/tui-test  | Real terminal interaction, snapshot diffs  |
| Demo GIF generation       | VHS                  | Declarative terminal recordings            |
| Golden file regression    | VHS (.ascii output)  | Text-based visual regression in CI         |
| Coverage                  | Vitest (v8/istanbul) | Line/branch/function coverage reporting    |

This stack gives comprehensive coverage: Vitest handles fast unit/integration tests with full Effect support, tui-test validates that the actual TUI renders and responds correctly in a real terminal, and VHS generates both demos for documentation and golden files for visual regression testing.
