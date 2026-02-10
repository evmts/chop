/**
 * ABI encoding/decoding CLI commands.
 *
 * Commands:
 * - abi-encode: Encode values according to ABI types
 * - calldata: Encode function call (selector + args)
 * - abi-decode: Decode ABI-encoded data
 * - calldata-decode: Decode function calldata
 */

import { Args, Command, Options } from "@effect/cli"
import { decodeParameters, encodeParameters } from "@tevm/voltaire/Abi"
import { Console, Data, Effect } from "effect"
import { Abi, Hex } from "voltaire-effect"

// ============================================================================
// Error Types
// ============================================================================

/** Error for malformed function signatures */
export class InvalidSignatureError extends Data.TaggedError("InvalidSignatureError")<{
	readonly message: string
	readonly signature: string
}> {}

/** Error for wrong number of arguments */
export class ArgumentCountError extends Data.TaggedError("ArgumentCountError")<{
	readonly message: string
	readonly expected: number
	readonly received: number
}> {}

/** Error for malformed hex data */
export class HexDecodeError extends Data.TaggedError("HexDecodeError")<{
	readonly message: string
	readonly data: string
}> {}

// ============================================================================
// Types
// ============================================================================

export interface ParsedSignature {
	readonly name: string
	readonly inputs: ReadonlyArray<{ readonly type: string }>
	readonly outputs: ReadonlyArray<{ readonly type: string }>
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Parse a human-readable function signature into structured form.
 *
 * Supported formats:
 * - `"transfer(address,uint256)"` → name + inputs
 * - `"balanceOf(address)(uint256)"` → name + inputs + outputs
 * - `"(address,uint256)"` → inputs only (no function name)
 * - `"totalSupply()"` → name with no inputs
 */
export const parseSignature = (sig: string): Effect.Effect<ParsedSignature, InvalidSignatureError> =>
	Effect.gen(function* () {
		const trimmed = sig.trim()
		if (!trimmed.includes("(")) {
			return yield* Effect.fail(
				new InvalidSignatureError({
					message: `Invalid signature: missing parentheses in "${sig}"`,
					signature: sig,
				}),
			)
		}

		// Match: optionalName(types) optionally followed by (types)
		const match = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)?\(([^)]*)\)(?:\(([^)]*)\))?$/)
		if (!match) {
			return yield* Effect.fail(
				new InvalidSignatureError({
					message: `Invalid signature format: "${sig}"`,
					signature: sig,
				}),
			)
		}

		const [, name = "", inputsStr, outputsStr] = match

		const parseTypes = (str: string | undefined): ReadonlyArray<{ readonly type: string }> => {
			if (!str || str.trim() === "") return []
			return str.split(",").map((t) => ({ type: t.trim() }))
		}

		return {
			name,
			inputs: parseTypes(inputsStr),
			outputs: parseTypes(outputsStr),
		} satisfies ParsedSignature
	})

/**
 * Coerce a CLI string argument to the appropriate Solidity type.
 *
 * - `address` → `Uint8Array` (20 bytes)
 * - `uint*` / `int*` → `bigint`
 * - `bool` → `boolean`
 * - `string` → pass-through
 * - `bytes*` → `Uint8Array`
 */
export const coerceArgValue = (type: string, raw: string): unknown => {
	if (type === "address") {
		return Hex.toBytes(raw)
	}
	if (type.startsWith("uint") || type.startsWith("int")) {
		return BigInt(raw)
	}
	if (type === "bool") {
		return raw === "true" || raw === "1"
	}
	if (type === "string") {
		return raw
	}
	if (type.startsWith("bytes")) {
		return Hex.toBytes(raw)
	}
	return raw
}

/**
 * Format a decoded value for display.
 * Uint8Array → hex, bigint → decimal, arrays → formatted.
 */
export const formatValue = (value: unknown): string => {
	if (value instanceof Uint8Array) {
		return Hex.fromBytes(value)
	}
	if (typeof value === "bigint") {
		return value.toString()
	}
	if (Array.isArray(value)) {
		return `[${value.map(formatValue).join(", ")}]`
	}
	return String(value)
}

/**
 * Cast parsed types to voltaire Parameter[] for type compatibility.
 * At runtime the values are equivalent — this bridges our dynamic
 * string parsing with voltaire's branded AbiType union.
 *
 * Note: voltaire has two `Parameter` types (class vs type alias) that are
 * incompatible at the TS level. We cast through `any` to bridge both.
 */
// biome-ignore lint/suspicious/noExplicitAny: bridges dynamic string types to voltaire's branded AbiType union
const toParams = (types: ReadonlyArray<{ readonly type: string }>): any => types

