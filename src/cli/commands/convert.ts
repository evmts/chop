/**
 * Data conversion CLI commands.
 *
 * Commands:
 * - from-wei: Convert wei to ether (or specified unit)
 * - to-wei: Convert ether (or specified unit) to wei
 * - to-hex: Decimal to hex
 * - to-dec: Hex to decimal
 * - to-base: Arbitrary base conversion
 * - from-utf8: UTF-8 string to hex
 * - to-utf8: Hex to UTF-8 string
 * - to-bytes32: Pad/convert to bytes32
 * - from-rlp: RLP decode
 * - to-rlp: RLP encode
 * - shl: Bitwise shift left
 * - shr: Bitwise shift right
 */

import { Args, Command, Options } from "@effect/cli"
import { Console, Data, Effect } from "effect"
import { Hex, Rlp } from "voltaire-effect"
import { handleCommandErrors, jsonOption } from "../shared.js"

// ============================================================================
// Error Types
// ============================================================================

/** Error for general conversion failures */
export class ConversionError extends Data.TaggedError("ConversionError")<{
	readonly message: string
	readonly cause?: unknown
}> {}

/** Error for invalid numeric input */
export class InvalidNumberError extends Data.TaggedError("InvalidNumberError")<{
	readonly message: string
	readonly value: string
}> {}

/** Error for invalid hex input */
export class InvalidHexError extends Data.TaggedError("InvalidHexError")<{
	readonly message: string
	readonly value: string
}> {}

/** Error for invalid base (must be 2-36) */
export class InvalidBaseError extends Data.TaggedError("InvalidBaseError")<{
	readonly message: string
	readonly base: number
}> {}

// ============================================================================
// Constants
// ============================================================================

/** Map of unit names to their decimal places */
const UNITS: Record<string, number> = {
	wei: 0,
	kwei: 3,
	mwei: 6,
	gwei: 9,
	szabo: 12,
	finney: 15,
	ether: 18,
}

// ============================================================================
// Helpers
// ============================================================================

/** Valid digits for bases up to 36 */
const DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz"

/**
 * Parse a string as a BigInt in an arbitrary base (2-36).
 *
 * Unlike Number.parseInt(), this preserves full precision for values > 2^53.
 * For base 10 we delegate to BigInt() directly; for other bases we
 * accumulate digit-by-digit.
 */
const parseBigIntBase = (value: string, base: number): bigint => {
	if (base === 10) return BigInt(value)

	const bigBase = BigInt(base)
	let result = 0n
	for (const ch of value.toLowerCase()) {
		const digit = DIGITS.indexOf(ch)
		if (digit === -1 || digit >= base) {
			throw new Error(`Invalid digit '${ch}' for base ${base}`)
		}
		result = result * bigBase + BigInt(digit)
	}
	return result
}

/**
 * Format a BigInt as a hex string. Handles negatives as `-0x...` instead of `0x-...`.
 */
const formatBigIntHex = (n: bigint): string => {
	if (n < 0n) return `-0x${(-n).toString(16)}`
	return `0x${n.toString(16)}`
}

// ============================================================================
// Handler Logic (testable, separated from CLI wiring)
// ============================================================================

/**
 * Core from-wei handler: converts wei to ether (or specified unit).
 *
 * Uses pure BigInt arithmetic to avoid floating point precision issues.
 * Always shows the full number of decimal places for the unit.
 */
