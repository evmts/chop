/**
 * Boundary condition, edge case, and error path tests for handler functions.
 *
 * Tests cover:
 * - abi.ts: parseSignature, coerceArgValue, formatValue, validateArgCount, abiEncodeHandler, calldataHandler, calldataDecodeHandler
 * - address.ts: toCheckSumAddressHandler, computeAddressHandler, create2Handler
 * - bytecode.ts: disassembleHandler, fourByteHandler, fourByteEventHandler
 * - crypto.ts: keccakHandler, sigHandler, sigEventHandler, hashMessageHandler
 * - shared.ts: validateHexData
 */

import { describe, it } from "@effect/vitest"
import { Effect, Either } from "effect"
import { expect } from "vitest"
import { Keccak256 } from "voltaire-effect"

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
	validateHexData as abiValidateHexData,
} from "./abi.js"

import {
	ComputeAddressError,
	InvalidAddressError,
	InvalidHexError as AddrInvalidHexError,
	computeAddressHandler,
	create2Handler,
	toCheckSumAddressHandler,
} from "./address.js"

import {
	InvalidBytecodeError,
	SelectorLookupError,
	disassembleHandler,
	fourByteEventHandler,
	fourByteHandler,
} from "./bytecode.js"

import { CryptoError, hashMessageHandler, keccakHandler, sigEventHandler, sigHandler } from "./crypto.js"

import { validateHexData } from "../shared.js"

// ============================================================================
// parseSignature — edge cases
// ============================================================================

describe("parseSignature — boundary/edge cases", () => {
	it.effect("parses signature with only parens '()' as name='' with empty inputs", () =>
		Effect.gen(function* () {
			const result = yield* parseSignature("()")
			expect(result.name).toBe("")
			expect(result.inputs).toHaveLength(0)
			expect(result.outputs).toHaveLength(0)
		}),
	)

	it.effect("parses nested tuple types 'foo((uint256,address),bytes)'", () =>
		Effect.gen(function* () {
			const result = yield* parseSignature("foo((uint256,address),bytes)")
			expect(result.name).toBe("foo")
			expect(result.inputs).toEqual([{ type: "(uint256,address)" }, { type: "bytes" }])
		}),
	)

	it.effect("parses deeply nested tuples 'foo(((uint256)))'", () =>
		Effect.gen(function* () {
			const result = yield* parseSignature("foo(((uint256)))")
			expect(result.name).toBe("foo")
			expect(result.inputs).toEqual([{ type: "((uint256))" }])
		}),
	)

	it.effect("parses signature with no name but with outputs '(uint256)(bool)'", () =>
		Effect.gen(function* () {
			const result = yield* parseSignature("(uint256)(bool)")
			expect(result.name).toBe("")
			expect(result.inputs).toEqual([{ type: "uint256" }])
			expect(result.outputs).toEqual([{ type: "bool" }])
		}),
	)

	it.effect("rejects empty string with InvalidSignatureError", () =>
		Effect.gen(function* () {
			const result = yield* parseSignature("").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidSignatureError")
			}
		}),
	)

	it.effect("rejects string with no parens", () =>
		Effect.gen(function* () {
			const result = yield* parseSignature("nope").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidSignatureError")
				expect(result.left.message).toContain("missing parentheses")
			}
		}),
	)

	it.effect("rejects invalid function name chars '123abc(uint256)'", () =>
		Effect.gen(function* () {
			const result = yield* parseSignature("123abc(uint256)").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidSignatureError")
				expect(result.left.message).toContain("Invalid signature format")
			}
		}),
	)

	it.effect("rejects function name starting with a digit '9foo(uint256)'", () =>
		Effect.gen(function* () {
			const result = yield* parseSignature("9foo(uint256)").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
		}),
	)

	it.effect("rejects unclosed parentheses 'foo(uint256'", () =>
		Effect.gen(function* () {
			const result = yield* parseSignature("foo(uint256").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidSignatureError")
			}
		}),
	)

	it.effect("rejects trailing garbage after valid signature 'foo()extra'", () =>
		Effect.gen(function* () {
			const result = yield* parseSignature("foo()extra").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidSignatureError")
			}
		}),
	)

	it.effect("accepts underscore-prefixed name '_private(uint256)'", () =>
		Effect.gen(function* () {
			const result = yield* parseSignature("_private(uint256)")
			expect(result.name).toBe("_private")
			expect(result.inputs).toEqual([{ type: "uint256" }])
		}),
	)

	it.effect("accepts name with underscores 'my_function(uint256)'", () =>
		Effect.gen(function* () {
			const result = yield* parseSignature("my_function(uint256)")
			expect(result.name).toBe("my_function")
		}),
	)

	it.effect("parses whitespace-padded signature", () =>
		Effect.gen(function* () {
			const result = yield* parseSignature("  foo(uint256)  ")
			expect(result.name).toBe("foo")
			expect(result.inputs).toEqual([{ type: "uint256" }])
		}),
	)

	it.effect("parses many inputs", () =>
		Effect.gen(function* () {
			const result = yield* parseSignature("f(uint256,uint256,uint256,uint256,uint256)")
			expect(result.name).toBe("f")
			expect(result.inputs).toHaveLength(5)
		}),
	)

	it.effect("rejects function name with special chars 'foo-bar(uint256)'", () =>
		Effect.gen(function* () {
			const result = yield* parseSignature("foo-bar(uint256)").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
		}),
	)
})

