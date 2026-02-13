import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../node/index.js"
import {
	autoImpersonateAccountHandler,
	impersonateAccountHandler,
	stopImpersonatingAccountHandler,
} from "./impersonate.js"

const TEST_ADDR = "0x1234567890123456789012345678901234567890"

describe("impersonation handlers", () => {
	it.effect("impersonateAccountHandler → isImpersonated → true", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			const result = yield* impersonateAccountHandler(node)(TEST_ADDR)
			expect(result).toBe(true)
			expect(node.impersonationManager.isImpersonated(TEST_ADDR)).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("stopImpersonatingAccountHandler → isImpersonated → false", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			yield* impersonateAccountHandler(node)(TEST_ADDR)
			expect(node.impersonationManager.isImpersonated(TEST_ADDR)).toBe(true)

			const result = yield* stopImpersonatingAccountHandler(node)(TEST_ADDR)
			expect(result).toBe(true)
			expect(node.impersonationManager.isImpersonated(TEST_ADDR)).toBe(false)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("autoImpersonateAccountHandler → all addresses impersonated", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			const result = yield* autoImpersonateAccountHandler(node)(true)
			expect(result).toBe(true)

			expect(node.impersonationManager.isImpersonated(TEST_ADDR)).toBe(true)
			expect(
				node.impersonationManager.isImpersonated("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"),
			).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("autoImpersonateAccountHandler(false) → only explicit impersonation", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			yield* impersonateAccountHandler(node)(TEST_ADDR)
			yield* autoImpersonateAccountHandler(node)(true)
			yield* autoImpersonateAccountHandler(node)(false)

			expect(node.impersonationManager.isImpersonated(TEST_ADDR)).toBe(true)
			expect(
				node.impersonationManager.isImpersonated("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"),
			).toBe(false)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
