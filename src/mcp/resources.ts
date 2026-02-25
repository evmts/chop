/**
 * MCP resource registrations for the chop server.
 *
 * Resources:
 * - chop://account/{address}/balance — ETH balance of an address
 * - chop://account/{address}/storage/{slot} — Storage slot value
 * - chop://block/{numberOrTag} — Block details
 * - chop://tx/{hash} — Transaction details
 * - chop://node/status — Node status (block number, chain ID)
 * - chop://node/accounts — Pre-funded test accounts
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js"
import {
	blockNumberHandler,
	chainIdHandler,
	getAccountsHandler,
	getBalanceHandler,
	getBlockByNumberHandler,
	getStorageAtHandler,
	getTransactionByHashHandler,
} from "../handlers/index.js"
import type { McpRuntime } from "./runtime.js"
import { bigintReplacer } from "./runtime.js"

/** Extract a single string variable from template variables (which may be string | string[] | undefined). */
const v = (val: string | string[] | undefined): string => {
	if (Array.isArray(val)) return val[0] ?? ""
	return val ?? ""
}

export const registerResources = (server: McpServer, runtime: McpRuntime): void => {
	// ---- chop://account/{address}/balance ----
	server.registerResource(
		"Account Balance",
		new ResourceTemplate("chop://account/{address}/balance", { list: undefined }),
		{
			description: "ETH balance of an Ethereum address in wei",
			mimeType: "text/plain",
		},
		async (_uri, vars) => {
			const address = v(vars.address)
			const result = await runtime.runWithNode((node) => getBalanceHandler(node)({ address }))
			const hex = `0x${result.toString(16)}`
			return {
				contents: [
					{
						uri: `chop://account/${address}/balance`,
						text: `${hex} (${result.toString()} wei)`,
						mimeType: "text/plain",
					},
				],
			}
		},
	)

	// ---- chop://account/{address}/storage/{slot} ----
	server.registerResource(
		"Storage Slot",
		new ResourceTemplate("chop://account/{address}/storage/{slot}", { list: undefined }),
		{
			description: "Raw 32-byte storage slot value of a contract",
			mimeType: "text/plain",
		},
		async (_uri, vars) => {
			const address = v(vars.address)
			const slot = v(vars.slot)
			const result = await runtime.runWithNode((node) => getStorageAtHandler(node)({ address, slot }))
			return {
				contents: [
					{
						uri: `chop://account/${address}/storage/${slot}`,
						text: `0x${result.toString(16).padStart(64, "0")}`,
						mimeType: "text/plain",
					},
				],
			}
		},
	)

	// ---- chop://block/{numberOrTag} ----
	server.registerResource(
		"Block",
		new ResourceTemplate("chop://block/{numberOrTag}", { list: undefined }),
		{
			description: "Block details by number or tag (latest, earliest, pending)",
			mimeType: "application/json",
		},
		async (_uri, vars) => {
			const numberOrTag = v(vars.numberOrTag)
			const result = await runtime.runWithNode((node) =>
				getBlockByNumberHandler(node)({ blockTag: numberOrTag, includeFullTxs: false }),
			)
			return {
				contents: [
					{
						uri: `chop://block/${numberOrTag}`,
						text: result === null ? "null" : JSON.stringify(result, bigintReplacer, 2),
						mimeType: "application/json",
					},
				],
			}
		},
	)

	// ---- chop://tx/{hash} ----
	server.registerResource(
		"Transaction",
		new ResourceTemplate("chop://tx/{hash}", { list: undefined }),
		{
			description: "Transaction details by hash",
			mimeType: "application/json",
		},
		async (_uri, vars) => {
			const hash = v(vars.hash)
			const result = await runtime.runWithNode((node) => getTransactionByHashHandler(node)({ hash }))
			return {
				contents: [
					{
						uri: `chop://tx/${hash}`,
						text: result === null ? "null" : JSON.stringify(result, bigintReplacer, 2),
						mimeType: "application/json",
					},
				],
			}
		},
	)

	// ---- chop://node/status (static resource) ----
	server.registerResource(
		"Node Status",
		"chop://node/status",
		{
			description: "Current node status including block number and chain ID",
			mimeType: "application/json",
		},
		async () => {
			const [blockNum, chainId] = await Promise.all([
				runtime.runWithNode((node) => blockNumberHandler(node)()),
				runtime.runWithNode((node) => chainIdHandler(node)()),
			])
			return {
				contents: [
					{
						uri: "chop://node/status",
						text: JSON.stringify(
							{
								blockNumber: `0x${blockNum.toString(16)}`,
								chainId: `0x${chainId.toString(16)}`,
							},
							null,
							2,
						),
						mimeType: "application/json",
					},
				],
			}
		},
	)

	// ---- chop://node/accounts (static resource) ----
	server.registerResource(
		"Node Accounts",
		"chop://node/accounts",
		{
			description: "Pre-funded test accounts available on the local devnet",
			mimeType: "application/json",
		},
		async () => {
			const accounts = await runtime.runWithNode((node) => getAccountsHandler(node)())
			return {
				contents: [
					{
						uri: "chop://node/accounts",
						text: JSON.stringify(accounts, null, 2),
						mimeType: "application/json",
					},
				],
			}
		},
	)
}
