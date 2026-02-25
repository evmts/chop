import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { BlockNotFoundError, CanonicalChainError, GenesisError, InvalidBlockError } from "./errors.js"

// ---------------------------------------------------------------------------
// BlockNotFoundError
// ---------------------------------------------------------------------------

describe("BlockNotFoundError", () => {
	it.effect("has correct _tag", () =>
		Effect.sync(() => {
			const error = new BlockNotFoundError({ identifier: "0xdead" })
			expect(error._tag).toBe("BlockNotFoundError")
			expect(error.identifier).toBe("0xdead")
		}),
	)

	it.effect("can be caught with Effect.catchTag", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(new BlockNotFoundError({ identifier: "0xbeef" })).pipe(
				Effect.catchTag("BlockNotFoundError", (e) => Effect.succeed(e.identifier)),
			)
			expect(result).toBe("0xbeef")
		}),
	)

	it.effect("catchAll catches BlockNotFoundError", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(new BlockNotFoundError({ identifier: "42" })).pipe(
				Effect.catchAll((e) => Effect.succeed(`${e._tag}: ${e.identifier}`)),
			)
			expect(result).toBe("BlockNotFoundError: 42")
		}),
	)
})

// ---------------------------------------------------------------------------
// InvalidBlockError
// ---------------------------------------------------------------------------

describe("InvalidBlockError", () => {
	it.effect("has correct _tag", () =>
		Effect.sync(() => {
			const error = new InvalidBlockError({ message: "gas limit out of bounds" })
			expect(error._tag).toBe("InvalidBlockError")
			expect(error.message).toBe("gas limit out of bounds")
		}),
	)

	it.effect("can be caught with Effect.catchTag", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(new InvalidBlockError({ message: "bad block" })).pipe(
				Effect.catchTag("InvalidBlockError", (e) => Effect.succeed(e.message)),
			)
			expect(result).toBe("bad block")
		}),
	)
})

// ---------------------------------------------------------------------------
// GenesisError
// ---------------------------------------------------------------------------

describe("GenesisError", () => {
	it.effect("has correct _tag", () =>
		Effect.sync(() => {
			const error = new GenesisError({ message: "already initialized" })
			expect(error._tag).toBe("GenesisError")
			expect(error.message).toBe("already initialized")
		}),
	)

	it.effect("can be caught with Effect.catchTag", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(new GenesisError({ message: "no genesis" })).pipe(
				Effect.catchTag("GenesisError", (e) => Effect.succeed(e.message)),
			)
			expect(result).toBe("no genesis")
		}),
	)
})

// ---------------------------------------------------------------------------
// CanonicalChainError
// ---------------------------------------------------------------------------

describe("CanonicalChainError", () => {
	it.effect("has correct _tag", () =>
		Effect.sync(() => {
			const error = new CanonicalChainError({ message: "gap in chain", blockNumber: 5n })
			expect(error._tag).toBe("CanonicalChainError")
			expect(error.message).toBe("gap in chain")
			expect(error.blockNumber).toBe(5n)
		}),
	)

	it.effect("can be caught with Effect.catchTag", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(new CanonicalChainError({ message: "reorg" })).pipe(
				Effect.catchTag("CanonicalChainError", (e) => Effect.succeed(e.message)),
			)
			expect(result).toBe("reorg")
		}),
	)

	it("blockNumber is optional", () => {
		const error = new CanonicalChainError({ message: "no number" })
		expect(error.blockNumber).toBeUndefined()
	})
})

// ---------------------------------------------------------------------------
// Discriminated union — all error types coexist
// ---------------------------------------------------------------------------

describe("Blockchain errors — discrimination", () => {
	it.effect("catchTag selects correct error type from union", () =>
		Effect.gen(function* () {
			const program = Effect.fail(new BlockNotFoundError({ identifier: "0x123" })) as Effect.Effect<
				string,
				BlockNotFoundError | InvalidBlockError | GenesisError | CanonicalChainError
			>

			const result = yield* program.pipe(
				Effect.catchTag("BlockNotFoundError", (e) => Effect.succeed(`not-found: ${e.identifier}`)),
				Effect.catchTag("InvalidBlockError", (e) => Effect.succeed(`invalid: ${e.message}`)),
				Effect.catchTag("GenesisError", (e) => Effect.succeed(`genesis: ${e.message}`)),
				Effect.catchTag("CanonicalChainError", (e) => Effect.succeed(`canonical: ${e.message}`)),
			)
			expect(result).toBe("not-found: 0x123")
		}),
	)

	it("_tag values are distinct", () => {
		const notFound = new BlockNotFoundError({ identifier: "0x1" })
		const invalid = new InvalidBlockError({ message: "bad" })
		const genesis = new GenesisError({ message: "init" })
		const canonical = new CanonicalChainError({ message: "gap" })

		const tags = [notFound._tag, invalid._tag, genesis._tag, canonical._tag]
		const unique = new Set(tags)
		expect(unique.size).toBe(4)
	})
})
