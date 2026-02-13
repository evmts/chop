import { FetchHttpClient } from "@effect/platform"
import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
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
})

// ============================================================================
// Handler tests — lookupAddressHandler (error paths)
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
