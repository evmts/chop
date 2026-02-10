import { describe, it } from "@effect/vitest"
import { decodeParameters, encodeParameters } from "@tevm/voltaire/Abi"
import { Effect } from "effect"
import { expect } from "vitest"
import { Abi, Hex } from "voltaire-effect"
import { runCli } from "../test-helpers.js"
import {
	AbiError,
	ArgumentCountError,
	HexDecodeError,
	InvalidSignatureError,
	abiCommands,
	abiDecodeCommand,
	abiDecodeHandler,
	abiEncodeCommand,
	abiEncodeHandler,
	buildAbiItem,
	calldataCommand,
	calldataDecodeCommand,
	calldataDecodeHandler,
	calldataHandler,
	coerceArgValue,
	formatValue,
	parseSignature,
	toParams,
	validateArgCount,
	validateHexData,
} from "./abi.js"

// ---------------------------------------------------------------------------
// parseSignature
// ---------------------------------------------------------------------------

describe("parseSignature", () => {
	it.effect("parses simple function signature", () =>
		Effect.gen(function* () {
			const result = yield* parseSignature("transfer(address,uint256)")
			expect(result.name).toBe("transfer")
			expect(result.inputs).toEqual([{ type: "address" }, { type: "uint256" }])
			expect(result.outputs).toEqual([])
		}),
	)

	it.effect("parses signature with outputs", () =>
		Effect.gen(function* () {
			const result = yield* parseSignature("balanceOf(address)(uint256)")
			expect(result.name).toBe("balanceOf")
			expect(result.inputs).toEqual([{ type: "address" }])
			expect(result.outputs).toEqual([{ type: "uint256" }])
		}),
	)

	it.effect("parses signature with empty params", () =>
		Effect.gen(function* () {
			const result = yield* parseSignature("totalSupply()")
			expect(result.name).toBe("totalSupply")
			expect(result.inputs).toEqual([])
			expect(result.outputs).toEqual([])
		}),
	)

	it.effect("parses signature with multiple outputs", () =>
		Effect.gen(function* () {
			const result = yield* parseSignature("getReserves()(uint112,uint112,uint32)")
			expect(result.name).toBe("getReserves")
			expect(result.inputs).toEqual([])
			expect(result.outputs).toEqual([{ type: "uint112" }, { type: "uint112" }, { type: "uint32" }])
		}),
	)

	it.effect("parses signature without function name", () =>
		Effect.gen(function* () {
			const result = yield* parseSignature("(address,uint256)")
			expect(result.name).toBe("")
			expect(result.inputs).toEqual([{ type: "address" }, { type: "uint256" }])
		}),
	)

	it.effect("parses signature with tuple types", () =>
		Effect.gen(function* () {
			const result = yield* parseSignature("foo((uint256,address))")
			expect(result.name).toBe("foo")
			expect(result.inputs).toEqual([{ type: "(uint256,address)" }])
		}),
	)

	it.effect("parses signature with nested tuple types", () =>
		Effect.gen(function* () {
			const result = yield* parseSignature("bar((uint256,(address,bool)),bytes)")
			expect(result.name).toBe("bar")
			expect(result.inputs).toEqual([{ type: "(uint256,(address,bool))" }, { type: "bytes" }])
		}),
	)

	it.effect("parses signature with tuple array types", () =>
		Effect.gen(function* () {
			const result = yield* parseSignature("baz((uint256,address)[],uint8)")
			expect(result.name).toBe("baz")
			expect(result.inputs).toEqual([{ type: "(uint256,address)[]" }, { type: "uint8" }])
		}),
	)

	it.effect("fails on empty string", () =>
		Effect.gen(function* () {
			const error = yield* parseSignature("").pipe(Effect.flip)
			expect(error._tag).toBe("InvalidSignatureError")
		}),
	)

	it.effect("fails on string without parens", () =>
		Effect.gen(function* () {
			const error = yield* parseSignature("transfer").pipe(Effect.flip)
			expect(error._tag).toBe("InvalidSignatureError")
		}),
	)

	it.effect("fails on unclosed parens", () =>
		Effect.gen(function* () {
			const error = yield* parseSignature("transfer(address").pipe(Effect.flip)
			expect(error._tag).toBe("InvalidSignatureError")
		}),
	)
})

// ---------------------------------------------------------------------------
// coerceArgValue
// ---------------------------------------------------------------------------

describe("coerceArgValue", () => {
	it.effect("coerces address to Uint8Array", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("address", "0x0000000000000000000000000000000000001234")
			expect(result).toBeInstanceOf(Uint8Array)
			expect((result as Uint8Array).length).toBe(20)
		}),
	)

	it.effect("coerces uint256 to bigint", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("uint256", "1000000000000000000")
			expect(result).toBe(1000000000000000000n)
		}),
	)

	it.effect("coerces uint8 to bigint", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("uint8", "255")
			expect(result).toBe(255n)
		}),
	)

	it.effect("coerces int256 to bigint (negative)", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("int256", "-42")
			expect(result).toBe(-42n)
		}),
	)

	it.effect("coerces bool true", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("bool", "true")
			expect(result).toBe(true)
		}),
	)

	it.effect("coerces bool false", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("bool", "false")
			expect(result).toBe(false)
		}),
	)

	it.effect("coerces bool from 1", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("bool", "1")
			expect(result).toBe(true)
		}),
	)

	it.effect("coerces bool from 0", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("bool", "0")
			expect(result).toBe(false)
		}),
	)

	it.effect("passes through string type", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("string", "hello")
			expect(result).toBe("hello")
		}),
	)

	it.effect("coerces bytes32 to Uint8Array", () =>
		Effect.gen(function* () {
			const hex = `0x${"ab".repeat(32)}`
			const result = yield* coerceArgValue("bytes32", hex)
			expect(result).toBeInstanceOf(Uint8Array)
			expect((result as Uint8Array).length).toBe(32)
		}),
	)

	it.effect("coerces bytes to Uint8Array", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("bytes", "0xdeadbeef")
			expect(result).toBeInstanceOf(Uint8Array)
			expect((result as Uint8Array).length).toBe(4)
		}),
	)

	it.effect("fails gracefully on invalid address hex", () =>
		Effect.gen(function* () {
			const error = yield* coerceArgValue("address", "not-hex").pipe(Effect.flip)
			expect(error._tag).toBe("AbiError")
		}),
	)

	it.effect("fails gracefully on invalid bytes hex", () =>
		Effect.gen(function* () {
			const error = yield* coerceArgValue("bytes32", "not-hex").pipe(Effect.flip)
			expect(error._tag).toBe("AbiError")
		}),
	)

	it.effect("coerces uint256[] array type", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("uint256[]", "[1,2,3]")
			expect(result).toEqual([1n, 2n, 3n])
		}),
	)

	it.effect("coerces address[] array type", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("address[]", '["0x0000000000000000000000000000000000001234"]')
			expect(Array.isArray(result)).toBe(true)
			expect((result as unknown[])[0]).toBeInstanceOf(Uint8Array)
		}),
	)

	it.effect("fails on invalid array JSON", () =>
		Effect.gen(function* () {
			const error = yield* coerceArgValue("uint256[]", "not-json").pipe(Effect.flip)
			expect(error._tag).toBe("AbiError")
		}),
	)
})

// ---------------------------------------------------------------------------
// formatValue
// ---------------------------------------------------------------------------

describe("formatValue", () => {
	it("formats Uint8Array as hex", () => {
		expect(formatValue(new Uint8Array([0xab, 0xcd]))).toBe("0xabcd")
	})

	it("formats bigint as decimal string", () => {
		expect(formatValue(1000000000000000000n)).toBe("1000000000000000000")
	})

	it("formats string as is", () => {
		expect(formatValue("hello")).toBe("hello")
	})

	it("formats boolean as string", () => {
		expect(formatValue(true)).toBe("true")
		expect(formatValue(false)).toBe("false")
	})

	it("formats hex string address as is", () => {
		expect(formatValue("0x0000000000000000000000000000000000001234")).toBe("0x0000000000000000000000000000000000001234")
	})
})

// ---------------------------------------------------------------------------
// ABI encode integration tests
// ---------------------------------------------------------------------------

describe("abi-encode integration", () => {
	it.effect("encodes transfer(address,uint256) correctly", () =>
		Effect.gen(function* () {
			const sig = yield* parseSignature("transfer(address,uint256)")
			const rawArgs = ["0x0000000000000000000000000000000000001234", "1000000000000000000"]
			// biome-ignore lint/style/noNonNullAssertion: index safe — validated by arg count check
			const coerced = yield* Effect.all(sig.inputs.map((p, i) => coerceArgValue(p.type, rawArgs[i]!)))

			const encoded = encodeParameters(toParams(sig.inputs), coerced as [unknown, ...unknown[]])
			const hex = Hex.fromBytes(encoded)

			expect(hex).toBe(
				"0x00000000000000000000000000000000000000000000000000000000000012340000000000000000000000000000000000000000000000000de0b6b3a7640000",
			)
		}),
	)

	it.effect("encodes single bool correctly", () =>
		Effect.gen(function* () {
			const sig = yield* parseSignature("approve(bool)")
			const coerced = yield* Effect.all([coerceArgValue("bool", "true")])
			const encoded = encodeParameters(toParams(sig.inputs), coerced as [unknown, ...unknown[]])
			const hex = Hex.fromBytes(encoded)

			expect(hex).toBe("0x0000000000000000000000000000000000000000000000000000000000000001")
		}),
	)
})

// ---------------------------------------------------------------------------
// ABI decode integration tests
// ---------------------------------------------------------------------------

describe("abi-decode integration", () => {
	it.effect("decodes transfer(address,uint256) correctly", () =>
		Effect.gen(function* () {
			const sig = yield* parseSignature("transfer(address,uint256)")
			const data =
				"0x00000000000000000000000000000000000000000000000000000000000012340000000000000000000000000000000000000000000000000de0b6b3a7640000"
			const bytes = Hex.toBytes(data)

			const decoded = decodeParameters(toParams(sig.inputs), bytes)

			expect(decoded[0]).toBe("0x0000000000000000000000000000000000001234")
			expect(decoded[1]).toBe(1000000000000000000n)
		}),
	)
})

// ---------------------------------------------------------------------------
// Calldata encode integration tests
// ---------------------------------------------------------------------------

describe("calldata integration", () => {
	it.effect("produces correct selector + encoded args", () =>
		Effect.gen(function* () {
			const sig = yield* parseSignature("transfer(address,uint256)")
			const rawArgs = ["0x0000000000000000000000000000000000001234", "1000000000000000000"]
			// biome-ignore lint/style/noNonNullAssertion: index safe — validated by arg count check
			const coerced = yield* Effect.all(sig.inputs.map((p, i) => coerceArgValue(p.type, rawArgs[i]!)))

			const abiItem = {
				type: "function" as const,
				name: sig.name,
				stateMutability: "nonpayable" as const,
				inputs: toParams(sig.inputs.map((p, i) => ({ type: p.type, name: `arg${i}` }))),
				outputs: toParams([]),
			}

			const calldata = yield* Abi.encodeFunction(
				// biome-ignore lint/suspicious/noExplicitAny: voltaire Parameter type conflict
				[abiItem] as any,
				sig.name,
				coerced,
			)

			// transfer(address,uint256) selector is 0xa9059cbb
			expect(calldata.startsWith("0xa9059cbb")).toBe(true)
			expect(calldata).toBe(
				"0xa9059cbb00000000000000000000000000000000000000000000000000000000000012340000000000000000000000000000000000000000000000000de0b6b3a7640000",
			)
		}),
	)
})

// ---------------------------------------------------------------------------
// Calldata decode integration tests
// ---------------------------------------------------------------------------

describe("calldata-decode integration", () => {
	it.effect("decodes calldata correctly", () =>
		Effect.gen(function* () {
			const sig = yield* parseSignature("transfer(address,uint256)")
			const calldata =
				"0xa9059cbb00000000000000000000000000000000000000000000000000000000000012340000000000000000000000000000000000000000000000000de0b6b3a7640000"

			const abiItem = {
				type: "function" as const,
				name: sig.name,
				stateMutability: "nonpayable" as const,
				inputs: toParams(sig.inputs.map((p, i) => ({ type: p.type, name: `arg${i}` }))),
				outputs: toParams([]),
			}

			const calldataBytes = Hex.toBytes(calldata)
			const decoded = yield* Abi.decodeFunction(
				// biome-ignore lint/suspicious/noExplicitAny: voltaire Parameter type conflict
				[abiItem] as any,
				calldataBytes,
			)

			expect(decoded.name).toBe("transfer")
			expect(decoded.params[0]).toBe("0x0000000000000000000000000000000000001234")
			expect(decoded.params[1]).toBe(1000000000000000000n)
		}),
	)
})

// ---------------------------------------------------------------------------
// Round-trip tests
// ---------------------------------------------------------------------------

