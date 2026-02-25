import { describe, expect, it } from "vitest"
import { makeFilterManager } from "./filter-manager.js"

describe("FilterManager", () => {
	it("newFilter creates a log filter and returns hex ID", () => {
		const fm = makeFilterManager()
		const id = fm.newFilter({ fromBlock: 0n, toBlock: 10n }, 5n)
		expect(id).toBe("0x1")
		const filter = fm.getFilter(id)
		expect(filter).toBeDefined()
		expect(filter?.type).toBe("log")
		expect(filter?.criteria?.fromBlock).toBe(0n)
		expect(filter?.lastPolledBlock).toBe(5n)
	})

	it("newBlockFilter creates a block filter", () => {
		const fm = makeFilterManager()
		const id = fm.newBlockFilter(10n)
		expect(id).toBe("0x1")
		const filter = fm.getFilter(id)
		expect(filter).toBeDefined()
		expect(filter?.type).toBe("block")
		expect(filter?.lastPolledBlock).toBe(10n)
	})

	it("newPendingTransactionFilter creates a pending tx filter", () => {
		const fm = makeFilterManager()
		const id = fm.newPendingTransactionFilter(0n)
		expect(id).toBe("0x1")
		const filter = fm.getFilter(id)
		expect(filter).toBeDefined()
		expect(filter?.type).toBe("pendingTransaction")
	})

	it("allocates monotonically increasing IDs", () => {
		const fm = makeFilterManager()
		const id1 = fm.newBlockFilter(0n)
		const id2 = fm.newBlockFilter(0n)
		const id3 = fm.newBlockFilter(0n)
		expect(id1).toBe("0x1")
		expect(id2).toBe("0x2")
		expect(id3).toBe("0x3")
	})

	it("removeFilter deletes a filter", () => {
		const fm = makeFilterManager()
		const id = fm.newBlockFilter(0n)
		expect(fm.removeFilter(id)).toBe(true)
		expect(fm.getFilter(id)).toBeUndefined()
	})

	it("removeFilter returns false for non-existent filter", () => {
		const fm = makeFilterManager()
		expect(fm.removeFilter("0x99")).toBe(false)
	})

	it("getFilter returns undefined for non-existent filter", () => {
		const fm = makeFilterManager()
		expect(fm.getFilter("0x42")).toBeUndefined()
	})

	it("updateLastPolled updates the block number", () => {
		const fm = makeFilterManager()
		const id = fm.newBlockFilter(0n)
		fm.updateLastPolled(id, 100n)
		expect(fm.getFilter(id)?.lastPolledBlock).toBe(100n)
	})

	it("updateLastPolled is no-op for non-existent filter", () => {
		const fm = makeFilterManager()
		// Should not throw
		fm.updateLastPolled("0x99", 100n)
	})
})
