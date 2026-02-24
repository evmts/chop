import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import {
	type StateInspectorViewState,
	initialStateInspectorState,
	stateInspectorReduce,
	buildFlatTree,
} from "./StateInspector.js"
import type { AccountTreeNode } from "./state-inspector-data.js"

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const makeTestAccounts = (): readonly AccountTreeNode[] => [
	{
		address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
		balance: 10_000n * 10n ** 18n,
		nonce: 0n,
		codeSize: 0,
		storage: [],
	},
	{
		address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
		balance: 5_000n * 10n ** 18n,
		nonce: 3n,
		codeSize: 256,
		storage: [
			{ slot: "0x0000000000000000000000000000000000000000000000000000000000000000", value: "0x3e8" },
			{ slot: "0x0000000000000000000000000000000000000000000000000000000000000001", value: "0x1" },
		],
	},
]

const stateWithAccounts = (overrides?: Partial<StateInspectorViewState>): StateInspectorViewState => ({
	...initialStateInspectorState,
	accounts: makeTestAccounts(),
	...overrides,
})

describe("state-inspector-view", () => {
	describe("initial state", () => {
		it.effect("has default values", () =>
			Effect.sync(() => {
				expect(initialStateInspectorState.selectedIndex).toBe(0)
				expect(initialStateInspectorState.showDecimal).toBe(false)
				expect(initialStateInspectorState.expandedAccounts.size).toBe(0)
				expect(initialStateInspectorState.expandedStorage.size).toBe(0)
				expect(initialStateInspectorState.searchActive).toBe(false)
				expect(initialStateInspectorState.searchQuery).toBe("")
				expect(initialStateInspectorState.editActive).toBe(false)
				expect(initialStateInspectorState.editValue).toBe("")
				expect(initialStateInspectorState.editConfirmed).toBe(false)
			}),
		)
	})

	describe("j/k navigation", () => {
		it.effect("j moves selectedIndex down", () =>
			Effect.sync(() => {
				const state = stateWithAccounts()
				const next = stateInspectorReduce(state, "j")
				expect(next.selectedIndex).toBe(1)
			}),
		)

		it.effect("k moves selectedIndex up", () =>
			Effect.sync(() => {
				const state = stateWithAccounts({ selectedIndex: 1 })
				const next = stateInspectorReduce(state, "k")
				expect(next.selectedIndex).toBe(0)
			}),
		)

		it.effect("k clamps at 0", () =>
			Effect.sync(() => {
				const state = stateWithAccounts({ selectedIndex: 0 })
				const next = stateInspectorReduce(state, "k")
				expect(next.selectedIndex).toBe(0)
			}),
		)

		it.effect("j clamps at flatTree length - 1", () =>
			Effect.sync(() => {
				// 2 accounts collapsed = 2 rows total, max index = 1
				const state = stateWithAccounts({ selectedIndex: 1 })
				const next = stateInspectorReduce(state, "j")
				expect(next.selectedIndex).toBe(1)
			}),
		)
	})

	describe("expand/collapse with return and l/h", () => {
		it.effect("return on account row toggles expand", () =>
			Effect.sync(() => {
				const state = stateWithAccounts()
				// Account 0 at index 0
				const next = stateInspectorReduce(state, "return")
				expect(next.expandedAccounts.has(0)).toBe(true)
			}),
		)

		it.effect("return on expanded account collapses it", () =>
			Effect.sync(() => {
				const state = stateWithAccounts({
					expandedAccounts: new Set([0]),
				})
				const next = stateInspectorReduce(state, "return")
				expect(next.expandedAccounts.has(0)).toBe(false)
			}),
		)

		it.effect("l on account row expands it", () =>
			Effect.sync(() => {
				const state = stateWithAccounts()
				const next = stateInspectorReduce(state, "l")
				expect(next.expandedAccounts.has(0)).toBe(true)
			}),
		)

		it.effect("h on account row collapses it", () =>
			Effect.sync(() => {
				const state = stateWithAccounts({
					expandedAccounts: new Set([0]),
				})
				const next = stateInspectorReduce(state, "h")
				expect(next.expandedAccounts.has(0)).toBe(false)
			}),
		)

		it.effect("h on child row jumps to parent account and collapses", () =>
			Effect.sync(() => {
				// Expand account 0, navigate to its balance row (index 1)
				const state = stateWithAccounts({
					expandedAccounts: new Set([0]),
					selectedIndex: 1, // balance row of account 0
				})
				const next = stateInspectorReduce(state, "h")
				expect(next.selectedIndex).toBe(0) // jumped to parent
				expect(next.expandedAccounts.has(0)).toBe(false) // collapsed
			}),
		)

		it.effect("return on storageHeader toggles storage expansion", () =>
			Effect.sync(() => {
				// Account 1 has storage. Expand account 1 and navigate to storageHeader.
				// With account 0 collapsed and account 1 expanded:
				// Row 0: account 0
				// Row 1: account 1
				// Row 2: balance (account 1)
				// Row 3: nonce (account 1)
				// Row 4: code (account 1)
				// Row 5: storageHeader (account 1)
				const state = stateWithAccounts({
					expandedAccounts: new Set([1]),
					selectedIndex: 5, // storageHeader of account 1
				})
				const next = stateInspectorReduce(state, "return")
				expect(next.expandedStorage.has(1)).toBe(true)
			}),
		)
	})

	describe("buildFlatTree", () => {
		it.effect("collapsed accounts produce one row each", () =>
			Effect.sync(() => {
				const state = stateWithAccounts()
				const tree = buildFlatTree(state)
				expect(tree.length).toBe(2) // 2 collapsed accounts
				expect(tree[0]?.type).toBe("account")
				expect(tree[1]?.type).toBe("account")
			}),
		)

		it.effect("expanded account shows balance, nonce, code, storageHeader children", () =>
			Effect.sync(() => {
				const state = stateWithAccounts({
					expandedAccounts: new Set([0]),
				})
				const tree = buildFlatTree(state)
				// Row 0: account 0
				// Row 1: balance
				// Row 2: nonce
				// Row 3: code
				// Row 4: storageHeader
				// Row 5: account 1
				expect(tree.length).toBe(6)
				expect(tree[0]?.type).toBe("account")
				expect(tree[1]?.type).toBe("balance")
				expect(tree[2]?.type).toBe("nonce")
				expect(tree[3]?.type).toBe("code")
				expect(tree[4]?.type).toBe("storageHeader")
				expect(tree[5]?.type).toBe("account")
			}),
		)

		it.effect("expanded storage shows slot rows", () =>
			Effect.sync(() => {
				const state = stateWithAccounts({
					expandedAccounts: new Set([1]),
					expandedStorage: new Set([1]),
				})
				const tree = buildFlatTree(state)
				// Row 0: account 0
				// Row 1: account 1
				// Row 2: balance
				// Row 3: nonce
				// Row 4: code
				// Row 5: storageHeader
				// Row 6: storageSlot 0
				// Row 7: storageSlot 1
				expect(tree.length).toBe(8)
				expect(tree[6]?.type).toBe("storageSlot")
				expect(tree[7]?.type).toBe("storageSlot")
				expect(tree[6]?.slotIndex).toBe(0)
				expect(tree[7]?.slotIndex).toBe(1)
			}),
		)
	})

	describe("x key toggles hex/decimal", () => {
		it.effect("toggles showDecimal from false to true", () =>
			Effect.sync(() => {
				const state = stateWithAccounts()
				const next = stateInspectorReduce(state, "x")
				expect(next.showDecimal).toBe(true)
			}),
		)

		it.effect("toggles showDecimal from true to false", () =>
			Effect.sync(() => {
				const state = stateWithAccounts({ showDecimal: true })
				const next = stateInspectorReduce(state, "x")
				expect(next.showDecimal).toBe(false)
			}),
		)
	})

	describe("/ key activates search", () => {
		it.effect("activates searchActive", () =>
			Effect.sync(() => {
				const state = stateWithAccounts()
				const next = stateInspectorReduce(state, "/")
				expect(next.searchActive).toBe(true)
			}),
		)

		it.effect("search mode: typing appends to searchQuery", () =>
			Effect.sync(() => {
				const state = stateWithAccounts({ searchActive: true, searchQuery: "" })
				const next = stateInspectorReduce(state, "a")
				expect(next.searchQuery).toBe("a")
			}),
		)

		it.effect("search mode: backspace deletes from searchQuery", () =>
			Effect.sync(() => {
				const state = stateWithAccounts({ searchActive: true, searchQuery: "abc" })
				const next = stateInspectorReduce(state, "backspace")
				expect(next.searchQuery).toBe("ab")
			}),
		)

		it.effect("search mode: escape cancels search", () =>
			Effect.sync(() => {
				const state = stateWithAccounts({ searchActive: true, searchQuery: "abc" })
				const next = stateInspectorReduce(state, "escape")
				expect(next.searchActive).toBe(false)
				expect(next.searchQuery).toBe("")
			}),
		)

		it.effect("search mode: return confirms search", () =>
			Effect.sync(() => {
				const state = stateWithAccounts({ searchActive: true, searchQuery: "f39" })
				const next = stateInspectorReduce(state, "return")
				expect(next.searchActive).toBe(false)
				// searchQuery is kept for filtering
				expect(next.searchQuery).toBe("f39")
			}),
		)
	})

	describe("e key for editing", () => {
		it.effect("e key on storageSlot activates editActive", () =>
			Effect.sync(() => {
				// Set up state so selectedIndex points to a storageSlot row
				const state = stateWithAccounts({
					expandedAccounts: new Set([1]),
					expandedStorage: new Set([1]),
					selectedIndex: 6, // first storageSlot of account 1
				})
				const next = stateInspectorReduce(state, "e")
				expect(next.editActive).toBe(true)
				expect(next.editValue).toBe("")
			}),
		)

		it.effect("e key on non-storageSlot row does nothing", () =>
			Effect.sync(() => {
				const state = stateWithAccounts({ selectedIndex: 0 }) // account row
				const next = stateInspectorReduce(state, "e")
				expect(next.editActive).toBe(false)
			}),
		)

		it.effect("edit mode: typing hex chars appends to editValue", () =>
			Effect.sync(() => {
				const state = stateWithAccounts({ editActive: true, editValue: "0x" })
				const next = stateInspectorReduce(state, "a")
				expect(next.editValue).toBe("0xa")
			}),
		)

		it.effect("edit mode: backspace deletes from editValue", () =>
			Effect.sync(() => {
				const state = stateWithAccounts({ editActive: true, editValue: "0xab" })
				const next = stateInspectorReduce(state, "backspace")
				expect(next.editValue).toBe("0xa")
			}),
		)

		it.effect("edit mode: return confirms edit", () =>
			Effect.sync(() => {
				const state = stateWithAccounts({ editActive: true, editValue: "0xff" })
				const next = stateInspectorReduce(state, "return")
				expect(next.editActive).toBe(false)
				expect(next.editConfirmed).toBe(true)
			}),
		)

		it.effect("edit mode: escape cancels edit", () =>
			Effect.sync(() => {
				const state = stateWithAccounts({ editActive: true, editValue: "0xff" })
				const next = stateInspectorReduce(state, "escape")
				expect(next.editActive).toBe(false)
				expect(next.editValue).toBe("")
				expect(next.editConfirmed).toBe(false)
			}),
		)
	})
})
