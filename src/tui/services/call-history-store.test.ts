import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { type CallRecord, CallHistoryStore } from "./call-history-store.js"

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

describe("CallHistoryStore", () => {
	describe("initial state", () => {
		it.effect("starts empty", () =>
			Effect.sync(() => {
				const store = new CallHistoryStore()
				expect(store.getAll()).toEqual([])
				expect(store.count()).toBe(0)
			}),
		)
	})

	describe("add", () => {
		it.effect("adds a record and increments count", () =>
			Effect.sync(() => {
				const store = new CallHistoryStore()
				store.add(makeRecord({ id: 1 }))
				expect(store.count()).toBe(1)
				expect(store.getAll()[0]?.id).toBe(1)
			}),
		)

		it.effect("adds multiple records", () =>
			Effect.sync(() => {
				const store = new CallHistoryStore()
				store.add(makeRecord({ id: 1 }))
				store.add(makeRecord({ id: 2 }))
				store.add(makeRecord({ id: 3 }))
				expect(store.count()).toBe(3)
			}),
		)

		it.effect("returns records in insertion order", () =>
			Effect.sync(() => {
				const store = new CallHistoryStore()
				store.add(makeRecord({ id: 1 }))
				store.add(makeRecord({ id: 2 }))
				store.add(makeRecord({ id: 3 }))
				const all = store.getAll()
				expect(all[0]?.id).toBe(1)
				expect(all[1]?.id).toBe(2)
				expect(all[2]?.id).toBe(3)
			}),
		)
	})

	describe("getById", () => {
		it.effect("returns record by id", () =>
			Effect.sync(() => {
				const store = new CallHistoryStore()
				store.add(makeRecord({ id: 42, type: "CREATE" }))
				const found = store.getById(42)
				expect(found?.type).toBe("CREATE")
			}),
		)

		it.effect("returns undefined for missing id", () =>
			Effect.sync(() => {
				const store = new CallHistoryStore()
				expect(store.getById(999)).toBeUndefined()
			}),
		)
	})

	describe("filter", () => {
		it.effect("filters by call type (case-insensitive)", () =>
			Effect.sync(() => {
				const store = new CallHistoryStore()
				store.add(makeRecord({ id: 1, type: "CALL" }))
				store.add(makeRecord({ id: 2, type: "CREATE" }))
				store.add(makeRecord({ id: 3, type: "STATICCALL" }))
				const results = store.filter("create")
				expect(results.length).toBe(1)
				expect(results[0]?.type).toBe("CREATE")
			}),
		)

		it.effect("filters by from address", () =>
			Effect.sync(() => {
				const store = new CallHistoryStore()
				store.add(makeRecord({ id: 1, from: "0xAAAA" }))
				store.add(makeRecord({ id: 2, from: "0xBBBB" }))
				const results = store.filter("aaaa")
				expect(results.length).toBe(1)
				expect(results[0]?.from).toBe("0xAAAA")
			}),
		)

		it.effect("filters by to address", () =>
			Effect.sync(() => {
				const store = new CallHistoryStore()
				store.add(makeRecord({ id: 1, to: "0x1234abcd" }))
				store.add(makeRecord({ id: 2, to: "0xdeadbeef" }))
				const results = store.filter("dead")
				expect(results.length).toBe(1)
				expect(results[0]?.to).toBe("0xdeadbeef")
			}),
		)

		it.effect("filters by tx hash", () =>
			Effect.sync(() => {
				const store = new CallHistoryStore()
				store.add(makeRecord({ id: 1, txHash: "0xabc123" }))
				store.add(makeRecord({ id: 2, txHash: "0xdef456" }))
				const results = store.filter("abc123")
				expect(results.length).toBe(1)
			}),
		)

		it.effect("filters by status (success text)", () =>
			Effect.sync(() => {
				const store = new CallHistoryStore()
				store.add(makeRecord({ id: 1, success: true }))
				store.add(makeRecord({ id: 2, success: false }))
				const results = store.filter("fail")
				expect(results.length).toBe(1)
				expect(results[0]?.success).toBe(false)
			}),
		)

		it.effect("empty query returns all records", () =>
			Effect.sync(() => {
				const store = new CallHistoryStore()
				store.add(makeRecord({ id: 1 }))
				store.add(makeRecord({ id: 2 }))
				const results = store.filter("")
				expect(results.length).toBe(2)
			}),
		)
	})

	describe("clear", () => {
		it.effect("removes all records", () =>
			Effect.sync(() => {
				const store = new CallHistoryStore()
				store.add(makeRecord({ id: 1 }))
				store.add(makeRecord({ id: 2 }))
				store.clear()
				expect(store.count()).toBe(0)
				expect(store.getAll()).toEqual([])
			}),
		)
	})

	describe("addAll", () => {
		it.effect("adds multiple records at once", () =>
			Effect.sync(() => {
				const store = new CallHistoryStore()
				store.addAll([makeRecord({ id: 1 }), makeRecord({ id: 2 }), makeRecord({ id: 3 })])
				expect(store.count()).toBe(3)
			}),
		)
	})

	describe("call types", () => {
		it.effect("supports all EVM call types", () =>
			Effect.sync(() => {
				const store = new CallHistoryStore()
				const types = ["CALL", "CREATE", "STATICCALL", "DELEGATECALL", "CREATE2"] as const
				for (const type of types) {
					store.add(makeRecord({ id: store.count() + 1, type }))
				}
				expect(store.count()).toBe(5)
			}),
		)

		it.effect("substring filter: STATICCALL matches only STATICCALL", () =>
			Effect.sync(() => {
				const store = new CallHistoryStore()
				store.add(makeRecord({ id: 1, type: "CALL" }))
				store.add(makeRecord({ id: 2, type: "STATICCALL" }))
				store.add(makeRecord({ id: 3, type: "DELEGATECALL" }))
				const results = store.filter("STATICCALL")
				expect(results.length).toBe(1)
				expect(results[0]?.type).toBe("STATICCALL")
			}),
		)

		it.effect("substring filter: CALL matches CALL, STATICCALL, DELEGATECALL", () =>
			Effect.sync(() => {
				const store = new CallHistoryStore()
				store.add(makeRecord({ id: 1, type: "CALL" }))
				store.add(makeRecord({ id: 2, type: "CREATE" }))
				store.add(makeRecord({ id: 3, type: "STATICCALL" }))
				store.add(makeRecord({ id: 4, type: "DELEGATECALL" }))
				const results = store.filter("CALL")
				expect(results.length).toBe(3) // CALL, STATICCALL, DELEGATECALL
			}),
		)

		it.effect("substring filter: CREATE matches CREATE and CREATE2", () =>
			Effect.sync(() => {
				const store = new CallHistoryStore()
				store.add(makeRecord({ id: 1, type: "CREATE" }))
				store.add(makeRecord({ id: 2, type: "CREATE2" }))
				store.add(makeRecord({ id: 3, type: "CALL" }))
				const results = store.filter("CREATE")
				expect(results.length).toBe(2)
			}),
		)
	})
})
