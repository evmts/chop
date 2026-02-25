/**
 * MCP tool registrations for EVM bytecode analysis operations.
 *
 * Tools:
 * - disassemble: Disassemble EVM bytecode into opcode listing
 * - four_byte: Look up 4-byte function selector from openchain.xyz signature database
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { disassembleHandler, fourByteHandler } from "../../cli/commands/bytecode.js"
import type { McpRuntime } from "../runtime.js"
import { toolError, toolResult } from "../runtime.js"

export const registerBytecodeTools = (server: McpServer, runtime: McpRuntime): void => {
	server.registerTool(
		"disassemble",
		{
			title: "Disassemble EVM Bytecode",
			description:
				"Disassemble EVM bytecode into a human-readable opcode listing with program counter offsets. " +
				"Handles all standard EVM opcodes including PUSH1-PUSH32 with their immediate data. " +
				"Unknown opcodes are shown as UNKNOWN(0xNN). " +
				"Example: disassemble('0x6060604052') returns the disassembled instructions with PC offsets.",
			inputSchema: {
				bytecode: z.string().describe("EVM bytecode as a hex string (must start with 0x prefix)."),
			},
		},
		async ({ bytecode }) => {
			try {
				const instructions = await runtime.runPure(disassembleHandler(bytecode))
				const lines = instructions.map(
					({ pc, name, pushData }) => `${pc.toString(16).padStart(4, "0")}  ${name}${pushData ? ` ${pushData}` : ""}`,
				)
				return toolResult(lines.join("\n"))
			} catch (e) {
				return toolError((e as Error).message)
			}
		},
	)

	server.registerTool(
		"four_byte",
		{
			title: "4-Byte Selector Lookup",
			description:
				"Look up a 4-byte function selector in the openchain.xyz signature database. " +
				"Returns matching function signatures from known contracts. " +
				"Useful for identifying unknown function calls in transaction data or bytecode. " +
				"Example: four_byte('0xa9059cbb') returns 'transfer(address,uint256)'.",
			inputSchema: {
				selector: z
					.string()
					.describe("4-byte function selector as hex (0x-prefixed, exactly 8 hex characters, e.g. '0xa9059cbb')."),
			},
		},
		async ({ selector }) => {
			try {
				const signatures = await runtime.runPure(fourByteHandler(selector))
				return toolResult(signatures.join("\n"))
			} catch (e) {
				return toolError((e as Error).message)
			}
		},
	)
}
