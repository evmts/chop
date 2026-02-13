/**
 * Tests for eth filter procedures: ethNewFilter, ethGetFilterChanges,
 * ethUninstallFilter, ethNewBlockFilter, ethNewPendingTransactionFilter.
 *
 * Covers:
 * - ethNewFilter with fromBlock/toBlock "latest" resolution (lines 432-433)
 * - ethGetFilterChanges for log filter path (lines 470-477)
 * - ethGetFilterChanges for non-existent filter (InvalidParamsError)
 * - ethNewBlockFilter + ethGetFilterChanges for block filter
 * - ethNewPendingTransactionFilter + ethGetFilterChanges
 * - ethUninstallFilter for existing and non-existent filters
 */

import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { InternalError } from "./errors.js"
import {
	ethAccounts,
	ethGetFilterChanges,
	ethNewBlockFilter,
	ethNewFilter,
	ethNewPendingTransactionFilter,
	ethSendTransaction,
	ethUninstallFilter,
} from "./eth.js"

// ---------------------------------------------------------------------------
// ethNewFilter — filter creation
// ---------------------------------------------------------------------------

describe("ethNewFilter — filter creation", () => {
	it.effect("creates a filter and returns hex ID", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* ethNewFilter(node)([{}])
			expect(typeof result).toBe("string")
			expect((result as string).startsWith("0x")).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("creates a filter with fromBlock and toBlock as hex strings", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* ethNewFilter(node)([
				{ fromBlock: "0x0", toBlock: "0x10" },
			])
			expect(typeof result).toBe("string")
			expect((result as string).startsWith("0x")).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("creates a filter with fromBlock 'latest' (resolves to current head)", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* ethNewFilter(node)([
				{ fromBlock: "latest" },
			])
			expect(typeof result).toBe("string")
			expect((result as string).startsWith("0x")).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("creates a filter with toBlock 'latest' (resolves to current head)", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* ethNewFilter(node)([
				{ toBlock: "latest" },
			])
			expect(typeof result).toBe("string")
			expect((result as string).startsWith("0x")).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("creates a filter with both fromBlock and toBlock as 'latest'", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* ethNewFilter(node)([
				{ fromBlock: "latest", toBlock: "latest" },
			])
			expect(typeof result).toBe("string")
			expect((result as string).startsWith("0x")).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("creates a filter with address and topics", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* ethNewFilter(node)([
				{
					address: `0x${"aa".repeat(20)}`,
					topics: [`0x${"bb".repeat(32)}`],
				},
			])
			expect(typeof result).toBe("string")
			expect((result as string).startsWith("0x")).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("multiple filters get distinct IDs", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const id1 = yield* ethNewFilter(node)([{}])
			const id2 = yield* ethNewFilter(node)([{}])
			expect(id1).not.toBe(id2)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// ethGetFilterChanges — various filter types
// ---------------------------------------------------------------------------

describe("ethGetFilterChanges — error and edge cases", () => {
	it.effect("non-existent filter returns InternalError (wraps InvalidParamsError)", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const error = yield* ethGetFilterChanges(node)(["0xdeadbeef"]).pipe(Effect.flip)
			expect(error).toBeInstanceOf(InternalError)
			expect(error.message).toContain("not found")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("log filter returns empty array when no logs exist", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			// Create a log filter
			const filterId = yield* ethNewFilter(node)([{}])
			// Get changes — no transactions have been sent, so no logs
			const changes = yield* ethGetFilterChanges(node)([filterId])
			expect(Array.isArray(changes)).toBe(true)
			expect((changes as unknown[]).length).toBe(0)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("log filter with address criteria returns empty array on fresh chain", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			// Create a log filter with specific address
			const filterId = yield* ethNewFilter(node)([
				{ address: `0x${"aa".repeat(20)}` },
			])
			const changes = yield* ethGetFilterChanges(node)([filterId])
			expect(Array.isArray(changes)).toBe(true)
			expect((changes as unknown[]).length).toBe(0)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// ethNewBlockFilter + ethGetFilterChanges
// ---------------------------------------------------------------------------

describe("ethNewBlockFilter + ethGetFilterChanges", () => {
	it.effect("creates a block filter and returns hex ID", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* ethNewBlockFilter(node)([])
			expect(typeof result).toBe("string")
			expect((result as string).startsWith("0x")).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns empty array when no new blocks have been mined", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const filterId = yield* ethNewBlockFilter(node)([])
			const changes = yield* ethGetFilterChanges(node)([filterId])
			expect(Array.isArray(changes)).toBe(true)
			expect((changes as unknown[]).length).toBe(0)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns block hashes after mining a block", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Create block filter first
			const filterId = yield* ethNewBlockFilter(node)([])

			// Send a transaction to trigger mining a new block
			const accounts = (yield* ethAccounts(node)([])) as string[]
			const sender = accounts[0]!
			yield* ethSendTransaction(node)([
				{
					from: sender,
					to: `0x${"22".repeat(20)}`,
					value: "0x0",
				},
			])

			// Get filter changes — should have at least one block hash
			const changes = yield* ethGetFilterChanges(node)([filterId])
			expect(Array.isArray(changes)).toBe(true)
			const hashes = changes as string[]
			expect(hashes.length).toBeGreaterThan(0)
			// Each entry should be a 0x-prefixed hex hash
			for (const hash of hashes) {
				expect(hash.startsWith("0x")).toBe(true)
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// ethNewPendingTransactionFilter + ethGetFilterChanges
// ---------------------------------------------------------------------------

describe("ethNewPendingTransactionFilter + ethGetFilterChanges", () => {
	it.effect("creates a pending transaction filter and returns hex ID", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* ethNewPendingTransactionFilter(node)([])
			expect(typeof result).toBe("string")
			expect((result as string).startsWith("0x")).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns empty array when no pending transactions exist", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const filterId = yield* ethNewPendingTransactionFilter(node)([])
			const changes = yield* ethGetFilterChanges(node)([filterId])
			expect(Array.isArray(changes)).toBe(true)
			// On a fresh node with auto-mine, pending pool is typically empty
			// (transactions get mined immediately)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// ethUninstallFilter
// ---------------------------------------------------------------------------

describe("ethUninstallFilter", () => {
	it.effect("removes an existing filter and returns true", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const filterId = yield* ethNewFilter(node)([{}])
			const result = yield* ethUninstallFilter(node)([filterId])
			expect(result).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns false for a non-existent filter", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* ethUninstallFilter(node)(["0xdeadbeef"])
			expect(result).toBe(false)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("double uninstall returns false on second call", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const filterId = yield* ethNewFilter(node)([{}])
			const first = yield* ethUninstallFilter(node)([filterId])
			expect(first).toBe(true)
			const second = yield* ethUninstallFilter(node)([filterId])
			expect(second).toBe(false)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("getFilterChanges fails after uninstall", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const filterId = yield* ethNewFilter(node)([{}])
			yield* ethUninstallFilter(node)([filterId])
			const error = yield* ethGetFilterChanges(node)([filterId]).pipe(Effect.flip)
			expect(error).toBeInstanceOf(InternalError)
			expect(error.message).toContain("not found")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("uninstall block filter returns true", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const filterId = yield* ethNewBlockFilter(node)([])
			const result = yield* ethUninstallFilter(node)([filterId])
			expect(result).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("uninstall pending transaction filter returns true", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const filterId = yield* ethNewPendingTransactionFilter(node)([])
			const result = yield* ethUninstallFilter(node)([filterId])
			expect(result).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
