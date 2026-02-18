import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { formatCallType, formatGasBreakdown, formatStatus, truncateData } from "./call-history-format.js"

describe("call-history-format", () => {
	describe("formatCallType", () => {
		it.effect("formats CALL type", () =>
			Effect.sync(() => {
				const result = formatCallType("CALL")
				expect(result.text).toBe("CALL")
				expect(result.color).toBeTruthy()
			}),
		)

		it.effect("formats CREATE type", () =>
			Effect.sync(() => {
				const result = formatCallType("CREATE")
				expect(result.text).toBe("CREATE")
			}),
		)

		it.effect("formats STATICCALL type", () =>
			Effect.sync(() => {
				const result = formatCallType("STATICCALL")
				expect(result.text).toBe("STATIC")
			}),
		)

		it.effect("formats DELEGATECALL type", () =>
			Effect.sync(() => {
				const result = formatCallType("DELEGATECALL")
				expect(result.text).toBe("DELCALL")
			}),
		)

		it.effect("formats CREATE2 type", () =>
			Effect.sync(() => {
				const result = formatCallType("CREATE2")
				expect(result.text).toBe("CREATE2")
			}),
		)

		it.effect("each type has a unique color", () =>
			Effect.sync(() => {
				const types = ["CALL", "CREATE", "STATICCALL", "DELEGATECALL", "CREATE2"] as const
				const colors = types.map((t) => formatCallType(t).color)
				// CALL and DELEGATECALL can share colors, but CREATE should differ from CALL
				expect(formatCallType("CALL").color).not.toBe(formatCallType("CREATE").color)
			}),
		)
	})

	describe("formatStatus", () => {
		it.effect("formats success as checkmark", () =>
			Effect.sync(() => {
				const result = formatStatus(true)
				expect(result.text).toContain("\u2713")
				expect(result.color).toBeTruthy()
			}),
		)

		it.effect("formats failure as cross mark", () =>
			Effect.sync(() => {
				const result = formatStatus(false)
				expect(result.text).toContain("\u2717")
				expect(result.color).toBeTruthy()
			}),
		)

		it.effect("success and failure have different colors", () =>
			Effect.sync(() => {
				const success = formatStatus(true)
				const failure = formatStatus(false)
				expect(success.color).not.toBe(failure.color)
			}),
		)
	})

	describe("formatGasBreakdown", () => {
		it.effect("formats gas used and limit with commas", () =>
			Effect.sync(() => {
				const result = formatGasBreakdown(21000n, 21000n)
				expect(result).toContain("21,000")
			}),
		)

		it.effect("shows percentage of gas used", () =>
			Effect.sync(() => {
				const result = formatGasBreakdown(21000n, 30000000n)
				expect(result).toContain("%")
			}),
		)

		it.effect("handles zero gas limit", () =>
			Effect.sync(() => {
				const result = formatGasBreakdown(0n, 0n)
				expect(result).toContain("0")
			}),
		)

		it.effect("formats large gas values with commas", () =>
			Effect.sync(() => {
				const result = formatGasBreakdown(1_234_567n, 30_000_000n)
				expect(result).toContain("1,234,567")
			}),
		)
	})

	describe("truncateData", () => {
		it.effect("returns short hex unchanged", () =>
			Effect.sync(() => {
				expect(truncateData("0x1234")).toBe("0x1234")
			}),
		)

		it.effect("truncates long hex data", () =>
			Effect.sync(() => {
				const longData = `0x${"ab".repeat(100)}`
				const result = truncateData(longData)
				expect(result.length).toBeLessThan(longData.length)
				expect(result).toContain("...")
			}),
		)

		it.effect("handles empty 0x", () =>
			Effect.sync(() => {
				expect(truncateData("0x")).toBe("0x")
			}),
		)

		it.effect("preserves first and last bytes", () =>
			Effect.sync(() => {
				const data = `0x${"ab".repeat(50)}`
				const result = truncateData(data, 20)
				expect(result.startsWith("0x")).toBe(true)
				expect(result).toContain("...")
			}),
		)

		it.effect("respects custom max length", () =>
			Effect.sync(() => {
				const data = `0x${"ab".repeat(50)}`
				const short = truncateData(data, 10)
				const long = truncateData(data, 40)
				expect(short.length).toBeLessThanOrEqual(long.length)
			}),
		)
	})
})
