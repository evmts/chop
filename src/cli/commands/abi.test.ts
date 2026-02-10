import { execSync } from "node:child_process"
import { describe, it } from "@effect/vitest"
import { decodeParameters, encodeParameters } from "@tevm/voltaire/Abi"
import { Effect } from "effect"
import { expect } from "vitest"
import { Abi, Hex } from "voltaire-effect"
import {
	AbiError,
	ArgumentCountError,
	HexDecodeError,
	InvalidSignatureError,
	abiDecodeHandler,
	abiEncodeHandler,
	buildAbiItem,
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

function runCli(args: string): {
	stdout: string
	stderr: string
	exitCode: number
} {
	try {
		const stdout = execSync(`bun run bin/chop.ts ${args}`, {
			cwd: process.cwd(),
			encoding: "utf-8",
			timeout: 15_000,
			env: { ...process.env, NO_COLOR: "1" },
			stdio: ["pipe", "pipe", "pipe"],
		})
		return { stdout, stderr: "", exitCode: 0 }
	} catch (error) {
		const e = error as {
			stdout?: string
			stderr?: string
			status?: number
		}
		return {
			stdout: (e.stdout ?? "").toString(),
			stderr: (e.stderr ?? "").toString(),
			exitCode: e.status ?? 1,
		}
	}
}

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
