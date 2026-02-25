import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import {
	HandlerError,
	InsufficientBalanceError,
	IntrinsicGasTooLowError,
	NonceTooLowError,
	TransactionNotFoundError,
} from "./errors.js"

describe("HandlerError", () => {
	it("has correct _tag", () => {
		const err = new HandlerError({ message: "test" })
		expect(err._tag).toBe("HandlerError")
	})

	it("carries message", () => {
		const err = new HandlerError({ message: "call reverted" })
		expect(err.message).toBe("call reverted")
	})

	it("carries optional cause", () => {
		const cause = new Error("root cause")
		const err = new HandlerError({ message: "wrapped", cause })
		expect(err.cause).toBe(cause)
	})

	it.effect("is catchable by tag in Effect", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(new HandlerError({ message: "oops" })).pipe(
				Effect.catchTag("HandlerError", (e) => Effect.succeed(e.message)),
			)
			expect(result).toBe("oops")
		}),
	)
})

describe("InsufficientBalanceError", () => {
	it("has correct _tag", () => {
		const err = new InsufficientBalanceError({
			message: "insufficient balance",
			required: 100n,
			available: 50n,
		})
		expect(err._tag).toBe("InsufficientBalanceError")
	})

	it("carries required and available fields", () => {
		const err = new InsufficientBalanceError({
			message: "insufficient balance",
			required: 1000n,
			available: 500n,
		})
		expect(err.required).toBe(1000n)
		expect(err.available).toBe(500n)
		expect(err.message).toBe("insufficient balance")
	})

	it.effect("is catchable by tag in Effect", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(
				new InsufficientBalanceError({ message: "low", required: 10n, available: 5n }),
			).pipe(Effect.catchTag("InsufficientBalanceError", (e) => Effect.succeed(e.available)))
			expect(result).toBe(5n)
		}),
	)
})

describe("NonceTooLowError", () => {
	it("has correct _tag", () => {
		const err = new NonceTooLowError({ message: "nonce too low", expected: 5n, actual: 3n })
		expect(err._tag).toBe("NonceTooLowError")
	})

	it("carries expected and actual nonce", () => {
		const err = new NonceTooLowError({ message: "nonce too low", expected: 10n, actual: 7n })
		expect(err.expected).toBe(10n)
		expect(err.actual).toBe(7n)
	})

	it.effect("is catchable by tag in Effect", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(
				new NonceTooLowError({ message: "nonce too low", expected: 5n, actual: 3n }),
			).pipe(Effect.catchTag("NonceTooLowError", (e) => Effect.succeed(e.expected)))
			expect(result).toBe(5n)
		}),
	)
})

describe("IntrinsicGasTooLowError", () => {
	it("has correct _tag", () => {
		const err = new IntrinsicGasTooLowError({ message: "gas too low", required: 21000n, provided: 10000n })
		expect(err._tag).toBe("IntrinsicGasTooLowError")
	})

	it("carries required and provided gas", () => {
		const err = new IntrinsicGasTooLowError({ message: "gas too low", required: 53000n, provided: 21000n })
		expect(err.required).toBe(53000n)
		expect(err.provided).toBe(21000n)
	})

	it.effect("is catchable by tag in Effect", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(
				new IntrinsicGasTooLowError({ message: "gas too low", required: 21000n, provided: 10000n }),
			).pipe(Effect.catchTag("IntrinsicGasTooLowError", (e) => Effect.succeed(e.required)))
			expect(result).toBe(21000n)
		}),
	)
})

describe("TransactionNotFoundError", () => {
	it("has correct _tag", () => {
		const err = new TransactionNotFoundError({ hash: "0xabc123" })
		expect(err._tag).toBe("TransactionNotFoundError")
	})

	it("carries hash", () => {
		const hash = `0x${"ab".repeat(32)}`
		const err = new TransactionNotFoundError({ hash })
		expect(err.hash).toBe(hash)
	})

	it.effect("is catchable by tag in Effect", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(new TransactionNotFoundError({ hash: "0xdead" })).pipe(
				Effect.catchTag("TransactionNotFoundError", (e) => Effect.succeed(e.hash)),
			)
			expect(result).toBe("0xdead")
		}),
	)
})
