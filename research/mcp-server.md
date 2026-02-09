# MCP Server Research: Building with Effect TypeScript for Chop

## Table of Contents

1. [MCP Protocol Overview](#1-mcp-protocol-overview)
2. [Architecture and Core Concepts](#2-architecture-and-core-concepts)
3. [Official TypeScript SDK](#3-official-typescript-sdk-modelcontextprotocolsdk)
4. [Effect TypeScript and MCP](#4-effect-typescript-and-mcp)
5. [Building an MCP Server for Chop](#5-building-an-mcp-server-for-chop)
6. [Transport Options](#6-transport-options)
7. [Claude Code Integration](#7-claude-code-integration)
8. [Claude Code Skills Integration](#8-claude-code-skills-integration)
9. [Testing and Debugging](#9-testing-and-debugging)
10. [Stateful Operations and Blockchain State](#10-stateful-operations-and-blockchain-state)
11. [Security Considerations](#11-security-considerations)
12. [Alternative Frameworks](#12-alternative-frameworks)
13. [Implementation Plan for Chop](#13-implementation-plan-for-chop)
14. [Sources](#14-sources)

---

## 1. MCP Protocol Overview

### What is MCP?

MCP (Model Context Protocol) is an open-source standard created by Anthropic for connecting AI
applications to external systems. It provides a standardized way for AI applications (like Claude,
ChatGPT, Cursor, etc.) to connect to data sources, tools, and workflows.

MCP is analogous to a USB-C port for AI: a universal connector enabling AI applications to interact
with external capabilities through a single standardized protocol.

### Three Primitives

MCP defines three core primitives that servers can expose:

#### Tools
Tools enable MCP clients to request the server to perform actions. They are the primary interaction
point for LLMs. Tools are model-controlled -- the AI decides when and how to invoke them.

- Analogous to POST endpoints in REST APIs
- Accept structured input (validated by schemas)
- Return structured output (text, images, resource links)
- Can have side effects
- Example: `keccak256("hello")` -> `0x1c8aff...`

#### Resources
Resources expose reference data to clients without heavy computation or side effects. They are
application-controlled -- the host application decides when to fetch them.

- Analogous to GET endpoints in REST APIs
- Identified by URIs (e.g., `chop://blockchain/state`)
- Read-only, no side effects
- Ideal for configuration, documents, state snapshots
- Can use URI templates for dynamic resources (e.g., `chop://address/{address}/balance`)

#### Prompts
Prompts are reusable templates that help humans or client UIs interact with models consistently.
They are user-controlled -- the human selects which prompt to use.

- Pre-built templates for common workflows
- Accept arguments to customize behavior
- Return structured message sequences
- Appear as slash commands in Claude Code (e.g., `/mcp__chop__analyze_bytecode`)

### Communication Protocol

MCP uses JSON-RPC 2.0 for all communication between clients and servers. The protocol supports:

- Request/response patterns
- Notifications (one-way messages)
- Capability negotiation during initialization
- Dynamic capability updates via `list_changed` notifications

### Protocol Flow

```
Client                           Server
  |                                |
  |--- initialize ----------------->|
  |<-- initialize response ---------|
  |--- initialized notification --->|
  |                                |
  |--- tools/list ----------------->|
  |<-- tools list response ---------|
  |                                |
  |--- tools/call ----------------->|
  |<-- tool result -----------------|
  |                                |
  |--- resources/read ------------->|
  |<-- resource content ------------|
```

---

## 2. Architecture and Core Concepts

### Client-Server Model

MCP follows a client-server architecture:

- **Host**: The application (e.g., Claude Code, Cursor) that manages client connections
- **Client**: Protocol client that maintains a 1:1 connection with a server
- **Server**: Provides context, tools, and prompts to the client

```
Host Application (Claude Code)
├── MCP Client 1 <-> MCP Server A (chop tools)
├── MCP Client 2 <-> MCP Server B (database)
└── MCP Client 3 <-> MCP Server C (github)
```

### Capability Negotiation

During initialization, both client and server declare their capabilities:

```json
{
  "capabilities": {
    "tools": { "listChanged": true },
    "resources": { "subscribe": true, "listChanged": true },
    "prompts": { "listChanged": true }
  }
}
```

### Server Instructions

Servers can provide a human-readable `instructions` field during initialization that guides how
clients should interact with the server. This is especially useful with Claude Code's Tool Search
feature, which uses these instructions to know when to load your tools.

---

## 3. Official TypeScript SDK (`@modelcontextprotocol/sdk`)

### Current State

- **Latest stable**: v1.26.0 (recommended for production)
- **v2 pre-alpha**: In development on main branch, expected stable Q1 2026
- **Peer dependency**: Zod v4 for schema validation (backwards compatible with Zod v3.25+)
- **License**: Apache 2.0 (new contributions), MIT (existing code)

### Installation (v2)

```bash
# Server package
npm install @modelcontextprotocol/server zod

# Client package (if needed)
npm install @modelcontextprotocol/client zod

# Optional middleware
npm install @modelcontextprotocol/node     # Node.js HTTP transport
npm install @modelcontextprotocol/express  # Express helpers
npm install @modelcontextprotocol/hono     # Hono helpers
```

### Installation (v1 - production recommended)

```bash
npm install @modelcontextprotocol/sdk zod
```

### Creating a Server (v2 API)

```typescript
import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

const server = new McpServer({
  name: "chop-mcp",
  version: "0.1.0",
});
```

### Registering Tools

Tools are the primary way to expose functionality. Each tool has a name, metadata, input schema
(defined with Zod), and an async handler.

```typescript
server.registerTool(
  "keccak256",
  {
    title: "Keccak-256 Hash",
    description: "Hash data with Keccak-256 (Ethereum's hashing function)",
    inputSchema: {
      data: z.string().describe("The data to hash"),
    },
    outputSchema: {
      hash: z.string(),
    },
  },
  async ({ data }) => {
    const hash = keccak256(data);
    return {
      content: [{ type: "text", text: hash }],
      structuredContent: { hash },
    };
  }
);
```

### Registering Resources

Resources expose read-only data. They can be static or use URI templates for dynamic content.

```typescript
// Static resource
server.registerResource(
  "blockchain-state",
  "chop://blockchain/state",
  {
    title: "Current Blockchain State",
    description: "Current state of the local EVM instance",
    mimeType: "application/json",
  },
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        text: JSON.stringify({
          blockNumber: 12345,
          chainId: 1,
          accounts: ["0x..."],
        }),
      },
    ],
  })
);

// Dynamic resource with URI template
import { ResourceTemplate } from "@modelcontextprotocol/server";

server.registerResource(
  "account-balance",
  new ResourceTemplate("chop://account/{address}/balance", {
    list: async () => ({
      resources: knownAccounts.map((addr) => ({
        uri: `chop://account/${addr}/balance`,
        name: `Balance for ${addr}`,
      })),
    }),
  }),
  {
    title: "Account Balance",
    description: "Get the balance of an Ethereum account",
    mimeType: "application/json",
  },
  async (uri, { address }) => ({
    contents: [
      {
        uri: uri.href,
        text: JSON.stringify({ address, balance: getBalance(address) }),
      },
    ],
  })
);
```

### Registering Prompts

Prompts are reusable message templates that appear as slash commands.

```typescript
server.registerPrompt(
  "analyze-bytecode",
  {
    title: "Analyze Bytecode",
    description: "Analyze EVM bytecode for patterns and security issues",
    argsSchema: {
      bytecode: z.string().describe("The EVM bytecode to analyze"),
    },
  },
  ({ bytecode }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Analyze this EVM bytecode for patterns, security issues, and gas optimization opportunities:\n\n${bytecode}`,
        },
      },
    ],
  })
);
```

### Connecting to Transport (v1 - stdio)

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({ name: "chop", version: "0.1.0" });

// ... register tools, resources, prompts ...

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
```

### ResourceLink Outputs

Tools can return `resource_link` content items to reference large resources without embedding them
in the response. This allows clients to fetch only the data they need:

```typescript
server.registerTool(
  "list-contracts",
  {
    title: "List Deployed Contracts",
    description: "List all deployed contracts in the current state",
    inputSchema: {},
  },
  async () => ({
    content: contracts.map((c) => ({
      type: "resource_link",
      uri: `chop://contract/${c.address}`,
      name: c.name,
      description: `Contract at ${c.address}`,
    })),
  })
);
```

---

## 4. Effect TypeScript and MCP

### @effect/ai McpServer Module

The `@effect/ai` package includes a native `McpServer` module that enables building MCP servers
using Effect's composable, type-safe abstractions. This is still in experimental/alpha stage but
provides deep integration with Effect's programming model.

#### Key Modules

- `McpServer` - Server implementation for MCP
- `McpSchema` - Schema definitions for MCP operations (uses Effect Schema instead of Zod)

#### Architecture

The Effect MCP server operates through a three-layer architecture:

1. **Resource and Prompt Definition**: Define capabilities using template syntax with
   `McpServer.resource` and `McpServer.prompt`
2. **Service Composition**: Resources and prompts merge into Effect layers
3. **Transport Selection**: `McpServer.layerStdio()` or `McpServer.layerWebSocket()`

#### How Effect's Service Model Maps to MCP

| Effect Concept | MCP Concept |
|---|---|
| `Effect<A, E, R>` | Tool handler (returns result, can fail, has dependencies) |
| `Layer<A, E, R>` | Server capability composition |
| `Context.Tag` / Service | Dependency injection for state, config, etc. |
| `Schema.Schema` | Input/output validation (replaces Zod in Effect) |
| `Ref<A>` | Mutable state container (blockchain state) |
| `Stream<A>` | Streaming responses |
| `Scope` | Resource lifecycle management |

#### Conceptual Effect MCP Server Example

Based on the architecture described in DeepWiki and the Effect documentation:

```typescript
import { McpServer, McpSchema } from "@effect/ai"
import { Effect, Layer, Schema, Ref } from "effect"

// Define a resource using Effect Schema for parameters
const AccountBalance = McpServer.resource({
  uri: "chop://account/{address}/balance",
  params: {
    address: McpSchema.param(Schema.String),
  },
  handler: ({ address }) =>
    Effect.gen(function* () {
      const state = yield* BlockchainState
      const balance = yield* state.getBalance(address)
      return {
        contents: [{
          uri: `chop://account/${address}/balance`,
          text: JSON.stringify({ address, balance }),
        }],
      }
    }),
})

// Define a prompt
const AnalyzeBytecode = McpServer.prompt({
  name: "analyze-bytecode",
  description: "Analyze EVM bytecode",
  args: {
    bytecode: McpSchema.param(Schema.String),
  },
  handler: ({ bytecode }) =>
    Effect.succeed({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Analyze this bytecode:\n${bytecode}`,
        },
      }],
    }),
})

// Compose into a server
const ServerLive = Layer.mergeAll(
  AccountBalance,
  AnalyzeBytecode,
).pipe(
  Layer.provide(McpServer.layerStdio({
    name: "chop-mcp",
    version: "0.1.0",
  })),
)

// Launch
Layer.launch(ServerLive).pipe(Effect.runPromise)
```

### Hybrid Approach: Official SDK + Effect

Since `@effect/ai`'s McpServer is still experimental, a pragmatic approach is to use the official
`@modelcontextprotocol/sdk` for the MCP protocol layer while using Effect for the business logic,
service composition, and state management:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { Effect, Layer, Context, Ref } from "effect"
import { Schema } from "effect"
import { z } from "zod"

// Effect service for blockchain state
class BlockchainState extends Context.Tag("BlockchainState")<
  BlockchainState,
  {
    readonly getBalance: (address: string) => Effect.Effect<bigint>
    readonly getCode: (address: string) => Effect.Effect<Uint8Array>
    readonly execute: (tx: Transaction) => Effect.Effect<ExecutionResult>
  }
>() {}

// Effect service for crypto operations
class CryptoService extends Context.Tag("CryptoService")<
  CryptoService,
  {
    readonly keccak256: (data: string) => Effect.Effect<string>
    readonly toChecksum: (address: string) => Effect.Effect<string>
    readonly computeAddress: (deployer: string, nonce: number) => Effect.Effect<string>
  }
>() {}

// Create MCP server
const server = new McpServer({
  name: "chop-mcp",
  version: "0.1.0",
  instructions: "Chop provides Ethereum/EVM development tools including " +
    "hashing, encoding, address utilities, and bytecode analysis. " +
    "Use these tools for blockchain development tasks."
})

// Bridge between MCP tool handler and Effect
function effectTool<A>(
  effect: Effect.Effect<A, Error, BlockchainState | CryptoService>,
  runtime: Runtime.Runtime<BlockchainState | CryptoService>,
): Promise<A> {
  return Runtime.runPromise(runtime)(effect)
}

// Register tools that delegate to Effect services
server.registerTool(
  "keccak256",
  {
    title: "Keccak-256 Hash",
    description: "Hash data with Keccak-256",
    inputSchema: { data: z.string() },
  },
  async ({ data }) => {
    const result = await effectTool(
      Effect.gen(function* () {
        const crypto = yield* CryptoService
        return yield* crypto.keccak256(data)
      }),
      runtime,
    )
    return { content: [{ type: "text", text: result }] }
  }
)

// Transport
const transport = new StdioServerTransport()
await server.connect(transport)
```

### Effect Service Layers for Chop

The existing Chop CLI commands map naturally to Effect services:

```typescript
// Services matching Chop's CLI command structure

class ConversionService extends Context.Tag("ConversionService")<
  ConversionService,
  {
    readonly toHex: (value: string) => Effect.Effect<string>
    readonly toDec: (value: string) => Effect.Effect<string>
    readonly toWei: (value: string, unit: string) => Effect.Effect<string>
    readonly fromWei: (value: string, unit?: string) => Effect.Effect<string>
  }
>() {}

class AddressService extends Context.Tag("AddressService")<
  AddressService,
  {
    readonly toChecksum: (address: string) => Effect.Effect<string>
    readonly computeAddress: (deployer: string, nonce: number) => Effect.Effect<string>
    readonly create2: (deployer: string, salt: string, initCode: string) => Effect.Effect<string>
  }
>() {}

class EncodingService extends Context.Tag("EncodingService")<
  EncodingService,
  {
    readonly abiEncode: (types: string[], values: string[]) => Effect.Effect<string>
    readonly abiDecode: (types: string[], data: string) => Effect.Effect<string[]>
    readonly encodeCalldata: (sig: string, args: string[]) => Effect.Effect<string>
    readonly toRlp: (data: string) => Effect.Effect<string>
    readonly fromRlp: (data: string) => Effect.Effect<string>
  }
>() {}

class BytecodeService extends Context.Tag("BytecodeService")<
  BytecodeService,
  {
    readonly disassemble: (bytecode: string) => Effect.Effect<string>
    readonly extractSelectors: (bytecode: string) => Effect.Effect<string[]>
  }
>() {}

class HashService extends Context.Tag("HashService")<
  HashService,
  {
    readonly keccak256: (data: string) => Effect.Effect<string>
    readonly namehash: (name: string) => Effect.Effect<string>
    readonly sig: (signature: string) => Effect.Effect<string>
    readonly sigEvent: (signature: string) => Effect.Effect<string>
  }
>() {}

class HexService extends Context.Tag("HexService")<
  HexService,
  {
    readonly concat: (values: string[]) => Effect.Effect<string>
    readonly toUtf8: (hex: string) => Effect.Effect<string>
    readonly fromUtf8: (text: string) => Effect.Effect<string>
  }
>() {}
```

---

## 5. Building an MCP Server for Chop

### Mapping Chop CLI Commands to MCP Tools

The existing Chop CLI (written in Zig) exposes these command categories that should become MCP tools:

| CLI Command | MCP Tool Name | Category |
|---|---|---|
| `chop keccak <data>` | `keccak256` | Hashing |
| `chop to-hex <value>` | `to-hex` | Conversion |
| `chop to-dec <value>` | `to-dec` | Conversion |
| `chop to-wei <value> <unit>` | `to-wei` | Conversion |
| `chop from-wei <value>` | `from-wei` | Conversion |
| `chop to-checksum <address>` | `to-checksum-address` | Address |
| `chop compute-address <deployer> <nonce>` | `compute-address` | Address |
| `chop create2 <deployer> <salt> <initcode>` | `create2-address` | Address |
| `chop to-rlp <data>` | `rlp-encode` | Encoding |
| `chop from-rlp <data>` | `rlp-decode` | Encoding |
| `chop abi-encode <types...> <values...>` | `abi-encode` | Encoding |
| `chop abi-decode <types...> <data>` | `abi-decode` | Encoding |
| `chop calldata <sig> <args...>` | `encode-calldata` | Encoding |
| `chop concat-hex <values...>` | `concat-hex` | Hex |
| `chop to-utf8 <hex>` | `hex-to-utf8` | Hex |
| `chop from-utf8 <text>` | `utf8-to-hex` | Hex |
| `chop sig <signature>` | `function-selector` | Selectors |
| `chop sig-event <signature>` | `event-topic` | Selectors |
| `chop namehash <name>` | `ens-namehash` | ENS |
| `chop disassemble <bytecode>` | `disassemble-bytecode` | Bytecode |
| `chop selectors <bytecode>` | `extract-selectors` | Bytecode |
| `chop hash-zero` | `hash-zero` | Constants |
| `chop address-zero` | `address-zero` | Constants |
| `chop max-uint <bits>` | `max-uint` | Constants |
| `chop max-int <bits>` | `max-int` | Constants |
| `chop min-int <bits>` | `min-int` | Constants |

### Resources to Expose

Beyond tools, the MCP server should expose blockchain state as resources:

```typescript
// Resources for blockchain state
"chop://blockchain/state"          // Current chain state
"chop://account/{address}"         // Account details
"chop://account/{address}/balance" // Account balance
"chop://account/{address}/nonce"   // Account nonce
"chop://account/{address}/code"    // Contract bytecode
"chop://contract/{address}/abi"    // Contract ABI (if available)
"chop://block/{number}"            // Block data
"chop://tx/{hash}"                 // Transaction data
"chop://constants/addresses"       // Well-known addresses
"chop://constants/selectors"       // Common function selectors
```

### Prompts to Expose

```typescript
// Useful prompts for Ethereum development workflows
"analyze-bytecode"     // Disassemble and analyze contract bytecode
"debug-transaction"    // Step through a transaction execution
"audit-contract"       // Security audit checklist for a contract
"gas-optimize"         // Suggest gas optimizations for bytecode
"decode-calldata"      // Decode and explain calldata
"explain-opcode"       // Explain what an EVM opcode does
```

### Complete Implementation Example

```typescript
// src/mcp/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import { execFileSync } from "child_process"

// Path to the compiled chop binary
const CHOP_BINARY = process.env.CHOP_BINARY || "chop"

// Helper to execute chop CLI commands and capture output
function runChop(args: string[]): string {
  try {
    const result = execFileSync(CHOP_BINARY, ["--json", ...args], {
      encoding: "utf-8",
      timeout: 10000,
    })
    return result.trim()
  } catch (error: any) {
    throw new Error(`chop ${args.join(" ")} failed: ${error.stderr || error.message}`)
  }
}

const server = new McpServer({
  name: "chop",
  version: "0.1.0",
  instructions:
    "Chop is a Swiss Army knife for Ethereum/EVM development. " +
    "It provides tools for hashing (keccak256), encoding/decoding (ABI, RLP), " +
    "address utilities (checksum, CREATE2), bytecode analysis (disassemble, " +
    "extract selectors), unit conversion (wei), and ENS operations. " +
    "Use these tools when working with Ethereum smart contracts, transactions, " +
    "or any EVM-related development task.",
})

// ═══════════════════════════════════════════════════════
// HASHING TOOLS
// ═══════════════════════════════════════════════════════

server.registerTool(
  "keccak256",
  {
    title: "Keccak-256 Hash",
    description:
      "Hash data with Keccak-256 (Ethereum's primary hashing function). " +
      "Used for computing function selectors, event topics, storage slots, etc.",
    inputSchema: {
      data: z.string().describe("The data to hash (string or hex)"),
    },
  },
  async ({ data }) => ({
    content: [{ type: "text", text: runChop(["keccak", data]) }],
  })
)

// ═══════════════════════════════════════════════════════
// CONVERSION TOOLS
// ═══════════════════════════════════════════════════════

server.registerTool(
  "to-hex",
  {
    title: "Convert to Hex",
    description: "Convert a decimal number or string to hexadecimal",
    inputSchema: {
      value: z.string().describe("The value to convert to hex"),
    },
  },
  async ({ value }) => ({
    content: [{ type: "text", text: runChop(["to-hex", value]) }],
  })
)

server.registerTool(
  "to-dec",
  {
    title: "Convert to Decimal",
    description: "Convert a hexadecimal value to decimal",
    inputSchema: {
      value: z.string().describe("The hex value to convert to decimal"),
    },
  },
  async ({ value }) => ({
    content: [{ type: "text", text: runChop(["to-dec", value]) }],
  })
)

server.registerTool(
  "to-wei",
  {
    title: "Convert to Wei",
    description:
      "Convert an ether amount to wei. Supports units: wei, gwei, ether",
    inputSchema: {
      value: z.string().describe("The amount to convert"),
      unit: z
        .enum(["wei", "gwei", "ether"])
        .default("ether")
        .describe("The unit of the input value"),
    },
  },
  async ({ value, unit }) => ({
    content: [{ type: "text", text: runChop(["to-wei", value, unit]) }],
  })
)

server.registerTool(
  "from-wei",
  {
    title: "Convert from Wei",
    description: "Convert a wei amount to ether",
    inputSchema: {
      value: z.string().describe("The wei amount to convert"),
    },
  },
  async ({ value }) => ({
    content: [{ type: "text", text: runChop(["from-wei", value]) }],
  })
)

// ═══════════════════════════════════════════════════════
// ADDRESS TOOLS
// ═══════════════════════════════════════════════════════

server.registerTool(
  "to-checksum-address",
  {
    title: "Checksum Address",
    description: "Convert an Ethereum address to EIP-55 checksummed format",
    inputSchema: {
      address: z.string().describe("The Ethereum address to checksum"),
    },
  },
  async ({ address }) => ({
    content: [{ type: "text", text: runChop(["to-checksum", address]) }],
  })
)

server.registerTool(
  "compute-address",
  {
    title: "Compute CREATE Address",
    description:
      "Compute the contract address that would be created by a deployer address and nonce (CREATE opcode)",
    inputSchema: {
      deployer: z.string().describe("The deployer's Ethereum address"),
      nonce: z.number().describe("The deployer's nonce"),
    },
  },
  async ({ deployer, nonce }) => ({
    content: [
      {
        type: "text",
        text: runChop(["compute-address", deployer, String(nonce)]),
      },
    ],
  })
)

server.registerTool(
  "create2-address",
  {
    title: "Compute CREATE2 Address",
    description:
      "Compute the contract address for a CREATE2 deployment (deterministic address)",
    inputSchema: {
      deployer: z.string().describe("The deployer/factory contract address"),
      salt: z.string().describe("The salt value (32 bytes hex)"),
      initCodeHash: z
        .string()
        .describe("The keccak256 hash of the init code"),
    },
  },
  async ({ deployer, salt, initCodeHash }) => ({
    content: [
      {
        type: "text",
        text: runChop(["create2", deployer, salt, initCodeHash]),
      },
    ],
  })
)

// ═══════════════════════════════════════════════════════
// ENCODING TOOLS
// ═══════════════════════════════════════════════════════

server.registerTool(
  "abi-encode",
  {
    title: "ABI Encode",
    description: "ABI encode values according to Solidity types",
    inputSchema: {
      types: z.string().describe("Comma-separated Solidity types (e.g., 'address,uint256')"),
      values: z.string().describe("Comma-separated values to encode"),
    },
  },
  async ({ types, values }) => ({
    content: [
      {
        type: "text",
        text: runChop(["abi-encode", types, values]),
      },
    ],
  })
)

server.registerTool(
  "abi-decode",
  {
    title: "ABI Decode",
    description: "ABI decode hex data according to Solidity types",
    inputSchema: {
      types: z.string().describe("Comma-separated Solidity types"),
      data: z.string().describe("The hex-encoded data to decode"),
    },
  },
  async ({ types, data }) => ({
    content: [
      { type: "text", text: runChop(["abi-decode", types, data]) },
    ],
  })
)

server.registerTool(
  "encode-calldata",
  {
    title: "Encode Calldata",
    description:
      "Encode a function call as calldata (function selector + ABI-encoded arguments)",
    inputSchema: {
      signature: z
        .string()
        .describe('Function signature, e.g., "transfer(address,uint256)"'),
      args: z
        .string()
        .optional()
        .describe("Comma-separated argument values"),
    },
  },
  async ({ signature, args }) => ({
    content: [
      {
        type: "text",
        text: runChop(
          args ? ["calldata", signature, args] : ["calldata", signature]
        ),
      },
    ],
  })
)

server.registerTool(
  "rlp-encode",
  {
    title: "RLP Encode",
    description: "Encode data using Recursive Length Prefix (RLP) encoding",
    inputSchema: {
      data: z.string().describe("The data to RLP encode"),
    },
  },
  async ({ data }) => ({
    content: [{ type: "text", text: runChop(["to-rlp", data]) }],
  })
)

server.registerTool(
  "rlp-decode",
  {
    title: "RLP Decode",
    description: "Decode RLP-encoded data",
    inputSchema: {
      data: z.string().describe("The RLP-encoded hex data to decode"),
    },
  },
  async ({ data }) => ({
    content: [{ type: "text", text: runChop(["from-rlp", data]) }],
  })
)

// ═══════════════════════════════════════════════════════
// HEX TOOLS
// ═══════════════════════════════════════════════════════

server.registerTool(
  "concat-hex",
  {
    title: "Concatenate Hex",
    description: "Concatenate multiple hex strings into one",
    inputSchema: {
      values: z
        .array(z.string())
        .describe("Array of hex strings to concatenate"),
    },
  },
  async ({ values }) => ({
    content: [
      { type: "text", text: runChop(["concat-hex", ...values]) },
    ],
  })
)

server.registerTool(
  "hex-to-utf8",
  {
    title: "Hex to UTF-8",
    description: "Convert a hex string to UTF-8 text",
    inputSchema: {
      hex: z.string().describe("The hex string to convert"),
    },
  },
  async ({ hex }) => ({
    content: [{ type: "text", text: runChop(["to-utf8", hex]) }],
  })
)

server.registerTool(
  "utf8-to-hex",
  {
    title: "UTF-8 to Hex",
    description: "Convert UTF-8 text to a hex string",
    inputSchema: {
      text: z.string().describe("The text to convert to hex"),
    },
  },
  async ({ text }) => ({
    content: [{ type: "text", text: runChop(["from-utf8", text]) }],
  })
)

// ═══════════════════════════════════════════════════════
// SELECTOR TOOLS
// ═══════════════════════════════════════════════════════

server.registerTool(
  "function-selector",
  {
    title: "Function Selector",
    description:
      "Get the 4-byte function selector from a Solidity function signature",
    inputSchema: {
      signature: z
        .string()
        .describe(
          'Solidity function signature, e.g., "transfer(address,uint256)"'
        ),
    },
  },
  async ({ signature }) => ({
    content: [{ type: "text", text: runChop(["sig", signature]) }],
  })
)

server.registerTool(
  "event-topic",
  {
    title: "Event Topic",
    description:
      "Get the 32-byte topic hash from a Solidity event signature",
    inputSchema: {
      signature: z
        .string()
        .describe(
          'Solidity event signature, e.g., "Transfer(address,address,uint256)"'
        ),
    },
  },
  async ({ signature }) => ({
    content: [{ type: "text", text: runChop(["sig-event", signature]) }],
  })
)

// ═══════════════════════════════════════════════════════
// ENS TOOLS
// ═══════════════════════════════════════════════════════

server.registerTool(
  "ens-namehash",
  {
    title: "ENS Namehash",
    description: "Calculate the ENS namehash for a domain name",
    inputSchema: {
      name: z.string().describe('The ENS name, e.g., "vitalik.eth"'),
    },
  },
  async ({ name }) => ({
    content: [{ type: "text", text: runChop(["namehash", name]) }],
  })
)

// ═══════════════════════════════════════════════════════
// BYTECODE TOOLS
// ═══════════════════════════════════════════════════════

server.registerTool(
  "disassemble-bytecode",
  {
    title: "Disassemble Bytecode",
    description:
      "Disassemble EVM bytecode into human-readable opcodes",
    inputSchema: {
      bytecode: z.string().describe("The EVM bytecode to disassemble (hex)"),
    },
  },
  async ({ bytecode }) => ({
    content: [
      { type: "text", text: runChop(["disassemble", bytecode]) },
    ],
  })
)

server.registerTool(
  "extract-selectors",
  {
    title: "Extract Function Selectors",
    description:
      "Extract all 4-byte function selectors from deployed EVM bytecode",
    inputSchema: {
      bytecode: z
        .string()
        .describe("The deployed EVM bytecode to analyze (hex)"),
    },
  },
  async ({ bytecode }) => ({
    content: [
      { type: "text", text: runChop(["selectors", bytecode]) },
    ],
  })
)

// ═══════════════════════════════════════════════════════
// PROMPTS
// ═══════════════════════════════════════════════════════

server.registerPrompt(
  "analyze-bytecode",
  {
    title: "Analyze EVM Bytecode",
    description:
      "Disassemble and analyze EVM bytecode for patterns, security issues, and optimization opportunities",
    argsSchema: {
      bytecode: z.string().describe("EVM bytecode to analyze"),
    },
  },
  ({ bytecode }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text:
            `Please analyze this EVM bytecode:\n\n${bytecode}\n\n` +
            "1. Disassemble it and explain the opcodes\n" +
            "2. Identify function selectors and map to likely function signatures\n" +
            "3. Flag any security concerns (reentrancy, overflow, etc.)\n" +
            "4. Suggest gas optimization opportunities\n" +
            "5. Identify any known patterns (proxy, upgradeable, etc.)",
        },
      },
    ],
  })
)

server.registerPrompt(
  "decode-transaction",
  {
    title: "Decode Transaction Calldata",
    description: "Decode and explain transaction calldata",
    argsSchema: {
      calldata: z.string().describe("Transaction calldata (hex)"),
      abi: z
        .string()
        .optional()
        .describe("Contract ABI (JSON) if available"),
    },
  },
  ({ calldata, abi }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text:
            `Decode this transaction calldata:\n\n${calldata}\n\n` +
            (abi ? `Using this ABI:\n${abi}\n\n` : "") +
            "1. Identify the function selector\n" +
            "2. Decode the parameters\n" +
            "3. Explain what this transaction does",
        },
      },
    ],
  })
)

// ═══════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error("Chop MCP server started on stdio")
}

main().catch(console.error)
```

---

## 6. Transport Options

### stdio (Recommended for Claude Code)

Standard input/output transport. The server communicates via stdin/stdout using JSON-RPC messages.
All logging must go to stderr.

**Pros:**
- Simplest to implement
- No network configuration needed
- Claude Code spawns and manages the process
- Secure (no network exposure)
- Native support in Claude Code

**Cons:**
- Only works with local processes
- One client per server instance
- No remote access

```typescript
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"

const transport = new StdioServerTransport()
await server.connect(transport)
```

### Streamable HTTP (Recommended for Remote)

Modern HTTP-based transport supporting request/response over POST and optional server-to-client
notifications via SSE.

**Pros:**
- Works remotely
- Supports multiple concurrent clients
- Session management and resumability
- Can be stateless or stateful

**Cons:**
- More complex setup
- Requires HTTP server infrastructure
- Authentication needed for security

```typescript
import express from "express"
import { createMcpExpressApp } from "@modelcontextprotocol/express"

const app = createMcpExpressApp({
  server,
  host: "localhost",
})

app.listen(3000, () => {
  console.error("Chop MCP HTTP server on port 3000")
})
```

### HTTP + SSE (Deprecated)

Legacy transport. Use Streamable HTTP instead for new implementations.

### WebSocket (Effect-specific)

Available through `@effect/ai`'s `McpServer.layerWebSocket()`.

### Recommendation for Chop

**Use stdio for Claude Code integration.** It is the simplest, most secure, and natively supported
transport. Claude Code spawns the server process and manages its lifecycle automatically.

If remote access is needed later (e.g., for a shared development environment), add Streamable HTTP
as a secondary transport.

---

## 7. Claude Code Integration

### Adding Chop as an MCP Server

Claude Code discovers MCP servers through configuration. There are three scopes:

#### Option A: Local scope (personal, project-specific)

```bash
# Add chop MCP server for the current project
claude mcp add --transport stdio chop -- node /path/to/chop/mcp/dist/server.js

# Or with the compiled chop binary:
claude mcp add --transport stdio chop -- node /path/to/chop/mcp/dist/server.js

# With environment variables:
claude mcp add --transport stdio --env CHOP_BINARY=/path/to/chop chop \
  -- node /path/to/chop/mcp/dist/server.js
```

This stores the configuration in `~/.claude.json` under the project path.

#### Option B: Project scope (shared via version control)

Create a `.mcp.json` file in the project root:

```json
{
  "mcpServers": {
    "chop": {
      "command": "node",
      "args": ["./mcp/dist/server.js"],
      "env": {
        "CHOP_BINARY": "./zig-out/bin/chop"
      }
    }
  }
}
```

This file is checked into version control so all team members get the same tools.

#### Option C: User scope (personal, all projects)

```bash
claude mcp add --transport stdio --scope user chop \
  -- node /path/to/chop/mcp/dist/server.js
```

#### Option D: Using npx (for published packages)

If the MCP server is published to npm:

```bash
claude mcp add --transport stdio chop -- npx -y @evmts/chop-mcp
```

### Using JSON Configuration Directly

```bash
claude mcp add-json chop '{
  "type": "stdio",
  "command": "node",
  "args": ["./mcp/dist/server.js"],
  "env": {
    "CHOP_BINARY": "./zig-out/bin/chop"
  }
}'
```

### Verifying the Server

```bash
# List all configured servers
claude mcp list

# Get details for chop
claude mcp get chop

# Inside Claude Code, check server status
/mcp
```

### How Claude Code Uses MCP Tools

Once configured, Claude Code automatically:

1. Starts the MCP server process when a session begins
2. Discovers available tools, resources, and prompts
3. Makes tools available for Claude to invoke during conversation
4. Displays resources in the `@` mention autocomplete
5. Shows prompts as `/mcp__chop__<prompt-name>` commands

Example interactions:

```
> What's the keccak256 hash of "hello world"?
Claude invokes: chop.keccak256({ data: "hello world" })

> Convert 1.5 ether to wei
Claude invokes: chop.to-wei({ value: "1.5", unit: "ether" })

> @chop://blockchain/state
(References the blockchain state resource)

> /mcp__chop__analyze-bytecode 0x6080604052...
(Invokes the analyze-bytecode prompt)
```

### Environment Variable Expansion

The `.mcp.json` file supports environment variable expansion:

```json
{
  "mcpServers": {
    "chop": {
      "command": "node",
      "args": ["${CHOP_MCP_PATH:-./mcp/dist/server.js}"],
      "env": {
        "CHOP_BINARY": "${CHOP_BINARY:-chop}",
        "CHAIN_ID": "${CHAIN_ID:-1}"
      }
    }
  }
}
```

### Tool Search

When many MCP tools are configured, Claude Code uses Tool Search to dynamically load tools
on-demand rather than preloading all of them. The server's `instructions` field helps Claude
understand when to search for your tools:

```typescript
const server = new McpServer({
  name: "chop",
  version: "0.1.0",
  instructions:
    "Chop provides Ethereum/EVM developer tools. Search for these tools when " +
    "the user needs: hashing (keccak256), encoding/decoding (ABI, RLP), " +
    "address computation (checksum, CREATE2), bytecode analysis, " +
    "unit conversion (wei/ether), ENS namehash, or function/event selectors.",
})
```

---

## 8. Claude Code Skills Integration

### Skills vs MCP: Complementary Systems

- **MCP servers** provide Claude access to tools, data, and external systems
- **Skills** teach Claude how to use those connections effectively with domain knowledge

Skills are markdown files (SKILL.md) with YAML frontmatter. They are discovered and loaded by
Claude Code based on context. Combining MCP + Skills gives Claude both the _ability_ to use
Ethereum tools and the _knowledge_ of when and how to use them.

### Creating a Chop Skill

Create `.claude/skills/chop-ethereum/SKILL.md`:

```yaml
---
name: chop-ethereum
description: >
  Ethereum/EVM development tools powered by the Chop MCP server.
  Use when working with: smart contracts, EVM bytecode, Solidity encoding/decoding,
  Ethereum addresses, transaction calldata, gas optimization, or any blockchain
  development task. Automatically invokes Chop MCP tools for hashing, encoding,
  address computation, and bytecode analysis.
---

# Chop Ethereum Developer Tools

You have access to the Chop MCP server which provides Ethereum/EVM tools.

## Available Tool Categories

### Hashing
- `keccak256`: Hash data with Keccak-256 (used for selectors, topics, storage slots)

### Conversion
- `to-hex`, `to-dec`: Number base conversion
- `to-wei`, `from-wei`: Ether unit conversion

### Address
- `to-checksum-address`: EIP-55 checksum formatting
- `compute-address`: Predict CREATE deployment address
- `create2-address`: Predict CREATE2 deployment address

### Encoding
- `abi-encode` / `abi-decode`: Solidity ABI encoding
- `encode-calldata`: Function call encoding
- `rlp-encode` / `rlp-decode`: RLP encoding

### Selectors
- `function-selector`: Get 4-byte selector from signature
- `event-topic`: Get 32-byte topic from event signature

### Bytecode
- `disassemble-bytecode`: Disassemble EVM bytecode to opcodes
- `extract-selectors`: Find function selectors in deployed code

### ENS
- `ens-namehash`: Calculate ENS namehash

## When to Use These Tools

1. **Computing hashes**: Use `keccak256` for any Ethereum hashing need
2. **Working with addresses**: Use checksum for display, compute-address for predictions
3. **Encoding calldata**: Use `encode-calldata` with function signature + args
4. **Analyzing contracts**: Use `disassemble-bytecode` and `extract-selectors`
5. **Unit conversion**: Always convert to wei for contract interactions

## Best Practices

- Always use checksummed addresses in output
- When decoding calldata, try to identify the function selector first
- For bytecode analysis, extract selectors first to understand the interface
- Use abi-encode for raw encoding, encode-calldata for function calls
```

### Making Chop Available as a Slash Command

Users can invoke Chop tools directly:

```
/chop-ethereum compute the CREATE2 address for factory 0x... with salt 0x... and init code hash 0x...
```

### Skill with MCP + Dynamic Context

A more advanced skill that combines MCP tools with dynamic context:

```yaml
---
name: chop-audit
description: >
  Security audit workflow for EVM smart contracts using Chop tools.
  Use when asked to audit, review, or check security of smart contract
  bytecode or Solidity code.
context: fork
agent: Explore
disable-model-invocation: true
allowed-tools: Bash(chop *), mcp__chop__*
---

# Smart Contract Security Audit

Perform a security audit of the provided contract using Chop tools.

## Steps

1. **Extract selectors** from the bytecode using `extract-selectors`
2. **Disassemble** the full bytecode using `disassemble-bytecode`
3. **Map selectors** to known function signatures using `function-selector`
4. **Analyze patterns** in the opcodes for:
   - Reentrancy vulnerabilities (CALL followed by state changes)
   - Integer overflow (pre-Solidity 0.8 without SafeMath)
   - Unchecked external calls
   - Delegatecall to untrusted targets
   - Self-destruct capability
   - Access control patterns

## Contract to Audit

$ARGUMENTS
```

### Plugin Distribution

For distributing Chop as a Claude Code plugin with bundled MCP + Skills:

```
chop-plugin/
├── plugin.json
├── .mcp.json
└── skills/
    ├── chop-ethereum/
    │   └── SKILL.md
    ├── chop-audit/
    │   └── SKILL.md
    └── chop-decode/
        └── SKILL.md
```

`plugin.json`:

```json
{
  "name": "chop-ethereum",
  "description": "Ethereum/EVM development tools for Claude Code",
  "mcpServers": {
    "chop": {
      "command": "${CLAUDE_PLUGIN_ROOT}/bin/chop-mcp-server",
      "args": [],
      "env": {
        "CHOP_BINARY": "${CLAUDE_PLUGIN_ROOT}/bin/chop"
      }
    }
  }
}
```

---

## 9. Testing and Debugging

### MCP Inspector

The official visual testing tool for MCP servers:

```bash
# Test a stdio server
npx @modelcontextprotocol/inspector node ./mcp/dist/server.js

# Opens browser at http://localhost:6274 with UI for:
# - Listing tools, resources, prompts
# - Invoking tools with arguments
# - Viewing JSON-RPC messages
# - Checking notifications
```

### FastMCP Testing Utilities

If using FastMCP framework:

```bash
# Interactive testing
npx fastmcp dev ./mcp/dist/server.js

# Debugging with inspector
npx fastmcp inspect ./mcp/dist/server.js
```

### Programmatic Testing

```typescript
// test/mcp-server.test.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { describe, it, expect } from "vitest"

describe("Chop MCP Server", () => {
  let server: McpServer
  let client: Client

  beforeEach(async () => {
    server = createChopMcpServer()
    client = new Client({ name: "test-client", version: "1.0.0" })

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair()

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ])
  })

  it("should list all tools", async () => {
    const tools = await client.listTools()
    expect(tools.tools.length).toBeGreaterThan(20)
    expect(tools.tools.map((t) => t.name)).toContain("keccak256")
  })

  it("should compute keccak256", async () => {
    const result = await client.callTool({
      name: "keccak256",
      arguments: { data: "hello" },
    })
    expect(result.content[0].text).toMatch(/^0x[0-9a-f]{64}$/)
  })

  it("should convert to wei", async () => {
    const result = await client.callTool({
      name: "to-wei",
      arguments: { value: "1", unit: "ether" },
    })
    expect(result.content[0].text).toBe("1000000000000000000")
  })

  it("should list resources", async () => {
    const resources = await client.listResources()
    expect(resources.resources.length).toBeGreaterThan(0)
  })

  it("should list prompts", async () => {
    const prompts = await client.listPrompts()
    expect(prompts.prompts.map((p) => p.name)).toContain("analyze-bytecode")
  })
})
```

### Testing with Effect

```typescript
import { Effect, Layer } from "effect"
import { describe, it } from "@effect/vitest"

