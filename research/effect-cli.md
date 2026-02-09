# @effect/cli Research Document

Comprehensive research on using Effect's CLI framework to build command-line applications in TypeScript.

**Date:** 2026-02-09
**Package version at time of research:** @effect/cli 0.73.2
**Ecosystem status:** Effect surpassed 6M npm weekly downloads, 12K+ GitHub stars; recognized in Thoughtworks Technology Radar Vol 32. 140+ npm packages depend on @effect/cli.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Installation and Setup](#2-installation-and-setup)
3. [Core Modules](#3-core-modules)
4. [Defining Commands](#4-defining-commands)
5. [Arguments (Args)](#5-arguments-args)
6. [Options (Flags)](#6-options-flags)
7. [Subcommands](#7-subcommands)
8. [Interactive Prompts](#8-interactive-prompts)
9. [Help Text Generation](#9-help-text-generation)
10. [Built-in Options](#10-built-in-options)
11. [Effect Fundamentals for CLI](#11-effect-fundamentals-for-cli)
12. [Services and Layers](#12-services-and-layers)
13. [Error Handling](#13-error-handling)
14. [Configuration System](#14-configuration-system)
15. [FileSystem and Platform](#15-filesystem-and-platform)
16. [Terminal and I/O](#16-terminal-and-io)
17. [Executing External Processes](#17-executing-external-processes)
18. [Schema for Validation](#18-schema-for-validation)
19. [Testing Patterns](#19-testing-patterns)
20. [Structuring a Large CLI](#20-structuring-a-large-cli)
21. [Bundle Size and Performance](#21-bundle-size-and-performance)
22. [Complete Examples](#22-complete-examples)
23. [Comparison with Alternatives](#23-comparison-with-alternatives)
24. [Sources](#24-sources)

---

## 1. Architecture Overview

@effect/cli is built on Effect's functional programming paradigm and provides a declarative, type-safe approach to building CLI applications. The architecture is modular:

```
@effect/cli
  - Command     : Define commands with config (args + options) and handlers
  - Args        : Positional argument definitions
  - Options     : Named flags and options
  - Prompt      : Interactive user prompts
  - CliApp      : Application configuration (name, version)
  - CliConfig   : CLI configuration settings
  - HelpDoc     : Help documentation generation
  - ValidationError : Error handling for validation
  - ConfigFile  : Configuration file handling
  - BuiltInOptions : Pre-configured --help, --version, --wizard, --completions

@effect/platform (peer dependency)
  - FileSystem  : Read/write files
  - Terminal    : Console I/O, readline, terminal dimensions
  - Command     : Execute external processes (different from @effect/cli Command)
  - Path        : File path utilities
  - KeyValueStore : Data storage
  - Runtime     : Run programs with error handling

@effect/printer & @effect/printer-ansi (peer dependencies)
  - ANSI-styled text output for help rendering
```

### Dependency Chain

```
@effect/cli
  depends on -> effect (core)
  depends on -> @effect/platform
  depends on -> @effect/printer
  depends on -> @effect/printer-ansi
```

Platform-specific runtime packages:
- `@effect/platform-node` for Node.js/Deno
- `@effect/platform-bun` for Bun

### Key Design Principles

1. **Declarative** - Commands, args, and options are data structures, not imperative code
2. **Type-safe** - Full type inference from command config through handler parameters
3. **Composable** - Commands compose via `withSubcommands`, options compose via `all`
4. **Effect-native** - Handlers return `Effect<A, E, R>`, integrating with the full Effect ecosystem
5. **Platform-independent** - Same code runs on Node.js, Bun, and Deno via platform layers
6. **Tree-shakeable** - Exports functions (not methods) for optimal tree-shaking

---

## 2. Installation and Setup

### For Node.js

```bash
npm install @effect/cli @effect/platform @effect/platform-node effect
```

### For Bun

```bash
bun add @effect/cli @effect/platform @effect/platform-bun effect
```

### Minimal Entrypoint (Node.js)

```typescript
import { Command } from "@effect/cli"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import { Console, Effect } from "effect"

const app = Command.make("hello", {}, () =>
  Console.log("Hello, World!")
)

const cli = Command.run(app, {
  name: "hello",
  version: "1.0.0"
})

cli(process.argv).pipe(
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain
)
```

### Minimal Entrypoint (Bun)

```typescript
import { Command } from "@effect/cli"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Console, Effect } from "effect"

const app = Command.make("hello", {}, () =>
  Console.log("Hello, World!")
)

const cli = Command.run(app, {
  name: "hello",
  version: "1.0.0"
})

cli(process.argv).pipe(
  Effect.provide(BunContext.layer),
  BunRuntime.runMain
)
```

### tsconfig.json Requirements

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "downlevelIteration": true,
    "exactOptionalPropertyTypes": true
  }
}
```

The `downlevelIteration` flag (or `target >= ES2015`) is required for `Effect.gen` generator syntax.

---

## 3. Core Modules

| Module | Import | Purpose |
|--------|--------|---------|
| `Command` | `@effect/cli` | Define and compose CLI commands |
| `Args` | `@effect/cli` | Define positional arguments |
| `Options` | `@effect/cli` | Define named flags/options |
| `Prompt` | `@effect/cli` | Interactive user prompts |
| `HelpDoc` | `@effect/cli` | Help documentation DSL |
| `CliConfig` | `@effect/cli` | CLI parser configuration |
| `ValidationError` | `@effect/cli` | CLI validation error type |
| `ConfigFile` | `@effect/cli` | Config file loading (JSON, TOML, YAML, INI) |
| `BuiltInOptions` | `@effect/cli` | Built-in --help, --version, etc. |

---

## 4. Defining Commands

### Command.make

The primary constructor. Signature:

```typescript
Command.make(name: string): Command<Name, never, never, {}>
Command.make(name: string, config: Config): Command<Name, never, never, ParsedConfig>
Command.make(name: string, config: Config, handler: (config: ParsedConfig) => Effect<A, E, R>): Command<Name, A, E, R>
```

### Basic Command (no args/options)

```typescript
const hello = Command.make("hello", {}, () =>
  Console.log("Hello!")
)
```

### Command with Config

```typescript
const greet = Command.make(
  "greet",
  {
    name: Args.text({ name: "name" }),
    shout: Options.boolean("shout").pipe(Options.withAlias("s"))
  },
  ({ name, shout }) => {
    const message = `Hello, ${name}!`
    return Console.log(shout ? message.toUpperCase() : message)
  }
)
```

The `config` object is a record of `{ [key: string]: Args<A> | Options<B> }`. Keys become the property names in the handler's parameter object, fully type-inferred.

### Command with Description

```typescript
const greet = Command.make("greet", { name }, ({ name }) =>
  Console.log(`Hello, ${name}!`)
).pipe(Command.withDescription("Greet someone by name"))
```

### Command with Handler Added Later

```typescript
const greet = Command.make("greet", { name })

const greetWithHandler = greet.pipe(
  Command.withHandler(({ name }) =>
    Console.log(`Hello, ${name}!`)
  )
)
```

### Command.fromDescriptor

Build commands from descriptor objects (advanced use):

```typescript
const cmd = Command.fromDescriptor(descriptor, handler)
```

### Command.prompt

Create a command that is entirely an interactive prompt:

```typescript
const askName = Command.prompt("ask", Prompt.text({ message: "What is your name?" }), (name) =>
  Console.log(`Hello, ${name}!`)
)
```

---

## 5. Arguments (Args)

Arguments are positional values that follow the command name.

**Critical rule:** Options must come before arguments. `cmd --flag arg` works; `cmd arg --flag` does NOT.

### Constructors

```typescript
import { Args } from "@effect/cli"

// Basic types
Args.text({ name: "file" })          // string
Args.integer({ name: "count" })       // number (whole)
Args.float({ name: "ratio" })        // number (decimal)
Args.boolean({ name: "flag" })       // boolean
Args.date({ name: "date" })          // Date
Args.none                            // no arguments

// File/path types
Args.file({ name: "path" })          // file path (validates existence)
Args.directory({ name: "dir" })      // directory path (validates existence)
Args.path({ name: "path" })          // general path
Args.fileContent({ name: "file" })   // reads file, returns Uint8Array
Args.fileText({ name: "file" })      // reads file, returns string
Args.fileParse({ name: "config" })   // reads and parses file (JSON/YAML/INI/TOML)
Args.fileSchema({ name: "config", schema: MySchema }) // reads, parses, validates

// Choice from predefined values
Args.choice({ name: "format", choices: [["json", "json"], ["yaml", "yaml"]] })

// Sensitive data
Args.redacted({ name: "secret" })    // masked in output
Args.secret({ name: "token" })       // for secrets
```

### Combinators

```typescript
// Optional (returns Option<A>)
Args.text({ name: "output" }).pipe(Args.optional)

// With default value
Args.text({ name: "format" }).pipe(Args.withDefault("json"))

// Repeated (zero or more, returns Array<A>)
Args.text({ name: "files" }).pipe(Args.repeated)

// At least N
Args.text({ name: "files" }).pipe(Args.atLeast(1))

// At most N
Args.text({ name: "files" }).pipe(Args.atMost(5))

// Between min and max
Args.text({ name: "files" }).pipe(Args.between(1, 10))

// Add description for help text
Args.text({ name: "file" }).pipe(Args.withDescription("Path to input file"))

// Validate against a Schema
Args.integer({ name: "id" }).pipe(Args.withSchema(TaskId))

// Transform the parsed value
Args.text({ name: "file" }).pipe(Args.map((s) => s.toUpperCase()))

// Transform with Effect
Args.text({ name: "file" }).pipe(Args.mapEffect((path) =>
  Effect.tryPromise(() => fs.readFile(path, "utf8"))
))

// Fallback to Config (e.g., environment variable)
Args.text({ name: "token" }).pipe(Args.withFallbackConfig(Config.string("API_TOKEN")))

// Combine multiple args
Args.all({ file: Args.text({ name: "file" }), count: Args.integer({ name: "count" }) })
```

---

## 6. Options (Flags)

Options are named values prefixed with `--` (long) or `-` (short alias).

### Constructors

```typescript
import { Options } from "@effect/cli"

// Basic types
Options.boolean("verbose")             // --verbose (true/false)
Options.text("output")                 // --output <value>
Options.integer("count")               // --count <number>
Options.float("ratio")                 // --ratio <number>
Options.date("since")                  // --since <date>

// Choice from fixed values
Options.choice("format", ["json", "yaml", "toml"])

// Choice with custom values
Options.choiceWithValue("level", [
  ["debug", 0],
  ["info", 1],
  ["warn", 2],
  ["error", 3]
])

// File/path
Options.file("config")                 // validates file exists
Options.directory("outdir")            // validates directory exists
Options.fileText("config")             // reads file content as string
Options.fileContent("data")            // reads file content as bytes
Options.fileParse("config")            // reads and parses (JSON/YAML/INI/TOML)
Options.fileSchema("config", MySchema) // reads, parses, validates

// Key-value pairs
Options.keyValueMap("define")          // -D key=value (returns HashMap)

// Sensitive data
Options.secret("api-key")
Options.redacted("password")

// No options
Options.none
```

### Combinators

```typescript
// Alias (short flag)
Options.boolean("verbose").pipe(Options.withAlias("v"))
// Now accepts both --verbose and -v

// Description for help text
Options.text("output").pipe(Options.withDescription("Output file path"))

// Optional (returns Option<A>)
Options.text("config").pipe(Options.optional)

// Default value
Options.integer("count").pipe(Options.withDefault(10))

// Repeated (returns Array<A>)
Options.text("include").pipe(Options.repeated)

// At least N
Options.text("tag").pipe(Options.atLeast(1))

// Validate against Schema
Options.text("email").pipe(Options.withSchema(Schema.String.pipe(Schema.pattern(/^.+@.+$/))))

// Transform
Options.text("name").pipe(Options.map((s) => s.trim()))

// Fallback to Config (environment variable)
Options.text("token").pipe(
  Options.optional,
  Options.withFallbackConfig(Config.string("API_TOKEN"))
)

// Fallback to interactive prompt
Options.text("password").pipe(
  Options.optional,
  Options.withFallbackPrompt(Prompt.password({ message: "Enter password:" }))
)

// Combine
Options.all({
  verbose: Options.boolean("verbose"),
  output: Options.text("output"),
  format: Options.choice("format", ["json", "yaml"])
})

// Either/or
Options.text("file").pipe(Options.orElse(Options.text("url")))
```

### Boolean Option with Negation

```typescript
// Creates both --color and --no-color
Options.boolean("color", { negationNames: ["no-color"] })
```

---

## 7. Subcommands

### Basic Subcommand Composition

```typescript
import { Args, Command, Options } from "@effect/cli"
import { Console, Effect } from "effect"

// Define leaf commands
const add = Command.make(
  "add",
  { task: Args.text({ name: "task" }) },
  ({ task }) => Console.log(`Adding: ${task}`)
).pipe(Command.withDescription("Add a new task"))

const list = Command.make(
  "list",
  { all: Options.boolean("all").pipe(Options.withAlias("a")) },
  ({ all }) => Console.log(`Listing tasks (all=${all})`)
).pipe(Command.withDescription("List tasks"))

// Compose into parent command
const app = Command.make("tasks").pipe(
  Command.withSubcommands([add, list])
)

// The parent command handler runs if no subcommand is specified
// If the parent has no handler, --help is shown by default
```

### Deeply Nested Subcommands

```typescript
const deploy = Command.make("deploy", { env: Args.text({ name: "env" }) }, ({ env }) =>
  Console.log(`Deploying to ${env}`)
)

const rollback = Command.make("rollback", { version: Args.text({ name: "version" }) }, ({ version }) =>
  Console.log(`Rolling back to ${version}`)
)

const infra = Command.make("infra").pipe(
  Command.withSubcommands([deploy, rollback])
)

const app = Command.make("myapp").pipe(
  Command.withSubcommands([infra, list])
)
// myapp infra deploy production
// myapp infra rollback v1.2.3
// myapp list
```

### Accessing Parent Command Config from Subcommands

When a subcommand is registered via `Command.withSubcommands`, the parent command becomes available as an Effect in the subcommand's context:

```typescript
const parentCmd = Command.make("myapp", {
  configs: Options.keyValueMap("c").pipe(Options.optional)
}, ({ configs }) => Console.log("parent"))

const childCmd = Command.make("child", { name: Args.text({ name: "name" }) }, ({ name }) =>
  // Access parent command's parsed config
  Effect.flatMap(parentCmd, (parentConfig) => {
    // parentConfig.configs is available here
    return Console.log(`Child: ${name}, parent configs: ${parentConfig.configs}`)
  })
)

const app = parentCmd.pipe(Command.withSubcommands([childCmd]))
```

This works because `Command` extends `Effect` -- the parent command itself acts as an Effect that yields its parsed config when yielded in a child handler.

---

## 8. Interactive Prompts

The `Prompt` module provides rich interactive prompts. All prompts return `Effect<Output, QuitException, Terminal>`.

### Text Prompts

```typescript
import { Prompt } from "@effect/cli"

// Basic text input
Prompt.text({ message: "What is your name?" })

// With default value
Prompt.text({ message: "Enter host:", default: "localhost" })

// With validation
Prompt.text({
  message: "Enter email:",
  validate: (s) => s.includes("@") ? Effect.succeed(s) : Effect.fail("Invalid email")
})

// Password (masked input)
Prompt.password({ message: "Enter password:" })

// Hidden input
Prompt.hidden({ message: "Enter secret:" })
```

### Numeric Prompts

```typescript
// Integer with bounds
Prompt.integer({ message: "Enter port:", min: 1, max: 65535 })

// Float with precision
Prompt.float({ message: "Enter ratio:", min: 0, max: 1 })
```

### Selection Prompts

```typescript
// Single select
Prompt.select({
  message: "Choose a database:",
  choices: [
    { title: "PostgreSQL", value: "postgres" },
    { title: "MySQL", value: "mysql" },
    { title: "SQLite", value: "sqlite" }
  ]
})

// Multi-select
Prompt.multiSelect({
  message: "Select features:",
  choices: [
    { title: "Auth", value: "auth" },
    { title: "Database", value: "db" },
    { title: "API", value: "api" }
  ]
})
```

### Boolean Prompts

```typescript
// Yes/No confirmation
Prompt.confirm({ message: "Are you sure?" })

// Toggle with custom labels
Prompt.toggle({
  message: "Enable feature?",
  active: "on",
  inactive: "off"
})
```

### Specialized Prompts

```typescript
// Date picker
Prompt.date({ message: "Select date:" })

// Comma-separated list
Prompt.list({ message: "Enter tags (comma-separated):" })

// File picker
Prompt.file({ message: "Select a file:" })
```

### Composing Prompts

```typescript
// Sequential prompts
const setup = Prompt.all({
  name: Prompt.text({ message: "Project name:" }),
  language: Prompt.select({
    message: "Language:",
    choices: [
      { title: "TypeScript", value: "ts" },
      { title: "JavaScript", value: "js" }
    ]
  }),
  confirm: Prompt.confirm({ message: "Create project?" })
})

// Chaining prompts
const namePrompt = Prompt.text({ message: "Name:" }).pipe(
  Prompt.flatMap((name) =>
    Prompt.confirm({ message: `Create user ${name}?` }).pipe(
      Prompt.map((confirmed) => ({ name, confirmed }))
    )
  )
)
```

### Using Prompts Inside Command Handlers

Prompts are Effects, so they can be yielded directly inside `Effect.gen`:

```typescript
const interactiveAdd = Command.make("add", {}, () =>
  Effect.gen(function* () {
    const name = yield* Prompt.text({ message: "Task name:" })
    const priority = yield* Prompt.select({
      message: "Priority:",
      choices: [
        { title: "High", value: "high" },
        { title: "Medium", value: "medium" },
        { title: "Low", value: "low" }
      ]
    })
    yield* Console.log(`Added: ${name} (${priority})`)
  })
)
```

### Option Fallback to Prompt

When a flag is not provided, fall back to an interactive prompt:

```typescript
const nameOpt = Options.text("name").pipe(
  Options.optional,
  Options.withFallbackPrompt(Prompt.text({ message: "Enter your name:" }))
)
```

---

## 9. Help Text Generation

Help text is auto-generated from command structure, args, options, and descriptions. No manual formatting required.

### Adding Descriptions

```typescript
const cmd = Command.make("deploy", {
  env: Args.text({ name: "environment" }).pipe(
    Args.withDescription("Target environment (staging, production)")
  ),
  dryRun: Options.boolean("dry-run").pipe(
    Options.withAlias("n"),
    Options.withDescription("Show what would be done without executing")
  ),
  timeout: Options.integer("timeout").pipe(
    Options.withDefault(30),
    Options.withDescription("Timeout in seconds (default: 30)")
  )
}, handler).pipe(
  Command.withDescription("Deploy the application to an environment")
)
```

Running `myapp deploy --help` auto-generates:

```
DESCRIPTION

  Deploy the application to an environment

USAGE

  myapp deploy [--dry-run] [--timeout <integer>] [--] <environment>

ARGUMENTS

  <environment>    Target environment (staging, production)

OPTIONS

  -n, --dry-run              Show what would be done without executing
      --timeout <integer>    Timeout in seconds (default: 30)
```

### HelpDoc DSL (Advanced)

For custom help text formatting, use the `HelpDoc` module:

```typescript
import { HelpDoc } from "@effect/cli"

const customHelp = HelpDoc.sequence(
  HelpDoc.p("This is a paragraph."),
  HelpDoc.p(HelpDoc.Span.strong("Bold text")),
  HelpDoc.enumeration([
    HelpDoc.p("First item"),
    HelpDoc.p("Second item")
  ])
)

const cmd = Command.make("demo").pipe(
  Command.withDescription(customHelp)
)
```

---

## 10. Built-in Options

Every @effect/cli application automatically includes:

| Flag | Description |
|------|-------------|
| `-h`, `--help` | Display help documentation |
| `--version` | Show application version |
| `--completions (bash\|sh\|fish\|zsh)` | Generate shell completion script |
| `--wizard` | Interactive guided command construction |
| `--log-level` | Set minimum log level for command handlers |

### Shell Completions

```bash
# Generate and install zsh completions
myapp --completions zsh > ~/.zsh/completions/_myapp

# Generate bash completions
myapp --completions bash >> ~/.bashrc
```

### Wizard Mode

Running `myapp --wizard` interactively guides users through selecting subcommands, filling in required arguments, and setting options step by step. Particularly useful for complex CLIs with many subcommands.

---

## 11. Effect Fundamentals for CLI

### The Effect Type

```typescript
Effect<Success, Error, Requirements>
```

- `Success` (A): The type of the successful result
- `Error` (E): The type of possible errors (union of tagged errors)
- `Requirements` (R): Services required from the environment

### Effect.gen (Generator Syntax)

```typescript
const program = Effect.gen(function* () {
  const name = yield* getNameEffect       // "await" an effect
  const greeting = yield* greetEffect(name)
  return greeting
})
```

`yield*` is analogous to `await` for Promises, but for Effects. If any yielded effect fails, the generator stops and propagates the error.

### Creating Effects

```typescript
// From synchronous value
Effect.succeed(42)
Effect.sync(() => Date.now())

// From async
Effect.tryPromise(() => fetch("/api"))
Effect.promise(() => fs.readFile("file.txt"))

// Failure
Effect.fail(new MyError("something broke"))

// From callback
Effect.async<string, Error>((resume) => {
  someCallback((err, result) => {
    if (err) resume(Effect.fail(err))
    else resume(Effect.succeed(result))
  })
})
```

### Running Effects

```typescript
// In CLI context (preferred)
NodeRuntime.runMain(program)  // handles errors, exit codes, interruption

// For testing
await Effect.runPromise(program)
const exit = await Effect.runPromiseExit(program)
```

---

## 12. Services and Layers

### Defining a Service

```typescript
import { Context, Effect, Layer } from "effect"

// Define the service interface
class Database extends Context.Tag("@app/Database")<
  Database,
  {
    readonly query: (sql: string) => Effect.Effect<unknown[]>
    readonly execute: (sql: string) => Effect.Effect<void>
  }
>() {}
```

### Implementing with Layer

```typescript
// Production layer
const DatabaseLive = Layer.effect(
  Database,
  Effect.gen(function* () {
    const config = yield* Config         // can depend on other services
    const pool = yield* createPool(config)
    return {
      query: (sql) => Effect.tryPromise(() => pool.query(sql)),
      execute: (sql) => Effect.tryPromise(() => pool.execute(sql))
    }
  })
)

// Test layer
const DatabaseTest = Layer.succeed(Database, {
  query: (_sql) => Effect.succeed([{ id: 1, name: "test" }]),
  execute: (_sql) => Effect.succeed(undefined)
})
```

### Providing Layers to CLI Commands

There are two approaches:

**Approach 1: Provide at the top level** (recommended)

```typescript
const mainLayer = Layer.provideMerge(
  TaskRepo.layer,
  NodeContext.layer
)

cli(process.argv).pipe(
  Effect.provide(mainLayer),
  NodeRuntime.runMain
)
```

**Approach 2: Provide directly on the command**

```typescript
const cmd = Command.make("deploy", { env }, ({ env }) =>
  Effect.gen(function* () {
    const db = yield* Database
    yield* db.execute(`DEPLOY TO ${env}`)
  })
).pipe(
  Command.provide(DatabaseLive)       // inject the layer into this command
)
```

### Command.provide / Command.provideEffect

```typescript
// Provide a Layer
Command.provide(myCommand, myLayer)

// Provide a service via Effect
Command.provideEffect(myCommand, Database, Effect.succeed(mockDb))

// Provide synchronously
Command.provideSync(myCommand, Database, () => mockDb)
```

### Layer Composition

```typescript
// Merge independent layers (combine outputs)
const merged = Layer.merge(ConfigLive, LoggerLive)
// Type: Layer<Config | Logger, never, never>

// Compose dependent layers (pipe requirements)
const composed = ConfigLive.pipe(
  Layer.provide(LoggerLive)   // LoggerLive needs Config
)

// Build full application layer
const AppLive = Layer.mergeAll(
  ConfigLive,
  LoggerLive,
  DatabaseLive
).pipe(
  Layer.provideMerge(NodeContext.layer)
)
```

### Layer Memoization

Effect automatically memoizes layers by reference identity. When the same layer instance appears multiple times in your dependency graph, it is constructed only once. Store parameterized layers in module-level constants to benefit from this.

### Effect.Service (Simplified Pattern)

```typescript
class MyService extends Effect.Service<MyService>()("MyService", {
  effect: Effect.gen(function* () {
    return {
      doSomething: () => Effect.succeed("done")
    }
  })
}) {}

// Automatically generates MyService.Default layer
const program = Effect.gen(function* () {
  const svc = yield* MyService
  return yield* svc.doSomething()
}).pipe(Effect.provide(MyService.Default))
```

---

## 13. Error Handling

### Tagged Errors

```typescript
import { Data, Effect } from "effect"

// Define typed errors with _tag discriminator
class NotFoundError extends Data.TaggedError("NotFoundError")<{
  readonly id: string
}> {}

class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly message: string
}> {}

// Effect tracks error types in the Error channel
const findUser = (id: string): Effect.Effect<User, NotFoundError | ValidationError> =>
  Effect.gen(function* () {
    if (!id) yield* new ValidationError({ message: "ID required" })
    const user = yield* lookupUser(id)
    if (!user) yield* new NotFoundError({ id })
    return user
  })
```

### Catching Errors

```typescript
// Catch all errors
program.pipe(
  Effect.catchAll((error) => Console.error(`Error: ${error}`))
)

// Catch specific tagged error
program.pipe(
  Effect.catchTag("NotFoundError", (error) =>
    Console.error(`Not found: ${error.id}`)
  )
)

// Catch multiple tags
program.pipe(
  Effect.catchTags({
    NotFoundError: (e) => Console.error(`Not found: ${e.id}`),
    ValidationError: (e) => Console.error(`Invalid: ${e.message}`)
  })
)

// Map error types
program.pipe(
  Effect.mapError((e) => new WrappedError({ cause: e }))
)

// Provide fallback
program.pipe(
  Effect.orElse(() => Effect.succeed(defaultValue))
)
```

### Error Handling in CLI Commands

```typescript
const deploy = Command.make("deploy", { env }, ({ env }) =>
  Effect.gen(function* () {
    const result = yield* deployToEnv(env)
    yield* Console.log(`Deployed: ${result}`)
  }).pipe(
    Effect.catchTag("DeployError", (e) =>
      Console.error(`Deployment failed: ${e.message}`).pipe(
        Effect.andThen(Effect.fail(e))  // re-fail to set exit code
      )
    )
  )
)
```

### Command.transformHandler (Middleware)

Wrap all command handlers with cross-cutting concerns:

```typescript
const withTiming = <A, E, R>(cmd: Command<any, A, E, R>) =>
  cmd.pipe(
    Command.transformHandler((effect, config) =>
      Effect.gen(function* () {
        const start = Date.now()
        const result = yield* effect
        const elapsed = Date.now() - start
        yield* Console.log(`Completed in ${elapsed}ms`)
        return result
      })
    )
  )
```

---

## 14. Configuration System

Effect has a built-in configuration system that integrates with CLI apps.

### Config Module

```typescript
import { Config, Effect } from "effect"

const program = Effect.gen(function* () {
  const host = yield* Config.string("HOST")
  const port = yield* Config.number("PORT").pipe(Config.withDefault(8080))
  const apiKey = yield* Config.redacted("API_KEY")
  console.log(`${host}:${port}`)
})
```

Default `ConfigProvider` reads from environment variables.

### Config Types

```typescript
Config.string("KEY")      // string
Config.number("KEY")      // number
Config.integer("KEY")     // integer
Config.boolean("KEY")     // boolean
Config.date("KEY")        // Date
Config.duration("KEY")    // Duration
Config.redacted("KEY")    // Redacted<string> (safe for logging)
Config.url("KEY")         // URL
Config.logLevel("KEY")    // LogLevel
```

### Config Combinators

```typescript
// Default value
Config.number("PORT").pipe(Config.withDefault(3000))

// Optional
Config.string("FEATURE").pipe(Config.option)

// Validation
Config.string("NAME").pipe(
  Config.validate({
    message: "Must be at least 3 characters",
    validation: (s) => s.length >= 3
  })
)

// Transform
Config.string("TAGS").pipe(Config.map((s) => s.split(",")))

// Combine
Config.all({
  host: Config.string("HOST"),
  port: Config.number("PORT")
})

// Array
Config.array(Config.string(), "HOSTS")  // HOSTS=a,b,c -> ["a","b","c"]

// HashMap (prefix-based)
Config.hashMap(Config.string(), "DB")   // DB_HOST=x DB_PORT=y -> HashMap
```

### Schema-Based Config

```typescript
import { Schema } from "effect"

const portConfig = Schema.Config("PORT", Schema.Number.pipe(
  Schema.int(),
  Schema.between(1, 65535)
))
```

### Options Fallback to Config

This is powerful: an option tries CLI flags first, then falls back to environment variables:

```typescript
const token = Options.text("token").pipe(
  Options.optional,
  Options.withFallbackConfig(Config.string("API_TOKEN"))
)
// User can provide --token=xyz OR set API_TOKEN=xyz
```

### Custom ConfigProvider

```typescript
import { ConfigProvider, Layer } from "effect"

const customProvider = ConfigProvider.fromMap(
  new Map([["HOST", "localhost"], ["PORT", "8080"]])
)

const program = myEffect.pipe(
  Effect.withConfigProvider(customProvider)
)
```

---

## 15. FileSystem and Platform

### FileSystem Module

```typescript
import { FileSystem } from "@effect/platform"
import { Effect } from "effect"

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem

  // Read file
  const content = yield* fs.readFileString("./config.json", "utf8")

  // Write file
  yield* fs.writeFileString("./output.txt", "Hello, World!")

  // Check existence
  const exists = yield* fs.exists("./data.json")

  // Create directory
  yield* fs.makeDirectory("./output", { recursive: true })

  // List directory
  const entries = yield* fs.readDirectory("./src")

  // Copy file
  yield* fs.copyFile("./src.txt", "./dest.txt")

  // Remove file/directory
  yield* fs.remove("./temp", { recursive: true })

  // Watch for changes
  const stream = fs.watch("./src")

  // Temporary files (auto-cleanup with scope)
  const tmpFile = yield* fs.makeTempFileScoped()
  const tmpDir = yield* fs.makeTempDirectoryScoped()

  // File metadata
  const stat = yield* fs.stat("./file.txt")

  // Streaming read
  const fileStream = fs.stream("./large-file.bin")

  // Streaming write
  const sink = fs.sink("./output.bin")
})
```

### Path Module

```typescript
import { Path } from "@effect/platform"

const program = Effect.gen(function* () {
  const path = yield* Path.Path

  const full = path.join("src", "commands", "deploy.ts")
  const ext = path.extname("file.json")  // ".json"
  const base = path.basename("/home/user/file.txt")  // "file.txt"
  const dir = path.dirname("/home/user/file.txt")  // "/home/user"
  const abs = path.resolve("./relative/path")
})
```

### Testing FileSystem

```typescript
import { FileSystem } from "@effect/platform"

// No-op implementation (all operations fail by default)
const mockFs = FileSystem.layerNoop()

// Custom mock
const customMock = FileSystem.layerNoop({
  readFileString: () => Effect.succeed('{"tasks": []}'),
  exists: (path) => Effect.succeed(path === "/some/path")
})

// Use in tests
const result = await Effect.runPromise(
  program.pipe(Effect.provide(customMock))
)
```

---

## 16. Terminal and I/O

### Console (Effect core)

```typescript
import { Console, Effect } from "effect"

const program = Effect.gen(function* () {
  yield* Console.log("Normal output")        // stdout
  yield* Console.error("Error output")       // stderr
  yield* Console.warn("Warning output")      // stderr
  yield* Console.info("Info output")         // stdout
})
```

### Terminal Service

The Terminal service from `@effect/platform` provides lower-level terminal I/O:

```typescript
import { Terminal } from "@effect/platform"

const program = Effect.gen(function* () {
  const terminal = yield* Terminal.Terminal

  // Read a line from stdin
  const input = yield* terminal.readLine

  // Terminal dimensions
  const cols = terminal.columns
  const rows = terminal.rows
  const isTTY = terminal.isTTY
})
```

### ANSI Styled Output

The `@effect/printer-ansi` package (a peer dependency of @effect/cli) provides styled text:

```typescript
import { Doc, Ansi } from "@effect/printer-ansi"

const styledDoc = Doc.cat(
  Doc.annotate(Doc.text("Error:"), Ansi.red),
  Doc.text(" Something went wrong")
)
```

---

## 17. Executing External Processes

The `Command` module from `@effect/platform` (not `@effect/cli`) runs external processes:

```typescript
import { Command } from "@effect/platform"
import { Effect } from "effect"

const program = Effect.gen(function* () {
  // Basic command execution
  const output = yield* Command.string(Command.make("ls", "-la"))

  // Capture exit code
  const exitCode = yield* Command.exitCode(Command.make("npm", "test"))

  // Output as lines
  const lines = yield* Command.lines(Command.make("git", "log", "--oneline"))

  // With environment variables
  const cmd = Command.make("echo", "$MY_VAR").pipe(
    Command.env({ MY_VAR: "hello" }),
    Command.runInShell(true)
  )

  // Feed stdin
  const catCmd = Command.make("cat").pipe(Command.feed("Hello from stdin"))
  const result = yield* Command.string(catCmd)

  // Inherit stdout (pass through to terminal)
  yield* Command.make("npm", "install").pipe(
    Command.stdout("inherit"),
    Command.exitCode
  )

  // Full process access
  const proc = yield* Command.start(Command.make("my-server"))
  const [exit, stdout, stderr] = yield* Effect.all([
    proc.exitCode,
    runString(proc.stdout),
    runString(proc.stderr)
  ], { concurrency: 3 })
})
```

---

## 18. Schema for Validation

### Basic Schemas

```typescript
import { Schema } from "effect"

// Primitives
Schema.String
Schema.Number
Schema.Boolean
Schema.Date

// Structs
const User = Schema.Struct({
  name: Schema.String,
  age: Schema.Number,
  email: Schema.String.pipe(Schema.pattern(/^.+@.+$/))
})

// Arrays
Schema.Array(Schema.String)

// Optional fields
Schema.Struct({
  name: Schema.String,
  bio: Schema.optional(Schema.String)
})
```

### Schema Classes

```typescript
class Task extends Schema.Class<Task>("Task")({
  id: Schema.Number,
  text: Schema.NonEmptyString,
  done: Schema.Boolean
}) {
  toggle() {
    return Task.make({ ...this, done: !this.done })
  }
}

// Create instances
const task = Task.make({ id: 1, text: "Buy milk", done: false })

// Decode from unknown
const decoded = Schema.decodeUnknownSync(Task)({ id: 1, text: "hello", done: false })
```

### Branded Types

```typescript
const TaskId = Schema.Number.pipe(Schema.brand("TaskId"))
type TaskId = typeof TaskId.Type

// TaskId.make(42) creates a branded number
// Prevents mixing with plain numbers at the type level
```

### JSON Parsing with Schema

```typescript
class TaskList extends Schema.Class<TaskList>("TaskList")({
  tasks: Schema.Array(Task)
}) {
  static Json = Schema.parseJson(TaskList)
}

// Decode from JSON string
const list = yield* Schema.decode(TaskList.Json)(jsonString)

// Encode back to JSON string
const json = yield* Schema.encode(TaskList.Json)(list)
```

### Integration with CLI Args/Options

```typescript
// Validate argument against schema
Args.integer({ name: "id" }).pipe(Args.withSchema(TaskId))

// Validate option against schema
Options.text("email").pipe(Options.withSchema(EmailSchema))

// Parse file with schema validation
Args.fileSchema({ name: "config", schema: MyConfigSchema })
```

---

## 19. Testing Patterns

### Testing Commands Directly

Since command handlers return Effects, you can test them without running the full CLI:

```typescript
import { Effect, Layer } from "effect"

// Create test layers
const TestTaskRepo = Layer.succeed(TaskRepo, {
  list: () => Effect.succeed([]),
  add: (text) => Effect.succeed(Task.make({ id: 1, text, done: false })),
  toggle: (id) => Effect.succeed(Option.some(Task.make({ id, text: "test", done: true }))),
  clear: () => Effect.succeed(undefined)
})

// Test the handler effect directly
it("add command creates a task", async () => {
  const result = await Effect.runPromise(
    addHandler({ text: "Buy milk" }).pipe(
      Effect.provide(TestTaskRepo)
    )
  )
  expect(result).toBeDefined()
})
```

### Testing with MockTerminal

@effect/cli includes a `MockTerminal` for testing interactive prompts:

```typescript
// The MockTerminal service can simulate terminal input/output
// for testing prompt-based commands without actual terminal interaction
```

### Testing with Mock FileSystem

```typescript
const MockFS = FileSystem.layerNoop({
  readFileString: () => Effect.succeed('{"tasks":[]}'),
  writeFileString: (_path, _content) => Effect.succeed(undefined),
  exists: () => Effect.succeed(true)
})

it("reads tasks from file", async () => {
  const tasks = await Effect.runPromise(
    Effect.gen(function* () {
      const repo = yield* TaskRepo
      return yield* repo.list()
    }).pipe(
      Effect.provide(
        Layer.provideMerge(TaskRepo.layer, MockFS)
      )
    )
  )
  expect(tasks).toHaveLength(0)
})
```

### Per-Test Layer Pattern (Preferred)

```typescript
import { it } from "@effect/vitest"

it.effect("should add task", () =>
  Effect.gen(function* () {
    const repo = yield* TaskRepo
    const task = yield* repo.add("test task")
    expect(task.text).toBe("test task")
  }).pipe(Effect.provide(TestTaskRepo))
)
```

### Integration Testing CLI

```typescript
// You can test the full CLI by running Command.run with test arguments
const cli = Command.run(app, { name: "test", version: "0.0.0" })

const testRun = cli(["node", "test", "add", "Buy milk"]).pipe(
  Effect.provide(testLayer),
  Effect.runPromise
)
```

---

## 20. Structuring a Large CLI

### Recommended Project Structure

```
src/
  index.ts              # Entry point: Command.run + Effect.provide + runMain
  commands/
    index.ts            # Root command with withSubcommands
    deploy.ts           # deploy subcommand
    config/
      index.ts          # config subcommand group
      get.ts            # config get
      set.ts            # config set
      list.ts           # config list
    generate/
      index.ts          # generate subcommand group
      contract.ts       # generate contract
      types.ts          # generate types
  services/
    index.ts            # Re-export all services
    Database.ts         # Database service (Tag + Layer)
    Config.ts           # App config service
    Logger.ts           # Logger service
  schemas/
    Task.ts             # Schema classes
    Config.ts           # Config schemas
  layers/
    AppLive.ts          # Production layer composition
    AppTest.ts          # Test layer composition
  lib/
    errors.ts           # Tagged error definitions
    utils.ts            # Shared utilities
```

### Pattern: One Module Per Command

```typescript
// src/commands/deploy.ts
import { Args, Command, Options } from "@effect/cli"
import { DeployService } from "../services/Deploy.js"

const env = Args.text({ name: "environment" }).pipe(
  Args.withDescription("Target environment")
)

const dryRun = Options.boolean("dry-run").pipe(
  Options.withAlias("n"),
  Options.withDescription("Preview without executing")
)

export const deploy = Command.make(
  "deploy",
  { env, dryRun },
  ({ env, dryRun }) =>
    Effect.gen(function* () {
      const deployer = yield* DeployService
      yield* deployer.deploy(env, { dryRun })
    })
).pipe(Command.withDescription("Deploy to an environment"))
```

### Pattern: Command Group Module

```typescript
// src/commands/config/index.ts
import { Command } from "@effect/cli"
import { get } from "./get.js"
import { set } from "./set.js"
import { list } from "./list.js"

export const config = Command.make("config").pipe(
  Command.withDescription("Manage configuration"),
  Command.withSubcommands([get, set, list])
)
```

### Pattern: Root Command Assembly

```typescript
// src/commands/index.ts
import { Command } from "@effect/cli"
import { deploy } from "./deploy.js"
import { config } from "./config/index.js"
import { generate } from "./generate/index.js"

export const root = Command.make("myapp").pipe(
  Command.withDescription("My CLI application"),
  Command.withSubcommands([deploy, config, generate])
)
```

### Pattern: Entry Point

```typescript
// src/index.ts
import { Command } from "@effect/cli"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import { Effect, Layer } from "effect"
import { root } from "./commands/index.js"
import { AppLive } from "./layers/AppLive.js"

const cli = Command.run(root, {
  name: "myapp",
  version: "1.0.0"
})

const mainLayer = Layer.provideMerge(AppLive, NodeContext.layer)

cli(process.argv).pipe(
  Effect.provide(mainLayer),
  NodeRuntime.runMain
)
```

### Pattern: Layer Composition for Large Apps

```typescript
// src/layers/AppLive.ts
import { Layer } from "effect"
import { DatabaseLive } from "../services/Database.js"
import { ConfigServiceLive } from "../services/Config.js"
import { LoggerLive } from "../services/Logger.js"
import { DeployServiceLive } from "../services/Deploy.js"

export const AppLive = Layer.mergeAll(
  ConfigServiceLive,
  LoggerLive
).pipe(
  Layer.provideMerge(DatabaseLive),
  Layer.provideMerge(DeployServiceLive)
)
```

---

## 21. Bundle Size and Performance

### Core Effect Runtime

- Effect core runtime: ~15KB gzipped when tree-shaken
- Scales with usage -- using 100KB of Effect code might replace ~1MB of non-Effect code
- Designed for function-level exports to enable tree-shaking

### @effect/cli Bundle

- @effect/cli adds its own weight on top of the core runtime
- Peer dependencies: @effect/platform, @effect/printer, @effect/printer-ansi
- For CLIs, bundle size is less critical than for browser apps since CLIs run on the server

### Tree-Shaking

Effect is designed for tree-shaking:
- Functions exported individually (not methods on objects)
- ESM format required for tree-shaking
- CJS does NOT tree-shake

### Building with tsup

The official CLI template uses tsup for bundling:

```typescript
// tsup.config.ts
import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node18",
  bundle: true,
  minify: true,
  treeshake: true
})
```

### Micro Module (Lightweight Alternative)

For scenarios where bundle size is critical:

```typescript
import { Micro } from "effect"

// Micro starts at ~5KB gzipped
// Self-contained, no Layer, Ref, Queue, or Deferred
// Compatible with full Effect but slimmer
```

Micro is NOT suitable for CLI apps that need services/layers, but could be used for simple scripts or library code.

### Performance Characteristics

- Effect uses a fiber-based runtime for concurrency
- Generator syntax (`Effect.gen`) has minimal overhead
- Layer construction is memoized (single initialization)
- CLI argument parsing is done eagerly at startup
- Help generation is lazy (only computed when --help is invoked)

---

## 22. Complete Examples

### Example 1: Simple Greeting CLI

```typescript
import { Args, Command, Options } from "@effect/cli"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import { Console, Effect } from "effect"

const name = Args.text({ name: "name" }).pipe(Args.withDefault("World"))
const shout = Options.boolean("shout").pipe(Options.withAlias("s"))

const greet = Command.make("greet", { name, shout }, ({ name, shout }) => {
  const message = `Hello, ${name}!`
  return Console.log(shout ? message.toUpperCase() : message)
})

const cli = Command.run(greet, { name: "greet", version: "1.0.0" })

cli(process.argv).pipe(
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain
)
```

### Example 2: Git-like CLI (minigit)

```typescript
import { Args, Command, Options } from "@effect/cli"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import { Console, Effect, Option, ReadonlyArray } from "effect"

// Parent command with key-value configs
const configs = Options.keyValueMap("c").pipe(Options.optional)
const minigit = Command.make("minigit", { configs }, ({ configs }) =>
  Option.match(configs, {
    onNone: () => Console.log("Running 'minigit'"),
    onSome: (configs) => {
      const pairs = Array.from(configs)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ")
      return Console.log(`Running 'minigit' with configs: ${pairs}`)
    }
  })
)

// add subcommand
const pathspec = Args.text({ name: "pathspec" }).pipe(Args.repeated)
const verbose = Options.boolean("verbose").pipe(Options.withAlias("v"))

const add = Command.make("add", { pathspec, verbose }, ({ pathspec, verbose }) => {
  const paths = ReadonlyArray.match(pathspec, {
    onEmpty: () => "",
    onNonEmpty: (paths) => ` ${ReadonlyArray.join(paths, " ")}`
  })
  return Console.log(`Running 'minigit add${paths}' with '--verbose ${verbose}'`)
})

// clone subcommand
const repository = Args.text({ name: "repository" })
const directory = Args.text({ name: "directory" }).pipe(Args.optional)
const depth = Options.integer("depth").pipe(Options.optional)

const clone = Command.make("clone", { repository, directory, depth }, (config) => {
  const parts = ReadonlyArray.getSomes([
    Option.map(config.depth, (d) => `--depth ${d}`),
    Option.some(config.repository),
    config.directory
  ])
  return Console.log(
    `Running 'minigit clone' with: '${ReadonlyArray.join(parts, ", ")}'`
  )
})

// Compose
const command = minigit.pipe(Command.withSubcommands([add, clone]))

const cli = Command.run(command, {
  name: "Minigit Distributed Version Control",
  version: "v1.0.0"
})

cli(process.argv).pipe(
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain
)
```

### Example 3: Task Manager with Services, Schema, and File Persistence

```typescript
// --- schemas/Task.ts ---
import { Array, Option, Schema } from "effect"

const TaskId = Schema.Number.pipe(Schema.brand("TaskId"))
type TaskId = typeof TaskId.Type

class Task extends Schema.Class<Task>("Task")({
  id: TaskId,
  text: Schema.NonEmptyString,
  done: Schema.Boolean
}) {
  toggle() {
    return Task.make({ ...this, done: !this.done })
  }
}

class TaskList extends Schema.Class<TaskList>("TaskList")({
  tasks: Schema.Array(Task)
}) {
  static Json = Schema.parseJson(TaskList)
  static empty = TaskList.make({ tasks: [] })

  get nextId(): TaskId {
    if (this.tasks.length === 0) return TaskId.make(1)
    return TaskId.make(Math.max(...this.tasks.map((t) => t.id)) + 1)
  }

  add(text: string): [TaskList, Task] {
    const task = Task.make({ id: this.nextId, text, done: false })
    return [TaskList.make({ tasks: [...this.tasks, task] }), task]
  }

  toggle(id: TaskId): [TaskList, Option.Option<Task>] {
    const index = this.tasks.findIndex((t) => t.id === id)
    if (index === -1) return [this, Option.none()]
    const updated = this.tasks[index].toggle()
    const tasks = Array.modify(this.tasks, index, () => updated)
    return [TaskList.make({ tasks }), Option.some(updated)]
  }
}

// --- services/TaskRepo.ts ---
import { Context, Effect, Layer, Schema } from "effect"
import { FileSystem } from "@effect/platform"

class TaskRepo extends Context.Tag("TaskRepo")<
  TaskRepo,
  {
    readonly list: (all?: boolean) => Effect.Effect<ReadonlyArray<Task>>
    readonly add: (text: string) => Effect.Effect<Task>
    readonly toggle: (id: TaskId) => Effect.Effect<Option.Option<Task>>
    readonly clear: () => Effect.Effect<void>
  }
>() {
  static layer = Layer.effect(
    TaskRepo,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = "tasks.json"

      const load = Effect.gen(function* () {
        const content = yield* fs.readFileString(path)
        return yield* Schema.decode(TaskList.Json)(content)
      }).pipe(Effect.orElseSucceed(() => TaskList.empty))

      const save = (list: TaskList) =>
        Effect.gen(function* () {
          const json = yield* Schema.encode(TaskList.Json)(list)
          yield* fs.writeFileString(path, json)
        })

      return {
        list: (all) => Effect.gen(function* () {
          const taskList = yield* load
          return all ? taskList.tasks : taskList.tasks.filter((t) => !t.done)
        }),
        add: (text) => Effect.gen(function* () {
          const list = yield* load
          const [newList, task] = list.add(text)
          yield* save(newList)
          return task
        }),
        toggle: (id) => Effect.gen(function* () {
          const list = yield* load
          const [newList, task] = list.toggle(id)
          yield* save(newList)
          return task
        }),
        clear: () => save(TaskList.empty)
      }
    })
  )
}

// --- commands/index.ts ---
import { Args, Command, Options } from "@effect/cli"
import { Console, Effect, Option } from "effect"

const addCmd = Command.make(
  "add",
  { text: Args.text({ name: "task" }).pipe(Args.withDescription("Task description")) },
  ({ text }) =>
    Effect.gen(function* () {
      const repo = yield* TaskRepo
      const task = yield* repo.add(text)
      yield* Console.log(`Added task #${task.id}: ${task.text}`)
    })
).pipe(Command.withDescription("Add a new task"))

const listCmd = Command.make(
  "list",
  { all: Options.boolean("all").pipe(Options.withAlias("a"), Options.withDescription("Show all")) },
  ({ all }) =>
    Effect.gen(function* () {
      const repo = yield* TaskRepo
      const tasks = yield* repo.list(all)
      if (tasks.length === 0) return yield* Console.log("No tasks.")
      for (const task of tasks) {
        const status = task.done ? "[x]" : "[ ]"
        yield* Console.log(`${status} #${task.id} ${task.text}`)
      }
    })
).pipe(Command.withDescription("List tasks"))

const toggleCmd = Command.make(
  "toggle",
  { id: Args.integer({ name: "id" }).pipe(Args.withSchema(TaskId)) },
  ({ id }) =>
    Effect.gen(function* () {
      const repo = yield* TaskRepo
      const result = yield* repo.toggle(id)
      yield* Option.match(result, {
        onNone: () => Console.log(`Task #${id} not found`),
        onSome: (task) => Console.log(`Toggled: ${task.text} (${task.done ? "done" : "pending"})`)
      })
    })
).pipe(Command.withDescription("Toggle a task"))

const clearCmd = Command.make("clear", {}, () =>
  Effect.gen(function* () {
    const repo = yield* TaskRepo
    yield* repo.clear()
    yield* Console.log("Cleared all tasks.")
  })
).pipe(Command.withDescription("Clear all tasks"))

const app = Command.make("tasks").pipe(
  Command.withDescription("A simple task manager"),
  Command.withSubcommands([addCmd, listCmd, toggleCmd, clearCmd])
)

// --- index.ts ---
import { Command } from "@effect/cli"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import { Effect, Layer } from "effect"

const cli = Command.run(app, { name: "tasks", version: "1.0.0" })

const mainLayer = Layer.provideMerge(TaskRepo.layer, NodeContext.layer)

cli(process.argv).pipe(
  Effect.provide(mainLayer),
  NodeRuntime.runMain
)
```

### Example 4: CLI with Environment Variable Fallbacks

```typescript
import { Args, Command, Options } from "@effect/cli"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import { Config, Console, Effect } from "effect"

const token = Options.text("token").pipe(
  Options.optional,
  Options.withFallbackConfig(Config.string("API_TOKEN")),
  Options.withDescription("API token (or set API_TOKEN env var)")
)

const endpoint = Options.text("endpoint").pipe(
  Options.withDefault("https://api.example.com"),
  Options.withFallbackConfig(Config.string("API_ENDPOINT")),
  Options.withDescription("API endpoint URL")
)

const query = Args.text({ name: "query" }).pipe(
  Args.withDescription("Search query")
)

const search = Command.make(
  "search",
  { query, token, endpoint },
  ({ query, token, endpoint }) =>
    Effect.gen(function* () {
      yield* Console.log(`Searching "${query}" at ${endpoint}`)
      yield* Console.log(`Using token: ${token.substring(0, 4)}...`)
    })
).pipe(Command.withDescription("Search the API"))

const cli = Command.run(search, { name: "search", version: "1.0.0" })

cli(process.argv).pipe(
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain
)
```

### Example 5: Interactive Setup Wizard

```typescript
import { Command, Prompt } from "@effect/cli"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import { Console, Effect } from "effect"
import { FileSystem } from "@effect/platform"

const init = Command.make("init", {}, () =>
  Effect.gen(function* () {
    const name = yield* Prompt.text({ message: "Project name:" })
    const template = yield* Prompt.select({
      message: "Choose a template:",
      choices: [
        { title: "Minimal", value: "minimal" },
        { title: "Full Stack", value: "fullstack" },
        { title: "API Only", value: "api" }
      ]
    })
    const features = yield* Prompt.multiSelect({
      message: "Select features:",
      choices: [
        { title: "Authentication", value: "auth" },
        { title: "Database", value: "db" },
        { title: "Testing", value: "test" },
        { title: "Docker", value: "docker" }
      ]
    })
    const confirm = yield* Prompt.confirm({
      message: `Create ${name} with ${template} template?`
    })

    if (!confirm) {
      yield* Console.log("Cancelled.")
      return
    }

    const fs = yield* FileSystem.FileSystem
    yield* fs.makeDirectory(name, { recursive: true })
    yield* fs.writeFileString(
      `${name}/config.json`,
      JSON.stringify({ name, template, features }, null, 2)
    )
    yield* Console.log(`Created project: ${name}`)
  })
).pipe(Command.withDescription("Initialize a new project"))

const cli = Command.run(init, { name: "scaffold", version: "1.0.0" })

cli(process.argv).pipe(
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain
)
```

---

## 23. Comparison with Alternatives

| Feature | @effect/cli | Commander.js | yargs | oclif | clipanion |
|---------|-------------|-------------|-------|-------|-----------|
| Type safety | Full (inferred) | Manual | Partial | Good | Good |
| Error tracking | Typed (Effect) | Thrown | Thrown | Thrown | Thrown |
| Dependency injection | Built-in (Layers) | None | None | Plugin | None |
| Interactive prompts | Built-in | Separate (inquirer) | Separate | Separate | None |
| Schema validation | Built-in | Manual | Yargs types | Manual | Manual |
| Shell completions | Built-in | Plugin | Built-in | Plugin | None |
| Wizard mode | Built-in | None | None | None | None |
| Help generation | Auto | Auto | Auto | Auto | Auto |
| Config fallback | Built-in (env/file) | Manual | Manual | Plugin | None |
| File I/O | @effect/platform | Manual | Manual | Manual | Manual |
| Process execution | @effect/platform | Manual | Manual | Manual | Manual |
| Testing | Effect patterns | Manual | Manual | Framework | None |
| Tree-shaking | Excellent | Good | Poor | Poor | Good |
| Bundle (min+gz) | ~20-30KB+ | ~7KB | ~20KB | Large | ~10KB |
| Learning curve | Steep (Effect) | Low | Low | Medium | Medium |
| Ecosystem integration | Full Effect | Standalone | Standalone | Standalone | Standalone |

### When to Choose @effect/cli

**Choose @effect/cli when:**
- You are already using or want to use Effect for your application
- You need typed errors, dependency injection, and composable services
- You want built-in config fallback to env vars, files, and prompts
- You need interactive prompts, wizard mode, and shell completions out of the box
- You are building a large, enterprise-grade CLI with many subcommands
- You want platform-independent code (Node.js, Bun, Deno)

**Consider alternatives when:**
- You want minimal dependencies and learning curve
- You are building a simple script with few commands
- Your team is not familiar with functional programming / Effect
- Bundle size is the primary concern (though for CLIs this rarely matters)

---

## 24. Sources

### Official Documentation
- [Effect Website](https://effect.website/)
- [Effect CLI API Reference](https://effect-ts.github.io/effect/docs/cli)
- [Effect Platform Introduction](https://effect.website/docs/platform/introduction/)
- [Effect Platform FileSystem](https://effect.website/docs/platform/file-system/)
- [Effect Platform Command](https://effect.website/docs/platform/command/)
- [Effect Schema Introduction](https://effect.website/docs/schema/introduction/)
- [Effect Configuration](https://effect.website/docs/configuration/)
- [Effect Managing Layers](https://effect.website/docs/requirements-management/layers/)
- [Effect Managing Services](https://effect.website/docs/requirements-management/services/)
- [Effect Error Handling](https://effect.website/docs/error-management/expected-errors/)
- [Effect Using Generators](https://effect.website/docs/getting-started/using-generators/)
- [Create Effect App](https://effect.website/docs/getting-started/create-effect-app/)

### GitHub
- [Effect Monorepo](https://github.com/Effect-TS/effect)
- [CLI Package Source](https://github.com/effect-ts/effect/tree/main/packages/cli)
- [CLI README](https://github.com/Effect-TS/effect/blob/main/packages/cli/README.md)
- [Effect Examples Repository](https://github.com/Effect-TS/examples)

### npm
- [@effect/cli on npm](https://www.npmjs.com/package/@effect/cli)
- [@effect/platform on npm](https://www.npmjs.com/package/@effect/platform)
- [effect on npm](https://www.npmjs.com/package/effect)

### Community Resources
- [Effect Solutions - CLI Guide](https://www.effect.solutions/cli)
- [Effect Solutions - Services & Layers](https://www.effect.solutions/services-and-layers)
- [Effect Solutions - Error Handling](https://www.effect.solutions/error-handling)
- [Effect Solutions - Config](https://www.effect.solutions/config)
- [DeepWiki - CLI Framework](https://deepwiki.com/Effect-TS/effect/8.1-cli-framework)
- [Sandro Maglione - Effect Introduction](https://www.sandromaglione.com/articles/complete-introduction-to-using-effect-in-typescript)
- [Yuri Bogomolov - Intro to Effect (Part 1-3)](https://ybogomolov.me/01-effect-intro)
- [Effect 2025 Year in Review](https://effect.website/blog/effect-2025-year-in-review/)
- [Micro for Effect Users](https://effect.website/docs/micro/effect-users/)
- [Bundle Size Discussion (Issue #4484)](https://github.com/Effect-TS/effect/issues/4484)
- [Object Exports Discussion (Issue #5317)](https://github.com/Effect-TS/effect/issues/5317)

### API Reference Pages
- [Command.ts API](https://effect-ts.github.io/effect/cli/Command.ts.html)
- [Args.ts API](https://effect-ts.github.io/effect/cli/Args.ts.html)
- [Options.ts API](https://effect-ts.github.io/effect/cli/Options.ts.html)
- [Prompt.ts API](https://effect-ts.github.io/effect/cli/Prompt.ts.html)
- [HelpDoc/Span.ts API](https://effect-ts.github.io/effect/cli/HelpDoc/Span.ts.html)
