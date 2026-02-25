import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { TABS, TAB_COUNT } from "./tabs.js"

describe("tabs", () => {
	it.effect("has exactly 8 tabs", () =>
		Effect.sync(() => {
			expect(TABS).toHaveLength(8)
			expect(TAB_COUNT).toBe(8)
		}),
	)

	it.effect("keys are '1' through '8'", () =>
		Effect.sync(() => {
			for (let i = 0; i < 8; i++) {
				expect(TABS[i]?.key).toBe(String(i + 1))
			}
		}),
	)

	it.effect("indices are 0 through 7", () =>
		Effect.sync(() => {
			for (let i = 0; i < 8; i++) {
				expect(TABS[i]?.index).toBe(i)
			}
		}),
	)

	it.effect("all names are non-empty strings", () =>
		Effect.sync(() => {
			for (const tab of TABS) {
				expect(tab.name).toBeTruthy()
				expect(typeof tab.name).toBe("string")
				expect(tab.name.length).toBeGreaterThan(0)
			}
		}),
	)

	it.effect("all shortNames are non-empty strings", () =>
		Effect.sync(() => {
			for (const tab of TABS) {
				expect(tab.shortName).toBeTruthy()
				expect(typeof tab.shortName).toBe("string")
				expect(tab.shortName.length).toBeGreaterThan(0)
			}
		}),
	)

	it.effect("keys are unique", () =>
		Effect.sync(() => {
			const keys = TABS.map((t) => t.key)
			expect(new Set(keys).size).toBe(keys.length)
		}),
	)

	it.effect("names are unique", () =>
		Effect.sync(() => {
			const names = TABS.map((t) => t.name)
			expect(new Set(names).size).toBe(names.length)
		}),
	)

	it.effect("tab 1 is Dashboard", () =>
		Effect.sync(() => {
			expect(TABS[0]?.name).toBe("Dashboard")
		}),
	)

	it.effect("tab 2 is Call History", () =>
		Effect.sync(() => {
			expect(TABS[1]?.name).toBe("Call History")
		}),
	)

	it.effect("tab 8 is State Inspector", () =>
		Effect.sync(() => {
			expect(TABS[7]?.name).toBe("State Inspector")
		}),
	)
})