describe("round-trip", () => {
	it.effect("abi-encode -> abi-decode produces original values", () =>
		Effect.gen(function* () {
			const sig = yield* parseSignature("transfer(address,uint256)")
			const rawArgs = ["0x0000000000000000000000000000000000001234", "1000000000000000000"]
			// biome-ignore lint/style/noNonNullAssertion: index safe — validated by arg count check
			const coerced = yield* Effect.all(sig.inputs.map((p, i) => coerceArgValue(p.type, rawArgs[i]!)))

			const encoded = encodeParameters(toParams(sig.inputs), coerced as [unknown, ...unknown[]])
			const decoded = decodeParameters(toParams(sig.inputs), encoded)

			expect(decoded[0]).toBe("0x0000000000000000000000000000000000001234")
			expect(decoded[1]).toBe(1000000000000000000n)
		}),
	)

	it.effect("calldata-encode -> calldata-decode produces original values", () =>
		Effect.gen(function* () {
			const sig = yield* parseSignature("transfer(address,uint256)")
			const rawArgs = ["0x0000000000000000000000000000000000001234", "1000000000000000000"]
			// biome-ignore lint/style/noNonNullAssertion: index safe — validated by arg count check
			const coerced = yield* Effect.all(sig.inputs.map((p, i) => coerceArgValue(p.type, rawArgs[i]!)))

			const abiItem = {
				type: "function" as const,
				name: sig.name,
				stateMutability: "nonpayable" as const,
				inputs: toParams(sig.inputs.map((p, i) => ({ type: p.type, name: `arg${i}` }))),
				outputs: toParams([]),
			}

			const calldata = yield* Abi.encodeFunction(
				// biome-ignore lint/suspicious/noExplicitAny: voltaire Parameter type conflict
				[abiItem] as any,
				sig.name,
				coerced,
			)
			const calldataBytes = Hex.toBytes(calldata)
			const decoded = yield* Abi.decodeFunction(
				// biome-ignore lint/suspicious/noExplicitAny: voltaire Parameter type conflict
				[abiItem] as any,
				calldataBytes,
			)

			expect(decoded.name).toBe("transfer")
			expect(decoded.params[0]).toBe("0x0000000000000000000000000000000000001234")
			expect(decoded.params[1]).toBe(1000000000000000000n)
		}),
	)
})

// ---------------------------------------------------------------------------
// Error handling tests
// ---------------------------------------------------------------------------

describe("error handling", () => {
	it("ArgumentCountError has correct tag and fields", () => {
		const error = new ArgumentCountError({
			message: "Expected 2 arguments, got 1",
			expected: 2,
			received: 1,
		})
		expect(error._tag).toBe("ArgumentCountError")
		expect(error.expected).toBe(2)
		expect(error.received).toBe(1)
	})

	it("HexDecodeError has correct tag and fields", () => {
		const error = new HexDecodeError({
			message: "Invalid hex data",
			data: "not-hex",
		})
		expect(error._tag).toBe("HexDecodeError")
		expect(error.data).toBe("not-hex")
	})

	it("InvalidSignatureError has correct tag and fields", () => {
		const error = new InvalidSignatureError({
			message: "Invalid signature",
			signature: "bad",
		})
		expect(error._tag).toBe("InvalidSignatureError")
		expect(error.signature).toBe("bad")
	})

	it("AbiError has correct tag and fields", () => {
		const error = new AbiError({
			message: "encoding failed",
		})
		expect(error._tag).toBe("AbiError")
		expect(error.message).toBe("encoding failed")
	})
})

// ---------------------------------------------------------------------------
// E2E CLI tests
// ---------------------------------------------------------------------------

describe("chop abi-encode (E2E)", () => {
	it("encodes transfer(address,uint256) correctly", () => {
		const result = runCli(
			"abi-encode 'transfer(address,uint256)' 0x0000000000000000000000000000000000001234 1000000000000000000",
		)
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe(
			"0x00000000000000000000000000000000000000000000000000000000000012340000000000000000000000000000000000000000000000000de0b6b3a7640000",
		)
	})

	it("produces JSON output with --json flag", () => {
		const result = runCli(
			"abi-encode --json 'transfer(address,uint256)' 0x0000000000000000000000000000000000001234 1000000000000000000",
		)
		expect(result.exitCode).toBe(0)
		const parsed = JSON.parse(result.stdout.trim())
		expect(parsed.result).toBe(
			"0x00000000000000000000000000000000000000000000000000000000000012340000000000000000000000000000000000000000000000000de0b6b3a7640000",
		)
	})

	it("exits 1 on invalid signature", () => {
		const result = runCli("abi-encode 'notvalid' 0x1234")
		expect(result.exitCode).not.toBe(0)
	})

	it("exits 1 on wrong arg count", () => {
		const result = runCli("abi-encode 'transfer(address,uint256)' 0x0000000000000000000000000000000000001234")
		expect(result.exitCode).not.toBe(0)
	})

	it("encodes with --packed flag", () => {
		const result = runCli("abi-encode --packed '(uint16,bool)' 1 true")
		expect(result.exitCode).toBe(0)
		const output = result.stdout.trim()
		// packed encoding: uint16(1) = 0x0001, bool(true) = 0x01
		expect(output).toBe("0x000101")
	})

	it("produces JSON output with --packed --json flags", () => {
		const result = runCli("abi-encode --packed --json '(uint16,bool)' 1 true")
		expect(result.exitCode).toBe(0)
		const parsed = JSON.parse(result.stdout.trim())
		expect(parsed.result).toBe("0x000101")
	})
})

describe("chop calldata (E2E)", () => {
	it("produces correct selector + encoded args", () => {
		const result = runCli(
			"calldata 'transfer(address,uint256)' 0x0000000000000000000000000000000000001234 1000000000000000000",
		)
		expect(result.exitCode).toBe(0)
		const output = result.stdout.trim()
		expect(output.startsWith("0xa9059cbb")).toBe(true)
		expect(output).toBe(
			"0xa9059cbb00000000000000000000000000000000000000000000000000000000000012340000000000000000000000000000000000000000000000000de0b6b3a7640000",
		)
	})

	it("produces JSON output with --json flag", () => {
		const result = runCli(
			"calldata --json 'transfer(address,uint256)' 0x0000000000000000000000000000000000001234 1000000000000000000",
		)
		expect(result.exitCode).toBe(0)
		const parsed = JSON.parse(result.stdout.trim())
		expect(parsed.result.startsWith("0xa9059cbb")).toBe(true)
	})
})

describe("chop abi-decode (E2E)", () => {
	it("decodes ABI data correctly", () => {
		const result = runCli(
			"abi-decode 'transfer(address,uint256)' 0x00000000000000000000000000000000000000000000000000000000000012340000000000000000000000000000000000000000000000000de0b6b3a7640000",
		)
		expect(result.exitCode).toBe(0)
		const lines = result.stdout.trim().split("\n")
		expect(lines[0]).toBe("0x0000000000000000000000000000000000001234")
		expect(lines[1]).toBe("1000000000000000000")
	})

	it("produces JSON output with --json flag", () => {
		const result = runCli(
			"abi-decode --json 'transfer(address,uint256)' 0x00000000000000000000000000000000000000000000000000000000000012340000000000000000000000000000000000000000000000000de0b6b3a7640000",
		)
		expect(result.exitCode).toBe(0)
		const parsed = JSON.parse(result.stdout.trim())
		expect(parsed.result).toBeInstanceOf(Array)
		expect(parsed.result[0]).toBe("0x0000000000000000000000000000000000001234")
		expect(parsed.result[1]).toBe("1000000000000000000")
	})

	it("exits 1 on invalid hex data", () => {
		const result = runCli("abi-decode 'transfer(address,uint256)' not-hex-data")
		expect(result.exitCode).not.toBe(0)
	})
})

describe("chop calldata-decode (E2E)", () => {
	it("decodes calldata correctly", () => {
		const result = runCli(
			"calldata-decode 'transfer(address,uint256)' 0xa9059cbb00000000000000000000000000000000000000000000000000000000000012340000000000000000000000000000000000000000000000000de0b6b3a7640000",
		)
		expect(result.exitCode).toBe(0)
		const output = result.stdout.trim()
		expect(output).toContain("transfer")
		expect(output).toContain("0x0000000000000000000000000000000000001234")
		expect(output).toContain("1000000000000000000")
	})

	it("produces JSON output with --json flag", () => {
		const result = runCli(
			"calldata-decode --json 'transfer(address,uint256)' 0xa9059cbb00000000000000000000000000000000000000000000000000000000000012340000000000000000000000000000000000000000000000000de0b6b3a7640000",
		)
		expect(result.exitCode).toBe(0)
		const parsed = JSON.parse(result.stdout.trim())
		expect(parsed.name).toBe("transfer")
		expect(parsed.args).toBeInstanceOf(Array)
	})

	it("exits 1 on invalid hex data", () => {
		const result = runCli("calldata-decode 'transfer(address,uint256)' not-hex-data")
		expect(result.exitCode).not.toBe(0)
	})
})

// ===========================================================================
// BOUNDARY CONDITIONS + EDGE CASES
// ===========================================================================

// ---------------------------------------------------------------------------
// parseSignature — boundary and edge cases
// ---------------------------------------------------------------------------

describe("parseSignature — boundary conditions", () => {
	it.effect("handles whitespace-padded signatures", () =>
		Effect.gen(function* () {
			const result = yield* parseSignature("  transfer(address,uint256)  ")
			expect(result.name).toBe("transfer")
			expect(result.inputs).toEqual([{ type: "address" }, { type: "uint256" }])
		}),
	)

	it.effect("handles single param type", () =>
		Effect.gen(function* () {
			const result = yield* parseSignature("decimals()(uint8)")
			expect(result.name).toBe("decimals")
			expect(result.inputs).toEqual([])
			expect(result.outputs).toEqual([{ type: "uint8" }])
		}),
	)

	it.effect("handles underscored function names", () =>
		Effect.gen(function* () {
			const result = yield* parseSignature("_my_func(uint256)")
			expect(result.name).toBe("_my_func")
			expect(result.inputs).toEqual([{ type: "uint256" }])
		}),
	)

	it.effect("fails on function name starting with number", () =>
		Effect.gen(function* () {
			const error = yield* parseSignature("1bad(uint256)").pipe(Effect.flip)
			expect(error._tag).toBe("InvalidSignatureError")
			expect(error.signature).toBe("1bad(uint256)")
		}),
	)

	it.effect("fails on function name with special chars", () =>
		Effect.gen(function* () {
			const error = yield* parseSignature("foo-bar(uint256)").pipe(Effect.flip)
			expect(error._tag).toBe("InvalidSignatureError")
		}),
	)

	it.effect("fails on function name with dots", () =>
		Effect.gen(function* () {
			const error = yield* parseSignature("foo.bar(uint256)").pipe(Effect.flip)
			expect(error._tag).toBe("InvalidSignatureError")
		}),
	)

	it.effect("fails on trailing garbage after output parens", () =>
		Effect.gen(function* () {
			const error = yield* parseSignature("foo(uint256)(bool)extra").pipe(Effect.flip)
			expect(error._tag).toBe("InvalidSignatureError")
		}),
	)

	it.effect("fails on triple paren groups", () =>
		Effect.gen(function* () {
			const error = yield* parseSignature("foo(uint256)(bool)(address)").pipe(Effect.flip)
			expect(error._tag).toBe("InvalidSignatureError")
		}),
	)

	it.effect("handles many input params", () =>
		Effect.gen(function* () {
			const types = Array.from({ length: 20 }, () => "uint256").join(",")
			const result = yield* parseSignature(`bigFunc(${types})`)
			expect(result.name).toBe("bigFunc")
			expect(result.inputs.length).toBe(20)
		}),
	)

	it.effect("handles complex nested tuples with arrays", () =>
		Effect.gen(function* () {
			const result = yield* parseSignature("complex((uint256,(address,bool)[])[],bytes32)")
			expect(result.name).toBe("complex")
			expect(result.inputs.length).toBe(2)
			expect(result.inputs[0]?.type).toBe("(uint256,(address,bool)[])[]")
			expect(result.inputs[1]?.type).toBe("bytes32")
		}),
	)

	it.effect("parses empty outputs explicitly", () =>
		Effect.gen(function* () {
			const result = yield* parseSignature("foo(uint256)()")
			expect(result.name).toBe("foo")
			expect(result.inputs).toEqual([{ type: "uint256" }])
			expect(result.outputs).toEqual([])
		}),
	)

	it.effect("error message includes the original signature", () =>
		Effect.gen(function* () {
			const error = yield* parseSignature("bad").pipe(Effect.flip)
			expect(error.message).toContain("bad")
		}),
	)
})

// ---------------------------------------------------------------------------
// coerceArgValue — boundary and edge cases
// ---------------------------------------------------------------------------