describe("Chop Effect Services", () => {
  const TestCryptoService = CryptoService.of({
    keccak256: (data) =>
      Effect.succeed("0x" + "a".repeat(64)),
    toChecksum: (addr) =>
      Effect.succeed(addr),
    computeAddress: (deployer, nonce) =>
      Effect.succeed("0x" + "b".repeat(40)),
  })

  const TestLayer = Layer.succeed(CryptoService, TestCryptoService)

  it.effect("should hash data", () =>
    Effect.gen(function* () {
      const crypto = yield* CryptoService
      const result = yield* crypto.keccak256("hello")
      expect(result).toMatch(/^0x[0-9a-f]{64}$/)
    }).pipe(Effect.provide(TestLayer))
  )
})
```

### Debugging Tips

1. **All logging to stderr**: Never write to stdout; it is reserved for JSON-RPC messages
2. **Use MCP Inspector**: Visual tool at `http://localhost:6274` for interactive testing
3. **Check Claude Code status**: Use `/mcp` command inside Claude Code to see server status
4. **Set timeout**: `MCP_TIMEOUT=10000 claude` for a 10-second startup timeout
5. **Watch for output limits**: Default max is 25,000 tokens; set `MAX_MCP_OUTPUT_TOKENS` to adjust
6. **Parse errors**: Ensure only valid JSON-RPC goes to stdout; redirect all debug output to stderr

