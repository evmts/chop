# Chop - Guillotine EVM CLI

A hybrid Zig/Go project that uses the guillotine-mini EVM for Ethereum transaction processing with a Bubble Tea-based TUI.

## Project Structure

```
chop/
├── build.zig                        # Unified build system (orchestrates everything)
├── src/                             # Zig source code
│   ├── main.zig                     # Zig entry point
│   └── root.zig                     # Zig module root
├── main.go                          # Go application entry point
├── internal/                        # Go source code
│   ├── app/                         # Application logic
│   │   ├── model.go                 # Bubble Tea model
│   │   ├── init.go                  # Initialization logic
│   │   ├── update.go                # Update function
│   │   ├── view.go                  # View rendering
│   │   ├── handlers.go              # Event handlers & navigation
│   │   ├── parameters.go            # Call parameter management
│   │   └── table_helpers.go         # Table update helpers
│   ├── config/                      # Configuration & constants
│   │   └── config.go                # App config, colors, keys
│   ├── core/                        # Core business logic
│   │   ├── logs.go                  # Log helpers
│   │   ├── bytecode/                # Bytecode analysis (stubbed)
│   │   │   └── bytecode.go
│   │   ├── evm/                     # EVM execution (stubbed)
│   │   │   └── evm.go
│   │   ├── history/                 # Call history management
│   │   │   └── history.go
│   │   ├── state/                   # State persistence
│   │   │   └── state.go
│   │   └── utils/                   # Utility functions
│   │       └── utils.go
│   ├── types/                       # Type definitions
│   │   └── types.go
│   └── ui/                          # UI components & rendering
│       └── ui.go
├── lib/
│   └── guillotine-mini/             # Git submodule - EVM implementation in Zig
├── zig-out/                         # Build artifacts
│   └── bin/
│       ├── chop                     # Zig executable
│       ├── chop-go                  # Go executable
│       └── guillotine_mini.wasm     # EVM WASM library
├── go.mod
├── go.sum
└── .gitmodules                      # Git submodule configuration
```

## Features

### Current (Stubbed)

- **Interactive TUI**: Full-featured Bubble Tea interface
- **Call Parameter Configuration**: Configure EVM calls with validation
- **Call History**: View past call executions
- **Contract Management**: Track deployed contracts
- **State Persistence**: Save and restore session state
- **Bytecode Disassembly**: View disassembled contract bytecode (stubbed)

### Application States

1. **Main Menu**: Navigate between features
2. **Call Parameter List**: Configure call parameters
3. **Call Parameter Edit**: Edit individual parameters
4. **Call Execution**: Execute EVM calls
5. **Call Results**: View execution results
6. **Call History**: Browse past executions
7. **Contracts**: View deployed contracts
8. **Contract Details**: Detailed contract view with disassembly

### Keyboard Shortcuts

- `↑/↓` or `k/j`: Navigate
- `←/→` or `h/l`: Navigate blocks (in disassembly)
- `Enter`: Select/Confirm
- `Esc`: Back/Cancel
- `e`: Execute call
- `r`: Reset parameter
- `R`: Reset all parameters
- `c`: Copy to clipboard
- `ctrl+v`: Paste from clipboard
- `q` or `ctrl+c`: Quit

## Prerequisites

- **Zig**: 0.15.1 or later
- **Go**: 1.21 or later
- **Git**: For submodule management

## Setup

Initialize the submodules:

```bash
git submodule update --init --recursive
```

## Build System

The project uses Zig's build system as the primary orchestrator. All build commands go through `zig build`.

### Available Commands

| Command | Description |
|---------|-------------|
| `zig build` | Build everything (default: Zig, Go, and guillotine-mini) |
| `zig build all` | Explicitly build everything |
| `zig build run` | Build and run the Zig executable |
| `zig build go` | Build only the Go binary |
| `zig build guillotine` | Build only the guillotine-mini WASM library |
| `zig build test` | Run all tests (Zig and Go) |
| `zig build go-test` | Run only Go tests |
| `zig build clean` | Remove all build artifacts |

