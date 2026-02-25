/**
 * MCP tool registrations for ABI encoding/decoding operations.
 *
 * Tools:
 * - abi_encode: ABI-encode values according to a type signature
 * - abi_decode: Decode ABI-encoded data according to a type signature
 * - encode_calldata: Encode full function calldata (4-byte selector + ABI args)
 * - decode_calldata: Decode function calldata into name and arguments
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { abiDecodeHandler, abiEncodeHandler, calldataDecodeHandler, calldataHandler } from "../../cli/commands/abi.js"
import type { McpRuntime } from "../runtime.js"
import { toolError, toolResult } from "../runtime.js"

export const registerAbiTools = (server: McpServer, runtime: McpRuntime): void => {
	server.registerTool(
		"abi_encode",
		{
			title: "ABI Encode",
			description:
				"ABI-encode values according to Solidity parameter types. " +
				"Takes a type signature (e.g. '(address,uint256)') and matching argument values. " +
				"Returns the encoded data as a hex string without a function selector. " +
				"Example: abi_encode('(address,uint256)', ['0xdead...', '100']) returns the ABI-encoded parameters.",
			inputSchema: {
				signature: z
					.string()
					.describe("Solidity type signature for encoding, e.g. '(address,uint256)' or 'transfer(address,uint256)'."),
				args: z
					.array(z.string())
					.default([])
					.describe(
						"Array of string values to encode, matching the types in the signature. " +
							"Addresses should be 0x-prefixed, integers as decimal strings, booleans as 'true'/'false'.",
					),
			},
		},
		async ({ signature, args }) => {
			try {
				const result = await runtime.runPure(abiEncodeHandler(signature, args, false))
				return toolResult(result)
			} catch (e) {
				return toolError((e as Error).message)
			}
		},
	)

	server.registerTool(
		"abi_decode",
		{
			title: "ABI Decode",
			description:
				"Decode ABI-encoded hex data according to Solidity parameter types. " +
				"If the signature has output types like 'fn(inputs)(outputs)', the output types are used for decoding. " +
				"Otherwise input types are used. " +
				"Example: abi_decode('(uint256)', '0x000...01') returns the decoded value.",
			inputSchema: {
				signature: z
					.string()
					.describe("Solidity type signature for decoding, e.g. '(address,uint256)' or 'balanceOf(address)(uint256)'."),
				data: z.string().describe("Hex-encoded ABI data to decode (0x-prefixed)."),
			},
		},
		async ({ signature, data }) => {
			try {
				const result = await runtime.runPure(abiDecodeHandler(signature, data))
				return toolResult(result.join("\n"))
			} catch (e) {
				return toolError((e as Error).message)
			}
		},
	)

	server.registerTool(
		"encode_calldata",
		{
			title: "Encode Calldata",
			description:
				"Encode full function calldata: 4-byte function selector followed by ABI-encoded arguments. " +
				"The signature must include a function name. " +
				"Example: encode_calldata('transfer(address,uint256)', ['0xdead...', '100']) returns the full calldata hex.",
			inputSchema: {
				signature: z
					.string()
					.describe(
						"Solidity function signature with name, e.g. 'transfer(address,uint256)'. Must include function name.",
					),
				args: z
					.array(z.string())
					.default([])
					.describe(
						"Array of string values to encode as function arguments. " +
							"Addresses should be 0x-prefixed, integers as decimal strings, booleans as 'true'/'false'.",
					),
			},
		},
		async ({ signature, args }) => {
			try {
				const result = await runtime.runPure(calldataHandler(signature, args))
				return toolResult(result)
			} catch (e) {
				return toolError((e as Error).message)
			}
		},
	)

	server.registerTool(
		"decode_calldata",
		{
			title: "Decode Calldata",
			description:
				"Decode function calldata by matching the 4-byte selector and decoding the ABI-encoded arguments. " +
				"The signature must include a function name so the selector can be matched. " +
				"Returns a JSON object with the function name, full signature, and decoded argument values. " +
				"Example: decode_calldata('transfer(address,uint256)', '0xa9059cbb000...') returns {name, signature, args}.",
			inputSchema: {
				signature: z
					.string()
					.describe(
						"Solidity function signature with name, e.g. 'transfer(address,uint256)'. Must include function name.",
					),
				data: z.string().describe("Hex-encoded calldata to decode (0x-prefixed, includes 4-byte selector)."),
			},
		},
		async ({ signature, data }) => {
			try {
				const result = await runtime.runPure(calldataDecodeHandler(signature, data))
				return toolResult(JSON.stringify({ name: result.name, signature: result.signature, args: result.args }))
			} catch (e) {
				return toolError((e as Error).message)
			}
		},
	)
}