describe("coerceArgValue — boundary conditions", () => {
	it.effect("coerces uint256 max value", () =>
		Effect.gen(function* () {
			const maxU256 = (2n ** 256n - 1n).toString()
			const result = yield* coerceArgValue("uint256", maxU256)
			expect(result).toBe(2n ** 256n - 1n)
		}),
	)

	it.effect("coerces uint256 zero", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("uint256", "0")
			expect(result).toBe(0n)
		}),
	)

	it.effect("coerces int256 min value (large negative)", () =>
		Effect.gen(function* () {
			const minI256 = (-(2n ** 255n)).toString()
			const result = yield* coerceArgValue("int256", minI256)
			expect(result).toBe(-(2n ** 255n))
		}),
	)

	it.effect("coerces zero address", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("address", "0x0000000000000000000000000000000000000000")
			expect(result).toBeInstanceOf(Uint8Array)
			const bytes = result as Uint8Array
			expect(bytes.length).toBe(20)
			expect(bytes.every((b) => b === 0)).toBe(true)
		}),
	)

	it.effect("coerces max address (all ff)", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("address", "0xffffffffffffffffffffffffffffffffffffffff")
			expect(result).toBeInstanceOf(Uint8Array)
			const bytes = result as Uint8Array
			expect(bytes.length).toBe(20)
			expect(bytes.every((b) => b === 0xff)).toBe(true)
		}),
	)

	it.effect("coerces empty bytes (bytes type)", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("bytes", "0x")
			expect(result).toBeInstanceOf(Uint8Array)
			expect((result as Uint8Array).length).toBe(0)
		}),
	)

	it.effect("coerces string with unicode", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("string", "hello 🌍 世界")
			expect(result).toBe("hello 🌍 世界")
		}),
	)

	it.effect("coerces empty string", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("string", "")
			expect(result).toBe("")
		}),
	)

	it.effect("coerces bool from arbitrary string as false", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("bool", "notbool")
			expect(result).toBe(false)
		}),
	)

	it.effect("fails on non-numeric uint value", () =>
		Effect.gen(function* () {
			const error = yield* coerceArgValue("uint256", "abc").pipe(Effect.flip)
			expect(error._tag).toBe("AbiError")
			expect(error.message).toContain("Invalid integer")
		}),
	)

	it.effect("fails on float for uint type", () =>
		Effect.gen(function* () {
			const error = yield* coerceArgValue("uint256", "1.5").pipe(Effect.flip)
			expect(error._tag).toBe("AbiError")
		}),
	)

	it.effect("coerces fixed-size array uint256[3]", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("uint256[3]", "[10,20,30]")
			expect(result).toEqual([10n, 20n, 30n])
		}),
	)

	it.effect("coerces bool[] array type", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("bool[]", "[true,false,true]")
			expect(result).toEqual([true, false, true])
		}),
	)

	it.effect("coerces empty array", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("uint256[]", "[]")
			expect(result).toEqual([])
		}),
	)

	it.effect("passes through unknown types", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("customType", "someValue")
			expect(result).toBe("someValue")
		}),
	)

	it.effect("coerces checksummed address", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("address", "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")
			expect(result).toBeInstanceOf(Uint8Array)
			expect((result as Uint8Array).length).toBe(20)
		}),
	)

	it.effect("fails on non-array JSON for array type", () =>
		Effect.gen(function* () {
			const error = yield* coerceArgValue("uint256[]", '"not-array"').pipe(Effect.flip)
			expect(error._tag).toBe("AbiError")
			expect(error.message).toContain("expected JSON array")
		}),
	)
})

// ---------------------------------------------------------------------------
// formatValue — boundary and edge cases
// ---------------------------------------------------------------------------

describe("formatValue — boundary conditions", () => {
	it("formats empty Uint8Array as 0x", () => {
		expect(formatValue(new Uint8Array([]))).toBe("0x")
	})

	it("formats zero bigint", () => {
		expect(formatValue(0n)).toBe("0")
	})

	it("formats max uint256", () => {
		const max = 2n ** 256n - 1n
		expect(formatValue(max)).toBe(max.toString())
	})

	it("formats negative bigint", () => {
		expect(formatValue(-42n)).toBe("-42")
	})

	it("formats nested arrays", () => {
		const result = formatValue([1n, [2n, 3n]])
		expect(result).toBe("[1, [2, 3]]")
	})

	it("formats empty array", () => {
		expect(formatValue([])).toBe("[]")
	})

	it("formats mixed array", () => {
		const result = formatValue([new Uint8Array([0xab]), 42n, "hello"])
		expect(result).toBe("[0xab, 42, hello]")
	})

	it("formats number as string", () => {
		expect(formatValue(42)).toBe("42")
	})

	it("formats null as string", () => {
		expect(formatValue(null)).toBe("null")
	})

	it("formats undefined as string", () => {
		expect(formatValue(undefined)).toBe("undefined")
	})

	it("formats single byte Uint8Array", () => {
		expect(formatValue(new Uint8Array([0x00]))).toBe("0x00")
	})

	it("formats large Uint8Array (32 bytes)", () => {
		const bytes = new Uint8Array(32).fill(0xff)
		expect(formatValue(bytes)).toBe(`0x${"ff".repeat(32)}`)
	})
})

// ---------------------------------------------------------------------------
// Error types — extended tests
// ---------------------------------------------------------------------------

describe("error types — Data.TaggedError semantics", () => {
	it.effect("InvalidSignatureError can be caught by tag in Effect pipeline", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(new InvalidSignatureError({ message: "bad sig", signature: "xyz" })).pipe(
				Effect.catchTag("InvalidSignatureError", (e) => Effect.succeed(`caught: ${e.signature}`)),
			)
			expect(result).toBe("caught: xyz")
		}),
	)

	it.effect("ArgumentCountError can be caught by tag in Effect pipeline", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(
				new ArgumentCountError({ message: "wrong count", expected: 3, received: 1 }),
			).pipe(Effect.catchTag("ArgumentCountError", (e) => Effect.succeed(`${e.expected}:${e.received}`)))
			expect(result).toBe("3:1")
		}),
	)

	it.effect("HexDecodeError can be caught by tag in Effect pipeline", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(new HexDecodeError({ message: "bad hex", data: "0xZZ" })).pipe(
				Effect.catchTag("HexDecodeError", (e) => Effect.succeed(`bad: ${e.data}`)),
			)
			expect(result).toBe("bad: 0xZZ")
		}),
	)

	it("AbiError with cause preserves cause chain", () => {
		const original = new Error("original cause")
		const error = new AbiError({ message: "wrapped", cause: original })
		expect(error.cause).toBe(original)
		expect(error._tag).toBe("AbiError")
	})

	it("AbiError without cause has undefined cause", () => {
		const error = new AbiError({ message: "no cause" })
		expect(error.cause).toBeUndefined()
	})
})

// ---------------------------------------------------------------------------
// toParams — tests
// ---------------------------------------------------------------------------

describe("toParams", () => {
	it("returns same array reference", () => {
		const input = [{ type: "uint256" }, { type: "address" }]
		expect(toParams(input)).toBe(input)
	})

	it("handles empty array", () => {
		expect(toParams([])).toEqual([])
	})

	it("handles single element", () => {
		const input = [{ type: "bool" }]
		expect(toParams(input)).toBe(input)
	})
})

// ---------------------------------------------------------------------------
// E2E — additional boundary/edge case CLI tests
// ---------------------------------------------------------------------------

describe("chop abi-encode (E2E) — edge cases", () => {
	it("encodes zero-arg function signature", () => {
		const result = runCli("abi-encode '()'")
		expect(result.exitCode).toBe(0)
		// No args, no output
		expect(result.stdout.trim()).toBe("0x")
	})

	it("encodes single bool correctly via CLI", () => {
		const result = runCli("abi-encode '(bool)' true")
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("0x0000000000000000000000000000000000000000000000000000000000000001")
	})

	it("encodes zero value uint256", () => {
		const result = runCli("abi-encode '(uint256)' 0")
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("0x0000000000000000000000000000000000000000000000000000000000000000")
	})

	it("encodes string type correctly", () => {
		const result = runCli("abi-encode '(string)' hello")
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim().startsWith("0x")).toBe(true)
	})

	it("errors on too many arguments", () => {
		const result = runCli("abi-encode '(uint256)' 1 2 3")
		expect(result.exitCode).not.toBe(0)
	})
})

describe("chop calldata (E2E) — edge cases", () => {
	it("errors when signature has no function name", () => {
		const result = runCli("calldata '(uint256)' 42")
		expect(result.exitCode).not.toBe(0)
	})

	it("encodes function with no args", () => {
		const result = runCli("calldata 'totalSupply()'")
		expect(result.exitCode).toBe(0)
		const output = result.stdout.trim()
		// Should be just the 4-byte selector
		expect(output.length).toBe(10) // 0x + 8 hex chars
		expect(output.startsWith("0x")).toBe(true)
	})
})

describe("chop abi-decode (E2E) — edge cases", () => {
	it("decodes using output types when specified", () => {
		// balanceOf(address)(uint256) — decode with output type uint256
		const encoded = "0x0000000000000000000000000000000000000000000000000de0b6b3a7640000"
		const result = runCli(`abi-decode 'balanceOf(address)(uint256)' ${encoded}`)
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("1000000000000000000")
	})

	it("exits 1 on hex without 0x prefix", () => {
		const result = runCli("abi-decode '(uint256)' deadbeef")
		expect(result.exitCode).not.toBe(0)
	})

	it("exits 1 on odd-length hex", () => {
		const result = runCli("abi-decode '(uint256)' 0xabc")
		expect(result.exitCode).not.toBe(0)
	})

	it("exits 1 on hex with invalid characters", () => {
		const result = runCli("abi-decode '(uint256)' 0xGGHH")
		expect(result.exitCode).not.toBe(0)
	})
})

describe("chop calldata-decode (E2E) — edge cases", () => {
	it("errors when signature has no function name", () => {
		const result = runCli(
			"calldata-decode '(uint256)' 0xa9059cbb0000000000000000000000000000000000000000000000000000000000000001",
		)
		expect(result.exitCode).not.toBe(0)
	})
})

// ---------------------------------------------------------------------------
// Round-trip — additional types
// ---------------------------------------------------------------------------

describe("round-trip — additional types", () => {
	it.effect("round-trips bool", () =>
		Effect.gen(function* () {
			const sig = yield* parseSignature("(bool)")
			const coerced = yield* Effect.all([coerceArgValue("bool", "true")])
			const encoded = encodeParameters(toParams(sig.inputs), coerced as [unknown, ...unknown[]])
			const decoded = decodeParameters(toParams(sig.inputs), encoded)
			expect(decoded[0]).toBe(true)
		}),
	)

	it.effect("round-trips multiple types", () =>
		Effect.gen(function* () {
			const sig = yield* parseSignature("(uint256,bool,uint8)")
			const rawArgs = ["42", "false", "7"]
			// biome-ignore lint/style/noNonNullAssertion: index is safe — rawArgs has 3 entries matching sig.inputs
			const coerced = yield* Effect.all(sig.inputs.map((p, i) => coerceArgValue(p.type, rawArgs[i]!)))
			const encoded = encodeParameters(toParams(sig.inputs), coerced as [unknown, ...unknown[]])
			const decoded = decodeParameters(toParams(sig.inputs), encoded)
			expect(decoded[0]).toBe(42n)
			expect(decoded[1]).toBe(false)
			expect(decoded[2]).toBe(7n)
		}),
	)

	it.effect("round-trips zero values", () =>
		Effect.gen(function* () {
			const sig = yield* parseSignature("(uint256)")
			const coerced = yield* Effect.all([coerceArgValue("uint256", "0")])
			const encoded = encodeParameters(toParams(sig.inputs), coerced as [unknown, ...unknown[]])
			const decoded = decodeParameters(toParams(sig.inputs), encoded)
			expect(decoded[0]).toBe(0n)
		}),
	)
})

// ---------------------------------------------------------------------------
// validateHexData — unit tests
// ---------------------------------------------------------------------------

describe("validateHexData", () => {
	it.effect("accepts valid hex data", () =>
		Effect.gen(function* () {
			const bytes = yield* validateHexData("0xdeadbeef")
			expect(bytes).toBeInstanceOf(Uint8Array)
			expect(bytes.length).toBe(4)
		}),
	)

	it.effect("accepts empty hex (0x)", () =>
		Effect.gen(function* () {
			const bytes = yield* validateHexData("0x")
			expect(bytes).toBeInstanceOf(Uint8Array)
			expect(bytes.length).toBe(0)
		}),
	)

	it.effect("accepts 32-byte hex", () =>
		Effect.gen(function* () {
			const hex = `0x${"ab".repeat(32)}`
			const bytes = yield* validateHexData(hex)
			expect(bytes.length).toBe(32)
		}),
	)

	it.effect("accepts uppercase hex", () =>
		Effect.gen(function* () {
			const bytes = yield* validateHexData("0xDEADBEEF")
			expect(bytes.length).toBe(4)
		}),
	)

	it.effect("accepts mixed case hex", () =>
		Effect.gen(function* () {
			const bytes = yield* validateHexData("0xDeAdBeEf")
			expect(bytes.length).toBe(4)
		}),
	)

	it.effect("fails on missing 0x prefix", () =>
		Effect.gen(function* () {
			const error = yield* validateHexData("deadbeef").pipe(Effect.flip)
			expect(error._tag).toBe("HexDecodeError")
			expect(error.data).toBe("deadbeef")
			expect(error.message).toContain("0x")
		}),
	)

	it.effect("fails on invalid hex characters", () =>
		Effect.gen(function* () {
			const error = yield* validateHexData("0xGGHH").pipe(Effect.flip)
			expect(error._tag).toBe("HexDecodeError")
			expect(error.message).toContain("Invalid hex")
		}),
	)

	it.effect("fails on odd-length hex string", () =>
		Effect.gen(function* () {
			const error = yield* validateHexData("0xabc").pipe(Effect.flip)
			expect(error._tag).toBe("HexDecodeError")
			expect(error.message).toContain("Odd-length")
		}),
	)

	it.effect("fails on hex with spaces", () =>
		Effect.gen(function* () {
			const error = yield* validateHexData("0xde ad").pipe(Effect.flip)
			expect(error._tag).toBe("HexDecodeError")
		}),
	)

	it.effect("fails on just 0x with trailing garbage", () =>
		Effect.gen(function* () {
			const error = yield* validateHexData("0xzz").pipe(Effect.flip)
			expect(error._tag).toBe("HexDecodeError")
		}),
	)
})