export const fromWeiHandler = (
	amount: string,
	unit = "ether",
): Effect.Effect<string, ConversionError | InvalidNumberError> =>
	Effect.gen(function* () {
		const decimals = UNITS[unit.toLowerCase()]
		if (decimals === undefined) {
			return yield* Effect.fail(
				new ConversionError({
					message: `Unknown unit: "${unit}". Valid units: ${Object.keys(UNITS).join(", ")}`,
				}),
			)
		}

		const trimmed = amount.trim()
		if (trimmed === "") {
			return yield* Effect.fail(
				new InvalidNumberError({
					message: `Invalid number: "${amount}". Expected an integer value.`,
					value: amount,
				}),
			)
		}

		const wei = yield* Effect.try({
			try: () => BigInt(trimmed),
			catch: () =>
				new InvalidNumberError({
					message: `Invalid number: "${amount}". Expected an integer value.`,
					value: amount,
				}),
		})

		if (decimals === 0) {
			return wei.toString()
		}

		const negative = wei < 0n
		const abs = negative ? -wei : wei
		const divisor = 10n ** BigInt(decimals)
		const intPart = abs / divisor
		const fracPart = abs % divisor
		const fracStr = fracPart.toString().padStart(decimals, "0")
		const result = `${intPart}.${fracStr}`
		return negative ? `-${result}` : result
	})

/**
 * Core to-wei handler: converts ether (or specified unit) to wei.
 *
 * Uses pure BigInt arithmetic — parses decimal string manually
 * to avoid floating point precision issues.
 */
export const toWeiHandler = (
	amount: string,
	unit = "ether",
): Effect.Effect<string, ConversionError | InvalidNumberError> =>
	Effect.gen(function* () {
		const decimals = UNITS[unit.toLowerCase()]
		if (decimals === undefined) {
			return yield* Effect.fail(
				new ConversionError({
					message: `Unknown unit: "${unit}". Valid units: ${Object.keys(UNITS).join(", ")}`,
				}),
			)
		}

		if (decimals === 0) {
			// For wei unit, just validate it's an integer
			return yield* Effect.try({
				try: () => BigInt(amount).toString(),
				catch: () =>
					new InvalidNumberError({
						message: `Invalid number: "${amount}". Expected an integer value for unit "wei".`,
						value: amount,
					}),
			})
		}

		// Validate format
		const trimmed = amount.trim()
		if (trimmed === "") {
			return yield* Effect.fail(
				new InvalidNumberError({
					message: 'Invalid number: "". Expected a numeric value.',
					value: amount,
				}),
			)
		}

		const negative = trimmed.startsWith("-")
		const abs = negative ? trimmed.slice(1) : trimmed

		const parts = abs.split(".")
		if (parts.length > 2) {
			return yield* Effect.fail(
				new InvalidNumberError({
					message: `Invalid number: "${amount}". Multiple decimal points.`,
					value: amount,
				}),
			)
		}

		const integerPart = parts[0] ?? "0"
		const decimalPart = parts[1] ?? ""

		// Validate parts contain only digits
		if (!/^\d+$/.test(integerPart) || (decimalPart !== "" && !/^\d+$/.test(decimalPart))) {
			return yield* Effect.fail(
				new InvalidNumberError({
					message: `Invalid number: "${amount}". Expected a numeric value.`,
					value: amount,
				}),
			)
		}

		// Check precision
		if (decimalPart.length > decimals) {
			return yield* Effect.fail(
				new ConversionError({
					message: `Too many decimal places for unit "${unit}": got ${decimalPart.length}, max is ${decimals}.`,
				}),
			)
		}

		const paddedDecimal = decimalPart.padEnd(decimals, "0")
		const combined = BigInt(integerPart + paddedDecimal)
		const result = negative ? -combined : combined
		return result.toString()
	})

/**
 * Core to-hex handler: converts decimal string to hex.
 */
export const toHexHandler = (decimal: string): Effect.Effect<string, InvalidNumberError> =>
	Effect.gen(function* () {
		const trimmed = decimal.trim()
		if (trimmed === "") {
			return yield* Effect.fail(
				new InvalidNumberError({
					message: `Invalid number: "${decimal}". Expected a decimal integer.`,
					value: decimal,
				}),
			)
		}

		// Handle negative hex: BigInt("-0xff") throws SyntaxError,
		// so we detect the negative prefix and parse abs value separately.
		const negative = trimmed.startsWith("-")
		const abs = negative ? trimmed.slice(1) : trimmed

		const n = yield* Effect.try({
			try: () => {
				const val = BigInt(abs)
				return negative ? -val : val
			},
			catch: () =>
				new InvalidNumberError({
					message: `Invalid number: "${decimal}". Expected a decimal integer.`,
					value: decimal,
				}),
		})
		return formatBigIntHex(n)
	})

