import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { SETTINGS_FIELDS, type SettingsViewState, initialSettingsState, settingsReduce } from "./Settings.js"
import type { SettingsViewData } from "./settings-data.js"

/** Helper to create valid SettingsViewData. */
const makeData = (overrides: Partial<SettingsViewData> = {}): SettingsViewData => ({
	rpcUrl: undefined,
	chainId: 31337n,
	hardfork: "prague",
	miningMode: "auto",
	miningInterval: 0,
	blockGasLimit: 30_000_000n,
	baseFee: 1_000_000_000n,
	minGasPrice: 0n,
	forkUrl: undefined,
	...overrides,
})

/** Create state with data loaded. */
const stateWithData = (
	overrides: Partial<SettingsViewState> = {},
	dataOverrides: Partial<SettingsViewData> = {},
): SettingsViewState => ({
	...initialSettingsState,
	data: makeData(dataOverrides),
	...overrides,
})

describe("Settings view reducer", () => {
	describe("initialState", () => {
		it.effect("starts at index 0 with no data", () =>
			Effect.sync(() => {
				expect(initialSettingsState.selectedIndex).toBe(0)
				expect(initialSettingsState.inputActive).toBe(false)
				expect(initialSettingsState.gasLimitInput).toBe("")
				expect(initialSettingsState.miningModeToggled).toBe(false)
				expect(initialSettingsState.gasLimitConfirmed).toBe(false)
				expect(initialSettingsState.data).toBe(null)
			}),
		)
	})

	describe("SETTINGS_FIELDS", () => {
		it.effect("has 9 fields", () =>
			Effect.sync(() => {
				expect(SETTINGS_FIELDS.length).toBe(9)
			}),
		)

		it.effect("miningMode is editable", () =>
			Effect.sync(() => {
				const field = SETTINGS_FIELDS.find((f) => f.key === "miningMode")
				expect(field?.editable).toBe(true)
			}),
		)

		it.effect("blockGasLimit is editable", () =>
			Effect.sync(() => {
				const field = SETTINGS_FIELDS.find((f) => f.key === "blockGasLimit")
				expect(field?.editable).toBe(true)
			}),
		)

		it.effect("chainId is not editable", () =>
			Effect.sync(() => {
				const field = SETTINGS_FIELDS.find((f) => f.key === "chainId")
				expect(field?.editable).toBe(false)
			}),
		)
	})

	describe("j/k navigation", () => {
		it.effect("j moves selection down", () =>
			Effect.sync(() => {
				const state = stateWithData()
				const next = settingsReduce(state, "j")
				expect(next.selectedIndex).toBe(1)
			}),
		)

		it.effect("k moves selection up", () =>
			Effect.sync(() => {
				const state = stateWithData({ selectedIndex: 3 })
				const next = settingsReduce(state, "k")
				expect(next.selectedIndex).toBe(2)
			}),
		)

		it.effect("j clamps at last field", () =>
			Effect.sync(() => {
				const state = stateWithData({ selectedIndex: SETTINGS_FIELDS.length - 1 })
				const next = settingsReduce(state, "j")
				expect(next.selectedIndex).toBe(SETTINGS_FIELDS.length - 1)
			}),
		)

		it.effect("k clamps at first field", () =>
			Effect.sync(() => {
				const state = stateWithData({ selectedIndex: 0 })
				const next = settingsReduce(state, "k")
				expect(next.selectedIndex).toBe(0)
			}),
		)
	})

	describe("mining mode toggle", () => {
		it.effect("return on miningMode field sets miningModeToggled signal", () =>
			Effect.sync(() => {
				// Find miningMode index
				const miningIndex = SETTINGS_FIELDS.findIndex((f) => f.key === "miningMode")
				const state = stateWithData({ selectedIndex: miningIndex })
				const next = settingsReduce(state, "return")
				expect(next.miningModeToggled).toBe(true)
			}),
		)

		it.effect("space on miningMode field sets miningModeToggled signal", () =>
			Effect.sync(() => {
				const miningIndex = SETTINGS_FIELDS.findIndex((f) => f.key === "miningMode")
				const state = stateWithData({ selectedIndex: miningIndex })
				const next = settingsReduce(state, "space")
				expect(next.miningModeToggled).toBe(true)
			}),
		)

		it.effect("return on non-editable field does nothing", () =>
			Effect.sync(() => {
				const chainIdIndex = SETTINGS_FIELDS.findIndex((f) => f.key === "chainId")
				const state = stateWithData({ selectedIndex: chainIdIndex })
				const next = settingsReduce(state, "return")
				expect(next.miningModeToggled).toBe(false)
				expect(next.inputActive).toBe(false)
			}),
		)
	})

	describe("gas limit editing", () => {
		const gasLimitIndex = SETTINGS_FIELDS.findIndex((f) => f.key === "blockGasLimit")

		it.effect("return on blockGasLimit enters input mode", () =>
			Effect.sync(() => {
				const state = stateWithData({ selectedIndex: gasLimitIndex })
				const next = settingsReduce(state, "return")
				expect(next.inputActive).toBe(true)
				expect(next.gasLimitInput).toBe("")
			}),
		)

		it.effect("number keys append to gas limit input", () =>
			Effect.sync(() => {
				const state = stateWithData({ selectedIndex: gasLimitIndex, inputActive: true })
				const s1 = settingsReduce(state, "3")
				expect(s1.gasLimitInput).toBe("3")
				const s2 = settingsReduce(s1, "0")
				expect(s2.gasLimitInput).toBe("30")
			}),
		)

		it.effect("backspace removes last character", () =>
			Effect.sync(() => {
				const state = stateWithData({
					selectedIndex: gasLimitIndex,
					inputActive: true,
					gasLimitInput: "300",
				})
				const next = settingsReduce(state, "backspace")
				expect(next.gasLimitInput).toBe("30")
			}),
		)

		it.effect("backspace on empty input does nothing", () =>
			Effect.sync(() => {
				const state = stateWithData({
					selectedIndex: gasLimitIndex,
					inputActive: true,
					gasLimitInput: "",
				})
				const next = settingsReduce(state, "backspace")
				expect(next.gasLimitInput).toBe("")
			}),
		)

		it.effect("return confirms gas limit input", () =>
			Effect.sync(() => {
				const state = stateWithData({
					selectedIndex: gasLimitIndex,
					inputActive: true,
					gasLimitInput: "15000000",
				})
				const next = settingsReduce(state, "return")
				expect(next.inputActive).toBe(false)
				expect(next.gasLimitConfirmed).toBe(true)
				expect(next.gasLimitInput).toBe("15000000")
			}),
		)

		it.effect("return on empty input cancels", () =>
			Effect.sync(() => {
				const state = stateWithData({
					selectedIndex: gasLimitIndex,
					inputActive: true,
					gasLimitInput: "",
				})
				const next = settingsReduce(state, "return")
				expect(next.inputActive).toBe(false)
				expect(next.gasLimitConfirmed).toBe(false)
			}),
		)

		it.effect("escape cancels gas limit input", () =>
			Effect.sync(() => {
				const state = stateWithData({
					selectedIndex: gasLimitIndex,
					inputActive: true,
					gasLimitInput: "12345",
				})
				const next = settingsReduce(state, "escape")
				expect(next.inputActive).toBe(false)
				expect(next.gasLimitInput).toBe("")
				expect(next.gasLimitConfirmed).toBe(false)
			}),
		)

		it.effect("j/k keys are blocked during input mode", () =>
			Effect.sync(() => {
				const state = stateWithData({
					selectedIndex: gasLimitIndex,
					inputActive: true,
					gasLimitInput: "5",
				})
				const next = settingsReduce(state, "j")
				expect(next.selectedIndex).toBe(gasLimitIndex) // unchanged
				expect(next.inputActive).toBe(true) // still in input mode
			}),
		)
	})

	describe("unknown keys", () => {
		it.effect("unknown key in normal mode returns state unchanged", () =>
			Effect.sync(() => {
				const state = stateWithData()
				const next = settingsReduce(state, "x")
				expect(next).toEqual(state)
			}),
		)
	})

	describe("integration: shows chain ID and mining mode", () => {
		it.effect("data contains chain ID", () =>
			Effect.sync(() => {
				const state = stateWithData({}, { chainId: 31337n })
				expect(state.data?.chainId).toBe(31337n)
			}),
		)

		it.effect("data contains mining mode", () =>
			Effect.sync(() => {
				const state = stateWithData({}, { miningMode: "auto" })
				expect(state.data?.miningMode).toBe("auto")
			}),
		)
	})

	describe("integration: mining mode toggle signal", () => {
		it.effect("miningModeToggled signal is consumed (reset after read)", () =>
			Effect.sync(() => {
				const miningIndex = SETTINGS_FIELDS.findIndex((f) => f.key === "miningMode")
				const state = stateWithData({ selectedIndex: miningIndex })
				const toggled = settingsReduce(state, "return")
				expect(toggled.miningModeToggled).toBe(true)

				// After consuming, the next key press should not re-toggle
				const next = settingsReduce({ ...toggled, miningModeToggled: false }, "j")
				expect(next.miningModeToggled).toBe(false)
			}),
		)
	})
})