---

## 10. Stateful Operations and Blockchain State

### Managing State in an MCP Server

For Chop, the MCP server needs to manage mutable blockchain state (EVM state, accounts, deployed
contracts). Effect's `Ref` is ideal for this:

```typescript
import { Effect, Ref, Layer, Context } from "effect"

// State types
interface EVMState {
  chainId: number
  blockNumber: bigint
  accounts: Map<string, AccountState>
  contracts: Map<string, ContractState>
}

interface AccountState {
  balance: bigint
  nonce: number
  code: Uint8Array
  storage: Map<string, string>
}

interface ContractState {
  address: string
  bytecode: Uint8Array
  abi?: string
  name?: string
}

// State service using Ref for thread-safe mutable state
class EVMStateService extends Context.Tag("EVMStateService")<
  EVMStateService,
  {
    readonly get: Effect.Effect<EVMState>
    readonly getAccount: (address: string) => Effect.Effect<AccountState>
    readonly setBalance: (address: string, balance: bigint) => Effect.Effect<void>
    readonly deployContract: (address: string, bytecode: Uint8Array) => Effect.Effect<void>
    readonly snapshot: Effect.Effect<number>  // Returns snapshot ID
    readonly revert: (snapshotId: number) => Effect.Effect<void>
  }
>() {}

// Implementation using Ref
const EVMStateServiceLive = Layer.effect(
  EVMStateService,
  Effect.gen(function* () {
    const stateRef = yield* Ref.make<EVMState>({
      chainId: 1,
      blockNumber: 0n,
      accounts: new Map(),
      contracts: new Map(),
    })

    const snapshots = yield* Ref.make<Map<number, EVMState>>(new Map())
    const nextSnapshotId = yield* Ref.make(0)

    return EVMStateService.of({
      get: Ref.get(stateRef),

      getAccount: (address) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          return (
            state.accounts.get(address.toLowerCase()) ?? {
              balance: 0n,
              nonce: 0,
              code: new Uint8Array(),
              storage: new Map(),
            }
          )
        }),

      setBalance: (address, balance) =>
        Ref.update(stateRef, (state) => {
          const accounts = new Map(state.accounts)
          const existing = accounts.get(address.toLowerCase()) ?? {
            balance: 0n,
            nonce: 0,
            code: new Uint8Array(),
            storage: new Map(),
          }
          accounts.set(address.toLowerCase(), { ...existing, balance })
          return { ...state, accounts }
        }),

      deployContract: (address, bytecode) =>
        Ref.update(stateRef, (state) => {
          const contracts = new Map(state.contracts)
          contracts.set(address.toLowerCase(), { address, bytecode })
          const accounts = new Map(state.accounts)
          const existing = accounts.get(address.toLowerCase()) ?? {
            balance: 0n,
            nonce: 0,
            code: new Uint8Array(),
            storage: new Map(),
          }
          accounts.set(address.toLowerCase(), {
            ...existing,
            code: bytecode,
          })
          return { ...state, accounts, contracts }
        }),

      snapshot: Effect.gen(function* () {
        const id = yield* Ref.getAndUpdate(nextSnapshotId, (n) => n + 1)
        const currentState = yield* Ref.get(stateRef)
        yield* Ref.update(snapshots, (map) => {
          const newMap = new Map(map)
          newMap.set(id, structuredClone(currentState))
          return newMap
        })
        return id
      }),

      revert: (snapshotId) =>
        Effect.gen(function* () {
          const allSnapshots = yield* Ref.get(snapshots)
          const snapshot = allSnapshots.get(snapshotId)
          if (!snapshot) {
            return yield* Effect.fail(new Error(`Snapshot ${snapshotId} not found`))
          }
          yield* Ref.set(stateRef, snapshot)
        }),
    })
  })
)
```

