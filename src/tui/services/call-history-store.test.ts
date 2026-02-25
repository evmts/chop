import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { type CallRecord, filterCallRecords } from "./call-history-store.js"

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

describe("filterCallRecords", () => {
	it.effect("empty query returns all records", () =>
		Effect.sync(() => {
			const records = [makeRecord({ id: 1 }), makeRecord({ id: 2 })]
			const results = filterCallRecords(records, "")
			expect(results.length).toBe(2)
		}),
	)

	it.effect("filters by call type (case-insensitive)", () =>
		Effect.sync(() => {
			const records = [
				makeRecord({ id: 1, type: "CALL" }),
				makeRecord({ id: 2, type: "CREATE" }),
				makeRecord({ id: 3, type: "STATICCALL" }),
			]
			const results = filterCallRecords(records, "create")
			expect(results.length).toBe(1)
			expect(results[0]?.type).toBe("CREATE")
		}),
	)

	it.effect("filters by from address", () =>
		Effect.sync(() => {
			const records = [makeRecord({ id: 1, from: "0xAAAA" }), makeRecord({ id: 2, from: "0xBBBB" })]
			const results = filterCallRecords(records, "aaaa")
			expect(results.length).toBe(1)
			expect(results[0]?.from).toBe("0xAAAA")
		}),
	)

	it.effect("filters by to address", () =>
		Effect.sync(() => {
			const records = [makeRecord({ id: 1, to: "0x1234abcd" }), makeRecord({ id: 2, to: "0xdeadbeef" })]
			const results = filterCallRecords(records, "dead")
			expect(results.length).toBe(1)
			expect(results[0]?.to).toBe("0xdeadbeef")
		}),
	)

	it.effect("filters by tx hash", () =>
		Effect.sync(() => {
			const records = [makeRecord({ id: 1, txHash: "0xabc123" }), makeRecord({ id: 2, txHash: "0xdef456" })]
			const results = filterCallRecords(records, "abc123")
			expect(results.length).toBe(1)
		}),
	)

	it.effect("filters by status (success text)", () =>
		Effect.sync(() => {
			const records = [makeRecord({ id: 1, success: true }), makeRecord({ id: 2, success: false })]
			const results = filterCallRecords(records, "fail")
			expect(results.length).toBe(1)
			expect(results[0]?.success).toBe(false)
		}),
	)

	it.effect("STATICCALL matches only STATICCALL", () =>
		Effect.sync(() => {
			const records = [
				makeRecord({ id: 1, type: "CALL" }),
				makeRecord({ id: 2, type: "STATICCALL" }),
				makeRecord({ id: 3, type: "DELEGATECALL" }),
			]
			const results = filterCallRecords(records, "STATICCALL")
			expect(results.length).toBe(1)
			expect(results[0]?.type).toBe("STATICCALL")
		}),
	)

	it.effect("CALL matches CALL, STATICCALL, DELEGATECALL", () =>
		Effect.sync(() => {
			const records = [
				makeRecord({ id: 1, type: "CALL" }),
				makeRecord({ id: 2, type: "CREATE" }),
				makeRecord({ id: 3, type: "STATICCALL" }),
				makeRecord({ id: 4, type: "DELEGATECALL" }),
			]
			const results = filterCallRecords(records, "CALL")
			expect(results.length).toBe(3) // CALL, STATICCALL, DELEGATECALL
		}),
	)

	it.effect("CREATE matches CREATE and CREATE2", () =>
		Effect.sync(() => {
			const records = [
				makeRecord({ id: 1, type: "CREATE" }),
				makeRecord({ id: 2, type: "CREATE2" }),
				makeRecord({ id: 3, type: "CALL" }),
			]
			const results = filterCallRecords(records, "CREATE")
			expect(results.length).toBe(2)
		}),
	)
})