// ============================================================================
// coerceArgValue — edge cases
// ============================================================================

describe("coerceArgValue — boundary/edge cases", () => {
	it.effect("address type with zero address", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("address", "0x0000000000000000000000000000000000000000")
			expect(result).toBeInstanceOf(Uint8Array)
			const arr = result as Uint8Array
			expect(arr.length).toBe(20)
			expect(arr.every((b) => b === 0)).toBe(true)
		}),
	)

	it.effect("uint256 type with zero '0'", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("uint256", "0")
			expect(result).toBe(0n)
		}),
	)

	it.effect("uint256 type with max uint256", () =>
		Effect.gen(function* () {
			const maxUint256 = "115792089237316195423570985008687907853269984665640564039457584007913129639935"
			const result = yield* coerceArgValue("uint256", maxUint256)
			expect(result).toBe(2n ** 256n - 1n)
		}),
	)

	it.effect("bool type with 'false' returns false", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("bool", "false")
			expect(result).toBe(false)
		}),
	)

	it.effect("bool type with '0' returns false", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("bool", "0")
			expect(result).toBe(false)
		}),
	)

	it.effect("bool type with '1' returns true", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("bool", "1")
			expect(result).toBe(true)
		}),
	)

	it.effect("bool type with random string returns false (not 'true' or '1')", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("bool", "yes")
			expect(result).toBe(false)
		}),
	)

	it.effect("bytes32 type with hex", () =>
		Effect.gen(function* () {
			const hex = `0x${"ff".repeat(32)}`
			const result = yield* coerceArgValue("bytes32", hex)
			expect(result).toBeInstanceOf(Uint8Array)
			const arr = result as Uint8Array
			expect(arr.length).toBe(32)
			expect(arr.every((b) => b === 0xff)).toBe(true)
		}),
	)

	it.effect("string type pass-through preserves value exactly", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("string", "hello world")
			expect(result).toBe("hello world")
		}),
	)

	it.effect("string type with empty string", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("string", "")
			expect(result).toBe("")
		}),
	)

	it.effect("array type uint256[] with JSON '[1,2,3]'", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("uint256[]", "[1,2,3]")
			expect(result).toEqual([1n, 2n, 3n])
		}),
	)

	it.effect("array type uint256[] with empty array '[]'", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("uint256[]", "[]")
			expect(result).toEqual([])
		}),
	)

	it.effect("array type with invalid JSON fails with AbiError", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("uint256[]", "not-json").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("AbiError")
				expect(result.left.message).toContain("Invalid array value")
			}
		}),
	)

	it.effect("array type with non-array JSON value fails with AbiError", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("uint256[]", '"not-an-array"').pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("AbiError")
			}
		}),
	)

	it.effect("unknown/tuple type passes through as string", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("(uint256,address)", "some-value")
			expect(result).toBe("some-value")
		}),
	)

	it.effect("uint256 with non-numeric string fails with AbiError", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("uint256", "not-a-number").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("AbiError")
				expect(result.left.message).toContain("Invalid integer value")
			}
		}),
	)

	it.effect("int256 with negative value", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("int256", "-1")
			expect(result).toBe(-1n)
		}),
	)

	it.effect("fixed-size array uint256[3] with '[10,20,30]'", () =>
		Effect.gen(function* () {
			const result = yield* coerceArgValue("uint256[3]", "[10,20,30]")
			expect(result).toEqual([10n, 20n, 30n])
		}),
	)
})

// ============================================================================
// formatValue — edge cases
// ============================================================================

