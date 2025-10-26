# Contributing to Chop

Thank you for your interest in contributing to Chop! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Testing Guidelines](#testing-guidelines)
- [Code Style](#code-style)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)
- [Project Structure](#project-structure)
- [Additional Resources](#additional-resources)

## Code of Conduct

We are committed to providing a welcoming and inclusive environment for all contributors. By participating in this project, you agree to:

- Be respectful and considerate in your communication
- Welcome newcomers and help them get started
- Accept constructive criticism gracefully
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Go**: 1.22 or later ([installation guide](https://go.dev/doc/install))
- **Zig**: 0.15.1 or later (for building from source) ([installation guide](https://ziglang.org/learn/getting-started/))
- **Git**: For version control
- **golangci-lint** (optional, for linting): [installation guide](https://golangci-lint.run/welcome/install/)

### Clone the Repository

Clone the repository with submodules:

```bash
git clone --recursive https://github.com/evmts/chop.git
cd chop
```

If you've already cloned without `--recursive`, initialize submodules:

```bash
git submodule update --init --recursive
```

### Build the Project

Build using the Zig build system (recommended):

```bash
zig build
```

Or build the Go binary directly:

```bash
CGO_ENABLED=0 go build -o chop .
```

### Run the Application

```bash
./chop
```

Or via Zig build:

```bash
zig build go && ./zig-out/bin/chop-go
```

## Development Workflow

### 1. Create a Feature Branch

Always create a new branch for your work:

```bash
git checkout -b feature/my-feature-name
```

Branch naming conventions:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions or modifications

### 2. Make Your Changes

- Write clean, idiomatic Go code
- Follow the [project structure](#project-structure)
- Add or update tests as needed
- Update documentation if you're changing functionality
- Keep commits atomic and focused

### 3. Test Your Changes

Run the full test suite:

```bash
go test ./...
```

Run tests with race detector (recommended):

```bash
go test -race ./...
```

Run tests with coverage:

```bash
go test -cover ./...
```

### 4. Run Linting

If you have golangci-lint installed:

```bash
golangci-lint run ./...
```

### 5. Commit Your Changes

Follow the [commit message guidelines](#commit-message-guidelines):

```bash
git add .
git commit -m "feat: add transaction filtering feature"
```

### 6. Push and Create Pull Request

```bash
git push origin feature/my-feature-name
```

Then create a pull request on GitHub targeting the `main` branch.

## Testing Guidelines

### Test Requirements

- **All new features must have tests**
- **Bug fixes should include regression tests**
- **Aim for >80% coverage on new code**

### Running Tests

```bash
# Run all tests
go test ./...

# Run tests with verbose output
go test ./... -v

# Run tests with race detector
go test ./... -race

# Run tests with coverage
go test ./... -cover

# Generate detailed coverage report
go test ./... -coverprofile=coverage.txt -covermode=atomic
go tool cover -html=coverage.txt -o coverage.html
```

### Test Organization

Tests are located alongside the code they test:

```
core/
├── accounts/
│   ├── accounts.go
│   ├── accounts_test.go
│   ├── seed.go
│   └── seed_test.go
```

### Writing Tests

Follow Go testing best practices:

```go
func TestAccountCreation(t *testing.T) {
    // Arrange
    manager, err := accounts.NewManager()
    if err != nil {
        t.Fatalf("Failed to create manager: %v", err)
    }

    // Act
    account, err := manager.GetAccount("0x1234...")

    // Assert
    if err != nil {
        t.Errorf("Expected no error, got: %v", err)
    }
    if account == nil {
        t.Error("Expected account to be non-nil")
    }
}
```

### Test Coverage by Module

Current coverage (as of latest test run):
- `core/accounts`: 96.6%
- `core/blockchain`: 98.6%
- `core/state`: 86.1%
- `core/utils`: 100.0%

We strive to maintain high test coverage across all core modules.

## Code Style

### Go Conventions

Follow standard Go conventions:

- Run `gofmt` on all code (use `go fmt ./...`)
- Run `goimports` to organize imports
- Follow [Effective Go](https://go.dev/doc/effective_go) guidelines
- Follow [Go Code Review Comments](https://go.dev/wiki/CodeReviewComments)

### Specific Guidelines

**1. Variable Naming**
- Use meaningful, descriptive names
- Avoid single-letter names except for short-lived loop variables
- Use camelCase for local variables, PascalCase for exported identifiers

```go
// Good
accountManager := accounts.NewManager()
transactionCount := blockchain.GetTransactionCount()

// Avoid
am := accounts.NewManager()
c := blockchain.GetTransactionCount()
```

**2. Function Design**
- Keep functions focused and small (typically <50 lines)
- Functions should do one thing well
- Use early returns to reduce nesting

```go
// Good
func GetAccount(address string) (*Account, error) {
    if address == "" {
        return nil, errors.New("address cannot be empty")
    }

    account, exists := manager.accounts[address]
    if !exists {
        return nil, errors.New("account not found")
    }

    return account, nil
}
```

**3. Error Handling**
- Always handle errors explicitly
- Provide context in error messages
- Use `fmt.Errorf` for wrapping errors

```go
account, err := manager.GetAccount(address)
if err != nil {
    return fmt.Errorf("failed to get account %s: %w", address, err)
}
```

**4. Comments**
- Add godoc comments to all exported functions, types, and constants
- Comments should explain "why", not "what"
- Keep comments up to date with code changes

```go
// NewManager creates a new account manager with a randomly generated seed.
// It automatically generates 10 pre-funded test accounts with 100 ETH each,
// similar to Ganache's behavior.
func NewManager() (*Manager, error) {
    // Implementation...
}
```

**5. Concurrency**
- Use mutexes for shared state (prefer `sync.RWMutex` when reads dominate)
- Document thread-safety guarantees
- Avoid goroutines in core business logic unless necessary

```go
// GetAccount is safe for concurrent use.
func (m *Manager) GetAccount(address string) (*types.Account, error) {
    m.mu.RLock()
    defer m.mu.RUnlock()

    // Access shared state safely
    account, exists := m.accounts[address]
    // ...
}
```

## Commit Message Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) format with emoji prefixes for visual clarity.

### Format

```
<emoji> <type>: <subject>

[optional body]

[optional footer]
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **test**: Test additions or modifications
- **refactor**: Code refactoring without changing functionality
- **style**: Code style changes (formatting, missing semicolons, etc.)
- **perf**: Performance improvements
- **chore**: Build process or auxiliary tool changes
- **ci**: CI/CD configuration changes

### Examples

```bash
# Feature
🎉 feat: add transaction filtering by address

# Bug fix
🐛 fix: resolve clipboard paste issue on macOS

# Documentation
📚 docs: update installation instructions

# Test
✅ test: add tests for state inspector

# Refactoring
♻️ refactor: simplify account manager initialization

# Performance
⚡ perf: optimize block retrieval queries

# Chore
🔧 chore: update dependencies
```

### Best Practices

- Use imperative mood ("add feature" not "added feature")
- Keep subject line under 72 characters
- Capitalize the subject line
- Don't end subject line with a period
- Add body for complex changes explaining "why" not "what"

## Pull Request Process

### Before Submitting

1. **Ensure all tests pass**: `go test ./...`
2. **Run linter** (if available): `golangci-lint run ./...`
3. **Update documentation** if you've changed functionality
4. **Add tests** for new features or bug fixes
5. **Rebase on latest main** to avoid merge conflicts

### PR Template

When creating a PR, include:

**Title**: Follow commit message format (e.g., "feat: add state persistence")

**Description**:
```markdown
## Summary
Brief description of what this PR does.

## Changes
- List of key changes
- Another change

## Testing
How was this tested? What scenarios were covered?

## Related Issues
Closes #123
Relates to #456

## Screenshots (if applicable)
For UI changes, include before/after screenshots.
```

### Review Process

1. **Automated checks**: CI must pass (tests, build)
2. **Code review**: At least one maintainer approval required
3. **Address feedback**: Respond to review comments promptly
4. **Merge**: Maintainers will merge once approved

### After Merge

- Your PR will be squashed and merged to `main`
- Delete your feature branch
- The feature will be included in the next release

## Reporting Bugs

### Before Reporting

1. **Search existing issues** to avoid duplicates
2. **Verify the bug** on the latest version
3. **Collect information**: version, OS, terminal, reproduction steps

### Bug Report Template

Create a new issue with:

**Title**: Clear, concise description of the bug

**Description**:
```markdown
## Description
Clear description of what happened vs. what you expected.

## Steps to Reproduce
1. Step one
2. Step two
3. Step three

## Expected Behavior
What you expected to happen.

## Actual Behavior
What actually happened.

## Environment
- Chop version: `./chop --version`
- OS: macOS 14.0, Ubuntu 22.04, etc.
- Terminal: iTerm2, Terminal.app, etc.
- Go version: `go version`

## Additional Context
Any other relevant information, logs, or screenshots.
```

## Suggesting Features

We welcome feature suggestions! Before suggesting:

1. **Check existing issues** and discussions
2. **Consider scope**: Does it fit Chop's purpose?
3. **Think about implementation**: Is it feasible?

### Feature Request Template

Create a new issue or discussion:

```markdown
## Feature Description
Clear description of the proposed feature.

## Use Case
Why do you need this feature? What problem does it solve?

## Proposed Solution
How do you envision this working?

## Alternatives Considered
What other approaches have you thought about?

## Additional Context
Any examples, mockups, or references.
```

## Project Structure

Understanding the codebase structure:

```
chop/
├── app/                        # TUI application layer
│   ├── model.go               # Application state (Bubble Tea model)
│   ├── init.go                # Initialization logic
│   ├── update.go              # Update logic (event handlers)
│   ├── view.go                # View rendering
│   ├── handlers.go            # Input handlers and navigation
│   ├── accounts.go            # Accounts view
│   ├── blocks.go              # Blocks view
│   ├── transactions.go        # Transactions view
│   ├── state_inspector.go     # State inspector view
│   ├── settings.go            # Settings view
│   └── *.go                   # Other view-specific files
├── core/                      # Core business logic
│   ├── accounts/              # Account management
│   │   ├── accounts.go        # Account manager (thread-safe)
│   │   ├── seed.go            # Seed-based key derivation
│   │   └── *_test.go          # Tests
│   ├── blockchain/            # Blockchain state management
│   │   ├── chain.go           # Chain manager (thread-safe)
│   │   ├── block.go           # Block creation and hashing
│   │   └── *_test.go          # Tests
│   ├── state/                 # State persistence and inspection
│   │   ├── state.go           # State file management
│   │   ├── inspector.go       # State inspector
│   │   └── *_test.go          # Tests
│   ├── evm/                   # EVM execution wrapper (stubbed)
│   ├── events/                # Event bus for pub/sub
│   └── utils/                 # Utility functions
├── evm/                       # Guillotine EVM bindings
│   ├── evm.go                 # EVM interface
│   ├── bindings.go            # CGO bindings (when available)
│   └── bindings_stub.go       # Stub implementation
├── types/                     # Shared type definitions
│   └── types.go               # Account, Block, Transaction types
├── tui/                       # UI helpers
│   └── ui.go                  # Styling and UI utilities
├── config/                    # Configuration
│   └── config.go              # App configuration constants
├── main.go                    # Application entry point
├── go.mod                     # Go module definition
├── build.zig                  # Zig build orchestrator
└── lib/
    └── guillotine-mini/       # EVM implementation (submodule)
```

### Module Responsibilities

- **app/**: Handles all TUI concerns (rendering, input, navigation)
- **core/**: Pure business logic, no UI dependencies
- **types/**: Data structures shared across modules
- **tui/**: Reusable UI components and styling
- **evm/**: Interface to EVM execution engine

### Making Changes

- **UI changes**: Modify files in `app/` or `tui/`
- **Business logic**: Modify files in `core/`
- **New features**: May require changes across multiple layers
- **Data structures**: Update `types/types.go`

### Thread Safety

Core modules (`accounts`, `blockchain`) are thread-safe using `sync.RWMutex`. The TUI layer runs on a single thread (Bubble Tea event loop).

## Additional Resources

### Documentation

- [README.md](README.md) - Project overview and installation
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture documentation
- [RELEASE_GUIDE.md](RELEASE_GUIDE.md) - Release process for maintainers
- [.github/CICD.md](.github/CICD.md) - CI/CD pipeline documentation
- [evm/README.md](evm/README.md) - Guillotine EVM bindings

### External Resources

- [Bubble Tea Documentation](https://github.com/charmbracelet/bubbletea) - TUI framework
- [Effective Go](https://go.dev/doc/effective_go) - Go best practices
- [Go Code Review Comments](https://go.dev/wiki/CodeReviewComments) - Style guide
- [Conventional Commits](https://www.conventionalcommits.org/) - Commit message format
- [Semantic Versioning](https://semver.org/) - Version numbering

### Getting Help

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Code**: Read the source! It's well-documented and tested

### Contributors

Thank you to all contributors who have helped make Chop better! Your contributions, big or small, are greatly appreciated.

---

**Ready to contribute?** Pick an issue labeled "good first issue" or "help wanted" and dive in! If you have questions, don't hesitate to ask.

Happy coding! 🎉