/**
 * Core to-dec handler: converts hex string to decimal.
 */
export const toDecHandler = (hex: string): Effect.Effect<string, InvalidHexError> =>
	Effect.gen(function* () {
		if (!hex.startsWith("0x")) {
			return yield* Effect.fail(
				new InvalidHexError({
					message: `Invalid hex: "${hex}". Must start with 0x prefix.`,
					value: hex,
				}),
			)
		}
		const clean = hex.slice(2)
		if (clean === "") {
			return "0"
		}
		if (!/^[0-9a-fA-F]+$/.test(clean)) {
			return yield* Effect.fail(
				new InvalidHexError({
					message: `Invalid hex: "${hex}". Contains invalid hex characters.`,
					value: hex,
				}),
			)
		}
		return BigInt(hex).toString(10)
	})

/**
 * Core to-base handler: converts value between arbitrary bases (2-36).
 */
export const toBaseHandler = (
	value: string,
	baseIn: number,
	baseOut: number,
): Effect.Effect<string, InvalidBaseError | InvalidNumberError> =>
	Effect.gen(function* () {
		if (baseIn < 2 || baseIn > 36) {
			return yield* Effect.fail(
				new InvalidBaseError({
					message: `Invalid base-in: ${baseIn}. Must be between 2 and 36.`,
					base: baseIn,
				}),
			)
		}
		if (baseOut < 2 || baseOut > 36) {
			return yield* Effect.fail(
				new InvalidBaseError({
					message: `Invalid base-out: ${baseOut}. Must be between 2 and 36.`,
					base: baseOut,
				}),
			)
		}

		// Parse value in baseIn using BigInt-native parsing to avoid precision loss
		const n = yield* Effect.try({
			try: () => {
				// Handle 0x prefix for base 16 input
				const cleanValue = baseIn === 16 && value.startsWith("0x") ? value.slice(2) : value
				if (cleanValue === "") throw new Error("empty value")
				return parseBigIntBase(cleanValue, baseIn)
			},
			catch: () =>
				new InvalidNumberError({
					message: `Invalid value "${value}" for base ${baseIn}.`,
					value,
				}),
		})

		return n.toString(baseOut)
	})

/**
 * Core from-utf8 handler: converts UTF-8 string to hex.
 */
export const fromUtf8Handler = (str: string): Effect.Effect<string, never> =>
	Effect.succeed(Hex.fromString(str) as string)

/**
 * Core to-utf8 handler: converts hex to UTF-8 string.
 */
export const toUtf8Handler = (hex: string): Effect.Effect<string, InvalidHexError> =>
	Effect.gen(function* () {
		if (!hex.startsWith("0x")) {
			return yield* Effect.fail(
				new InvalidHexError({
					message: `Invalid hex: "${hex}". Must start with 0x prefix.`,
					value: hex,
				}),
			)
		}
		const clean = hex.slice(2)
		if (clean.length > 0 && !/^[0-9a-fA-F]*$/.test(clean)) {
			return yield* Effect.fail(
				new InvalidHexError({
					message: `Invalid hex: "${hex}". Contains invalid hex characters.`,
					value: hex,
				}),
			)
		}
		if (clean.length % 2 !== 0) {
			return yield* Effect.fail(
				new InvalidHexError({
					message: `Invalid hex: "${hex}". Odd-length hex string.`,
					value: hex,
				}),
			)
		}
		return yield* Effect.try({
			try: () => {
				const bytes = Hex.toBytes(hex)
				return Buffer.from(bytes).toString("utf-8")
			},
			catch: () =>
				new InvalidHexError({
					message: `Failed to decode hex to UTF-8: "${hex}".`,
					value: hex,
				}),
		})
	})