### Exposing State via MCP Resources

```typescript
// Register blockchain state as an MCP resource
server.registerResource(
  "blockchain-state",
  "chop://blockchain/state",
  { title: "Blockchain State", mimeType: "application/json" },
  async () => {
    const state = await runEffect(
      Effect.gen(function* () {
        const evm = yield* EVMStateService
        return yield* evm.get
      })
    )
    return {
      contents: [{
        uri: "chop://blockchain/state",
        text: JSON.stringify(state, bigintReplacer, 2),
      }],
    }
  }
)
```

### Stateful Tools

```typescript
server.registerTool(
  "evm-snapshot",
  {
    title: "Create EVM Snapshot",
    description: "Create a snapshot of the current EVM state that can be reverted to later",
    inputSchema: {},
  },
  async () => {
    const id = await runEffect(
      Effect.gen(function* () {
        const evm = yield* EVMStateService
        return yield* evm.snapshot
      })
    )
    return { content: [{ type: "text", text: `Snapshot created: ${id}` }] }
  }
)

server.registerTool(
  "evm-revert",
  {
    title: "Revert EVM State",
    description: "Revert the EVM state to a previous snapshot",
    inputSchema: {
      snapshotId: z.number().describe("The snapshot ID to revert to"),
    },
  },
  async ({ snapshotId }) => {
    await runEffect(
      Effect.gen(function* () {
        const evm = yield* EVMStateService
        yield* evm.revert(snapshotId)
      })
    )
    return { content: [{ type: "text", text: `Reverted to snapshot ${snapshotId}` }] }
  }
)
```

