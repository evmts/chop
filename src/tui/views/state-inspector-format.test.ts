import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import {
	formatBalanceLine,
	formatCodeLine,
	formatCodeSize,
	formatHexOrDecimal,
	formatIndent,
	formatNonceLine,
	formatStorageSlotLine,
	formatTreeIndicator,
} from "./state-inspector-format.js"

describe("state-inspector-format", () => {
	describe("formatTreeIndicator", () => {
		it.effect("expanded returns ▾", () =>
			Effect.sync(() => {
				expect(formatTreeIndicator(true)).toBe("▾")
			}),
		)

		it.effect("collapsed returns ▸", () =>
			Effect.sync(() => {
				expect(formatTreeIndicator(false)).toBe("▸")
			}),
		)
	})

	describe("formatIndent", () => {
		it.effect("depth 0 returns empty string", () =>
			Effect.sync(() => {
				expect(formatIndent(0)).toBe("")
			}),
		)

		it.effect("depth 1 returns 2 spaces", () =>
			Effect.sync(() => {
				expect(formatIndent(1)).toBe("  ")
			}),
		)

		it.effect("depth 2 returns 4 spaces", () =>
			Effect.sync(() => {
				expect(formatIndent(2)).toBe("    ")
			}),
		)
	})

	describe("formatCodeSize", () => {
		it.effect("0 returns (none - EOA)", () =>
			Effect.sync(() => {
				expect(formatCodeSize(0)).toBe("(none - EOA)")
			}),
		)

		it.effect("1234 returns 1,234 bytes", () =>
			Effect.sync(() => {
				expect(formatCodeSize(1234)).toBe("1,234 bytes")
			}),
		)

		it.effect("1 returns 1 bytes", () =>
			Effect.sync(() => {
				expect(formatCodeSize(1)).toBe("1 bytes")
			}),
		)
	})

	describe("formatHexOrDecimal", () => {
		it.effect("hex mode returns hex string as-is", () =>
			Effect.sync(() => {
				expect(formatHexOrDecimal("0x3e8", false)).toBe("0x3e8")
			}),
		)

		it.effect("decimal mode converts hex to decimal", () =>
			Effect.sync(() => {
				expect(formatHexOrDecimal("0x3e8", true)).toBe("1000")
			}),
		)

		it.effect("decimal mode handles 0x0", () =>
			Effect.sync(() => {
				expect(formatHexOrDecimal("0x0", true)).toBe("0")
			}),
		)
	})

	describe("formatStorageSlotLine", () => {
		it.effect("formats slot with hex value", () =>
			Effect.sync(() => {
				const line = formatStorageSlotLine(
					"0x0000000000000000000000000000000000000000000000000000000000000000",
					"0x3e8",
					false,
				)
				expect(line).toContain("Slot 0")
				expect(line).toContain("0x3e8")
			}),
		)

		it.effect("formats with decimal when toggled", () =>
			Effect.sync(() => {
				const line = formatStorageSlotLine(
					"0x0000000000000000000000000000000000000000000000000000000000000000",
					"0x3e8",
					true,
				)
				expect(line).toContain("Slot 0")
				expect(line).toContain("1000")
			}),
		)
	})

	describe("formatBalanceLine", () => {
		it.effect("formats balance with ETH", () =>
			Effect.sync(() => {
				const line = formatBalanceLine(10_000n * 10n ** 18n)
				expect(line).toContain("Balance:")
				expect(line).toContain("ETH")
			}),
		)

		it.effect("formats zero balance", () =>
			Effect.sync(() => {
				const line = formatBalanceLine(0n)
				expect(line).toContain("Balance:")
				expect(line).toContain("0 ETH")
			}),
		)
	})

	describe("formatNonceLine", () => {
		it.effect("formats nonce 0", () =>
			Effect.sync(() => {
				expect(formatNonceLine(0n)).toBe("Nonce:   0")
			}),
		)

		it.effect("formats nonce 42", () =>
			Effect.sync(() => {
				expect(formatNonceLine(42n)).toBe("Nonce:   42")
			}),
		)
	})

	describe("formatCodeLine", () => {
		it.effect("formats EOA code", () =>
			Effect.sync(() => {
				expect(formatCodeLine(0)).toBe("Code:    (none - EOA)")
			}),
		)

		it.effect("formats contract code size", () =>
			Effect.sync(() => {
				expect(formatCodeLine(1234)).toBe("Code:    1,234 bytes")
			}),
		)
	})
})
