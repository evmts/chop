/**
 * Bytecode analysis CLI commands.
 *
 * Commands:
 * - disassemble: Disassemble EVM bytecode into opcode listing with PC offsets
 * - 4byte: Look up 4-byte function selector from openchain.xyz signature database
 * - 4byte-event: Look up 32-byte event topic from openchain.xyz signature database
 */

import { Args, Command } from "@effect/cli"
import { Console, Data, Effect } from "effect"
import { handleCommandErrors, jsonOption } from "../shared.js"

// Fetch is available globally in Bun and Node 18+ but not in ES2022 lib
declare const fetch: (
	url: string,
) => Promise<{ ok: boolean; status: number; statusText: string; json: () => Promise<unknown> }>

// ============================================================================
// Error Types
// ============================================================================

/** Error for invalid bytecode input */
export class InvalidBytecodeError extends Data.TaggedError("InvalidBytecodeError")<{
	readonly message: string
	readonly data: string
}> {}

/** Error for selector/topic lookup failures */
export class SelectorLookupError extends Data.TaggedError("SelectorLookupError")<{
	readonly message: string
	readonly selector: string
	readonly cause?: unknown
}> {}

// ============================================================================
// EVM Opcode Table
// ============================================================================

/** Complete mapping of EVM opcode bytes to mnemonic names */
const OPCODE_TABLE: Record<number, string> = {
	// Stop and Arithmetic
	0: "STOP",
	1: "ADD",
	2: "MUL",
	3: "SUB",
	4: "DIV",
	5: "SDIV",
	6: "MOD",
	7: "SMOD",
	8: "ADDMOD",
	9: "MULMOD",
	10: "EXP",
	11: "SIGNEXTEND",

	// Comparison & Bitwise Logic
	16: "LT",
	17: "GT",
	18: "SLT",
	19: "SGT",
	20: "EQ",
	21: "ISZERO",
	22: "AND",
	23: "OR",
	24: "XOR",
	25: "NOT",
	26: "BYTE",
	27: "SHL",
	28: "SHR",
	29: "SAR",

	// Keccak256
	32: "KECCAK256",

	// Environmental Information
	48: "ADDRESS",
	49: "BALANCE",
	50: "ORIGIN",
	51: "CALLER",
	52: "CALLVALUE",
	53: "CALLDATALOAD",
	54: "CALLDATASIZE",
	55: "CALLDATACOPY",
	56: "CODESIZE",
	57: "CODECOPY",
	58: "GASPRICE",
	59: "EXTCODESIZE",
	60: "EXTCODECOPY",
	61: "RETURNDATASIZE",
	62: "RETURNDATACOPY",
	63: "EXTCODEHASH",

	// Block Information
	64: "BLOCKHASH",
	65: "COINBASE",
	66: "TIMESTAMP",
	67: "NUMBER",
	68: "PREVRANDAO",
	69: "GASLIMIT",
	70: "CHAINID",
	71: "SELFBALANCE",
	72: "BASEFEE",
	73: "BLOBHASH",
	74: "BLOBBASEFEE",

	// Stack, Memory, Storage, Flow
	80: "POP",
	81: "MLOAD",
	82: "MSTORE",
	83: "MSTORE8",
	84: "SLOAD",
	85: "SSTORE",
	86: "JUMP",
	87: "JUMPI",
	88: "PC",
	89: "MSIZE",
	90: "GAS",
	91: "JUMPDEST",
	92: "TLOAD",
	93: "TSTORE",
	94: "MCOPY",
	95: "PUSH0",

	// PUSH1-PUSH32
	...Object.fromEntries(Array.from({ length: 32 }, (_, i) => [0x60 + i, `PUSH${i + 1}`])),

	// DUP1-DUP16
	...Object.fromEntries(Array.from({ length: 16 }, (_, i) => [0x80 + i, `DUP${i + 1}`])),

	// SWAP1-SWAP16
	...Object.fromEntries(Array.from({ length: 16 }, (_, i) => [0x90 + i, `SWAP${i + 1}`])),

	// LOG0-LOG4
	160: "LOG0",
	161: "LOG1",
	162: "LOG2",
	163: "LOG3",
	164: "LOG4",

	// System Operations
	240: "CREATE",
	241: "CALL",
	242: "CALLCODE",
	243: "RETURN",
	244: "DELEGATECALL",
	245: "CREATE2",
	250: "STATICCALL",
	253: "REVERT",
	254: "INVALID",
	255: "SELFDESTRUCT",
}

