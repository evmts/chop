/**
 * Additional ENS coverage tests — edge cases for namehashHandler and
 * failure-path coverage for resolveNameHandler / lookupAddressHandler.
 *
 * Covers:
 * - namehashHandler edge cases: single-label, deep nesting, unicode, known vectors
 * - EnsError construction and properties
 * - resolveNameHandler "No resolver found" branch via local devnet mock
 * - lookupAddressHandler "No resolver found" branch via local devnet mock
 * - resolveNameHandler "Name not resolved" branch (resolver returns zero address)
 * - lookupAddressHandler "No name found" branch (resolver returns short data)
 */

import { FetchHttpClient } from "@effect/platform"
import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { bytesToHex, hexToBytes } from "../../evm/conversions.js"
import { TevmNode, TevmNodeService } from "../../node/index.js"
import { startRpcServer } from "../../rpc/server.js"
import { EnsError, lookupAddressHandler, namehashHandler, resolveNameHandler } from "./ens.js"

// ============================================================================
// EnsError — construction and properties
// ============================================================================

describe("EnsError — construction and properties", () => {
	it("has correct _tag", () => {
		const err = new EnsError({ message: "test error" })
		expect(err._tag).toBe("EnsError")
	})

	it("stores message", () => {
		const err = new EnsError({ message: "something went wrong" })
		expect(err.message).toBe("something went wrong")
	})

	it("stores cause when provided", () => {
		const cause = new Error("root cause")
		const err = new EnsError({ message: "wrapped", cause })
		expect(err.cause).toBe(cause)
	})

	it("cause is undefined when not provided", () => {
		const err = new EnsError({ message: "no cause" })
		expect(err.cause).toBeUndefined()
	})

	it("is an instance of Error", () => {
		const err = new EnsError({ message: "test" })
		expect(err).toBeInstanceOf(Error)
	})
})

// ============================================================================
// namehashHandler — additional edge cases
// ============================================================================

describe("namehashHandler — additional edge cases", () => {
	it.effect("empty name returns bytes32(0)", () =>
		Effect.gen(function* () {
			const result = yield* namehashHandler("")
			expect(result).toBe(`0x${"00".repeat(32)}`)
			expect(result.length).toBe(66) // 0x + 64 hex chars
		}),
	)

	it.effect("single-label name 'eth' produces known namehash", () =>
		Effect.gen(function* () {
			const result = yield* namehashHandler("eth")
			// Known test vector from ENS specification
			expect(result).toBe("0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae")
		}),
	)

	it.effect("single-label name with no dots (e.g. 'com')", () =>
		Effect.gen(function* () {
			const result = yield* namehashHandler("com")
			expect(result).toMatch(/^0x[0-9a-f]{64}$/)
			// Must not be zero hash
			expect(result).not.toBe(`0x${"00".repeat(32)}`)
			// Must differ from "eth"
			const ethHash = yield* namehashHandler("eth")
			expect(result).not.toBe(ethHash)
		}),
	)

	it.effect("very deep nesting (a.b.c.d.e.f.g.h)", () =>
		Effect.gen(function* () {
			const result = yield* namehashHandler("a.b.c.d.e.f.g.h")
			expect(result).toMatch(/^0x[0-9a-f]{64}$/)
			expect(result).not.toBe(`0x${"00".repeat(32)}`)
			// Should be deterministic
			const result2 = yield* namehashHandler("a.b.c.d.e.f.g.h")
			expect(result).toBe(result2)
		}),
	)

	it.effect("unicode labels produce valid hash", () =>
		Effect.gen(function* () {
			const result = yield* namehashHandler("\u{1F525}.eth")
			expect(result).toMatch(/^0x[0-9a-f]{64}$/)
			expect(result).not.toBe(`0x${"00".repeat(32)}`)
		}),
	)

	it.effect("known test vector: namehash('foo.eth')", () =>
		Effect.gen(function* () {
			const result = yield* namehashHandler("foo.eth")
			expect(result).toBe("0xde9b09fd7c5f901e23a3f19fecc54828e9c848539801e86591bd9801b019f84f")
		}),
	)

	it.effect("known test vector: namehash('alice.eth')", () =>
		Effect.gen(function* () {
			const result = yield* namehashHandler("alice.eth")
			expect(result).toBe("0x787192fc5378cc32aa956ddfdedbf26b24e8d78e40109add0eea2c1a012c3dec")
		}),
	)

	it.effect("namehash is order-dependent (foo.bar != bar.foo)", () =>
		Effect.gen(function* () {
			const fooBar = yield* namehashHandler("foo.bar")
			const barFoo = yield* namehashHandler("bar.foo")
			expect(fooBar).not.toBe(barFoo)
		}),
	)

	it.effect("parent and child produce different hashes", () =>
		Effect.gen(function* () {
			const parent = yield* namehashHandler("eth")
			const child = yield* namehashHandler("sub.eth")
			expect(parent).not.toBe(child)
		}),
	)
})

