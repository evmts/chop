import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { initialState, keyToAction, reduce } from "./state.js"

describe("TUI state", () => {
	describe("initialState", () => {
		it.effect("starts on tab 0 with help hidden", () =>
			Effect.sync(() => {
				expect(initialState.activeTab).toBe(0)
				expect(initialState.helpVisible).toBe(false)
			}),
		)
	})

	describe("reduce", () => {
		it.effect("SetTab changes active tab", () =>
			Effect.sync(() => {
				const next = reduce(initialState, { _tag: "SetTab", tab: 1 })
				expect(next.activeTab).toBe(1)
				expect(next.helpVisible).toBe(false)
			}),
		)

		it.effect("SetTab to tab 7 (State Inspector)", () =>
			Effect.sync(() => {
				const next = reduce(initialState, { _tag: "SetTab", tab: 7 })
				expect(next.activeTab).toBe(7)
			}),
		)

		it.effect("ToggleHelp shows help overlay", () =>
			Effect.sync(() => {
				const next = reduce(initialState, { _tag: "ToggleHelp" })
				expect(next.helpVisible).toBe(true)
				expect(next.activeTab).toBe(0)
			}),
		)

		it.effect("ToggleHelp twice hides help overlay", () =>
			Effect.sync(() => {
				const shown = reduce(initialState, { _tag: "ToggleHelp" })
				const hidden = reduce(shown, { _tag: "ToggleHelp" })
				expect(hidden.helpVisible).toBe(false)
			}),
		)

		it.effect("SetTab preserves helpVisible state", () =>
			Effect.sync(() => {
				const withHelp = reduce(initialState, { _tag: "ToggleHelp" })
				const next = reduce(withHelp, { _tag: "SetTab", tab: 3 })
				expect(next.activeTab).toBe(3)
				expect(next.helpVisible).toBe(true)
			}),
		)

		it.effect("Quit returns state unchanged", () =>
			Effect.sync(() => {
				const next = reduce(initialState, { _tag: "Quit" })
				expect(next).toEqual(initialState)
			}),
		)
	})

	describe("keyToAction", () => {
		it.effect("'1' maps to SetTab 0 (Dashboard)", () =>
			Effect.sync(() => {
				const action = keyToAction("1")
				expect(action).toEqual({ _tag: "SetTab", tab: 0 })
			}),
		)

		it.effect("'2' maps to SetTab 1 (Call History)", () =>
			Effect.sync(() => {
				const action = keyToAction("2")
				expect(action).toEqual({ _tag: "SetTab", tab: 1 })
			}),
		)

		it.effect("'8' maps to SetTab 7 (State Inspector)", () =>
			Effect.sync(() => {
				const action = keyToAction("8")
				expect(action).toEqual({ _tag: "SetTab", tab: 7 })
			}),
		)

		it.effect("'?' maps to ToggleHelp", () =>
			Effect.sync(() => {
				const action = keyToAction("?")
				expect(action).toEqual({ _tag: "ToggleHelp" })
			}),
		)

		it.effect("'q' maps to Quit", () =>
			Effect.sync(() => {
				const action = keyToAction("q")
				expect(action).toEqual({ _tag: "Quit" })
			}),
		)

		it.effect("invalid key returns null", () =>
			Effect.sync(() => {
				expect(keyToAction("x")).toBeNull()
				expect(keyToAction("a")).toBeNull()
				expect(keyToAction("")).toBeNull()
			}),
		)

		it.effect("'0' is not a valid tab key", () =>
			Effect.sync(() => {
				expect(keyToAction("0")).toBeNull()
			}),
		)

		it.effect("'9' is not a valid tab key", () =>
			Effect.sync(() => {
				expect(keyToAction("9")).toBeNull()
			}),
		)

		it.effect("all keys 1-8 produce valid SetTab actions", () =>
			Effect.sync(() => {
				for (let i = 1; i <= 8; i++) {
					const action = keyToAction(String(i))
					expect(action).toEqual({ _tag: "SetTab", tab: i - 1 })
				}
			}),
		)

		it.effect("'j' maps to ViewKey 'j'", () =>
			Effect.sync(() => {
				const action = keyToAction("j")
				expect(action).toEqual({ _tag: "ViewKey", key: "j" })
			}),
		)

		it.effect("'k' maps to ViewKey 'k'", () =>
			Effect.sync(() => {
				const action = keyToAction("k")
				expect(action).toEqual({ _tag: "ViewKey", key: "k" })
			}),
		)

		it.effect("'return' maps to ViewKey 'return'", () =>
			Effect.sync(() => {
				const action = keyToAction("return")
				expect(action).toEqual({ _tag: "ViewKey", key: "return" })
			}),
		)

		it.effect("'escape' maps to ViewKey 'escape'", () =>
			Effect.sync(() => {
				const action = keyToAction("escape")
				expect(action).toEqual({ _tag: "ViewKey", key: "escape" })
			}),
		)

		it.effect("'/' maps to ViewKey '/'", () =>
			Effect.sync(() => {
				const action = keyToAction("/")
				expect(action).toEqual({ _tag: "ViewKey", key: "/" })
			}),
		)
	})

	describe("ViewKey reducer", () => {
		it.effect("ViewKey returns state unchanged (pass-through)", () =>
			Effect.sync(() => {
				const next = reduce(initialState, { _tag: "ViewKey", key: "j" })
				expect(next).toEqual(initialState)
			}),
		)

		it.effect("ViewKey does not affect activeTab", () =>
			Effect.sync(() => {
				const tabbed = reduce(initialState, { _tag: "SetTab", tab: 3 })
				const next = reduce(tabbed, { _tag: "ViewKey", key: "return" })
				expect(next.activeTab).toBe(3)
			}),
		)
	})
})