/**
 * Build an ABI function item from a parsed signature.
 * Uses `any` return to satisfy both voltaire's `encodeFunction` and
 * `decodeFunction` which expect different internal Parameter types.
 */
// biome-ignore lint/suspicious/noExplicitAny: bridges dynamic string types to voltaire's branded ABI item type
const buildAbiItem = (sig: ParsedSignature): any => ({
	type: "function" as const,
	name: sig.name,
	stateMutability: "nonpayable" as const,
	inputs: sig.inputs.map((p) => ({ type: p.type, name: p.type })),
	outputs: sig.outputs.map((p) => ({ type: p.type, name: p.type })),
})

/**
 * Validate hex string and convert to bytes.
 */
const validateHexData = (data: string): Effect.Effect<Uint8Array, HexDecodeError> =>
	Effect.try({
		try: () => {
			if (!data.startsWith("0x")) {
				throw new Error("Hex data must start with 0x")
			}
			const clean = data.slice(2)
			if (!/^[0-9a-fA-F]*$/.test(clean)) {
				throw new Error("Invalid hex characters")
			}
			if (clean.length % 2 !== 0) {
				throw new Error("Odd-length hex string")
			}
			return Hex.toBytes(data)
		},
		catch: (e) =>
			new HexDecodeError({
				message: `Invalid hex data: ${e instanceof Error ? e.message : String(e)}`,
				data,
			}),
	})

/**
 * Validate argument count matches expected parameter count.
 */
const validateArgCount = (expected: number, received: number): Effect.Effect<void, ArgumentCountError> =>
	expected !== received
		? Effect.fail(
				new ArgumentCountError({
					message: `Expected ${expected} argument${expected !== 1 ? "s" : ""}, got ${received}`,
					expected,
					received,
				}),
			)
		: Effect.void

// ============================================================================
// Shared Options
// ============================================================================

const jsonOption = Options.boolean("json").pipe(
	Options.withAlias("j"),
	Options.withDescription("Output results as JSON"),
)

// ============================================================================
// Commands
// ============================================================================

/**
 * `chop abi-encode <sig> [args...]`
 *
 * Encode values according to the parameter types in the signature.
 * Use `--packed` for tightly-packed encoding (non-standard).
 */
export const abiEncodeCommand = Command.make(
	"abi-encode",
	{
		sig: Args.text({ name: "sig" }).pipe(Args.withDescription("Function signature, e.g. 'transfer(address,uint256)'")),
		args: Args.text({ name: "args" }).pipe(Args.withDescription("Values to encode"), Args.repeated),
		packed: Options.boolean("packed").pipe(Options.withDescription("Use packed (non-standard) encoding")),
		json: jsonOption,
	},
	({ sig, args: argsArray, packed, json }) =>
		Effect.gen(function* () {
			const parsed = yield* parseSignature(sig)

			yield* validateArgCount(parsed.inputs.length, argsArray.length)

			// biome-ignore lint/style/noNonNullAssertion: index is safe — validated by validateArgCount above
			const coerced = parsed.inputs.map((p, i) => coerceArgValue(p.type, argsArray[i]!))

			let result: string

			if (packed) {
				const types = parsed.inputs.map((p) => p.type)
				const hex = yield* Abi.encodePacked(types, coerced)
				result = hex
			} else {
				const encoded = encodeParameters(toParams(parsed.inputs), coerced as [unknown, ...unknown[]])
				result = Hex.fromBytes(encoded)
			}

			if (json) {
				yield* Console.log(JSON.stringify({ result }))
			} else {
				yield* Console.log(result)
			}
		}).pipe(
			Effect.catchTags({
				InvalidSignatureError: (e) => Console.error(e.message).pipe(Effect.andThen(Effect.fail(e))),
				ArgumentCountError: (e) => Console.error(e.message).pipe(Effect.andThen(Effect.fail(e))),
			}),
		),
).pipe(Command.withDescription("ABI-encode values according to a function signature"))

/**
 * `chop calldata <sig> [args...]`
 *
 * Produce a full calldata blob: 4-byte selector + ABI-encoded args.
 */