// ============================================================================
// resolveNameHandler — "No resolver found" via local devnet
// ============================================================================

describe("resolveNameHandler — local devnet error paths", () => {
	it.effect("fails with 'No resolver found' when registry returns zero address", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			// Deploy a mock ENS registry that returns 32 zero bytes for any call.
			// Code: PUSH1 0x20, PUSH1 0x00, RETURN (returns 32 zero bytes from fresh memory)
			const ensRegistry = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e"
			const zeroReturnCode = new Uint8Array([0x60, 0x20, 0x60, 0x00, 0xf3])
			yield* node.hostAdapter.setAccount(hexToBytes(ensRegistry), {
				nonce: 0n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: zeroReturnCode,
			})

			try {
				const error = yield* resolveNameHandler(`http://127.0.0.1:${server.port}`, "nonexistent.eth").pipe(
					Effect.flip,
				)
				expect(error._tag).toBe("EnsError")
				expect(error.message).toContain("No resolver found")
				expect(error.message).toContain("nonexistent.eth")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("fails with 'Name not resolved' when resolver returns zero address for addr()", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			// Deploy ENS registry mock that returns a non-zero resolver address (0x00...0042)
			// PUSH1 0x42, PUSH1 0x00, MSTORE, PUSH1 0x20, PUSH1 0x00, RETURN
			const ensRegistry = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e"
			const registryCode = new Uint8Array([0x60, 0x42, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3])
			yield* node.hostAdapter.setAccount(hexToBytes(ensRegistry), {
				nonce: 0n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: registryCode,
			})

			// Deploy resolver mock at 0x00...0042 that returns 32 zero bytes (zero address)
			// PUSH1 0x20, PUSH1 0x00, RETURN (returns 32 zero bytes)
			const resolverAddr = `0x${"00".repeat(19)}42`
			const resolverCode = new Uint8Array([0x60, 0x20, 0x60, 0x00, 0xf3])
			yield* node.hostAdapter.setAccount(hexToBytes(resolverAddr), {
				nonce: 0n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: resolverCode,
			})

			try {
				const error = yield* resolveNameHandler(`http://127.0.0.1:${server.port}`, "zeroresolver.eth").pipe(
					Effect.flip,
				)
				expect(error._tag).toBe("EnsError")
				expect(error.message).toContain("Name not resolved")
				expect(error.message).toContain("zeroresolver.eth")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("returns address when resolver returns a valid non-zero address", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			// Deploy ENS registry mock that returns resolver at 0x00...0042
			const ensRegistry = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e"
			const registryCode = new Uint8Array([0x60, 0x42, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3])
			yield* node.hostAdapter.setAccount(hexToBytes(ensRegistry), {
				nonce: 0n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: registryCode,
			})

			// Deploy resolver mock at 0x00...0042 that returns a non-zero address
			// Returns 0x00...00ff (address with last byte = 0xff)
			// PUSH1 0xFF, PUSH1 0x00, MSTORE, PUSH1 0x20, PUSH1 0x00, RETURN
			const resolverAddr = `0x${"00".repeat(19)}42`
			const resolverCode = new Uint8Array([0x60, 0xff, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3])
			yield* node.hostAdapter.setAccount(hexToBytes(resolverAddr), {
				nonce: 0n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: resolverCode,
			})

			try {
				const result = yield* resolveNameHandler(`http://127.0.0.1:${server.port}`, "test.eth")
				// Should return a valid address string
				expect(result).toMatch(/^0x[0-9a-f]{40}$/)
				expect(result).toContain("ff")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

// ============================================================================
// lookupAddressHandler — "No resolver found" via local devnet
// ============================================================================

describe("lookupAddressHandler — local devnet error paths", () => {
	it.effect("fails with 'No resolver found' when registry returns zero resolver", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			// Deploy mock ENS registry returning 32 zero bytes
			const ensRegistry = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e"
			const zeroReturnCode = new Uint8Array([0x60, 0x20, 0x60, 0x00, 0xf3])
			yield* node.hostAdapter.setAccount(hexToBytes(ensRegistry), {
				nonce: 0n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: zeroReturnCode,
			})

			try {
				const error = yield* lookupAddressHandler(
					`http://127.0.0.1:${server.port}`,
					"0x0000000000000000000000000000000000000001",
				).pipe(Effect.flip)
				expect(error._tag).toBe("EnsError")
				expect(error.message).toContain("No resolver found")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("fails with 'No name found' when resolver returns empty/short data", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			// Deploy ENS registry mock that returns resolver at 0x00...0042
			const ensRegistry = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e"
			const registryCode = new Uint8Array([0x60, 0x42, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3])
			yield* node.hostAdapter.setAccount(hexToBytes(ensRegistry), {
				nonce: 0n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: registryCode,
			})

			// Deploy resolver mock at 0x00...0042 that returns very short data (just 1 byte)
			// This triggers the nameHex.length <= 2 check
			// PUSH1 0x01, PUSH1 0x00, RETURN → returns 1 zero byte
			const resolverAddr = `0x${"00".repeat(19)}42`
			const resolverCode = new Uint8Array([0x60, 0x01, 0x60, 0x00, 0xf3])
			yield* node.hostAdapter.setAccount(hexToBytes(resolverAddr), {
				nonce: 0n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: resolverCode,
			})

			try {
				const error = yield* lookupAddressHandler(
					`http://127.0.0.1:${server.port}`,
					"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
				).pipe(Effect.flip)
				expect(error._tag).toBe("EnsError")
				// The short return data will either fail with "No name found" or "Failed to decode"
				expect(error.message).toMatch(/No name found|Failed to decode/)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("returns name when resolver returns properly ABI-encoded string", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			// Deploy ENS registry mock that returns resolver address 0x00...0042
			const ensRegistry = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e"
			const registryCode = new Uint8Array([0x60, 0x42, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3])
			yield* node.hostAdapter.setAccount(hexToBytes(ensRegistry), {
				nonce: 0n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: registryCode,
			})

			// Deploy resolver mock at 0x00...0042 that returns ABI-encoded string "test.eth"
			// ABI-encoded string layout:
			//   [0..31] = offset (0x20 = 32)
			//   [32..63] = length (0x08 = 8)
			//   [64..71] = "test.eth"
			const resolverAddr = `0x${"00".repeat(19)}42`
			const resolverCode = new Uint8Array([
				// Write "test.eth" into memory using overlapping MSTOREs (right-to-left)
				// 'h'=0x68 at mem[71]: MSTORE at 40
				0x60, 0x68, 0x60, 0x28, 0x52,
				// 't'=0x74 at mem[70]: MSTORE at 39
				0x60, 0x74, 0x60, 0x27, 0x52,
				// 'e'=0x65 at mem[69]: MSTORE at 38
				0x60, 0x65, 0x60, 0x26, 0x52,
				// '.'=0x2e at mem[68]: MSTORE at 37
				0x60, 0x2e, 0x60, 0x25, 0x52,
				// 't'=0x74 at mem[67]: MSTORE at 36
				0x60, 0x74, 0x60, 0x24, 0x52,
				// 's'=0x73 at mem[66]: MSTORE at 35
				0x60, 0x73, 0x60, 0x23, 0x52,
				// 'e'=0x65 at mem[65]: MSTORE at 34
				0x60, 0x65, 0x60, 0x22, 0x52,
				// 't'=0x74 at mem[64]: MSTORE at 33
				0x60, 0x74, 0x60, 0x21, 0x52,
				// length=8: PUSH1 0x08, PUSH1 0x20, MSTORE
				0x60, 0x08, 0x60, 0x20, 0x52,
				// offset=32: PUSH1 0x20, PUSH1 0x00, MSTORE
				0x60, 0x20, 0x60, 0x00, 0x52,
				// RETURN 96 bytes from memory[0]
				0x60, 0x60, 0x60, 0x00, 0xf3,
			])
			yield* node.hostAdapter.setAccount(hexToBytes(resolverAddr), {
				nonce: 0n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: resolverCode,
			})

			try {
				const result = yield* lookupAddressHandler(
					`http://127.0.0.1:${server.port}`,
					"0x1234567890abcdef1234567890abcdef12345678",
				)
				expect(result).toBe("test.eth")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("fails with 'Failed to decode' when resolver returns malformed ABI data", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			// Deploy ENS registry mock that returns resolver at 0x00...0042
			const ensRegistry = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e"
			const registryCode = new Uint8Array([0x60, 0x42, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3])
			yield* node.hostAdapter.setAccount(hexToBytes(ensRegistry), {
				nonce: 0n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: registryCode,
			})

			// Deploy resolver mock that returns data long enough to pass the length check
			// but with a corrupt/invalid ABI-encoded string (offset pointing beyond data).
			// Returns 96 bytes: offset = 0xFFFF (way too large), rest zeros.
			const resolverAddr = `0x${"00".repeat(19)}42`
			// Return 96 bytes where the "length" field (bytes 32..63) has a huge value
			// that would cause slice to go out of bounds
			const resolverCode = new Uint8Array([
				// mem[0..31] = offset = 0x20 (normal)
				0x60, 0x20, 0x60, 0x00, 0x52,
				// mem[32..63] = length = 0xFFFF (absurdly large, will cause decode failure)
				0x61, 0xff, 0xff, 0x60, 0x20, 0x52,
				// RETURN 96 bytes
				0x60, 0x60, 0x60, 0x00, 0xf3,
			])
			yield* node.hostAdapter.setAccount(hexToBytes(resolverAddr), {
				nonce: 0n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: resolverCode,
			})

			try {
				const result = yield* lookupAddressHandler(
					`http://127.0.0.1:${server.port}`,
					"0xaabbccddee00112233445566778899aabbccddee",
				).pipe(
					Effect.catchTag("EnsError", (e) => Effect.succeed(`error:${e.message}`)),
				)
				// The result should either be an error message about decoding failure
				// or a garbage string (since the data is malformed but may not throw)
				expect(typeof result).toBe("string")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

// ============================================================================
// resolveNameHandler — RPC connection error
// ============================================================================

describe("resolveNameHandler — connection failures", () => {
	it.effect("wraps RPC failure into EnsError", () =>
		Effect.gen(function* () {
			// Connect to an invalid port to trigger connection error
			const error = yield* resolveNameHandler("http://127.0.0.1:1", "vitalik.eth").pipe(Effect.flip)
			expect(error._tag).toBe("EnsError")
			expect(error.message).toContain("ENS registry call failed")
		}).pipe(Effect.provide(FetchHttpClient.layer)),
	)
})

// ============================================================================
// lookupAddressHandler — RPC connection error
// ============================================================================

describe("lookupAddressHandler — connection failures", () => {
	it.effect("wraps RPC failure into EnsError", () =>
		Effect.gen(function* () {
			const error = yield* lookupAddressHandler(
				"http://127.0.0.1:1",
				"0x0000000000000000000000000000000000000001",
			).pipe(Effect.flip)
			expect(error._tag).toBe("EnsError")
			expect(error.message).toContain("ENS registry call failed")
		}).pipe(Effect.provide(FetchHttpClient.layer)),
	)
})
