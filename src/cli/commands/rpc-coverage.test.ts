import { FetchHttpClient } from "@effect/platform"
import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { hexToBytes } from "../../evm/conversions.js"
import { TevmNode, TevmNodeService } from "../../node/index.js"
import { startRpcServer } from "../../rpc/server.js"
import {
	balanceHandler,
	blockNumberHandler,
	callHandler,
	chainIdHandler,
	codeHandler,
	nonceHandler,
	storageHandler,
} from "./rpc.js"

// ============================================================================
// hexToDecimal internal tests (via handler return values)
// ============================================================================

describe("RPC handlers — hexToDecimal edge cases", () => {
	it.effect("chainIdHandler returns decimal string from hex response", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				// Chain ID is 31337 (0x7a69) — hexToDecimal should convert
				const result = yield* chainIdHandler(`http://127.0.0.1:${server.port}`)
				expect(result).toBe("31337")
				// Verify it's a pure decimal string (no 0x prefix)
				expect(result.startsWith("0x")).toBe(false)
				expect(Number.isNaN(Number(result))).toBe(false)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("blockNumberHandler returns '0' for genesis", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const result = yield* blockNumberHandler(`http://127.0.0.1:${server.port}`)
				expect(result).toBe("0")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

// ============================================================================
// balanceHandler — non-zero balance
// ============================================================================

describe("RPC handlers — balance with funded account", () => {
	it.effect("returns large balance as decimal string", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			// Use a funded account from the node
			const sender = node.accounts[0]!
			try {
				const result = yield* balanceHandler(`http://127.0.0.1:${server.port}`, sender.address)
				// Should be the DEFAULT_BALANCE as decimal
				expect(BigInt(result)).toBeGreaterThan(0n)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

// ============================================================================
// nonceHandler — non-zero nonce
// ============================================================================

describe("RPC handlers — nonce with set account", () => {
	it.effect("returns correct nonce for account with nonce > 0", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			const testAddr = `0x${"ee".repeat(20)}`
			yield* node.hostAdapter.setAccount(hexToBytes(testAddr), {
				nonce: 42n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: new Uint8Array(0),
			})

			try {
				const result = yield* nonceHandler(`http://127.0.0.1:${server.port}`, testAddr)
				expect(result).toBe("42")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

// ============================================================================
// codeHandler — contract with bytecode
// ============================================================================

describe("RPC handlers — code with deployed contract", () => {
	it.effect("returns hex code for contract", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			const contractAddr = `0x${"dd".repeat(20)}`
			const contractCode = new Uint8Array([0x60, 0x80, 0x60, 0x40, 0x52])
			yield* node.hostAdapter.setAccount(hexToBytes(contractAddr), {
				nonce: 0n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: contractCode,
			})

			try {
				const result = yield* codeHandler(`http://127.0.0.1:${server.port}`, contractAddr)
				expect(result).toContain("608060405")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

// ============================================================================
// storageHandler — non-zero storage
// ============================================================================

describe("RPC handlers — storage with set value", () => {
	it.effect("returns correct storage value", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			const testAddr = `0x${"cc".repeat(20)}`
			const slot = `0x${"00".repeat(31)}01`
			yield* node.hostAdapter.setAccount(hexToBytes(testAddr), {
				nonce: 0n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: new Uint8Array(0),
			})
			yield* node.hostAdapter.setStorage(hexToBytes(testAddr), hexToBytes(slot), 42n)

			try {
				const result = yield* storageHandler(`http://127.0.0.1:${server.port}`, testAddr, slot)
				expect(result).toContain("2a") // 42 = 0x2a
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

// ============================================================================
// callHandler — edge cases
// ============================================================================

describe("RPC handlers — callHandler edge cases", () => {
	it.effect("callHandler with invalid signature fails gracefully", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const result = yield* callHandler(
					`http://127.0.0.1:${server.port}`,
					`0x${"00".repeat(20)}`,
					"invalid!!!signature",
					[],
				).pipe(Effect.either)
				expect(result._tag).toBe("Left")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("callHandler with signature with wrong arg count fails", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const result = yield* callHandler(
					`http://127.0.0.1:${server.port}`,
					`0x${"00".repeat(20)}`,
					"transfer(address,uint256)",
					["0x1234"], // missing second arg
				).pipe(Effect.either)
				expect(result._tag).toBe("Left")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})
