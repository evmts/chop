import { FetchHttpClient } from "@effect/platform"
import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { hexToBytes } from "../../evm/conversions.js"
import { TevmNode, TevmNodeService } from "../../node/index.js"
import { startRpcServer } from "../../rpc/server.js"
import { runCli } from "../test-helpers.js"
import { lookupAddressHandler, namehashHandler, resolveNameHandler } from "./ens.js"

// ============================================================================
// Handler tests — namehashHandler (pure computation)
// ============================================================================

describe("namehashHandler", () => {
	it.effect("returns zero hash for empty string", () =>
		Effect.gen(function* () {
			const result = yield* namehashHandler("")
			expect(result).toBe(`0x${"00".repeat(32)}`)
		}),
	)

	it.effect("computes correct namehash for 'eth'", () =>
		Effect.gen(function* () {
			const result = yield* namehashHandler("eth")
			// Known namehash for "eth"
			expect(result).toBe("0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae")
		}),
	)

	it.effect("computes correct namehash for 'foo.eth'", () =>
		Effect.gen(function* () {
			const result = yield* namehashHandler("foo.eth")
			// Known namehash for "foo.eth"
			expect(result).toBe("0xde9b09fd7c5f901e23a3f19fecc54828e9c848539801e86591bd9801b019f84f")
		}),
	)

	it.effect("computes correct namehash for 'alice.eth'", () =>
		Effect.gen(function* () {
			const result = yield* namehashHandler("alice.eth")
			// Known namehash for "alice.eth"
			expect(result).toBe("0x787192fc5378cc32aa956ddfdedbf26b24e8d78e40109add0eea2c1a012c3dec")
		}),
	)

	it.effect("computes correct namehash for multi-level name", () =>
		Effect.gen(function* () {
			const result = yield* namehashHandler("sub.foo.eth")
			// Should produce a deterministic hash
			expect(result).toMatch(/^0x[0-9a-f]{64}$/)
		}),
	)
})

// ============================================================================
// Handler tests — resolveNameHandler (error paths)
// ============================================================================

describe("resolveNameHandler", () => {
	it.effect("fails with EnsError on invalid RPC URL", () =>
		Effect.gen(function* () {
			const error = yield* resolveNameHandler("http://127.0.0.1:1", "vitalik.eth").pipe(Effect.flip)
			expect(error._tag).toBe("EnsError")
		}).pipe(Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("fails with 'No resolver found' when registry returns zero address", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			// Deploy a contract at ENS registry that returns 32 zero bytes
			// PUSH1 0x20, PUSH1 0x00, RETURN → memory is zero-initialized
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
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

// ============================================================================
// Handler tests — lookupAddressHandler
// ============================================================================

describe("lookupAddressHandler", () => {
	it.effect("fails with EnsError on invalid RPC URL", () =>
		Effect.gen(function* () {
			const error = yield* lookupAddressHandler(
				"http://127.0.0.1:1",
				"0x0000000000000000000000000000000000000000",
			).pipe(Effect.flip)
			expect(error._tag).toBe("EnsError")
		}).pipe(Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("returns name when resolver returns ABI-encoded string", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			// Deploy ENS registry mock that returns resolver address 0x00...0042
			// PUSH1 0x42, PUSH1 0x00, MSTORE, PUSH1 0x20, PUSH1 0x00, RETURN
			const ensRegistry = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e"
			const registryCode = new Uint8Array([0x60, 0x42, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3])
			yield* node.hostAdapter.setAccount(hexToBytes(ensRegistry), {
				nonce: 0n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: registryCode,
			})

			// Deploy resolver mock at 0x00...0042
			// Returns ABI-encoded string "test.eth" using overlapping MSTOREs.
			// MSTORE stores 32 bytes; PUSH1 value is right-aligned (byte at pos offset+31).
			// Write chars RIGHT-TO-LEFT so later MSTOREs don't clobber earlier chars.
			const resolverAddr = `0x${"00".repeat(19)}42`
			const resolverCode = new Uint8Array([
				// 'h'=0x68 at mem[71]: MSTORE at 40 → writes [40..71], pos 71=0x68
				0x60, 0x68, 0x60, 0x28, 0x52,
				// 't'=0x74 at mem[70]: MSTORE at 39 → writes [39..70]
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
				// length=8: PUSH1 0x08, PUSH1 0x20, MSTORE → mem[32..63], pos 63=0x08
				0x60, 0x08, 0x60, 0x20, 0x52,
				// offset=32: PUSH1 0x20, PUSH1 0x00, MSTORE → mem[0..31], pos 31=0x20
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
})

// ============================================================================
// CLI E2E tests — namehash (pure, no RPC needed)
// ============================================================================

describe("CLI E2E — namehash", () => {
	it("namehash of empty string returns zero hash", () => {
		const result = runCli("namehash ''")
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe(`0x${"00".repeat(32)}`)
	})

	it("namehash of 'eth' returns known hash", () => {
		const result = runCli("namehash eth")
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae")
	})

	it("namehash --json outputs structured JSON", () => {
		const result = runCli("namehash eth --json")
		expect(result.exitCode).toBe(0)
		const json = JSON.parse(result.stdout.trim())
		expect(json).toHaveProperty("name", "eth")
		expect(json).toHaveProperty("hash")
		expect(json.hash).toBe("0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae")
	})

	it("namehash of 'foo.eth' returns known hash", () => {
		const result = runCli("namehash foo.eth")
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("0xde9b09fd7c5f901e23a3f19fecc54828e9c848539801e86591bd9801b019f84f")
	})
})

// ============================================================================
// CLI E2E tests — resolve-name / lookup-address error handling
// ============================================================================

describe("CLI E2E — ENS RPC commands error handling", () => {
	it("resolve-name with invalid URL exits non-zero", () => {
		const result = runCli("resolve-name vitalik.eth -r http://127.0.0.1:1")
		expect(result.exitCode).not.toBe(0)
	})

	it("lookup-address with invalid URL exits non-zero", () => {
		const result = runCli("lookup-address 0x0000000000000000000000000000000000000000 -r http://127.0.0.1:1")
		expect(result.exitCode).not.toBe(0)
	})
})
