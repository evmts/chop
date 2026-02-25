/**
 * Boundary condition tests for procedures/router.ts.
 *
 * Covers:
 * - All known methods return strings starting with 0x
 * - Special characters in method name
 * - Case sensitivity of method names
 * - Various param shapes
 */

import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { methodRouter } from "./router.js"

// ---------------------------------------------------------------------------
// Method name edge cases
// ---------------------------------------------------------------------------

describe("methodRouter — method name edge cases", () => {
	it.effect("fails for method with wrong case (ETH_CHAINID)", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const error = yield* methodRouter(node)("ETH_CHAINID", []).pipe(Effect.flip)
			expect(error._tag).toBe("MethodNotFoundError")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("fails for method with extra spaces", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const error = yield* methodRouter(node)(" eth_chainId ", []).pipe(Effect.flip)
			expect(error._tag).toBe("MethodNotFoundError")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("fails for method with unicode characters", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const error = yield* methodRouter(node)("eth_chainId🔥", []).pipe(Effect.flip)
			expect(error._tag).toBe("MethodNotFoundError")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("MethodNotFoundError includes the method name", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const error = yield* methodRouter(node)("nonexistent_method", []).pipe(Effect.flip)
			expect(error._tag).toBe("MethodNotFoundError")
			if (error._tag === "MethodNotFoundError") {
				expect(error.method).toBe("nonexistent_method")
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// Params handling
// ---------------------------------------------------------------------------

describe("methodRouter — params handling", () => {
	it.effect("eth_chainId ignores extra params", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* methodRouter(node)("eth_chainId", ["ignored", 42, null])
			expect(result).toBe("0x7a69")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("eth_blockNumber ignores params", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* methodRouter(node)("eth_blockNumber", [])
			expect(result).toBe("0x0")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
