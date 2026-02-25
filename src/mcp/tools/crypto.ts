/**
 * MCP tool registrations for cryptographic operations.
 *
 * Tools:
 * - keccak256: Compute keccak256 hash of data
 * - function_selector: Compute 4-byte function selector from signature
 * - event_topic: Compute 32-byte event topic from event signature
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { keccakHandler, sigEventHandler, sigHandler } from "../../cli/commands/crypto.js"
import type { McpRuntime } from "../runtime.js"
import { toolError, toolResult } from "../runtime.js"

export const registerCryptoTools = (server: McpServer, runtime: McpRuntime): void => {
	server.registerTool(
		"keccak256",
		{
			title: "Keccak-256 Hash",
			description:
				"Compute the keccak256 hash of input data (returns full 32-byte hash). " +
				"If the input starts with '0x', it is treated as raw hex bytes. " +
				"Otherwise it is treated as a UTF-8 string. " +
				"Example: keccak256('hello') or keccak256('0xdeadbeef').",
			inputSchema: {
				data: z.string().describe("Data to hash. Hex with 0x prefix is treated as raw bytes; otherwise UTF-8 string."),
			},
		},
		async ({ data }) => {
			try {
				const result = await runtime.runPure(keccakHandler(data))
				return toolResult(result)
			} catch (e) {
				return toolError((e as Error).message)
			}
		},
	)

	server.registerTool(
		"function_selector",
		{
			title: "Function Selector",
			description:
				"Compute the 4-byte function selector from a Solidity function signature. " +
				"Takes the first 4 bytes of the keccak256 hash of the canonical signature. " +
				"Example: function_selector('transfer(address,uint256)') returns '0xa9059cbb'.",
			inputSchema: {
				signature: z
					.string()
					.describe("Solidity function signature, e.g. 'transfer(address,uint256)' or 'balanceOf(address)'."),
			},
		},
		async ({ signature }) => {
			try {
				const result = await runtime.runPure(sigHandler(signature))
				return toolResult(result)
			} catch (e) {
				return toolError((e as Error).message)
			}
		},
	)

	server.registerTool(
		"event_topic",
		{
			title: "Event Topic",
			description:
				"Compute the 32-byte event topic (full keccak256 hash) from a Solidity event signature. " +
				"This is the topic0 value used in EVM log entries. " +
				"Example: event_topic('Transfer(address,address,uint256)') returns the Transfer event topic hash.",
			inputSchema: {
				signature: z
					.string()
					.describe(
						"Solidity event signature, e.g. 'Transfer(address,address,uint256)' or 'Approval(address,address,uint256)'.",
					),
			},
		},
		async ({ signature }) => {
			try {
				const result = await runtime.runPure(sigEventHandler(signature))
				return toolResult(result)
			} catch (e) {
				return toolError((e as Error).message)
			}
		},
	)
}