### Blockchain MCP Server Examples in the Wild

Several blockchain-focused MCP servers already exist:

- **MCP Anvil Tools**: Interacts with Ethereum smart contracts through Anvil (Foundry's local
  node), providing capabilities for transaction simulation, state manipulation, and contract testing.
  Supports snapshot/revert patterns.

- **EVM MCP Server**: Provides blockchain services across 60+ EVM-compatible networks with 22 tools
  and 10 AI-guided prompts, enabling AI agents to interact with Ethereum, Optimism, Arbitrum, etc.

---

## 11. Security Considerations

### Authentication

For local stdio transport (primary Claude Code use case), authentication is handled implicitly by
the process spawning model. The server only accepts connections from its parent process.

For HTTP transport, implement authentication:

```typescript
// OAuth 2.0 for remote servers
server.registerTool("sensitive-operation", {
  // ... requires authenticated session
})

// Bearer token for simpler setups
claude mcp add --transport http chop https://mcp.chop.dev \
  --header "Authorization: Bearer ${CHOP_API_KEY}"
```

### Input Validation

All tool inputs should be validated with Zod schemas. The MCP SDK enforces this:

```typescript
inputSchema: {
  address: z.string()
    .regex(/^0x[0-9a-fA-F]{40}$/, "Invalid Ethereum address")
    .describe("Ethereum address (0x-prefixed, 40 hex chars)"),
  value: z.string()
    .regex(/^\d+(\.\d+)?$/, "Invalid numeric value")
    .describe("Numeric value"),
}
```

