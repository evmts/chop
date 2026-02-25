/**
 * MCP tool registrations for Ethereum address operations.
 *
 * Tools:
 * - to_checksum: Convert address to EIP-55 checksummed form
 * - compute_address: Compute CREATE contract address from deployer + nonce
 * - create2: Compute CREATE2 contract address from deployer + salt + init_code
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { Effect } from "effect"
import { Keccak256 } from "voltaire-effect"
import { z } from "zod"
import { computeAddressHandler, create2Handler, toCheckSumAddressHandler } from "../../cli/commands/address.js"
import type { McpRuntime } from "../runtime.js"
import { toolError, toolResult } from "../runtime.js"

export const registerAddressTools = (server: McpServer, runtime: McpRuntime): void => {
	server.registerTool(
		"to_checksum",
		{
			title: "To Checksum Address",
			description:
				"Convert an Ethereum address to its EIP-55 checksummed form. " +
				"EIP-55 mixed-case encoding provides a checksum that protects against typos. " +
				"Example: to_checksum('0xd8da6bf26964af9d7eed9e03e53415d37aa96045') returns '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'.",
			inputSchema: {
				address: z.string().describe("Ethereum address to checksum (0x-prefixed, 40 hex characters)."),
			},
		},
		async ({ address }) => {
			try {
				const result = await runtime.runPure(
					toCheckSumAddressHandler(address).pipe(Effect.provide(Keccak256.KeccakLive)),
				)
				return toolResult(result)
			} catch (e) {
				return toolError((e as Error).message)
			}
		},
	)

	server.registerTool(
		"compute_address",
		{
			title: "Compute CREATE Address",
			description:
				"Compute the contract address that would result from a CREATE deployment. " +
				"Uses RLP encoding of [deployer_address, nonce] followed by keccak256 hashing. " +
				"This is how the EVM determines contract addresses for regular deployments. " +
				"Example: compute_address('0xd8da6bf26964af9d7eed9e03e53415d37aa96045', '0') returns the predicted contract address.",
			inputSchema: {
				deployer: z.string().describe("Deployer address (0x-prefixed, 40 hex characters)."),
				nonce: z.string().describe("Transaction nonce as a decimal integer string (must be non-negative)."),
			},
		},
		async ({ deployer, nonce }) => {
			try {
				const result = await runtime.runPure(
					computeAddressHandler(deployer, nonce).pipe(Effect.provide(Keccak256.KeccakLive)),
				)
				return toolResult(result)
			} catch (e) {
				return toolError((e as Error).message)
			}
		},
	)

	server.registerTool(
		"create2",
		{
			title: "Compute CREATE2 Address",
			description:
				"Compute the contract address that would result from a CREATE2 deployment. " +
				"Uses keccak256(0xff ++ deployer ++ salt ++ keccak256(init_code)). " +
				"CREATE2 provides deterministic addresses that don't depend on the deployer's nonce. " +
				"Example: create2('0xdeployer...', '0xsalt...', '0xinitcode...').",
			inputSchema: {
				deployer: z.string().describe("Deployer/factory contract address (0x-prefixed, 40 hex characters)."),
				salt: z.string().describe("32-byte salt value as hex (0x-prefixed, 64 hex characters)."),
				init_code: z.string().describe("Contract initialization code as hex (0x-prefixed)."),
			},
		},
		async ({ deployer, salt, init_code }) => {
			try {
				const result = await runtime.runPure(
					create2Handler(deployer, salt, init_code).pipe(Effect.provide(Keccak256.KeccakLive)),
				)
				return toolResult(result)
			} catch (e) {
				return toolError((e as Error).message)
			}
		},
	)
}
