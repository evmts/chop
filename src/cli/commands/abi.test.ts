import { execSync } from "node:child_process"
import { describe, it } from "@effect/vitest"
import { decodeParameters, encodeParameters } from "@tevm/voltaire/Abi"
import { Effect } from "effect"
import { expect } from "vitest"
import { Abi, Hex } from "voltaire-effect"
import {
	ArgumentCountError,
	HexDecodeError,
	InvalidSignatureError,
	coerceArgValue,
	formatValue,
	parseSignature,
} from "./abi.js"

/**
 * Bridge our dynamic string types to voltaire's branded AbiType.
 * Uses `any` because voltaire exports two conflicting Parameter types.
 */
// biome-ignore lint/suspicious/noExplicitAny: bridges dynamic string types to voltaire's branded AbiType union
const toParams = (types: ReadonlyArray<{ readonly type: string }>): any => types

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
	it("coerces address to Uint8Array", () => {
		const result = coerceArgValue("address", "0x0000000000000000000000000000000000001234")
		expect(result).toBeInstanceOf(Uint8Array)
		expect((result as Uint8Array).length).toBe(20)
	})

	it("coerces uint256 to bigint", () => {
		const result = coerceArgValue("uint256", "1000000000000000000")
		expect(result).toBe(1000000000000000000n)
	})

	it("coerces uint8 to bigint", () => {
		expect(coerceArgValue("uint8", "255")).toBe(255n)
	})

	it("coerces int256 to bigint (negative)", () => {
		expect(coerceArgValue("int256", "-42")).toBe(-42n)
	})

	it("coerces bool true", () => {
		expect(coerceArgValue("bool", "true")).toBe(true)
	})

	it("coerces bool false", () => {
		expect(coerceArgValue("bool", "false")).toBe(false)
	})

	it("coerces bool from 1", () => {
		expect(coerceArgValue("bool", "1")).toBe(true)
	})

	it("coerces bool from 0", () => {
		expect(coerceArgValue("bool", "0")).toBe(false)
	})

	it("passes through string type", () => {
		expect(coerceArgValue("string", "hello")).toBe("hello")
	})

	it("coerces bytes32 to Uint8Array", () => {
		const hex = `0x${"ab".repeat(32)}`
		const result = coerceArgValue("bytes32", hex)
		expect(result).toBeInstanceOf(Uint8Array)
		expect((result as Uint8Array).length).toBe(32)
	})

	it("coerces bytes to Uint8Array", () => {
		const result = coerceArgValue("bytes", "0xdeadbeef")
		expect(result).toBeInstanceOf(Uint8Array)
		expect((result as Uint8Array).length).toBe(4)
	})
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
			const coerced = sig.inputs.map((p, i) => coerceArgValue(p.type, rawArgs[i]!))

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
			const coerced = [coerceArgValue("bool", "true")]
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
			const coerced = sig.inputs.map((p, i) => coerceArgValue(p.type, rawArgs[i]!))

			const abiItem = {
				type: "function" as const,
				name: sig.name,
				stateMutability: "nonpayable" as const,
				inputs: toParams(sig.inputs.map((p) => ({ type: p.type, name: p.type }))),
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
				inputs: toParams(sig.inputs.map((p) => ({ type: p.type, name: p.type }))),
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
	it.effect("abi-encode → abi-decode produces original values", () =>
		Effect.gen(function* () {
			const sig = yield* parseSignature("transfer(address,uint256)")
			const rawArgs = ["0x0000000000000000000000000000000000001234", "1000000000000000000"]
			// biome-ignore lint/style/noNonNullAssertion: index safe — validated by arg count check
			const coerced = sig.inputs.map((p, i) => coerceArgValue(p.type, rawArgs[i]!))

			const encoded = encodeParameters(toParams(sig.inputs), coerced as [unknown, ...unknown[]])
			const decoded = decodeParameters(toParams(sig.inputs), encoded)

			expect(decoded[0]).toBe("0x0000000000000000000000000000000000001234")
			expect(decoded[1]).toBe(1000000000000000000n)
		}),
	)

	it.effect("calldata-encode → calldata-decode produces original values", () =>
		Effect.gen(function* () {
			const sig = yield* parseSignature("transfer(address,uint256)")
			const rawArgs = ["0x0000000000000000000000000000000000001234", "1000000000000000000"]
			// biome-ignore lint/style/noNonNullAssertion: index safe — validated by arg count check
			const coerced = sig.inputs.map((p, i) => coerceArgValue(p.type, rawArgs[i]!))

			const abiItem = {
				type: "function" as const,
				name: sig.name,
				stateMutability: "nonpayable" as const,
				inputs: toParams(sig.inputs.map((p) => ({ type: p.type, name: p.type }))),
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
