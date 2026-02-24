import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { keyToAction } from "../state.js"
import { type TransactionsViewState, initialTransactionsState, transactionsReduce } from "./Transactions.js"
import { type TransactionDetail, filterTransactions } from "./transactions-data.js"

/** Helper to create a minimal TransactionDetail. */
const makeTx = (overrides: Partial<TransactionDetail> = {}): TransactionDetail => ({
	hash: `0x${"ab".repeat(32)}`,
	blockNumber: 1n,
	blockHash: `0x${"ff".repeat(32)}`,
	from: `0x${"11".repeat(20)}`,
	to: `0x${"22".repeat(20)}`,
	value: 0n,
	gasPrice: 1_000_000_000n,
	gasUsed: 21000n,
	gas: 21000n,
	status: 1,
	type: 0,
	nonce: 0n,
	data: "0x",
	logs: [],
	contractAddress: null,
	...overrides,
})

/** Create state with a given number of transactions. */
const stateWithTxs = (count: number, overrides: Partial<TransactionsViewState> = {}): TransactionsViewState => ({
	...initialTransactionsState,
	transactions: Array.from({ length: count }, (_, i) =>
		makeTx({
			hash: `0x${String(i + 1)
				.padStart(2, "0")
				.repeat(32)}`,
		}),
	),
	...overrides,
})

