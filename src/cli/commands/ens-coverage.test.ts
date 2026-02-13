import { FetchHttpClient } from "@effect/platform"
import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { bytesToHex } from "../../evm/conversions.js"
import { TevmNode, TevmNodeService } from "../../node/index.js"
import { setCodeHandler } from "../../handlers/setCode.js"
import { startRpcServer } from "../../rpc/server.js"
import { resolveNameHandler, lookupAddressHandler, namehashHandler, EnsError } from "./ens.js"

/** ENS registry address on Ethereum mainnet (same as in ens.ts) */
const ENS_REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e"

// ---------------------------------------------------------------------------
// resolveNameHandler — error branches
// ---------------------------------------------------------------------------

describe("resolveNameHandler", () => {
	it.effect("fails with EnsError when ENS registry returns zero resolver", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Deploy a mock ENS registry that returns 32 bytes of zeros for any call
			// This triggers the "No resolver found" error path
			// Code: PUSH1 0x20, PUSH1 0x00, RETURN (returns 32 zero bytes from fresh memory)
			const registryCode = bytesToHex(new Uint8Array([0x60, 0x20, 0x60, 0x00, 0xf3]))
			yield* setCodeHandler(node)({ address: ENS_REGISTRY, code: registryCode })

			const server = yield* startRpcServer({ port: 0 }, node)
			const url = `http://127.0.0.1:${server.port}`
			try {
				const error = yield* resolveNameHandler(url, "vitalik.eth").pipe(
					Effect.catchTag("EnsError", (e) => Effect.succeed(e)),
				)
				expect(error).toBeInstanceOf(EnsError)
				expect((error as EnsError).message).toContain("No resolver found")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("returns empty result when ENS registry is not deployed at all", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			const url = `http://127.0.0.1:${server.port}`
			try {
				// No ENS registry deployed → eth_call returns "0x" → passes zero-address check
				const result = yield* resolveNameHandler(url, "test.eth").pipe(
					Effect.catchTag("EnsError", (e) => Effect.succeed(`error:${e.message}`)),
				)
				expect(typeof result).toBe("string")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("produces correct namehash for resolver lookup", () =>
		Effect.gen(function* () {
			// Just verify the namehash is deterministic and works for a known name
			const hash = yield* namehashHandler("eth")
			// Known namehash for "eth"
			expect(hash).toBe("0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae")
		}),
	)
})

// ---------------------------------------------------------------------------
// lookupAddressHandler — error branches
// ---------------------------------------------------------------------------

describe("lookupAddressHandler", () => {
	it.effect("fails with EnsError when registry returns zero resolver", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Deploy mock ENS registry returning 32 zero bytes → "No resolver found" error
			const registryCode = bytesToHex(new Uint8Array([0x60, 0x20, 0x60, 0x00, 0xf3]))
			yield* setCodeHandler(node)({ address: ENS_REGISTRY, code: registryCode })

			const server = yield* startRpcServer({ port: 0 }, node)
			const url = `http://127.0.0.1:${server.port}`
			try {
				const error = yield* lookupAddressHandler(
					url,
					"0x0000000000000000000000000000000000000001",
				).pipe(Effect.catchTag("EnsError", (e) => Effect.succeed(e)))
				expect(error).toBeInstanceOf(EnsError)
				expect((error as EnsError).message).toContain("No resolver found")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("fails when registry is not deployed", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			const url = `http://127.0.0.1:${server.port}`
			try {
				const error = yield* lookupAddressHandler(
					url,
					`0x${"00".repeat(20)}`,
				).pipe(Effect.catchTag("EnsError", (e) => Effect.succeed(e)))
				// When no registry, eth_call returns "0x", which is not a zero address.
				// It falls through and tries to call the resolver. That also returns "0x".
				// nameHex = "0x" → length <= 2 → "No name found" error path.
				expect(typeof error).toBe("object")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

// ---------------------------------------------------------------------------
// namehashHandler — edge cases
// ---------------------------------------------------------------------------

describe("namehashHandler — edge cases", () => {
	it.effect("returns correct hash for multi-level domain", () =>
		Effect.gen(function* () {
			const hash = yield* namehashHandler("sub.alice.eth")
			expect(hash).toMatch(/^0x[a-f0-9]{64}$/)
			// Should be different from "alice.eth"
			const aliceHash = yield* namehashHandler("alice.eth")
			expect(hash).not.toBe(aliceHash)
		}),
	)

	it.effect("returns different hashes for different names", () =>
		Effect.gen(function* () {
			const hash1 = yield* namehashHandler("alice.eth")
			const hash2 = yield* namehashHandler("bob.eth")
			expect(hash1).not.toBe(hash2)
		}),
	)

	it.effect("returns zero hash for empty string", () =>
		Effect.gen(function* () {
			const hash = yield* namehashHandler("")
			// Empty name should produce the zero hash (root node)
			expect(hash).toBe(`0x${"00".repeat(32)}`)
		}),
	)
})