/**
 * Core to-bytes32 handler: pads or converts value to 32-byte hex.
 *
 * Accepts hex strings (0x...), numeric strings, or UTF-8 strings.
 */
export const toBytes32Handler = (value: string): Effect.Effect<string, ConversionError> =>
	Effect.gen(function* () {
		let hexStr: string

		if (value.startsWith("0x")) {
			// Validate hex
			const clean = value.slice(2)
			if (!/^[0-9a-fA-F]*$/.test(clean)) {
				return yield* Effect.fail(
					new ConversionError({
						message: `Invalid hex value: "${value}". Contains invalid hex characters.`,
					}),
				)
			}
			if (clean.length > 64) {
				return yield* Effect.fail(
					new ConversionError({
						message: `Value too large for bytes32: "${value}" (${clean.length / 2} bytes, max 32).`,
					}),
				)
			}
			hexStr = clean
		} else if (/^\d+$/.test(value)) {
			// Numeric string — convert to hex
			const n = BigInt(value)
			hexStr = n.toString(16)
			if (hexStr.length > 64) {
				return yield* Effect.fail(
					new ConversionError({
						message: `Value too large for bytes32: ${value}.`,
					}),
				)
			}
		} else {
			// UTF-8 string — encode to hex
			const encoded = Hex.fromString(value) as string
			hexStr = encoded.slice(2) // remove 0x
			if (hexStr.length > 64) {
				return yield* Effect.fail(
					new ConversionError({
						message: `Value too large for bytes32: "${value}" (${hexStr.length / 2} bytes, max 32).`,
					}),
				)
			}
		}

		// Left-pad to 32 bytes (64 hex chars)
		return `0x${hexStr.padStart(64, "0")}`
	})

/**
 * Helper to recursively format RLP decoded data as JSON-serializable structure.
 */
const formatRlpDecoded = (data: unknown): unknown => {
	if (data instanceof Uint8Array) {
		return Hex.fromBytes(data) as string
	}
	if (Array.isArray(data)) {
		return data.map(formatRlpDecoded)
	}
	// BrandedRlp — check for type property
	if (data !== null && typeof data === "object" && "type" in data) {
		const rlp = data as { type: string; value: unknown }
		if (rlp.type === "bytes" && rlp.value instanceof Uint8Array) {
			return Hex.fromBytes(rlp.value) as string
		}
		if (rlp.type === "list" && Array.isArray(rlp.value)) {
			return rlp.value.map(formatRlpDecoded)
		}
	}
	return String(data)
}

/**
 * Core from-rlp handler: RLP-decodes hex data.
 */
export const fromRlpHandler = (hex: string): Effect.Effect<string, ConversionError | InvalidHexError> =>
	Effect.gen(function* () {
		if (!hex.startsWith("0x")) {
			return yield* Effect.fail(
				new InvalidHexError({
					message: `Invalid hex: "${hex}". Must start with 0x prefix.`,
					value: hex,
				}),
			)
		}

		const bytes = yield* Effect.try({
			try: () => Hex.toBytes(hex),
			catch: () =>
				new InvalidHexError({
					message: `Invalid hex data: "${hex}".`,
					value: hex,
				}),
		})

		const decoded = yield* Rlp.decode(bytes).pipe(
			Effect.catchAll((e) =>
				Effect.fail(
					new ConversionError({
						message: `RLP decoding failed: ${e instanceof Error ? e.message : String(e)}`,
						cause: e,
					}),
				),
			),
		)

		const formatted = formatRlpDecoded(decoded.data)
		return typeof formatted === "string" ? formatted : JSON.stringify(formatted)
	})

/**
 * Core to-rlp handler: RLP-encodes hex values.
 */
