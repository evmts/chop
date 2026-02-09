# Chop AI Agent Integration Research

Comprehensive research on making Chop usable as a tool from Claude Code, OpenAI Codex,
and other AI coding agents. Covers MCP (Model Context Protocol), Claude Code Skills,
OpenAI Codex integration, and the Agent Skills open standard.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Claude Code Integration](#2-claude-code-integration)
   - [MCP Server Approach](#21-mcp-server-approach)
   - [Skills / Slash Commands Approach](#22-skills--slash-commands-approach)
   - [Plugin Approach](#23-plugin-approach)
3. [OpenAI Codex Integration](#3-openai-codex-integration)
   - [MCP Server in Codex](#31-mcp-server-in-codex)
   - [AGENTS.md for Codex](#32-agentsmd-for-codex)
   - [Codex as MCP Server](#33-codex-as-mcp-server)
4. [Agent Skills Open Standard](#4-agent-skills-open-standard)
5. [MCP Server Implementation](#5-mcp-server-implementation)
   - [Architecture Decisions](#51-architecture-decisions)
   - [TypeScript Implementation](#52-typescript-mcp-server-implementation)
   - [Tool Definitions for Chop](#53-tool-definitions-for-chop)
6. [Tool Design Best Practices](#6-tool-design-best-practices)
7. [Chop-Specific Recommendations](#7-chop-specific-recommendations)
8. [Implementation Plan](#8-implementation-plan)
9. [Sources](#9-sources)

---

## 1. Executive Summary

Chop is an Ethereum CLI/TUI tool written in Zig with cast-compatible commands for
data encoding/decoding, address utilities, cryptographic operations, unit conversions,
bytecode disassembly, and more. To make Chop usable as an AI agent tool, there are
three viable integration paths:

1. **MCP Server** (highest value, works with both Claude Code and Codex): Build a
   lightweight MCP server that wraps Chop's CLI commands as MCP tools. This is the
   universal approach that works across all MCP-compatible clients.

2. **Claude Code Skills** (Claude-specific, complementary): Create SKILL.md files
   that teach Claude Code how and when to use Chop, with rich descriptions and examples.

3. **AGENTS.md** (universal, lightweight): Add an AGENTS.md file to the Chop repository
   documenting all commands and usage patterns for any AI agent to discover.

The recommended approach is to implement all three, since they are complementary:
the MCP server provides programmatic tool access, Skills provide Claude-specific
intelligence, and AGENTS.md provides universal discoverability.

---

## 2. Claude Code Integration

### 2.1 MCP Server Approach

Claude Code connects to external tools through MCP (Model Context Protocol), an open
standard created by Anthropic for AI-tool integrations. MCP servers give Claude Code
access to tools, databases, and APIs.

#### How Claude Code Discovers MCP Tools

Claude Code supports three MCP transport types:

- **HTTP (Streamable HTTP)**: Recommended for remote/cloud-based MCP servers
- **SSE (Server-Sent Events)**: Deprecated, use HTTP instead
- **stdio**: For local processes; ideal for tools that need direct system access

#### Configuration File Locations

MCP servers are configured at three scope levels:

| Scope   | Storage Location                          | Purpose                          |
|---------|-------------------------------------------|----------------------------------|
| Local   | `~/.claude.json` (under project path)     | Personal, project-specific       |
| Project | `.mcp.json` at project root               | Shared via version control       |
| User    | `~/.claude.json` (global section)         | Personal, cross-project          |

#### Adding Chop as an MCP Server in Claude Code

```bash
# Option 1: Add via CLI (stdio transport, local scope)
claude mcp add --transport stdio chop -- chop-mcp-server

# Option 2: Add via CLI with explicit scope
claude mcp add --transport stdio --scope project chop -- npx chop-mcp-server

# Option 3: Add via JSON config
claude mcp add-json chop '{"type":"stdio","command":"npx","args":["chop-mcp-server"]}'
```

#### Project-Scoped `.mcp.json` (Checked Into Version Control)

```json
{
  "mcpServers": {
    "chop": {
      "command": "npx",
      "args": ["-y", "chop-mcp-server"],
      "env": {}
    }
  }
}
```

Or for a locally built binary:

```json
{
  "mcpServers": {
    "chop": {
      "command": "${CHOP_BIN:-chop-mcp-server}",
      "args": ["--stdio"],
      "env": {
        "CHOP_PATH": "${CHOP_PATH:-chop}"
      }
    }
  }
}
```

#### MCP Tool Search

As of January 2026, Claude Code supports MCP Tool Search which dynamically loads
tools on-demand instead of preloading all of them. This activates automatically when
tool descriptions would consume more than 10% of the context window. For MCP server
authors, the server `instructions` field becomes crucial: it helps Claude understand
when to search for your tools.

Good server instructions for Chop:

```
This server provides Ethereum development utilities including ABI encoding/decoding,
address computation (CREATE/CREATE2), keccak256 hashing, unit conversions (wei/ether),
RLP encoding, function selector computation, ENS namehash, and EVM bytecode
disassembly. Use these tools when working with Ethereum smart contracts, transactions,
or blockchain data.
```

#### Dynamic Tool Updates

Claude Code supports `list_changed` notifications from MCP servers, allowing dynamic
tool registration without reconnection.

### 2.2 Skills / Slash Commands Approach

Claude Code Skills are the native way to extend Claude's capabilities. Skills follow
the Agent Skills open standard (agentskills.io) and provide richer integration than
raw MCP tools.

#### Skill vs Slash Command

These have been merged in Claude Code. A file at `.claude/commands/review.md` and
a skill at `.claude/skills/review/SKILL.md` both create `/review` and work the same
way. Skills add optional features: a directory for supporting files, frontmatter for
invocation control, and automatic context loading.

#### SKILL.md Format

```yaml
---
name: my-skill
description: What this skill does and when to use it
argument-hint: [optional hint for autocomplete]
disable-model-invocation: true/false
user-invocable: true/false
allowed-tools: Bash(chop *), Read
model: claude-sonnet-4-20250514
context: fork
agent: Explore
---

Markdown instructions for Claude to follow when this skill is invoked.
```

#### Frontmatter Fields Reference

| Field                      | Required    | Description                                                |
|----------------------------|-------------|------------------------------------------------------------|
| `name`                     | No          | Display name, becomes `/name`. Lowercase, hyphens, max 64  |
| `description`              | Recommended | What it does. Claude uses this for auto-discovery           |
| `argument-hint`            | No          | Autocomplete hint like `[address]` or `[function-sig]`      |
| `disable-model-invocation` | No          | `true` = only user can invoke. Default: `false`             |
| `user-invocable`           | No          | `false` = hidden from `/` menu. Default: `true`             |
| `allowed-tools`            | No          | Tools allowed without permission prompts                    |
| `model`                    | No          | Model override for this skill                               |
| `context`                  | No          | `fork` = run in isolated subagent                           |
| `agent`                    | No          | Subagent type: `Explore`, `Plan`, `general-purpose`         |

#### Where Skills Live

| Location   | Path                                           | Applies to               |
|------------|------------------------------------------------|--------------------------|
| Enterprise | Managed settings                               | All org users            |
| Personal   | `~/.claude/skills/<name>/SKILL.md`             | All your projects        |
| Project    | `.claude/skills/<name>/SKILL.md`               | This project only        |
| Plugin     | `<plugin>/skills/<name>/SKILL.md`              | Where plugin is enabled  |

#### Invocation Control

| Frontmatter                      | You invoke | Claude invokes | Context behavior                     |
|----------------------------------|------------|----------------|--------------------------------------|
| (default)                        | Yes        | Yes            | Description always loaded, full on invoke |
| `disable-model-invocation: true` | Yes        | No             | Not in context until you invoke      |
| `user-invocable: false`          | No         | Yes            | Description always loaded            |

#### String Substitutions in Skills

| Variable               | Description                                    |
|------------------------|------------------------------------------------|
| `$ARGUMENTS`           | All arguments passed to the skill              |
| `$ARGUMENTS[N]`        | Specific argument by 0-based index             |
| `$N`                   | Shorthand for `$ARGUMENTS[N]`                  |
| `${CLAUDE_SESSION_ID}` | Current session ID                             |

#### Dynamic Context Injection

Skills support `!`command`` syntax that runs shell commands before the skill
content is sent to Claude:

```yaml
---
name: check-contract
description: Analyze Ethereum contract bytecode
allowed-tools: Bash(chop *)
---

## Contract bytecode analysis
- Disassembly: !`chop disassemble $ARGUMENTS[0]`
- Selectors: !`chop selectors $ARGUMENTS[0]`

Analyze the disassembly and selectors above...
```

#### Example Chop Skills for Claude Code

**Skill 1: Ethereum Address Utilities**

Create `.claude/skills/eth-address/SKILL.md`:

```yaml
---
name: eth-address
description: Ethereum address utilities - checksum addresses, compute CREATE/CREATE2 addresses, and validate addresses. Use when working with Ethereum addresses, deploying contracts, or computing deterministic deployment addresses.
allowed-tools: Bash(chop *)
---

# Ethereum Address Utilities

Use the `chop` CLI for address operations:

## Checksum an address
```bash
chop to-checksum <address>
```

## Compute CREATE address
```bash
chop compute-address <deployer> --nonce <n>
```

## Compute CREATE2 address
```bash
chop create2 <deployer> <salt> <init-code-hash>
```

## Zero address
```bash
chop address-zero
```

When the user asks about contract addresses, deployment addresses, or needs to
validate/checksum an Ethereum address, use these tools. Always output checksummed
addresses.
```

**Skill 2: ABI Encoding/Decoding**

Create `.claude/skills/eth-abi/SKILL.md`:

```yaml
---
name: eth-abi
description: Encode and decode Ethereum ABI data, compute function selectors, and build calldata. Use when working with smart contract interactions, transaction data, or function signatures.
allowed-tools: Bash(chop *)
---

# Ethereum ABI Tools

## Encode ABI data
```bash
chop abi-encode "uint256,address" 100 0xd8da6bf26964af9d7eed9e03e53415d37aa96045
```

## Decode ABI data
```bash
chop abi-decode "uint256,address" <hex-data>
```

## Compute function selector (4-byte)
```bash
chop sig "transfer(address,uint256)"
```

## Compute event topic (32-byte)
```bash
chop sig-event "Transfer(address,address,uint256)"
```

## Build full calldata
```bash
chop calldata "transfer(address,uint256)" 0xRecipient 1000000000000000000
```

For contract interactions, always:
1. Compute the selector first with `chop sig`
2. Encode the arguments with `chop abi-encode`
3. Or use `chop calldata` for the complete encoding
```

**Skill 3: Unit Conversion**

Create `.claude/skills/eth-units/SKILL.md`:

```yaml
---
name: eth-units
description: Convert between Ethereum denominations (wei, gwei, ether) and between hex/decimal formats. Use when dealing with ETH values, gas prices, or number format conversions.
allowed-tools: Bash(chop *)
---

# Ethereum Unit Conversions

## Convert to wei
```bash
chop to-wei 1.5 ether     # 1500000000000000000
chop to-wei 30 gwei        # 30000000000
```

## Convert from wei
```bash
chop from-wei 1500000000000000000 ether  # 1.5
chop from-wei 30000000000 gwei           # 30
```

## Hex/Decimal conversion
```bash
chop to-hex 255            # 0xff
chop to-dec 0xff           # 255
```

## Keccak-256 hash
```bash
chop keccak "hello"
```

## Integer bounds
```bash
chop max-uint 256          # Max uint256
chop max-int 256           # Max int256
chop min-int 256           # Min int256
```
```

### 2.3 Plugin Approach

Claude Code Plugins can bundle MCP servers, skills, and settings together. A plugin
is a directory with a `plugin.json` manifest:

```json
{
  "name": "chop-ethereum",
  "description": "Ethereum development utilities powered by Chop",
  "mcpServers": {
    "chop": {
      "command": "${CLAUDE_PLUGIN_ROOT}/bin/chop-mcp-server",
      "args": ["--stdio"]
    }
  }
}
```

Plugin MCP servers start automatically when the plugin is enabled. The plugin can
also contain a `skills/` directory and `.mcp.json` at the plugin root.

---

## 3. OpenAI Codex Integration

### 3.1 MCP Server in Codex

Codex CLI supports MCP servers natively through `config.toml`. The same MCP server
built for Claude Code also works with Codex.

#### Adding Chop MCP Server to Codex

```bash
# Add via Codex CLI
codex mcp add chop -- npx -y chop-mcp-server
```

#### Manual Configuration in `~/.codex/config.toml`

```toml
[mcp_servers.chop]
command = "npx"
args = ["-y", "chop-mcp-server"]
enabled = true
startup_timeout_sec = 10
tool_timeout_sec = 60

[mcp_servers.chop.env]
CHOP_PATH = "chop"
```

#### Configuration for Local Binary

```toml
[mcp_servers.chop]
command = "/usr/local/bin/chop-mcp-server"
args = ["--stdio"]
enabled = true
startup_timeout_sec = 5
tool_timeout_sec = 30
```

#### Project-Scoped Configuration (`.codex/config.toml`)

```toml
[mcp_servers.chop]
command = "npx"
args = ["-y", "chop-mcp-server"]
enabled = true
# Only allow specific tools
enabled_tools = ["keccak256", "abi_encode", "abi_decode", "to_checksum_address"]
```

#### Codex MCP Server Options

| Option               | Default | Description                                    |
|----------------------|---------|------------------------------------------------|
| `command`            | req'd   | Server executable                              |
| `args`               | `[]`    | Command line arguments                         |
| `env`                | `{}`    | Environment variables                          |
| `cwd`                | none    | Working directory                              |
| `enabled`            | `true`  | Toggle without removing config                 |
| `required`           | `false` | Fail startup if server unavailable             |
| `startup_timeout_sec`| `10`    | Max seconds for server startup                 |
| `tool_timeout_sec`   | `60`    | Max seconds per tool call                      |
| `enabled_tools`      | all     | Allowlist of tool names                        |
| `disabled_tools`     | none    | Denylist of tool names                         |

#### HTTP Server Configuration

```toml
[mcp_servers.chop_remote]
url = "http://localhost:3456/mcp"
http_headers = { "Authorization" = "Bearer ${CHOP_API_KEY}" }
enabled = true
```

### 3.2 AGENTS.md for Codex

Codex reads `AGENTS.md` files to understand project context and available tools.
The file uses plain Markdown with no required schema.

#### Discovery Hierarchy (Codex-Specific)

1. `~/.codex/AGENTS.override.md` (global override)
2. `~/.codex/AGENTS.md` (global default)
3. Git root down to current directory: `AGENTS.override.md` then `AGENTS.md`
4. Falls back to `project_doc_fallback_filenames` in config

Combined size capped at `project_doc_max_bytes` (32 KiB default).

#### Recommended AGENTS.md for Chop

```markdown
# AGENTS.md

## Project Overview
Chop is an Ethereum Swiss Army knife CLI tool (cast-compatible) written in Zig.
It provides 20+ subcommands for common Ethereum development operations.

## Available Commands

### Conversion
- `chop keccak <data>` - Keccak-256 hash
- `chop to-hex <decimal>` - Convert decimal to hex
- `chop to-dec <hex>` - Convert hex to decimal
- `chop to-wei <amount> <unit>` - Convert to wei (units: ether, gwei, etc.)
- `chop from-wei <wei> <unit>` - Convert from wei

### Address
- `chop to-checksum <address>` - EIP-55 checksummed address
- `chop compute-address <deployer> --nonce <n>` - Compute CREATE address
- `chop create2 <deployer> <salt> <init-code-hash>` - Compute CREATE2 address
- `chop address-zero` - Print zero address

### Encoding
- `chop abi-encode <types> <values...>` - ABI encode arguments
- `chop abi-decode <types> <hex-data>` - ABI decode data
- `chop calldata <sig> <args...>` - Encode full function calldata
- `chop to-rlp <data>` - RLP encode
- `chop from-rlp <data>` - RLP decode

### Hex
- `chop concat-hex <hex1> <hex2>` - Concatenate hex strings
- `chop to-utf8 <hex>` - Convert hex to UTF-8
- `chop from-utf8 <string>` - Convert UTF-8 to hex

### Selectors
- `chop sig <function-signature>` - Get 4-byte function selector
- `chop sig-event <event-signature>` - Get 32-byte event topic hash

### Utility
- `chop hash-zero` - Print 32-byte zero hash
- `chop max-uint <bits>` - Max unsigned integer for bit width
- `chop max-int <bits>` - Max signed integer for bit width
- `chop min-int <bits>` - Min signed integer for bit width

### ENS
- `chop namehash <ens-name>` - Calculate ENS namehash

### Bytecode
- `chop disassemble <bytecode>` - Disassemble EVM bytecode
- `chop selectors <bytecode>` - Extract function selectors from bytecode

## Output Formats
- Default: plain text output
- `--json` / `-j`: JSON output format

## Build
- `zig build` - Build the project
- `zig build test` - Run tests

## Code Style
- Written in Zig (0.14+)
- Uses the voltaire and guillotine-mini libraries
- Cast-compatible command syntax (compatible with Foundry's cast tool)

## Examples
```bash
chop keccak "hello"
chop to-checksum 0xd8da6bf26964af9d7eed9e03e53415d37aa96045
chop to-wei 1.5 ether
chop sig "transfer(address,uint256)"
chop abi-encode "uint256,address" 100 0xd8da6bf26964af9d7eed9e03e53415d37aa96045
chop disassemble 0x6080604052...
```
```

### 3.3 Codex as MCP Server

Codex can itself run as an MCP server, exposing a `codex` tool and a `codex-reply`
tool for multi-turn sessions:

```bash
codex mcp-server
```

This means a multi-agent setup where Codex orchestrates Chop is possible: the
Codex agent uses the Chop MCP server tools, while itself being orchestrated by
a higher-level agent through the Agents SDK.

---

## 4. Agent Skills Open Standard

The Agent Skills specification (agentskills.io), published by Anthropic in December
2025, is an open standard adopted by Microsoft, OpenAI, GitHub Copilot, Cursor,
Codex CLI, and 20+ other AI tools. Claude Code Skills follow this standard.

### Specification Summary

A skill is a directory with a `SKILL.md` entrypoint:

```
my-skill/
  SKILL.md           # Required: instructions + metadata
  reference.md       # Optional: detailed docs
  examples/          # Optional: example outputs
  scripts/           # Optional: executable scripts
```

`SKILL.md` uses YAML frontmatter + Markdown body:

```yaml
---
name: skill-name
description: What this skill does
---

Instructions for the AI agent...
```

### Cross-Platform Compatibility

Skills work across:
- Claude Code (native support)
- OpenAI Codex CLI (via `skills/` directory)
- GitHub Copilot
- Cursor
- Windsurf
- Gemini CLI
- Goose
- Roo Code
- And many others

### Publishing to skills.sh

Skills can be distributed through skills.sh, the central distribution hub.
For Chop, publishing Ethereum development skills would make them discoverable
across all compatible AI tools.

---

## 5. MCP Server Implementation

### 5.1 Architecture Decisions

#### Option A: TypeScript Wrapper (Recommended for Distribution)

Build a TypeScript MCP server that shells out to the `chop` binary. This is the
standard approach for wrapping existing CLI tools and provides the best distribution
story via npm.

Pros:
- Easy to distribute via `npx chop-mcp-server`
- TypeScript SDK is the most mature MCP SDK
- Works with both Claude Code and Codex
- Can be installed globally or run ephemerally with npx

Cons:
- Requires Node.js runtime
- Extra process overhead for each tool call (shelling out to chop)

#### Option B: Native Zig MCP Server

Build the MCP server directly in Zig, implementing the JSON-RPC protocol over stdio.

Pros:
- No runtime dependencies
- Single binary distribution
- Direct access to Chop's internal libraries
- Best performance

Cons:
- More implementation work (JSON-RPC, MCP protocol)
- Harder to distribute (architecture-specific binaries)
- Less community support for Zig MCP implementations

#### Option C: Thin HTTP Wrapper

Run Chop as an HTTP server that speaks the MCP Streamable HTTP protocol.

Pros:
- Can be deployed remotely
- Supports OAuth authentication
- One server, many clients

Cons:
- More operational complexity
- Network latency

**Recommendation**: Start with Option A (TypeScript wrapper) for fastest time to
market and widest compatibility. Consider Option B later for performance optimization.

### 5.2 TypeScript MCP Server Implementation

#### Project Setup

```bash
mkdir chop-mcp-server
cd chop-mcp-server
npm init -y
npm install @modelcontextprotocol/sdk zod@3
npm install -D @types/node typescript
```

`package.json`:
```json
{
  "name": "chop-mcp-server",
  "version": "0.1.0",
  "description": "MCP server for Chop Ethereum CLI tools",
  "type": "module",
  "bin": {
    "chop-mcp-server": "./build/index.js"
  },
  "scripts": {
    "build": "tsc && chmod 755 build/index.js",
    "start": "node build/index.js"
  },
  "files": ["build"],
  "keywords": ["mcp", "ethereum", "chop", "blockchain", "web3"],
  "license": "MIT"
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./build",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

#### Full Implementation (`src/index.ts`)

```typescript
#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

// Resolve the chop binary path
const CHOP_BIN = process.env.CHOP_PATH || "chop";

// Helper: run a chop command and return the result
async function runChop(
  args: string[],
  options?: { json?: boolean }
): Promise<{ success: boolean; output: string; error?: string }> {
  try {
    const fullArgs = options?.json ? ["--json", ...args] : args;
    const { stdout, stderr } = await exec(CHOP_BIN, fullArgs, {
      timeout: 30000,
    });
    return { success: true, output: stdout.trim(), error: stderr || undefined };
  } catch (err: unknown) {
    const error = err as { stderr?: string; message?: string };
    return {
      success: false,
      output: "",
      error: error.stderr || error.message || "Unknown error",
    };
  }
}

// Helper: format tool result
function toolResult(result: { success: boolean; output: string; error?: string }) {
  if (result.success) {
    return {
      content: [{ type: "text" as const, text: result.output }],
    };
  }
  return {
    content: [{ type: "text" as const, text: `Error: ${result.error}` }],
    isError: true,
  };
}

// Create the MCP server
const server = new McpServer({
  name: "chop",
  version: "0.1.0",
  instructions: `Chop is an Ethereum Swiss Army knife providing utilities for ABI encoding/decoding, \
address computation (CREATE/CREATE2), keccak256 hashing, unit conversions (wei/ether/gwei), \
RLP encoding, function selector computation, ENS namehash, and EVM bytecode disassembly. \
Use these tools when working with Ethereum smart contracts, transactions, addresses, or blockchain data.`,
});

// ============================================================
// CONVERSION TOOLS
// ============================================================

server.registerTool(
  "keccak256",
  {
    description:
      "Compute the Keccak-256 hash of input data. Used for Ethereum function selectors, " +
      "event topics, storage slot computation, and general hashing.",
    inputSchema: {
      data: z.string().describe("The data to hash. Can be a string or hex-encoded bytes."),
    },
  },
  async ({ data }) => toolResult(await runChop(["keccak", data]))
);

server.registerTool(
  "to_hex",
  {
    description: "Convert a decimal number to hexadecimal representation with 0x prefix.",
    inputSchema: {
      value: z.string().describe("Decimal number to convert to hex"),
    },
  },
  async ({ value }) => toolResult(await runChop(["to-hex", value]))
);

server.registerTool(
  "to_dec",
  {
    description: "Convert a hexadecimal number (with or without 0x prefix) to decimal.",
    inputSchema: {
      value: z.string().describe("Hex number to convert to decimal"),
    },
  },
  async ({ value }) => toolResult(await runChop(["to-dec", value]))
);

server.registerTool(
  "to_wei",
  {
    description:
      "Convert an Ethereum denomination to wei. Supports ether, gwei, and other units. " +
      "1 ether = 10^18 wei, 1 gwei = 10^9 wei.",
    inputSchema: {
      amount: z.string().describe("Amount to convert (e.g., '1.5')"),
      unit: z
        .enum(["ether", "gwei", "finney", "szabo", "wei"])
        .describe("Source unit to convert from"),
    },
  },
  async ({ amount, unit }) => toolResult(await runChop(["to-wei", amount, unit]))
);

server.registerTool(
  "from_wei",
  {
    description:
      "Convert a wei amount to another Ethereum denomination (ether, gwei, etc.).",
    inputSchema: {
      wei: z.string().describe("Amount in wei"),
      unit: z
        .enum(["ether", "gwei", "finney", "szabo"])
        .describe("Target unit to convert to"),
    },
  },
  async ({ wei, unit }) => toolResult(await runChop(["from-wei", wei, unit]))
);

// ============================================================
// ADDRESS TOOLS
// ============================================================

server.registerTool(
  "to_checksum_address",
  {
    description:
      "Convert an Ethereum address to EIP-55 checksummed format. " +
      "Always use this to validate and normalize Ethereum addresses.",
    inputSchema: {
      address: z
        .string()
        .describe("Ethereum address (with or without 0x prefix, any case)"),
    },
  },
  async ({ address }) => toolResult(await runChop(["to-checksum", address]))
);

server.registerTool(
  "compute_create_address",
  {
    description:
      "Compute the contract address that would be deployed via CREATE opcode, " +
      "given the deployer address and nonce. Useful for predicting contract addresses " +
      "before deployment.",
    inputSchema: {
      deployer: z.string().describe("Address of the deploying account"),
      nonce: z
        .string()
        .describe("Transaction nonce of the deployer (decimal number)"),
    },
  },
  async ({ deployer, nonce }) =>
    toolResult(await runChop(["compute-address", deployer, "--nonce", nonce]))
);

server.registerTool(
  "compute_create2_address",
  {
    description:
      "Compute the deterministic contract address from CREATE2. " +
      "Useful for counterfactual deployments, predictable proxy addresses, " +
      "and other deterministic deployment patterns. " +
      "address = keccak256(0xff ++ deployer ++ salt ++ keccak256(init_code))[12:]",
    inputSchema: {
      deployer: z.string().describe("Address of the deploying contract"),
      salt: z.string().describe("32-byte salt value (hex encoded)"),
      init_code_hash: z
        .string()
        .describe("Keccak-256 hash of the contract init code (hex encoded)"),
    },
  },
  async ({ deployer, salt, init_code_hash }) =>
    toolResult(await runChop(["create2", deployer, salt, init_code_hash]))
);

// ============================================================
// ENCODING TOOLS
// ============================================================

server.registerTool(
  "abi_encode",
  {
    description:
      "ABI-encode values according to Ethereum ABI specification. " +
      "Produces the hex-encoded ABI encoding of the given types and values. " +
      "Example types: 'uint256,address', 'bool,string,bytes32'",
    inputSchema: {
      types: z
        .string()
        .describe(
          "Comma-separated Solidity types (e.g., 'uint256,address,bool')"
        ),
      values: z
        .array(z.string())
        .describe("Values to encode, one per type, in order"),
    },
  },
  async ({ types, values }) =>
    toolResult(await runChop(["abi-encode", types, ...values]))
);

server.registerTool(
  "abi_decode",
  {
    description:
      "Decode ABI-encoded hex data back into typed values. " +
      "Provide the expected types and the encoded data.",
    inputSchema: {
      types: z
        .string()
        .describe("Comma-separated Solidity types to decode into"),
      data: z
        .string()
        .describe("Hex-encoded ABI data to decode (with or without 0x prefix)"),
    },
  },
  async ({ types, data }) =>
    toolResult(await runChop(["abi-decode", types, data]))
);

server.registerTool(
  "encode_calldata",
  {
    description:
      "Encode a complete function call including the 4-byte selector and ABI-encoded arguments. " +
      "This produces the full calldata for an Ethereum transaction. " +
      "Example: calldata('transfer(address,uint256)', '0xRecipient', '1000000000000000000')",
    inputSchema: {
      signature: z
        .string()
        .describe(
          "Function signature with types (e.g., 'transfer(address,uint256)')"
        ),
      args: z
        .array(z.string())
        .describe("Function arguments as strings, one per parameter"),
    },
  },
  async ({ signature, args }) =>
    toolResult(await runChop(["calldata", signature, ...args]))
);

server.registerTool(
  "rlp_encode",
  {
    description: "RLP (Recursive Length Prefix) encode data. Used in Ethereum for " +
      "transaction serialization and state trie encoding.",
    inputSchema: {
      data: z.string().describe("Data to RLP encode"),
    },
  },
  async ({ data }) => toolResult(await runChop(["to-rlp", data]))
);

server.registerTool(
  "rlp_decode",
  {
    description: "Decode RLP-encoded data back to its original form.",
    inputSchema: {
      data: z.string().describe("RLP-encoded hex data to decode"),
    },
  },
  async ({ data }) => toolResult(await runChop(["from-rlp", data]))
);

// ============================================================
// SELECTOR TOOLS
// ============================================================

server.registerTool(
  "function_selector",
  {
    description:
      "Compute the 4-byte function selector from a Solidity function signature. " +
      "The selector is the first 4 bytes of the keccak256 hash of the signature. " +
      "Example: 'transfer(address,uint256)' -> '0xa9059cbb'",
    inputSchema: {
      signature: z
        .string()
        .describe(
          "Solidity function signature (e.g., 'transfer(address,uint256)')"
        ),
    },
  },
  async ({ signature }) => toolResult(await runChop(["sig", signature]))
);

server.registerTool(
  "event_topic",
  {
    description:
      "Compute the 32-byte event topic hash from a Solidity event signature. " +
      "The topic is the keccak256 hash of the event signature. Used for log filtering. " +
      "Example: 'Transfer(address,address,uint256)' -> '0xddf25...'",
    inputSchema: {
      signature: z
        .string()
        .describe(
          "Solidity event signature (e.g., 'Transfer(address,address,uint256)')"
        ),
    },
  },
  async ({ signature }) =>
    toolResult(await runChop(["sig-event", signature]))
);

// ============================================================
// HEX TOOLS
// ============================================================

server.registerTool(
  "concat_hex",
  {
    description: "Concatenate two hex strings together, handling 0x prefixes correctly.",
    inputSchema: {
      hex1: z.string().describe("First hex string"),
      hex2: z.string().describe("Second hex string"),
    },
  },
  async ({ hex1, hex2 }) =>
    toolResult(await runChop(["concat-hex", hex1, hex2]))
);

server.registerTool(
  "hex_to_utf8",
  {
    description: "Convert hex-encoded data to its UTF-8 string representation.",
    inputSchema: {
      hex: z.string().describe("Hex data to convert to UTF-8"),
    },
  },
  async ({ hex }) => toolResult(await runChop(["to-utf8", hex]))
);

server.registerTool(
  "utf8_to_hex",
  {
    description: "Convert a UTF-8 string to its hex-encoded representation with 0x prefix.",
    inputSchema: {
      text: z.string().describe("UTF-8 text to convert to hex"),
    },
  },
  async ({ text }) => toolResult(await runChop(["from-utf8", text]))
);

// ============================================================
// ENS TOOLS
// ============================================================

server.registerTool(
  "ens_namehash",
  {
    description:
      "Compute the ENS (Ethereum Name Service) namehash of a domain name. " +
      "Used for ENS resolution and registry lookups. " +
      "Example: 'vitalik.eth' -> '0xee6c4522...'",
    inputSchema: {
      name: z.string().describe("ENS name to hash (e.g., 'vitalik.eth')"),
    },
  },
  async ({ name }) => toolResult(await runChop(["namehash", name]))
);

// ============================================================
// BYTECODE TOOLS
// ============================================================

server.registerTool(
  "disassemble_bytecode",
  {
    description:
      "Disassemble EVM bytecode into human-readable opcodes. " +
      "Useful for analyzing contract bytecode, verifying deployments, " +
      "and understanding compiled contract behavior.",
    inputSchema: {
      bytecode: z
        .string()
        .describe("EVM bytecode to disassemble (hex encoded with 0x prefix)"),
    },
  },
  async ({ bytecode }) =>
    toolResult(await runChop(["disassemble", bytecode]))
);

server.registerTool(
  "extract_selectors",
  {
    description:
      "Extract all 4-byte function selectors from EVM bytecode. " +
      "Useful for identifying which functions a contract implements " +
      "without having the source code or ABI.",
    inputSchema: {
      bytecode: z
        .string()
        .describe("EVM bytecode to extract selectors from (hex encoded)"),
    },
  },
  async ({ bytecode }) =>
    toolResult(await runChop(["selectors", bytecode]))
);

// ============================================================
// UTILITY TOOLS
// ============================================================

server.registerTool(
  "hash_zero",
  {
    description: "Get the 32-byte zero hash (0x0000...0000). Common sentinel value in Ethereum.",
    inputSchema: {},
  },
  async () => toolResult(await runChop(["hash-zero"]))
);

server.registerTool(
  "address_zero",
  {
    description:
      "Get the zero address (0x0000...0000). Used as null/burn address in Ethereum.",
    inputSchema: {},
  },
  async () => toolResult(await runChop(["address-zero"]))
);

server.registerTool(
  "max_uint",
  {
    description:
      "Get the maximum value for an unsigned integer of the given bit width. " +
      "Common values: max_uint(256) for ERC-20 max approval.",
    inputSchema: {
      bits: z
        .number()
        .min(1)
        .max(256)
        .describe("Bit width (1-256, typically 8, 16, 32, 64, 128, or 256)"),
    },
  },
  async ({ bits }) =>
    toolResult(await runChop(["max-uint", bits.toString()]))
);

server.registerTool(
  "max_int",
  {
    description: "Get the maximum value for a signed integer of the given bit width.",
    inputSchema: {
      bits: z
        .number()
        .min(1)
        .max(256)
        .describe("Bit width (1-256)"),
    },
  },
  async ({ bits }) =>
    toolResult(await runChop(["max-int", bits.toString()]))
);

server.registerTool(
  "min_int",
  {
    description: "Get the minimum (most negative) value for a signed integer of the given bit width.",
    inputSchema: {
      bits: z
        .number()
        .min(1)
        .max(256)
        .describe("Bit width (1-256)"),
    },
  },
  async ({ bits }) =>
    toolResult(await runChop(["min-int", bits.toString()]))
);

// ============================================================
// START THE SERVER
// ============================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log to stderr (never stdout for stdio MCP servers)
  console.error("Chop MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
```

### 5.3 Tool Definitions for Chop

Summary of all tools exposed by the MCP server:

| Tool Name              | Chop Command     | Description                                 |
|------------------------|------------------|---------------------------------------------|
| `keccak256`            | `keccak`         | Keccak-256 hash                             |
| `to_hex`               | `to-hex`         | Decimal to hex conversion                   |
| `to_dec`               | `to-dec`         | Hex to decimal conversion                   |
| `to_wei`               | `to-wei`         | Convert to wei                              |
| `from_wei`             | `from-wei`       | Convert from wei                            |
| `to_checksum_address`  | `to-checksum`    | EIP-55 checksum address                     |
| `compute_create_address`| `compute-address`| CREATE address prediction                  |
| `compute_create2_address`| `create2`      | CREATE2 address computation                 |
| `abi_encode`           | `abi-encode`     | ABI encode values                           |
| `abi_decode`           | `abi-decode`     | ABI decode hex data                         |
| `encode_calldata`      | `calldata`       | Full function calldata encoding             |
| `rlp_encode`           | `to-rlp`         | RLP encode data                             |
| `rlp_decode`           | `from-rlp`       | RLP decode data                             |
| `function_selector`    | `sig`            | 4-byte function selector                    |
| `event_topic`          | `sig-event`      | 32-byte event topic                         |
| `concat_hex`           | `concat-hex`     | Concatenate hex strings                     |
| `hex_to_utf8`          | `to-utf8`        | Hex to UTF-8 string                         |
| `utf8_to_hex`          | `from-utf8`      | UTF-8 to hex                                |
| `ens_namehash`         | `namehash`       | ENS namehash computation                    |
| `disassemble_bytecode` | `disassemble`    | Disassemble EVM bytecode                    |
| `extract_selectors`    | `selectors`      | Extract selectors from bytecode             |
| `hash_zero`            | `hash-zero`      | Zero hash constant                          |
| `address_zero`         | `address-zero`   | Zero address constant                       |
| `max_uint`             | `max-uint`       | Max unsigned int for bit width              |
| `max_int`              | `max-int`        | Max signed int for bit width                |
| `min_int`              | `min-int`        | Min signed int for bit width                |

---

## 6. Tool Design Best Practices

### 6.1 Descriptions That AI Agents Understand

Good tool descriptions should:

1. **State the purpose clearly in the first sentence**: "Compute the Keccak-256 hash
   of input data."
2. **Explain when to use it**: "Used for Ethereum function selectors, event topics,
   storage slot computation."
3. **Give concrete examples**: "Example: 'transfer(address,uint256)' -> '0xa9059cbb'"
4. **Mention related tools**: When tools chain together, mention the workflow.

Bad description: "Keccak hash function"
Good description: "Compute the Keccak-256 hash of input data. Used for Ethereum
function selectors, event topics, storage slot computation, and general hashing.
Input can be a UTF-8 string or hex-encoded bytes (with 0x prefix)."

### 6.2 Parameter Design

- Use descriptive parameter names: `deployer` not `addr`, `signature` not `sig`
- Include format hints in descriptions: "Hex encoded with 0x prefix"
- Use enums when possible: `unit: "ether" | "gwei" | "wei"`
- Make types as specific as possible: use `z.number().min(1).max(256)` not `z.string()`

### 6.3 Tool Chaining Patterns

AI agents often need to chain multiple operations. Design tool descriptions to
suggest common workflows:

**Deploy + Verify Pattern:**
1. `compute_create_address` or `compute_create2_address` to predict the address
2. `disassemble_bytecode` to verify the deployed bytecode
3. `extract_selectors` to confirm the ABI

**Contract Interaction Pattern:**
1. `function_selector` to get the selector
2. `abi_encode` to encode the arguments
3. Or just `encode_calldata` for the complete calldata

**Unit Conversion Pattern:**
1. `to_wei` to convert human-readable amounts to wei
2. `from_wei` to convert back for display
3. `to_hex`/`to_dec` for format conversion

### 6.4 Error Handling for AI Tools

- Return clear, actionable error messages
- Include the expected format in error messages: "Invalid address format. Expected
  40 hex characters with optional 0x prefix."
- Never return stack traces or internal errors to the AI
- Use the `isError: true` flag in MCP responses so the AI knows to retry or report

### 6.5 Blockchain-Specific Considerations

- **Addresses**: Always validate and checksum addresses in responses
- **Hex data**: Always include 0x prefix for clarity
- **Large numbers**: Wei values can be very large; use string representation
- **Gas estimation**: If adding gas tools, note that estimates are just estimates
- **Network-specific**: Document when a tool is network-agnostic vs network-specific
- **Deterministic operations**: Chop's tools are all offline/deterministic, which is
  ideal for AI tools (no network latency, no rate limits, no authentication)

### 6.6 What Should Be an AI Tool vs Interactive TUI

**Good as AI tools** (programmatic, deterministic, composable):
- All of Chop's current CLI commands
- ABI encoding/decoding
- Address computation
- Keccak hashing
- Unit conversions
- Bytecode disassembly

**Better as interactive TUI** (requires visual feedback, exploration):
- Block explorer / transaction browser
- Contract state inspection with live data
- Debugging with step-through execution
- Dashboard views with real-time data
- Settings configuration

**Hybrid approach**: The MCP server exposes the programmatic tools. The TUI handles
visual/interactive workflows. The AI agent can suggest launching the TUI when
appropriate: "For detailed contract inspection, run `chop tui`."

---

## 7. Chop-Specific Recommendations

### 7.1 Recommended File Structure

```
chop/
  .mcp.json                                # Project-scoped MCP config
  AGENTS.md                                # Universal agent instructions
  .claude/
    skills/
      eth-address/SKILL.md                 # Address utilities skill
      eth-abi/SKILL.md                     # ABI encoding skill
      eth-units/SKILL.md                   # Unit conversion skill
      eth-bytecode/SKILL.md                # Bytecode analysis skill
      eth-crypto/SKILL.md                  # Hashing and selectors skill
    commands/
      commit.md                            # (existing)
      crash-bisection.md                   # (existing)
  chop-mcp-server/                         # MCP server package
    package.json
    tsconfig.json
    src/
      index.ts                             # Main MCP server
```

### 7.2 Immediate Steps

1. **Create AGENTS.md** at the project root (works with Codex, Copilot, Cursor, etc.)
2. **Create `.mcp.json`** pointing to a chop MCP server
3. **Create Claude Code Skills** in `.claude/skills/`
4. **Build the MCP server** as a TypeScript npm package

### 7.3 Future Enhancements

Once the basic MCP server works:

1. **Add JSON output mode**: All tools should support `--json` for structured output
   that AI agents can parse more reliably.

2. **Add batch operations**: A `batch` tool that accepts multiple operations in one
   call, reducing round trips.

3. **Add network-connected tools**: If Chop adds RPC capabilities:
   - `eth_call` for reading contract state
   - `get_balance` for checking ETH balance
   - `get_code` for fetching deployed bytecode
   - `get_storage_at` for reading storage slots

4. **MCP Resources**: Expose Ethereum reference data as MCP resources:
   - Common contract addresses (WETH, Uniswap Router, etc.)
   - Standard ABIs (ERC-20, ERC-721, etc.)
   - Gas price constants

5. **MCP Prompts**: Pre-built prompts for common workflows:
   - "Deploy and verify a contract"
   - "Decode a transaction"
   - "Analyze contract bytecode"

### 7.4 Existing Claude Code Configuration

The project already has Claude Code configuration at:

- `/Users/williamcory/chop/.claude/settings.local.json` - Permission settings
- `/Users/williamcory/chop/.claude/commands/commit.md` - Commit workflow skill
- `/Users/williamcory/chop/.claude/commands/crash-bisection.md` - Debug skill

The existing commands demonstrate good skill design: they have proper frontmatter
with `allowed-tools`, `argument-hint`, `description`, and `model` fields. The new
Ethereum-specific skills should follow the same pattern.

---

## 8. Implementation Plan

### Phase 1: Universal Discovery (1-2 hours)

- [ ] Create `AGENTS.md` at project root with all commands documented
- [ ] Create `.mcp.json` stub pointing to future MCP server

### Phase 2: Claude Code Skills (2-3 hours)

- [ ] Create `.claude/skills/eth-address/SKILL.md`
- [ ] Create `.claude/skills/eth-abi/SKILL.md`
- [ ] Create `.claude/skills/eth-units/SKILL.md`
- [ ] Create `.claude/skills/eth-bytecode/SKILL.md`
- [ ] Create `.claude/skills/eth-crypto/SKILL.md`

### Phase 3: MCP Server (4-6 hours)

- [ ] Initialize `chop-mcp-server` npm package
- [ ] Implement all 26 tools wrapping Chop CLI commands
- [ ] Add comprehensive tool descriptions with examples
- [ ] Test with Claude Code (`claude mcp add --transport stdio chop -- node build/index.js`)
- [ ] Test with Codex CLI (`codex mcp add chop -- node build/index.js`)
- [ ] Publish to npm as `chop-mcp-server`

### Phase 4: Distribution (2-3 hours)

- [ ] Publish MCP server to npm
- [ ] Create Claude Code plugin with bundled MCP server
- [ ] Submit to skills.sh for Agent Skills registry
- [ ] Add installation instructions to README
- [ ] Add to Anthropic MCP registry (if applicable)

### Phase 5: Enhancement (ongoing)

- [ ] Add JSON output mode to all Chop CLI commands
- [ ] Add batch operation support
- [ ] Add network-connected tools (RPC calls)
- [ ] Add MCP Resources (standard ABIs, common addresses)
- [ ] Add MCP Prompts (common workflows)
- [ ] Consider native Zig MCP server for performance

---

## 9. Sources

### Claude Code Documentation
- [Connect Claude Code to tools via MCP](https://code.claude.com/docs/en/mcp)
- [Extend Claude with skills](https://code.claude.com/docs/en/skills)
- [Claude Code MCP Integration Deep Dive](https://claudecode.io/guides/mcp-integration)
- [Configuring MCP Tools in Claude Code](https://scottspence.com/posts/configuring-mcp-tools-in-claude-code)
- [Custom Tools - Claude API Docs](https://platform.claude.com/docs/en/agent-sdk/custom-tools)

### OpenAI Codex Documentation
- [Codex CLI](https://developers.openai.com/codex/cli/)
- [Codex CLI Features](https://developers.openai.com/codex/cli/features/)
- [Codex MCP Support](https://developers.openai.com/codex/mcp/)
- [Codex Configuration Reference](https://developers.openai.com/codex/config-reference/)
- [Use Codex with the Agents SDK](https://developers.openai.com/codex/guides/agents-sdk/)
- [Custom Instructions with AGENTS.md](https://developers.openai.com/codex/guides/agents-md/)

### MCP Protocol
- [MCP Specification (2025-11-25)](https://modelcontextprotocol.io/specification/2025-11-25)
- [Build an MCP Server](https://modelcontextprotocol.io/docs/develop/build-server)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Server Implementations](https://github.com/modelcontextprotocol/servers)

### Agent Skills Standard
- [Agent Skills Specification](https://agentskills.io/specification)
- [AGENTS.md Specification](https://agents.md/)
- [Agent Skills GitHub](https://github.com/agentskills/agentskills)
- [Anthropic Skills Repository](https://github.com/anthropics/skills/blob/main/spec/agent-skills-spec.md)

### AI Agent Tool Design
- [AI Agents on Ethereum - ethereum.org](https://ethereum.org/ai-agents/)
- [Advanced Tool Use - Anthropic Engineering](https://www.anthropic.com/engineering/advanced-tool-use)
- [MCP Tool Search - Context Pollution Guide](https://www.atcyrus.com/stories/mcp-tool-search-claude-code-context-pollution-guide)
- [Claude Code as MCP Server](https://github.com/steipete/claude-code-mcp)

### Community Resources
- [Awesome Claude Code](https://github.com/hesreallyhim/awesome-claude-code)
- [Understanding Claude Code Full Stack](https://alexop.dev/posts/understanding-claude-code-full-stack/)
- [Claude Code Customization Guide](https://alexop.dev/posts/claude-code-customization-guide-claudemd-skills-subagents/)
- [Building Consistent Workflows with Codex CLI and Agents SDK](https://cookbook.openai.com/examples/codex/codex_mcp_agents_sdk/building_consistent_workflows_codex_cli_agents_sdk)