### Resource Isolation

- Each MCP request gets its own scope in Effect (`Effect.scoped`)
- Use `Ref` for shared mutable state with proper synchronization
- Never expose private keys or sensitive data as resources
- Limit tool capabilities (read-only vs. write operations)

### Prompt Injection

Be careful with MCP servers that process untrusted content:

- Resources fetched from external sources could contain prompt injection
- Tool outputs that include user-controlled data should be treated as untrusted
- Use server instructions to guide Claude's behavior with tool results

### Claude Code Permissions

Users can control which MCP tools require approval:

```json
{
  "permissions": {
    "allow": ["mcp__chop__keccak256", "mcp__chop__to-hex"],
    "ask": ["mcp__chop__evm-snapshot", "mcp__chop__evm-revert"],
    "deny": ["mcp__chop__deploy-contract"]
  }
}
```

---

## 12. Alternative Frameworks

### FastMCP

A higher-level framework that simplifies MCP server creation:

```typescript
import { FastMCP } from "fastmcp"
import { z } from "zod"

const server = new FastMCP({
  name: "chop",
  version: "0.1.0",
})

server.addTool({
  name: "keccak256",
  description: "Hash with Keccak-256",
  parameters: z.object({ data: z.string() }),
  execute: async ({ data }) => {
    return runChop(["keccak", data])
  },
})

server.start({ transportType: "stdio" })
```

