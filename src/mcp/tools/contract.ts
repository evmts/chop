/**
 * MCP tool registrations for contract/state interaction.
 *
 * Tools:
 * - eth_call: Execute a read-only call against a contract
 * - eth_getBalance: Get the ETH balance of an address
 * - eth_getCode: Get the deployed bytecode at an address
 * - eth_getStorageAt: Read a raw storage slot of a contract
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { Hex } from "voltaire-effect"
import { z } from "zod"
import type { CallParams } from "../../handlers/index.js"
import { callHandler, getBalanceHandler, getCodeHandler, getStorageAtHandler } from "../../handlers/index.js"
import type { McpRuntime } from "../runtime.js"
import { toolError, toolResult } from "../runtime.js"

export const registerContractTools = (server: McpServer, runtime: McpRuntime): void => {
	server.registerTool(
		"eth_call",
		{
			title: "eth_call",
			description:
				"Execute a read-only EVM call against the current state (does not create a transaction). " +
				"Use this to call view/pure functions on contracts, simulate transactions, or read contract state. " +
				"Returns the raw output bytes, success status, and gas used. " +
				"Example: eth_call({ to: '0xContractAddr', data: '0x70a08231...' }) to call balanceOf.",
			inputSchema: {
				to: z
					.string()
					.optional()
					.describe("Target contract address (0x-prefixed). Omit for contract creation simulation."),
				from: z.string().optional().describe("Sender address (0x-prefixed). Defaults to zero address if omitted."),
				data: z.string().optional().describe("ABI-encoded calldata (0x-prefixed hex string)."),
				value: z
					.string()
					.optional()
					.describe(
						"Wei value to send as a decimal or hex string (e.g. '1000000000000000000' or '0xde0b6b3a7640000').",
					),
				gas: z
					.string()
					.optional()
					.describe("Gas limit as a decimal or hex string. Defaults to block gas limit if omitted."),
			},
		},
		async ({ to, from, data, value, gas }) => {
			try {
				const params: CallParams = {
					...(to !== undefined ? { to } : {}),
					...(from !== undefined ? { from } : {}),
					...(data !== undefined ? { data } : {}),
					...(value !== undefined ? { value: BigInt(value) } : {}),
					...(gas !== undefined ? { gas: BigInt(gas) } : {}),
				}

				const result = await runtime.runWithNode((node) => callHandler(node)(params))
				return toolResult(
					JSON.stringify({
						success: result.success,
						output: Hex.fromBytes(result.output),
						gasUsed: result.gasUsed.toString(),
					}),
				)
			} catch (e) {
				return toolError((e as Error).message)
			}
		},
	)

	server.registerTool(
		"eth_getBalance",
		{
			title: "eth_getBalance",
			description:
				"Get the ETH balance of an address in wei. " +
				"Returns the balance as a hex string. " +
				"Example: eth_getBalance({ address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' }).",
			inputSchema: {
				address: z.string().describe("The address to query (0x-prefixed, 20 bytes)."),
			},
		},
		async ({ address }) => {
			try {
				const result = await runtime.runWithNode((node) => getBalanceHandler(node)({ address }))
				const hex = `0x${result.toString(16)}`
				return toolResult(`${hex} (${result.toString()} wei)`)
			} catch (e) {
				return toolError((e as Error).message)
			}
		},
	)

	server.registerTool(
		"eth_getCode",
		{
			title: "eth_getCode",
			description:
				"Get the deployed bytecode at a given address. " +
				"Returns '0x' if the address is an EOA (externally owned account) with no code. " +
				"Example: eth_getCode({ address: '0xContractAddress' }).",
			inputSchema: {
				address: z.string().describe("The address to query (0x-prefixed, 20 bytes)."),
			},
		},
		async ({ address }) => {
			try {
				const result = await runtime.runWithNode((node) => getCodeHandler(node)({ address }))
				return toolResult(Hex.fromBytes(result))
			} catch (e) {
				return toolError((e as Error).message)
			}
		},
	)

	server.registerTool(
		"eth_getStorageAt",
		{
			title: "eth_getStorageAt",
			description:
				"Read a raw 32-byte storage slot from a contract. " +
				"Returns the value stored at the given slot as a hex string. " +
				"Useful for inspecting contract state directly. " +
				"Example: eth_getStorageAt({ address: '0xContract', slot: '0x0' }) to read slot 0.",
			inputSchema: {
				address: z.string().describe("The contract address to query (0x-prefixed, 20 bytes)."),
				slot: z.string().describe("The storage slot to read (0x-prefixed hex, 32 bytes)."),
			},
		},
		async ({ address, slot }) => {
			try {
				const result = await runtime.runWithNode((node) => getStorageAtHandler(node)({ address, slot }))
				return toolResult(`0x${result.toString(16)}`)
			} catch (e) {
				return toolError((e as Error).message)
			}
		},
	)
}
