# Claude Code Skill & MCP Tool Design for Chop

Detailed specification for chop's SKILL.md, MCP tool definitions, AGENTS.md, resource URI templates, and prompt templates.

---

## Table of Contents

1. [SKILL.md Content](#1-skillmd-content)
2. [MCP Tool Definitions](#2-mcp-tool-definitions)
3. [Example Invocations](#3-example-invocations)
4. [Resource URI Templates](#4-resource-uri-templates)
5. [Prompt Templates](#5-prompt-templates)
6. [Registration as MCP Server + Skill](#6-registration-as-mcp-server--skill)
7. [AGENTS.md Content](#7-agentsmd-content)

---

## 1. SKILL.md Content

This is the exact SKILL.md file that would be placed in the chop project to teach Claude Code how and when to invoke chop as a skill.

```markdown
---
name: chop
description: Ethereum Swiss Army knife - cast-compatible CLI for blockchain data encoding/decoding, contract interaction, state inspection, and local EVM simulation
triggers:
  - "abi encode"
  - "abi decode"
  - "calldata"
  - "function selector"
  - "event topic"
  - "keccak"
  - "ethereum address"
  - "checksum address"
  - "wei to ether"
  - "ether to wei"
  - "hex to decimal"
  - "disassemble bytecode"
  - "storage layout"
  - "EVM"
  - "cast"
  - "anvil"
  - "chop"
  - "blockchain"
  - "smart contract"
  - "transaction"
  - "4byte"
  - "ENS"
---

# Chop - Ethereum CLI Tool

Chop is a cast-compatible Ethereum CLI. Use it for ALL Ethereum-related data transformations, encoding/decoding, contract interaction, and local EVM simulation.

## When to Use Chop

- **ABI operations**: encoding function calls, decoding return data, encoding events
- **Address utilities**: checksum validation, CREATE/CREATE2 address computation
- **Data conversion**: hex↔decimal, wei↔ether, bytes↔string, ASCII↔hex
- **Cryptographic operations**: keccak256 hashing, signature verification, ECDSA recovery
- **Contract interaction**: reading on-chain state, simulating calls, decoding storage
- **Bytecode analysis**: disassembly, function selector lookup, interface generation
- **Block/transaction queries**: fetching blocks, transactions, receipts, logs
- **Local simulation**: running a local Anvil-compatible devnet for testing

## Quick Reference

### Data Encoding

```bash
# ABI encode function arguments
chop abi-encode "transfer(address,uint256)" 0x1234...abcd 1000000000000000000

# Encode with selector (full calldata)
chop calldata "transfer(address,uint256)" 0x1234...abcd 1000000000000000000

# Decode ABI data
chop abi-decode "balanceOf(address)(uint256)" 0x00000000...0001

# Decode calldata (auto-detects selector)
chop calldata-decode "transfer(address,uint256)" 0xa9059cbb...
```

### Address Utilities

```bash
# Checksum an address
chop to-check-sum-address 0xabcdef...

# Compute CREATE address
chop compute-address --deployer 0x1234... --nonce 5

# Compute CREATE2 address
chop create2 --deployer 0x1234... --salt 0x00...01 --init-code 0x6080...
```

### Data Conversion

```bash
# Wei to ether
chop from-wei 1000000000000000000

# Ether to wei
chop to-wei 1.5

# Hex to decimal
chop to-dec 0xff

# Decimal to hex
chop to-hex 255

# Keccak256 hash
chop keccak "transfer(address,uint256)"

# Get function selector (first 4 bytes of keccak)
chop sig "transfer(address,uint256)"
```

### Contract Interaction (requires --rpc-url)

```bash
# Read contract state
chop call --to 0x1234... --data "balanceOf(address)" 0xabcd... --rpc-url $RPC

# Get storage slot
chop storage 0x1234... 0 --rpc-url $RPC

# Get account info
chop balance 0x1234... --rpc-url $RPC
chop nonce 0x1234... --rpc-url $RPC
chop code 0x1234... --rpc-url $RPC
```

### Block/Transaction Queries (requires --rpc-url)

```bash
# Get block
chop block latest --rpc-url $RPC

# Get transaction
chop tx 0xabcd... --rpc-url $RPC

# Get receipt
chop receipt 0xabcd... --rpc-url $RPC
```

### Bytecode Analysis

```bash
# Disassemble bytecode
chop disassemble 0x6080604052...

# Look up function selector
chop 4byte 0xa9059cbb

# Look up event signature
chop 4byte-event 0xddf252ad...
```

### Local Devnet

```bash
# Start local Anvil-compatible node
chop node

# Start with fork
chop node --fork-url https://eth.llamarpc.com

# Start with specific chain ID
chop node --chain-id 31337
```

## Output Formats

All commands support `--json` / `-j` for JSON output, which is preferred when piping to other tools or parsing programmatically.

## Important Notes

- Commands that read on-chain state require `--rpc-url` (or `-r`)
- Default output is human-readable; use `--json` for structured output
- Chop is a drop-in replacement for `cast` with the same command names and flags
```

---

## 2. MCP Tool Definitions

Grouped by category with descriptions optimized for LLM tool selection.

### 2.1 ABI Encoding/Decoding Tools

```typescript
const abiTools = [
  {
    name: "chop_abi_encode",
    description: "ABI encode function arguments (excludes selector). Use for constructing function call data without the 4-byte selector. Input: function signature and arguments. Output: ABI-encoded hex bytes.",
    inputSchema: {
      type: "object",
      properties: {
        signature: { type: "string", description: "Solidity function signature, e.g. 'transfer(address,uint256)'" },
        args: { type: "array", items: { type: "string" }, description: "Arguments matching the signature types" },
        packed: { type: "boolean", description: "Use packed encoding (abi.encodePacked)" },
      },
      required: ["signature", "args"],
    },
  },
  {
    name: "chop_calldata_encode",
    description: "Encode full calldata (selector + arguments). Use when you need complete transaction calldata for contract interaction. Input: function signature and arguments. Output: 4-byte selector + ABI-encoded arguments.",
    inputSchema: {
      type: "object",
      properties: {
        signature: { type: "string", description: "Solidity function signature" },
        args: { type: "array", items: { type: "string" }, description: "Arguments matching the signature types" },
      },
      required: ["signature", "args"],
    },
  },
  {
    name: "chop_abi_decode",
    description: "Decode ABI-encoded return data. Use for interpreting data returned from contract calls or events. Input: output type signature and hex data. Output: decoded values.",
    inputSchema: {
      type: "object",
      properties: {
        signature: { type: "string", description: "Function signature with return types, e.g. 'balanceOf(address)(uint256)'" },
        data: { type: "string", description: "Hex-encoded data to decode" },
      },
      required: ["signature", "data"],
    },
  },
  {
    name: "chop_calldata_decode",
    description: "Decode calldata (with selector). Use when you have raw transaction input data and want to understand what function is being called. Input: function signature and calldata. Output: decoded arguments.",
    inputSchema: {
      type: "object",
      properties: {
        signature: { type: "string", description: "Function signature" },
        data: { type: "string", description: "Hex-encoded calldata (including 4-byte selector)" },
      },
      required: ["signature", "data"],
    },
  },
]
```

### 2.2 Address & Crypto Tools

```typescript
const addressTools = [
  {
    name: "chop_checksum_address",
    description: "Convert an Ethereum address to EIP-55 checksummed format. Use when you need to validate or display an address correctly.",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Ethereum address (0x-prefixed, 40 hex chars)" },
      },
      required: ["address"],
    },
  },
  {
    name: "chop_compute_address",
    description: "Compute the address that a CREATE deployment would produce. Input: deployer address and nonce.",
    inputSchema: {
      type: "object",
      properties: {
        deployer: { type: "string", description: "Deployer address" },
        nonce: { type: "number", description: "Deployer nonce" },
      },
      required: ["deployer", "nonce"],
    },
  },
  {
    name: "chop_create2",
    description: "Compute a CREATE2 deployment address. Input: deployer, salt, and init code.",
    inputSchema: {
      type: "object",
      properties: {
        deployer: { type: "string", description: "Factory/deployer address" },
        salt: { type: "string", description: "32-byte salt (hex)" },
        initCode: { type: "string", description: "Contract init code (hex)" },
      },
      required: ["deployer", "salt", "initCode"],
    },
  },
  {
    name: "chop_keccak256",
    description: "Compute keccak256 hash. Use for hashing function signatures, computing storage slots, or any Ethereum-related hashing.",
    inputSchema: {
      type: "object",
      properties: {
        data: { type: "string", description: "Data to hash (text or hex)" },
      },
      required: ["data"],
    },
  },
  {
    name: "chop_sig",
    description: "Get the 4-byte function selector for a Solidity function signature. Equivalent to the first 4 bytes of keccak256(signature).",
    inputSchema: {
      type: "object",
      properties: {
        signature: { type: "string", description: "Function signature, e.g. 'transfer(address,uint256)'" },
      },
      required: ["signature"],
    },
  },
  {
    name: "chop_sig_event",
    description: "Get the 32-byte event topic hash for a Solidity event signature.",
    inputSchema: {
      type: "object",
      properties: {
        signature: { type: "string", description: "Event signature, e.g. 'Transfer(address,address,uint256)'" },
      },
      required: ["signature"],
    },
  },
]
```

### 2.3 Conversion Tools

```typescript
const conversionTools = [
  {
    name: "chop_from_wei",
    description: "Convert wei to ether (or other unit). 1 ether = 10^18 wei.",
    inputSchema: {
      type: "object",
      properties: {
        wei: { type: "string", description: "Amount in wei" },
        unit: { type: "string", description: "Target unit: ether (default), gwei, finney, szabo" },
      },
      required: ["wei"],
    },
  },
  {
    name: "chop_to_wei",
    description: "Convert ether (or other unit) to wei.",
    inputSchema: {
      type: "object",
      properties: {
        amount: { type: "string", description: "Amount in source unit" },
        unit: { type: "string", description: "Source unit: ether (default), gwei, finney, szabo" },
      },
      required: ["amount"],
    },
  },
  {
    name: "chop_to_hex",
    description: "Convert a decimal number to hexadecimal.",
    inputSchema: {
      type: "object",
      properties: {
        value: { type: "string", description: "Decimal number to convert" },
      },
      required: ["value"],
    },
  },
  {
    name: "chop_to_dec",
    description: "Convert a hexadecimal number to decimal.",
    inputSchema: {
      type: "object",
      properties: {
        value: { type: "string", description: "Hex number (0x-prefixed) to convert" },
      },
      required: ["value"],
    },
  },
  {
    name: "chop_to_base",
    description: "Convert a number between bases (2, 8, 10, 16).",
    inputSchema: {
      type: "object",
      properties: {
        value: { type: "string", description: "Number to convert" },
        base_in: { type: "number", description: "Input base (default 10)" },
        base_out: { type: "number", description: "Output base" },
      },
      required: ["value", "base_out"],
    },
  },
]
```

### 2.4 Contract Interaction Tools

```typescript
const contractTools = [
  {
    name: "chop_call",
    description: "Execute a read-only call against a contract (eth_call). Does not send a transaction. Use for reading contract state, simulating function calls, or estimating gas.",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Contract address" },
        signature: { type: "string", description: "Function signature, e.g. 'balanceOf(address)(uint256)'" },
        args: { type: "array", items: { type: "string" }, description: "Function arguments" },
        rpcUrl: { type: "string", description: "RPC URL (required for on-chain calls)" },
        from: { type: "string", description: "Caller address (optional)" },
        value: { type: "string", description: "ETH value to send (optional)" },
        block: { type: "string", description: "Block number or tag (latest, pending, etc.)" },
      },
      required: ["to", "rpcUrl"],
    },
  },
  {
    name: "chop_storage",
    description: "Read a raw storage slot from a contract. Use for inspecting contract state directly by storage slot number.",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Contract address" },
        slot: { type: "string", description: "Storage slot number (decimal or hex)" },
        rpcUrl: { type: "string", description: "RPC URL" },
        block: { type: "string", description: "Block number or tag" },
      },
      required: ["address", "slot", "rpcUrl"],
    },
  },
  {
    name: "chop_balance",
    description: "Get the ETH balance of an address.",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Ethereum address" },
        rpcUrl: { type: "string", description: "RPC URL" },
      },
      required: ["address", "rpcUrl"],
    },
  },
  {
    name: "chop_code",
    description: "Get the deployed bytecode of a contract.",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Contract address" },
        rpcUrl: { type: "string", description: "RPC URL" },
      },
      required: ["address", "rpcUrl"],
    },
  },
]
```

### 2.5 Bytecode Analysis Tools

```typescript
const bytecodeTools = [
  {
    name: "chop_disassemble",
    description: "Disassemble EVM bytecode into human-readable opcodes. Use for understanding contract bytecode, analyzing deployed contracts, or debugging.",
    inputSchema: {
      type: "object",
      properties: {
        bytecode: { type: "string", description: "Hex-encoded bytecode (0x-prefixed)" },
      },
      required: ["bytecode"],
    },
  },
  {
    name: "chop_4byte",
    description: "Look up a 4-byte function selector in the signature database. Use when you see raw calldata and need to identify the function being called.",
    inputSchema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "4-byte function selector (0x-prefixed)" },
      },
      required: ["selector"],
    },
  },
  {
    name: "chop_4byte_event",
    description: "Look up an event topic hash in the signature database.",
    inputSchema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "32-byte event topic (0x-prefixed)" },
      },
      required: ["topic"],
    },
  },
]
```

### 2.6 Block & Transaction Tools

```typescript
const chainTools = [
  {
    name: "chop_block",
    description: "Fetch a block by number or tag (latest, finalized, safe, pending).",
    inputSchema: {
      type: "object",
      properties: {
        block: { type: "string", description: "Block number, hash, or tag" },
        rpcUrl: { type: "string", description: "RPC URL" },
        full: { type: "boolean", description: "Include full transaction objects (default: false)" },
      },
      required: ["block", "rpcUrl"],
    },
  },
  {
    name: "chop_tx",
    description: "Fetch a transaction by hash.",
    inputSchema: {
      type: "object",
      properties: {
        hash: { type: "string", description: "Transaction hash" },
        rpcUrl: { type: "string", description: "RPC URL" },
      },
      required: ["hash", "rpcUrl"],
    },
  },
  {
    name: "chop_receipt",
    description: "Fetch a transaction receipt (includes logs, gas used, status).",
    inputSchema: {
      type: "object",
      properties: {
        hash: { type: "string", description: "Transaction hash" },
        rpcUrl: { type: "string", description: "RPC URL" },
      },
      required: ["hash", "rpcUrl"],
    },
  },
  {
    name: "chop_chain_id",
    description: "Get the chain ID from an RPC endpoint.",
    inputSchema: {
      type: "object",
      properties: {
        rpcUrl: { type: "string", description: "RPC URL" },
      },
      required: ["rpcUrl"],
    },
  },
  {
    name: "chop_gas_price",
    description: "Get the current gas price from an RPC endpoint.",
    inputSchema: {
      type: "object",
      properties: {
        rpcUrl: { type: "string", description: "RPC URL" },
      },
      required: ["rpcUrl"],
    },
  },
]
```

### 2.7 Local Devnet Tools

```typescript
const devnetTools = [
  {
    name: "chop_node_start",
    description: "Start a local Anvil-compatible Ethereum devnet. Useful for testing contract deployments, simulating transactions, and integration testing.",
    inputSchema: {
      type: "object",
      properties: {
        forkUrl: { type: "string", description: "RPC URL to fork from (optional)" },
        forkBlockNumber: { type: "number", description: "Block number to fork at (optional)" },
        chainId: { type: "number", description: "Chain ID (default: 31337)" },
        port: { type: "number", description: "HTTP port (default: 8545)" },
        accounts: { type: "number", description: "Number of funded accounts (default: 10)" },
        blockTime: { type: "number", description: "Auto-mine interval in seconds (optional)" },
      },
    },
  },
  {
    name: "chop_node_mine",
    description: "Mine one or more blocks on the local devnet.",
    inputSchema: {
      type: "object",
      properties: {
        blocks: { type: "number", description: "Number of blocks to mine (default: 1)" },
        timestamp: { type: "number", description: "Timestamp for next block (optional)" },
      },
    },
  },
  {
    name: "chop_node_set_balance",
    description: "Set the ETH balance of an address on the local devnet.",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Ethereum address" },
        balance: { type: "string", description: "New balance in wei" },
      },
      required: ["address", "balance"],
    },
  },
  {
    name: "chop_node_snapshot",
    description: "Take a state snapshot of the local devnet. Returns a snapshot ID that can be used to revert.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "chop_node_revert",
    description: "Revert the local devnet to a previous snapshot.",
    inputSchema: {
      type: "object",
      properties: {
        snapshotId: { type: "string", description: "Snapshot ID to revert to" },
      },
      required: ["snapshotId"],
    },
  },
]
```

---

## 3. Example Invocations

### How Claude Code Would Call Each Tool

```typescript
// Encoding a transfer call
await chop_calldata_encode({
  signature: "transfer(address,uint256)",
  args: ["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", "1000000000000000000"]
})
// → "0xa9059cbb000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa960450000000000000000000000000000000000000000000000000de0b6b3a7640000"

// Decoding return data
await chop_abi_decode({
  signature: "balanceOf(address)(uint256)",
  data: "0x0000000000000000000000000000000000000000000000000de0b6b3a7640000"
})
// → "1000000000000000000"

// Looking up a selector
await chop_4byte({ selector: "0xa9059cbb" })
// → "transfer(address,uint256)"

// Computing a storage slot for a mapping
await chop_keccak256({ data: "0x" + "0".repeat(24) + "d8da6bf26964af9d7eed9e03e53415d37aa96045" + "0".repeat(64) })
// → mapping slot for balances[0xd8dA...]

// Reading Uniswap V3 pool state
await chop_call({
  to: "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640",
  signature: "slot0()(uint160,int24,uint16,uint16,uint16,uint8,bool)",
  args: [],
  rpcUrl: "https://eth.llamarpc.com"
})

// Converting units for gas estimation
await chop_from_wei({ wei: "21000000000000", unit: "gwei" })
// → "21000"

// Disassembling bytecode from a contract
const bytecode = await chop_code({
  address: "0x1234...",
  rpcUrl: "https://eth.llamarpc.com"
})
await chop_disassemble({ bytecode: bytecode.result })
```

---

## 4. Resource URI Templates

MCP resources expose blockchain state as URI-addressable content.

### 4.1 Account Resources

```
chop://account/{address}/balance?rpc={rpcUrl}&block={blockTag}
chop://account/{address}/nonce?rpc={rpcUrl}&block={blockTag}
chop://account/{address}/code?rpc={rpcUrl}&block={blockTag}
chop://account/{address}/storage/{slot}?rpc={rpcUrl}&block={blockTag}
```

### 4.2 Block Resources

```
chop://block/{numberOrTag}?rpc={rpcUrl}&full={boolean}
chop://block/{hash}?rpc={rpcUrl}&full={boolean}
```

### 4.3 Transaction Resources

```
chop://tx/{hash}?rpc={rpcUrl}
chop://receipt/{hash}?rpc={rpcUrl}
```

### 4.4 Chain Resources

```
chop://chain/id?rpc={rpcUrl}
chop://chain/gas-price?rpc={rpcUrl}
chop://chain/block-number?rpc={rpcUrl}
```

### 4.5 Local Devnet Resources

```
chop://node/status
chop://node/accounts
chop://node/config
```

### Resource Implementation

```typescript
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: "chop://node/status",
      mimeType: "application/json",
      name: "Local Devnet Status",
      description: "Current status of the chop local devnet (running, chain ID, block number, accounts)",
    },
    {
      uri: "chop://node/accounts",
      mimeType: "application/json",
      name: "Devnet Accounts",
      description: "List of pre-funded accounts with balances",
    },
  ],
}))

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const url = new URL(request.params.uri)
  if (url.pathname === "/node/status") {
    const status = await getNodeStatus()
    return { contents: [{ uri: request.params.uri, mimeType: "application/json", text: JSON.stringify(status) }] }
  }
  // ...
})
```

### Resource Templates

```typescript
server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
  resourceTemplates: [
    {
      uriTemplate: "chop://account/{address}/balance",
      name: "Account Balance",
      description: "ETH balance of an Ethereum address",
      mimeType: "application/json",
    },
    {
      uriTemplate: "chop://account/{address}/storage/{slot}",
      name: "Storage Slot",
      description: "Raw storage value at a specific slot in a contract",
      mimeType: "application/json",
    },
    {
      uriTemplate: "chop://block/{blockTag}",
      name: "Block Data",
      description: "Full block data by number, hash, or tag (latest, finalized)",
      mimeType: "application/json",
    },
    {
      uriTemplate: "chop://tx/{hash}",
      name: "Transaction",
      description: "Transaction data by hash",
      mimeType: "application/json",
    },
  ],
}))
```

---

## 5. Prompt Templates

MCP prompts provide reusable workflows that Claude Code can invoke.

### 5.1 Contract Analysis Prompt

```typescript
{
  name: "analyze-contract",
  description: "Analyze a deployed smart contract: fetch bytecode, disassemble, identify functions, and summarize capabilities",
  arguments: [
    { name: "address", description: "Contract address", required: true },
    { name: "rpcUrl", description: "RPC URL", required: true },
  ],
  handler: async (args) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Analyze the smart contract at ${args.address}:
1. Fetch the deployed bytecode
2. Disassemble it
3. Identify all function selectors and look them up
4. Summarize what the contract does

Use the chop tools to fetch bytecode, disassemble, and look up selectors.`
        }
      }
    ]
  })
}
```

### 5.2 Transaction Debugging Prompt

```typescript
{
  name: "debug-tx",
  description: "Debug a failed or unexpected transaction: fetch receipt, decode logs, analyze revert reason",
  arguments: [
    { name: "txHash", description: "Transaction hash", required: true },
    { name: "rpcUrl", description: "RPC URL", required: true },
  ],
  handler: async (args) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Debug transaction ${args.txHash}:
1. Fetch the transaction and receipt
2. Check if it succeeded or reverted
3. If reverted, decode the revert reason
4. Decode all emitted logs
5. Summarize what happened

Use chop tools to fetch tx, receipt, decode calldata, and decode logs.`
        }
      }
    ]
  })
}
```

### 5.3 Storage Layout Prompt

```typescript
{
  name: "inspect-storage",
  description: "Inspect the storage layout of a contract at specific slots",
  arguments: [
    { name: "address", description: "Contract address", required: true },
    { name: "rpcUrl", description: "RPC URL", required: true },
    { name: "slots", description: "Comma-separated slot numbers to inspect", required: false },
  ],
  handler: async (args) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Inspect storage layout of contract ${args.address}:
1. Read storage slots ${args.slots ?? "0-10"}
2. Identify which slots contain data
3. For ERC20 tokens, check standard slots (name at 0, symbol at 1, etc.)
4. For mapping-based storage, compute relevant slot keys
5. Summarize the storage layout

Use chop storage tool to read each slot.`
        }
      }
    ]
  })
}
```

### 5.4 Local Test Setup Prompt

```typescript
{
  name: "setup-test-env",
  description: "Set up a local forked devnet for testing a specific contract interaction",
  arguments: [
    { name: "forkUrl", description: "RPC URL to fork from", required: true },
    { name: "contractAddress", description: "Target contract address", required: true },
  ],
  handler: async (args) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Set up a test environment for contract ${args.contractAddress}:
1. Start a local devnet forking from ${args.forkUrl}
2. Fund the first test account with 100 ETH
3. Read the contract state to understand current values
4. Take a snapshot so we can revert after testing

Use chop node tools to start the devnet and manage state.`
        }
      }
    ]
  })
}
```

---

## 6. Registration as MCP Server + Skill

### 6.1 MCP Server Configuration

**Project-level `.mcp.json`** (committed to repo):
```json
{
  "mcpServers": {
    "chop": {
      "command": "bun",
      "args": ["run", "./bin/chop-mcp.ts"],
      "env": {
        "CHOP_DEFAULT_RPC": "https://eth.llamarpc.com"
      }
    }
  }
}
```

**User-level `~/.claude.json`** (for global access):
```json
{
  "mcpServers": {
    "chop": {
      "command": "npx",
      "args": ["-y", "chop-mcp"],
      "env": {}
    }
  }
}
```

### 6.2 MCP Server Entry Point

```typescript
// bin/chop-mcp.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { Effect, Layer } from "effect"

const server = new McpServer({
  name: "chop",
  version: "1.0.0",
})

// Register all tools
registerAbiTools(server)
registerAddressTools(server)
registerConversionTools(server)
registerContractTools(server)
registerBytecodeTools(server)
registerChainTools(server)
registerDevnetTools(server)

// Register resources and prompts
registerResources(server)
registerPrompts(server)

// Start stdio transport
const transport = new StdioServerTransport()
await server.connect(transport)
```

### 6.3 Skill Registration

Place `SKILL.md` at the project root. Claude Code discovers it automatically when working in the project directory.

For global availability, the skill can also be registered in `~/.claude/skills/`:
```
~/.claude/skills/chop/SKILL.md
```

### 6.4 Dual Registration Strategy

Both the MCP server and SKILL.md work together:

| Aspect | MCP Server | SKILL.md |
|--------|-----------|----------|
| **Invocation** | Programmatic tool calls | Natural language triggers |
| **Data format** | Structured JSON input/output | Free-form text |
| **Discovery** | Claude Code reads tool list at startup | Claude Code reads SKILL.md at startup |
| **Resources** | URI-addressable blockchain state | N/A |
| **Prompts** | Reusable workflow templates | Instructions in markdown |
| **Transport** | stdio (local) or HTTP (remote) | File-based |

---

## 7. AGENTS.md Content

This is the exact `AGENTS.md` content for OpenAI Codex and other agents.

```markdown
# AGENTS.md - Chop Ethereum CLI

## What is Chop?

Chop is a cast-compatible Ethereum CLI tool. It provides commands for:
- ABI encoding/decoding
- Address utilities (checksum, CREATE/CREATE2)
- Data conversion (hex/dec, wei/ether)
- Cryptographic operations (keccak256, signatures)
- Contract interaction (eth_call, storage reads)
- Block and transaction queries
- Bytecode analysis and disassembly
- Local Anvil-compatible devnet

## Installation

```bash
npm install -g chop
# or
bun install -g chop
```

## Command Categories

### ABI Operations
- `chop abi-encode <sig> [args...]` - ABI encode (no selector)
- `chop calldata <sig> [args...]` - Full calldata (selector + args)
- `chop abi-decode <sig> <data>` - Decode return data
- `chop calldata-decode <sig> <data>` - Decode calldata

### Address Utilities
- `chop to-check-sum-address <addr>` - EIP-55 checksum
- `chop compute-address --deployer <addr> --nonce <n>` - CREATE address
- `chop create2 --deployer <addr> --salt <hex> --init-code <hex>` - CREATE2 address

### Data Conversion
- `chop from-wei <amount> [unit]` - Wei to ether/gwei
- `chop to-wei <amount> [unit]` - Ether/gwei to wei
- `chop to-hex <decimal>` - Decimal to hex
- `chop to-dec <hex>` - Hex to decimal
- `chop to-base <value> --base-in <n> --base-out <n>` - Base conversion

### Cryptographic Operations
- `chop keccak <data>` - Keccak-256 hash
- `chop sig <signature>` - Function selector (4 bytes)
- `chop sig-event <signature>` - Event topic (32 bytes)

### Contract Interaction (requires --rpc-url)
- `chop call --to <addr> [--data <sig> args...] -r <url>` - eth_call
- `chop storage <addr> <slot> -r <url>` - Read storage slot
- `chop balance <addr> -r <url>` - Get ETH balance
- `chop nonce <addr> -r <url>` - Get nonce
- `chop code <addr> -r <url>` - Get deployed bytecode

### Block & Transaction (requires --rpc-url)
- `chop block <number|tag> -r <url>` - Fetch block
- `chop tx <hash> -r <url>` - Fetch transaction
- `chop receipt <hash> -r <url>` - Fetch receipt
- `chop chain-id -r <url>` - Get chain ID
- `chop gas-price -r <url>` - Get gas price

### Bytecode Analysis
- `chop disassemble <bytecode>` - Disassemble opcodes
- `chop 4byte <selector>` - Lookup function selector
- `chop 4byte-event <topic>` - Lookup event topic

### Local Devnet
- `chop node` - Start local devnet
- `chop node --fork-url <url>` - Start with state fork
- `chop node --chain-id <id>` - Custom chain ID

## Global Options
- `--json` / `-j` - JSON output format
- `--rpc-url` / `-r` - RPC endpoint URL
- `--help` / `-h` - Show help
- `--version` / `-V` - Show version

## MCP Server

Chop includes an MCP server for AI agent integration:

```bash
# Start MCP server (stdio transport)
chop-mcp

# Configure in .mcp.json
{
  "mcpServers": {
    "chop": {
      "command": "bun",
      "args": ["run", "chop-mcp"]
    }
  }
}
```

## Common Patterns

### Encoding a Contract Call
```bash
chop calldata "transfer(address,uint256)" 0xRecipient 1000000000000000000
```

### Reading Contract State
```bash
chop call --to 0xContract "balanceOf(address)(uint256)" 0xHolder -r https://eth.llamarpc.com
```

### Computing Storage Slot for Mapping
```bash
# slot = keccak256(key . mappingSlot)
chop keccak "$(chop abi-encode '(address,uint256)' 0xHolder 0)"
```

### Setting Up Local Test Environment
```bash
chop node --fork-url https://eth.llamarpc.com &
sleep 2
chop call --to 0xContract "totalSupply()(uint256)" -r http://localhost:8545
```
```

---

## Sources

- Claude Code Skills documentation: https://docs.anthropic.com/en/docs/claude-code/skills
- MCP TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk
- Claude Code MCP integration: https://docs.anthropic.com/en/docs/claude-code/mcp
- OpenAI Codex AGENTS.md: https://github.com/openai/codex
- Existing research: `research/ai-agent-integration.md`, `research/mcp-server.md`