export const toRlpHandler = (values: ReadonlyArray<string>): Effect.Effect<string, ConversionError | InvalidHexError> =>
	Effect.gen(function* () {
		// Validate all values are hex
		const byteArrays: Uint8Array[] = []
		for (const v of values) {
			if (!v.startsWith("0x")) {
				return yield* Effect.fail(
					new InvalidHexError({
						message: `Invalid hex: "${v}". All values must start with 0x prefix.`,
						value: v,
					}),
				)
			}
			byteArrays.push(
				yield* Effect.try({
					try: () => Hex.toBytes(v),
					catch: () =>
						new InvalidHexError({
							message: `Invalid hex data: "${v}".`,
							value: v,
						}),
				}),
			)
		}

		// Encode: single value as bytes, multiple as list
		const firstItem = byteArrays[0]
		const input = byteArrays.length === 1 && firstItem !== undefined ? firstItem : byteArrays
		const encoded = yield* Rlp.encode(input).pipe(
			Effect.catchAll((e) =>
				Effect.fail(
					new ConversionError({
						message: `RLP encoding failed: ${e instanceof Error ? e.message : String(e)}`,
						cause: e,
					}),
				),
			),
		)

		return Hex.fromBytes(encoded) as string
	})

/**
 * Core shl handler: bitwise shift left.
 *
 * Supports both decimal and hex (0x) input for value.
 */
export const shlHandler = (value: string, bits: string): Effect.Effect<string, InvalidNumberError> =>
	Effect.gen(function* () {
		const n = yield* Effect.try({
			try: () => BigInt(value),
			catch: () =>
				new InvalidNumberError({
					message: `Invalid value: "${value}". Expected a decimal or hex integer.`,
					value,
				}),
		})

		const shift = yield* Effect.try({
			try: () => {
				const s = BigInt(bits)
				if (s < 0n) throw new Error("negative")
				return s
			},
			catch: () =>
				new InvalidNumberError({
					message: `Invalid shift amount: "${bits}". Expected a non-negative integer.`,
					value: bits,
				}),
		})

		const result = n << shift
		return formatBigIntHex(result)
	})

/**
 * Core shr handler: bitwise shift right.
 *
 * Supports both decimal and hex (0x) input for value.
 */
export const shrHandler = (value: string, bits: string): Effect.Effect<string, InvalidNumberError> =>
	Effect.gen(function* () {
		const n = yield* Effect.try({
			try: () => BigInt(value),
			catch: () =>
				new InvalidNumberError({
					message: `Invalid value: "${value}". Expected a decimal or hex integer.`,
					value,
				}),
		})

		const shift = yield* Effect.try({
			try: () => {
				const s = BigInt(bits)
				if (s < 0n) throw new Error("negative")
				return s
			},
			catch: () =>
				new InvalidNumberError({
					message: `Invalid shift amount: "${bits}". Expected a non-negative integer.`,
					value: bits,
				}),
		})

		const result = n >> shift
		return formatBigIntHex(result)
	})

// ============================================================================
// Output Helpers
// ============================================================================

/** Log result as JSON or plain text based on --json flag. */
const outputResult = (result: string, json: boolean): Effect.Effect<void> =>
	json ? Console.log(JSON.stringify({ result })) : Console.log(result)

// ============================================================================
// Commands
// ============================================================================

/**
 * `chop from-wei <amount> [unit]`
 *
 * Convert wei to ether (or specified unit).
 */
export const fromWeiCommand = Command.make(
	"from-wei",
	{
		amount: Args.text({ name: "amount" }).pipe(Args.withDescription("Amount in wei")),
		unit: Args.text({ name: "unit" }).pipe(
			Args.withDefault("ether"),
			Args.withDescription("Target unit (default: ether)"),
		),
		json: jsonOption,
	},
	({ amount, unit, json }) =>
		Effect.gen(function* () {
			const result = yield* fromWeiHandler(amount, unit)
			yield* outputResult(result, json)
		}).pipe(handleCommandErrors),
).pipe(Command.withDescription("Convert wei to ether (or specified unit)"))

