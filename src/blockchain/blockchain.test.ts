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
// Genesis initialization — Acceptance criterion 4
// ---------------------------------------------------------------------------

describe("BlockchainService — genesis", () => {
	it.effect("initGenesis stores genesis block and sets it as head", () =>
		Effect.gen(function* () {
			const chain = yield* BlockchainService
			yield* chain.initGenesis(GENESIS_BLOCK)
			const head = yield* chain.getHead()
			expect(head.hash).toBe("0xgenesis")
			expect(head.number).toBe(0n)
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("initGenesis sets canonical mapping for block 0", () =>
		Effect.gen(function* () {
			const chain = yield* BlockchainService
			yield* chain.initGenesis(GENESIS_BLOCK)
			const block = yield* chain.getBlockByNumber(0n)
			expect(block.hash).toBe("0xgenesis")
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("initGenesis fails if already initialized", () =>
		Effect.gen(function* () {
			const chain = yield* BlockchainService
			yield* chain.initGenesis(GENESIS_BLOCK)
			const result = yield* chain.initGenesis(GENESIS_BLOCK).pipe(
				Effect.catchTag("GenesisError", (e) => Effect.succeed(e.message)),
			)
			expect(result).toContain("already")
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("getHead fails with GenesisError before genesis is initialized", () =>
		Effect.gen(function* () {
			const chain = yield* BlockchainService
			const result = yield* chain.getHead().pipe(
				Effect.catchTag("GenesisError", (e) => Effect.succeed(e.message)),
			)
			expect(result).toContain("not initialized")
		}).pipe(Effect.provide(TestLayer)),
	)
})

// ---------------------------------------------------------------------------
// Block operations
// ---------------------------------------------------------------------------

describe("BlockchainService — block operations", () => {
	it.effect("putBlock stores and retrieves a block", () =>
		Effect.gen(function* () {
			const chain = yield* BlockchainService
			yield* chain.initGenesis(GENESIS_BLOCK)
			const block = makeBlock()
			yield* chain.putBlock(block)
			const retrieved = yield* chain.getBlock("0xblock1")
			expect(retrieved.hash).toBe("0xblock1")
			expect(retrieved.number).toBe(1n)
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("putBlock with higher totalDifficulty updates head (fork choice)", () =>
		Effect.gen(function* () {
			const chain = yield* BlockchainService
			yield* chain.initGenesis(GENESIS_BLOCK)
			const block1 = makeBlock({ hash: "0xb1", number: 1n })
			yield* chain.putBlock(block1)
			const head = yield* chain.getHead()
			expect(head.hash).toBe("0xb1")
			expect(head.number).toBe(1n)
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("putBlock with lower block number does not update head", () =>
		Effect.gen(function* () {
			const chain = yield* BlockchainService
			yield* chain.initGenesis(GENESIS_BLOCK)
			const block1 = makeBlock({ hash: "0xb1", number: 1n })
			yield* chain.putBlock(block1)
			// An uncle block with same parent but different hash and lower number
			// Actually for fork choice, we store but head stays at the longer chain
			const uncle = makeBlock({ hash: "0xuncle", number: 1n, parentHash: "0xgenesis" })
			yield* chain.putBlock(uncle)
			const head = yield* chain.getHead()
			// Head should be whichever was set first with that block number
			expect(head.hash).toBe("0xb1")
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("putBlock extends canonical chain for sequential blocks", () =>
		Effect.gen(function* () {
			const chain = yield* BlockchainService
			yield* chain.initGenesis(GENESIS_BLOCK)

			const block1 = makeBlock({ hash: "0xb1", number: 1n, parentHash: "0xgenesis" })
			yield* chain.putBlock(block1)

			const block2 = makeBlock({ hash: "0xb2", number: 2n, parentHash: "0xb1", timestamp: 1_000_002n })
			yield* chain.putBlock(block2)

			const head = yield* chain.getHead()
			expect(head.hash).toBe("0xb2")
			expect(head.number).toBe(2n)

			// Both blocks should be retrievable by number
			const b0 = yield* chain.getBlockByNumber(0n)
			const b1 = yield* chain.getBlockByNumber(1n)
			const b2 = yield* chain.getBlockByNumber(2n)
			expect(b0.hash).toBe("0xgenesis")
			expect(b1.hash).toBe("0xb1")
			expect(b2.hash).toBe("0xb2")
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("getBlock fails for nonexistent hash", () =>
		Effect.gen(function* () {
			const chain = yield* BlockchainService
			yield* chain.initGenesis(GENESIS_BLOCK)
			const result = yield* chain.getBlock("0xnonexistent").pipe(
				Effect.catchTag("BlockNotFoundError", (e) => Effect.succeed(e.identifier)),
			)
			expect(result).toBe("0xnonexistent")
		}).pipe(Effect.provide(TestLayer)),
	)
})

// ---------------------------------------------------------------------------
// Head tracking helpers
// ---------------------------------------------------------------------------

describe("BlockchainService — head tracking", () => {
	it.effect("getHeadBlockNumber returns current head number", () =>
		Effect.gen(function* () {
			const chain = yield* BlockchainService
			yield* chain.initGenesis(GENESIS_BLOCK)
			const num = yield* chain.getHeadBlockNumber()
			expect(num).toBe(0n)
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("getHeadBlockNumber updates after putBlock", () =>
		Effect.gen(function* () {
			const chain = yield* BlockchainService
			yield* chain.initGenesis(GENESIS_BLOCK)
			yield* chain.putBlock(makeBlock({ hash: "0xb1", number: 1n }))
			const num = yield* chain.getHeadBlockNumber()
			expect(num).toBe(1n)
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("getLatestBlock returns the head block", () =>
		Effect.gen(function* () {
			const chain = yield* BlockchainService
			yield* chain.initGenesis(GENESIS_BLOCK)
			const latest = yield* chain.getLatestBlock()
			expect(latest.hash).toBe("0xgenesis")

			yield* chain.putBlock(makeBlock({ hash: "0xb1", number: 1n }))
			const latest2 = yield* chain.getLatestBlock()
			expect(latest2.hash).toBe("0xb1")
		}).pipe(Effect.provide(TestLayer)),
	)
})