// ---------------------------------------------------------------------------
// validateArgCount — unit tests
// ---------------------------------------------------------------------------

describe("validateArgCount", () => {
	it.effect("succeeds when counts match", () =>
		Effect.gen(function* () {
			yield* validateArgCount(2, 2)
			// No error = success
		}),
	)

	it.effect("succeeds when both zero", () =>
		Effect.gen(function* () {
			yield* validateArgCount(0, 0)
		}),
	)

	it.effect("fails when fewer args provided", () =>
		Effect.gen(function* () {
			const error = yield* validateArgCount(3, 1).pipe(Effect.flip)
			expect(error._tag).toBe("ArgumentCountError")
			expect(error.expected).toBe(3)
			expect(error.received).toBe(1)
			expect(error.message).toContain("3")
			expect(error.message).toContain("1")
		}),
	)

	it.effect("fails when more args provided", () =>
		Effect.gen(function* () {
			const error = yield* validateArgCount(1, 5).pipe(Effect.flip)
			expect(error._tag).toBe("ArgumentCountError")
			expect(error.expected).toBe(1)
			expect(error.received).toBe(5)
		}),
	)

	it.effect("singular message for expected 1", () =>
		Effect.gen(function* () {
			const error = yield* validateArgCount(1, 0).pipe(Effect.flip)
			expect(error.message).toContain("1 argument,")
			expect(error.message).not.toContain("arguments,")
		}),
	)

	it.effect("plural message for expected != 1", () =>
		Effect.gen(function* () {
			const error = yield* validateArgCount(2, 0).pipe(Effect.flip)
			expect(error.message).toContain("arguments")
		}),
	)
})

// ---------------------------------------------------------------------------
// buildAbiItem — unit tests
// ---------------------------------------------------------------------------

describe("buildAbiItem", () => {
	it("builds correct structure for simple function", () => {
		const item = buildAbiItem({
			name: "transfer",
			inputs: [{ type: "address" }, { type: "uint256" }],
			outputs: [],
		})
		expect(item.type).toBe("function")
		expect(item.name).toBe("transfer")
		expect(item.stateMutability).toBe("nonpayable")
		expect(item.inputs).toEqual([
			{ type: "address", name: "arg0" },
			{ type: "uint256", name: "arg1" },
		])
		expect(item.outputs).toEqual([])
	})

	it("builds correct structure with outputs", () => {
		const item = buildAbiItem({
			name: "balanceOf",
			inputs: [{ type: "address" }],
			outputs: [{ type: "uint256" }],
		})
		expect(item.name).toBe("balanceOf")
		expect(item.inputs).toEqual([{ type: "address", name: "arg0" }])
		expect(item.outputs).toEqual([{ type: "uint256", name: "out0" }])
	})

	it("builds correct structure with no inputs or outputs", () => {
		const item = buildAbiItem({
			name: "totalSupply",
			inputs: [],
			outputs: [],
		})
		expect(item.name).toBe("totalSupply")
		expect(item.inputs).toEqual([])
		expect(item.outputs).toEqual([])
	})

	it("builds correct structure with multiple outputs", () => {
		const item = buildAbiItem({
			name: "getReserves",
			inputs: [],
			outputs: [{ type: "uint112" }, { type: "uint112" }, { type: "uint32" }],
		})
		expect(item.outputs).toEqual([
			{ type: "uint112", name: "out0" },
			{ type: "uint112", name: "out1" },
			{ type: "uint32", name: "out2" },
		])
	})

	it("handles empty name", () => {
		const item = buildAbiItem({
			name: "",
			inputs: [{ type: "uint256" }],
			outputs: [],
		})
		expect(item.name).toBe("")
	})
})

// ---------------------------------------------------------------------------
// abiEncodeHandler — in-process handler tests
// ---------------------------------------------------------------------------

describe("abiEncodeHandler", () => {
	it.effect("encodes transfer(address,uint256) correctly", () =>
		Effect.gen(function* () {
			const result = yield* abiEncodeHandler(
				"transfer(address,uint256)",
				["0x0000000000000000000000000000000000001234", "1000000000000000000"],
				false,
			)
			expect(result).toBe(
				"0x00000000000000000000000000000000000000000000000000000000000012340000000000000000000000000000000000000000000000000de0b6b3a7640000",
			)
		}),
	)

	it.effect("encodes with packed mode", () =>
		Effect.gen(function* () {
			const result = yield* abiEncodeHandler("(uint16,bool)", ["1", "true"], true)
			expect(result).toBe("0x000101")
		}),
	)

	it.effect("encodes empty args", () =>
		Effect.gen(function* () {
			const result = yield* abiEncodeHandler("()", [], false)
			expect(result).toBe("0x")
		}),
	)

	it.effect("fails on wrong arg count", () =>
		Effect.gen(function* () {
			const error = yield* abiEncodeHandler(
				"transfer(address,uint256)",
				["0x0000000000000000000000000000000000001234"],
				false,
			).pipe(Effect.flip)
			expect(error._tag).toBe("ArgumentCountError")
		}),
	)

	it.effect("fails on invalid signature", () =>
		Effect.gen(function* () {
			const error = yield* abiEncodeHandler("bad", ["1"], false).pipe(Effect.flip)
			expect(error._tag).toBe("InvalidSignatureError")
		}),
	)

	it.effect("encodes single uint256", () =>
		Effect.gen(function* () {
			const result = yield* abiEncodeHandler("(uint256)", ["42"], false)
			expect(result).toBe("0x000000000000000000000000000000000000000000000000000000000000002a")
		}),
	)
})

// ---------------------------------------------------------------------------
// calldataHandler — in-process handler tests
// ---------------------------------------------------------------------------

describe("calldataHandler", () => {
	it.effect("encodes transfer calldata correctly", () =>
		Effect.gen(function* () {
			const result = yield* calldataHandler("transfer(address,uint256)", [
				"0x0000000000000000000000000000000000001234",
				"1000000000000000000",
			])
			expect(result.startsWith("0xa9059cbb")).toBe(true)
		}),
	)

	it.effect("encodes function with no args", () =>
		Effect.gen(function* () {
			const result = yield* calldataHandler("totalSupply()", [])
			expect(result.startsWith("0x")).toBe(true)
			expect(result.length).toBe(10) // 0x + 8 hex chars
		}),
	)

	it.effect("fails when signature has no function name", () =>
		Effect.gen(function* () {
			const error = yield* calldataHandler("(uint256)", ["42"]).pipe(Effect.flip)
			expect(error._tag).toBe("InvalidSignatureError")
			expect(error.message).toContain("function name")
		}),
	)

	it.effect("fails on wrong arg count", () =>
		Effect.gen(function* () {
			const error = yield* calldataHandler("transfer(address,uint256)", [
				"0x0000000000000000000000000000000000001234",
			]).pipe(Effect.flip)
			expect(error._tag).toBe("ArgumentCountError")
		}),
	)
})

// ---------------------------------------------------------------------------
// abiDecodeHandler — in-process handler tests
// ---------------------------------------------------------------------------

describe("abiDecodeHandler", () => {
	it.effect("decodes transfer args correctly", () =>
		Effect.gen(function* () {
			const result = yield* abiDecodeHandler(
				"transfer(address,uint256)",
				"0x00000000000000000000000000000000000000000000000000000000000012340000000000000000000000000000000000000000000000000de0b6b3a7640000",
			)
			expect(result).toEqual(["0x0000000000000000000000000000000000001234", "1000000000000000000"])
		}),
	)

	it.effect("decodes using output types when specified", () =>
		Effect.gen(function* () {
			const result = yield* abiDecodeHandler(
				"balanceOf(address)(uint256)",
				"0x0000000000000000000000000000000000000000000000000de0b6b3a7640000",
			)
			expect(result).toEqual(["1000000000000000000"])
		}),
	)

	it.effect("fails on invalid hex data", () =>
		Effect.gen(function* () {
			const error = yield* abiDecodeHandler("(uint256)", "not-hex").pipe(Effect.flip)
			expect(error._tag).toBe("HexDecodeError")
		}),
	)

	it.effect("fails on invalid signature", () =>
		Effect.gen(function* () {
			const error = yield* abiDecodeHandler("bad", "0xdeadbeef").pipe(Effect.flip)
			expect(error._tag).toBe("InvalidSignatureError")
		}),
	)
})

// ---------------------------------------------------------------------------
// calldataDecodeHandler — in-process handler tests
// ---------------------------------------------------------------------------

describe("calldataDecodeHandler", () => {
	it.effect("decodes transfer calldata correctly", () =>
		Effect.gen(function* () {
			const result = yield* calldataDecodeHandler(
				"transfer(address,uint256)",
				"0xa9059cbb00000000000000000000000000000000000000000000000000000000000012340000000000000000000000000000000000000000000000000de0b6b3a7640000",
			)
			expect(result.name).toBe("transfer")
			expect(result.signature).toBe("transfer(address,uint256)")
			expect(result.args).toEqual(["0x0000000000000000000000000000000000001234", "1000000000000000000"])
		}),
	)

	it.effect("fails when signature has no function name", () =>
		Effect.gen(function* () {
			const error = yield* calldataDecodeHandler(
				"(uint256)",
				"0xa9059cbb0000000000000000000000000000000000000000000000000000000000000001",
			).pipe(Effect.flip)
			expect(error._tag).toBe("InvalidSignatureError")
			expect(error.message).toContain("function name")
		}),
	)

	it.effect("fails on invalid hex data", () =>
		Effect.gen(function* () {
			const error = yield* calldataDecodeHandler("transfer(address,uint256)", "not-hex").pipe(Effect.flip)
			expect(error._tag).toBe("HexDecodeError")
		}),
	)

	it.effect("fails on invalid signature", () =>
		Effect.gen(function* () {
			const error = yield* calldataDecodeHandler("bad", "0xdeadbeef").pipe(Effect.flip)
			expect(error._tag).toBe("InvalidSignatureError")
		}),
	)
})

// ---------------------------------------------------------------------------
// abiEncodeHandler — additional boundary + edge cases
// ---------------------------------------------------------------------------

describe("abiEncodeHandler — extended edge cases", () => {
	it.effect("encodes max uint256 value", () =>
		Effect.gen(function* () {
			const maxU256 = (2n ** 256n - 1n).toString()
			const result = yield* abiEncodeHandler("(uint256)", [maxU256], false)
			expect(result).toBe("0x" + "ff".repeat(32))
		}),
	)

	it.effect("encodes zero address", () =>
		Effect.gen(function* () {
			const result = yield* abiEncodeHandler("(address)", ["0x0000000000000000000000000000000000000000"], false)
			expect(result).toBe("0x" + "00".repeat(32))
		}),
	)

	it.effect("encodes multiple params of different types", () =>
		Effect.gen(function* () {
			const result = yield* abiEncodeHandler("(uint256,bool,uint8)", ["42", "true", "7"], false)
			expect(result.startsWith("0x")).toBe(true)
			// 3 * 32 bytes = 192 hex chars + 0x
			expect(result.length).toBe(2 + 3 * 64)
		}),
	)

	it.effect("packed encoding with string type", () =>
		Effect.gen(function* () {
			const result = yield* abiEncodeHandler("(string)", ["hello"], true)
			expect(result.startsWith("0x")).toBe(true)
		}),
	)

	it.effect("packed encoding with bytes type", () =>
		Effect.gen(function* () {
			const result = yield* abiEncodeHandler("(bytes)", ["0xdeadbeef"], true)
			expect(result).toBe("0xdeadbeef")
		}),
	)

	it.effect("packed encoding with address", () =>
		Effect.gen(function* () {
			const result = yield* abiEncodeHandler("(address)", ["0x0000000000000000000000000000000000001234"], true)
			expect(result.startsWith("0x")).toBe(true)
		}),
	)

	it.effect("fails on invalid address for standard encoding", () =>
		Effect.gen(function* () {
			const error = yield* abiEncodeHandler("(address)", ["not-an-address"], false).pipe(Effect.flip)
			expect(error._tag).toBe("AbiError")
		}),
	)

	it.effect("fails on invalid uint value (non-numeric string)", () =>
		Effect.gen(function* () {
			const error = yield* abiEncodeHandler("(uint256)", ["not-a-number"], false).pipe(Effect.flip)
			expect(error._tag).toBe("AbiError")
			expect(error.message).toContain("Invalid integer")
		}),
	)

	it.effect("encodes negative int256", () =>
		Effect.gen(function* () {
			const result = yield* abiEncodeHandler("(int256)", ["-1"], false)
			expect(result).toBe("0x" + "ff".repeat(32))
		}),
	)
})

// ---------------------------------------------------------------------------
// calldataHandler — additional boundary + edge cases
// ---------------------------------------------------------------------------