describe("Transactions view reducer", () => {
	describe("initialState", () => {
		it.effect("starts in list mode with no selection", () =>
			Effect.sync(() => {
				expect(initialTransactionsState.selectedIndex).toBe(0)
				expect(initialTransactionsState.viewMode).toBe("list")
				expect(initialTransactionsState.filterQuery).toBe("")
				expect(initialTransactionsState.filterActive).toBe(false)
				expect(initialTransactionsState.transactions).toEqual([])
			}),
		)
	})

	describe("j/k navigation", () => {
		it.effect("j moves selection down", () =>
			Effect.sync(() => {
				const state = stateWithTxs(5)
				const next = transactionsReduce(state, "j")
				expect(next.selectedIndex).toBe(1)
			}),
		)

		it.effect("k moves selection up", () =>
			Effect.sync(() => {
				const state = stateWithTxs(5, { selectedIndex: 3 })
				const next = transactionsReduce(state, "k")
				expect(next.selectedIndex).toBe(2)
			}),
		)

		it.effect("j clamps at last record", () =>
			Effect.sync(() => {
				const state = stateWithTxs(3, { selectedIndex: 2 })
				const next = transactionsReduce(state, "j")
				expect(next.selectedIndex).toBe(2)
			}),
		)

		it.effect("k clamps at first record", () =>
			Effect.sync(() => {
				const state = stateWithTxs(3, { selectedIndex: 0 })
				const next = transactionsReduce(state, "k")
				expect(next.selectedIndex).toBe(0)
			}),
		)

		it.effect("j does nothing with empty transactions", () =>
			Effect.sync(() => {
				const next = transactionsReduce(initialTransactionsState, "j")
				expect(next.selectedIndex).toBe(0)
			}),
		)
	})

	describe("Enter → detail view", () => {
		it.effect("enter switches to detail mode", () =>
			Effect.sync(() => {
				const state = stateWithTxs(3, { selectedIndex: 1 })
				const next = transactionsReduce(state, "return")
				expect(next.viewMode).toBe("detail")
			}),
		)

		it.effect("enter preserves selectedIndex", () =>
			Effect.sync(() => {
				const state = stateWithTxs(5, { selectedIndex: 2 })
				const next = transactionsReduce(state, "return")
				expect(next.selectedIndex).toBe(2)
			}),
		)

		it.effect("enter does nothing with empty transactions", () =>
			Effect.sync(() => {
				const next = transactionsReduce(initialTransactionsState, "return")
				expect(next.viewMode).toBe("list")
			}),
		)
	})

	describe("Escape → back to list", () => {
		it.effect("escape returns to list mode from detail", () =>
			Effect.sync(() => {
				const state = stateWithTxs(3, { viewMode: "detail", selectedIndex: 1 })
				const next = transactionsReduce(state, "escape")
				expect(next.viewMode).toBe("list")
			}),
		)

		it.effect("escape clears filter when in filter mode", () =>
			Effect.sync(() => {
				const state = stateWithTxs(3, { filterActive: true, filterQuery: "abc" })
				const next = transactionsReduce(state, "escape")
				expect(next.filterActive).toBe(false)
				expect(next.filterQuery).toBe("")
			}),
		)

		it.effect("escape does nothing in list mode with no filter", () =>
			Effect.sync(() => {
				const state = stateWithTxs(3)
				const next = transactionsReduce(state, "escape")
				expect(next.viewMode).toBe("list")
				expect(next.filterActive).toBe(false)
			}),
		)
	})

	describe("/ → filter mode", () => {
		it.effect("/ activates filter mode", () =>
			Effect.sync(() => {
				const state = stateWithTxs(3)
				const next = transactionsReduce(state, "/")
				expect(next.filterActive).toBe(true)
			}),
		)

		it.effect("/ does nothing in detail mode", () =>
			Effect.sync(() => {
				const state = stateWithTxs(3, { viewMode: "detail" })
				const next = transactionsReduce(state, "/")
				expect(next.filterActive).toBe(false)
			}),
		)
	})

	describe("filter input", () => {
		it.effect("typing appends to filter query", () =>
			Effect.sync(() => {
				const state = stateWithTxs(3, { filterActive: true, filterQuery: "ab" })
				const next = transactionsReduce(state, "c")
				expect(next.filterQuery).toBe("abc")
			}),
		)

		it.effect("backspace removes last character", () =>
			Effect.sync(() => {
				const state = stateWithTxs(3, { filterActive: true, filterQuery: "abc" })
				const next = transactionsReduce(state, "backspace")
				expect(next.filterQuery).toBe("ab")
			}),
		)

		it.effect("backspace on empty filter does nothing", () =>
			Effect.sync(() => {
				const state = stateWithTxs(3, { filterActive: true, filterQuery: "" })
				const next = transactionsReduce(state, "backspace")
				expect(next.filterQuery).toBe("")
			}),
		)

		it.effect("return in filter mode deactivates filter (keeps query)", () =>
			Effect.sync(() => {
				const state = stateWithTxs(3, { filterActive: true, filterQuery: "test" })
				const next = transactionsReduce(state, "return")
				expect(next.filterActive).toBe(false)
				expect(next.filterQuery).toBe("test")
			}),
		)

		it.effect("resets selectedIndex when filter query changes", () =>
			Effect.sync(() => {
				const state = stateWithTxs(5, { filterActive: true, filterQuery: "ab", selectedIndex: 3 })
				const next = transactionsReduce(state, "c")
				expect(next.selectedIndex).toBe(0)
			}),
		)
	})

	describe("selected record", () => {
		it.effect("detail view shows calldata of selected transaction", () =>
			Effect.sync(() => {
				const transactions = [makeTx({ data: "0xaaa" }), makeTx({ data: "0xbbb" }), makeTx({ data: "0xccc" })]
				const state: TransactionsViewState = {
					...initialTransactionsState,
					transactions,
					selectedIndex: 1,
					viewMode: "detail",
				}
				const selectedTx = state.transactions[state.selectedIndex]
				expect(selectedTx?.data).toBe("0xbbb")
			}),
		)
	})

	describe("filter + key routing integration", () => {
		it.effect("keyToAction with inputMode forwards typed chars to the view reducer", () =>
			Effect.sync(() => {
				let state = stateWithTxs(3, {
					transactions: [makeTx({ type: 0 }), makeTx({ type: 2 }), makeTx({ type: 0 })],
				})

				// Press "/" to activate filter
				const slashAction = keyToAction("/")
				expect(slashAction).toEqual({ _tag: "ViewKey", key: "/" })
				state = transactionsReduce(state, "/")
				expect(state.filterActive).toBe(true)

				// Now in input mode — "l" forwarded
				const lAction = keyToAction("l", state.filterActive)
				expect(lAction).toEqual({ _tag: "ViewKey", key: "l" })
				state = transactionsReduce(state, "l")
				expect(state.filterQuery).toBe("l")

				// "e" also forwarded
				state = transactionsReduce(state, "e")
				expect(state.filterQuery).toBe("le")
			}),
		)

		it.effect("pressing 'q' during filter mode does NOT quit (inputMode passthrough)", () =>
			Effect.sync(() => {
				const state: TransactionsViewState = {
					...initialTransactionsState,
					transactions: [makeTx()],
					filterActive: true,
					filterQuery: "",
				}

				const action = keyToAction("q", state.filterActive)
				expect(action?._tag).toBe("ViewKey")

				const next = transactionsReduce(state, "q")
				expect(next.filterQuery).toBe("q")
				expect(next.filterActive).toBe(true)
			}),
		)

		it.effect("backspace during filter mode removes last char (inputMode passthrough)", () =>
			Effect.sync(() => {
				const state: TransactionsViewState = {
					...initialTransactionsState,
					transactions: [makeTx()],
					filterActive: true,
					filterQuery: "abc",
				}

				const action = keyToAction("backspace", state.filterActive)
				expect(action).toEqual({ _tag: "ViewKey", key: "backspace" })

				const next = transactionsReduce(state, "backspace")
				expect(next.filterQuery).toBe("ab")
			}),
		)
	})

	describe("filter + records interaction", () => {
		it.effect("filterTransactions applied correctly with query", () =>
			Effect.sync(() => {
				const txs = [
					makeTx({ type: 0 }), // Legacy
					makeTx({ type: 2 }), // EIP-1559
					makeTx({ type: 0 }), // Legacy
				]
				const filtered = filterTransactions(txs, "legacy")
				expect(filtered.length).toBe(2)
			}),
		)

		it.effect("filterTransactions by status", () =>
			Effect.sync(() => {
				const txs = [makeTx({ status: 1 }), makeTx({ status: 0 }), makeTx({ status: 1 })]
				const filtered = filterTransactions(txs, "fail")
				expect(filtered.length).toBe(1)
			}),
		)
	})
})
