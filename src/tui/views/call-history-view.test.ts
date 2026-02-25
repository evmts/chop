import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { type CallRecord, filterCallRecords } from "../services/call-history-store.js"
import { keyToAction } from "../state.js"
import { type CallHistoryViewState, callHistoryReduce, initialCallHistoryState } from "./CallHistory.js"

/** Helper to create a minimal CallRecord. */
const makeRecord = (overrides: Partial<CallRecord> = {}): CallRecord => ({
	id: 1,
	type: "CALL",
	from: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
	to: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
	value: 0n,
	gasUsed: 21000n,
	gasLimit: 21000n,
	success: true,
	calldata: "0x",
	returnData: "0x",
	blockNumber: 1n,
	timestamp: BigInt(Math.floor(Date.now() / 1000)),
	txHash: `0x${"ab".repeat(32)}`,
	logs: [],
	...overrides,
})

/** Create state with a given number of records. */
const stateWithRecords = (count: number, overrides: Partial<CallHistoryViewState> = {}): CallHistoryViewState => ({
	...initialCallHistoryState,
	records: Array.from({ length: count }, (_, i) => makeRecord({ id: i + 1 })),
	...overrides,
})

describe("CallHistory view reducer", () => {
	describe("initialState", () => {
		it.effect("starts in list mode with no selection", () =>
			Effect.sync(() => {
				expect(initialCallHistoryState.selectedIndex).toBe(0)
				expect(initialCallHistoryState.viewMode).toBe("list")
				expect(initialCallHistoryState.filterQuery).toBe("")
				expect(initialCallHistoryState.filterActive).toBe(false)
				expect(initialCallHistoryState.records).toEqual([])
			}),
		)
	})

	describe("j/k navigation", () => {
		it.effect("j moves selection down", () =>
			Effect.sync(() => {
				const state = stateWithRecords(5)
				const next = callHistoryReduce(state, "j")
				expect(next.selectedIndex).toBe(1)
			}),
		)

		it.effect("k moves selection up", () =>
			Effect.sync(() => {
				const state = stateWithRecords(5, { selectedIndex: 3 })
				const next = callHistoryReduce(state, "k")
				expect(next.selectedIndex).toBe(2)
			}),
		)

		it.effect("j clamps at last record", () =>
			Effect.sync(() => {
				const state = stateWithRecords(3, { selectedIndex: 2 })
				const next = callHistoryReduce(state, "j")
				expect(next.selectedIndex).toBe(2)
			}),
		)

		it.effect("k clamps at first record", () =>
			Effect.sync(() => {
				const state = stateWithRecords(3, { selectedIndex: 0 })
				const next = callHistoryReduce(state, "k")
				expect(next.selectedIndex).toBe(0)
			}),
		)

		it.effect("j does nothing with empty records", () =>
			Effect.sync(() => {
				const next = callHistoryReduce(initialCallHistoryState, "j")
				expect(next.selectedIndex).toBe(0)
			}),
		)
	})

	describe("Enter → detail view", () => {
		it.effect("enter switches to detail mode", () =>
			Effect.sync(() => {
				const state = stateWithRecords(3, { selectedIndex: 1 })
				const next = callHistoryReduce(state, "return")
				expect(next.viewMode).toBe("detail")
			}),
		)

		it.effect("enter preserves selectedIndex", () =>
			Effect.sync(() => {
				const state = stateWithRecords(5, { selectedIndex: 2 })
				const next = callHistoryReduce(state, "return")
				expect(next.selectedIndex).toBe(2)
			}),
		)

		it.effect("enter does nothing with empty records", () =>
			Effect.sync(() => {
				const next = callHistoryReduce(initialCallHistoryState, "return")
				expect(next.viewMode).toBe("list")
			}),
		)
	})

	describe("Escape → back to list", () => {
		it.effect("escape returns to list mode from detail", () =>
			Effect.sync(() => {
				const state = stateWithRecords(3, { viewMode: "detail", selectedIndex: 1 })
				const next = callHistoryReduce(state, "escape")
				expect(next.viewMode).toBe("list")
			}),
		)

		it.effect("escape clears filter when in filter mode", () =>
			Effect.sync(() => {
				const state = stateWithRecords(3, { filterActive: true, filterQuery: "abc" })
				const next = callHistoryReduce(state, "escape")
				expect(next.filterActive).toBe(false)
				expect(next.filterQuery).toBe("")
			}),
		)

		it.effect("escape does nothing in list mode with no filter", () =>
			Effect.sync(() => {
				const state = stateWithRecords(3)
				const next = callHistoryReduce(state, "escape")
				expect(next.viewMode).toBe("list")
				expect(next.filterActive).toBe(false)
			}),
		)
	})

	describe("/ → filter mode", () => {
		it.effect("/ activates filter mode", () =>
			Effect.sync(() => {
				const state = stateWithRecords(3)
				const next = callHistoryReduce(state, "/")
				expect(next.filterActive).toBe(true)
			}),
		)

		it.effect("/ does nothing in detail mode", () =>
			Effect.sync(() => {
				const state = stateWithRecords(3, { viewMode: "detail" })
				const next = callHistoryReduce(state, "/")
				expect(next.filterActive).toBe(false)
			}),
		)
	})

	describe("filter input", () => {
		it.effect("typing appends to filter query", () =>
			Effect.sync(() => {
				const state = stateWithRecords(3, { filterActive: true, filterQuery: "ab" })
				const next = callHistoryReduce(state, "c")
				expect(next.filterQuery).toBe("abc")
			}),
		)

		it.effect("backspace removes last character", () =>
			Effect.sync(() => {
				const state = stateWithRecords(3, { filterActive: true, filterQuery: "abc" })
				const next = callHistoryReduce(state, "backspace")
				expect(next.filterQuery).toBe("ab")
			}),
		)

		it.effect("backspace on empty filter does nothing", () =>
			Effect.sync(() => {
				const state = stateWithRecords(3, { filterActive: true, filterQuery: "" })
				const next = callHistoryReduce(state, "backspace")
				expect(next.filterQuery).toBe("")
			}),
		)

		it.effect("return in filter mode deactivates filter (keeps query)", () =>
			Effect.sync(() => {
				const state = stateWithRecords(3, { filterActive: true, filterQuery: "test" })
				const next = callHistoryReduce(state, "return")
				expect(next.filterActive).toBe(false)
				expect(next.filterQuery).toBe("test")
			}),
		)

		it.effect("resets selectedIndex when filter query changes", () =>
			Effect.sync(() => {
				const state = stateWithRecords(5, { filterActive: true, filterQuery: "ab", selectedIndex: 3 })
				const next = callHistoryReduce(state, "c")
				expect(next.selectedIndex).toBe(0)
			}),
		)
	})

	describe("selected record", () => {
		it.effect("detail view shows calldata of selected record", () =>
			Effect.sync(() => {
				const records = [
					makeRecord({ id: 1, calldata: "0xaaa" }),
					makeRecord({ id: 2, calldata: "0xbbb" }),
					makeRecord({ id: 3, calldata: "0xccc" }),
				]
				const state: CallHistoryViewState = {
					...initialCallHistoryState,
					records,
					selectedIndex: 1,
					viewMode: "detail",
				}
				// The selected record should be records[1]
				const selectedRecord = state.records[state.selectedIndex]
				expect(selectedRecord?.calldata).toBe("0xbbb")
			}),
		)
	})

	describe("filter + key routing integration", () => {
		it.effect("keyToAction with inputMode forwards typed chars to the view reducer", () =>
			Effect.sync(() => {
				// Simulate: user activates filter, then types "cr"
				let state = stateWithRecords(3, {
					records: [
						makeRecord({ id: 1, type: "CALL" }),
						makeRecord({ id: 2, type: "CREATE" }),
						makeRecord({ id: 3, type: "STATICCALL" }),
					],
				})

				// Press "/" to activate filter — this key is in VIEW_KEYS
				const slashAction = keyToAction("/")
				expect(slashAction).toEqual({ _tag: "ViewKey", key: "/" })
				state = callHistoryReduce(state, "/")
				expect(state.filterActive).toBe(true)

				// Now in input mode — "c" would normally be unmapped, but inputMode forwards it
				const cAction = keyToAction("c", state.filterActive)
				expect(cAction).toEqual({ _tag: "ViewKey", key: "c" })
				state = callHistoryReduce(state, "c")
				expect(state.filterQuery).toBe("c")

				// "r" also forwarded
				const rAction = keyToAction("r", state.filterActive)
				expect(rAction).toEqual({ _tag: "ViewKey", key: "r" })
				state = callHistoryReduce(state, "r")
				expect(state.filterQuery).toBe("cr")

				// Verify filter actually applies to records
				const filtered = filterCallRecords(state.records, state.filterQuery)
				expect(filtered.length).toBe(1)
				expect(filtered[0]?.type).toBe("CREATE")
			}),
		)

		it.effect("pressing 'q' during filter mode does NOT quit (inputMode passthrough)", () =>
			Effect.sync(() => {
				const state: CallHistoryViewState = {
					...initialCallHistoryState,
					records: [makeRecord({ id: 1 })],
					filterActive: true,
					filterQuery: "",
				}

				// With inputMode=true, 'q' becomes ViewKey, not Quit
				const action = keyToAction("q", state.filterActive)
				expect(action?._tag).toBe("ViewKey")

				// Reducer appends 'q' to filter
				const next = callHistoryReduce(state, "q")
				expect(next.filterQuery).toBe("q")
				expect(next.filterActive).toBe(true)
			}),
		)

		it.effect("backspace during filter mode removes last char (inputMode passthrough)", () =>
			Effect.sync(() => {
				const state: CallHistoryViewState = {
					...initialCallHistoryState,
					records: [makeRecord({ id: 1 })],
					filterActive: true,
					filterQuery: "abc",
				}

				// With inputMode=true, 'backspace' is forwarded
				const action = keyToAction("backspace", state.filterActive)
				expect(action).toEqual({ _tag: "ViewKey", key: "backspace" })

				const next = callHistoryReduce(state, "backspace")
				expect(next.filterQuery).toBe("ab")
			}),
		)
	})
})