describe("calldataHandler — extended edge cases", () => {
	it.effect("encodes approve(address,uint256) calldata", () =>
		Effect.gen(function* () {
			const result = yield* calldataHandler("approve(address,uint256)", [
				"0x0000000000000000000000000000000000001234",
				"1000000000000000000",
			])
			expect(result.startsWith("0x095ea7b3")).toBe(true)
		}),
	)

	it.effect("encodes balanceOf(address) calldata", () =>
		Effect.gen(function* () {
			const result = yield* calldataHandler("balanceOf(address)", ["0x0000000000000000000000000000000000001234"])
			expect(result.startsWith("0x70a08231")).toBe(true)
		}),
	)

	it.effect("encodes single bool param", () =>
		Effect.gen(function* () {
			const result = yield* calldataHandler("setBool(bool)", ["true"])
			expect(result.startsWith("0x")).toBe(true)
			expect(result.length).toBe(10 + 64) // selector + 1 param
		}),
	)

	it.effect("fails with excess args", () =>
		Effect.gen(function* () {
			const error = yield* calldataHandler("totalSupply()", ["unexpected"]).pipe(Effect.flip)
			expect(error._tag).toBe("ArgumentCountError")
			expect(error.expected).toBe(0)
			expect(error.received).toBe(1)
		}),
	)

	it.effect("encodes underscored function name", () =>
		Effect.gen(function* () {
			const result = yield* calldataHandler("_internal_call(uint256)", ["42"])
			expect(result.startsWith("0x")).toBe(true)
			expect(result.length).toBe(10 + 64)
		}),
	)
})

// ---------------------------------------------------------------------------
// abiDecodeHandler — additional boundary + edge cases
// ---------------------------------------------------------------------------

describe("abiDecodeHandler — extended edge cases", () => {
	it.effect("decodes multiple values (3 params)", () =>
		Effect.gen(function* () {
			// First encode 3 values, then decode
			const encoded = yield* abiEncodeHandler("(uint256,bool,uint8)", ["42", "true", "7"], false)
			const decoded = yield* abiDecodeHandler("(uint256,bool,uint8)", encoded)
			expect(decoded).toEqual(["42", "true", "7"])
		}),
	)

	it.effect("decodes single bool", () =>
		Effect.gen(function* () {
			const encoded = "0x0000000000000000000000000000000000000000000000000000000000000001"
			const decoded = yield* abiDecodeHandler("(bool)", encoded)
			expect(decoded).toEqual(["true"])
		}),
	)

	it.effect("decodes zero value", () =>
		Effect.gen(function* () {
			const encoded = "0x0000000000000000000000000000000000000000000000000000000000000000"
			const decoded = yield* abiDecodeHandler("(uint256)", encoded)
			expect(decoded).toEqual(["0"])
		}),
	)

	it.effect("decodes max uint256", () =>
		Effect.gen(function* () {
			const encoded = "0x" + "ff".repeat(32)
			const decoded = yield* abiDecodeHandler("(uint256)", encoded)
			expect(decoded).toEqual([(2n ** 256n - 1n).toString()])
		}),
	)

	it.effect("uses output types over input types when both present", () =>
		Effect.gen(function* () {
			// balanceOf(address)(uint256) — should decode with uint256 output type
			const encoded = "0x000000000000000000000000000000000000000000000000000000000000002a"
			const decoded = yield* abiDecodeHandler("balanceOf(address)(uint256)", encoded)
			expect(decoded).toEqual(["42"])
		}),
	)

	it.effect("fails on empty hex without actual data", () =>
		Effect.gen(function* () {
			const error = yield* abiDecodeHandler("(uint256)", "0x").pipe(Effect.flip)
			// This should fail at decoding — not enough data for uint256
			expect(error._tag).toBe("AbiError")
		}),
	)
})

// ---------------------------------------------------------------------------
// calldataDecodeHandler — additional boundary + edge cases
// ---------------------------------------------------------------------------

describe("calldataDecodeHandler — extended edge cases", () => {
	it.effect("round-trips approve calldata", () =>
		Effect.gen(function* () {
			const sig = "approve(address,uint256)"
			const encoded = yield* calldataHandler(sig, ["0x0000000000000000000000000000000000001234", "1000000000000000000"])
			const decoded = yield* calldataDecodeHandler(sig, encoded)
			expect(decoded.name).toBe("approve")
			expect(decoded.signature).toBe("approve(address,uint256)")
			expect(decoded.args[0]).toBe("0x0000000000000000000000000000000000001234")
			expect(decoded.args[1]).toBe("1000000000000000000")
		}),
	)

	it.effect("round-trips totalSupply calldata (no args)", () =>
		Effect.gen(function* () {
			const sig = "totalSupply()"
			const encoded = yield* calldataHandler(sig, [])
			const decoded = yield* calldataDecodeHandler(sig, encoded)
			expect(decoded.name).toBe("totalSupply")
			expect(decoded.signature).toBe("totalSupply()")
			expect(decoded.args).toEqual([])
		}),
	)

	it.effect("round-trips setBool calldata", () =>
		Effect.gen(function* () {
			const sig = "setBool(bool)"
			const encoded = yield* calldataHandler(sig, ["true"])
			const decoded = yield* calldataDecodeHandler(sig, encoded)
			expect(decoded.name).toBe("setBool")
			expect(decoded.args[0]).toBe("true")
		}),
	)

	it.effect("returns correct result shape", () =>
		Effect.gen(function* () {
			const result = yield* calldataDecodeHandler(
				"transfer(address,uint256)",
				"0xa9059cbb00000000000000000000000000000000000000000000000000000000000012340000000000000000000000000000000000000000000000000de0b6b3a7640000",
			)
			// Verify satisfies CalldataDecodeResult
			expect(typeof result.name).toBe("string")
			expect(typeof result.signature).toBe("string")
			expect(Array.isArray(result.args)).toBe(true)
			expect(result.args.every((a) => typeof a === "string")).toBe(true)
		}),
	)

	it.effect("fails on mismatched selector", () =>
		Effect.gen(function* () {
			// Use a calldata with the wrong selector for the given signature
			const error = yield* calldataDecodeHandler(
				"approve(address,uint256)",
				// This is transfer's calldata, not approve's
				"0xa9059cbb00000000000000000000000000000000000000000000000000000000000012340000000000000000000000000000000000000000000000000de0b6b3a7640000",
			).pipe(Effect.flip)
			expect(error._tag).toBe("AbiError")
		}),
	)
})

// ---------------------------------------------------------------------------
// Handler round-trip consistency
// ---------------------------------------------------------------------------

describe("handler round-trip consistency", () => {
	it.effect("abiEncode → abiDecode preserves values for multiple types", () =>
		Effect.gen(function* () {
			const sig = "(address,uint256,bool)"
			const args = ["0x0000000000000000000000000000000000001234", "999999999999999999", "false"]
			const encoded = yield* abiEncodeHandler(sig, args, false)
			const decoded = yield* abiDecodeHandler(sig, encoded)
			expect(decoded[0]).toBe("0x0000000000000000000000000000000000001234")
			expect(decoded[1]).toBe("999999999999999999")
			expect(decoded[2]).toBe("false")
		}),
	)

	it.effect("calldata → calldataDecode preserves all values for 3-arg function", () =>
		Effect.gen(function* () {
			const sig = "setValues(uint256,bool,uint8)"
			const args = ["1000", "true", "255"]
			const encoded = yield* calldataHandler(sig, args)
			const decoded = yield* calldataDecodeHandler(sig, encoded)
			expect(decoded.name).toBe("setValues")
			expect(decoded.args[0]).toBe("1000")
			expect(decoded.args[1]).toBe("true")
			expect(decoded.args[2]).toBe("255")
		}),
	)
})

// ---------------------------------------------------------------------------
// abiCommands export
// ---------------------------------------------------------------------------

describe("abiCommands export", () => {
	it("exports 4 commands", () => {
		// abiCommands is already imported at the top of the file as individual commands
		// Verify the 4 exported commands exist
		expect(abiEncodeCommand).toBeDefined()
		expect(calldataCommand).toBeDefined()
		expect(abiDecodeCommand).toBeDefined()
		expect(calldataDecodeCommand).toBeDefined()
	})
})

// ---------------------------------------------------------------------------
// Error structural equality (Data.TaggedError semantics)
// ---------------------------------------------------------------------------

describe("ABI error types — structural equality", () => {
	it("InvalidSignatureError with same fields are structurally equal", () => {
		const a = new InvalidSignatureError({ message: "bad", signature: "x" })
		const b = new InvalidSignatureError({ message: "bad", signature: "x" })
		expect(a).toEqual(b)
	})

	it("ArgumentCountError with same fields are structurally equal", () => {
		const a = new ArgumentCountError({ message: "wrong", expected: 2, received: 1 })
		const b = new ArgumentCountError({ message: "wrong", expected: 2, received: 1 })
		expect(a).toEqual(b)
	})

	it("HexDecodeError with same fields are structurally equal", () => {
		const a = new HexDecodeError({ message: "bad hex", data: "0xgg" })
		const b = new HexDecodeError({ message: "bad hex", data: "0xgg" })
		expect(a).toEqual(b)
	})

	it("AbiError with different messages have different message properties", () => {
		const a = new AbiError({ message: "one" })
		const b = new AbiError({ message: "two" })
		expect(a.message).not.toBe(b.message)
		expect(a._tag).toBe(b._tag) // same tag
	})
})

// ===========================================================================
// ADDITIONAL EDGE CASE TESTS
// ===========================================================================

// ---------------------------------------------------------------------------
// parseSignature — deeply nested tuples
// ---------------------------------------------------------------------------

describe("parseSignature — deeply nested tuples", () => {
	it.effect("parses foo((uint256,(address,bool)),bytes) with nested tuple", () =>
		Effect.gen(function* () {
			const result = yield* parseSignature("foo((uint256,(address,bool)),bytes)")
			expect(result.name).toBe("foo")
			expect(result.inputs.length).toBe(2)
			expect(result.inputs[0]?.type).toBe("(uint256,(address,bool))")
			expect(result.inputs[1]?.type).toBe("bytes")
		}),
	)

	it.effect("parses bar(uint256[]) with array type", () =>
		Effect.gen(function* () {
			const result = yield* parseSignature("bar(uint256[])")
			expect(result.name).toBe("bar")
			expect(result.inputs).toEqual([{ type: "uint256[]" }])
		}),
	)

	it.effect("parses baz(uint256[3]) with fixed array type", () =>
		Effect.gen(function* () {
			const result = yield* parseSignature("baz(uint256[3])")
			expect(result.name).toBe("baz")
			expect(result.inputs).toEqual([{ type: "uint256[3]" }])
		}),
	)

	it.effect("fails on unbalanced parens foo(uint256", () =>
		Effect.gen(function* () {
			const error = yield* parseSignature("foo(uint256").pipe(Effect.flip)
			expect(error._tag).toBe("InvalidSignatureError")
		}),
	)

	it.effect("fails on extra text after signature foo(uint256) extra", () =>
		Effect.gen(function* () {
			const error = yield* parseSignature("foo(uint256) extra").pipe(Effect.flip)
			expect(error._tag).toBe("InvalidSignatureError")
		}),
	)

	it.effect("fails on special chars in name foo-bar(uint256)", () =>
		Effect.gen(function* () {
			const error = yield* parseSignature("foo-bar(uint256)").pipe(Effect.flip)
			expect(error._tag).toBe("InvalidSignatureError")
		}),
	)

	it.effect("fails on name starting with number 1foo(uint256)", () =>
		Effect.gen(function* () {
			const error = yield* parseSignature("1foo(uint256)").pipe(Effect.flip)
			expect(error._tag).toBe("InvalidSignatureError")
		}),
	)

	it.effect("succeeds on underscore in name _foo(uint256)", () =>
		Effect.gen(function* () {
			const result = yield* parseSignature("_foo(uint256)")
			expect(result.name).toBe("_foo")
			expect(result.inputs).toEqual([{ type: "uint256" }])
		}),
	)
})

// ---------------------------------------------------------------------------
// coerceArgValue — edge cases
// ---------------------------------------------------------------------------

describe("coerceArgValue — edge cases", () => {
	it.effect("address type with invalid hex → AbiError", () =>
		Effect.gen(function* () {
			const error = yield* coerceArgValue("address", "invalid-hex").pipe(Effect.flip)
			expect(error._tag).toBe("AbiError")
		}),
	)

	it.effect("uint256 type with max value → bigint", () =>
		Effect.gen(function* () {
			const maxU256 = "115792089237316195423570985008687907853269984665640564039457584007913129639935"
			const result = yield* coerceArgValue("uint256", maxU256)
			expect(result).toBe(115792089237316195423570985008687907853269984665640564039457584007913129639935n)
		}),
	)

	it.effect("int256 type with negative -1 → BigInt(-1)", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("int256", "-1")
			expect(result).toBe(-1n)
		}),
	)

	it.effect("bool type with false → false", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("bool", "false")
			expect(result).toBe(false)
		}),
	)

	it.effect("bool type with 0 → false", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("bool", "0")
			expect(result).toBe(false)
		}),
	)

	it.effect("bool type with anything_else → false (only true/1 are true)", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("bool", "anything_else")
			expect(result).toBe(false)
		}),
	)

	it.effect("string type → pass through unchanged", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("string", "test string")
			expect(result).toBe("test string")
		}),
	)

	it.effect("bytes type with valid hex → Uint8Array", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("bytes", "0xdeadbeef")
			expect(result).toBeInstanceOf(Uint8Array)
			expect((result as Uint8Array).length).toBe(4)
		}),
	)

	it.effect("bytes type with invalid hex → AbiError", () =>
		Effect.gen(function* () {
			const error = yield* coerceArgValue("bytes", "invalid").pipe(Effect.flip)
			expect(error._tag).toBe("AbiError")
		}),
	)

	it.effect("array type uint256[] with [1,2,3] → [1n, 2n, 3n]", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("uint256[]", "[1,2,3]")
			expect(result).toEqual([1n, 2n, 3n])
		}),
	)

	it.effect("array type with invalid JSON → AbiError", () =>
		Effect.gen(function* () {
			const error = yield* coerceArgValue("uint256[]", "not-json").pipe(Effect.flip)
			expect(error._tag).toBe("AbiError")
		}),
	)

	it.effect("array type with non-array JSON 42 → AbiError", () =>
		Effect.gen(function* () {
			const error = yield* coerceArgValue("uint256[]", "42").pipe(Effect.flip)
			expect(error._tag).toBe("AbiError")
			expect(error.message).toContain("expected JSON array")
		}),
	)

	it.effect("unknown type → passes through as string", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("unknownType", "someValue")
			expect(result).toBe("someValue")
		}),
	)
})

