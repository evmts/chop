# Guillotine Go Bindings

Go bindings for the [guillotine-mini](https://github.com/evmts/guillotine-mini) EVM implementation.

## Overview

This package provides idiomatic Go bindings to the Guillotine EVM, a minimal, correct, and well-tested Ethereum Virtual Machine implementation in Zig.

## Features

- **Full EVM Support**: Berlin through Cancun hardforks (with Prague/Osaka support)
- **Synchronous Execution**: Pre-load all state and execute
- **Async Execution**: On-demand state loading via `StateBackend` interface
- **Type-Safe API**: Go types for addresses, U256 values, and results
- **EIP Support**: EIP-2930 access lists, EIP-4844 blob transactions, and more

## Installation

```bash
# Ensure the WASM library is built
zig build guillotine

# The Go package will automatically link against it via CGO
```

## Quick Start

### Simple Execution

```go
package main

import (
    "fmt"
    "log"
    "github.com/yourusername/chop/internal/guillotine"
)

func main() {
    // Create EVM for Cancun hardfork
    evm, err := guillotine.NewEVM(
        guillotine.HardforkCancun.String(),
        guillotine.LogLevelError,
    )
    if err != nil {
        log.Fatal(err)
    }
    defer evm.Close()

    // Simple bytecode: PUSH1 1, PUSH1 2, ADD, PUSH1 0, MSTORE, PUSH1 32, PUSH1 0, RETURN
    bytecode := guillotine.MustParseBytecode("60016002016000526020600​0f3")

    evm.SetBytecode(bytecode)

    // Set execution parameters
    ctx := guillotine.ExecutionContext{
        Gas:     1000000,
        Caller:  guillotine.ZeroAddress,
        Address: guillotine.MustAddressFromHex("0x1000000000000000000000000000000000000000"),
        Value:   guillotine.ZeroU256,
    }
    evm.SetExecutionContext(ctx)

    // Set blockchain context
    blockCtx := guillotine.BlockContext{
        ChainID:     guillotine.U256FromUint64(1),
        BlockNumber: 1000000,
        GasLimit:    30000000,
    }
    evm.SetBlockchainContext(blockCtx)

    // Execute
    result, err := evm.Execute()
    if err != nil {
        log.Fatal(err)
    }

    fmt.Printf("Success: %v\n", result.Success)
    fmt.Printf("Gas used: %d\n", result.GasUsed)
    fmt.Printf("Output: 0x%x\n", result.Output)
}
```

### Async Execution with State Backend

```go
// Implement the StateBackend interface
type MyStateBackend struct {
    db *sql.DB
}

func (b *MyStateBackend) GetStorage(address guillotine.Address, slot guillotine.U256) (guillotine.U256, error) {
    // Fetch from database
    var value []byte
    err := b.db.QueryRow("SELECT value FROM storage WHERE address = ? AND slot = ?",
        address.Hex(), slot.Hex()).Scan(&value)
    if err == sql.ErrNoRows {
        return guillotine.ZeroU256, nil
    }
    return guillotine.U256FromBytes(value)
}

func (b *MyStateBackend) GetBalance(address guillotine.Address) (guillotine.U256, error) {
    // Fetch balance from database
    // ...
}

// ... implement GetCode, GetNonce, CommitStateChanges

func main() {
    backend := &MyStateBackend{db: db}

    evm, _ := guillotine.NewEVM(guillotine.HardforkCancun.String(), guillotine.LogLevelError)
    defer evm.Close()

    // Configure EVM...
    evm.SetBytecode(bytecode)
    evm.SetExecutionContext(ctx)
    evm.SetBlockchainContext(blockCtx)

    // Execute with async state loading
    result, err := evm.ExecuteAsync(backend)
    if err != nil {
        log.Fatal(err)
    }

    fmt.Printf("Result: %v\n", result)
}
```

## API Reference

### Types

- **`Address`**: 20-byte Ethereum address
- **`U256`**: 256-bit unsigned integer (big-endian)
- **`Hardfork`**: Ethereum hardfork constants
- **`LogLevel`**: EVM logging verbosity

### EVM Methods

#### Lifecycle
- `NewEVM(hardfork, logLevel)` - Create new EVM instance
- `Close()` - Destroy EVM and free resources

#### Configuration
- `SetBytecode([]byte)` - Set contract bytecode
- `SetExecutionContext(ExecutionContext)` - Set gas, caller, address, value, calldata
- `SetBlockchainContext(BlockContext)` - Set chain ID, block number, timestamp, etc.
- `SetAccessList(*AccessList)` - Set EIP-2930 access list
- `SetBlobHashes([][32]byte)` - Set EIP-4844 blob hashes

#### State Management
- `SetStorage(address, slot, value)` - Pre-load storage
- `GetStorage(address, slot)` - Read storage
- `SetBalance(address, balance)` - Set account balance
- `SetCode(address, code)` - Set contract code

#### Execution
- `Execute()` - Synchronous execution (all state pre-loaded)
- `ExecuteAsync(StateBackend)` - Async execution with on-demand state loading

### StateBackend Interface

```go
type StateBackend interface {
    GetStorage(address Address, slot U256) (U256, error)
    GetBalance(address Address) (U256, error)
    GetCode(address Address) ([]byte, error)
    GetNonce(address Address) (uint64, error)
    CommitStateChanges(changesJSON []byte) error
}
```

The async protocol allows the EVM to pause execution when it needs state, request it from Go, and resume when provided. State changes are returned as JSON for easy persistence.

## Helper Functions

### Address
- `AddressFromHex(s)` - Parse address from hex string
- `AddressFromBytes(b)` - Create from bytes
- `MustAddressFromHex(s)` - Parse or panic
- `addr.Hex()` - Convert to hex string
- `addr.IsZero()` - Check if zero address

### U256
- `U256FromBig(*big.Int)` - Create from big.Int
- `U256FromUint64(n)` - Create from uint64
- `U256FromHex(s)` - Parse from hex string
- `U256FromBytes(b)` - Create from bytes
- `MustU256FromHex(s)` - Parse or panic
- `u.Big()` - Convert to *big.Int
- `u.Uint64()` - Convert to uint64 (truncates)
- `u.Hex()` - Convert to hex string
- `u.IsZero()` - Check if zero

### Bytecode
- `ParseBytecode(s)` - Parse hex string to bytes
- `MustParseBytecode(s)` - Parse or panic

## Execution Modes

### Synchronous Mode
Use `Execute()` when you can pre-load all required state:

```go
evm.SetStorage(addr, slot, value)
evm.SetBalance(addr, balance)
evm.SetCode(addr, code)
result, _ := evm.Execute()
```

**Pros**: Simple, all state upfront
**Cons**: Must know what state is needed in advance

### Async Mode
Use `ExecuteAsync(backend)` for on-demand state loading:

```go
result, _ := evm.ExecuteAsync(backend)
```

**Pros**: Only fetches needed state, integrates with existing state management
**Cons**: Requires implementing StateBackend interface

The EVM will pause when it needs state (storage, balance, code, nonce), call your backend, and resume with the data. Perfect for integrating with databases or existing state trees.

## Hardfork Support

Supported hardforks (via `Hardfork` constants):
- Frontier, Homestead, Tangerine, Spurious
- Byzantium, Constantinople, Istanbul
- Berlin, London, Merge
- Shanghai, Cancun, Prague, Osaka

Default is Cancun if not specified.

## Gas Accounting

Gas is tracked automatically:
- Initial gas set via `ExecutionContext.Gas`
- Access `ExecutionResult.GasUsed` and `ExecutionResult.GasRemaining`
- Warm/cold access costs (EIP-2929) handled automatically
- Gas refunds calculated per hardfork rules

## Error Handling

All methods return Go errors:
```go
if err := evm.SetBytecode(bytecode); err != nil {
    log.Fatal("Failed to set bytecode:", err)
}
```

Execution errors are returned from `Execute()` or `ExecuteAsync()`:
```go
result, err := evm.Execute()
if err != nil {
    log.Fatal("Execution failed:", err)
}

if !result.Success {
    fmt.Println("Transaction reverted")
}
```

## Thread Safety

EVM instances are **not** thread-safe. Create separate instances for concurrent execution:

```go
func worker(bytecode []byte) {
    evm, _ := guillotine.NewEVM(...)
    defer evm.Close()

    // Safe to use in this goroutine
    evm.SetBytecode(bytecode)
    result, _ := evm.Execute()
}

// Spawn multiple workers safely
go worker(bytecode1)
go worker(bytecode2)
```

## Examples

See `examples_test.go` for comprehensive examples:
- Simple arithmetic execution
- Storage access
- Async state loading
- Access lists
- Custom state backends

## Building

The package uses CGO to link against the guillotine-mini WASM library. Ensure it's built:

```bash
# From project root
zig build guillotine
```

This creates `lib/guillotine-mini/zig-out/bin/guillotine_mini.wasm`, which the Go bindings link against.

## Troubleshooting

### "undefined reference to evm_create"
Build the WASM library first: `zig build guillotine`

### "invalid address length"
Addresses must be exactly 40 hex characters (20 bytes)

### "bytecode too long"
Check bytecode hex string is valid and properly formatted

## License

Same as guillotine-mini (see main project)

## Links

- [Guillotine-mini](https://github.com/evmts/guillotine-mini)
- [Guillotine Documentation](https://github.com/evmts/guillotine-mini/blob/main/CLAUDE.md)
- [EVM Yellow Paper](https://ethereum.github.io/yellowpaper/paper.pdf)
