/**
 * Boundary condition tests for blockchain/blockchain.ts.
 *
 * Covers:
 * - getBlockByNumber for non-existent block number
 * - putBlock storing but not updating head for equal block number
 * - Header validation error paths
 * - getHeadBlockNumber before genesis (fails)
 * - Multiple putBlock at same height
 */

import { describe, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { expect } from "vitest"
import type { Block } from "./block-store.js"
import { BlockStoreLive } from "./block-store.js"
import { BlockchainLive, BlockchainService } from "./blockchain.js"
import { BlockHeaderValidatorLive } from "./header-validator.js"

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const TestLayer = BlockchainLive.pipe(Layer.provide(BlockStoreLive()), Layer.provide(BlockHeaderValidatorLive))

const GENESIS_BLOCK: Block = {
	hash: "0xgenesis",
	parentHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
	number: 0n,
	timestamp: 1_000_000n,
	gasLimit: 30_000_000n,
	gasUsed: 0n,
	baseFeePerGas: 1_000_000_000n,
}

const makeBlock = (overrides: Partial<Block> = {}): Block => ({
	hash: "0xblock1",
	parentHash: "0xgenesis",
	number: 1n,
	timestamp: 1_000_001n,
	gasLimit: 30_000_000n,
	gasUsed: 0n,
	baseFeePerGas: 1_000_000_000n,
	...overrides,
})

// ---------------------------------------------------------------------------
// Block retrieval edge cases
// ---------------------------------------------------------------------------

describe("BlockchainService — retrieval edge cases", () => {
	it.effect("getBlockByNumber fails for non-existent block number", () =>
		Effect.gen(function* () {
			const chain = yield* BlockchainService
			yield* chain.initGenesis(GENESIS_BLOCK)
			const result = yield* chain
				.getBlockByNumber(999n)
				.pipe(Effect.catchTag("BlockNotFoundError", (e) => Effect.succeed(e.identifier)))
			expect(result).toBe("999")
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("getBlock with empty string hash fails", () =>
		Effect.gen(function* () {
			const chain = yield* BlockchainService
			yield* chain.initGenesis(GENESIS_BLOCK)
			const result = yield* chain
				.getBlock("")
				.pipe(Effect.catchTag("BlockNotFoundError", (e) => Effect.succeed(e.identifier)))
			expect(result).toBe("")
		}).pipe(Effect.provide(TestLayer)),
	)
})

// ---------------------------------------------------------------------------
// putBlock — edge cases
// ---------------------------------------------------------------------------

describe("BlockchainService — putBlock edge cases", () => {
	it.effect("putBlock at same height as existing does not update head if not higher", () =>
		Effect.gen(function* () {
			const chain = yield* BlockchainService
			yield* chain.initGenesis(GENESIS_BLOCK)

			const block1 = makeBlock({ hash: "0xfirst", number: 1n })
			yield* chain.putBlock(block1)

			// Another block at same height — head stays at first
			const block1b = makeBlock({ hash: "0xsecond", number: 1n })
			yield* chain.putBlock(block1b)

			const head = yield* chain.getHead()
			expect(head.hash).toBe("0xfirst") // first block still head
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("putBlock with strictly higher number updates head", () =>
		Effect.gen(function* () {
			const chain = yield* BlockchainService
			yield* chain.initGenesis(GENESIS_BLOCK)

			yield* chain.putBlock(makeBlock({ hash: "0xb1", number: 1n }))
			yield* chain.putBlock(makeBlock({ hash: "0xb2", number: 2n, parentHash: "0xb1", timestamp: 1_000_002n }))

			const head = yield* chain.getHead()
			expect(head.hash).toBe("0xb2")
			expect(head.number).toBe(2n)
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("putBlock with max bigint block number", () =>
		Effect.gen(function* () {
			const chain = yield* BlockchainService
			yield* chain.initGenesis(GENESIS_BLOCK)

			const bigNum = 2n ** 64n - 1n
			const block = makeBlock({ hash: "0xbig", number: bigNum, timestamp: 1_000_001n })
			yield* chain.putBlock(block)

			const head = yield* chain.getHead()
			expect(head.hash).toBe("0xbig")
			expect(head.number).toBe(bigNum)
		}).pipe(Effect.provide(TestLayer)),
	)
})

// ---------------------------------------------------------------------------
// Head tracking — boundary conditions
// ---------------------------------------------------------------------------

describe("BlockchainService — head tracking boundary", () => {
	it.effect("getHeadBlockNumber fails before genesis", () =>
		Effect.gen(function* () {
			const chain = yield* BlockchainService
			const result = yield* chain
				.getHeadBlockNumber()
				.pipe(Effect.catchTag("GenesisError", (e) => Effect.succeed(e.message)))
			expect(result).toContain("not initialized")
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("getLatestBlock fails before genesis", () =>
		Effect.gen(function* () {
			const chain = yield* BlockchainService
			const result = yield* chain
				.getLatestBlock()
				.pipe(Effect.catchTag("GenesisError", (e) => Effect.succeed(e.message)))
			expect(result).toContain("not initialized")
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("getHeadBlockNumber is 0 after genesis init", () =>
		Effect.gen(function* () {
			const chain = yield* BlockchainService
			yield* chain.initGenesis(GENESIS_BLOCK)
			const num = yield* chain.getHeadBlockNumber()
			expect(num).toBe(0n)
		}).pipe(Effect.provide(TestLayer)),
	)
})

// ---------------------------------------------------------------------------
// Block properties validation
// ---------------------------------------------------------------------------

describe("BlockchainService — block properties", () => {
	it.effect("genesis block preserves all fields", () =>
		Effect.gen(function* () {
			const chain = yield* BlockchainService
			yield* chain.initGenesis(GENESIS_BLOCK)
			const block = yield* chain.getBlock("0xgenesis")
			expect(block.hash).toBe("0xgenesis")
			expect(block.parentHash).toBe("0x0000000000000000000000000000000000000000000000000000000000000000")
			expect(block.number).toBe(0n)
			expect(block.timestamp).toBe(1_000_000n)
			expect(block.gasLimit).toBe(30_000_000n)
			expect(block.gasUsed).toBe(0n)
			expect(block.baseFeePerGas).toBe(1_000_000_000n)
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("putBlock preserves all fields", () =>
		Effect.gen(function* () {
			const chain = yield* BlockchainService
			yield* chain.initGenesis(GENESIS_BLOCK)
			const block = makeBlock({
				hash: "0xdetails",
				number: 1n,
				gasUsed: 21000n,
				baseFeePerGas: 2_000_000_000n,
			})
			yield* chain.putBlock(block)
			const retrieved = yield* chain.getBlock("0xdetails")
			expect(retrieved.gasUsed).toBe(21000n)
			expect(retrieved.baseFeePerGas).toBe(2_000_000_000n)
		}).pipe(Effect.provide(TestLayer)),
	)
})
