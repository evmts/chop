/**
 * MCP tool registrations for chain/block/transaction queries.
 *
 * Tools:
 * - eth_blockNumber: Get the latest block number
 * - eth_chainId: Get the chain ID
 * - eth_getBlockByNumber: Get a block by its number
 * - eth_getTransactionByHash: Look up a transaction by hash
 * - eth_getTransactionReceipt: Get the receipt for a mined transaction
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import {
	blockNumberHandler,
	chainIdHandler,
	getBlockByNumberHandler,
	getTransactionByHashHandler,
	getTransactionReceiptHandler,
} from "../../handlers/index.js"
import type { McpRuntime } from "../runtime.js"
import { bigintReplacer, toolError, toolResult } from "../runtime.js"

export const registerChainTools = (server: McpServer, runtime: McpRuntime): void => {
	server.registerTool(
		"eth_blockNumber",
		{
			title: "eth_blockNumber",
			description:
				"Get the current (latest) block number of the local EVM node. " +
				"Returns the block number as a hex string. " +
				"No parameters required.",
			inputSchema: {},
		},
		async () => {
			try {
				const result = await runtime.runWithNode((node) => blockNumberHandler(node)())
				return toolResult(`0x${result.toString(16)}`)
			} catch (e) {
				return toolError((e as Error).message)
			}
		},
	)

	server.registerTool(
		"eth_chainId",
		{
			title: "eth_chainId",
			description:
				"Get the chain ID of the local EVM node. " +
				"Returns the chain ID as a hex string. " +
				"No parameters required.",
			inputSchema: {},
		},
		async () => {
			try {
				const result = await runtime.runWithNode((node) => chainIdHandler(node)())
				return toolResult(`0x${result.toString(16)}`)
			} catch (e) {
				return toolError((e as Error).message)
			}
		},
	)

	server.registerTool(
		"eth_getBlockByNumber",
		{
			title: "eth_getBlockByNumber",
			description:
				"Get a block by its block number. " +
				"Returns block details including hash, timestamp, gasLimit, gasUsed, baseFeePerGas, and optionally full transactions. " +
				'Pass the block number as a decimal string (e.g. "42"), hex string (e.g. "0x2a"), or a tag like "latest", "earliest", "pending". ' +
				"Returns null if the block does not exist.",
			inputSchema: {
				block_number: z
					.string()
					.describe('Block number as a decimal string, hex string, or tag ("latest", "earliest", "pending").'),
			},
		},
		async ({ block_number }) => {
			try {
				const result = await runtime.runWithNode((node) =>
					getBlockByNumberHandler(node)({ blockTag: block_number, includeFullTxs: false }),
				)
				if (result === null) {
					return toolResult("null")
				}
				return toolResult(JSON.stringify(result, bigintReplacer, 2))
			} catch (e) {
				return toolError((e as Error).message)
			}
		},
	)

	server.registerTool(
		"eth_getTransactionByHash",
		{
			title: "eth_getTransactionByHash",
			description:
				"Look up a transaction by its hash. " +
				"Returns the full transaction object including from, to, value, input data, gas, nonce, etc. " +
				"Returns null if the transaction is not found. " +
				"Example: eth_getTransactionByHash({ hash: '0xabc123...' }).",
			inputSchema: {
				hash: z.string().describe("Transaction hash (0x-prefixed, 32 bytes)."),
			},
		},
		async ({ hash }) => {
			try {
				const result = await runtime.runWithNode((node) => getTransactionByHashHandler(node)({ hash }))
				if (result === null) {
					return toolResult("null")
				}
				return toolResult(JSON.stringify(result, bigintReplacer, 2))
			} catch (e) {
				return toolError((e as Error).message)
			}
		},
	)

	server.registerTool(
		"eth_getTransactionReceipt",
		{
			title: "eth_getTransactionReceipt",
			description:
				"Get the receipt of a mined transaction by its hash. " +
				"Returns status, gasUsed, logs, contractAddress (if deployment), blockNumber, etc. " +
				"Returns null if the transaction has not been mined or does not exist. " +
				"Example: eth_getTransactionReceipt({ hash: '0xabc123...' }).",
			inputSchema: {
				hash: z.string().describe("Transaction hash (0x-prefixed, 32 bytes)."),
			},
		},
		async ({ hash }) => {
			try {
				const result = await runtime.runWithNode((node) => getTransactionReceiptHandler(node)({ hash }))
				if (result === null) {
					return toolResult("null")
				}
				return toolResult(JSON.stringify(result, bigintReplacer, 2))
			} catch (e) {
				return toolError((e as Error).message)
			}
		},
	)
}
