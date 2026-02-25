import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { makeImpersonationManager } from "./impersonation-manager.js"

const ADDR_A = "0x1234567890123456789012345678901234567890"
const ADDR_B = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"

describe("ImpersonationManager", () => {
	it.effect("impersonate → isImpersonated → true", () =>
		Effect.gen(function* () {
			const im = makeImpersonationManager()

			yield* im.impersonate(ADDR_A)
			const result = im.isImpersonated(ADDR_A)

			expect(result).toBe(true)
		}),
	)

	it.effect("not impersonated by default → isImpersonated → false", () =>
		Effect.sync(() => {
			const im = makeImpersonationManager()

			const result = im.isImpersonated(ADDR_A)

			expect(result).toBe(false)
		}),
	)

	it.effect("stopImpersonating → isImpersonated → false", () =>
		Effect.gen(function* () {
			const im = makeImpersonationManager()

			yield* im.impersonate(ADDR_A)
			expect(im.isImpersonated(ADDR_A)).toBe(true)

			yield* im.stopImpersonating(ADDR_A)
			expect(im.isImpersonated(ADDR_A)).toBe(false)
		}),
	)

	it.effect("multiple addresses can be impersonated independently", () =>
		Effect.gen(function* () {
			const im = makeImpersonationManager()

			yield* im.impersonate(ADDR_A)
			yield* im.impersonate(ADDR_B)

			expect(im.isImpersonated(ADDR_A)).toBe(true)
			expect(im.isImpersonated(ADDR_B)).toBe(true)

			yield* im.stopImpersonating(ADDR_A)
			expect(im.isImpersonated(ADDR_A)).toBe(false)
			expect(im.isImpersonated(ADDR_B)).toBe(true)
		}),
	)

	it.effect("autoImpersonate on → all addresses impersonated", () =>
		Effect.gen(function* () {
			const im = makeImpersonationManager()

			yield* im.setAutoImpersonate(true)

			expect(im.isImpersonated(ADDR_A)).toBe(true)
			expect(im.isImpersonated(ADDR_B)).toBe(true)
			expect(im.isImpersonated("0x0000000000000000000000000000000000000001")).toBe(true)
		}),
	)

	it.effect("autoImpersonate off → reverts to explicit set only", () =>
		Effect.gen(function* () {
			const im = makeImpersonationManager()

			yield* im.impersonate(ADDR_A)
			yield* im.setAutoImpersonate(true)

			// All addresses impersonated
			expect(im.isImpersonated(ADDR_B)).toBe(true)

			yield* im.setAutoImpersonate(false)

			// Only explicitly impersonated address remains
			expect(im.isImpersonated(ADDR_A)).toBe(true)
			expect(im.isImpersonated(ADDR_B)).toBe(false)
		}),
	)

	it.effect("isAutoImpersonated returns current state", () =>
		Effect.gen(function* () {
			const im = makeImpersonationManager()

			expect(im.isAutoImpersonated()).toBe(false)

			yield* im.setAutoImpersonate(true)
			expect(im.isAutoImpersonated()).toBe(true)

			yield* im.setAutoImpersonate(false)
			expect(im.isAutoImpersonated()).toBe(false)
		}),
	)

	it.effect("address comparison is case-insensitive", () =>
		Effect.gen(function* () {
			const im = makeImpersonationManager()

			yield* im.impersonate("0xABCDEF1234567890ABCDEF1234567890ABCDEF12")
			expect(im.isImpersonated("0xabcdef1234567890abcdef1234567890abcdef12")).toBe(true)
		}),
	)
})