/**
 * `chop to-wei <amount> [unit]`
 *
 * Convert ether (or specified unit) to wei.
 */
export const toWeiCommand = Command.make(
	"to-wei",
	{
		amount: Args.text({ name: "amount" }).pipe(Args.withDescription("Amount in ether (or specified unit)")),
		unit: Args.text({ name: "unit" }).pipe(
			Args.withDefault("ether"),
			Args.withDescription("Source unit (default: ether)"),
		),
		json: jsonOption,
	},
	({ amount, unit, json }) =>
		Effect.gen(function* () {
			const result = yield* toWeiHandler(amount, unit)
			yield* outputResult(result, json)
		}).pipe(handleCommandErrors),
).pipe(Command.withDescription("Convert ether (or specified unit) to wei"))

/**
 * `chop to-hex <decimal>`
 *
 * Convert a decimal number to hexadecimal.
 */
export const toHexCommand = Command.make(
	"to-hex",
	{
		decimal: Args.text({ name: "decimal" }).pipe(Args.withDescription("Decimal number to convert")),
		json: jsonOption,
	},
	({ decimal, json }) =>
		Effect.gen(function* () {
			const result = yield* toHexHandler(decimal)
			yield* outputResult(result, json)
		}).pipe(handleCommandErrors),
).pipe(Command.withDescription("Convert decimal to hexadecimal"))

/**
 * `chop to-dec <hex>`
 *
 * Convert a hexadecimal number to decimal.
 */
export const toDecCommand = Command.make(
	"to-dec",
	{
		hex: Args.text({ name: "hex" }).pipe(Args.withDescription("Hex number to convert (0x prefix required)")),
		json: jsonOption,
	},
	({ hex, json }) =>
		Effect.gen(function* () {
			const result = yield* toDecHandler(hex)
			yield* outputResult(result, json)
		}).pipe(handleCommandErrors),
).pipe(Command.withDescription("Convert hexadecimal to decimal"))

/**
 * `chop to-base <value> --base-in <n> --base-out <n>`
 *
 * Convert between arbitrary bases (2-36).
 */
export const toBaseCommand = Command.make(
	"to-base",
	{
		value: Args.text({ name: "value" }).pipe(Args.withDescription("Value to convert")),
		baseIn: Options.integer("base-in").pipe(
			Options.withDefault(10),
			Options.withDescription("Input base (2-36, default: 10)"),
		),
		baseOut: Options.integer("base-out").pipe(Options.withDescription("Output base (2-36)")),
		json: jsonOption,
	},
	({ value, baseIn, baseOut, json }) =>
		Effect.gen(function* () {
			const result = yield* toBaseHandler(value, baseIn, baseOut)
			yield* outputResult(result, json)
		}).pipe(handleCommandErrors),
).pipe(Command.withDescription("Convert between arbitrary bases (2-36)"))

/**
 * `chop from-utf8 <string>`
 *
 * Convert a UTF-8 string to its hex representation.
 */
export const fromUtf8Command = Command.make(
	"from-utf8",
	{
		str: Args.text({ name: "string" }).pipe(Args.withDescription("UTF-8 string to convert")),
		json: jsonOption,
	},
	({ str, json }) =>
		Effect.gen(function* () {
			const result = yield* fromUtf8Handler(str)
			yield* outputResult(result, json)
		}).pipe(handleCommandErrors),
).pipe(Command.withDescription("Convert UTF-8 string to hex"))

/**
 * `chop to-utf8 <hex>`
 *
 * Convert a hex string to UTF-8.
 */
export const toUtf8Command = Command.make(
	"to-utf8",
	{
		hex: Args.text({ name: "hex" }).pipe(Args.withDescription("Hex string to convert (0x prefix required)")),
		json: jsonOption,
	},
	({ hex, json }) =>
		Effect.gen(function* () {
			const result = yield* toUtf8Handler(hex)
			yield* outputResult(result, json)
		}).pipe(handleCommandErrors),
).pipe(Command.withDescription("Convert hex to UTF-8 string"))

