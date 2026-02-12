import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { ReleaseSpecLive, ReleaseSpecService } from "./release-spec.js"

describe("ReleaseSpecService — tag", () => {
	it("has correct tag key", () => {
		expect(ReleaseSpecService.key).toBe("ReleaseSpec")
	})
})

describe("ReleaseSpecService — prague (default)", () => {
	it.effect("prague enables all EIPs", () =>
		Effect.gen(function* () {
			const spec = yield* ReleaseSpecService
			expect(spec.hardfork).toBe("prague")
			expect(spec.isEip2028Enabled).toBe(true)
			expect(spec.isEip2930Enabled).toBe(true)
			expect(spec.isEip3860Enabled).toBe(true)
			expect(spec.isEip7623Enabled).toBe(true)
			expect(spec.isEip7702Enabled).toBe(true)
		}).pipe(Effect.provide(ReleaseSpecLive())),
	)
})

describe("ReleaseSpecService — cancun", () => {
	it.effect("cancun disables EIP7623 and EIP7702", () =>
		Effect.gen(function* () {
			const spec = yield* ReleaseSpecService
			expect(spec.hardfork).toBe("cancun")
			expect(spec.isEip2028Enabled).toBe(true)
			expect(spec.isEip2930Enabled).toBe(true)
			expect(spec.isEip3860Enabled).toBe(true)
			expect(spec.isEip7623Enabled).toBe(false)
			expect(spec.isEip7702Enabled).toBe(false)
		}).pipe(Effect.provide(ReleaseSpecLive("cancun"))),
	)
})

describe("ReleaseSpecService — shanghai", () => {
	it.effect("shanghai disables EIP7623 and EIP7702", () =>
		Effect.gen(function* () {
			const spec = yield* ReleaseSpecService
			expect(spec.hardfork).toBe("shanghai")
			expect(spec.isEip2028Enabled).toBe(true)
			expect(spec.isEip2930Enabled).toBe(true)
			expect(spec.isEip3860Enabled).toBe(true)
			expect(spec.isEip7623Enabled).toBe(false)
			expect(spec.isEip7702Enabled).toBe(false)
		}).pipe(Effect.provide(ReleaseSpecLive("shanghai"))),
	)
})

describe("ReleaseSpecService — unknown hardfork", () => {
	it.effect("unknown hardfork defaults to prague", () =>
		Effect.gen(function* () {
			const spec = yield* ReleaseSpecService
			expect(spec.hardfork).toBe("prague")
			expect(spec.isEip7623Enabled).toBe(true)
			expect(spec.isEip7702Enabled).toBe(true)
		}).pipe(Effect.provide(ReleaseSpecLive("bogus-hardfork"))),
	)
})
