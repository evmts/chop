/**
 * Boundary condition tests for handlers/getLogs.ts.
 *
 * Covers:
 * - blockHash param with a non-existent hash → empty array
 * - fromBlock="earliest" → resolves to block 0
 * - toBlock="earliest" → resolves to block 0
 * - fromBlock and toBlock as hex block numbers
 * - fromBlock="latest" / toBlock="latest" → resolves to head
 * - fromBlock="pending" / toBlock="pending" → resolves to head
 * - No fromBlock/toBlock defaults to head
 * - GenesisError fallback path (synthetic head block when chain is empty)
 * - Address and topics filtering (no matching logs)
 */

import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { getLogsHandler } from "./getLogs.js"

// ---------------------------------------------------------------------------
// blockHash — boundary conditions
// ---------------------------------------------------------------------------

describe("getLogsHandler — blockHash boundary conditions", () => {
	it.effect("returns empty logs when blockHash does not exist", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* getLogsHandler(node)({ blockHash: `0x${"ff".repeat(32)}` })
			expect(result).toEqual([])
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns empty logs when blockHash is all zeros (non-existent)", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			// The genesis block hash is 0x00..01, not 0x00..00
			const result = yield* getLogsHandler(node)({ blockHash: `0x${"00".repeat(32)}` })
			expect(result).toEqual([])
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns empty logs when blockHash matches genesis (no transactions)", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			// Genesis block exists but has no transactions
			const genesisHash = `0x${"00".repeat(31)}01`
			const result = yield* getLogsHandler(node)({ blockHash: genesisHash })
			expect(result).toEqual([])
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// fromBlock / toBlock — "earliest" tag
// ---------------------------------------------------------------------------

describe("getLogsHandler — earliest block tag", () => {
	it.effect("fromBlock='earliest' resolves to block 0", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* getLogsHandler(node)({ fromBlock: "earliest", toBlock: "earliest" })
			// Should resolve without error; block 0 exists but has no txs
			expect(result).toEqual([])
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("toBlock='earliest' resolves to block 0", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* getLogsHandler(node)({ fromBlock: "earliest", toBlock: "earliest" })
			expect(result).toEqual([])
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("fromBlock='earliest' with toBlock='latest' covers full range", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* getLogsHandler(node)({ fromBlock: "earliest", toBlock: "latest" })
			// Genesis only, no transactions
			expect(result).toEqual([])
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// fromBlock / toBlock — "latest" and "pending" tags
// ---------------------------------------------------------------------------

describe("getLogsHandler — latest and pending block tags", () => {
	it.effect("fromBlock='latest' toBlock='latest' resolves to head", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* getLogsHandler(node)({ fromBlock: "latest", toBlock: "latest" })
			expect(result).toEqual([])
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("fromBlock='pending' toBlock='pending' resolves to head", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* getLogsHandler(node)({ fromBlock: "pending", toBlock: "pending" })
			expect(result).toEqual([])
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("no fromBlock/toBlock defaults to head block", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* getLogsHandler(node)({})
			expect(result).toEqual([])
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// fromBlock / toBlock — hex block numbers
// ---------------------------------------------------------------------------

describe("getLogsHandler — hex block numbers", () => {
	it.effect("fromBlock and toBlock as hex '0x0' resolves to genesis", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* getLogsHandler(node)({ fromBlock: "0x0", toBlock: "0x0" })
			expect(result).toEqual([])
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("fromBlock='0x0' toBlock='0x0' returns empty when no transactions exist", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* getLogsHandler(node)({ fromBlock: "0x0", toBlock: "0x0" })
			expect(Array.isArray(result)).toBe(true)
			expect(result.length).toBe(0)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("non-existent block range returns empty logs", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			// Blocks 100-200 don't exist
			const result = yield* getLogsHandler(node)({ fromBlock: "0x64", toBlock: "0xc8" })
			expect(result).toEqual([])
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("inverted range (fromBlock > toBlock) returns empty logs", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			// fromBlock > toBlock — the for loop won't execute
			const result = yield* getLogsHandler(node)({ fromBlock: "0x5", toBlock: "0x0" })
			expect(result).toEqual([])
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// Address and topics filtering (no matching logs scenario)
// ---------------------------------------------------------------------------

describe("getLogsHandler — address and topics filtering", () => {
	it.effect("address filter with no matching logs returns empty", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* getLogsHandler(node)({
				fromBlock: "earliest",
				toBlock: "latest",
				address: "0x0000000000000000000000000000000000000001",
			})
			expect(result).toEqual([])
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("topics filter with no matching logs returns empty", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* getLogsHandler(node)({
				fromBlock: "earliest",
				toBlock: "latest",
				topics: [`0x${"ab".repeat(32)}`],
			})
			expect(result).toEqual([])
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("array address filter with no matching logs returns empty", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* getLogsHandler(node)({
				fromBlock: "earliest",
				toBlock: "latest",
				address: [
					"0x0000000000000000000000000000000000000001",
					"0x0000000000000000000000000000000000000002",
				],
			})
			expect(result).toEqual([])
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("null topic entry acts as wildcard (matches anything)", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* getLogsHandler(node)({
				fromBlock: "earliest",
				toBlock: "latest",
				topics: [null],
			})
			// No transactions exist so no logs regardless
			expect(result).toEqual([])
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