export const calldataCommand = Command.make(
	"calldata",
	{
		sig: Args.text({ name: "sig" }).pipe(Args.withDescription("Function signature, e.g. 'transfer(address,uint256)'")),
		args: Args.text({ name: "args" }).pipe(Args.withDescription("Values to encode"), Args.repeated),
		json: jsonOption,
	},
	({ sig, args: argsArray, json }) =>
		Effect.gen(function* () {
			const parsed = yield* parseSignature(sig)

			if (parsed.name === "") {
				return yield* Effect.fail(
					new InvalidSignatureError({
						message: "calldata command requires a function name in the signature",
						signature: sig,
					}),
				)
			}

			yield* validateArgCount(parsed.inputs.length, argsArray.length)

			// biome-ignore lint/style/noNonNullAssertion: index is safe — validated by validateArgCount above
			const coerced = parsed.inputs.map((p, i) => coerceArgValue(p.type, argsArray[i]!))

			const abiItem = buildAbiItem(parsed)
			const result = yield* Abi.encodeFunction([abiItem], parsed.name, coerced)

			if (json) {
				yield* Console.log(JSON.stringify({ result }))
			} else {
				yield* Console.log(result)
			}
		}).pipe(
			Effect.catchTags({
				InvalidSignatureError: (e) => Console.error(e.message).pipe(Effect.andThen(Effect.fail(e))),
				ArgumentCountError: (e) => Console.error(e.message).pipe(Effect.andThen(Effect.fail(e))),
			}),
		),
).pipe(Command.withDescription("Encode function calldata (selector + ABI args)"))

/**
 * `chop abi-decode <sig> <data>`
 *
 * Decode ABI-encoded data according to the types in the signature.
 * If the signature has output types `fn(inputs)(outputs)`, those are used.
 * Otherwise the input types are used.
 */
export const abiDecodeCommand = Command.make(
	"abi-decode",
	{
		sig: Args.text({ name: "sig" }).pipe(Args.withDescription("Function signature, e.g. 'transfer(address,uint256)'")),
		data: Args.text({ name: "data" }).pipe(Args.withDescription("Hex-encoded data to decode")),
		json: jsonOption,
	},
	({ sig, data, json }) =>
		Effect.gen(function* () {
			const parsed = yield* parseSignature(sig)
			const bytes = yield* validateHexData(data)

			// Use output types if specified, otherwise use input types
			const types = parsed.outputs.length > 0 ? parsed.outputs : parsed.inputs

			const decoded = decodeParameters(toParams(types), bytes)

			const formatted = Array.from(decoded as ArrayLike<unknown>).map(formatValue)

			if (json) {
				yield* Console.log(JSON.stringify({ result: formatted }))
			} else {
				for (const v of formatted) {
					yield* Console.log(v)
				}
			}
		}).pipe(
			Effect.catchTags({
				InvalidSignatureError: (e) => Console.error(e.message).pipe(Effect.andThen(Effect.fail(e))),
				HexDecodeError: (e) => Console.error(e.message).pipe(Effect.andThen(Effect.fail(e))),
			}),
		),
).pipe(Command.withDescription("Decode ABI-encoded data"))

/**
 * `chop calldata-decode <sig> <data>`
 *
 * Decode function calldata: match the 4-byte selector, decode args.
 */
export const calldataDecodeCommand = Command.make(
	"calldata-decode",
	{
		sig: Args.text({ name: "sig" }).pipe(Args.withDescription("Function signature, e.g. 'transfer(address,uint256)'")),
		data: Args.text({ name: "data" }).pipe(Args.withDescription("Hex-encoded calldata to decode")),
		json: jsonOption,
	},
	({ sig, data, json }) =>
		Effect.gen(function* () {
			const parsed = yield* parseSignature(sig)
			const bytes = yield* validateHexData(data)

			if (parsed.name === "") {
				return yield* Effect.fail(
					new InvalidSignatureError({
						message: "calldata-decode requires a function name in the signature",
						signature: sig,
					}),
				)
			}

			const abiItem = buildAbiItem(parsed)
			const decoded = yield* Abi.decodeFunction([abiItem], bytes)

			const formattedArgs = Array.from(decoded.params as ArrayLike<unknown>).map(formatValue)

			if (json) {
				yield* Console.log(
					JSON.stringify({
						name: decoded.name,
						args: formattedArgs,
					}),
				)
			} else {
				yield* Console.log(`${decoded.name}(${parsed.inputs.map((p) => p.type).join(",")})`)
				for (const v of formattedArgs) {
					yield* Console.log(v)
				}
			}
		}).pipe(
			Effect.catchTags({
				InvalidSignatureError: (e) => Console.error(e.message).pipe(Effect.andThen(Effect.fail(e))),
				HexDecodeError: (e) => Console.error(e.message).pipe(Effect.andThen(Effect.fail(e))),
			}),
		),
).pipe(Command.withDescription("Decode function calldata"))

// ============================================================================
// Exports
// ============================================================================

/** All ABI-related subcommands for registration with the root command. */
export const abiCommands = [abiEncodeCommand, calldataCommand, abiDecodeCommand, calldataDecodeCommand] as const
