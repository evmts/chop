// MCP prompts — pre-configured workflow templates for common EVM analysis tasks.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

/**
 * Register all MCP prompts for guided EVM workflows.
 */
export const registerPrompts = (server: McpServer): void => {
	server.registerPrompt(
		"analyze-contract",
		{
			description:
				"Analyze a deployed smart contract by examining its bytecode, disassembly, and storage. " +
				"Guides the AI to use eth_getCode, disassemble, and eth_getStorageAt tools to understand contract behavior.",
			argsSchema: {
				address: z.string().describe("The contract address to analyze (0x-prefixed, 20 bytes)."),
			},
		},
		async ({ address }) => ({
			messages: [
				{
					role: "assistant",
					content: {
						type: "text",
						text:
							"I'll help you analyze the smart contract. I'll use these tools:\n" +
							"1. eth_getCode - to retrieve the deployed bytecode\n" +
							"2. disassemble - to convert bytecode into readable EVM opcodes\n" +
							"3. eth_getStorageAt - to inspect contract storage slots\n\n" +
							"This will reveal the contract's structure, functions, and state.",
					},
				},
				{
					role: "user",
					content: {
						type: "text",
						text: `Analyze the contract at ${address}`,
					},
				},
			],
		}),
	)

	server.registerPrompt(
		"debug-tx",
		{
			description:
				"Debug a transaction by examining its details, receipt, and execution trace. " +
				"Guides the AI to use eth_getTransactionByHash, eth_getTransactionReceipt, and eth_call tools.",
			argsSchema: {
				hash: z.string().describe("The transaction hash to debug (0x-prefixed, 32 bytes)."),
			},
		},
		async ({ hash }) => ({
			messages: [
				{
					role: "assistant",
					content: {
						type: "text",
						text:
							"I'll help you debug this transaction. I'll use these tools:\n" +
							"1. eth_getTransactionByHash - to retrieve transaction details (from, to, data, value, gas)\n" +
							"2. eth_getTransactionReceipt - to check execution status, logs, and gas used\n" +
							"3. eth_call - to simulate the transaction call if needed\n\n" +
							"This will help identify why the transaction succeeded, failed, or reverted.",
					},
				},
				{
					role: "user",
					content: {
						type: "text",
						text: `Debug the transaction ${hash}`,
					},
				},
			],
		}),
	)

	server.registerPrompt(
		"inspect-storage",
		{
			description:
				"Inspect specific storage slots of a smart contract to understand its state. " +
				"Guides the AI to use eth_getStorageAt to read raw storage values.",
			argsSchema: {
				address: z.string().describe("The contract address to inspect (0x-prefixed, 20 bytes)."),
				slots: z
					.string()
					.describe("Comma-separated list of storage slot numbers to read (e.g., '0,1,2' or '0x0,0x1,0x2')."),
			},
		},
		async ({ address, slots }) => ({
			messages: [
				{
					role: "assistant",
					content: {
						type: "text",
						text:
							"I'll help you inspect the contract's storage. I'll use:\n" +
							"1. eth_getStorageAt - to read each specified storage slot\n\n" +
							"Storage slots contain the contract's persistent state variables. " +
							"The values will be returned as 32-byte hex strings.",
					},
				},
				{
					role: "user",
					content: {
						type: "text",
						text: `Inspect storage slots ${slots} at contract ${address}`,
					},
				},
			],
		}),
	)

	server.registerPrompt(
		"setup-test-env",
		{
			description:
				"Set up a local devnet testing environment with funded accounts and snapshot capabilities. " +
				"Guides the AI to use eth_accounts, anvil_setBalance, anvil_mine, and evm_snapshot tools.",
		},
		async () => ({
			messages: [
				{
					role: "assistant",
					content: {
						type: "text",
						text:
							"I'll help you set up a test environment on the local devnet. I'll use these tools:\n" +
							"1. eth_accounts - to list available test accounts\n" +
							"2. anvil_setBalance - to fund accounts with test ETH\n" +
							"3. anvil_mine - to mine blocks and advance chain state\n" +
							"4. evm_snapshot - to save chain state for later revert\n\n" +
							"This creates a clean testing environment you can reset as needed.",
					},
				},
				{
					role: "user",
					content: {
						type: "text",
						text: "Set up a test environment on the local devnet",
					},
				},
			],
		}),
	)
}
