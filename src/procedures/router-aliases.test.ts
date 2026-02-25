/**
 * T3.10 — Compatibility aliases: hardhat_* and ganache_* prefixes
 * map to existing anvil_* method implementations.
 */

import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { methodRouter } from "./router.js"

// ---------------------------------------------------------------------------
// All anvil_* methods and their valid params (must match router.test.ts)
// ---------------------------------------------------------------------------

const anvilMethodParams: Record<string, readonly unknown[]> = {
	anvil_mine: [],
	anvil_setBalance: [`0x${"00".repeat(20)}`, "0x1"],
	anvil_setCode: [`0x${"00".repeat(20)}`, "0xdeadbeef"],
	anvil_setNonce: [`0x${"00".repeat(20)}`, "0x1"],
	anvil_setStorageAt: [`0x${"00".repeat(20)}`, `0x${"00".repeat(32)}`, "0x1"],
	anvil_impersonateAccount: [`0x${"ab".repeat(20)}`],
	anvil_stopImpersonatingAccount: [`0x${"ab".repeat(20)}`],
	anvil_autoImpersonateAccount: [true],
	anvil_dumpState: [],
	anvil_loadState: [
		{
			[`0x${"00".repeat(19)}bb`]: {
				nonce: "0x0",
				balance: "0x0",
				code: "0x",
				storage: {},
			},
		},
	],
	anvil_reset: [],
	anvil_setMinGasPrice: ["0x1"],
	anvil_setNextBlockBaseFeePerGas: ["0x1"],
	anvil_setCoinbase: [`0x${"00".repeat(20)}`],
	anvil_setBlockGasLimit: ["0x1c9c380"],
	anvil_setBlockTimestampInterval: [12],
	anvil_removeBlockTimestampInterval: [],
	anvil_setChainId: ["0x1"],
	anvil_setRpcUrl: ["http://localhost:8545"],
	anvil_dropTransaction: [`0x${"ab".repeat(32)}`],
	anvil_dropAllTransactions: [],
	anvil_enableTraces: [],
	anvil_nodeInfo: [],
}

// ---------------------------------------------------------------------------
// hardhat_* aliases — all 23 anvil_* methods
// ---------------------------------------------------------------------------

describe("router — hardhat_* aliases", () => {
	for (const [anvilMethod, params] of Object.entries(anvilMethodParams)) {
		const suffix = anvilMethod.slice(6) // Remove "anvil_"
		const hardhatMethod = `hardhat_${suffix}`

		it.effect(`${hardhatMethod} routes to same procedure as ${anvilMethod}`, () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService

				const anvilResult = yield* methodRouter(node)(anvilMethod, params)
				const hardhatResult = yield* methodRouter(node)(hardhatMethod, params)

				expect(hardhatResult).toEqual(anvilResult)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)
	}
})

// ---------------------------------------------------------------------------
// ganache_* aliases — all 23 anvil_* methods
// ---------------------------------------------------------------------------

describe("router — ganache_* aliases", () => {
	for (const [anvilMethod, params] of Object.entries(anvilMethodParams)) {
		const suffix = anvilMethod.slice(6) // Remove "anvil_"
		const ganacheMethod = `ganache_${suffix}`

		it.effect(`${ganacheMethod} routes to same procedure as ${anvilMethod}`, () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService

				const anvilResult = yield* methodRouter(node)(anvilMethod, params)
				const ganacheResult = yield* methodRouter(node)(ganacheMethod, params)

				expect(ganacheResult).toEqual(anvilResult)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)
	}
})

// ---------------------------------------------------------------------------
// Behavioral equivalence — verify side effects are the same
// ---------------------------------------------------------------------------

describe("router — alias behavioral equivalence", () => {
	it.effect("hardhat_setBalance modifies balance like anvil_setBalance", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const addr = `0x${"11".repeat(20)}`

			// Set balance via hardhat_ alias
			yield* methodRouter(node)("hardhat_setBalance", [addr, "0xDE0B6B3A7640000"])

			// Read back via eth_getBalance
			const balance = yield* methodRouter(node)("eth_getBalance", [addr])
			expect(balance).toBe("0xde0b6b3a7640000")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("ganache_setBalance modifies balance like anvil_setBalance", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const addr = `0x${"22".repeat(20)}`

			// Set balance via ganache_ alias
			yield* methodRouter(node)("ganache_setBalance", [addr, "0xDE0B6B3A7640000"])

			// Read back via eth_getBalance
			const balance = yield* methodRouter(node)("eth_getBalance", [addr])
			expect(balance).toBe("0xde0b6b3a7640000")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("hardhat_setCode modifies code like anvil_setCode", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const addr = `0x${"33".repeat(20)}`
			const code = "0xdeadbeef"

			// Set code via hardhat_ alias
			yield* methodRouter(node)("hardhat_setCode", [addr, code])

			// Read back via eth_getCode
			const result = yield* methodRouter(node)("eth_getCode", [addr])
			expect(result).toBe(code)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("ganache_impersonateAccount works like anvil_impersonateAccount", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const addr = `0x${"44".repeat(20)}`

			// Impersonate via ganache_ alias
			const result = yield* methodRouter(node)("ganache_impersonateAccount", [addr])
			expect(result).toBeNull()

			// Stop via ganache_ alias
			const stopResult = yield* methodRouter(node)("ganache_stopImpersonatingAccount", [addr])
			expect(stopResult).toBeNull()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// Non-anvil methods do NOT get aliased
// ---------------------------------------------------------------------------

describe("router — non-anvil methods are not aliased", () => {
	it.effect("hardhat_chainId fails (no anvil_chainId exists, only eth_chainId)", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const error = yield* methodRouter(node)("hardhat_chainId", []).pipe(Effect.flip)
			expect(error._tag).toBe("MethodNotFoundError")
			// Error should report the original method name, not the resolved one
			if (error._tag === "MethodNotFoundError") {
				expect(error.method).toBe("hardhat_chainId")
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("ganache_getBalance fails (no anvil_getBalance exists)", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const error = yield* methodRouter(node)("ganache_getBalance", []).pipe(Effect.flip)
			expect(error._tag).toBe("MethodNotFoundError")
			if (error._tag === "MethodNotFoundError") {
				expect(error.method).toBe("ganache_getBalance")
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("hardhat_nonexistent fails with MethodNotFoundError", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const error = yield* methodRouter(node)("hardhat_nonexistent", []).pipe(Effect.flip)
			expect(error._tag).toBe("MethodNotFoundError")
			if (error._tag === "MethodNotFoundError") {
				expect(error.method).toBe("hardhat_nonexistent")
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// Original anvil_* methods still work
// ---------------------------------------------------------------------------

describe("router — original anvil_* methods unaffected", () => {
	it.effect("anvil_setBalance still works directly", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* methodRouter(node)("anvil_setBalance", [`0x${"00".repeat(20)}`, "0x1"])
			expect(result).toBeNull()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("anvil_mine still works directly", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* methodRouter(node)("anvil_mine", [])
			expect(result).toBeNull()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("anvil_nodeInfo still works directly", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* methodRouter(node)("anvil_nodeInfo", [])
			expect(typeof result).toBe("object")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
