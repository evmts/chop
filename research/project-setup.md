# TypeScript Project Setup for Chop

Complete project scaffolding reference for the Zig PoC to TypeScript migration.

---

## Table of Contents

1. [Directory Structure](#1-directory-structure)
2. [package.json](#2-packagejson)
3. [tsconfig.json](#3-tsconfigjson)
4. [vitest.config.ts](#4-vitestconfigts)
5. [tsup.config.ts](#5-tsupconfigts)
6. [biome.json](#6-biomejson)
7. [Bun Considerations](#7-bun-considerations)
8. [Entry Points](#8-entry-points)
9. [Build Scripts](#9-build-scripts)
10. [CI Configuration](#10-ci-configuration)

---

## 1. Directory Structure

```
chop/
├── bin/
│   ├── chop.ts                 # CLI + TUI entry point
│   └── chop-mcp.ts             # MCP server entry point
├── src/
│   ├── cli/
│   │   ├── index.ts            # CLI command tree (@effect/cli)
│   │   ├── commands/
│   │   │   ├── abi.ts          # abi-encode, abi-decode, calldata, calldata-decode
│   │   │   ├── address.ts      # to-check-sum-address, compute-address, create2
│   │   │   ├── convert.ts      # from-wei, to-wei, to-hex, to-dec, to-base
│   │   │   ├── crypto.ts       # keccak, sig, sig-event
│   │   │   ├── contract.ts     # call, storage, balance, nonce, code
│   │   │   ├── chain.ts        # block, tx, receipt, chain-id, gas-price
│   │   │   ├── bytecode.ts     # disassemble, 4byte, 4byte-event
│   │   │   └── node.ts         # node (start local devnet)
│   │   └── formatters/
│   │       ├── json.ts         # JSON output formatting
│   │       └── human.ts        # Human-readable output formatting
│   ├── tui/
│   │   ├── index.ts            # TUI entry (OpenTUI app)
│   │   ├── App.tsx             # Root component (tab navigation)
│   │   ├── views/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── CallHistory.tsx
│   │   │   ├── Contracts.tsx
│   │   │   ├── Accounts.tsx
│   │   │   ├── Blocks.tsx
│   │   │   ├── Transactions.tsx
│   │   │   ├── Settings.tsx
│   │   │   └── StateInspector.tsx
│   │   ├── components/
│   │   │   ├── Table.tsx
│   │   │   ├── Panel.tsx
│   │   │   ├── StatusBar.tsx
│   │   │   └── TabBar.tsx
│   │   └── theme.ts            # Dracula color palette
│   ├── node/
│   │   ├── index.ts            # TevmNode service composition
│   │   ├── services/
│   │   │   ├── StateManagerService.ts
│   │   │   ├── BlockchainService.ts
│   │   │   ├── EvmService.ts
│   │   │   ├── VmService.ts
│   │   │   ├── TxPoolService.ts
│   │   │   ├── MiningService.ts
│   │   │   └── TransportService.ts
│   │   ├── layers/
│   │   │   ├── local.ts        # LocalBaseLive
│   │   │   └── fork.ts         # ForkBaseLive + HttpTransport
│   │   └── errors.ts           # Data.TaggedError types
│   ├── evm/
│   │   ├── wasm.ts             # WASM EVM binding (guillotine-mini)
│   │   ├── host-adapter.ts     # Bridge between WASM and Effect state
│   │   ├── intrinsic-gas.ts    # Gas calculation
│   │   ├── tx-processor.ts     # Transaction processing
│   │   └── release-spec.ts     # Hardfork feature flags
│   ├── state/
│   │   ├── world-state.ts      # WorldStateService
│   │   ├── journal.ts          # JournalService
│   │   └── account.ts          # Account types and utilities
│   ├── blockchain/
│   │   ├── blockchain.ts       # BlockchainService
│   │   ├── block-store.ts      # BlockStoreService
│   │   └── header-validator.ts # BlockHeaderValidatorService
│   ├── mcp/
│   │   ├── server.ts           # MCP server setup
│   │   ├── tools/
│   │   │   ├── abi.ts
│   │   │   ├── address.ts
│   │   │   ├── contract.ts
│   │   │   └── devnet.ts
│   │   ├── resources.ts        # MCP resource handlers
│   │   └── prompts.ts          # MCP prompt templates
│   ├── rpc/
│   │   ├── server.ts           # JSON-RPC server (HTTP)
│   │   ├── handlers.ts         # RPC method → handler mapping
│   │   └── procedures/
│   │       ├── eth.ts          # eth_* methods
│   │       ├── anvil.ts        # anvil_* methods
│   │       └── tevm.ts         # tevm_* methods
│   └── shared/
│       ├── types.ts            # Shared branded types (re-exports from voltaire-effect)
│       └── config.ts           # Runtime configuration
├── test/
│   ├── fixtures/               # Shared test data
│   ├── helpers/                # Test utilities
│   └── e2e/                    # End-to-end tests
├── demos/
│   ├── theme.tape              # VHS theme settings
│   └── *.tape                  # VHS demo tapes
├── tests/golden/               # VHS golden file baselines
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── tsup.config.ts
├── biome.json
├── SKILL.md                    # Claude Code skill definition
├── AGENTS.md                   # Codex agent definition
├── .mcp.json                   # MCP server configuration
├── CLAUDE.md                   # Claude Code project context
└── README.md
```

---

## 2. package.json

```json
{
  "name": "chop",
  "version": "0.1.0",
  "description": "Ethereum Swiss Army knife - cast-compatible CLI, TUI, and MCP server",
  "type": "module",
  "license": "MIT",
  "bin": {
    "chop": "./dist/bin/chop.js",
    "chop-mcp": "./dist/bin/chop-mcp.js"
  },
  "exports": {
    ".": {
      "import": "./dist/src/index.js",
      "types": "./dist/src/index.d.ts"
    },
    "./cli": {
      "import": "./dist/src/cli/index.js",
      "types": "./dist/src/cli/index.d.ts"
    },
    "./node": {
      "import": "./dist/src/node/index.js",
      "types": "./dist/src/node/index.d.ts"
    },
    "./mcp": {
      "import": "./dist/src/mcp/server.js",
      "types": "./dist/src/mcp/server.d.ts"
    }
  },
  "files": [
    "dist/",
    "wasm/",
    "SKILL.md",
    "AGENTS.md"
  ],
  "scripts": {
    "build": "tsup",
    "build:wasm": "cd guillotine && zig build wasm && cp zig-out/bin/guillotine_mini.wasm ../wasm/",
    "dev": "bun run bin/chop.ts",
    "dev:mcp": "bun run bin/chop-mcp.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:golden": "./scripts/test-golden.sh",
    "test:e2e": "vitest run test/e2e/",
    "lint": "biome check src/ bin/ test/",
    "lint:fix": "biome check --write src/ bin/ test/",
    "format": "biome format --write src/ bin/ test/",
    "typecheck": "tsc --noEmit",
    "demo": "vhs demos/cli-overview.tape",
    "demo:all": "for f in demos/*.tape; do vhs \"$f\"; done",
    "prepublishOnly": "bun run build"
  },
  "dependencies": {
    "@effect/cli": "^0.52.0",
    "@effect/platform": "^0.76.0",
    "@effect/platform-bun": "^0.56.0",
    "@modelcontextprotocol/sdk": "^1.12.0",
    "effect": "^3.14.0",
    "voltaire-effect": "^0.3.0",
    "@tevm/voltaire": "^0.1.0"
  },
  "optionalDependencies": {
    "@opentui/core": "^0.1.0",
    "@opentui/react": "^0.1.0"
  },
  "devDependencies": {
    "@effect/vitest": "^0.18.0",
    "@types/bun": "^1.2.0",
    "biome": "^1.9.0",
    "tsup": "^8.4.0",
    "typescript": "^5.9.0",
    "vitest": "^2.2.0",
    "@vitest/coverage-v8": "^2.2.0"
  },
  "engines": {
    "node": ">=22.0.0",
    "bun": ">=1.2.0"
  },
  "packageManager": "bun@1.2.0"
}
```

### Dependency Notes

| Package | Purpose | Why This Version |
|---------|---------|-----------------|
| `effect` | Core Effect library | ^3.14 for latest Layer/Ref/Schema APIs |
| `@effect/cli` | CLI framework with typed args, options, subcommands | Effect-native CLI, replaces yargs/commander |
| `@effect/platform` | Cross-platform HTTP, filesystem, terminal abstractions | For HTTP client (fork mode), terminal I/O |
| `@effect/platform-bun` | Bun-specific platform implementation | Required by OpenTUI, provides BunRuntime |
| `voltaire-effect` | Ethereum primitives in Effect (Address, Hash, Block, Tx) | Branded types, Schema validators, crypto |
| `@tevm/voltaire` | Core Voltaire library (Zig-backed crypto, precompiles) | WASM/native acceleration |
| `@modelcontextprotocol/sdk` | MCP TypeScript SDK | stdio/HTTP transport, tool/resource/prompt APIs |
| `@opentui/core` | Terminal UI framework (Zig-backed rendering) | TUI rendering engine |
| `@opentui/react` | React integration for OpenTUI | JSX component model for TUI views |
| `@effect/vitest` | Vitest integration for Effect tests | `it.effect`, `it.scoped`, layer provision |
| `tsup` | TypeScript bundler (esbuild-based) | Fast builds, ESM output, .d.ts generation |
| `biome` | Linter + formatter (replaces eslint + prettier) | Fast, zero-config, consistent |

---

## 3. tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": ".",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "esModuleInterop": false,
    "resolveJsonModule": true,
    "jsx": "react-jsx",
    "jsxImportSource": "@opentui/react",
    "paths": {
      "#cli/*": ["./src/cli/*"],
      "#tui/*": ["./src/tui/*"],
      "#node/*": ["./src/node/*"],
      "#evm/*": ["./src/evm/*"],
      "#state/*": ["./src/state/*"],
      "#blockchain/*": ["./src/blockchain/*"],
      "#mcp/*": ["./src/mcp/*"],
      "#rpc/*": ["./src/rpc/*"],
      "#shared/*": ["./src/shared/*"]
    },
    "types": ["bun-types"]
  },
  "include": [
    "src/**/*.ts",
    "src/**/*.tsx",
    "bin/**/*.ts",
    "test/**/*.ts"
  ],
  "exclude": [
    "node_modules",
    "dist"
  ]
}
```

### Key Decisions

| Setting | Value | Rationale |
|---------|-------|-----------|
| `target: ES2022` | Modern baseline | top-level await, `structuredClone`, `Array.at()` |
| `module: ESNext` | ESM-only | Effect is ESM-only, no CJS needed |
| `moduleResolution: bundler` | For tsup/bun | Supports `#imports`, `.js` extensions optional |
| `strict: true` | All strict checks | Required for Effect type inference |
| `noUncheckedIndexedAccess` | Extra safety | Prevents unsafe array/object access |
| `exactOptionalPropertyTypes` | Stricter | `undefined` and missing are different |
| `verbatimModuleSyntax` | ESM correctness | Prevents import elision issues |
| `jsx: react-jsx` | Auto-import | OpenTUI uses React-compatible JSX |
| `paths` | Module aliases | Clean imports without deep relative paths |

---

## 4. vitest.config.ts

```typescript
import { defineConfig } from "vitest/config"
import { resolve } from "path"

export default defineConfig({
  test: {
    // Use forks pool for maximum compatibility with Effect
    pool: "forks",

    include: [
      "src/**/*.test.ts",
      "test/**/*.test.ts",
    ],

    // Exclude E2E tests from unit test runs
    exclude: [
      "test/e2e/**",
      "node_modules/**",
    ],

    // Global test timeout (Effect programs may take longer)
    testTimeout: 10_000,

    // Coverage configuration
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/index.ts",
        "src/tui/**",       // TUI components tested via E2E
      ],
      reporter: ["text", "html", "lcov", "json-summary"],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },

    // Snapshot format
    snapshotFormat: {
      printBasicPrototype: false,
    },

    // TypeScript path aliases
    alias: {
      "#cli": resolve(__dirname, "src/cli"),
      "#tui": resolve(__dirname, "src/tui"),
      "#node": resolve(__dirname, "src/node"),
      "#evm": resolve(__dirname, "src/evm"),
      "#state": resolve(__dirname, "src/state"),
      "#blockchain": resolve(__dirname, "src/blockchain"),
      "#mcp": resolve(__dirname, "src/mcp"),
      "#rpc": resolve(__dirname, "src/rpc"),
      "#shared": resolve(__dirname, "src/shared"),
    },
  },
})
```

### E2E Test Config

```typescript
// vitest.config.e2e.ts
import { defineConfig, mergeConfig } from "vitest/config"
import baseConfig from "./vitest.config"

export default mergeConfig(baseConfig, defineConfig({
  test: {
    include: ["test/e2e/**/*.test.ts"],
    testTimeout: 30_000,
    // E2E tests are sequential (shared devnet)
    sequence: {
      concurrent: false,
    },
  },
}))
```

---

## 5. tsup.config.ts

```typescript
import { defineConfig } from "tsup"

export default defineConfig({
  entry: {
    "bin/chop": "bin/chop.ts",
    "bin/chop-mcp": "bin/chop-mcp.ts",
    "src/index": "src/index.ts",
    "src/cli/index": "src/cli/index.ts",
    "src/node/index": "src/node/index.ts",
    "src/mcp/server": "src/mcp/server.ts",
  },
  format: ["esm"],
  target: "node22",
  platform: "node",
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: true,
  treeshake: true,
  skipNodeModulesBundle: true,
  external: [
    // Bun-specific modules (not bundled)
    "bun:ffi",
    "bun:test",
    // OpenTUI has native dependencies
    "@opentui/core",
    "@opentui/react",
  ],
  banner: {
    // Shebang for CLI entry points
    js: (ctx) =>
      ctx.options.entry &&
      Object.keys(ctx.options.entry).some((k) => k.startsWith("bin/"))
        ? "#!/usr/bin/env node"
        : "",
  },
})
```

### Build Notes

- **ESM only**: No CJS output needed. Effect is ESM-only.
- **tree-shaking**: Enabled to eliminate unused code paths.
- **splitting**: Enabled for shared chunks between entry points.
- **skipNodeModulesBundle**: Dependencies stay external (installed by users).
- **external**: Bun FFI and OpenTUI have native bindings, can't be bundled.

---

## 6. biome.json

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "complexity": {
        "noExcessiveCognitiveComplexity": {
          "level": "warn",
          "options": { "maxAllowedComplexity": 25 }
        }
      },
      "correctness": {
        "noUnusedImports": "error",
        "noUnusedVariables": "warn",
        "useExhaustiveDependencies": "warn"
      },
      "style": {
        "noNonNullAssertion": "warn",
        "useConst": "error",
        "useTemplate": "error"
      },
      "suspicious": {
        "noExplicitAny": "warn",
        "noConfusingVoidType": "off"
      },
      "nursery": {
        "noUndeclaredDependencies": "error"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "tab",
    "indentWidth": 2,
    "lineWidth": 120,
    "lineEnding": "lf"
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "semicolons": "asNeeded",
      "trailingCommas": "all",
      "arrowParentheses": "always"
    },
    "parser": {
      "unsafeParameterDecoratorsEnabled": false
    }
  },
  "json": {
    "formatter": {
      "trailingCommas": "none"
    }
  },
  "files": {
    "include": ["src/**", "bin/**", "test/**"],
    "ignore": [
      "dist/**",
      "node_modules/**",
      "wasm/**",
      "demos/**/*.gif",
      "*.md"
    ]
  }
}
```

### Biome Notes

- **Tabs**: Consistent with Effect ecosystem conventions.
- **Double quotes**: Consistent with Effect and JSON.
- **No semicolons**: Cleaner Effect pipe chains.
- **120 line width**: Accommodates Effect's verbose type signatures.
- **noConfusingVoidType: off**: Effect uses `void` in type positions frequently.
- **noExplicitAny: warn**: Effect occasionally requires `any` for generic boundaries.

---

## 7. Bun Considerations

### Why Bun

OpenTUI requires Bun for its native FFI bridge (`bun:ffi`). This means:

1. **Development**: Use `bun run` for all scripts
2. **TUI mode**: Must run under Bun runtime
3. **CLI mode**: Can run under Node.js or Bun
4. **MCP server**: Can run under Node.js or Bun
5. **Tests**: Run via `vitest` (works with both runtimes)

### Bun-Specific Files

```toml
# bunfig.toml
[install]
peer = false

[test]
preload = ["./test/setup.ts"]
```

### Runtime Detection

```typescript
// src/shared/runtime.ts
export const isBun = typeof globalThis.Bun !== "undefined"

export const assertBun = () => {
  if (!isBun) {
    throw new Error(
      "TUI mode requires Bun runtime. Install from https://bun.sh and run: bun run bin/chop.ts"
    )
  }
}
```

### Entry Point Dispatch

```typescript
// bin/chop.ts
import { Effect } from "effect"
import { BunRuntime } from "@effect/platform-bun"
import { cli } from "#cli/index"
import { isBun } from "#shared/runtime"

const program = Effect.gen(function* () {
  const args = process.argv.slice(2)

  if (args.length === 0 || args[0] === "tui") {
    // TUI mode: requires Bun
    if (!isBun) {
      yield* Effect.logError("TUI mode requires Bun runtime")
      yield* Effect.fail(new Error("Bun required"))
    }
    const { startTui } = await import("#tui/index")
    yield* startTui()
  } else {
    // CLI mode: works on any runtime
    yield* cli(args)
  }
})

// Run with Bun runtime if available, otherwise Node
if (isBun) {
  BunRuntime.runMain(program)
} else {
  const { NodeRuntime } = await import("@effect/platform-node")
  NodeRuntime.runMain(program)
}
```

---

## 8. Entry Points

### bin/chop.ts (CLI + TUI)

```typescript
#!/usr/bin/env bun
import { Effect } from "effect"
import { BunRuntime } from "@effect/platform-bun"
import { Command } from "@effect/cli"

// Root command with subcommands
const rootCommand = Command.make("chop", {
  version: Command.prompt("version", Command.boolean),
}, () => {
  // No args = launch TUI
  return Effect.gen(function* () {
    const { startTui } = yield* Effect.tryPromise(() => import("#tui/index"))
    yield* startTui()
  })
}).pipe(
  Command.withSubcommands([
    abiCommand,
    addressCommand,
    convertCommand,
    cryptoCommand,
    contractCommand,
    chainCommand,
    bytecodeCommand,
    nodeCommand,
    tuiCommand,
  ])
)

const cli = Command.run(rootCommand, {
  name: "chop",
  version: "0.1.0",
})

BunRuntime.runMain(cli(process.argv))
```

### bin/chop-mcp.ts (MCP Server)

```typescript
#!/usr/bin/env node
import { Effect } from "effect"
import { NodeRuntime } from "@effect/platform-node"
import { createMcpServer } from "#mcp/server"

const program = Effect.gen(function* () {
  const server = yield* createMcpServer()
  yield* server.start()
  yield* Effect.never  // Keep running until terminated
}).pipe(Effect.scoped)

NodeRuntime.runMain(program)
```

---

## 9. Build Scripts

### Development Workflow

```bash
# Install dependencies
bun install

# Build WASM (one-time or after Zig changes)
bun run build:wasm

# Development mode (runs directly via Bun)
bun run dev                     # CLI/TUI
bun run dev:mcp                 # MCP server

# Run tests
bun run test                    # Unit tests
bun run test:watch              # Watch mode
bun run test:coverage           # With coverage report
bun run test:e2e                # E2E tests

# Lint and format
bun run lint                    # Check for issues
bun run lint:fix                # Auto-fix issues
bun run format                  # Format all files
bun run typecheck               # TypeScript type checking

# Build for distribution
bun run build                   # Compile via tsup

# Generate demos
bun run demo                    # Generate overview demo GIF
bun run demo:all                # Generate all demo GIFs
```

### Pre-commit Hook

```bash
#!/bin/bash
# .husky/pre-commit (or via lefthook/lint-staged)
bun run typecheck && bun run lint && bun run test
```

---

## 10. CI Configuration

### GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun run typecheck

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun run lint

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun run test:coverage
      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: coverage/lcov.info

  e2e:
    runs-on: ubuntu-latest
    needs: [test]
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun run build
      - run: bun run test:e2e

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun run build
      - name: Verify package
        run: |
          # Check that dist/ has expected entry points
          test -f dist/bin/chop.js
          test -f dist/bin/chop-mcp.js
          test -f dist/src/index.js
          test -f dist/src/index.d.ts
```

---

## Sources

- Effect CLI: https://effect.website/docs/guides/cli
- Effect Platform: https://effect.website/docs/guides/platform
- OpenTUI: `research/opentui.md`
- Vitest + @effect/vitest: `research/testing-stack.md`
- TEVM build patterns: `research/tevm-reference.md`
- Biome: https://biomejs.dev
- tsup: https://tsup.egoist.dev