**Pros:**
- Less boilerplate than official SDK
- Built-in session management
- Testing utilities (`npx fastmcp dev`, `npx fastmcp inspect`)
- Custom HTTP routes
- Edge deployment support (Cloudflare Workers)

**Cons:**
- Additional dependency
- May lag behind official SDK updates
- Less control over low-level protocol details

### Direct JSON-RPC

For maximum control, you can implement the JSON-RPC protocol directly. This is not recommended
unless you have very specific requirements.

### Claude Code as MCP Server

Claude Code itself can serve as an MCP server:

```bash
claude mcp serve
```

This exposes Claude's tools (Read, Edit, Bash, etc.) to other MCP clients.

---

## 13. Implementation Plan for Chop

### Phase 1: Core MCP Server (MVP)

**Goal**: Expose all existing CLI commands as MCP tools via stdio transport.

```
mcp/
├── package.json
├── tsconfig.json
├── src/
│   ├── server.ts          # Main server entry point
│   ├── tools/
│   │   ├── hashing.ts     # keccak256
│   │   ├── conversion.ts  # to-hex, to-dec, to-wei, from-wei
│   │   ├── address.ts     # checksum, compute-address, create2
│   │   ├── encoding.ts    # abi-encode, abi-decode, calldata, rlp
│   │   ├── hex.ts         # concat-hex, to-utf8, from-utf8
│   │   ├── selectors.ts   # sig, sig-event
│   │   ├── ens.ts         # namehash
│   │   ├── bytecode.ts    # disassemble, selectors
│   │   └── constants.ts   # hash-zero, address-zero, max-uint, etc.
│   ├── resources/
│   │   └── constants.ts   # Well-known addresses, selectors
│   ├── prompts/
│   │   ├── analyze.ts     # Bytecode analysis prompt
│   │   └── decode.ts      # Calldata decode prompt
│   └── utils/
│       └── chop.ts        # Helper to execute chop binary
├── test/
│   └── server.test.ts
└── dist/
```

