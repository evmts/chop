// MCP server — creates and configures the McpServer with all tools, resources, and prompts.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { VERSION } from "../cli/version.js"
import { registerPrompts } from "./prompts.js"
import { registerResources } from "./resources.js"
import type { McpRuntime } from "./runtime.js"
import { registerAbiTools } from "./tools/abi.js"
import { registerAddressTools } from "./tools/address.js"
import { registerBytecodeTools } from "./tools/bytecode.js"
import { registerChainTools } from "./tools/chain.js"
import { registerContractTools } from "./tools/contract.js"
import { registerConvertTools } from "./tools/convert.js"
import { registerCryptoTools } from "./tools/crypto.js"
import { registerDevnetTools } from "./tools/devnet.js"

/**
 * Create the chop MCP server with all tools, resources, and prompts registered.
 */
export const createServer = (runtime: McpRuntime): McpServer => {
	const server = new McpServer(
		{
			name: "chop",
			version: VERSION,
		},
		{
			instructions:
				"Chop is an Ethereum/EVM development toolkit. " +
				"Use these tools for: hashing (keccak256), ABI encoding/decoding, " +
				"address computation (checksum, CREATE, CREATE2), bytecode analysis, " +
				"unit conversion (wei/ether), and local devnet operations " +
				"(mine blocks, set balances, snapshot/revert state).",
		},
	)

	// Register all tools
	registerCryptoTools(server, runtime)
	registerConvertTools(server, runtime)
	registerAbiTools(server, runtime)
	registerAddressTools(server, runtime)
	registerBytecodeTools(server, runtime)
	registerContractTools(server, runtime)
	registerChainTools(server, runtime)
	registerDevnetTools(server, runtime)

	// Register all resources
	registerResources(server, runtime)

	// Register all prompts
	registerPrompts(server)

	return server
}
