/**
 * MCP tool registrations for data conversion operations.
 *
 * Tools:
 * - from_wei: Convert wei to ether (or specified unit)
 * - to_wei: Convert ether (or specified unit) to wei
 * - to_hex: Convert decimal to hexadecimal
 * - to_dec: Convert hexadecimal to decimal
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { fromWeiHandler, toDecHandler, toHexHandler, toWeiHandler } from "../../cli/commands/convert.js"
import type { McpRuntime } from "../runtime.js"
import { toolError, toolResult } from "../runtime.js"

export const registerConvertTools = (server: McpServer, runtime: McpRuntime): void => {
	server.registerTool(
		"from_wei",
		{
			title: "From Wei",
			description:
				"Convert a value in wei to ether or another denomination. " +
				"Uses pure BigInt arithmetic to avoid floating-point precision issues. " +
				"Supported units: wei, kwei, mwei, gwei, szabo, finney, ether. " +
				"Example: from_wei('1000000000000000000') returns '1.000000000000000000' (1 ether).",
			inputSchema: {
				amount: z.string().describe("Amount in wei as a decimal integer string."),
				unit: z
					.string()
					.default("ether")
					.describe("Target unit to convert to. One of: wei, kwei, mwei, gwei, szabo, finney, ether. Default: ether."),
			},
		},
		async ({ amount, unit }) => {
			try {
				const result = await runtime.runPure(fromWeiHandler(amount, unit))
				return toolResult(result)
			} catch (e) {
				return toolError((e as Error).message)
			}
		},
	)

	server.registerTool(
		"to_wei",
		{
			title: "To Wei",
			description:
				"Convert a value in ether (or another denomination) to wei. " +
				"Uses pure BigInt arithmetic to avoid floating-point precision issues. " +
				"Supported units: wei, kwei, mwei, gwei, szabo, finney, ether. " +
				"Example: to_wei('1.5') returns '1500000000000000000'.",
			inputSchema: {
				amount: z.string().describe("Amount in ether (or specified unit) as a decimal string. Can include decimals."),
				unit: z
					.string()
					.default("ether")
					.describe(
						"Source unit to convert from. One of: wei, kwei, mwei, gwei, szabo, finney, ether. Default: ether.",
					),
			},
		},
		async ({ amount, unit }) => {
			try {
				const result = await runtime.runPure(toWeiHandler(amount, unit))
				return toolResult(result)
			} catch (e) {
				return toolError((e as Error).message)
			}
		},
	)

	server.registerTool(
		"to_hex",
		{
			title: "Decimal to Hex",
			description:
				"Convert a decimal integer string to its hexadecimal representation. " +
				"Supports arbitrarily large integers via BigInt. Returns 0x-prefixed hex. " +
				"Example: to_hex('255') returns '0xff'.",
			inputSchema: {
				value: z.string().describe("Decimal integer string to convert to hexadecimal."),
			},
		},
		async ({ value }) => {
			try {
				const result = await runtime.runPure(toHexHandler(value))
				return toolResult(result)
			} catch (e) {
				return toolError((e as Error).message)
			}
		},
	)

	server.registerTool(
		"to_dec",
		{
			title: "Hex to Decimal",
			description:
				"Convert a hexadecimal value to its decimal representation. " +
				"Input must have a 0x prefix. Supports arbitrarily large values via BigInt. " +
				"Example: to_dec('0xff') returns '255'.",
			inputSchema: {
				value: z.string().describe("Hexadecimal value to convert (must start with 0x prefix)."),
			},
		},
		async ({ value }) => {
			try {
				const result = await runtime.runPure(toDecHandler(value))
				return toolResult(result)
			} catch (e) {
				return toolError((e as Error).message)
			}
		},
	)
}