describe("formatValue — boundary/edge cases", () => {
	it("formats Uint8Array as hex string", () => {
		expect(formatValue(new Uint8Array([0xde, 0xad]))).toBe("0xdead")
	})

	it("formats empty Uint8Array as 0x", () => {
		expect(formatValue(new Uint8Array([]))).toBe("0x")
	})

	it("formats bigint as decimal string", () => {
		expect(formatValue(0n)).toBe("0")
		expect(formatValue(2n ** 256n - 1n)).toBe((2n ** 256n - 1n).toString())
	})

	it("formats boolean true as 'true'", () => {
		expect(formatValue(true)).toBe("true")
	})

	it("formats boolean false as 'false'", () => {
		expect(formatValue(false)).toBe("false")
	})

	it("formats nested array [[1n, 2n], [3n]]", () => {
		const result = formatValue([[1n, 2n], [3n]])
		expect(result).toBe("[[1, 2], [3]]")
	})

	it("formats empty array", () => {
		expect(formatValue([])).toBe("[]")
	})

	it("formats null as 'null'", () => {
		expect(formatValue(null)).toBe("null")
	})

	it("formats undefined as 'undefined'", () => {
		expect(formatValue(undefined)).toBe("undefined")
	})

	it("formats number as string", () => {
		expect(formatValue(42)).toBe("42")
	})

	it("formats mixed array of types", () => {
		const result = formatValue([new Uint8Array([0xab]), 42n, true])
		expect(result).toBe("[0xab, 42, true]")
	})
})

// ============================================================================
// validateArgCount — edge cases
// ============================================================================

describe("validateArgCount — boundary/edge cases", () => {
	it.effect("expected 0, received 0 succeeds", () =>
		Effect.gen(function* () {
			yield* validateArgCount(0, 0)
		}),
	)

	it.effect("expected 1, received 0 fails with ArgumentCountError", () =>
		Effect.gen(function* () {
			const result = yield* validateArgCount(1, 0).pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("ArgumentCountError")
				expect(result.left.expected).toBe(1)
				expect(result.left.received).toBe(0)
				expect(result.left.message).toContain("Expected 1 argument, got 0")
			}
		}),
	)

	it.effect("expected 0, received 1 fails with ArgumentCountError", () =>
		Effect.gen(function* () {
			const result = yield* validateArgCount(0, 1).pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("ArgumentCountError")
				expect(result.left.expected).toBe(0)
				expect(result.left.received).toBe(1)
				expect(result.left.message).toContain("Expected 0 arguments, got 1")
			}
		}),
	)

	it.effect("expected 5, received 5 succeeds", () =>
		Effect.gen(function* () {
			yield* validateArgCount(5, 5)
		}),
	)

	it.effect("expected 2, received 3 fails with correct message", () =>
		Effect.gen(function* () {
			const result = yield* validateArgCount(2, 3).pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left.message).toContain("Expected 2 arguments, got 3")
			}
		}),
	)

	it.effect("singular 'argument' for expected=1", () =>
		Effect.gen(function* () {
			const result = yield* validateArgCount(1, 5).pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				// "Expected 1 argument, got 5" — singular "argument"
				expect(result.left.message).toMatch(/Expected 1 argument,/)
				expect(result.left.message).not.toMatch(/Expected 1 arguments,/)
			}
		}),
	)
})

// ============================================================================
// buildAbiItem / toParams — basic coverage
// ============================================================================

describe("buildAbiItem — edge cases", () => {
	it.effect("builds ABI item from zero-arg signature", () =>
		Effect.gen(function* () {
			const parsed = yield* parseSignature("foo()")
			const item = buildAbiItem(parsed)
			expect(item.type).toBe("function")
			expect(item.name).toBe("foo")
			expect(item.inputs).toEqual([])
			expect(item.outputs).toEqual([])
		}),
	)

	it.effect("builds ABI item with outputs", () =>
		Effect.gen(function* () {
			const parsed = yield* parseSignature("balanceOf(address)(uint256)")
			const item = buildAbiItem(parsed)
			expect(item.inputs).toEqual([{ type: "address", name: "arg0" }])
			expect(item.outputs).toEqual([{ type: "uint256", name: "out0" }])
		}),
	)

	it("toParams passes through types array", () => {
		const types = [{ type: "uint256" }, { type: "address" }]
		expect(toParams(types)).toBe(types)
	})
})

// ============================================================================
// abiEncodeHandler — boundary cases
// ============================================================================

