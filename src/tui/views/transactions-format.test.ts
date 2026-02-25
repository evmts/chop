import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { formatCalldata, formatGasPrice, formatStatus, formatTo, formatTxType } from "./transactions-format.js"

describe("transactions-format", () => {
	describe("formatStatus", () => {
		it.effect("status 1 returns checkmark", () =>
			Effect.sync(() => {
				const result = formatStatus(1)
				expect(result.text).toBe("\u2713")
			}),
		)

		it.effect("status 0 returns cross", () =>
			Effect.sync(() => {
				const result = formatStatus(0)
				expect(result.text).toBe("\u2717")
			}),
		)

		it.effect("success and failure have different colors", () =>
			Effect.sync(() => {
				expect(formatStatus(1).color).not.toBe(formatStatus(0).color)
			}),
		)
	})

	describe("formatTxType", () => {
		it.effect("type 0 returns Legacy", () =>
			Effect.sync(() => {
				expect(formatTxType(0)).toBe("Legacy")
			}),
		)

		it.effect("type 2 returns EIP-1559", () =>
			Effect.sync(() => {
				expect(formatTxType(2)).toBe("EIP-1559")
			}),
		)

		it.effect("type 3 returns EIP-4844", () =>
			Effect.sync(() => {
				expect(formatTxType(3)).toBe("EIP-4844")
			}),
		)

		it.effect("unknown type returns Type N", () =>
			Effect.sync(() => {
				expect(formatTxType(99)).toBe("Type 99")
			}),
		)

		it.effect("type 1 returns EIP-2930", () =>
			Effect.sync(() => {
				expect(formatTxType(1)).toBe("EIP-2930")
			}),
		)
	})

	describe("formatTo", () => {
		it.effect("undefined returns CREATE", () =>
			Effect.sync(() => {
				expect(formatTo(undefined)).toBe("CREATE")
			}),
		)

		it.effect("null returns CREATE", () =>
			Effect.sync(() => {
				expect(formatTo(null)).toBe("CREATE")
			}),
		)

		it.effect("address returns truncated form", () =>
			Effect.sync(() => {
				const result = formatTo("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")
				expect(result).toBe("0xf39F...2266")
			}),
		)

		it.effect("short address returns unchanged", () =>
			Effect.sync(() => {
				expect(formatTo("0x1234")).toBe("0x1234")
			}),
		)
	})

	describe("formatCalldata", () => {
		it.effect("empty 0x returns (empty)", () =>
			Effect.sync(() => {
				expect(formatCalldata("0x")).toBe("(empty)")
			}),
		)

		it.effect("calldata with selector shows selector hex", () =>
			Effect.sync(() => {
				const data = `0xa9059cbb${"00".repeat(64)}`
				const result = formatCalldata(data)
				expect(result).toContain("0xa9059cbb")
			}),
		)

		it.effect("short calldata (less than 4 bytes) shows raw", () =>
			Effect.sync(() => {
				expect(formatCalldata("0xab")).toBe("0xab")
			}),
		)
	})

	describe("formatGasPrice", () => {
		it.effect("1 gwei formats correctly", () =>
			Effect.sync(() => {
				const result = formatGasPrice(1_000_000_000n)
				expect(result).toContain("gwei")
			}),
		)

		it.effect("zero formats as 0 ETH", () =>
			Effect.sync(() => {
				const result = formatGasPrice(0n)
				expect(result).toBe("0 ETH")
			}),
		)

		it.effect("large value formats as ETH", () =>
			Effect.sync(() => {
				const result = formatGasPrice(10n ** 18n)
				expect(result).toContain("ETH")
			}),
		)

		it.effect("small value formats as wei", () =>
			Effect.sync(() => {
				const result = formatGasPrice(500n)
				expect(result).toContain("wei")
			}),
		)
	})
})
