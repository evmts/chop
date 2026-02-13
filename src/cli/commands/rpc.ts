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
 * - estimate: Estimate gas for a transaction
 * - send: Send a transaction
 * - rpc: Execute a raw JSON-RPC call
 *
 * All commands require --rpc-url / -r and support --json / -j for structured output.
 */

import { Args, Command, Options } from "@effect/cli"
import { FetchHttpClient, type HttpClient } from "@effect/platform"
import { Console, Data, Effect } from "effect"
import { type RpcClientError, rpcCall } from "../../rpc/client.js"
import { handleCommandErrors, jsonOption, rpcUrlOption } from "../shared.js"
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

		// Parse signature once upfront if provided (avoids redundant re-parse)
		const parsed = sig ? yield* parseSignature(sig) : undefined

		// If signature provided, encode calldata
		if (sig) {
			data = yield* calldataHandler(sig, [...args])
		}

		const result = (yield* rpcCall(rpcUrl, "eth_call", [{ to, data }, "latest"])) as string

		// If signature has outputs, decode the result (reuses parsed from above)
		if (sig && parsed && parsed.outputs.length > 0) {
			const decoded = yield* abiDecodeHandler(sig, result)
			return decoded.join(", ")
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
// New Error Types
// ============================================================================

/** Error for send transaction failures. */
export class SendTransactionError extends Data.TaggedError("SendTransactionError")<{
	readonly message: string
	readonly cause?: unknown
}> {}

/** Error for invalid RPC params. */
export class InvalidRpcParamsError extends Data.TaggedError("InvalidRpcParamsError")<{
	readonly message: string
}> {}

// ============================================================================
// New Handler functions
// ============================================================================

/**
 * Estimate gas for a transaction via eth_estimateGas.
 *
 * If `sig` is provided, encodes calldata from signature + args.
 */
export const estimateHandler = (
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
		if (sig) {
			data = yield* calldataHandler(sig, [...args])
		}
		const result = yield* rpcCall(rpcUrl, "eth_estimateGas", [{ to, data }])
		return hexToDecimal(result)
	})

/**
 * Send a transaction via eth_sendTransaction (devnet compatible).
 *
 * Uses the `from` address directly with eth_sendTransaction.
 * On a devnet, accounts are auto-signed.
 */
export const sendHandler = (
	rpcUrl: string,
	to: string,
	from: string,
	sig: string | undefined,
	args: readonly string[],
	value?: string,
): Effect.Effect<
	string,
	RpcClientError | SendTransactionError | InvalidSignatureError | ArgumentCountError | AbiError | HexDecodeError,
	HttpClient.HttpClient
> =>
	Effect.gen(function* () {
		let data = "0x"
		if (sig) {
			data = yield* calldataHandler(sig, [...args])
		}

		const txParams: Record<string, unknown> = { from, to, data }
		if (value) {
			txParams["value"] = value.startsWith("0x") ? value : `0x${BigInt(value).toString(16)}`
		}

		const result = yield* rpcCall(rpcUrl, "eth_sendTransaction", [txParams])
		return String(result)
	})

/**
 * Execute a raw JSON-RPC call.
 *
 * Params are parsed as JSON if they look like JSON, otherwise passed as strings.
 */
export const rpcGenericHandler = (
	rpcUrl: string,
	method: string,
	params: readonly string[],
): Effect.Effect<unknown, RpcClientError | InvalidRpcParamsError, HttpClient.HttpClient> =>
	Effect.gen(function* () {
		// Parse params: try JSON for each, fall back to string
		const parsedParams: unknown[] = []
		for (const p of params) {
			try {
				parsedParams.push(JSON.parse(p))
			} catch {
				parsedParams.push(p)
			}
		}
		return yield* rpcCall(rpcUrl, method, parsedParams)
	})

// ============================================================================
// New Command definitions
// ============================================================================

/**
 * `chop estimate --to <addr> [sig] [args...] -r <url>`
 *
 * Estimate gas for a transaction.
 */