// ---------------------------------------------------------------------------
// formatValue — coverage
// ---------------------------------------------------------------------------

describe("formatValue — coverage", () => {
	it("Uint8Array → hex string", () => {
		expect(formatValue(new Uint8Array([0xde, 0xad]))).toBe("0xdead")
	})

	it("bigint 0n → 0", () => {
		expect(formatValue(0n)).toBe("0")
	})

	it("bigint negative → -123", () => {
		expect(formatValue(-123n)).toBe("-123")
	})

	it("nested arrays → [1, 2, [3, 4]]", () => {
		expect(formatValue([1n, 2n, [3n, 4n]])).toBe("[1, 2, [3, 4]]")
	})

	it("boolean true → true", () => {
		expect(formatValue(true)).toBe("true")
	})

	it("null → null", () => {
		expect(formatValue(null)).toBe("null")
	})

	it("undefined → undefined", () => {
		expect(formatValue(undefined)).toBe("undefined")
	})

	it("empty array → []", () => {
		expect(formatValue([])).toBe("[]")
	})

	it("empty Uint8Array → 0x", () => {
		expect(formatValue(new Uint8Array([]))).toBe("0x")
	})
})

// ---------------------------------------------------------------------------
// validateHexData — thorough
// ---------------------------------------------------------------------------

describe("validateHexData — thorough", () => {
	it.effect("valid 0xdeadbeef → succeeds", () =>
		Effect.gen(function* () {
			const result = yield* validateHexData("0xdeadbeef")
			expect(result).toBeInstanceOf(Uint8Array)
			expect(result.length).toBe(4)
		}),
	)

	it.effect("0x → succeeds (empty)", () =>
		Effect.gen(function* () {
			const result = yield* validateHexData("0x")
			expect(result).toBeInstanceOf(Uint8Array)
			expect(result.length).toBe(0)
		}),
	)

	it.effect("no prefix deadbeef → HexDecodeError", () =>
		Effect.gen(function* () {
			const error = yield* validateHexData("deadbeef").pipe(Effect.flip)
			expect(error._tag).toBe("HexDecodeError")
		}),
	)

	it.effect("odd length 0xabc → HexDecodeError", () =>
		Effect.gen(function* () {
			const error = yield* validateHexData("0xabc").pipe(Effect.flip)
			expect(error._tag).toBe("HexDecodeError")
		}),
	)

	it.effect("invalid chars 0xGG → HexDecodeError", () =>
		Effect.gen(function* () {
			const error = yield* validateHexData("0xGG").pipe(Effect.flip)
			expect(error._tag).toBe("HexDecodeError")
		}),
	)

	it.effect("empty string → HexDecodeError", () =>
		Effect.gen(function* () {
			const error = yield* validateHexData("").pipe(Effect.flip)
			expect(error._tag).toBe("HexDecodeError")
		}),
	)
})

// ---------------------------------------------------------------------------
// validateArgCount — thorough
// ---------------------------------------------------------------------------

describe("validateArgCount — thorough", () => {
	it.effect("match (3, 3) → succeeds", () =>
		Effect.gen(function* () {
			yield* validateArgCount(3, 3)
			// No error = success
		}),
	)

	it.effect("mismatch (2, 3) → ArgumentCountError with correct expected/received", () =>
		Effect.gen(function* () {
			const error = yield* validateArgCount(2, 3).pipe(Effect.flip)
			expect(error._tag).toBe("ArgumentCountError")
			expect(error.expected).toBe(2)
			expect(error.received).toBe(3)
		}),
	)

	it.effect("mismatch (0, 1) → ArgumentCountError", () =>
		Effect.gen(function* () {
			const error = yield* validateArgCount(0, 1).pipe(Effect.flip)
			expect(error._tag).toBe("ArgumentCountError")
			expect(error.expected).toBe(0)
			expect(error.received).toBe(1)
		}),
	)

	it.effect("zero expected zero received → succeeds", () =>
		Effect.gen(function* () {
			yield* validateArgCount(0, 0)
			// No error = success
		}),
	)

	it.effect("singular message (1, 0) → Expected 1 argument, got 0", () =>
		Effect.gen(function* () {
			const error = yield* validateArgCount(1, 0).pipe(Effect.flip)
			expect(error.message).toContain("1 argument,")
			expect(error.message).toContain("got 0")
		}),
	)

	it.effect("plural message (2, 0) → Expected 2 arguments, got 0", () =>
		Effect.gen(function* () {
			const error = yield* validateArgCount(2, 0).pipe(Effect.flip)
			expect(error.message).toContain("2 arguments,")
			expect(error.message).toContain("got 0")
		}),
	)
})

// ---------------------------------------------------------------------------
// buildAbiItem — structure
// ---------------------------------------------------------------------------

describe("buildAbiItem — structure", () => {
	it("builds correct ABI function item with name, inputs, outputs", () => {
		const sig = {
			name: "test",
			inputs: [{ type: "uint256" }, { type: "address" }],
			outputs: [{ type: "bool" }],
		}
		const item = buildAbiItem(sig)
		expect(item.type).toBe("function")
		expect(item.name).toBe("test")
		expect(item.stateMutability).toBe("nonpayable")
		expect(item.inputs.length).toBe(2)
		expect(item.outputs.length).toBe(1)
	})

	it("input names are arg0, arg1, etc.", () => {
		const sig = {
			name: "test",
			inputs: [{ type: "uint256" }, { type: "address" }, { type: "bool" }],
			outputs: [],
		}
		const item = buildAbiItem(sig)
		expect(item.inputs[0]?.name).toBe("arg0")
		expect(item.inputs[1]?.name).toBe("arg1")
		expect(item.inputs[2]?.name).toBe("arg2")
	})

	it("output names are out0, out1, etc.", () => {
		const sig = {
			name: "test",
			inputs: [],
			outputs: [{ type: "uint256" }, { type: "bool" }],
		}
		const item = buildAbiItem(sig)
		expect(item.outputs[0]?.name).toBe("out0")
		expect(item.outputs[1]?.name).toBe("out1")
	})

	it("stateMutability is nonpayable", () => {
		const sig = {
			name: "test",
			inputs: [],
			outputs: [],
		}
		const item = buildAbiItem(sig)
		expect(item.stateMutability).toBe("nonpayable")
	})
})

// ---------------------------------------------------------------------------
// abiEncodeHandler — uint256 max value
// ---------------------------------------------------------------------------

describe("abiEncodeHandler — uint256 max value", () => {
	it.effect("encode uint256 max → succeeds and decodes back", () =>
		Effect.gen(function* () {
			const maxU256 = (2n ** 256n - 1n).toString()
			const encoded = yield* abiEncodeHandler("(uint256)", [maxU256], false)
			const decoded = yield* abiDecodeHandler("(uint256)", encoded)
			expect(decoded[0]).toBe(maxU256)
		}),
	)

	it.effect("encode address zero → succeeds", () =>
		Effect.gen(function* () {
			const result = yield* abiEncodeHandler("(address)", ["0x0000000000000000000000000000000000000000"], false)
			expect(result).toBe("0x" + "00".repeat(32))
		}),
	)
})

// ---------------------------------------------------------------------------
// calldataHandler — edge cases
// ---------------------------------------------------------------------------

describe("calldataHandler — edge cases", () => {
	it.effect("function with no args totalSupply() → 4-byte selector only", () =>
		Effect.gen(function* () {
			const result = yield* calldataHandler("totalSupply()", [])
			expect(result.startsWith("0x")).toBe(true)
			expect(result.length).toBe(10) // 0x + 8 hex chars = 4 bytes
		}),
	)

	// Note: tuple types like foo((uint256,address)) are not supported by voltaire-effect encoder
})

// ============================================================================
// In-process Command Handler Tests (coverage for Command.make blocks)
// ============================================================================

describe("abiEncodeCommand.handler — in-process", () => {
	it.effect("handles encode with plain output", () =>
		abiEncodeCommand.handler({ sig: "(uint256)", args: ["42"], packed: false, json: false }),
	)

	it.effect("handles encode with JSON output", () =>
		abiEncodeCommand.handler({ sig: "(uint256)", args: ["42"], packed: false, json: true }),
	)

	it.effect("handles encode with packed mode", () =>
		abiEncodeCommand.handler({ sig: "(uint16,bool)", args: ["1", "true"], packed: true, json: false }),
	)

	it.effect("handles error path on invalid signature", () =>
		Effect.gen(function* () {
			const error = yield* abiEncodeCommand
				.handler({ sig: "bad", args: ["1"], packed: false, json: false })
				.pipe(Effect.flip)
			expect(error.message).toContain("Invalid signature")
		}),
	)
})

describe("calldataCommand.handler — in-process", () => {
	it.effect("handles calldata with plain output", () =>
		calldataCommand.handler({
			sig: "transfer(address,uint256)",
			args: ["0x0000000000000000000000000000000000001234", "1000000000000000000"],
			json: false,
		}),
	)

	it.effect("handles calldata with JSON output", () =>
		calldataCommand.handler({
			sig: "transfer(address,uint256)",
			args: ["0x0000000000000000000000000000000000001234", "1000000000000000000"],
			json: true,
		}),
	)

	it.effect("handles error path on missing function name", () =>
		Effect.gen(function* () {
			const error = yield* calldataCommand.handler({ sig: "(uint256)", args: ["42"], json: false }).pipe(Effect.flip)
			expect(error.message).toContain("function name")
		}),
	)
})

describe("abiDecodeCommand.handler — in-process", () => {
	it.effect("handles decode with plain output (non-JSON path with for loop)", () =>
		abiDecodeCommand.handler({
			sig: "(uint256)",
			data: "0x000000000000000000000000000000000000000000000000000000000000002a",
			json: false,
		}),
	)

	it.effect("handles decode with JSON output", () =>
		abiDecodeCommand.handler({
			sig: "(uint256)",
			data: "0x000000000000000000000000000000000000000000000000000000000000002a",
			json: true,
		}),
	)

	it.effect("handles decode of multiple values with plain output", () =>
		abiDecodeCommand.handler({
			sig: "transfer(address,uint256)",
			data: "0x00000000000000000000000000000000000000000000000000000000000012340000000000000000000000000000000000000000000000000de0b6b3a7640000",
			json: false,
		}),
	)

	it.effect("handles error path on invalid hex", () =>
		Effect.gen(function* () {
			const error = yield* abiDecodeCommand
				.handler({ sig: "(uint256)", data: "not-hex", json: false })
				.pipe(Effect.flip)
			expect(error.message).toContain("Invalid hex")
		}),
	)
})

describe("calldataDecodeCommand.handler — in-process", () => {
	it.effect("handles decode with plain output (non-JSON path with for loop)", () =>
		calldataDecodeCommand.handler({
			sig: "transfer(address,uint256)",
			data: "0xa9059cbb00000000000000000000000000000000000000000000000000000000000012340000000000000000000000000000000000000000000000000de0b6b3a7640000",
			json: false,
		}),
	)

	it.effect("handles decode with JSON output", () =>
		calldataDecodeCommand.handler({
			sig: "transfer(address,uint256)",
			data: "0xa9059cbb00000000000000000000000000000000000000000000000000000000000012340000000000000000000000000000000000000000000000000de0b6b3a7640000",
			json: true,
		}),
	)

	it.effect("handles error path on invalid hex", () =>
		Effect.gen(function* () {
			const error = yield* calldataDecodeCommand
				.handler({ sig: "transfer(address,uint256)", data: "not-hex", json: false })
				.pipe(Effect.flip)
			expect(error.message).toContain("Invalid hex")
		}),
	)

	it.effect("handles error path on missing function name", () =>
		Effect.gen(function* () {
			const error = yield* calldataDecodeCommand
				.handler({
					sig: "(uint256)",
					data: "0xa9059cbb0000000000000000000000000000000000000000000000000000000000000001",
					json: false,
				})
				.pipe(Effect.flip)
			expect(error.message).toContain("function name")
		}),
	)
})

describe("abi command exports — count", () => {
	it("exports 4 abi commands", () => {
		expect(abiCommands.length).toBe(4)
	})
})

// ===========================================================================
// ADDITIONAL COVERAGE TESTS
// ===========================================================================

// ---------------------------------------------------------------------------
// safeEncodeParameters error path (lines 328-331)
// ---------------------------------------------------------------------------

