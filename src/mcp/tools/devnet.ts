/**
 * MCP tool registrations for devnet/testing operations.
 *
 * Tools:
 * - anvil_mine: Mine one or more blocks
 * - evm_snapshot: Take a snapshot of the current EVM state
 * - evm_revert: Revert to a previous snapshot
 * - anvil_setBalance: Set the ETH balance of an address
 * - anvil_setCode: Set the bytecode at an address
 * - anvil_setNonce: Set the nonce of an address
 * - anvil_setStorageAt: Set a raw storage slot value
 * - eth_accounts: List pre-funded test accounts
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import {
	getAccountsHandler,
	mineHandler,
	revertHandler,
	setBalanceHandler,
	setCodeHandler,
	setNonceHandler,
	setStorageAtHandler,
	snapshotHandler,
} from "../../handlers/index.js"
import type { McpRuntime } from "../runtime.js"
import { toolError, toolResult } from "../runtime.js"

export const registerDevnetTools = (server: McpServer, runtime: McpRuntime): void => {
	server.registerTool(
		"anvil_mine",
		{
			title: "Mine Blocks",
			description:
				"Mine one or more blocks on the local devnet. " +
				"Advances the blockchain state by the specified number of blocks. " +
				"Defaults to 1 block if not specified. " +
				"Example: anvil_mine({ blocks: 5 }) to mine 5 blocks.",
			inputSchema: {
				blocks: z.number().default(1).describe("Number of blocks to mine. Defaults to 1."),
			},
		},
		async ({ blocks }) => {
			try {
				const result = await runtime.runWithNode((node) => mineHandler(node)({ blockCount: blocks }))
				return toolResult(`Mined ${result.length} block(s)`)
			} catch (e) {
				return toolError((e as Error).message)
			}
		},
	)

	server.registerTool(
		"evm_snapshot",
		{
			title: "EVM Snapshot",
			description:
				"Take a snapshot of the current EVM state. " +
				"Returns a snapshot ID that can later be used with evm_revert to restore this state. " +
				"Useful for test setup/teardown or exploratory state manipulation. " +
				"No parameters required.",
			inputSchema: {},
		},
		async () => {
			try {
				const result = await runtime.runWithNode((node) => snapshotHandler(node)())
				return toolResult(`Snapshot ID: ${result}`)
			} catch (e) {
				return toolError((e as Error).message)
			}
		},
	)

	server.registerTool(
		"evm_revert",
		{
			title: "EVM Revert",
			description:
				"Revert the EVM state to a previously taken snapshot. " +
				"Restores all state (balances, storage, code, nonces) to the point when the snapshot was taken. " +
				"The snapshot is consumed after reverting. " +
				"Example: evm_revert({ id: '1' }).",
			inputSchema: {
				id: z.string().describe("Snapshot ID (numeric string) returned by a previous evm_snapshot call."),
			},
		},
		async ({ id }) => {
			try {
				const snapshotId = Number(id)
				const result = await runtime.runWithNode((node) => revertHandler(node)(snapshotId))
				return toolResult(`Reverted: ${result}`)
			} catch (e) {
				return toolError((e as Error).message)
			}
		},
	)

	server.registerTool(
		"anvil_setBalance",
		{
			title: "Set Balance",
			description:
				"Set the ETH balance of any address on the local devnet. " +
				"Useful for funding test accounts or simulating whale addresses. " +
				"The balance is specified in wei as a decimal or hex string. " +
				"Example: anvil_setBalance({ address: '0x...', balance: '1000000000000000000' }) sets 1 ETH.",
			inputSchema: {
				address: z.string().describe("The address to set the balance for (0x-prefixed, 20 bytes)."),
				balance: z
					.string()
					.describe(
						"New balance in wei as a decimal or hex string (e.g. '1000000000000000000' for 1 ETH or '0xde0b6b3a7640000').",
					),
			},
		},
		async ({ address, balance }) => {
			try {
				const balanceBigInt = BigInt(balance)
				await runtime.runWithNode((node) => setBalanceHandler(node)({ address, balance: balanceBigInt }))
				return toolResult(`Balance set for ${address}`)
			} catch (e) {
				return toolError((e as Error).message)
			}
		},
	)

	server.registerTool(
		"anvil_setCode",
		{
			title: "Set Code",
			description:
				"Set the bytecode at a given address on the local devnet. " +
				"Useful for deploying contracts at specific addresses or replacing contract logic. " +
				"Example: anvil_setCode({ address: '0x...', code: '0x6080604052...' }).",
			inputSchema: {
				address: z.string().describe("The address to set the code at (0x-prefixed, 20 bytes)."),
				code: z.string().describe("The bytecode to set (0x-prefixed hex string)."),
			},
		},
		async ({ address, code }) => {
			try {
				await runtime.runWithNode((node) => setCodeHandler(node)({ address, code }))
				return toolResult(`Code set for ${address}`)
			} catch (e) {
				return toolError((e as Error).message)
			}
		},
	)

	server.registerTool(
		"anvil_setNonce",
		{
			title: "Set Nonce",
			description:
				"Set the transaction nonce for an address on the local devnet. " +
				"Useful for testing transaction ordering or simulating specific account states. " +
				"Example: anvil_setNonce({ address: '0x...', nonce: '5' }).",
			inputSchema: {
				address: z.string().describe("The address to set the nonce for (0x-prefixed, 20 bytes)."),
				nonce: z.string().describe("The nonce value as a decimal or hex string."),
			},
		},
		async ({ address, nonce }) => {
			try {
				const nonceBigInt = BigInt(nonce)
				await runtime.runWithNode((node) => setNonceHandler(node)({ address, nonce: nonceBigInt }))
				return toolResult(`Nonce set for ${address}`)
			} catch (e) {
				return toolError((e as Error).message)
			}
		},
	)

	server.registerTool(
		"anvil_setStorageAt",
		{
			title: "Set Storage At",
			description:
				"Set a raw 32-byte storage slot value on a contract at the local devnet. " +
				"Useful for manipulating contract state directly for testing. " +
				"Example: anvil_setStorageAt({ address: '0x...', slot: '0x0', value: '0x01' }).",
			inputSchema: {
				address: z.string().describe("The contract address (0x-prefixed, 20 bytes)."),
				slot: z.string().describe("The storage slot to write (0x-prefixed hex, 32 bytes)."),
				value: z.string().describe("The value to store (0x-prefixed hex, 32 bytes)."),
			},
		},
		async ({ address, slot, value }) => {
			try {
				await runtime.runWithNode((node) => setStorageAtHandler(node)({ address, slot, value }))
				return toolResult(`Storage set for ${address} at slot ${slot}`)
			} catch (e) {
				return toolError((e as Error).message)
			}
		},
	)

	server.registerTool(
		"eth_accounts",
		{
			title: "List Accounts",
			description:
				"List the pre-funded test accounts available on the local devnet. " +
				"Returns an array of addresses that can be used as signers for transactions. " +
				"No parameters required.",
			inputSchema: {},
		},
		async () => {
			try {
				const result = await runtime.runWithNode((node) => getAccountsHandler(node)())
				return toolResult(JSON.stringify(result))
			} catch (e) {
				return toolError((e as Error).message)
			}
		},
	)
}
