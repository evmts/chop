# chop

Ethereum development CLI, terminal UI, and MCP server. Chop provides ABI and bytecode tools, a Solidity compiler, and an experimental in-process development node.

[![CI](https://github.com/evmts/chop/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/evmts/chop/actions/workflows/ci.yml)
[![Security](https://github.com/evmts/chop/actions/workflows/security.yml/badge.svg?branch=main)](https://github.com/evmts/chop/actions/workflows/security.yml)

## Install

Use Node.js 22 or later for the CLI and MCP server. The terminal UI requires Bun. Install a package archive from [GitHub Releases](https://github.com/evmts/chop/releases), or build one from a checkout.

```bash
bun install --frozen-lockfile --ignore-scripts
bun run build
npm pack --ignore-scripts
npm install -g ./tevm-chop-0.1.0.tgz
```

## Quick Start

```bash
# Hash data
chop keccak "transfer(address,uint256)"

# Get a function selector
chop sig "transfer(address,uint256)"
# 0xa9059cbb

# Encode calldata
chop calldata "transfer(address,uint256)" 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 1000

# Decode calldata
chop calldata-decode "transfer(address,uint256)" 0xa9059cbb...

# Convert units
chop from-wei 1000000000000000000
# 1.000000000000000000

chop to-hex 255
# 0xff

# Start a local devnet
chop node
# Listening on http://127.0.0.1:8545
# Chain ID: 31337
# 10 funded accounts...

# Query the devnet (or any RPC)
chop balance 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 -r http://localhost:8545
chop block-number -r http://localhost:8545
```

## CLI Reference

### ABI Encoding

| Command | Description |
|---------|-------------|
| `chop abi-encode <sig> [args...]` | ABI-encode values for a function signature |
| `chop abi-encode --packed <sig> [args...]` | ABI-encode with packed encoding |
| `chop calldata <sig> [args...]` | Encode function calldata (selector + args) |
| `chop abi-decode <sig> <data>` | Decode ABI-encoded data |
| `chop calldata-decode <sig> <data>` | Decode function calldata |

### Cryptographic

| Command | Description |
|---------|-------------|
| `chop keccak <data>` | Keccak256 hash |
| `chop sig <signature>` | 4-byte function selector |
| `chop sig-event <signature>` | Event topic hash |
| `chop hash-message <message>` | EIP-191 signed message hash |

### Data Conversion

| Command | Description |
|---------|-------------|
| `chop from-wei <amount> [unit]` | Wei to ether (or gwei, etc.) |
| `chop to-wei <amount> [unit]` | Ether to wei |
| `chop to-hex <decimal>` | Decimal to hex |
| `chop to-dec <hex>` | Hex to decimal |
| `chop to-base <value> --base-out <n>` | Convert between arbitrary bases |
| `chop from-utf8 <string>` | UTF-8 to hex |
| `chop to-utf8 <hex>` | Hex to UTF-8 |
| `chop to-bytes32 <value>` | Pad value to bytes32 |
| `chop from-rlp <hex>` | RLP-decode |
| `chop to-rlp <values...>` | RLP-encode |
| `chop shl <value> <bits>` | Shift left |
| `chop shr <value> <bits>` | Shift right |

### Address Utilities

| Command | Description |
|---------|-------------|
| `chop to-check-sum-address <addr>` | EIP-55 checksum address |
| `chop compute-address --deployer <addr> --nonce <n>` | Predict CREATE address |
| `chop create2 --deployer <addr> --salt <hex> --init-code <hex>` | Predict CREATE2 address |

### Bytecode Analysis

| Command | Description |
|---------|-------------|
| `chop disassemble <bytecode>` | Disassemble EVM bytecode |
| `chop 4byte <selector>` | Look up function selector |
| `chop 4byte-event <topic>` | Look up event topic |

### Chain Queries

These commands require `-r <rpc-url>` (or a running `chop node`).

| Command | Description |
|---------|-------------|
| `chop block-number` | Latest block number |
| `chop chain-id` | Chain ID |
| `chop balance <address>` | Account balance (wei) |
| `chop nonce <address>` | Account nonce |
| `chop code <address>` | Contract bytecode |
| `chop storage <address> <slot>` | Storage slot value |
| `chop block <number\|tag>` | Block details |
| `chop tx <hash>` | Transaction details |
| `chop receipt <hash>` | Transaction receipt |
| `chop logs [--address <addr>] [--topic <t>]` | Event logs |
| `chop gas-price` | Current gas price |
| `chop base-fee` | Current base fee |
| `chop call --to <addr> <sig> [args]` | Execute eth_call |
| `chop estimate --to <addr> <sig> [args]` | Estimate gas |
| `chop send --to <addr> --from <addr> <sig> [args]` | Send transaction |
| `chop rpc <method> [params...]` | Raw JSON-RPC call |
| `chop find-block <timestamp>` | Find block by timestamp |

### ENS

| Command | Description |
|---------|-------------|
| `chop namehash <name>` | Compute ENS namehash |
| `chop resolve-name <name>` | Resolve ENS name to address |
| `chop lookup-address <address>` | Reverse lookup address to ENS name |

### Local Devnet

```bash
chop node [options]
```

| Option | Description |
|--------|-------------|
| `--port <n>` | HTTP port (default: 8545) |
| `--chain-id <n>` | Chain ID (default: 31337) |
| `--accounts <n>` | Number of funded accounts (default: 10) |
| `--fork-url <url>` | Fork from an RPC endpoint |
| `--fork-block-number <n>` | Pin fork to a specific block |

The node binds to loopback and uses well-known development keys by default. It rejects browser-originated requests and request bodies over 1 MiB. It supports account funding, balance and block queries, transaction bookkeeping, snapshots, and selected Anvil-compatible methods. Its execution engine implements a limited opcode set, and contract creation transactions do not install runtime bytecode. Use a local Anvil instance for full Solidity contract execution and deployment.

### Solidity Compiler

```bash
chop compile Counter.sol --format json --optimize --optimizer-runs 200 --evm-version prague
chop compile --source 'pragma solidity ^0.8.0; contract Counter {}' --format hex
chop compile Counter.sol --watch
```

The bundled solc-js compiler builds file or inline sources without a separate compiler install. File imports must resolve within the entry file's directory. Watch mode follows the entry file and its imports, including files saved by atomic rename. Compiler warnings and errors are printed to stderr. JSON output in watch mode contains one object per successful build.

| Option | Description |
|--------|-------------|
| `--format json\|hex\|combined` | Structured compiler output, creation bytecode, or readable ABI and bytecode |
| `--contract <name>` | Select a contract when an entry file defines several |
| `--optimize`, `--optimizer-runs <n>` | Enable the optimizer and set its runs (default 200) |
| `--evm-version <version>` | EVM target (default Prague) |
| `--watch` | Recompile changed sources until interrupted |
| `--deploy <url> --from <address>` | Submit creation bytecode from an unlocked account on a loopback development RPC after each successful compile |

Automatic deployment requires linked bytecode and a constructor with no arguments. For example, start Anvil and use one of the unlocked addresses in its startup output.

```bash
chop compile Counter.sol --contract Counter --watch --deploy http://127.0.0.1:8545 --from <address>
```

### Global Options

| Option | Description |
|--------|-------------|
| `--json, -j` | Output as JSON |
| `--rpc-url, -r` | RPC endpoint URL |
| `--help, -h` | Show help |
| `--version` | Show version |

## TUI

Run `bun dist/bin/chop.js` in a source checkout or `bun run --bun "$(command -v chop)"` after installation to open the terminal interface.

1. **Dashboard** -- Chain info, recent blocks, transactions, accounts
2. **Call History** -- Scrollable RPC call log with filters
3. **Contracts** -- Deployed contracts with disassembly and storage browser
4. **Accounts** -- Account table with balances, fund and impersonate actions
5. **Blocks** -- Block explorer with mine action
6. **Transactions** -- Transaction list with decoded calldata
7. **Settings** -- Node configuration (mining mode, gas limit, etc.)
8. **State Inspector** -- Tree browser for account storage with edit support

9. **Compiler** — Select a Solidity file in the current directory, compile it, and inspect diagnostics, ABI, and bytecode.

Press `1`–`9` to switch tabs, `?` for help, and `q` to quit. In Settings, press `g`, then `y`, to replace the ten funded test accounts and invalidate saved snapshots. Press `4` to see the new address list. In Compiler, use `j/k` to select a file and Enter to compile. Supply `--rpc-url http://127.0.0.1:8545` at TUI startup to enable `d` followed by Enter to submit the selected contract from the first unlocked account.

## MCP Server

Chop includes an [MCP](https://modelcontextprotocol.io) server for AI tool integration. Add it to your `.mcp.json`:

```json
{
  "mcpServers": {
    "chop": {
      "command": "node",
      "args": ["./node_modules/@tevm/chop/dist/bin/chop-mcp.js"]
    }
  }
}
```

Or if installed globally:

```json
{
  "mcpServers": {
    "chop": {
      "command": "chop-mcp"
    }
  }
}
```

The MCP server exposes 33 tools, 6 resources, and 4 prompts covering all CLI functionality plus devnet control. See [SKILL.md](./SKILL.md) for the full tool list.

## Development

```bash
# Install dependencies
bun install --frozen-lockfile --ignore-scripts

# Run CLI in dev mode
bun run dev -- keccak "hello"

# Run unit and integration tests with coverage
bun run test:coverage --maxWorkers=3

# Run generated properties, process-level tests, and benchmark budgets
bun run test:property
bun run test:e2e      # needs Anvil 1.5.1 and Python 3 on PATH
bun run test:bench

# Type-check
bun run typecheck

# Lint
bun run lint

# Build
bun run build
```

### Architecture

```
bin/
  chop.ts          CLI entry point (Effect CLI)
  chop-mcp.ts      MCP server entry point (stdio transport)
src/
  cli/             Command definitions and CLI framework
  compiler/        Solidity compilation, watch mode, and loopback deployment
  handlers/        Pure business logic (Effect-based)
  evm/             Test interpreter and optional WASM adapter
  state/           World state, journal, account management
  blockchain/      Block store, chain management
  node/            TevmNode service layer composition
  rpc/             JSON-RPC server and method routing
  tui/             Terminal UI (OpenTUI + Dracula theme)
  mcp/             MCP server (tools, resources, prompts)
  shared/          Shared types and errors
```

Handlers are pure Effect programs that take parameters and return results. They are shared across CLI, RPC, and MCP surfaces. The `TevmNode` service composes all state, blockchain, and EVM services into a single layer.

## License

MIT
