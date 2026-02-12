/**
 * RPC CLI commands — make JSON-RPC calls to a running Ethereum node.
 *
 * Commands:
 * - chain-id: Get chain ID
 * - block-number: Get latest block number
 * - balance: Get account balance (wei)
 * - nonce: Get account nonce
 * - code: Get account bytecode
 * - storage: Get storage value at slot
 * - call: Execute eth_call
 *
 * All commands require --rpc-url / -r and support --json / -j for structured output.
 */

import { Args, Command, Options } from "@effect/cli"
import { FetchHttpClient, type HttpClient } from "@effect/platform"
import { Console, Effect } from "effect"
import { type RpcClientError, rpcCall } from "../../rpc/client.js"
import { handleCommandErrors, jsonOption } from "../shared.js"
import {
	type AbiError,
	type ArgumentCountError,
	type HexDecodeError,
	type InvalidSignatureError,
	abiDecodeHandler,
	calldataHandler,
	parseSignature,
} from "./abi.js"

// ============================================================================
// Shared Options & Args
// ============================================================================

/** Required --rpc-url / -r option for RPC commands */
const rpcUrlOption = Options.text("rpc-url").pipe(
	Options.withAlias("r"),
	Options.withDescription("Ethereum JSON-RPC endpoint URL"),
)

/** Reusable address positional argument */
const addressArg = Args.text({ name: "address" }).pipe(
	Args.withDescription("Ethereum address (0x-prefixed, 40 hex chars)"),
)

// ============================================================================
// Helpers
// ============================================================================

/** Parse hex string to decimal string */
const hexToDecimal = (hex: unknown): string => {
	if (typeof hex !== "string") return String(hex)
	return BigInt(hex).toString()
}

// ============================================================================
// Handler functions (testable, separated from CLI wiring)
// ============================================================================

/**
 * Get chain ID from RPC node, return as decimal string.
 */
export const chainIdHandler = (rpcUrl: string): Effect.Effect<string, RpcClientError, HttpClient.HttpClient> =>
	rpcCall(rpcUrl, "eth_chainId", []).pipe(Effect.map(hexToDecimal))

/**
 * Get latest block number from RPC node, return as decimal string.
 */
export const blockNumberHandler = (rpcUrl: string): Effect.Effect<string, RpcClientError, HttpClient.HttpClient> =>
	rpcCall(rpcUrl, "eth_blockNumber", []).pipe(Effect.map(hexToDecimal))

/**
 * Get account balance in wei from RPC node, return as decimal string.
 */
export const balanceHandler = (
	rpcUrl: string,
	address: string,
): Effect.Effect<string, RpcClientError, HttpClient.HttpClient> =>
	rpcCall(rpcUrl, "eth_getBalance", [address, "latest"]).pipe(Effect.map(hexToDecimal))

/**
 * Get account nonce from RPC node, return as decimal string.
 */
export const nonceHandler = (
	rpcUrl: string,
	address: string,
): Effect.Effect<string, RpcClientError, HttpClient.HttpClient> =>
	rpcCall(rpcUrl, "eth_getTransactionCount", [address, "latest"]).pipe(Effect.map(hexToDecimal))

/**
 * Get account bytecode from RPC node, return as hex string.
 */
export const codeHandler = (
	rpcUrl: string,
	address: string,
): Effect.Effect<string, RpcClientError, HttpClient.HttpClient> =>
	rpcCall(rpcUrl, "eth_getCode", [address, "latest"]).pipe(Effect.map((r) => String(r)))

/**
 * Get storage value at a slot from RPC node, return as hex string.
 */
export const storageHandler = (
	rpcUrl: string,
	address: string,
	slot: string,
): Effect.Effect<string, RpcClientError, HttpClient.HttpClient> =>
	rpcCall(rpcUrl, "eth_getStorageAt", [address, slot, "latest"]).pipe(Effect.map((r) => String(r)))

/**
 * Execute eth_call on RPC node.
 *
 * If `sig` is provided, encodes calldata from signature + args.
 * If no `sig`, sends raw eth_call with empty data.
 * Optionally decodes output using the signature's output types.
 */
export const callHandler = (
	rpcUrl: string,
	to: string,
	sig: string | undefined,
	args: readonly string[],
): Effect.Effect<
	string,
	RpcClientError | InvalidSignatureError | ArgumentCountError | AbiError | HexDecodeError,
	HttpClient.HttpClient
> =>
	Effect.gen(function* () {
		let data = "0x"

		// If signature provided, encode calldata
		if (sig) {
			data = yield* calldataHandler(sig, [...args])
		}

		const result = (yield* rpcCall(rpcUrl, "eth_call", [{ to, data }, "latest"])) as string

		// If signature has outputs, decode the result
		if (sig) {
			const parsed = yield* parseSignature(sig)
			if (parsed.outputs.length > 0) {
				// Reuse abiDecodeHandler which handles output types
				const decoded = yield* abiDecodeHandler(sig, result)
				return decoded.join(", ")
			}
		}

		return result
	})

// ============================================================================
// Command definitions
// ============================================================================

/**
 * `chop chain-id -r <url>`
 *
 * Get the chain ID from the RPC endpoint.
 */
