import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import type { Block } from "./block-store.js"
import { BlockHeaderValidatorLive, BlockHeaderValidatorService } from "./header-validator.js"

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const TestLayer = BlockHeaderValidatorLive

const makeBlock = (overrides: Partial<Block> = {}): Block => ({
	hash: "0xabc",
	parentHash: "0x000",
	number: 1n,
	timestamp: 1_000_001n,
	gasLimit: 30_000_000n,
	gasUsed: 0n,
	baseFeePerGas: 1_000_000_000n,
	...overrides,
})

const makeParent = (overrides: Partial<Block> = {}): Block => ({
	hash: "0x000",
	parentHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
	number: 0n,
	timestamp: 1_000_000n,
	gasLimit: 30_000_000n,
	gasUsed: 15_000_000n,
	baseFeePerGas: 1_000_000_000n,
	...overrides,
})

// ---------------------------------------------------------------------------
// Base fee floor at zero
// ---------------------------------------------------------------------------

describe("BlockHeaderValidatorService — base fee boundary", () => {
	it.effect("base fee floors at 0 when decrease would go negative", () =>
		Effect.gen(function* () {
			const validator = yield* BlockHeaderValidatorService
			// Very low base fee with 0 gas used → decrease would go negative
			// parentBaseFee = 1, gasUsed = 0, gasLimit = 100
			// target = 50, gasUsedDelta = 50, delta = 1 * 50 / 50 / 8 = 0
			// But with baseFee=7, gasUsed=0: delta = 7 * 50 / 50 / 8 = 0 (integer div)
			// So baseFee stays the same. Need a case where delta > baseFee.
			// parentBaseFee = 1, gasUsed = 0, target = gasLimit/2
			// delta = 1 * target / target / 8 = 0 (integer div floors to 0)
			// So fee stays at 1. We need baseFee > 0 and gasUsedDelta / target / 8 ratio that produces delta > baseFee
			// Actually the floor branch: parentBaseFee > baseFeePerGasDelta ? parentBaseFee - delta : 0n
			// With parentBaseFee=1, gasUsed=0, gasLimit=2 (target=1), delta = 1*1/1/8 = 0 → baseFee=1
			// With parentBaseFee=7, gasUsed=0, gasLimit=2 (target=1), delta = 7*1/1/8 = 0 → baseFee=7
			// For delta > parent: parentBaseFee=1, gasUsed=0, gasLimit=16 (target=8), delta = 1*8/8/8 = 0
			// The integer division makes it hard. Let's use larger values:
			// parentBaseFee=8, gasUsed=0, gasLimit=2 (target=1), delta = 8*1/1/8 = 1 → baseFee=7
			// parentBaseFee=1, gasUsed=0, gasLimit=2 (target=1), delta = 1*1/1/8 = 0 → baseFee=1
			// For the floor-at-zero branch: delta >= baseFee
			// parentBaseFee=1, gasLimit=16, gasUsed=0, target=8
			// delta = 1*8/8/8 = 0 → baseFee stays 1 (no floor needed)
			// Need: parentBaseFee * gasUsedDelta / parentGasTarget / 8 >= parentBaseFee
			// i.e. gasUsedDelta / parentGasTarget / 8 >= 1 — impossible since gasUsedDelta <= parentGasTarget

			// The floor can only trigger when parentBaseFee is very small and delta rounds down
			// Actually: the floor is parentBaseFee > baseFeePerGasDelta ? ... : 0n
			// This triggers when baseFeePerGasDelta >= parentBaseFee
			// But baseFeePerGasDelta = (parentBaseFee * gasUsedDelta) / parentGasTarget / BASE_FEE_CHANGE_DENOMINATOR
			// = parentBaseFee * (parentGasTarget - gasUsed) / parentGasTarget / 8
			// Max delta when gasUsed=0: parentBaseFee * parentGasTarget / parentGasTarget / 8 = parentBaseFee / 8
			// So delta max = parentBaseFee/8 which is always < parentBaseFee (for parentBaseFee > 0)
			// Therefore the floor-at-zero branch is only reachable when parentBaseFee is 0
			// parentBaseFee=0: delta = 0, baseFee = 0 (floor)
			const parent = makeParent({ baseFeePerGas: 0n, gasUsed: 0n, gasLimit: 30_000_000n })
			const child = makeBlock({ baseFeePerGas: 0n })
			const result = yield* validator.validateBaseFee(child, parent)
			expect(result).toBe(true)
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("minimum increase of 1 when delta truncates to zero", () =>
		Effect.gen(function* () {
			const validator = yield* BlockHeaderValidatorService
			// Need: parentBaseFee * gasUsedDelta / parentGasTarget / 8 = 0
			// but gasUsed > target (so increase branch is hit)
			// parentBaseFee=1, gasLimit=30_000_000, target=15_000_000
			// gasUsed = target + 1 = 15_000_001
			// delta = 1 * 1 / 15_000_000 / 8 = 0 (integer division)
			// So the minimum-increase-of-1 branch triggers: expectedBaseFee = 1 + 1 = 2
			const parent = makeParent({
				baseFeePerGas: 1n,
				gasUsed: 15_000_001n,
				gasLimit: 30_000_000n,
			})
			const child = makeBlock({ baseFeePerGas: 2n })
			const result = yield* validator.validateBaseFee(child, parent)
			expect(result).toBe(true)
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("rejects wrong value when minimum increase should be 1", () =>
		Effect.gen(function* () {
			const validator = yield* BlockHeaderValidatorService
			const parent = makeParent({
				baseFeePerGas: 1n,
				gasUsed: 15_000_001n,
				gasLimit: 30_000_000n,
			})
			// Should be 2 (1 + minimum increase of 1), not 1
			const child = makeBlock({ baseFeePerGas: 1n })
			const result = yield* validator
				.validateBaseFee(child, parent)
				.pipe(Effect.catchTag("InvalidBlockError", (e) => Effect.succeed(e.message)))
			expect(result).toContain("base fee")
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("base fee decrease with very low parent base fee", () =>
		Effect.gen(function* () {
			const validator = yield* BlockHeaderValidatorService
			// parentBaseFee=8, gasUsed=0, gasLimit=30_000_000, target=15_000_000
			// delta = 8 * 15_000_000 / 15_000_000 / 8 = 1
			// expectedBaseFee = 8 - 1 = 7
			const parent = makeParent({
				baseFeePerGas: 8n,
				gasUsed: 0n,
				gasLimit: 30_000_000n,
			})
			const child = makeBlock({ baseFeePerGas: 7n })
			const result = yield* validator.validateBaseFee(child, parent)
			expect(result).toBe(true)
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("base fee with parent at exact target stays unchanged", () =>
		Effect.gen(function* () {
			const validator = yield* BlockHeaderValidatorService
			// gasUsed == target → unchanged
			const parent = makeParent({
				baseFeePerGas: 100n,
				gasUsed: 50_000n,
				gasLimit: 100_000n,
			})
			const child = makeBlock({ baseFeePerGas: 100n })
			const result = yield* validator.validateBaseFee(child, parent)
			expect(result).toBe(true)
		}).pipe(Effect.provide(TestLayer)),
	)
})