### Quick Start

```bash
# Build everything
zig build

# Run the Go TUI application
zig-out/bin/chop-go

# Or build and run directly
zig build go && ./zig-out/bin/chop-go

# Run all tests
zig build test
```

## Components

### Chop (Zig)

The Zig application component.

**Source**: `src/`
**Output**: `zig-out/bin/chop`

### Chop Go (TUI Application)

The Go application with Bubble Tea TUI.

**Source**: `internal/`, `main.go`
**Output**: `zig-out/bin/chop-go`

### Guillotine-mini

The EVM implementation, built as a WASM library.

**Source**: `lib/guillotine-mini/` (submodule)
**Output**: `lib/guillotine-mini/zig-out/bin/guillotine_mini.wasm`

## TODO: Guillotine Integration

The following components are stubbed and need to be integrated with the guillotine-mini submodule:

1. **EVM Execution** (`internal/core/evm/evm.go`)
   - Replace stubbed `ExecuteCall` with actual Guillotine VM calls
   - Implement VM lifecycle management
   - Handle actual EVM state

2. **Bytecode Analysis** (`internal/core/bytecode/bytecode.go`)
   - Implement real EVM opcode disassembly
   - Add control flow analysis
   - Generate basic blocks

3. **State Replay** (`internal/core/state/state.go`)
   - Implement state replay through VM

4. **Clipboard Support** (`internal/ui/ui.go`)
   - Implement actual clipboard read/write operations

## Development

The codebase is organized into clear layers:

- **Presentation Layer**: `internal/ui/` and `internal/app/view.go`
- **Application Layer**: `internal/app/` (handlers, navigation, state management)
- **Domain Layer**: `internal/core/` (EVM, history, bytecode analysis)
- **Infrastructure Layer**: `internal/core/state/` (persistence)

All EVM-related functionality is stubbed with clear TODO markers for easy integration with Guillotine.

### Making Changes

1. Edit your code in `src/` (Zig) or `internal/`, `main.go` (Go)
2. Run `zig build` to rebuild
3. Run `zig build test` to verify tests pass

### Working with Guillotine-mini

The `guillotine-mini` submodule is a separate Zig project with its own build system.

```bash
# Build the WASM library through the main build system
zig build guillotine

# Or build it directly in the submodule
cd lib/guillotine-mini
zig build wasm
```

See `lib/guillotine-mini/README.md` or `lib/guillotine-mini/CLAUDE.md` for detailed documentation on the EVM implementation.

### Cleaning Build Artifacts

```bash
zig build clean
```

This removes:
- `zig-out/` (main project artifacts)
- `zig-cache/` (Zig build cache)
- `lib/guillotine-mini/zig-out/` (submodule artifacts)
- `lib/guillotine-mini/zig-cache/` (submodule cache)

## Go TUI Usage (Chop)

Build and run the Go TUI directly:

```bash
CGO_ENABLED=0 go build -o chop .
./chop
```

Tabs:
- [1] Dashboard: Stats, recent blocks/txs (auto-refresh status shown)
- [2] Accounts: Enter to view; 'p' to reveal private key
- [3] Blocks: Enter to view block detail
- [4] Transactions: Enter for transaction detail; in detail view press 'b' to open block
- [5] Contracts: Enter to view details; 'c' copies address
- [6] State Inspector: Type/paste address (ctrl+v), Enter to inspect
- [7] Settings: 'r' reset blockchain, 'g' regenerate accounts (confirmation), 't' toggle auto-refresh

Global:
- Number keys 1–7 switch tabs; esc goes back; q or ctrl+c quits
- 'c' in detail views copies the primary identifier (e.g., tx hash)

## Why Zig Build?

We use Zig's build system as the orchestrator because:

1. **Unified Interface**: Single command (`zig build`) for all components
2. **Cross-Platform**: Works consistently across macOS, Linux, Windows
3. **Dependency Management**: Properly tracks dependencies between components
4. **Parallelization**: Automatically parallelizes independent build steps
5. **Caching**: Only rebuilds what changed