**Implementation approach**: Shell out to the compiled `chop` Zig binary for all operations.
This avoids reimplementing the Zig logic in TypeScript.

**package.json**:

```json
{
  "name": "@evmts/chop-mcp",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/server.js",
  "bin": {
    "chop-mcp": "dist/server.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/server.ts",
    "test": "vitest",
    "inspect": "npx @modelcontextprotocol/inspector node dist/server.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.26.0",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@modelcontextprotocol/inspector": "latest",
    "typescript": "^5.5.0",
    "tsx": "^4.0.0",
    "vitest": "^2.0.0"
  }
}
```

### Phase 2: Effect Integration

**Goal**: Use Effect for service composition, error handling, and state management.

- Add `effect` as a dependency
- Define Effect services for each tool category
- Use `Ref` for stateful EVM operations
- Use `Schema` for validation (alongside Zod for MCP SDK compatibility)
- Use `Layer` for dependency injection and testability

### Phase 3: Stateful EVM

**Goal**: Integrate with the Guillotine EVM for stateful operations.

- Create `EVMStateService` with Effect `Ref`
- Expose EVM state as MCP resources
- Add tools for transaction execution, state manipulation
- Implement snapshot/revert
- Add streaming for long-running operations

### Phase 4: Claude Code Skill

**Goal**: Package as a Claude Code skill with MCP integration.

- Create `.claude/skills/chop-ethereum/SKILL.md`
- Create `.mcp.json` for project-scoped configuration
- Add prompts for common Ethereum development workflows
- Document usage patterns
- Optionally package as a Claude Code plugin

### Phase 5: Distribution

**Goal**: Make Chop easily installable by anyone.

- Publish to npm as `@evmts/chop-mcp`
- Support `npx @evmts/chop-mcp` for zero-install usage
- Register in the MCP server registry
- Create documentation

---

## 14. Sources

### Official Documentation
- [Model Context Protocol Documentation](https://modelcontextprotocol.io/docs)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP TypeScript SDK - Server Documentation](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md)
- [@modelcontextprotocol/sdk on npm](https://www.npmjs.com/package/@modelcontextprotocol/sdk)
- [MCP Specification](https://spec.modelcontextprotocol.io)

### Claude Code
- [Claude Code MCP Documentation](https://code.claude.com/docs/en/mcp)
- [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills)
- [Claude Code Skills Best Practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
- [Extending Claude with Skills and MCP](https://claude.com/blog/extending-claude-capabilities-with-skills-mcp-servers)
- [Skills Explained](https://claude.com/blog/skills-explained)
- [Anthropic Skills Repository](https://github.com/anthropics/skills)

### Effect TypeScript
- [Effect AI Introduction](https://effect.website/docs/ai/introduction/)
- [Effect AI Blog Post](https://effect.website/blog/effect-ai/)
- [Effect-TS AI Integration Architecture (DeepWiki)](https://deepwiki.com/Effect-TS/effect/10.1-ai-integration-architecture)
- [Effect-TS AI and External Services (DeepWiki)](https://deepwiki.com/Effect-TS/effect/10-ai-and-external-services)
- [@effect/ai API Documentation](https://effect-ts.github.io/effect/docs/ai/ai)
- [effect-mcp (Effect Documentation Server)](https://github.com/niklaserik/effect-mcp)

### Tutorials and Guides
- [How to Build a Custom MCP Server with TypeScript (freeCodeCamp)](https://www.freecodecamp.org/news/how-to-build-a-custom-mcp-server-with-typescript-a-handbook-for-developers/)
- [How to Build MCP Servers with TypeScript SDK (DEV Community)](https://dev.to/shadid12/how-to-build-mcp-servers-with-typescript-sdk-1c28)
- [Configuring MCP Tools in Claude Code (Scott Spence)](https://scottspence.com/posts/configuring-mcp-tools-in-claude-code)
- [Claude Agent Skills Deep Dive](https://leehanchung.github.io/blogs/2025/10/26/claude-skills-deep-dive/)
- [Inside Claude Code Skills (Mikhail Shilkov)](https://mikhail.io/2025/10/claude-code-skills/)

### Alternative Frameworks
- [FastMCP Framework](https://github.com/punkpeye/fastmcp)
- [MCP Inspector](https://github.com/modelcontextprotocol/inspector)

### Blockchain MCP Servers
- [MCP Anvil Tools](https://www.mcp-gallery.jp/en/mcp/github/dennisonbertram/mcp-anvil-tools)
- [EVM MCP Server](https://github.com/mcpdotdirect/evm-mcp-server)
- [Blockchain MCP Server](https://mcpservers.org/servers/lienhage/blockchain-mcp)
- [Using MCP with Web3 (Google Cloud)](https://cloud.google.com/blog/products/identity-security/using-mcp-with-web3-how-to-secure-blockchain-interacting-agents)

### MCP Server Registry
- [MCP.pizza Registry](https://www.mcp.pizza)
- [MCP Servers Directory](https://mcpservers.org)
- [MCP Example Servers](https://modelcontextprotocol.io/examples)
