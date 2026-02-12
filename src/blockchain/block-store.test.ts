import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { BlockNotFoundError } from "./errors.js"
import { type Block, BlockStoreLive, BlockStoreService } from "./block-store.js"

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const TestLayer = BlockStoreLive()

const makeBlock = (overrides: Partial<Block> = {}): Block => ({
	hash: "0xabc123",
	parentHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
	number: 0n,
	timestamp: 1_000_000n,
	gasLimit: 30_000_000n,
	gasUsed: 0n,
	baseFeePerGas: 1_000_000_000n,
	...overrides,
})

// ---------------------------------------------------------------------------
// putBlock + getBlock — Acceptance criterion 1
// ---------------------------------------------------------------------------

describe("BlockStoreService — put/get", () => {
	it.effect("put block → get by hash → matches", () =>
		Effect.gen(function* () {
			const store = yield* BlockStoreService
			const block = makeBlock({ hash: "0x111", number: 1n })
			yield* store.putBlock(block)
			const retrieved = yield* store.getBlock("0x111")
			expect(retrieved.hash).toBe("0x111")
			expect(retrieved.number).toBe(1n)
			expect(retrieved.timestamp).toBe(block.timestamp)
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("getBlock fails with BlockNotFoundError for missing hash", () =>
		Effect.gen(function* () {
			const store = yield* BlockStoreService
			const result = yield* store.getBlock("0xnonexistent").pipe(
				Effect.catchTag("BlockNotFoundError", (e) => Effect.succeed(e.identifier)),
			)
			expect(result).toBe("0xnonexistent")
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("hasBlock returns true for existing block", () =>
		Effect.gen(function* () {
			const store = yield* BlockStoreService
			yield* store.putBlock(makeBlock({ hash: "0xexists" }))
			const has = yield* store.hasBlock("0xexists")
			expect(has).toBe(true)
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("hasBlock returns false for missing block", () =>
		Effect.gen(function* () {
			const store = yield* BlockStoreService
			const has = yield* store.hasBlock("0xmissing")
			expect(has).toBe(false)
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("deleteBlock removes a block", () =>
		Effect.gen(function* () {
			const store = yield* BlockStoreService
			yield* store.putBlock(makeBlock({ hash: "0xdel" }))
			yield* store.deleteBlock("0xdel")
			const has = yield* store.hasBlock("0xdel")
			expect(has).toBe(false)
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("deleteBlock on missing hash is a no-op", () =>
		Effect.gen(function* () {
			const store = yield* BlockStoreService
			// Should not throw
			yield* store.deleteBlock("0xnope")
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("putBlock overwrites existing block with same hash", () =>
		Effect.gen(function* () {
			const store = yield* BlockStoreService
			yield* store.putBlock(makeBlock({ hash: "0xdup", gasUsed: 100n }))
			yield* store.putBlock(makeBlock({ hash: "0xdup", gasUsed: 200n }))
			const block = yield* store.getBlock("0xdup")
			expect(block.gasUsed).toBe(200n)
		}).pipe(Effect.provide(TestLayer)),
	)
})

// ---------------------------------------------------------------------------
// Canonical index — Acceptance criterion 2
// ---------------------------------------------------------------------------

describe("BlockStoreService — canonical index", () => {
	it.effect("set canonical head → get by number → matches", () =>
		Effect.gen(function* () {
			const store = yield* BlockStoreService
			const block = makeBlock({ hash: "0xcanon", number: 5n })
			yield* store.putBlock(block)
			yield* store.setCanonical(5n, "0xcanon")
			const hash = yield* store.getCanonical(5n)
			expect(hash).toBe("0xcanon")
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("getCanonical fails with BlockNotFoundError for missing number", () =>
		Effect.gen(function* () {
			const store = yield* BlockStoreService
			const result = yield* store.getCanonical(999n).pipe(
				Effect.catchTag("BlockNotFoundError", (e) => Effect.succeed(e.identifier)),
			)
			expect(result).toBe("999")
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("getBlockByNumber retrieves via canonical index", () =>
		Effect.gen(function* () {
			const store = yield* BlockStoreService
			const block = makeBlock({ hash: "0xbynum", number: 10n })
			yield* store.putBlock(block)
			yield* store.setCanonical(10n, "0xbynum")
			const retrieved = yield* store.getBlockByNumber(10n)
			expect(retrieved.hash).toBe("0xbynum")
			expect(retrieved.number).toBe(10n)
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("getBlockByNumber fails if canonical hash not in store", () =>
		Effect.gen(function* () {
			const store = yield* BlockStoreService
			yield* store.setCanonical(20n, "0xghost")
			const result = yield* store.getBlockByNumber(20n).pipe(
				Effect.catchTag("BlockNotFoundError", (e) => Effect.succeed(e.identifier)),
			)
			expect(result).toBe("0xghost")
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("canonical index can be overwritten", () =>
		Effect.gen(function* () {
			const store = yield* BlockStoreService
			yield* store.putBlock(makeBlock({ hash: "0xold", number: 7n }))
			yield* store.putBlock(makeBlock({ hash: "0xnew", number: 7n }))
			yield* store.setCanonical(7n, "0xold")
			yield* store.setCanonical(7n, "0xnew")
			const hash = yield* store.getCanonical(7n)
			expect(hash).toBe("0xnew")
		}).pipe(Effect.provide(TestLayer)),
	)
})

// ---------------------------------------------------------------------------
// Orphan tracking — Acceptance criterion 3
// ---------------------------------------------------------------------------

describe("BlockStoreService — orphan tracking", () => {
	it.effect("addOrphan + isOrphan returns true", () =>
		Effect.gen(function* () {
			const store = yield* BlockStoreService
			yield* store.addOrphan("0xorphan1")
			const is = yield* store.isOrphan("0xorphan1")
			expect(is).toBe(true)
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("isOrphan returns false for non-orphan", () =>
		Effect.gen(function* () {
			const store = yield* BlockStoreService
			const is = yield* store.isOrphan("0xnotorphan")
			expect(is).toBe(false)
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("getOrphans returns all orphan hashes", () =>
		Effect.gen(function* () {
			const store = yield* BlockStoreService
			yield* store.addOrphan("0xo1")
			yield* store.addOrphan("0xo2")
			yield* store.addOrphan("0xo3")
			const orphans = yield* store.getOrphans()
			expect(orphans).toHaveLength(3)
			expect(orphans).toContain("0xo1")
			expect(orphans).toContain("0xo2")
			expect(orphans).toContain("0xo3")
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("removeOrphan resolves an orphan", () =>
		Effect.gen(function* () {
			const store = yield* BlockStoreService
			yield* store.addOrphan("0xresolved")
			yield* store.removeOrphan("0xresolved")
			const is = yield* store.isOrphan("0xresolved")
			expect(is).toBe(false)
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("removeOrphan on non-orphan is a no-op", () =>
		Effect.gen(function* () {
			const store = yield* BlockStoreService
			// Should not throw
			yield* store.removeOrphan("0xnope")
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("getOrphans returns empty array initially", () =>
		Effect.gen(function* () {
			const store = yield* BlockStoreService
			const orphans = yield* store.getOrphans()
			expect(orphans).toHaveLength(0)
		}).pipe(Effect.provide(TestLayer)),
	)

	it.effect("addOrphan is idempotent (adding same hash twice)", () =>
		Effect.gen(function* () {
			const store = yield* BlockStoreService
			yield* store.addOrphan("0xdup")
			yield* store.addOrphan("0xdup")
			const orphans = yield* store.getOrphans()
			expect(orphans.filter((h) => h === "0xdup")).toHaveLength(1)
		}).pipe(Effect.provide(TestLayer)),
	)
})
