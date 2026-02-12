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
				expect(result.startsWith("0x")).toBe(true)
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