export const estimateCommand = Command.make(
	"estimate",
	{
		to: Options.text("to").pipe(Options.withDescription("Target contract address")),
		sig: Args.text({ name: "sig" }).pipe(
			Args.withDescription("Function signature, e.g. 'transfer(address,uint256)'"),
			Args.optional,
		),
		args: Args.text({ name: "args" }).pipe(Args.withDescription("Function arguments"), Args.repeated),
		rpcUrl: rpcUrlOption,
		json: jsonOption,
	},
	({ to, sig, args, rpcUrl, json }) =>
		Effect.gen(function* () {
			const sigValue = sig._tag === "Some" ? sig.value : undefined
			const result = yield* estimateHandler(rpcUrl, to, sigValue, [...args])
			if (json) {
				yield* Console.log(JSON.stringify({ gas: result }))
			} else {
				yield* Console.log(result)
			}
		}).pipe(Effect.provide(FetchHttpClient.layer), handleCommandErrors),
).pipe(Command.withDescription("Estimate gas for a transaction"))

/**
 * `chop send --to <addr> --from <addr> [sig] [args...] -r <url>`
 *
 * Send a transaction. Uses --from address with eth_sendTransaction.
 * On devnets, accounts are auto-signed.
 * --private-key can be provided for future local signing support.
 */
export const sendCommand = Command.make(
	"send",
	{
		to: Options.text("to").pipe(Options.withDescription("Target address")),
		from: Options.text("from").pipe(Options.withDescription("Sender address")),
		privateKey: Options.text("private-key").pipe(
			Options.withDescription("Private key for signing (stored for future use)"),
			Options.optional,
		),
		value: Options.text("value").pipe(
			Options.withDescription("Value to send in wei"),
			Options.optional,
		),
		sig: Args.text({ name: "sig" }).pipe(
			Args.withDescription("Function signature, e.g. 'transfer(address,uint256)'"),
			Args.optional,
		),
		args: Args.text({ name: "args" }).pipe(Args.withDescription("Function arguments"), Args.repeated),
		rpcUrl: rpcUrlOption,
		json: jsonOption,
	},
	({ to, from, value, sig, args, rpcUrl, json }) =>
		Effect.gen(function* () {
			const sigValue = sig._tag === "Some" ? sig.value : undefined
			const valueStr = value._tag === "Some" ? value.value : undefined
			const result = yield* sendHandler(rpcUrl, to, from, sigValue, [...args], valueStr)
			if (json) {
				yield* Console.log(JSON.stringify({ txHash: result }))
			} else {
				yield* Console.log(result)
			}
		}).pipe(Effect.provide(FetchHttpClient.layer), handleCommandErrors),
).pipe(Command.withDescription("Send a transaction"))

/**
 * `chop rpc <method> [params...] -r <url>`
 *
 * Execute a raw JSON-RPC call. Params are parsed as JSON if possible.
 */
export const rpcGenericCommand = Command.make(
	"rpc",
	{
		method: Args.text({ name: "method" }).pipe(
			Args.withDescription("JSON-RPC method name (e.g. 'eth_chainId')"),
		),
		params: Args.text({ name: "params" }).pipe(
			Args.withDescription("Method parameters (JSON values or strings)"),
			Args.repeated,
		),
		rpcUrl: rpcUrlOption,
		json: jsonOption,
	},
	({ method, params, rpcUrl, json }) =>
		Effect.gen(function* () {
			const result = yield* rpcGenericHandler(rpcUrl, method, [...params])
			if (json) {
				yield* Console.log(JSON.stringify({ method, result }))
			} else {
				yield* Console.log(typeof result === "string" ? result : JSON.stringify(result, null, 2))
			}
		}).pipe(Effect.provide(FetchHttpClient.layer), handleCommandErrors),
).pipe(Command.withDescription("Execute a raw JSON-RPC call"))

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
	estimateCommand,
	sendCommand,
	rpcGenericCommand,
] as const