describe("safeEncodeParameters error path — encoding failures", () => {
	it.effect("fails when uint8 value overflows (256 > max uint8)", () =>
		Effect.gen(function* () {
			// BigInt("256") passes coercion, but uint8 max is 255 so encoding should throw
			const error = yield* abiEncodeHandler("(uint8)", ["256"], false).pipe(Effect.flip)
			expect(error._tag).toBe("AbiError")
			expect(error.message).toContain("encoding failed")
		}),
	)

	it.effect("fails when uint8 value is negative (-1 as uint8)", () =>
		Effect.gen(function* () {
			// BigInt("-1") passes coercion for uint8, but encoding unsigned should fail
			const error = yield* abiEncodeHandler("(uint8)", ["-1"], false).pipe(Effect.flip)
			expect(error._tag).toBe("AbiError")
		}),
	)

	it.effect("fails when uint256 value exceeds 2^256", () =>
		Effect.gen(function* () {
			const overflowValue = (2n ** 256n).toString()
			const error = yield* abiEncodeHandler("(uint256)", [overflowValue], false).pipe(Effect.flip)
			expect(error._tag).toBe("AbiError")
		}),
	)

	it.effect("fails when int8 value overflows (128 > max int8)", () =>
		Effect.gen(function* () {
			const error = yield* abiEncodeHandler("(int8)", ["128"], false).pipe(Effect.flip)
			expect(error._tag).toBe("AbiError")
		}),
	)

	it.effect("fails when int8 value underflows (-129 < min int8)", () =>
		Effect.gen(function* () {
			const error = yield* abiEncodeHandler("(int8)", ["-129"], false).pipe(Effect.flip)
			expect(error._tag).toBe("AbiError")
		}),
	)

	it.effect("error message wraps the underlying encoding error", () =>
		Effect.gen(function* () {
			const error = yield* abiEncodeHandler("(uint8)", ["999"], false).pipe(Effect.flip)
			expect(error._tag).toBe("AbiError")
			expect(error.message).toContain("ABI encoding failed")
		}),
	)

	it.effect("error has cause property from the underlying error", () =>
		Effect.gen(function* () {
			const error = yield* abiEncodeHandler("(uint8)", ["999"], false).pipe(Effect.flip)
			expect(error._tag).toBe("AbiError")
			expect(error.cause).toBeDefined()
		}),
	)
})

// ---------------------------------------------------------------------------
// coerceArgValue — additional edge cases
// ---------------------------------------------------------------------------

describe("coerceArgValue — additional edge cases", () => {
	it.effect("array type address[] with valid JSON array", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue(
				"address[]",
				'["0x0000000000000000000000000000000000001234","0x0000000000000000000000000000000000005678"]',
			)
			expect(Array.isArray(result)).toBe(true)
			const arr = result as unknown[]
			expect(arr.length).toBe(2)
			expect(arr[0]).toBeInstanceOf(Uint8Array)
			expect(arr[1]).toBeInstanceOf(Uint8Array)
		}),
	)

	it.effect("array type non-array JSON string '\"123\"' for uint256[] fails", () =>
		Effect.gen(function* () {
			const error = yield* coerceArgValue("uint256[]", '"123"').pipe(Effect.flip)
			expect(error._tag).toBe("AbiError")
			expect(error.message).toContain("expected JSON array")
		}),
	)

	it.effect("array type non-array JSON object for uint256[] fails", () =>
		Effect.gen(function* () {
			const error = yield* coerceArgValue("uint256[]", '{"a":1}').pipe(Effect.flip)
			expect(error._tag).toBe("AbiError")
			expect(error.message).toContain("expected JSON array")
		}),
	)

	it.effect("bool type 'false' → false", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("bool", "false")
			expect(result).toBe(false)
		}),
	)

	it.effect("bool type '0' → false", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("bool", "0")
			expect(result).toBe(false)
		}),
	)

	it.effect("bool type 'true' → true", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("bool", "true")
			expect(result).toBe(true)
		}),
	)

	it.effect("bool type '1' → true", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("bool", "1")
			expect(result).toBe(true)
		}),
	)

	it.effect("tuple type passes through as string", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("(uint256,address)", "someValue")
			expect(result).toBe("someValue")
		}),
	)

	it.effect("bytes with invalid hex (no 0x prefix) fails", () =>
		Effect.gen(function* () {
			const error = yield* coerceArgValue("bytes", "gggg").pipe(Effect.flip)
			expect(error._tag).toBe("AbiError")
			expect(error.message).toContain("Invalid bytes")
		}),
	)

	it.effect("bytes32 with invalid hex fails", () =>
		Effect.gen(function* () {
			const error = yield* coerceArgValue("bytes32", "gggg").pipe(Effect.flip)
			expect(error._tag).toBe("AbiError")
			expect(error.message).toContain("Invalid bytes")
		}),
	)

	it.effect("non-numeric string for uint256 fails", () =>
		Effect.gen(function* () {
			const error = yield* coerceArgValue("uint256", "not-a-number").pipe(Effect.flip)
			expect(error._tag).toBe("AbiError")
			expect(error.message).toContain("Invalid integer")
		}),
	)

	it.effect("bool[] array with valid JSON", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("bool[]", "[true,false,true]")
			expect(result).toEqual([true, false, true])
		}),
	)

	it.effect("string[] passes through elements", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("string[]", '["hello","world"]')
			expect(result).toEqual(["hello", "world"])
		}),
	)
})

// ---------------------------------------------------------------------------
// parseSignature — additional edge cases
// ---------------------------------------------------------------------------

describe("parseSignature — additional edge cases", () => {
	it.effect("parses foo((uint256,address),bytes) with tuple + regular type", () =>
		Effect.gen(function* () {
			const result = yield* parseSignature("foo((uint256,address),bytes)")
			expect(result.name).toBe("foo")
			expect(result.inputs.length).toBe(2)
			expect(result.inputs[0]?.type).toBe("(uint256,address)")
			expect(result.inputs[1]?.type).toBe("bytes")
		}),
	)

	it.effect("parses multiple outputs balanceOf(address)(uint256,string)", () =>
		Effect.gen(function* () {
			const result = yield* parseSignature("balanceOf(address)(uint256,string)")
			expect(result.name).toBe("balanceOf")
			expect(result.inputs).toEqual([{ type: "address" }])
			expect(result.outputs).toEqual([{ type: "uint256" }, { type: "string" }])
		}),
	)

	it.effect("parses anonymous signature (address,uint256) with no name", () =>
		Effect.gen(function* () {
			const result = yield* parseSignature("(address,uint256)")
			expect(result.name).toBe("")
			expect(result.inputs).toEqual([{ type: "address" }, { type: "uint256" }])
		}),
	)

	it.effect("fails on trailing garbage after valid signature", () =>
		Effect.gen(function* () {
			const error = yield* parseSignature("foo(uint256)extra").pipe(Effect.flip)
			expect(error._tag).toBe("InvalidSignatureError")
		}),
	)

	it.effect("parses name with numbers transfer2(address,uint256)", () =>
		Effect.gen(function* () {
			const result = yield* parseSignature("transfer2(address,uint256)")
			expect(result.name).toBe("transfer2")
			expect(result.inputs).toEqual([{ type: "address" }, { type: "uint256" }])
		}),
	)

	it.effect("fails on name starting with number 2transfer(address)", () =>
		Effect.gen(function* () {
			const error = yield* parseSignature("2transfer(address)").pipe(Effect.flip)
			expect(error._tag).toBe("InvalidSignatureError")
		}),
	)

	it.effect("fails on name with special chars transfer!(address)", () =>
		Effect.gen(function* () {
			const error = yield* parseSignature("transfer!(address)").pipe(Effect.flip)
			expect(error._tag).toBe("InvalidSignatureError")
		}),
	)

	it.effect("parses deeply nested tuples f((uint256,(address,bool)),bytes)", () =>
		Effect.gen(function* () {
			const result = yield* parseSignature("f((uint256,(address,bool)),bytes)")
			expect(result.name).toBe("f")
			expect(result.inputs.length).toBe(2)
			expect(result.inputs[0]?.type).toBe("(uint256,(address,bool))")
			expect(result.inputs[1]?.type).toBe("bytes")
		}),
	)

	it.effect("fails on name with @ symbol func@1(uint256)", () =>
		Effect.gen(function* () {
			const error = yield* parseSignature("func@1(uint256)").pipe(Effect.flip)
			expect(error._tag).toBe("InvalidSignatureError")
		}),
	)

	it.effect("fails on name with space 'func tion(uint256)'", () =>
		Effect.gen(function* () {
			const error = yield* parseSignature("func tion(uint256)").pipe(Effect.flip)
			expect(error._tag).toBe("InvalidSignatureError")
		}),
	)
})

// ---------------------------------------------------------------------------
// formatValue — additional edge cases
// ---------------------------------------------------------------------------

describe("formatValue — additional edge cases", () => {
	it("formats nested arrays with mixed types", () => {
		const result = formatValue([1n, [new Uint8Array([0xab]), "hello"]])
		expect(result).toBe("[1, [0xab, hello]]")
	})

	it("formats bigint values as decimal strings", () => {
		expect(formatValue(12345678901234567890n)).toBe("12345678901234567890")
	})

	it("formats Uint8Array as hex string", () => {
		expect(formatValue(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))).toBe("0xdeadbeef")
	})

	it("formats mixed array of BigInt and Uint8Array", () => {
		const result = formatValue([42n, new Uint8Array([0xff])])
		expect(result).toBe("[42, 0xff]")
	})

	it("formats boolean true as 'true'", () => {
		expect(formatValue(true)).toBe("true")
	})

	it("formats boolean false as 'false'", () => {
		expect(formatValue(false)).toBe("false")
	})

	it("formats string values as-is", () => {
		expect(formatValue("hello world")).toBe("hello world")
	})

	it("formats deeply nested arrays", () => {
		const result = formatValue([[1n, 2n], [3n, [4n, 5n]]])
		expect(result).toBe("[[1, 2], [3, [4, 5]]]")
	})

	it("formats array with single Uint8Array element", () => {
		expect(formatValue([new Uint8Array([0x01, 0x02])])).toBe("[0x0102]")
	})
})

// ---------------------------------------------------------------------------
// calldataDecodeHandler — additional edge cases
// ---------------------------------------------------------------------------

describe("calldataDecodeHandler — mismatched selector and short data", () => {
	it.effect("fails on mismatched selector (approve sig with transfer calldata)", () =>
		Effect.gen(function* () {
			const error = yield* calldataDecodeHandler(
				"approve(address,uint256)",
				// transfer's selector 0xa9059cbb, not approve's 0x095ea7b3
				"0xa9059cbb00000000000000000000000000000000000000000000000000000000000012340000000000000000000000000000000000000000000000000de0b6b3a7640000",
			).pipe(Effect.flip)
			expect(error._tag).toBe("AbiError")
		}),
	)

	it.effect("fails on very short data (less than 4 bytes)", () =>
		Effect.gen(function* () {
			const error = yield* calldataDecodeHandler("transfer(address,uint256)", "0xaa").pipe(Effect.flip)
			expect(error._tag).toBe("AbiError")
		}),
	)

	it.effect("fails on empty calldata (just 0x)", () =>
		Effect.gen(function* () {
			const error = yield* calldataDecodeHandler("transfer(address,uint256)", "0x").pipe(Effect.flip)
			expect(error._tag).toBe("AbiError")
		}),
	)

	it.effect("fails on exactly 4 bytes (selector only, no args for a 2-arg function)", () =>
		Effect.gen(function* () {
			const error = yield* calldataDecodeHandler("transfer(address,uint256)", "0xa9059cbb").pipe(Effect.flip)
			expect(error._tag).toBe("AbiError")
		}),
	)
})

// ---------------------------------------------------------------------------
// abiEncodeHandler — boundary conditions
// ---------------------------------------------------------------------------

describe("abiEncodeHandler — additional boundary conditions", () => {
	it.effect("encodes zero args with zero-param signature", () =>
		Effect.gen(function* () {
			const result = yield* abiEncodeHandler("()", [], false)
			expect(result).toBe("0x")
		}),
	)

	it.effect("encodes uint256 max value (2^256 - 1)", () =>
		Effect.gen(function* () {
			const maxU256 = (2n ** 256n - 1n).toString()
			const result = yield* abiEncodeHandler("(uint256)", [maxU256], false)
			expect(result).toBe("0x" + "ff".repeat(32))
		}),
	)

	it.effect("encodes zero address", () =>
		Effect.gen(function* () {
			const result = yield* abiEncodeHandler("(address)", ["0x0000000000000000000000000000000000000000"], false)
			expect(result).toBe("0x" + "00".repeat(32))
		}),
	)

	it.effect("encodes empty bytes", () =>
		Effect.gen(function* () {
			const result = yield* abiEncodeHandler("(bytes)", ["0x"], false)
			expect(result.startsWith("0x")).toBe(true)
			// Dynamic type: offset (32 bytes) + length (32 bytes) = at least 128 hex chars
			expect(result.length).toBeGreaterThan(2)
		}),
	)
})

// ---------------------------------------------------------------------------
// E2E JSON output tests
// ---------------------------------------------------------------------------

describe("chop abi-encode --json (E2E)", () => {
	it("produces valid JSON output with result key", () => {
		const result = runCli("abi-encode --json '(uint256)' 42")
		expect(result.exitCode).toBe(0)
		const parsed = JSON.parse(result.stdout.trim())
		expect(parsed).toHaveProperty("result")
		expect(typeof parsed.result).toBe("string")
		expect(parsed.result.startsWith("0x")).toBe(true)
	})

	it("produces valid JSON output for multiple params", () => {
		const result = runCli(
			"abi-encode --json '(address,uint256)' 0x0000000000000000000000000000000000001234 42",
		)
		expect(result.exitCode).toBe(0)
		const parsed = JSON.parse(result.stdout.trim())
		expect(parsed.result.startsWith("0x")).toBe(true)
	})

	it("produces valid JSON output for zero params", () => {
		const result = runCli("abi-encode --json '()'")
		expect(result.exitCode).toBe(0)
		const parsed = JSON.parse(result.stdout.trim())
		expect(parsed.result).toBe("0x")
	})
})

