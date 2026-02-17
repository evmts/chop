import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { formatGas, formatTimestamp, formatWei, truncateAddress, truncateHash } from "./dashboard-format.js"

describe("dashboard-format", () => {
	describe("truncateAddress", () => {
		it.effect("truncates a full 42-char address to 0xABCD...1234 format", () =>
			Effect.sync(() => {
				const addr = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
				const result = truncateAddress(addr)
				expect(result).toBe("0xf39F...2266")
			}),
		)

		it.effect("returns short strings unchanged", () =>
			Effect.sync(() => {
				expect(truncateAddress("0x1234")).toBe("0x1234")
			}),
		)

		it.effect("handles empty string", () =>
			Effect.sync(() => {
				expect(truncateAddress("")).toBe("")
			}),
		)
	})

	describe("truncateHash", () => {
		it.effect("truncates a 66-char tx hash", () =>
			Effect.sync(() => {
				const hash = `0x${"ab".repeat(32)}`
				const result = truncateHash(hash)
				expect(result).toBe("0xabab...abab")
			}),
		)

		it.effect("returns short strings unchanged", () =>
			Effect.sync(() => {
				expect(truncateHash("0xabc")).toBe("0xabc")
			}),
		)
	})

	describe("formatWei", () => {
		it.effect("formats 10000 ETH", () =>
			Effect.sync(() => {
				const wei = 10_000n * 10n ** 18n
				expect(formatWei(wei)).toBe("10,000.00 ETH")
			}),
		)

		it.effect("formats 1.5 ETH", () =>
			Effect.sync(() => {
				const wei = 1_500_000_000_000_000_000n
				expect(formatWei(wei)).toBe("1.50 ETH")
			}),
		)

		it.effect("formats 0 wei", () =>
			Effect.sync(() => {
				expect(formatWei(0n)).toBe("0 ETH")
			}),
		)

		it.effect("formats gwei-range values", () =>
			Effect.sync(() => {
				const gwei = 1_000_000_000n
				expect(formatWei(gwei)).toBe("1.00 gwei")
			}),
		)

		it.effect("formats small wei values", () =>
			Effect.sync(() => {
				expect(formatWei(42n)).toBe("42 wei")
			}),
		)
	})

	describe("formatGas", () => {
		it.effect("formats 0 gas", () =>
			Effect.sync(() => {
				expect(formatGas(0n)).toBe("0")
			}),
		)

		it.effect("formats sub-1000 gas", () =>
			Effect.sync(() => {
				expect(formatGas(500n)).toBe("500")
			}),
		)

		it.effect("formats thousands as K", () =>
			Effect.sync(() => {
				expect(formatGas(21_000n)).toBe("21.0K")
			}),
		)

		it.effect("formats millions as M", () =>
			Effect.sync(() => {
				expect(formatGas(30_000_000n)).toBe("30.0M")
			}),
		)
	})

	describe("formatTimestamp", () => {
		it.effect("formats recent timestamps as seconds ago", () =>
			Effect.sync(() => {
				const now = BigInt(Math.floor(Date.now() / 1000))
				expect(formatTimestamp(now - 5n)).toBe("5s ago")
			}),
		)

		it.effect("formats minute-range timestamps", () =>
			Effect.sync(() => {
				const now = BigInt(Math.floor(Date.now() / 1000))
				expect(formatTimestamp(now - 120n)).toBe("2m ago")
			}),
		)

		it.effect("formats hour-range timestamps", () =>
			Effect.sync(() => {
				const now = BigInt(Math.floor(Date.now() / 1000))
				expect(formatTimestamp(now - 7200n)).toBe("2h ago")
			}),
		)

		it.effect("formats zero timestamp as old", () =>
			Effect.sync(() => {
				// Epoch 0 should be very old
				const result = formatTimestamp(0n)
				expect(result).toMatch(/ago$/)
			}),
		)
	})
})