/**
 * `chop to-bytes32 <value>`
 *
 * Pad or convert a value to 32-byte (bytes32) hex.
 */
export const toBytes32Command = Command.make(
	"to-bytes32",
	{
		value: Args.text({ name: "value" }).pipe(Args.withDescription("Value to convert (hex, decimal, or UTF-8)")),
		json: jsonOption,
	},
	({ value, json }) =>
		Effect.gen(function* () {
			const result = yield* toBytes32Handler(value)
			yield* outputResult(result, json)
		}).pipe(handleCommandErrors),
).pipe(Command.withDescription("Pad/convert value to bytes32"))

/**
 * `chop from-rlp <hex>`
 *
 * RLP-decode hex data.
 */
export const fromRlpCommand = Command.make(
	"from-rlp",
	{
		hex: Args.text({ name: "hex" }).pipe(Args.withDescription("RLP-encoded hex data (0x prefix required)")),
		json: jsonOption,
	},
	({ hex, json }) =>
		Effect.gen(function* () {
			const result = yield* fromRlpHandler(hex)
			yield* outputResult(result, json)
		}).pipe(handleCommandErrors),
).pipe(Command.withDescription("RLP-decode hex data"))

/**
 * `chop to-rlp <values...>`
 *
 * RLP-encode one or more hex values.
 */
export const toRlpCommand = Command.make(
	"to-rlp",
	{
		values: Args.text({ name: "values" }).pipe(
			Args.withDescription("Hex values to RLP-encode (0x prefix required)"),
			Args.repeated,
		),
		json: jsonOption,
	},
	({ values, json }) =>
		Effect.gen(function* () {
			if (values.length === 0) {
				return yield* Effect.fail(
					new ConversionError({ message: "At least one hex value is required for RLP encoding." }),
				)
			}
			const result = yield* toRlpHandler(values)
			yield* outputResult(result, json)
		}).pipe(handleCommandErrors),
).pipe(Command.withDescription("RLP-encode hex values"))

/**
 * `chop shl <value> <bits>`
 *
 * Bitwise shift left.
 */
export const shlCommand = Command.make(
	"shl",
	{
		value: Args.text({ name: "value" }).pipe(Args.withDescription("Value to shift (decimal or hex)")),
		bits: Args.text({ name: "bits" }).pipe(Args.withDescription("Number of bits to shift")),
		json: jsonOption,
	},
	({ value, bits, json }) =>
		Effect.gen(function* () {
			const result = yield* shlHandler(value, bits)
			yield* outputResult(result, json)
		}).pipe(handleCommandErrors),
).pipe(Command.withDescription("Bitwise shift left"))

/**
 * `chop shr <value> <bits>`
 *
 * Bitwise shift right.
 */
export const shrCommand = Command.make(
	"shr",
	{
		value: Args.text({ name: "value" }).pipe(Args.withDescription("Value to shift (decimal or hex)")),
		bits: Args.text({ name: "bits" }).pipe(Args.withDescription("Number of bits to shift")),
		json: jsonOption,
	},
	({ value, bits, json }) =>
		Effect.gen(function* () {
			const result = yield* shrHandler(value, bits)
			yield* outputResult(result, json)
		}).pipe(handleCommandErrors),
).pipe(Command.withDescription("Bitwise shift right"))

// ============================================================================
// Exports
// ============================================================================

/** All data conversion subcommands for registration with the root command. */
export const convertCommands = [
	fromWeiCommand,
	toWeiCommand,
	toHexCommand,
	toDecCommand,
	toBaseCommand,
	fromUtf8Command,
	toUtf8Command,
	toBytes32Command,
	fromRlpCommand,
	toRlpCommand,
	shlCommand,
	shrCommand,
] as const