describe("chop calldata --json (E2E)", () => {
	it("produces valid JSON output with result key", () => {
		const result = runCli(
			"calldata --json 'transfer(address,uint256)' 0x0000000000000000000000000000000000001234 1000000000000000000",
		)
		expect(result.exitCode).toBe(0)
		const parsed = JSON.parse(result.stdout.trim())
		expect(parsed).toHaveProperty("result")
		expect(parsed.result.startsWith("0xa9059cbb")).toBe(true)
	})

	it("produces valid JSON output for no-arg function", () => {
		const result = runCli("calldata --json 'totalSupply()'")
		expect(result.exitCode).toBe(0)
		const parsed = JSON.parse(result.stdout.trim())
		expect(parsed.result.startsWith("0x")).toBe(true)
		expect(parsed.result.length).toBe(10) // 0x + 8 hex chars
	})
})

describe("chop abi-decode --json (E2E)", () => {
	it("produces valid JSON with result array", () => {
		const result = runCli(
			"abi-decode --json '(uint256)' 0x000000000000000000000000000000000000000000000000000000000000002a",
		)
		expect(result.exitCode).toBe(0)
		const parsed = JSON.parse(result.stdout.trim())
		expect(parsed).toHaveProperty("result")
		expect(Array.isArray(parsed.result)).toBe(true)
		expect(parsed.result[0]).toBe("42")
	})

	it("produces valid JSON with multiple decoded values", () => {
		const result = runCli(
			"abi-decode --json '(address,uint256)' 0x00000000000000000000000000000000000000000000000000000000000012340000000000000000000000000000000000000000000000000de0b6b3a7640000",
		)
		expect(result.exitCode).toBe(0)
		const parsed = JSON.parse(result.stdout.trim())
		expect(parsed.result.length).toBe(2)
	})
})

describe("chop calldata-decode --json (E2E)", () => {
	it("produces valid JSON with name and args", () => {
		const result = runCli(
			"calldata-decode --json 'transfer(address,uint256)' 0xa9059cbb00000000000000000000000000000000000000000000000000000000000012340000000000000000000000000000000000000000000000000de0b6b3a7640000",
		)
		expect(result.exitCode).toBe(0)
		const parsed = JSON.parse(result.stdout.trim())
		expect(parsed).toHaveProperty("name")
		expect(parsed).toHaveProperty("args")
		expect(parsed.name).toBe("transfer")
		expect(Array.isArray(parsed.args)).toBe(true)
		expect(parsed.args.length).toBe(2)
	})

	it("produces valid JSON for no-arg function decode", () => {
		// First encode totalSupply calldata, then decode it
		const encResult = runCli("calldata 'totalSupply()'")
		expect(encResult.exitCode).toBe(0)
		const calldata = encResult.stdout.trim()

		const result = runCli(`calldata-decode --json 'totalSupply()' ${calldata}`)
		expect(result.exitCode).toBe(0)
		const parsed = JSON.parse(result.stdout.trim())
		expect(parsed.name).toBe("totalSupply")
		expect(parsed.args).toEqual([])
	})
})

// ---------------------------------------------------------------------------
// parseSignature — extractParenContent & splitTypes edge cases
// ---------------------------------------------------------------------------

describe("parseSignature — deeply nested and tuple edge cases", () => {
	it.effect("parses 3+ levels of nesting: foo(((uint256)))", () =>
		Effect.gen(function* () {
			const result = yield* parseSignature("foo(((uint256)))")
			expect(result.name).toBe("foo")
			expect(result.inputs.length).toBe(1)
			expect(result.inputs[0]?.type).toBe("((uint256))")
		}),
	)

	it.effect("parses empty inner tuple: foo(())", () =>
		Effect.gen(function* () {
			const result = yield* parseSignature("foo(())")
			expect(result.name).toBe("foo")
			expect(result.inputs.length).toBe(1)
			expect(result.inputs[0]?.type).toBe("()")
		}),
	)

	it.effect("parses single tuple param: foo((uint256,address))", () =>
		Effect.gen(function* () {
			const result = yield* parseSignature("foo((uint256,address))")
			expect(result.name).toBe("foo")
			expect(result.inputs.length).toBe(1)
			expect(result.inputs[0]?.type).toBe("(uint256,address)")
		}),
	)

	it.effect("parses multiple tuple params: foo((uint256,address),(bool,bytes))", () =>
		Effect.gen(function* () {
			const result = yield* parseSignature("foo((uint256,address),(bool,bytes))")
			expect(result.name).toBe("foo")
			expect(result.inputs.length).toBe(2)
			expect(result.inputs[0]?.type).toBe("(uint256,address)")
			expect(result.inputs[1]?.type).toBe("(bool,bytes)")
		}),
	)

	it.effect("parses array of tuples: foo((uint256,address)[])", () =>
		Effect.gen(function* () {
			const result = yield* parseSignature("foo((uint256,address)[])")
			expect(result.name).toBe("foo")
			expect(result.inputs.length).toBe(1)
			expect(result.inputs[0]?.type).toBe("(uint256,address)[]")
		}),
	)
})

// ---------------------------------------------------------------------------
// coerceArgValue — untested array and fallthrough paths
// ---------------------------------------------------------------------------

describe("coerceArgValue — array types and fallthrough", () => {
	it.effect("coerces address[] with single element", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue(
				"address[]",
				'["0x0000000000000000000000000000000000000001"]',
			)
			expect(Array.isArray(result)).toBe(true)
			const arr = result as unknown[]
			expect(arr.length).toBe(1)
			expect(arr[0]).toBeInstanceOf(Uint8Array)
			expect((arr[0] as Uint8Array).length).toBe(20)
		}),
	)

	it.effect("coerces bool[] with string-valued booleans", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("bool[]", '["true","false"]')
			expect(result).toEqual([true, false])
		}),
	)

	it.effect("coerces bytes32[] with valid hex elements", () =>
		Effect.gen(function* () {
			const hex = `0x${"00".repeat(31)}01`
			const result = yield* coerceArgValue("bytes32[]", `["${hex}"]`)
			expect(Array.isArray(result)).toBe(true)
			const arr = result as unknown[]
			expect(arr.length).toBe(1)
			expect(arr[0]).toBeInstanceOf(Uint8Array)
			expect((arr[0] as Uint8Array).length).toBe(32)
		}),
	)

	it.effect("coerces fixed-size array uint256[3]", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("uint256[3]", "[1,2,3]")
			expect(result).toEqual([1n, 2n, 3n])
		}),
	)

	it.effect("fails with AbiError for non-JSON string on array type", () =>
		Effect.gen(function* () {
			const error = yield* coerceArgValue("uint256[]", "not-json").pipe(Effect.flip)
			expect(error._tag).toBe("AbiError")
			expect(error.message).toContain("expected JSON array")
		}),
	)

	it.effect("fails with AbiError for JSON object on array type (non-array branch)", () =>
		Effect.gen(function* () {
			const error = yield* coerceArgValue("uint256[]", '{"a":1}').pipe(Effect.flip)
			expect(error._tag).toBe("AbiError")
			expect(error.message).toContain("expected JSON array")
		}),
	)

	it.effect("coerces nested array uint256[][] recursively", () =>
		Effect.gen(function* () {
			// For uint256[][], the regex strips one [] layer, so baseType = "uint256[]"
			// Each inner element gets String()-ified, so [1,2] becomes "1,2" which is not valid JSON.
			// The correct input format for nested arrays is an array of JSON-stringified inner arrays.
			const result = yield* coerceArgValue("uint256[][]", '["[1,2]","[3,4]"]')
			expect(result).toEqual([
				[1n, 2n],
				[3n, 4n],
			])
		}),
	)

	it.effect("unknown/custom type falls through and returns raw string", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("customType", "someValue")
			expect(result).toBe("someValue")
		}),
	)
})

// ---------------------------------------------------------------------------
// abiEncodeHandler — packed encoding with multiple types
// ---------------------------------------------------------------------------

describe("abiEncodeHandler — packed encoding edge cases", () => {
	it.effect("packed encoding with address, uint256, and bool", () =>
		Effect.gen(function* () {
			const result = yield* abiEncodeHandler(
				"(address,uint256,bool)",
				["0x0000000000000000000000000000000000000001", "100", "true"],
				true,
			)
			expect(result.startsWith("0x")).toBe(true)
			// packed encoding: 20 bytes address + 32 bytes uint256 + 1 byte bool = 53 bytes = 106 hex chars + "0x"
			expect(result.length).toBe(108)
		}),
	)

	it.effect("packed encoding with string and uint256 succeeds", () =>
		Effect.gen(function* () {
			// Abi.encodePacked supports string type, so this should succeed
			const result = yield* abiEncodeHandler(
				"(string,uint256)",
				["hello", "42"],
				true,
			)
			expect(result.startsWith("0x")).toBe(true)
		}),
	)
})

// ---------------------------------------------------------------------------
// calldataDecodeHandler — zero-arg function and bool args
// ---------------------------------------------------------------------------

describe("calldataDecodeHandler — zero-arg and bool edge cases", () => {
	it.effect("decodes zero-arg function (totalSupply) calldata", () =>
		Effect.gen(function* () {
			// First encode totalSupply calldata
			const calldata = yield* calldataHandler("totalSupply()", [])
			// Then decode it
			const result = yield* calldataDecodeHandler("totalSupply()", calldata)
			expect(result.name).toBe("totalSupply")
			expect(result.signature).toBe("totalSupply()")
			expect(result.args).toEqual([])
		}),
	)

	it.effect("decodes calldata with bool argument", () =>
		Effect.gen(function* () {
			// Encode a function that takes a bool
			const calldata = yield* calldataHandler("setApproval(bool)", ["true"])
			// Decode and verify
			const result = yield* calldataDecodeHandler("setApproval(bool)", calldata)
			expect(result.name).toBe("setApproval")
			expect(result.signature).toBe("setApproval(bool)")
			expect(result.args.length).toBe(1)
			// bool decodes to "true"
			expect(result.args[0]).toBe("true")
		}),
	)
})

// ---------------------------------------------------------------------------
// abiDecodeHandler — outputs vs inputs selection
// ---------------------------------------------------------------------------

describe("abiDecodeHandler — output vs input type selection", () => {
	it.effect("uses outputs when signature has both inputs and outputs", () =>
		Effect.gen(function* () {
			// Encode a single uint256 value
			const encoded = yield* abiEncodeHandler("(uint256)", ["42"], false)
			// Decode with a signature that has outputs: balanceOf(address)(uint256)
			// The decoder should use the output types (uint256), not the input types (address)
			const result = yield* abiDecodeHandler("balanceOf(address)(uint256)", encoded)
			expect(result.length).toBe(1)
			expect(result[0]).toBe("42")
		}),
	)

	it.effect("uses inputs when signature has no outputs", () =>
		Effect.gen(function* () {
			// Encode a uint256 value
			const encoded = yield* abiEncodeHandler("(uint256)", ["999"], false)
			// Decode with a signature that has only inputs (no outputs)
			const result = yield* abiDecodeHandler("(uint256)", encoded)
			expect(result.length).toBe(1)
			expect(result[0]).toBe("999")
		}),
	)
})

// ---------------------------------------------------------------------------
// safeEncodeParameters — error path via invalid types
// ---------------------------------------------------------------------------

describe("safeEncodeParameters — error path with invalid types", () => {
	it.effect("fails with AbiError when encoding with an invalid Solidity type", () =>
		Effect.gen(function* () {
			// Pass a completely invalid type that gets past coercion (falls through to passthrough)
			// but fails during actual ABI encoding
			const error = yield* abiEncodeHandler("(invalidType999)", ["someValue"], false).pipe(Effect.flip)
			expect(error._tag).toBe("AbiError")
			expect(error.message).toContain("encoding failed")
		}),
	)
})

// ---------------------------------------------------------------------------
// safeDecodeParameters — error path with truncated data
// ---------------------------------------------------------------------------

describe("safeDecodeParameters — error path with truncated/invalid data", () => {
	it.effect("fails with AbiError when decoding truncated data for uint256", () =>
		Effect.gen(function* () {
			// Valid hex but too short for a uint256 (needs 32 bytes = 64 hex chars, only providing 4)
			const error = yield* abiDecodeHandler("(uint256)", "0xdeadbeef").pipe(Effect.flip)
			expect(error._tag).toBe("AbiError")
			expect(error.message).toContain("decoding failed")
		}),
	)

	it.effect("fails with AbiError when decoding empty data for a type that expects data", () =>
		Effect.gen(function* () {
			const error = yield* abiDecodeHandler("(uint256,address)", "0x").pipe(Effect.flip)
			expect(error._tag).toBe("AbiError")
		}),
	)

	it.effect("fails with AbiError when decoding corrupted mid-stream data", () =>
		Effect.gen(function* () {
			// Provide one valid uint256 slot but signature expects two params
			const oneSlot = `0x${"00".repeat(32)}`
			const error = yield* abiDecodeHandler("(uint256,uint256)", oneSlot).pipe(Effect.flip)
			expect(error._tag).toBe("AbiError")
		}),
	)
})
