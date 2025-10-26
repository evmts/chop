# Chop - Guillotine EVM CLI

![CI](https://github.com/evmts/chop/workflows/CI/badge.svg)
[![codecov](https://codecov.io/gh/evmts/chop/branch/main/graph/badge.svg)](https://codecov.io/gh/evmts/chop)
[![Security](https://github.com/evmts/chop/workflows/Security/badge.svg)](https://github.com/evmts/chop/actions/workflows/security.yml)
[![Go Report Card](https://goreportcard.com/badge/github.com/evmts/chop)](https://goreportcard.com/report/github.com/evmts/chop)
[![Release](https://img.shields.io/github/v/release/evmts/chop)](https://github.com/evmts/chop/releases)

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

- **Zig**: 0.15.1 or later (for building from source)
- **Go**: 1.21 or later (for building from source)
- **Git**: For submodule management (for building from source)

## Installation

### Pre-built Binaries (Recommended)

Download pre-built binaries for your platform from the [GitHub Releases](https://github.com/evmts/chop/releases) page.

#### macOS

```bash
# Intel Mac
curl -LO https://github.com/evmts/chop/releases/latest/download/chop_latest_darwin_amd64.tar.gz
tar -xzf chop_latest_darwin_amd64.tar.gz
chmod +x chop
sudo mv chop /usr/local/bin/

# Apple Silicon Mac
curl -LO https://github.com/evmts/chop/releases/latest/download/chop_latest_darwin_arm64.tar.gz
tar -xzf chop_latest_darwin_arm64.tar.gz
chmod +x chop
sudo mv chop /usr/local/bin/
```

#### Linux

```bash
# AMD64
curl -LO https://github.com/evmts/chop/releases/latest/download/chop_latest_linux_amd64.tar.gz
tar -xzf chop_latest_linux_amd64.tar.gz
chmod +x chop
sudo mv chop /usr/local/bin/

# ARM64
curl -LO https://github.com/evmts/chop/releases/latest/download/chop_latest_linux_arm64.tar.gz
tar -xzf chop_latest_linux_arm64.tar.gz
chmod +x chop
sudo mv chop /usr/local/bin/
```

#### Windows

Download the appropriate `.zip` file for your architecture from the [releases page](https://github.com/evmts/chop/releases), extract it, and add the executable to your PATH.

### Building from Source

If you prefer to build from source, see the [Build System](#build-system) section below.

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

## Testing

### Running Tests

```bash
# Run all Go tests
go test ./...

# Run tests with verbose output
go test ./... -v

# Run tests with race detector (recommended for development)
go test ./... -race

# Run tests with coverage report
go test ./... -cover

# Generate detailed coverage report
go test ./... -coverprofile=coverage.txt -covermode=atomic
go tool cover -html=coverage.txt -o coverage.html
```

### Running Tests via Zig Build

```bash
# Run all tests (Zig and Go)
zig build test

# Run only Go tests
zig build go-test
```

### Security Scanning

The project includes automated security scanning that runs on every push and pull request.

#### Running Security Scans Locally

```bash
# Install gosec (security scanner)
go install github.com/securego/gosec/v2/cmd/gosec@latest

# Run gosec security scan
gosec ./...

# Run gosec with detailed output
gosec -fmt=json -out=results.json ./...

# Install govulncheck (vulnerability scanner)
go install golang.org/x/vuln/cmd/govulncheck@latest

# Run vulnerability check
govulncheck ./...
```

#### What Gets Scanned

- **gosec**: Static security analysis checking for:
  - Hardcoded credentials (G101)
  - SQL injection vulnerabilities (G201-G202)
  - File permission issues (G301-G304)
  - Weak cryptography (G401-G404)
  - Unsafe operations and more

- **govulncheck**: Checks dependencies against the Go vulnerability database
  - Scans both direct and indirect dependencies
  - Reports known CVEs in your dependency tree

- **Dependabot**: Automated dependency updates
  - Weekly checks for Go module updates
  - Weekly checks for GitHub Actions updates
  - Automatic security patch PRs

Configuration files:
- `.gosec.yml` - gosec scanner configuration
- `.github/dependabot.yml` - Dependabot configuration
- `.github/workflows/security.yml` - Security workflow

### Code Quality and Linting

The project uses `golangci-lint` for comprehensive code quality checks and linting.

#### Running Linters Locally

```bash
# Install golangci-lint (macOS)
brew install golangci-lint

# Or install via go install
go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest

# Run all linters
golangci-lint run ./...

# Run linters with timeout
golangci-lint run ./... --timeout=5m

# Run linters and automatically fix issues (where possible)
golangci-lint run ./... --fix
```

#### Enabled Linters

The project uses `.golangci.yml` for configuration with the following categories of linters:

**Code Correctness:**
- `errcheck` - Check for unchecked errors
- `govet` - Official Go static analyzer
- `staticcheck` - Go static analysis
- `typecheck` - Type-check Go code
- `ineffassign` - Detect ineffectual assignments
- `unused` - Check for unused code

**Code Style:**
- `gofmt` - Check code formatting
- `goimports` - Check import formatting
- `revive` - Fast, configurable linter
- `gocritic` - Comprehensive Go source code linter

**Code Quality:**
- `gosimple` - Simplify code suggestions
- `gocyclo` - Check cyclomatic complexity
- `dupl` - Check for code duplication
- `unconvert` - Remove unnecessary type conversions
- `unparam` - Check for unused function parameters

**Security:**
- `gosec` - Inspect for security issues

**Performance:**
- `prealloc` - Find slice declarations that could be preallocated

**Common Errors:**
- `misspell` - Check for commonly misspelled words
- `goconst` - Find repeated strings that could be constants
- `nilerr` - Find code that returns nil incorrectly
- `bodyclose` - Check HTTP response body is closed

#### Current Linting Status

As of the last check, the codebase has approximately 89 linting issues across the following categories:
- `gocritic` (34 issues) - Code style suggestions
- `gofmt` (13 issues) - Formatting issues
- `goimports` (11 issues) - Import organization
- `gocyclo` (8 issues) - High cyclomatic complexity
- `goconst` (7 issues) - Repeated strings
- `gosec` (4 issues) - Security warnings
- `errcheck` (4 issues) - Unchecked errors
- `revive` (4 issues) - Style violations
- Other minor issues (4 issues)

Most issues are style-related and can be automatically fixed with `golangci-lint run --fix`. The linter is configured to be reasonable for existing code while maintaining good practices.

Configuration file: `.golangci.yml`

### Continuous Integration

All pull requests and commits to `main` automatically run:
- **Tests** on Go versions 1.22, 1.24 and platforms Ubuntu (Linux), macOS
- **Linting** with golangci-lint for code quality checks
- **Security scans** with gosec and govulncheck
- **Dependency review** for known vulnerabilities
- **Code coverage** reporting to Codecov

You can view the CI status in the [GitHub Actions](https://github.com/evmts/chop/actions) tab.

## Why Zig Build?

We use Zig's build system as the orchestrator because:

1. **Unified Interface**: Single command (`zig build`) for all components
2. **Cross-Platform**: Works consistently across macOS, Linux, Windows
3. **Dependency Management**: Properly tracks dependencies between components
4. **Parallelization**: Automatically parallelizes independent build steps
5. **Caching**: Only rebuilds what changed

## Release Process (Maintainers)

The release process is fully automated using GitHub Actions and GoReleaser.

### Creating a New Release

1. **Ensure all changes are committed and pushed to `main`**
   ```bash
   git checkout main
   git pull origin main
   ```

2. **Create and push a version tag** (following [Semantic Versioning](https://semver.org/))
   ```bash
   # For a new feature release
   git tag -a v0.1.0 -m "Release v0.1.0: Initial release with TUI"

   # For a bug fix release
   git tag -a v0.1.1 -m "Release v0.1.1: Fix state persistence bug"

   # For a major release with breaking changes
   git tag -a v1.0.0 -m "Release v1.0.0: First stable release"

   # Push the tag to trigger the release workflow
   git push origin v0.1.0
   ```

3. **GitHub Actions will automatically**:
   - Run all tests
   - Build binaries for all platforms (Linux, macOS, Windows) and architectures (amd64, arm64)
   - Generate checksums
   - Create a GitHub Release with:
     - Release notes from commit messages
     - Downloadable binaries for all platforms
     - Installation instructions

4. **Monitor the release**:
   - Visit the [Actions tab](https://github.com/evmts/chop/actions) to watch the release workflow
   - Once complete, check the [Releases page](https://github.com/evmts/chop/releases)

### Testing Releases Locally

You can test the release process locally without publishing:

```bash
# Install goreleaser (macOS)
brew install goreleaser

# Or download from https://github.com/goreleaser/goreleaser/releases

# Run goreleaser in snapshot mode (won't publish)
goreleaser release --snapshot --clean

# Built artifacts will be in dist/
ls -la dist/
```

### Release Checklist

Before creating a release, ensure:
- [ ] All tests pass: `go test ./...`
- [ ] Code builds successfully: `CGO_ENABLED=0 go build -o chop .`
- [ ] Documentation is up to date (README.md, DOCS.md)
- [ ] CHANGELOG or commit messages clearly describe changes
- [ ] Version follows [Semantic Versioning](https://semver.org/)
- [ ] No breaking changes in minor/patch releases

### Version Numbering Guide

- **Major version (v1.0.0)**: Breaking changes, incompatible API changes
- **Minor version (v0.1.0)**: New features, backwards-compatible
- **Patch version (v0.0.1)**: Bug fixes, backwards-compatible
