import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import type { Block } from "./block-store.js"
import { InvalidBlockError } from "./errors.js"
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
// Gas limit validation — EIP-150 bounds
// ---------------------------------------------------------------------------

describe("BlockHeaderValidatorService — gas limit", () => {
	it.effect("accepts gas limit within bounds (same as parent)", () =>
		Effect.gen(function* () {
			const validator = yield* BlockHeaderValidatorService
			const parent = makeParent({ gasLimit: 30_000_000n })
			const child = makeBlock({ gasLimit: 30_000_000n })
			const result = yield* validator.validateGasLimit(child, parent)
			expect(result).toBe(true)
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("accepts gas limit at upper bound (parent + parent/1024)", () =>
		Effect.gen(function* () {
			const validator = yield* BlockHeaderValidatorService
			const parent = makeParent({ gasLimit: 30_000_000n })
			// Max increase: parent + parent/1024 - 1 = 30_000_000 + 29_296 - 1 = 30_029_295
			const child = makeBlock({ gasLimit: 30_029_295n })
			const result = yield* validator.validateGasLimit(child, parent)
			expect(result).toBe(true)
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("accepts gas limit at lower bound (parent - parent/1024)", () =>
		Effect.gen(function* () {
			const validator = yield* BlockHeaderValidatorService
			const parent = makeParent({ gasLimit: 30_000_000n })
			// Min decrease: parent - parent/1024 + 1 = 30_000_000 - 29_296 + 1 = 29_970_705
			const child = makeBlock({ gasLimit: 29_970_705n })
			const result = yield* validator.validateGasLimit(child, parent)
			expect(result).toBe(true)
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("rejects gas limit above upper bound", () =>
		Effect.gen(function* () {
			const validator = yield* BlockHeaderValidatorService
			const parent = makeParent({ gasLimit: 30_000_000n })
			// Exceeds: parent + parent/1024
			const child = makeBlock({ gasLimit: 30_029_297n })
			const result = yield* validator.validateGasLimit(child, parent).pipe(
				Effect.catchTag("InvalidBlockError", (e) => Effect.succeed(e.message)),
			)
			expect(result).toContain("gas limit")
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("rejects gas limit below lower bound", () =>
		Effect.gen(function* () {
			const validator = yield* BlockHeaderValidatorService
			const parent = makeParent({ gasLimit: 30_000_000n })
			// Below: parent - parent/1024
			const child = makeBlock({ gasLimit: 29_970_703n })
			const result = yield* validator.validateGasLimit(child, parent).pipe(
				Effect.catchTag("InvalidBlockError", (e) => Effect.succeed(e.message)),
			)
			expect(result).toContain("gas limit")
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("rejects gas limit below minimum (5000)", () =>
		Effect.gen(function* () {
			const validator = yield* BlockHeaderValidatorService
			const parent = makeParent({ gasLimit: 5001n })
			const child = makeBlock({ gasLimit: 4999n })
			const result = yield* validator.validateGasLimit(child, parent).pipe(
				Effect.catchTag("InvalidBlockError", (e) => Effect.succeed(e.message)),
			)
			expect(result).toContain("gas limit")
		}).pipe(Effect.provide(TestLayer)),
	)
})

// ---------------------------------------------------------------------------
// Base fee validation — EIP-1559
// ---------------------------------------------------------------------------

describe("BlockHeaderValidatorService — base fee", () => {
	it.effect("accepts correct base fee when parent gas used equals target (50%)", () =>
		Effect.gen(function* () {
			const validator = yield* BlockHeaderValidatorService
			// When parent uses exactly half its gas limit, base fee stays the same
			const parent = makeParent({ gasLimit: 30_000_000n, gasUsed: 15_000_000n, baseFeePerGas: 1_000_000_000n })
			const child = makeBlock({ baseFeePerGas: 1_000_000_000n })
			const result = yield* validator.validateBaseFee(child, parent)
			expect(result).toBe(true)
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("accepts correct base fee increase (parent gas used > target)", () =>
		Effect.gen(function* () {
			const validator = yield* BlockHeaderValidatorService
			// Parent used 100% of gas limit → base fee increases
			const parent = makeParent({ gasLimit: 30_000_000n, gasUsed: 30_000_000n, baseFeePerGas: 1_000_000_000n })
			// Expected: baseFee + baseFee * (gasUsed - target) / target / 8
			// = 1_000_000_000 + 1_000_000_000 * 15_000_000 / 15_000_000 / 8
			// = 1_000_000_000 + 125_000_000 = 1_125_000_000
			const child = makeBlock({ baseFeePerGas: 1_125_000_000n })
			const result = yield* validator.validateBaseFee(child, parent)
			expect(result).toBe(true)
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("accepts correct base fee decrease (parent gas used < target)", () =>
		Effect.gen(function* () {
			const validator = yield* BlockHeaderValidatorService
			// Parent used 0% of gas limit → base fee decreases
			const parent = makeParent({ gasLimit: 30_000_000n, gasUsed: 0n, baseFeePerGas: 1_000_000_000n })
			// Expected: baseFee - baseFee * (target - gasUsed) / target / 8
			// = 1_000_000_000 - 1_000_000_000 * 15_000_000 / 15_000_000 / 8
			// = 1_000_000_000 - 125_000_000 = 875_000_000
			const child = makeBlock({ baseFeePerGas: 875_000_000n })
			const result = yield* validator.validateBaseFee(child, parent)
			expect(result).toBe(true)
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("rejects incorrect base fee", () =>
		Effect.gen(function* () {
			const validator = yield* BlockHeaderValidatorService
			const parent = makeParent({ gasLimit: 30_000_000n, gasUsed: 15_000_000n, baseFeePerGas: 1_000_000_000n })
			// Expected 1_000_000_000 but we provide 999_999_999
			const child = makeBlock({ baseFeePerGas: 999_999_999n })
			const result = yield* validator.validateBaseFee(child, parent).pipe(
				Effect.catchTag("InvalidBlockError", (e) => Effect.succeed(e.message)),
			)
			expect(result).toContain("base fee")
		}).pipe(Effect.provide(TestLayer)),
	)
})

// ---------------------------------------------------------------------------
// Timestamp validation
// ---------------------------------------------------------------------------

describe("BlockHeaderValidatorService — timestamp", () => {
	it.effect("accepts timestamp greater than parent", () =>
		Effect.gen(function* () {
			const validator = yield* BlockHeaderValidatorService
			const parent = makeParent({ timestamp: 1_000_000n })
			const child = makeBlock({ timestamp: 1_000_001n })
			const result = yield* validator.validateTimestamp(child, parent)
			expect(result).toBe(true)
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("rejects timestamp equal to parent", () =>
		Effect.gen(function* () {
			const validator = yield* BlockHeaderValidatorService
			const parent = makeParent({ timestamp: 1_000_000n })
			const child = makeBlock({ timestamp: 1_000_000n })
			const result = yield* validator.validateTimestamp(child, parent).pipe(
				Effect.catchTag("InvalidBlockError", (e) => Effect.succeed(e.message)),
			)
			expect(result).toContain("timestamp")
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("rejects timestamp less than parent", () =>
		Effect.gen(function* () {
			const validator = yield* BlockHeaderValidatorService
			const parent = makeParent({ timestamp: 1_000_000n })
			const child = makeBlock({ timestamp: 999_999n })
			const result = yield* validator.validateTimestamp(child, parent).pipe(
				Effect.catchTag("InvalidBlockError", (e) => Effect.succeed(e.message)),
			)
			expect(result).toContain("timestamp")
		}).pipe(Effect.provide(TestLayer)),
	)
})

// ---------------------------------------------------------------------------
// validate — full header validation
// ---------------------------------------------------------------------------

describe("BlockHeaderValidatorService — validate (combined)", () => {
	it.effect("accepts a fully valid block", () =>
		Effect.gen(function* () {
			const validator = yield* BlockHeaderValidatorService
			const parent = makeParent()
			const child = makeBlock()
			const result = yield* validator.validate(child, parent)
			expect(result).toBe(true)
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("rejects block failing gas limit check", () =>
		Effect.gen(function* () {
			const validator = yield* BlockHeaderValidatorService
			const parent = makeParent({ gasLimit: 30_000_000n })
			const child = makeBlock({ gasLimit: 60_000_000n })
			const result = yield* validator.validate(child, parent).pipe(
				Effect.catchTag("InvalidBlockError", (e) => Effect.succeed(e.message)),
			)
			expect(result).toContain("gas limit")
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("rejects block failing base fee check", () =>
		Effect.gen(function* () {
			const validator = yield* BlockHeaderValidatorService
			const parent = makeParent()
			const child = makeBlock({ baseFeePerGas: 999n })
			const result = yield* validator.validate(child, parent).pipe(
				Effect.catchTag("InvalidBlockError", (e) => Effect.succeed(e.message)),
			)
			expect(result).toContain("base fee")
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("rejects block failing timestamp check", () =>
		Effect.gen(function* () {
			const validator = yield* BlockHeaderValidatorService
			const parent = makeParent({ timestamp: 1_000_000n })
			const child = makeBlock({ timestamp: 999_000n })
			const result = yield* validator.validate(child, parent).pipe(
				Effect.catchTag("InvalidBlockError", (e) => Effect.succeed(e.message)),
			)
			expect(result).toContain("timestamp")
		}).pipe(Effect.provide(TestLayer)),
	)
})
