import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { formatAccountType, formatBalance, formatCodeIndicator, formatNonce } from "./accounts-format.js"

describe("accounts-format", () => {
	describe("formatBalance", () => {
		it.effect("formats 10,000 ETH", () =>
			Effect.sync(() => {
				const wei = 10_000n * 10n ** 18n
				expect(formatBalance(wei)).toBe("10,000.00 ETH")
			}),
		)

		it.effect("formats 0 ETH", () =>
			Effect.sync(() => {
				expect(formatBalance(0n)).toBe("0 ETH")
			}),
		)

		it.effect("formats 1.5 ETH", () =>
			Effect.sync(() => {
				const wei = 1_500_000_000_000_000_000n
				expect(formatBalance(wei)).toBe("1.50 ETH")
			}),
		)

		it.effect("formats small gwei amounts", () =>
			Effect.sync(() => {
				const gwei = 1_000_000_000n
				expect(formatBalance(gwei)).toBe("1.00 gwei")
			}),
		)

		it.effect("formats tiny wei amounts", () =>
			Effect.sync(() => {
				expect(formatBalance(42n)).toBe("42 wei")
			}),
		)
	})

	describe("formatNonce", () => {
		it.effect("formats zero nonce", () =>
			Effect.sync(() => {
				expect(formatNonce(0n)).toBe("0")
			}),
		)

		it.effect("formats non-zero nonce", () =>
			Effect.sync(() => {
				expect(formatNonce(42n)).toBe("42")
			}),
		)

		it.effect("formats large nonce", () =>
			Effect.sync(() => {
				expect(formatNonce(1_234n)).toBe("1234")
			}),
		)
	})

	describe("formatAccountType", () => {
		it.effect("returns EOA for non-contract", () =>
			Effect.sync(() => {
				const result = formatAccountType(false)
				expect(result.text).toBe("EOA")
				expect(result.color).toBeTruthy()
			}),
		)

		it.effect("returns Contract for contract", () =>
			Effect.sync(() => {
				const result = formatAccountType(true)
				expect(result.text).toBe("Contract")
				expect(result.color).toBeTruthy()
			}),
		)

		it.effect("EOA and Contract have different colors", () =>
			Effect.sync(() => {
				const eoa = formatAccountType(false)
				const contract = formatAccountType(true)
				expect(eoa.color).not.toBe(contract.color)
			}),
		)
	})

	describe("formatCodeIndicator", () => {
		it.effect("returns No for empty code", () =>
			Effect.sync(() => {
				expect(formatCodeIndicator(new Uint8Array())).toBe("No")
			}),
		)

		it.effect("returns Yes for non-empty code", () =>
			Effect.sync(() => {
				expect(formatCodeIndicator(new Uint8Array([0x60, 0x00]))).toBe("Yes")
			}),
		)

		it.effect("returns No for zero-length Uint8Array", () =>
			Effect.sync(() => {
				expect(formatCodeIndicator(new Uint8Array(0))).toBe("No")
			}),
		)
	})
})
