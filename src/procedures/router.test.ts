import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { methodRouter } from "./router.js"

// Valid params for each method — needed because handlers will crash on undefined params
const validParams: Record<string, readonly unknown[]> = {
	eth_chainId: [],
	eth_blockNumber: [],
	eth_call: [{ data: "0x00" }],
	eth_getBalance: [`0x${"00".repeat(20)}`],
	eth_getCode: [`0x${"00".repeat(20)}`],
	eth_getStorageAt: [`0x${"00".repeat(20)}`, `0x${"00".repeat(32)}`],
	eth_getTransactionCount: [`0x${"00".repeat(20)}`],
}

describe("methodRouter", () => {
	// -----------------------------------------------------------------------
	// Known methods resolve
	// -----------------------------------------------------------------------

	for (const [method, params] of Object.entries(validParams)) {
		it.effect(`routes ${method} to a procedure`, () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const result = yield* methodRouter(node)(method, params)
				expect(typeof result).toBe("string")
				expect((result as string).startsWith("0x")).toBe(true)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)
	}

	// -----------------------------------------------------------------------
	// eth_accounts returns an array (not a hex string)
	// -----------------------------------------------------------------------

	it.effect("routes eth_accounts to a procedure returning an array", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* methodRouter(node)("eth_accounts", [])
			expect(Array.isArray(result)).toBe(true)
			const arr = result as string[]
			expect(arr.length).toBeGreaterThan(0)
			for (const addr of arr) {
				expect(addr).toMatch(/^0x[0-9a-fA-F]{40}$/)
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	// -----------------------------------------------------------------------
	// Mining methods
	// -----------------------------------------------------------------------

	it.effect("routes anvil_mine to a procedure returning null", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* methodRouter(node)("anvil_mine", [])
			expect(result).toBeNull()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("routes evm_mine to a procedure returning '0x0'", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* methodRouter(node)("evm_mine", [])
			expect(result).toBe("0x0")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("routes evm_setAutomine", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* methodRouter(node)("evm_setAutomine", [true])
			expect(result).toBe("true")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("routes evm_setIntervalMining", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* methodRouter(node)("evm_setIntervalMining", [1000])
			expect(result).toBe("true")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	// -----------------------------------------------------------------------
	// Anvil account management methods
	// -----------------------------------------------------------------------

	it.effect("routes anvil_setBalance → returns null", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* methodRouter(node)("anvil_setBalance", [`0x${"00".repeat(20)}`, "0x1"])
			expect(result).toBeNull()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("routes anvil_setCode → returns null", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* methodRouter(node)("anvil_setCode", [`0x${"00".repeat(20)}`, "0xdeadbeef"])
			expect(result).toBeNull()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("routes anvil_setNonce → returns null", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* methodRouter(node)("anvil_setNonce", [`0x${"00".repeat(20)}`, "0x1"])
			expect(result).toBeNull()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("routes anvil_setStorageAt → returns true", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* methodRouter(node)("anvil_setStorageAt", [
				`0x${"00".repeat(20)}`,
				`0x${"00".repeat(32)}`,
				"0x1",
			])
			expect(result).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("routes anvil_impersonateAccount → returns null", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* methodRouter(node)("anvil_impersonateAccount", [`0x${"ab".repeat(20)}`])
			expect(result).toBeNull()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("routes anvil_stopImpersonatingAccount → returns null", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* methodRouter(node)("anvil_stopImpersonatingAccount", [`0x${"ab".repeat(20)}`])
			expect(result).toBeNull()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("routes anvil_autoImpersonateAccount → returns null", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* methodRouter(node)("anvil_autoImpersonateAccount", [true])
			expect(result).toBeNull()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	// -----------------------------------------------------------------------
	// Unknown method fails
	// -----------------------------------------------------------------------

	it.effect("fails with MethodNotFoundError for unknown method", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const error = yield* methodRouter(node)("eth_foo", []).pipe(Effect.flip)
			expect(error._tag).toBe("MethodNotFoundError")
			if (error._tag === "MethodNotFoundError") {
				expect(error.method).toBe("eth_foo")
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("fails with MethodNotFoundError for empty method", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const error = yield* methodRouter(node)("", []).pipe(Effect.flip)
			expect(error._tag).toBe("MethodNotFoundError")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
