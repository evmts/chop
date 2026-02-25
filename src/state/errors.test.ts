import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { InvalidSnapshotError, MissingAccountError } from "./errors.js"

// ---------------------------------------------------------------------------
// MissingAccountError
// ---------------------------------------------------------------------------

describe("MissingAccountError", () => {
	it.effect("has correct _tag", () =>
		Effect.sync(() => {
			const error = new MissingAccountError({ address: "0xdead" })
			expect(error._tag).toBe("MissingAccountError")
			expect(error.address).toBe("0xdead")
		}),
	)

	it.effect("can be caught with Effect.catchTag", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(new MissingAccountError({ address: "0xbeef" })).pipe(
				Effect.catchTag("MissingAccountError", (e) => Effect.succeed(e.address)),
			)
			expect(result).toBe("0xbeef")
		}),
	)

	it.effect("catchAll catches MissingAccountError", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(new MissingAccountError({ address: "0xabc" })).pipe(
				Effect.catchAll((e) => Effect.succeed(`${e._tag}: ${e.address}`)),
			)
			expect(result).toBe("MissingAccountError: 0xabc")
		}),
	)
})

// ---------------------------------------------------------------------------
// InvalidSnapshotError
// ---------------------------------------------------------------------------

describe("InvalidSnapshotError", () => {
	it.effect("has correct _tag", () =>
		Effect.sync(() => {
			const error = new InvalidSnapshotError({ snapshotId: 42, message: "not found" })
			expect(error._tag).toBe("InvalidSnapshotError")
			expect(error.snapshotId).toBe(42)
			expect(error.message).toBe("not found")
		}),
	)

	it.effect("can be caught with Effect.catchTag", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(new InvalidSnapshotError({ snapshotId: 5, message: "gone" })).pipe(
				Effect.catchTag("InvalidSnapshotError", (e) => Effect.succeed(e.snapshotId)),
			)
			expect(result).toBe(5)
		}),
	)

	it.effect("catchAll catches InvalidSnapshotError", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(new InvalidSnapshotError({ snapshotId: 10, message: "expired" })).pipe(
				Effect.catchAll((e) => Effect.succeed(`${e._tag}: ${e.snapshotId} - ${e.message}`)),
			)
			expect(result).toBe("InvalidSnapshotError: 10 - expired")
		}),
	)
})

// ---------------------------------------------------------------------------
// Discriminated union — both error types coexist
// ---------------------------------------------------------------------------

describe("MissingAccountError + InvalidSnapshotError discrimination", () => {
	it.effect("catchTag selects correct error type", () =>
		Effect.gen(function* () {
			const program = Effect.fail(new MissingAccountError({ address: "0xdead" })) as Effect.Effect<
				string,
				MissingAccountError | InvalidSnapshotError
			>

			const result = yield* program.pipe(
				Effect.catchTag("MissingAccountError", (e) => Effect.succeed(`account: ${e.address}`)),
				Effect.catchTag("InvalidSnapshotError", (e) => Effect.succeed(`snapshot: ${e.snapshotId}`)),
			)
			expect(result).toBe("account: 0xdead")
		}),
	)

	it("_tag values are distinct", () => {
		const missing = new MissingAccountError({ address: "0x1" })
		const invalid = new InvalidSnapshotError({ snapshotId: 1, message: "bad" })
		expect(missing._tag).not.toBe(invalid._tag)
		expect(missing._tag).toBe("MissingAccountError")
		expect(invalid._tag).toBe("InvalidSnapshotError")
	})
})