describe("abiEncodeHandler — boundary cases", () => {
	it.effect("zero-arg function 'foo()' with no args", () =>
		Effect.gen(function* () {
			const result = yield* abiEncodeHandler("foo()", [], false)
			// Encoding zero params should produce "0x" (empty)
			expect(result).toBe("0x")
		}),
	)

	it.effect("single bool '(bool)' with 'true'", () =>
		Effect.gen(function* () {
			const result = yield* abiEncodeHandler("(bool)", ["true"], false)
			expect(result).toBe("0x0000000000000000000000000000000000000000000000000000000000000001")
		}),
	)

	it.effect("single bool '(bool)' with 'false'", () =>
		Effect.gen(function* () {
			const result = yield* abiEncodeHandler("(bool)", ["false"], false)
			expect(result).toBe("0x0000000000000000000000000000000000000000000000000000000000000000")
		}),
	)

	it.effect("fails with wrong arg count", () =>
		Effect.gen(function* () {
			const result = yield* abiEncodeHandler("(uint256,uint256)", ["1"], false).pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("ArgumentCountError")
			}
		}),
	)

	it.effect("fails with invalid signature", () =>
		Effect.gen(function* () {
			const result = yield* abiEncodeHandler("notvalid", [], false).pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidSignatureError")
			}
		}),
	)

	it.effect("packed encoding with address and uint256", () =>
		Effect.gen(function* () {
			const result = yield* abiEncodeHandler(
				"(address,uint256)",
				["0x0000000000000000000000000000000000001234", "1"],
				true,
			)
			// packed: address (20 bytes) + uint256 (32 bytes)
			expect(result).toMatch(/^0x[0-9a-f]+$/)
			// address is 20 bytes = 40 hex chars, uint256 is 32 bytes = 64 hex chars, plus "0x" prefix
			expect(result.length).toBe(2 + 40 + 64)
		}),
	)
})

// ============================================================================
// calldataHandler — boundary cases
// ============================================================================

describe("calldataHandler — boundary cases", () => {
	it.effect("rejects nameless signature for calldata", () =>
		Effect.gen(function* () {
			const result = yield* calldataHandler("(uint256)", ["1"]).pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidSignatureError")
				expect(result.left.message).toContain("calldata command requires a function name")
			}
		}),
	)

	it.effect("zero-arg function 'foo()' produces 4-byte selector only", () =>
		Effect.gen(function* () {
			const result = yield* calldataHandler("foo()", [])
			// Should be exactly 4 bytes = "0x" + 8 hex chars
			expect(result).toMatch(/^0x[0-9a-f]{8}$/)
		}),
	)
})

// ============================================================================
// calldataDecodeHandler — boundary cases
// ============================================================================

describe("calldataDecodeHandler — boundary cases", () => {
	it.effect("rejects nameless signature", () =>
		Effect.gen(function* () {
			const result = yield* calldataDecodeHandler("(uint256)", "0x00000000").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidSignatureError")
				expect(result.left.message).toContain("calldata-decode requires a function name")
			}
		}),
	)

	it.effect("rejects invalid hex data", () =>
		Effect.gen(function* () {
			const result = yield* calldataDecodeHandler("foo(uint256)", "not-hex").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("HexDecodeError")
			}
		}),
	)
})

// ============================================================================
// abiDecodeHandler — boundary cases
// ============================================================================

describe("abiDecodeHandler — boundary cases", () => {
	it.effect("rejects invalid hex data", () =>
		Effect.gen(function* () {
			const result = yield* abiDecodeHandler("(uint256)", "not-hex-data").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("HexDecodeError")
			}
		}),
	)

	it.effect("uses output types when present", () =>
		Effect.gen(function* () {
			// encode a uint256 value first
			const encoded = yield* abiEncodeHandler("(uint256)", ["42"], false)
			// decode using a signature with outputs — should decode using output types
			const decoded = yield* abiDecodeHandler("foo(address)(uint256)", encoded)
			expect(decoded).toEqual(["42"])
		}),
	)
})

// ============================================================================
// abi validateHexData — edge cases
// ============================================================================

describe("abi validateHexData (HexDecodeError) — boundary cases", () => {
	it.effect("accepts empty hex '0x' producing empty bytes", () =>
		Effect.gen(function* () {
			const result = yield* abiValidateHexData("0x")
			expect(result).toEqual(new Uint8Array([]))
		}),
	)

	it.effect("rejects no prefix", () =>
		Effect.gen(function* () {
			const result = yield* abiValidateHexData("deadbeef").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("HexDecodeError")
			}
		}),
	)

	it.effect("rejects odd-length hex", () =>
		Effect.gen(function* () {
			const result = yield* abiValidateHexData("0xabc").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("HexDecodeError")
				expect(result.left.message).toContain("Odd-length")
			}
		}),
	)

	it.effect("rejects invalid chars", () =>
		Effect.gen(function* () {
			const result = yield* abiValidateHexData("0xZZZZ").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("HexDecodeError")
				expect(result.left.message).toContain("Invalid hex characters")
			}
		}),
	)
})

// ============================================================================
// Address handlers — boundary cases
// ============================================================================

