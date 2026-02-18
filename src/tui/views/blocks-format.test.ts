import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { formatBlockNumber, formatGasUsage, formatTimestampAbsolute, formatTxCount } from "./blocks-format.js"

describe("blocks-format", () => {
	describe("formatBlockNumber", () => {
		it.effect("formats zero", () =>
			Effect.sync(() => {
				expect(formatBlockNumber(0n)).toBe("#0")
			}),
		)

		it.effect("formats small number", () =>
			Effect.sync(() => {
				expect(formatBlockNumber(42n)).toBe("#42")
			}),
		)

		it.effect("formats large number with commas", () =>
			Effect.sync(() => {
				expect(formatBlockNumber(1_000_000n)).toBe("#1,000,000")
			}),
		)
	})

	describe("formatTxCount", () => {
		it.effect("returns 0 for undefined", () =>
			Effect.sync(() => {
				expect(formatTxCount(undefined)).toBe("0")
			}),
		)

		it.effect("returns 0 for empty array", () =>
			Effect.sync(() => {
				expect(formatTxCount([])).toBe("0")
			}),
		)

		it.effect("returns count for non-empty array", () =>
			Effect.sync(() => {
				expect(formatTxCount(["0xabc", "0xdef"])).toBe("2")
			}),
		)

		it.effect("returns count for single item", () =>
			Effect.sync(() => {
				expect(formatTxCount(["0xabc"])).toBe("1")
			}),
		)
	})

	describe("formatGasUsage", () => {
		it.effect("formats zero usage", () =>
			Effect.sync(() => {
				const result = formatGasUsage(0n, 30_000_000n)
				expect(result).toContain("0")
				expect(result).toContain("0.0%")
			}),
		)

		it.effect("formats 50% usage", () =>
			Effect.sync(() => {
				const result = formatGasUsage(15_000_000n, 30_000_000n)
				expect(result).toContain("50.0%")
			}),
		)

		it.effect("formats 100% usage", () =>
			Effect.sync(() => {
				const result = formatGasUsage(30_000_000n, 30_000_000n)
				expect(result).toContain("100.0%")
			}),
		)

		it.effect("includes both used and limit values", () =>
			Effect.sync(() => {
				const result = formatGasUsage(1_200_000n, 30_000_000n)
				expect(result).toContain("1,200,000")
				expect(result).toContain("30,000,000")
			}),
		)

		it.effect("handles zero gas limit", () =>
			Effect.sync(() => {
				const result = formatGasUsage(0n, 0n)
				expect(result).toContain("0.0%")
			}),
		)
	})

	describe("formatTimestampAbsolute", () => {
		it.effect("returns a date string", () =>
			Effect.sync(() => {
				const ts = BigInt(Math.floor(Date.now() / 1000))
				const result = formatTimestampAbsolute(ts)
				// Should contain date components
				expect(result.length).toBeGreaterThan(0)
			}),
		)

		it.effect("formats a known timestamp", () =>
			Effect.sync(() => {
				// 2024-01-01 00:00:00 UTC = 1704067200
				const result = formatTimestampAbsolute(1704067200n)
				expect(result).toContain("2024")
				// Should have date-time format YYYY-MM-DD HH:MM:SS
				expect(result).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)
			}),
		)
	})
})
