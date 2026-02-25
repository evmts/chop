import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { DRACULA } from "../theme.js"
import {
	formatBlockTime,
	formatChainId,
	formatForkBlock,
	formatForkUrl,
	formatGasLimitValue,
	formatHardfork,
	formatMiningMode,
} from "./settings-format.js"

describe("settings-format", () => {
	describe("formatMiningMode", () => {
		it.effect("auto mode shows Auto in green", () =>
			Effect.sync(() => {
				const result = formatMiningMode("auto")
				expect(result.text).toBe("Auto")
				expect(result.color).toBe(DRACULA.green)
			}),
		)

		it.effect("manual mode shows Manual in yellow", () =>
			Effect.sync(() => {
				const result = formatMiningMode("manual")
				expect(result.text).toBe("Manual")
				expect(result.color).toBe(DRACULA.yellow)
			}),
		)

		it.effect("interval mode shows Interval in cyan", () =>
			Effect.sync(() => {
				const result = formatMiningMode("interval")
				expect(result.text).toBe("Interval")
				expect(result.color).toBe(DRACULA.cyan)
			}),
		)

		it.effect("each mode has a distinct color", () =>
			Effect.sync(() => {
				const auto = formatMiningMode("auto")
				const manual = formatMiningMode("manual")
				const interval = formatMiningMode("interval")
				expect(auto.color).not.toBe(manual.color)
				expect(manual.color).not.toBe(interval.color)
			}),
		)
	})

	describe("formatChainId", () => {
		it.effect("formats default devnet chain ID with hex", () =>
			Effect.sync(() => {
				const result = formatChainId(31337n)
				expect(result).toBe("31337 (0x7a69)")
			}),
		)

		it.effect("formats chain ID 1 for mainnet", () =>
			Effect.sync(() => {
				const result = formatChainId(1n)
				expect(result).toBe("1 (0x1)")
			}),
		)

		it.effect("formats chain ID 0", () =>
			Effect.sync(() => {
				const result = formatChainId(0n)
				expect(result).toBe("0 (0x0)")
			}),
		)
	})

	describe("formatGasLimitValue", () => {
		it.effect("formats 30M gas limit", () =>
			Effect.sync(() => {
				const result = formatGasLimitValue(30_000_000n)
				expect(result).toBe("30,000,000")
			}),
		)

		it.effect("formats zero gas limit", () =>
			Effect.sync(() => {
				const result = formatGasLimitValue(0n)
				expect(result).toBe("0")
			}),
		)

		it.effect("formats small gas limit", () =>
			Effect.sync(() => {
				const result = formatGasLimitValue(21000n)
				expect(result).toBe("21,000")
			}),
		)
	})

	describe("formatBlockTime", () => {
		it.effect("0 ms shows Auto (mine on tx)", () =>
			Effect.sync(() => {
				const result = formatBlockTime(0)
				expect(result).toBe("Auto (mine on tx)")
			}),
		)

		it.effect("formats interval in seconds", () =>
			Effect.sync(() => {
				const result = formatBlockTime(2000)
				expect(result).toBe("2s")
			}),
		)

		it.effect("formats sub-second interval in ms", () =>
			Effect.sync(() => {
				const result = formatBlockTime(500)
				expect(result).toBe("500ms")
			}),
		)

		it.effect("formats large interval", () =>
			Effect.sync(() => {
				const result = formatBlockTime(60000)
				expect(result).toBe("60s")
			}),
		)
	})

	describe("formatForkUrl", () => {
		it.effect("undefined shows N/A (local mode)", () =>
			Effect.sync(() => {
				const result = formatForkUrl(undefined)
				expect(result).toBe("N/A (local mode)")
			}),
		)

		it.effect("shows URL when set", () =>
			Effect.sync(() => {
				const result = formatForkUrl("https://eth.llamarpc.com")
				expect(result).toBe("https://eth.llamarpc.com")
			}),
		)
	})

	describe("formatForkBlock", () => {
		it.effect("undefined shows N/A (local mode)", () =>
			Effect.sync(() => {
				const result = formatForkBlock(undefined)
				expect(result).toBe("N/A (local mode)")
			}),
		)

		it.effect("shows block number with commas", () =>
			Effect.sync(() => {
				const result = formatForkBlock(21_000_000n)
				expect(result).toBe("21,000,000")
			}),
		)

		it.effect("shows zero block", () =>
			Effect.sync(() => {
				const result = formatForkBlock(0n)
				expect(result).toBe("0")
			}),
		)
	})

	describe("formatHardfork", () => {
		it.effect("capitalizes first letter", () =>
			Effect.sync(() => {
				const result = formatHardfork("prague")
				expect(result).toBe("Prague")
			}),
		)

		it.effect("handles cancun", () =>
			Effect.sync(() => {
				const result = formatHardfork("cancun")
				expect(result).toBe("Cancun")
			}),
		)

		it.effect("handles empty string", () =>
			Effect.sync(() => {
				const result = formatHardfork("")
				expect(result).toBe("")
			}),
		)
	})
})
