# chop

Ethereum Swiss Army knife -- CLI, TUI, and MCP server powered by an in-process EVM.

Built with [Effect](https://effect.website), [voltaire-effect](https://github.com/evmts/voltaire-effect), and [guillotine-mini](https://github.com/evmts/guillotine-mini).

## Install

```bash
npm install -g chop
# or
bun install -g chop
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
# Listening on http://localhost:8545
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

The devnet supports the full Anvil/Hardhat JSON-RPC API including `anvil_*`, `evm_*`, `debug_*`, `hardhat_*`, and `ganache_*` method namespaces.

### Global Options

| Option | Description |
|--------|-------------|
| `--json, -j` | Output as JSON |
| `--rpc-url, -r` | RPC endpoint URL |
| `--help, -h` | Show help |
| `--version` | Show version |

## TUI

Running `chop` with no arguments (or `chop node`) launches an interactive terminal interface with 8 views:

1. **Dashboard** -- Chain info, recent blocks, transactions, accounts
2. **Call History** -- Scrollable RPC call log with filters
3. **Contracts** -- Deployed contracts with disassembly and storage browser
4. **Accounts** -- Account table with balances, fund and impersonate actions
5. **Blocks** -- Block explorer with mine action
6. **Transactions** -- Transaction list with decoded calldata
7. **Settings** -- Node configuration (mining mode, gas limit, etc.)
8. **State Inspector** -- Tree browser for account storage with edit support

**Keyboard shortcuts**: Number keys switch tabs, `?` shows help, `/` filters, `q` quits.

## MCP Server

Chop includes an [MCP](https://modelcontextprotocol.io) server for AI tool integration. Add it to your `.mcp.json`:

```json
{
  "mcpServers": {
    "chop": {
      "command": "node",
      "args": ["./node_modules/chop/dist/bin/chop-mcp.js"]
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
bun install

# Run CLI in dev mode
bun run dev -- keccak "hello"

# Run tests
bun run test

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
  handlers/        Pure business logic (Effect-based)
  evm/             WASM EVM integration (guillotine-mini)
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