// ============================================================================
// Types
// ============================================================================

/** A single disassembled EVM instruction */
export type DisassembledInstruction = {
	readonly pc: number
	readonly opcode: string
	readonly name: string
	readonly pushData?: string
}

// ============================================================================
// Handler Logic (testable, separated from CLI wiring)
// ============================================================================

/**
 * Disassemble EVM bytecode into instruction listing.
 *
 * Handles PUSH1-PUSH32 immediate data extraction.
 * Handles truncated PUSH at end of bytecode.
 * Unknown opcodes are formatted as "UNKNOWN(0xNN)".
 */
export const disassembleHandler = (
	bytecodeHex: string,
): Effect.Effect<ReadonlyArray<DisassembledInstruction>, InvalidBytecodeError> =>
	Effect.try({
		try: () => {
			if (!bytecodeHex.startsWith("0x") && !bytecodeHex.startsWith("0X")) {
				throw new Error("Bytecode must start with 0x")
			}

			const hex = bytecodeHex.slice(2)

			if (hex.length === 0) {
				return [] as ReadonlyArray<DisassembledInstruction>
			}

			if (!/^[0-9a-fA-F]*$/.test(hex)) {
				throw new Error("Invalid hex characters")
			}

			if (hex.length % 2 !== 0) {
				throw new Error("Odd-length hex string")
			}

			// Convert to bytes
			const bytes = new Uint8Array(hex.length / 2)
			for (let i = 0; i < hex.length; i += 2) {
				bytes[i / 2] = Number.parseInt(hex.substring(i, i + 2), 16)
			}

			const instructions: DisassembledInstruction[] = []
			let pc = 0

			while (pc < bytes.length) {
				// biome-ignore lint/style/noNonNullAssertion: pc is bounds-checked by while condition
				const opcodeByte = bytes[pc]!
				const name = OPCODE_TABLE[opcodeByte] ?? `UNKNOWN(0x${opcodeByte.toString(16).padStart(2, "0")})`
				const opcodeHex = `0x${opcodeByte.toString(16).padStart(2, "0")}`

				// Check if it's a PUSH instruction (0x60-0x7f)
				if (opcodeByte >= 0x60 && opcodeByte <= 0x7f) {
					const pushSize = opcodeByte - 0x5f
					const dataStart = pc + 1
					const dataEnd = Math.min(dataStart + pushSize, bytes.length)
					const data = bytes.slice(dataStart, dataEnd)
					const pushDataHex = `0x${Array.from(data)
						.map((b) => b.toString(16).padStart(2, "0"))
						.join("")}`

					instructions.push({
						pc,
						opcode: opcodeHex,
						name,
						pushData: pushDataHex,
					})

					pc = dataEnd
				} else {
					instructions.push({
						pc,
						opcode: opcodeHex,
						name,
					})
					pc++
				}
			}

			return instructions as ReadonlyArray<DisassembledInstruction>
		},
		catch: (e) =>
			new InvalidBytecodeError({
				message: `Invalid bytecode: ${e instanceof Error ? e.message : String(e)}`,
				data: bytecodeHex,
			}),
	})

/**
 * Look up a function or event signature from the openchain.xyz database.
 *
 * @internal
 */
