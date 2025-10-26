# Chop Architecture

This document provides a comprehensive overview of Chop's architecture, design decisions, and implementation details.

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Module Structure](#module-structure)
- [Key Components](#key-components)
- [Data Flow](#data-flow)
- [Design Decisions](#design-decisions)
- [Threading Model](#threading-model)
- [State Management](#state-management)
- [Testing Strategy](#testing-strategy)
- [Future Enhancements](#future-enhancements)

## Overview

### What is Chop?

Chop is a Terminal User Interface (TUI) for local Ethereum development, providing an interactive environment for testing smart contracts and transactions. It combines a Bubble Tea-based TUI with the Guillotine EVM implementation to offer a fast, deterministic blockchain simulator.

### Key Features

- **Interactive TUI**: Full-featured terminal interface with 7 specialized views
- **In-Memory Blockchain**: Fast, resettable blockchain state
- **Deterministic Accounts**: Seed-based account generation for reproducible testing
- **State Persistence**: Save and restore blockchain state
- **State Inspector**: Query account balances, code, and storage
- **Transaction History**: Track all blockchain operations
- **EVM Integration**: Powered by Guillotine EVM (WASM-based)

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interface (TUI)                      │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐  │
│  │Dashboard │ Accounts │  Blocks  │   Txns   │Contracts │  │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘  │
│  ┌──────────┬──────────┐                                    │
│  │Inspector │ Settings │                                    │
│  └──────────┴──────────┘                                    │
│                                                              │
│              Bubble Tea Framework (Elm Architecture)         │
└───────────────────────────┬──────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────┐
│                 Application Layer (app/)                     │
│  • Model (State)                                             │
│  • Update (Event Handlers)                                   │
│  • View (Rendering)                                          │
│  • Navigation & Input Handling                               │
└───────────────────────────┬──────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────┐
│              Core Business Logic (core/)                     │
│  ┌─────────────┬──────────────┬─────────────┬─────────────┐ │
│  │  Accounts   │  Blockchain  │    State    │     EVM     │ │
│  │  Manager    │    Chain     │  Inspector  │   Manager   │ │
│  │             │              │             │             │ │
│  │ • Key Gen   │ • Blocks     │ • Inspect   │ • Execute   │ │
│  │ • Balances  │ • Txns       │ • Persist   │ • Contracts │ │
│  │ • Nonces    │ • Gas        │             │             │ │
│  └─────────────┴──────────────┴─────────────┴─────────────┘ │
│  ┌─────────────┬──────────────────────────────────────────┐ │
│  │   Events    │              Utils                        │ │
│  │     Bus     │                                           │ │
│  └─────────────┴──────────────────────────────────────────┘ │
└───────────────────────────┬──────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────┐
│           External Dependencies & Data Layer                 │
│  ┌──────────────────┬───────────────────┬─────────────────┐ │
│  │ Guillotine EVM   │   Clipboard       │  File System    │ │
│  │    (WASM)        │   (atotto)        │  (State JSON)   │ │
│  └──────────────────┴───────────────────┴─────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

## System Architecture

### Layered Architecture

Chop follows a clean layered architecture pattern:

```
┌────────────────────────────────────────┐
│     Presentation Layer (TUI)           │  ← User interaction, rendering
├────────────────────────────────────────┤
│     Application Layer (Handlers)       │  ← Business orchestration, navigation
├────────────────────────────────────────┤
│     Domain Layer (Core Business Logic) │  ← Pure business logic, no UI
├────────────────────────────────────────┤
│     Infrastructure Layer (Persistence) │  ← State files, external services
└────────────────────────────────────────┘
```

### Communication Patterns

1. **UI → Application**: User input events (keypresses, commands)
2. **Application → Core**: Method calls on managers (GetAccount, AddBlock)
3. **Core → Core**: Direct function calls (synchronous)
4. **Core → Application**: Return values and errors
5. **Application → UI**: Model updates trigger re-renders

## Module Structure

### app/ - TUI Application Layer

The TUI layer implements the Bubble Tea (Elm architecture) pattern:

```
app/
├── model.go           # Application state (Model struct)
├── init.go            # Initialization (Initial command)
├── update.go          # Update function (handles all events)
├── view.go            # View function (renders UI)
├── handlers.go        # Input handlers & navigation logic
├── accounts.go        # Accounts view rendering
├── blocks.go          # Blocks view rendering
├── transactions.go    # Transactions view rendering
├── state_inspector.go # State inspector view
├── settings.go        # Settings view
└── *.go              # Other view-specific files
```

**Key Types:**

- `Model`: Central application state
  - Core managers (accounts, blockchain, EVM)
  - View state (tables, selections, inputs)
  - Navigation state (tab, stack)
  - UI state (feedback messages, confirmations)

- `Tab`: Enumeration of available views
  ```go
  const (
      TabDashboard = iota
      TabAccounts
      TabBlocks
      TabTransactions
      TabContracts
      TabStateInspector
      TabSettings
  )
  ```

**Navigation:**

- Tab-based primary navigation (1-7 keys)
- Stack-based detail view navigation (Enter to push, Esc to pop)
- Global shortcuts (q/Ctrl+C to quit, c to copy)

### core/ - Core Business Logic

Pure business logic with no UI dependencies:

```
core/
├── accounts/          # Account management
│   ├── accounts.go    # Manager with RWMutex
│   ├── seed.go        # Deterministic key derivation
│   └── *_test.go
├── blockchain/        # Chain state management
│   ├── chain.go       # Chain with RWMutex
│   ├── block.go       # Block creation & hashing
│   └── *_test.go
├── state/             # Persistence & inspection
│   ├── state.go       # JSON state file I/O
│   ├── inspector.go   # Account state queries
│   └── *_test.go
├── evm/               # EVM execution (stubbed)
│   └── evm.go
├── events/            # Event bus (pub/sub)
│   └── bus.go
├── history/           # Call history
│   └── history.go
└── utils/             # Utilities
    └── utils.go
```

### evm/ - Guillotine EVM Bindings

Go bindings for the Guillotine EVM:

```
evm/
├── evm.go             # EVM interface & high-level API
├── types.go           # Go types (Address, U256, etc.)
├── bindings.go        # CGO bindings (when WASM available)
├── bindings_stub.go   # Stub implementation (build tag)
└── examples_test.go   # Usage examples
```

### types/ - Shared Data Types

Common types used across modules:

```go
// Account represents an Ethereum account
type Account struct {
    Address     string
    Balance     *big.Int
    Nonce       uint64
    Code        []byte
    CodeHash    string
    StorageRoot string
    PrivateKey  string
    Index       int
}

// Block represents a blockchain block
type Block struct {
    Number       uint64
    Hash         string
    ParentHash   string
    Timestamp    time.Time
    Transactions []string
    GasUsed      uint64
    GasLimit     uint64
    Miner        string
}

// Transaction represents an EVM transaction
type Transaction struct {
    ID        string
    From      string
    To        string
    Value     *big.Int
    Data      []byte
    Gas       uint64
    GasUsed   uint64
    GasPrice  *big.Int
    Nonce     uint64
    Status    bool
    Timestamp time.Time
}
```

### tui/ - UI Helpers

Reusable UI components and styling:

```
tui/
└── ui.go              # Lipgloss styles, formatting helpers
```

### config/ - Configuration

Application-wide constants:

```
config/
└── config.go          # Colors, keys, defaults
```

## Key Components

### Account Manager

**Location**: `core/accounts/`

**Responsibilities**:
- Deterministic key derivation from seed
- Account creation and management
- Balance tracking
- Nonce management
- Contract code storage

**Key Features**:
- Thread-safe (RWMutex)
- Seed-based deterministic generation (like Ganache)
- Generates 10 pre-funded test accounts (100 ETH each)
- Supports account creation on-demand (for contract deployment)

**API**:
```go
manager := accounts.NewManager()
account, _ := manager.GetAccount(address)
manager.UpdateBalance(address, newBalance)
manager.IncrementNonce(address)
manager.SetCode(address, bytecode)
manager.Transfer(from, to, value)
```

**Implementation Details**:
- Uses SHA256-based key derivation
- Private keys stored in memory (not persisted)
- Seed can be exported/imported for reproducibility

### Blockchain Chain

**Location**: `core/blockchain/`

**Responsibilities**:
- Block creation and linking
- Transaction tracking
- Gas accounting
- Chain statistics

**Key Features**:
- Thread-safe (RWMutex)
- In-memory storage
- Genesis block initialization
- Transaction-to-block mapping
- Recent blocks/transactions queries

**API**:
```go
chain := blockchain.NewChain()
block, _ := chain.AddBlock(txIDs, gasUsed, miner)
chain.AddTransaction(tx)
blocks := chain.GetRecentBlocks(10)
stats := chain.GetStats()
chain.Reset() // Back to genesis
```

**Block Structure**:
- Sequential numbering (genesis = 0)
- SHA256 hashing (block number + parent hash + transactions)
- Timestamp tracking
- Gas limit and usage

### State Inspector

**Location**: `core/state/inspector.go`

**Responsibilities**:
- Query account state by address
- Return balance, nonce, code, storage root
- Integration with account and blockchain managers

**API**:
```go
inspector := state.NewInspector(accountMgr, blockchain)
accountState, _ := inspector.InspectAccount(address)
// Returns: Address, Balance, Nonce, Code, CodeHash, StorageRoot
```

**Use Cases**:
- Debugging contract state
- Verifying account balances
- Inspecting deployed contract bytecode

### State Persistence

**Location**: `core/state/state.go`

**Responsibilities**:
- Save blockchain state to JSON
- Load state from JSON
- Preserve account state (without private keys)
- Preserve blockchain history

**Format**:
```json
{
  "accounts": [
    {
      "address": "0x...",
      "balance": "100000000000000000000",
      "nonce": 0,
      "code": null
    }
  ],
  "blocks": [...],
  "transactions": [...]
}
```

**API**:
```go
state.SaveState(filename, accounts, blocks, txns)
loadedState, _ := state.LoadState(filename)
```

**Note**: State file does not include:
- Private keys (must regenerate from seed)
- In-memory caches

### TUI Architecture (Bubble Tea)

**Pattern**: Elm Architecture (Model-Update-View)

**Key Concepts**:
1. **Model**: Immutable application state
2. **Update**: Pure function that handles events and returns new model
3. **View**: Pure function that renders model to string
4. **Commands**: Effects (I/O, timers) that return messages

**Event Flow**:
```
User Input → Update() → New Model → View() → Terminal
     ↑                      ↓
     └─── Commands ←────────┘
```

**Implementation**:
```go
// Model holds all state
type Model struct {
    accountManager   *accounts.Manager
    blockchainChain  *blockchain.Chain
    currentTab       types.Tab
    // ... other state
}

// Update handles events
func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
    switch msg := msg.(type) {
    case tea.KeyMsg:
        return m.handleKeyPress(msg)
    case tickMsg:
        return m.handleTick()
    }
    return m, nil
}

// View renders the UI
func (m Model) View() string {
    switch m.currentTab {
    case types.TabAccounts:
        return m.renderAccountsView()
    case types.TabBlocks:
        return m.renderBlocksView()
    // ... other views
    }
}
```

**Tab System**:
- 7 primary tabs (Dashboard, Accounts, Blocks, Transactions, Contracts, Inspector, Settings)
- Number keys (1-7) for quick navigation
- Each tab has its own rendering function

**Detail Views**:
- Navigation stack tracks view history
- Enter key pushes detail view
- Esc key pops back to list view
- Example: Accounts List → Account Detail → (Esc) → Accounts List

**Auto-Refresh**:
- Dashboard auto-refreshes every 2 seconds (when enabled)
- Implemented via tick commands
- Toggle with 't' key in Settings

### EVM Manager

**Location**: `evm/evm.go`

**Status**: Currently stubbed, ready for Guillotine integration

**Planned Responsibilities**:
- EVM instance lifecycle management
- Bytecode execution
- State pre-loading (sync mode)
- On-demand state loading (async mode)
- Gas accounting
- Result extraction

**Planned API**:
```go
vmManager := evm.NewVMManager(hardfork, logLevel)
vmManager.SetBytecode(code)
vmManager.SetExecutionContext(gas, caller, address, value, calldata)
vmManager.SetBlockchainContext(chainID, blockNumber, timestamp, etc.)
result, _ := vmManager.Execute()
```

**Integration Points**:
- Account manager (for balance/nonce updates)
- Blockchain (for transaction recording)
- State inspector (for state queries)

## Data Flow

### Transaction Execution Flow

```
User initiates transaction
        ↓
App layer creates Transaction
        ↓
Account Manager validates (balance, nonce)
        ↓
EVM Manager executes (planned)
        ↓
Account Manager updates (balance, nonce, code)
        ↓
Blockchain records transaction
        ↓
Blockchain adds block
        ↓
Event bus publishes event (optional)
        ↓
UI updates (via model change)
```

### State Query Flow

```
User enters address in State Inspector
        ↓
App layer calls Inspector.InspectAccount()
        ↓
Inspector queries Account Manager
        ↓
Inspector queries Blockchain
        ↓
Inspector returns AccountState
        ↓
App layer updates model
        ↓
View renders account state
```

### State Persistence Flow

```
User triggers "Reset" or "Save"
        ↓
App layer calls state.SaveState()
        ↓
State module serializes:
  - Accounts (from Account Manager)
  - Blocks (from Blockchain)
  - Transactions (from Blockchain)
        ↓
JSON written to file
        ↓
Feedback shown to user
```

### Navigation Flow

```
User presses key
        ↓
Update() receives tea.KeyMsg
        ↓
handlers.go dispatches based on:
  - Current tab
  - Current view (list vs detail)
  - Key pressed
        ↓
Model state updated:
  - currentTab changes, OR
  - navStack modified, OR
  - table selection changed, OR
  - input captured
        ↓
View() renders new state
```

## Design Decisions

### Why In-Memory Blockchain?

**Decision**: Store all blockchain state in memory (RAM) rather than a database.

**Rationale**:
- Fast development and testing cycles
- No database setup or management
- Easy to reset to genesis state
- Simplifies debugging and introspection
- Sufficient for local development use case

**Trade-offs**:
- State lost on exit (mitigated by persistence)
- Limited by available RAM (not an issue for dev use)

### Why Bubble Tea for TUI?

**Decision**: Use Bubble Tea framework instead of raw terminal I/O.

**Rationale**:
- Modern, well-maintained framework
- Elm architecture is easy to reason about
- Great ecosystem (Lipgloss for styling, Bubbles for components)
- Strong community and examples
- Excellent documentation

**Trade-offs**:
- Framework dependency (but it's stable)
- Learning curve for Elm architecture
- Less control over terminal details

### Why Seed-Based Accounts?

**Decision**: Generate accounts deterministically from a seed.

**Rationale**:
- Reproducible testing scenarios
- No need to manage individual private keys
- Same seed = same accounts (like Ganache)
- Easy to share setups with team

**Trade-offs**:
- Seed must be stored securely if persisting accounts
- Cannot import external private keys (not a priority)

### Why No Database?

**Decision**: Use JSON files for persistence instead of SQLite or other DB.

**Rationale**:
- Simplicity (no schema migrations)
- Human-readable state files
- Easy debugging (cat state.json)
- No external dependencies
- Sufficient for expected data volume

**Trade-offs**:
- Not efficient for large datasets
- No query optimization
- Manual JSON marshaling/unmarshaling

### Why Thread-Safe Core Modules?

**Decision**: Use RWMutex in Account Manager and Blockchain.

**Rationale**:
- Future-proofing for concurrent transaction processing
- Allows background tasks (e.g., periodic stats updates)
- Safe API for potential parallel test execution
- Read-heavy workloads benefit from RWMutex

**Trade-offs**:
- Slight overhead (minimal in practice)
- More complex code (lock/unlock pairs)

### Why Zig Build System?

**Decision**: Use Zig's build system as the primary orchestrator.

**Rationale**:
- Unified interface for all components
- Cross-platform consistency
- Dependency tracking between Zig and Go components
- Automatic parallelization
- Integrates with Guillotine WASM build

**Trade-offs**:
- Requires Zig installation
- Less familiar than Makefiles
- Additional layer of abstraction

## Threading Model

### Core Modules (Thread-Safe)

**Account Manager** and **Blockchain Chain** use `sync.RWMutex`:

```go
func (m *Manager) GetAccount(address string) (*types.Account, error) {
    m.mu.RLock()
    defer m.mu.RUnlock()
    // Safe concurrent reads
}

func (m *Manager) UpdateBalance(address string, balance *big.Int) error {
    m.mu.Lock()
    defer m.mu.Unlock()
    // Exclusive writes
}
```

**Concurrency Pattern**:
- Multiple readers can access simultaneously
- Writers get exclusive access
- Readers block on writes, writers block on everything

### TUI Layer (Single-Threaded)

**Bubble Tea runs on a single goroutine**:
- Event loop processes messages sequentially
- Update() and View() are not concurrent
- No locking needed in app layer

**Commands for Async Operations**:
```go
// Long-running operation returns a command
func (m Model) executeTransaction() tea.Cmd {
    return func() tea.Msg {
        // Runs in background goroutine
        result := m.vmManager.Execute()
        return transactionCompleteMsg{result}
    }
}
```

### Background Tasks

**Dashboard Auto-Refresh**:
```go
func tickCmd() tea.Cmd {
    return tea.Tick(time.Second * 2, func(t time.Time) tea.Msg {
        return tickMsg(t)
    })
}
```

**Safe Pattern**:
1. Command spawned from Update()
2. Goroutine runs in background
3. Goroutine sends message back
4. Update() processes message on main thread

## State Management

### Application State

**Central Model**:
- All state lives in `Model` struct
- Immutable updates (return new model from Update)
- No global variables

**State Categories**:
1. **Core Managers**: accounts, blockchain, EVM (mutable, thread-safe)
2. **UI State**: tab, navigation stack, selections (immutable)
3. **View State**: tables, inputs, feedback messages (immutable)

### Persistence Strategy

**What Gets Persisted**:
- Account balances, nonces, code
- Blocks and transactions
- Gas usage statistics

**What Doesn't Get Persisted**:
- Private keys (regenerate from seed)
- UI state (tab, selections)
- EVM execution state

**When to Persist**:
- On user request (Settings → Save)
- Before reset (optional)
- On exit (optional future enhancement)

**Restore Strategy**:
1. Load JSON state file
2. Recreate accounts (without private keys)
3. Restore blockchain (blocks, transactions)
4. Regenerate accounts from seed to get private keys

### State Transitions

**Valid Transitions**:
```
Genesis → Add Transaction → Add Block → [Repeat] → Reset → Genesis
                ↓
          Save State → Load State
```

**Invariants**:
- Genesis block always at index 0
- Transaction IDs are unique
- Account nonces monotonically increase
- Block numbers are sequential

## Testing Strategy

### Unit Tests

**Coverage by Module**:
- `core/accounts`: 96.6%
- `core/blockchain`: 98.6%
- `core/state`: 86.1%
- `core/utils`: 100.0%

**Approach**:
- Pure unit tests (no mocking in core)
- Integration-style tests (real objects, no stubs)
- Table-driven tests for multiple scenarios
- Test both success and error paths

**Example**:
```go
func TestAccountManager_Transfer(t *testing.T) {
    tests := []struct {
        name      string
        fromBal   *big.Int
        toBal     *big.Int
        amount    *big.Int
        expectErr bool
    }{
        {
            name:      "successful transfer",
            fromBal:   big.NewInt(100),
            toBal:     big.NewInt(50),
            amount:    big.NewInt(30),
            expectErr: false,
        },
        {
            name:      "insufficient balance",
            fromBal:   big.NewInt(10),
            toBal:     big.NewInt(50),
            amount:    big.NewInt(30),
            expectErr: true,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Test implementation
        })
    }
}
```

### Integration Tests

**Not yet implemented**, but planned:
- End-to-end transaction flows
- State persistence round-trips
- EVM execution with state updates

### Manual QA

**TUI Testing**:
- QA checklists in `docs/qa-*.md`
- Manual testing of each view
- Keyboard shortcut verification
- Visual regression checks

**Checklists**:
- `docs/qa-dashboard-settings.md`
- `docs/qa-accounts-inspector.md`
- `docs/qa-blocks-transactions-contracts.md`

### CI/CD Testing

**GitHub Actions**:
- Run on: push to main, pull requests
- Go versions: 1.22, 1.24
- Platforms: Ubuntu (Linux), macOS
- Commands:
  - `go test ./...` (with race detector)
  - `go vet ./...`
  - Build verification

See [.github/CICD.md](.github/CICD.md) for details.

## Future Enhancements

### Storage Trie Implementation

**Status**: Planned

**Goal**: Full Ethereum state trie for contract storage

**Benefits**:
- Efficient storage queries
- Merkle proofs
- State root verification
- Closer to real Ethereum behavior

**Implementation**:
- Use MPT (Merkle Patricia Trie) library
- Integrate with state inspector
- Persist trie nodes in state file

### State Replay Functionality

**Status**: Planned

**Goal**: Replay transactions from saved state

**Use Cases**:
- Debugging failed transactions
- Time-travel debugging
- State migration testing

**Implementation**:
- Track transaction order
- Add "replay" command to UI
- Step-through execution mode

### Network Simulation

**Status**: Future consideration

**Goal**: Simulate multi-node network behavior

**Features**:
- Block propagation delays
- Transaction pool
- Mining simulation
- Fork detection

### Contract Deployment UI

**Status**: Planned

**Goal**: Interactive contract deployment wizard

**Features**:
- Bytecode input (hex or file)
- Constructor argument input
- Gas estimation
- Deployment confirmation
- Contract address display

### Event Logs and Filtering

**Status**: Planned

**Goal**: Full EVM event log support

**Features**:
- Capture events during execution
- Filter by topic/address
- Display in dedicated view
- Export to JSON

### Gas Profiling

**Status**: Future consideration

**Goal**: Detailed gas usage analysis

**Features**:
- Gas breakdown by opcode
- Gas comparison across transactions
- Optimization suggestions

### Snapshot/Restore

**Status**: Planned

**Goal**: Quick state snapshots (like Ganache)

**Features**:
- Snapshot current state (in-memory)
- Restore to snapshot
- Multiple named snapshots
- Useful for testing rollback scenarios

## Dependencies

### Go Modules

**Core Dependencies**:
- `github.com/charmbracelet/bubbletea` - TUI framework
- `github.com/charmbracelet/lipgloss` - TUI styling
- `github.com/charmbracelet/bubbles` - UI components (tables, inputs)
- `github.com/urfave/cli/v2` - CLI argument parsing

**Indirect Dependencies**:
- `github.com/atotto/clipboard` - Clipboard operations
- `github.com/muesli/termenv` - Terminal feature detection

See `go.mod` for complete list.

### External Components

**Guillotine EVM**:
- Location: `lib/guillotine-mini/` (git submodule)
- Language: Zig
- Output: `guillotine_mini.wasm`
- Integration: CGO bindings in `evm/bindings.go`

## Build System

### Zig Build Orchestration

**Build Targets**:
- `zig build` - Build everything (Zig, Go, Guillotine)
- `zig build go` - Build only Go binary
- `zig build guillotine` - Build only Guillotine WASM
- `zig build test` - Run all tests
- `zig build clean` - Remove build artifacts

**Output Locations**:
- Go binary: `zig-out/bin/chop-go`
- Zig binary: `zig-out/bin/chop`
- Guillotine WASM: `lib/guillotine-mini/zig-out/bin/guillotine_mini.wasm`

### Direct Go Build

**Alternative**: Build without Zig:
```bash
CGO_ENABLED=0 go build -o chop .
```

**Note**: Disables EVM integration (uses stub)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Development setup
- Code style guidelines
- Testing requirements
- Pull request process

## Additional Resources

- [README.md](README.md) - Project overview
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines
- [RELEASE_GUIDE.md](RELEASE_GUIDE.md) - Release process
- [.github/CICD.md](.github/CICD.md) - CI/CD documentation
- [evm/README.md](evm/README.md) - Guillotine bindings
- [Bubble Tea Tutorial](https://github.com/charmbracelet/bubbletea/tree/master/tutorials)
- [Ethereum Yellow Paper](https://ethereum.github.io/yellowpaper/paper.pdf)

---

**Last Updated**: 2025-10-26

This architecture is actively evolving as Chop development continues. Key integration points (EVM execution, full storage trie) are still being implemented.