export const chainIdCommand = Command.make("chain-id", { rpcUrl: rpcUrlOption, json: jsonOption }, ({ rpcUrl, json }) =>
	Effect.gen(function* () {
		const result = yield* chainIdHandler(rpcUrl)
		if (json) {
			yield* Console.log(JSON.stringify({ chainId: result }))
		} else {
			yield* Console.log(result)
		}
	}).pipe(Effect.provide(FetchHttpClient.layer), handleCommandErrors),
).pipe(Command.withDescription("Get the chain ID from an RPC endpoint"))

/**
 * `chop block-number -r <url>`
 *
 * Get the latest block number from the RPC endpoint.
 */
export const blockNumberCommand = Command.make(
	"block-number",
	{ rpcUrl: rpcUrlOption, json: jsonOption },
	({ rpcUrl, json }) =>
		Effect.gen(function* () {
			const result = yield* blockNumberHandler(rpcUrl)
			if (json) {
				yield* Console.log(JSON.stringify({ blockNumber: result }))
			} else {
				yield* Console.log(result)
			}
		}).pipe(Effect.provide(FetchHttpClient.layer), handleCommandErrors),
).pipe(Command.withDescription("Get the latest block number from an RPC endpoint"))

/**
 * `chop balance <address> -r <url>`
 *
 * Get the balance of an address in wei.
 */
export const balanceCommand = Command.make(
	"balance",
	{ address: addressArg, rpcUrl: rpcUrlOption, json: jsonOption },
	({ address, rpcUrl, json }) =>
		Effect.gen(function* () {
			const result = yield* balanceHandler(rpcUrl, address)
			if (json) {
				yield* Console.log(JSON.stringify({ address, balance: result }))
			} else {
				yield* Console.log(result)
			}
		}).pipe(Effect.provide(FetchHttpClient.layer), handleCommandErrors),
).pipe(Command.withDescription("Get the balance of an address (wei)"))

/**
 * `chop nonce <address> -r <url>`
 *
 * Get the nonce of an address.
 */
export const nonceCommand = Command.make(
	"nonce",
	{ address: addressArg, rpcUrl: rpcUrlOption, json: jsonOption },
	({ address, rpcUrl, json }) =>
		Effect.gen(function* () {
			const result = yield* nonceHandler(rpcUrl, address)
			if (json) {
				yield* Console.log(JSON.stringify({ address, nonce: result }))
			} else {
				yield* Console.log(result)
			}
		}).pipe(Effect.provide(FetchHttpClient.layer), handleCommandErrors),
).pipe(Command.withDescription("Get the nonce of an address"))

/**
 * `chop code <address> -r <url>`
 *
 * Get the bytecode deployed at an address.
 */
export const codeCommand = Command.make(
	"code",
	{ address: addressArg, rpcUrl: rpcUrlOption, json: jsonOption },
	({ address, rpcUrl, json }) =>
		Effect.gen(function* () {
			const result = yield* codeHandler(rpcUrl, address)
			if (json) {
				yield* Console.log(JSON.stringify({ address, code: result }))
			} else {
				yield* Console.log(result)
			}
		}).pipe(Effect.provide(FetchHttpClient.layer), handleCommandErrors),
).pipe(Command.withDescription("Get the bytecode at an address"))

/**
 * `chop storage <address> <slot> -r <url>`
 *
 * Get a storage value at a specific slot.
 */
export const storageCommand = Command.make(
	"storage",
	{
		address: addressArg,
		slot: Args.text({ name: "slot" }).pipe(Args.withDescription("Storage slot (0x-prefixed, 32-byte hex)")),
		rpcUrl: rpcUrlOption,
		json: jsonOption,
	},
	({ address, slot, rpcUrl, json }) =>
		Effect.gen(function* () {
			const result = yield* storageHandler(rpcUrl, address, slot)
			if (json) {
				yield* Console.log(JSON.stringify({ address, slot, value: result }))
			} else {
				yield* Console.log(result)
			}
		}).pipe(Effect.provide(FetchHttpClient.layer), handleCommandErrors),
).pipe(Command.withDescription("Get storage value at a slot"))

/**
 * `chop call --to <addr> [sig] [args...] -r <url>`
 *
 * Execute an eth_call. Optionally provide a function signature + args
 * to auto-encode calldata and decode the result.
 */
export const callCommand = Command.make(
	"call",
	{
		to: Options.text("to").pipe(Options.withDescription("Target contract address")),
		sig: Args.text({ name: "sig" }).pipe(
			Args.withDescription("Function signature, e.g. 'balanceOf(address)(uint256)'"),
			Args.optional,
		),
		args: Args.text({ name: "args" }).pipe(Args.withDescription("Function arguments"), Args.repeated),
		rpcUrl: rpcUrlOption,
		json: jsonOption,
	},
	({ to, sig, args, rpcUrl, json }) =>
		Effect.gen(function* () {
			const sigValue = sig._tag === "Some" ? sig.value : undefined
			const result = yield* callHandler(rpcUrl, to, sigValue, [...args])
			if (json) {
				yield* Console.log(JSON.stringify({ to, result }))
			} else {
				yield* Console.log(result)
			}
		}).pipe(Effect.provide(FetchHttpClient.layer), handleCommandErrors),
).pipe(Command.withDescription("Execute an eth_call against a contract"))

// ============================================================================
// Exports
// ============================================================================

/** All RPC-related subcommands for registration with the root command. */
export const rpcCommands = [
	chainIdCommand,
	blockNumberCommand,
	balanceCommand,
	nonceCommand,
	codeCommand,
	storageCommand,
	callCommand,
] as const
