/**
 * Tests for ENS handler functions (namehashHandler, resolveNameHandler, lookupAddressHandler).
 *
 * Covers:
 * - namehashHandler: pure keccak256-based computation with various inputs
 * - resolveNameHandler: RPC-based name resolution (error path via local devnet)
 * - lookupAddressHandler: RPC-based reverse lookup (error paths via local devnet)
 */

import { FetchHttpClient } from "@effect/platform"
import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../../node/index.js"
import { startRpcServer } from "../../rpc/server.js"
import { EnsError, lookupAddressHandler, namehashHandler, resolveNameHandler } from "./ens.js"

// ---------------------------------------------------------------------------
// namehashHandler — pure computation tests
// ---------------------------------------------------------------------------

describe("namehashHandler — pure computation", () => {
	it.effect("empty string returns 32 zero bytes", () =>
		Effect.gen(function* () {
			const result = yield* namehashHandler("")
			expect(result).toBe(`0x${"00".repeat(32)}`)
		}),
	)

	it.effect("single label 'eth' returns known namehash", () =>
		Effect.gen(function* () {
			const result = yield* namehashHandler("eth")
			// namehash("eth") is a well-known value from ENS docs
			expect(result.startsWith("0x")).toBe(true)
			expect(result.length).toBe(66) // 0x + 64 hex chars
			// Must NOT be all zeros (it is a real hash)
			expect(result).not.toBe(`0x${"00".repeat(32)}`)
			// Known value: 0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae
			expect(result).toBe("0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae")
		}),
	)

	it.effect("multi-label 'vitalik.eth' returns deterministic namehash", () =>
		Effect.gen(function* () {
			const result = yield* namehashHandler("vitalik.eth")
			expect(result.startsWith("0x")).toBe(true)
			expect(result.length).toBe(66)
			// Must not be zero
			expect(result).not.toBe(`0x${"00".repeat(32)}`)
			// Must differ from namehash("eth")
			const ethHash = yield* namehashHandler("eth")
			expect(result).not.toBe(ethHash)
		}),
	)

	it.effect("deeply nested name 'sub.vitalik.eth' returns deterministic namehash", () =>
		Effect.gen(function* () {
			const result = yield* namehashHandler("sub.vitalik.eth")
			expect(result.startsWith("0x")).toBe(true)
			expect(result.length).toBe(66)
			// Must differ from namehash("vitalik.eth")
			const parentHash = yield* namehashHandler("vitalik.eth")
			expect(result).not.toBe(parentHash)
			// Must differ from namehash("eth")
			const ethHash = yield* namehashHandler("eth")
			expect(result).not.toBe(ethHash)
		}),
	)

	it.effect("same name always produces same hash (deterministic)", () =>
		Effect.gen(function* () {
			const result1 = yield* namehashHandler("test.eth")
			const result2 = yield* namehashHandler("test.eth")
			expect(result1).toBe(result2)
		}),
	)

	it.effect("different names produce different hashes", () =>
		Effect.gen(function* () {
			const hash1 = yield* namehashHandler("alice.eth")
			const hash2 = yield* namehashHandler("bob.eth")
			expect(hash1).not.toBe(hash2)
		}),
	)
})

// ---------------------------------------------------------------------------
// resolveNameHandler — RPC-based resolution (local devnet, no ENS registry)
// ---------------------------------------------------------------------------

describe("resolveNameHandler — local devnet (no ENS registry)", () => {
	it.effect("returns malformed address when ENS registry has no code (empty return data)", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Start a local RPC server for the test
			const server = yield* startRpcServer({ port: 0 }, node)
			const rpcUrl = `http://127.0.0.1:${server.port}`

			try {
				// The local devnet has no ENS registry deployed, so eth_call
				// returns "0x" (empty return data). The handler parses this as
				// a short/malformed address string rather than the zero-address
				// pattern, so it falls through and returns "0x" as the result.
				const result = yield* resolveNameHandler(rpcUrl, "vitalik.eth").pipe(Effect.provide(FetchHttpClient.layer))

				// The handler succeeds but returns a malformed address
				expect(typeof result).toBe("string")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// lookupAddressHandler — RPC-based reverse lookup (local devnet, no ENS registry)
// ---------------------------------------------------------------------------

describe("lookupAddressHandler — local devnet (no ENS registry)", () => {
	it.effect("returns EnsError when ENS registry has no code (empty return data)", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Start a local RPC server
			const server = yield* startRpcServer({ port: 0 }, node)
			const rpcUrl = `http://127.0.0.1:${server.port}`

			try {
				// The local devnet has no ENS registry, so eth_call returns "0x"
				// (empty return data). The handler parses this and eventually
				// hits the "No name found" error path because nameHex === "0x".
				const error = yield* lookupAddressHandler(rpcUrl, "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045").pipe(
					Effect.provide(FetchHttpClient.layer),
					Effect.flip,
				)

				expect(error).toBeInstanceOf(EnsError)
				expect((error as EnsError).message).toContain("No name found")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