const lookupSignature = (
	type: "function" | "event",
	hashHex: string,
): Effect.Effect<ReadonlyArray<string>, SelectorLookupError> =>
	Effect.tryPromise({
		try: async () => {
			const url = `https://api.openchain.xyz/signature-database/v1/lookup?${type}=${hashHex}&filter=true`
			const response = await fetch(url)

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`)
			}

			const json = (await response.json()) as {
				ok: boolean
				result: Record<string, Record<string, Array<{ name: string }> | null>>
			}

			if (!json.ok) {
				throw new Error("API returned ok: false")
			}

			const results = json.result?.[type]?.[hashHex]
			if (!results || results.length === 0) {
				return [] as ReadonlyArray<string>
			}

			return results.map((r) => r.name) as ReadonlyArray<string>
		},
		catch: (e) =>
			new SelectorLookupError({
				message: `Signature lookup failed: ${e instanceof Error ? e.message : String(e)}`,
				selector: hashHex,
				cause: e,
			}),
	})

/**
 * Look up a 4-byte function selector.
 * Validates the selector format (0x + 8 hex chars).
 */
export const fourByteHandler = (selectorHex: string): Effect.Effect<ReadonlyArray<string>, SelectorLookupError> =>
	Effect.gen(function* () {
		if (!/^0x[0-9a-fA-F]{8}$/i.test(selectorHex)) {
			return yield* Effect.fail(
				new SelectorLookupError({
					message: `Invalid 4-byte selector: must be 0x followed by 8 hex characters, got "${selectorHex}"`,
					selector: selectorHex,
				}),
			)
		}

		return yield* lookupSignature("function", selectorHex.toLowerCase())
	})

/**
 * Look up a 32-byte event topic.
 * Validates the topic format (0x + 64 hex chars).
 */
export const fourByteEventHandler = (topicHex: string): Effect.Effect<ReadonlyArray<string>, SelectorLookupError> =>
	Effect.gen(function* () {
		if (!/^0x[0-9a-fA-F]{64}$/i.test(topicHex)) {
			return yield* Effect.fail(
				new SelectorLookupError({
					message: `Invalid event topic: must be 0x followed by 64 hex characters, got "${topicHex}"`,
					selector: topicHex,
				}),
			)
		}

		return yield* lookupSignature("event", topicHex.toLowerCase())
	})

// ============================================================================
// Commands
// ============================================================================

/** Format PC offset as 8 hex digits */
const formatPc = (pc: number): string => pc.toString(16).padStart(8, "0")

/**
 * `chop disassemble <bytecode>`
 *
 * Disassemble EVM bytecode into opcode listing with PC offsets.
 */
export const disassembleCommand = Command.make(
	"disassemble",
	{
		bytecode: Args.text({ name: "bytecode" }).pipe(Args.withDescription("EVM bytecode hex string (0x-prefixed)")),
		json: jsonOption,
	},
	({ bytecode, json }) =>
		Effect.gen(function* () {
			const instructions = yield* disassembleHandler(bytecode)

			if (json) {
				yield* Console.log(JSON.stringify({ result: instructions }))
			} else {
				if (instructions.length === 0) {
					return
				}
				const lines = instructions.map((inst) => {
					const pcStr = formatPc(inst.pc)
					if (inst.pushData !== undefined) {
						return `${pcStr}: ${inst.name} ${inst.pushData}`
					}
					return `${pcStr}: ${inst.name}`
				})
				yield* Console.log(lines.join("\n"))
			}
		}).pipe(handleCommandErrors),
).pipe(Command.withDescription("Disassemble EVM bytecode into opcode listing"))

/**
 * `chop 4byte <selector>`
 *
 * Look up 4-byte function selector from openchain.xyz signature database.
 */
export const fourByteCommand = Command.make(
	"4byte",
	{
		selector: Args.text({ name: "selector" }).pipe(
			Args.withDescription("4-byte function selector (0x-prefixed, 8 hex chars)"),
		),
		json: jsonOption,
	},
	({ selector, json }) =>
		Effect.gen(function* () {
			const signatures = yield* fourByteHandler(selector)

			if (json) {
				yield* Console.log(JSON.stringify({ result: signatures }))
			} else {
				if (signatures.length === 0) {
					yield* Console.log("No matching signatures found")
				} else {
					yield* Console.log(signatures.join("\n"))
				}
			}
		}).pipe(handleCommandErrors),
).pipe(Command.withDescription("Look up 4-byte function selector"))

/**
 * `chop 4byte-event <topic>`
 *
 * Look up 32-byte event topic from openchain.xyz signature database.
 */
export const fourByteEventCommand = Command.make(
	"4byte-event",
	{
		topic: Args.text({ name: "topic" }).pipe(Args.withDescription("32-byte event topic (0x-prefixed, 64 hex chars)")),
		json: jsonOption,
	},
	({ topic, json }) =>
		Effect.gen(function* () {
			const signatures = yield* fourByteEventHandler(topic)

			if (json) {
				yield* Console.log(JSON.stringify({ result: signatures }))
			} else {
				if (signatures.length === 0) {
					yield* Console.log("No matching signatures found")
				} else {
					yield* Console.log(signatures.join("\n"))
				}
			}
		}).pipe(handleCommandErrors),
).pipe(Command.withDescription("Look up event topic signature"))

// ============================================================================
// Exports
// ============================================================================

/** All bytecode analysis subcommands for registration with the root command. */
export const bytecodeCommands = [disassembleCommand, fourByteCommand, fourByteEventCommand] as const
