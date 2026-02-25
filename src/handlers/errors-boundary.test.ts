import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import {
	HandlerError,
	InsufficientBalanceError,
	IntrinsicGasTooLowError,
	MaxFeePerGasTooLowError,
	NonceTooLowError,
	TransactionNotFoundError,
} from "./errors.js"

// ---------------------------------------------------------------------------
// MaxFeePerGasTooLowError — previously untested
// ---------------------------------------------------------------------------

describe("MaxFeePerGasTooLowError", () => {
	it("has correct _tag", () => {
		const err = new MaxFeePerGasTooLowError({
			message: "maxFeePerGas too low",
			maxFeePerGas: 1_000_000_000n,
			baseFee: 2_000_000_000n,
		})
		expect(err._tag).toBe("MaxFeePerGasTooLowError")
	})

	it("carries maxFeePerGas and baseFee fields", () => {
		const err = new MaxFeePerGasTooLowError({
			message: "maxFeePerGas too low",
			maxFeePerGas: 500n,
			baseFee: 1000n,
		})
		expect(err.maxFeePerGas).toBe(500n)
		expect(err.baseFee).toBe(1000n)
		expect(err.message).toBe("maxFeePerGas too low")
	})

	it.effect("is catchable by tag in Effect", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(
				new MaxFeePerGasTooLowError({
					message: "fee too low",
					maxFeePerGas: 1n,
					baseFee: 100n,
				}),
			).pipe(Effect.catchTag("MaxFeePerGasTooLowError", (e) => Effect.succeed(e.baseFee)))
			expect(result).toBe(100n)
		}),
	)

	it("_tag is distinct from all other handler errors", () => {
		const maxFee = new MaxFeePerGasTooLowError({ message: "a", maxFeePerGas: 1n, baseFee: 2n })
		const handler = new HandlerError({ message: "b" })
		const balance = new InsufficientBalanceError({ message: "c", required: 1n, available: 0n })
		const nonce = new NonceTooLowError({ message: "d", expected: 1n, actual: 0n })
		const gas = new IntrinsicGasTooLowError({ message: "e", required: 1n, provided: 0n })
		const txNotFound = new TransactionNotFoundError({ hash: "0x" })

		const tags = [maxFee._tag, handler._tag, balance._tag, nonce._tag, gas._tag, txNotFound._tag]
		const uniqueTags = new Set(tags)
		expect(uniqueTags.size).toBe(tags.length)
	})
})

// ---------------------------------------------------------------------------
// Discriminated union with all error types
// ---------------------------------------------------------------------------

describe("All handler errors — discriminated union", () => {
	it.effect("catchTag selects MaxFeePerGasTooLowError from full union", () =>
		Effect.gen(function* () {
			const program = Effect.fail(
				new MaxFeePerGasTooLowError({ message: "low", maxFeePerGas: 1n, baseFee: 10n }),
			) as Effect.Effect<
				string,
				| HandlerError
				| InsufficientBalanceError
				| NonceTooLowError
				| IntrinsicGasTooLowError
				| MaxFeePerGasTooLowError
				| TransactionNotFoundError
			>

			const result = yield* program.pipe(
				Effect.catchTag("HandlerError", (e) => Effect.succeed(`handler: ${e.message}`)),
				Effect.catchTag("InsufficientBalanceError", (e) => Effect.succeed(`balance: ${e.message}`)),
				Effect.catchTag("NonceTooLowError", (e) => Effect.succeed(`nonce: ${e.message}`)),
				Effect.catchTag("IntrinsicGasTooLowError", (e) => Effect.succeed(`gas: ${e.message}`)),
				Effect.catchTag("MaxFeePerGasTooLowError", (e) => Effect.succeed(`maxFee: ${e.message}`)),
				Effect.catchTag("TransactionNotFoundError", (e) => Effect.succeed(`notFound: ${e.hash}`)),
			)
			expect(result).toBe("maxFee: low")
		}),
	)
})