describe("toCheckSumAddressHandler — boundary cases", () => {
	it.effect("checksums zero address", () =>
		Effect.gen(function* () {
			const result = yield* toCheckSumAddressHandler("0x0000000000000000000000000000000000000000")
			expect(result).toBe("0x0000000000000000000000000000000000000000")
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("checksums max address (all ff)", () =>
		Effect.gen(function* () {
			const result = yield* toCheckSumAddressHandler("0xffffffffffffffffffffffffffffffffffffffff")
			// EIP-55 checksum of all-ff address
			expect(result).toMatch(/^0x[0-9a-fA-F]{40}$/)
			expect(result.toLowerCase()).toBe("0xffffffffffffffffffffffffffffffffffffffff")
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("rejects invalid address (too short)", () =>
		Effect.gen(function* () {
			const result = yield* toCheckSumAddressHandler("0x1234").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("rejects non-hex address", () =>
		Effect.gen(function* () {
			const result = yield* toCheckSumAddressHandler("not-an-address").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("rejects empty string", () =>
		Effect.gen(function* () {
			const result = yield* toCheckSumAddressHandler("").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("rejects address too long", () =>
		Effect.gen(function* () {
			const result = yield* toCheckSumAddressHandler("0x" + "aa".repeat(21)).pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)
})

describe("computeAddressHandler — boundary cases", () => {
	it.effect("rejects negative nonce", () =>
		Effect.gen(function* () {
			const result = yield* computeAddressHandler("0xd8da6bf26964af9d7eed9e03e53415d37aa96045", "-1").pipe(
				Effect.either,
			)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("ComputeAddressError")
				expect(result.left.message).toContain("non-negative")
			}
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("rejects non-numeric nonce", () =>
		Effect.gen(function* () {
			const result = yield* computeAddressHandler("0xd8da6bf26964af9d7eed9e03e53415d37aa96045", "abc").pipe(
				Effect.either,
			)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("ComputeAddressError")
				expect(result.left.message).toContain("Invalid nonce")
			}
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("rejects invalid deployer address", () =>
		Effect.gen(function* () {
			const result = yield* computeAddressHandler("0xbad", "0").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("computes address with nonce 0", () =>
		Effect.gen(function* () {
			const result = yield* computeAddressHandler("0xd8da6bf26964af9d7eed9e03e53415d37aa96045", "0")
			expect(result).toMatch(/^0x[0-9a-fA-F]{40}$/)
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("empty nonce string is treated as 0 (BigInt('') === 0n)", () =>
		Effect.gen(function* () {
			const result = yield* computeAddressHandler("0xd8da6bf26964af9d7eed9e03e53415d37aa96045", "")
			// BigInt("") returns 0n, so this is equivalent to nonce=0
			expect(result).toMatch(/^0x[0-9a-fA-F]{40}$/)
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("rejects float nonce", () =>
		Effect.gen(function* () {
			const result = yield* computeAddressHandler("0xd8da6bf26964af9d7eed9e03e53415d37aa96045", "1.5").pipe(
				Effect.either,
			)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("ComputeAddressError")
			}
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)
})

describe("create2Handler — boundary cases", () => {
	it.effect("rejects invalid deployer address", () =>
		Effect.gen(function* () {
			const salt = "0x" + "00".repeat(32)
			const initCode = "0x600160005260206000f3"
			const result = yield* create2Handler("0xbad", salt, initCode).pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("rejects salt without 0x prefix", () =>
		Effect.gen(function* () {
			const result = yield* create2Handler(
				"0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
				"00".repeat(32),
				"0x600160005260206000f3",
			).pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("rejects salt that is not 32 bytes", () =>
		Effect.gen(function* () {
			const result = yield* create2Handler(
				"0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
				"0x" + "00".repeat(16),
				"0x600160005260206000f3",
			).pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("rejects invalid init code hex", () =>
		Effect.gen(function* () {
			const salt = "0x" + "00".repeat(32)
			const result = yield* create2Handler("0xd8da6bf26964af9d7eed9e03e53415d37aa96045", salt, "not-hex").pipe(
				Effect.either,
			)
			expect(Either.isLeft(result)).toBe(true)
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("computes create2 address with valid inputs", () =>
		Effect.gen(function* () {
			const deployer = "0xd8da6bf26964af9d7eed9e03e53415d37aa96045"
			const salt = "0x" + "00".repeat(32)
			const initCode = "0x600160005260206000f3"
			const result = yield* create2Handler(deployer, salt, initCode)
			expect(result).toMatch(/^0x[0-9a-fA-F]{40}$/)
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)
})

// ============================================================================
// Bytecode handlers — boundary cases
// ============================================================================

describe("disassembleHandler — boundary cases", () => {
	it.effect("empty bytecode '0x' returns empty array", () =>
		Effect.gen(function* () {
			const result = yield* disassembleHandler("0x")
			expect(result).toEqual([])
		}),
	)

	it.effect("single STOP opcode '0x00'", () =>
		Effect.gen(function* () {
			const result = yield* disassembleHandler("0x00")
			expect(result).toHaveLength(1)
			expect(result[0]).toEqual({ pc: 0, opcode: "0x00", name: "STOP" })
		}),
	)

	it.effect("PUSH1 at end of bytecode (truncated data)", () =>
		Effect.gen(function* () {
			// PUSH1 (0x60) expects 1 byte of data but bytecode ends
			const result = yield* disassembleHandler("0x60")
			expect(result).toHaveLength(1)
			expect(result[0]!.name).toBe("PUSH1")
			// pushData should be "0x" since there's no data byte available
			expect(result[0]!.pushData).toBe("0x")
		}),
	)

	it.effect("PUSH32 with full 32 bytes of data", () =>
		Effect.gen(function* () {
			// 0x7f = PUSH32, followed by 32 bytes of 0xff
			const bytecode = "0x7f" + "ff".repeat(32)
			const result = yield* disassembleHandler(bytecode)
			expect(result).toHaveLength(1)
			expect(result[0]!.name).toBe("PUSH32")
			expect(result[0]!.pushData).toBe("0x" + "ff".repeat(32))
			expect(result[0]!.pc).toBe(0)
		}),
	)

	it.effect("PUSH2 with partial data (only 1 of 2 bytes available)", () =>
		Effect.gen(function* () {
			// 0x61 = PUSH2, expects 2 bytes but only 1 available
			const result = yield* disassembleHandler("0x61ab")
			expect(result).toHaveLength(1)
			expect(result[0]!.name).toBe("PUSH2")
			expect(result[0]!.pushData).toBe("0xab")
		}),
	)

	it.effect("unknown opcode (0xef)", () =>
		Effect.gen(function* () {
			const result = yield* disassembleHandler("0xef")
			expect(result).toHaveLength(1)
			expect(result[0]!.name).toBe("UNKNOWN(0xef)")
			expect(result[0]!.opcode).toBe("0xef")
		}),
	)

	it.effect("rejects bytecode without 0x prefix", () =>
		Effect.gen(function* () {
			const result = yield* disassembleHandler("deadbeef").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidBytecodeError")
				expect(result.left.message).toContain("must start with 0x")
			}
		}),
	)

	it.effect("rejects odd-length hex", () =>
		Effect.gen(function* () {
			const result = yield* disassembleHandler("0xabc").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidBytecodeError")
				expect(result.left.message).toContain("Odd-length hex string")
			}
		}),
	)

	it.effect("rejects non-hex chars", () =>
		Effect.gen(function* () {
			const result = yield* disassembleHandler("0xZZZZ").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidBytecodeError")
				expect(result.left.message).toContain("Invalid hex characters")
			}
		}),
	)

	it.effect("accepts uppercase 0X prefix", () =>
		Effect.gen(function* () {
			const result = yield* disassembleHandler("0X00")
			expect(result).toHaveLength(1)
			expect(result[0]!.name).toBe("STOP")
		}),
	)

	it.effect("multiple instructions in sequence", () =>
		Effect.gen(function* () {
			// STOP, ADD, MUL → 0x00, 0x01, 0x02
			const result = yield* disassembleHandler("0x000102")
			expect(result).toHaveLength(3)
			expect(result[0]!.name).toBe("STOP")
			expect(result[0]!.pc).toBe(0)
			expect(result[1]!.name).toBe("ADD")
			expect(result[1]!.pc).toBe(1)
			expect(result[2]!.name).toBe("MUL")
			expect(result[2]!.pc).toBe(2)
		}),
	)

	it.effect("PC offset advances correctly past PUSH data", () =>
		Effect.gen(function* () {
			// PUSH1 0x80, STOP → 0x60 0x80 0x00
			const result = yield* disassembleHandler("0x608000")
			expect(result).toHaveLength(2)
			expect(result[0]!.pc).toBe(0)
			expect(result[0]!.name).toBe("PUSH1")
			expect(result[0]!.pushData).toBe("0x80")
			expect(result[1]!.pc).toBe(2)
			expect(result[1]!.name).toBe("STOP")
		}),
	)

	it.effect("preserves error data field with original input", () =>
		Effect.gen(function* () {
			const result = yield* disassembleHandler("bad-input").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left.data).toBe("bad-input")
			}
		}),
	)
})

// ============================================================================
// fourByteHandler — boundary cases
// ============================================================================

describe("fourByteHandler — boundary cases", () => {
	it.effect("rejects selector too short (6 hex chars)", () =>
		Effect.gen(function* () {
			const result = yield* fourByteHandler("0xabcdef").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("SelectorLookupError")
				expect(result.left.message).toContain("Invalid 4-byte selector")
			}
		}),
	)

	it.effect("rejects selector too long (10 hex chars)", () =>
		Effect.gen(function* () {
			const result = yield* fourByteHandler("0xabcdef0123").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("SelectorLookupError")
			}
		}),
	)

	it.effect("rejects selector with no 0x prefix", () =>
		Effect.gen(function* () {
			const result = yield* fourByteHandler("a9059cbb").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("SelectorLookupError")
				expect(result.left.message).toContain("Invalid 4-byte selector")
			}
		}),
	)

	it.effect("rejects selector with non-hex chars", () =>
		Effect.gen(function* () {
			const result = yield* fourByteHandler("0xZZZZZZZZ").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("SelectorLookupError")
			}
		}),
	)

	it.effect("rejects empty string", () =>
		Effect.gen(function* () {
			const result = yield* fourByteHandler("").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("SelectorLookupError")
			}
		}),
	)

	it.effect("rejects just '0x'", () =>
		Effect.gen(function* () {
			const result = yield* fourByteHandler("0x").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("SelectorLookupError")
			}
		}),
	)
})

// ============================================================================
// fourByteEventHandler — boundary cases
// ============================================================================

describe("fourByteEventHandler — boundary cases", () => {
	it.effect("rejects topic too short (8 hex chars instead of 64)", () =>
		Effect.gen(function* () {
			const result = yield* fourByteEventHandler("0xa9059cbb").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("SelectorLookupError")
				expect(result.left.message).toContain("Invalid event topic")
			}
		}),
	)

	it.effect("rejects topic with no 0x prefix", () =>
		Effect.gen(function* () {
			const topic = "a".repeat(64)
			const result = yield* fourByteEventHandler(topic).pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("SelectorLookupError")
				expect(result.left.message).toContain("Invalid event topic")
			}
		}),
	)

	it.effect("rejects empty string", () =>
		Effect.gen(function* () {
			const result = yield* fourByteEventHandler("").pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
		}),
	)

	it.effect("rejects topic with non-hex chars", () =>
		Effect.gen(function* () {
			const result = yield* fourByteEventHandler("0x" + "ZZ".repeat(32)).pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("SelectorLookupError")
			}
		}),
	)

	it.effect("rejects topic too long (66 hex chars instead of 64)", () =>
		Effect.gen(function* () {
			const result = yield* fourByteEventHandler("0x" + "aa".repeat(33)).pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
		}),
	)
})

// ============================================================================
// Crypto handlers — boundary cases
// ============================================================================

describe("keccakHandler — boundary cases", () => {
	it.effect("hashes empty hex '0x' (zero-length bytes)", () =>
		Effect.gen(function* () {
			const result = yield* keccakHandler("0x")
			// keccak256 of empty bytes
			expect(result).toMatch(/^0x[0-9a-f]{64}$/)
			// keccak256("") should differ from keccak256(0x) because one is UTF-8 string and the other is empty bytes
			const strResult = yield* keccakHandler("")
			// empty string "" and hex "0x" (empty bytes) should hash to same value since both are empty input
			expect(result).toBe(strResult)
		}),
	)

	it.effect("hashes very long input (1000 chars)", () =>
		Effect.gen(function* () {
			const longInput = "a".repeat(1000)
			const result = yield* keccakHandler(longInput)
			expect(result).toMatch(/^0x[0-9a-f]{64}$/)
		}),
	)

	it.effect("hashes unicode input (emoji)", () =>
		Effect.gen(function* () {
			const result = yield* keccakHandler("\u{1F600}")
			expect(result).toMatch(/^0x[0-9a-f]{64}$/)
		}),
	)

	it.effect("produces consistent results for same input", () =>
		Effect.gen(function* () {
			const r1 = yield* keccakHandler("hello")
			const r2 = yield* keccakHandler("hello")
			expect(r1).toBe(r2)
		}),
	)

	it.effect("different inputs produce different hashes", () =>
		Effect.gen(function* () {
			const r1 = yield* keccakHandler("hello")
			const r2 = yield* keccakHandler("world")
			expect(r1).not.toBe(r2)
		}),
	)
})

describe("sigHandler — boundary cases", () => {
	it.effect("empty signature returns a 4-byte selector", () =>
		Effect.gen(function* () {
			const result = yield* sigHandler("")
			expect(result).toMatch(/^0x[0-9a-f]{8}$/)
		}),
	)

	it.effect("known signature 'transfer(address,uint256)' returns correct selector", () =>
		Effect.gen(function* () {
			const result = yield* sigHandler("transfer(address,uint256)")
			expect(result).toBe("0xa9059cbb")
		}),
	)

	it.effect("known signature 'approve(address,uint256)' returns correct selector", () =>
		Effect.gen(function* () {
			const result = yield* sigHandler("approve(address,uint256)")
			expect(result).toBe("0x095ea7b3")
		}),
	)

	it.effect("consistent results for same signature", () =>
		Effect.gen(function* () {
			const r1 = yield* sigHandler("foo()")
			const r2 = yield* sigHandler("foo()")
			expect(r1).toBe(r2)
		}),
	)
})

describe("sigEventHandler — boundary cases", () => {
	it.effect("empty signature returns a 32-byte topic", () =>
		Effect.gen(function* () {
			const result = yield* sigEventHandler("")
			expect(result).toMatch(/^0x[0-9a-f]{64}$/)
		}),
	)

	it.effect("known event 'Transfer(address,address,uint256)' returns correct topic", () =>
		Effect.gen(function* () {
			const result = yield* sigEventHandler("Transfer(address,address,uint256)")
			expect(result).toBe("0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef")
		}),
	)

	it.effect("known event 'Approval(address,address,uint256)' returns correct topic", () =>
		Effect.gen(function* () {
			const result = yield* sigEventHandler("Approval(address,address,uint256)")
			expect(result).toBe("0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925")
		}),
	)
})

describe("hashMessageHandler — boundary cases", () => {
	it.effect("hashes empty message", () =>
		Effect.gen(function* () {
			const result = yield* hashMessageHandler("")
			expect(result).toMatch(/^0x[0-9a-f]{64}$/)
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("hashes single character", () =>
		Effect.gen(function* () {
			const result = yield* hashMessageHandler("a")
			expect(result).toMatch(/^0x[0-9a-f]{64}$/)
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("hashes long message", () =>
		Effect.gen(function* () {
			const result = yield* hashMessageHandler("x".repeat(500))
			expect(result).toMatch(/^0x[0-9a-f]{64}$/)
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("different messages produce different hashes", () =>
		Effect.gen(function* () {
			const r1 = yield* hashMessageHandler("hello")
			const r2 = yield* hashMessageHandler("world")
			expect(r1).not.toBe(r2)
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("consistent results for same message", () =>
		Effect.gen(function* () {
			const r1 = yield* hashMessageHandler("test")
			const r2 = yield* hashMessageHandler("test")
			expect(r1).toBe(r2)
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)
})

// ============================================================================
// shared validateHexData — boundary cases
// ============================================================================

class TestError {
	readonly _tag = "TestError"
	constructor(
		public message: string,
		public data: string,
	) {}
}

const mkTestError = (msg: string, data: string) => new TestError(msg, data)

describe("shared validateHexData — boundary cases", () => {
	it.effect("empty hex '0x' returns empty Uint8Array", () =>
		Effect.gen(function* () {
			const result = yield* validateHexData("0x", mkTestError)
			expect(result).toEqual(new Uint8Array([]))
		}),
	)

	it.effect("rejects no prefix with custom error", () =>
		Effect.gen(function* () {
			const result = yield* validateHexData("deadbeef", mkTestError).pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left).toBeInstanceOf(TestError)
				expect(result.left.message).toContain("must start with 0x")
				expect(result.left.data).toBe("deadbeef")
			}
		}),
	)

	it.effect("rejects odd-length hex", () =>
		Effect.gen(function* () {
			const result = yield* validateHexData("0xabc", mkTestError).pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left.message).toContain("Odd-length hex string")
			}
		}),
	)

	it.effect("rejects invalid chars", () =>
		Effect.gen(function* () {
			const result = yield* validateHexData("0xGHIJ", mkTestError).pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left.message).toContain("Invalid hex characters")
			}
		}),
	)

	it.effect("rejects single char after 0x (odd length)", () =>
		Effect.gen(function* () {
			const result = yield* validateHexData("0xa", mkTestError).pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left.message).toContain("Odd-length")
			}
		}),
	)

	it.effect("accepts long valid hex (256 bytes)", () =>
		Effect.gen(function* () {
			const longHex = "0x" + "ab".repeat(256)
			const result = yield* validateHexData(longHex, mkTestError)
			expect(result.length).toBe(256)
		}),
	)

	it.effect("rejects hex with whitespace", () =>
		Effect.gen(function* () {
			const result = yield* validateHexData("0xab cd", mkTestError).pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left.message).toContain("Invalid hex characters")
			}
		}),
	)

	it.effect("rejects hex with newline", () =>
		Effect.gen(function* () {
			const result = yield* validateHexData("0xab\ncd", mkTestError).pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
		}),
	)
})
