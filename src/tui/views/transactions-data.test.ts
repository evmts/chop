import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../../node/index.js"
import { type TransactionDetail, filterTransactions, getTransactionsData } from "./transactions-data.js"

describe("transactions-data", () => {
	describe("getTransactionsData", () => {
		it.effect("returns empty array for fresh node with no transactions", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const data = yield* getTransactionsData(node)
				expect(data.transactions).toEqual([])
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("returns 1 transaction after sending a tx and mining", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				yield* node.txPool.addTransaction({
					hash: `0x${"ab".repeat(32)}`,
					from: `0x${"11".repeat(20)}`,
					to: `0x${"22".repeat(20)}`,
					value: 1000n,
					gas: 21000n,
					gasPrice: 1_000_000_000n,
					nonce: 0n,
					data: "0xdeadbeef",
					gasUsed: 21000n,
					status: 1,
					type: 0,
				})
				yield* node.mining.mine(1)
				const data = yield* getTransactionsData(node)
				expect(data.transactions.length).toBe(1)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("transaction has expected hash", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const hash = `0x${"ab".repeat(32)}`
				yield* node.txPool.addTransaction({
					hash,
					from: `0x${"11".repeat(20)}`,
					to: `0x${"22".repeat(20)}`,
					value: 500n,
					gas: 21000n,
					gasPrice: 1_000_000_000n,
					nonce: 0n,
					data: "0x",
					gasUsed: 21000n,
					status: 1,
					type: 0,
				})
				yield* node.mining.mine(1)
				const data = yield* getTransactionsData(node)
				expect(data.transactions[0]?.hash).toBe(hash)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("transaction has from and to addresses", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const from = `0x${"11".repeat(20)}`
				const to = `0x${"22".repeat(20)}`
				yield* node.txPool.addTransaction({
					hash: `0x${"ab".repeat(32)}`,
					from,
					to,
					value: 0n,
					gas: 21000n,
					gasPrice: 1_000_000_000n,
					nonce: 0n,
					data: "0x",
					gasUsed: 21000n,
					status: 1,
					type: 0,
				})
				yield* node.mining.mine(1)
				const data = yield* getTransactionsData(node)
				expect(data.transactions[0]?.from).toBe(from)
				expect(data.transactions[0]?.to).toBe(to)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("transaction has value, gasPrice, type fields", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				yield* node.txPool.addTransaction({
					hash: `0x${"ab".repeat(32)}`,
					from: `0x${"11".repeat(20)}`,
					to: `0x${"22".repeat(20)}`,
					value: 1_000_000_000_000_000_000n,
					gas: 21000n,
					gasPrice: 2_000_000_000n,
					nonce: 0n,
					data: "0x",
					gasUsed: 21000n,
					status: 1,
					type: 2,
				})
				yield* node.mining.mine(1)
				const data = yield* getTransactionsData(node)
				const tx = data.transactions[0]
				expect(tx).toBeDefined()
				expect(tx?.value).toBe(1_000_000_000_000_000_000n)
				expect(tx?.gasPrice).toBe(2_000_000_000n)
				expect(tx?.type).toBe(2)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("transaction has blockNumber", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				yield* node.txPool.addTransaction({
					hash: `0x${"ab".repeat(32)}`,
					from: `0x${"11".repeat(20)}`,
					to: `0x${"22".repeat(20)}`,
					value: 0n,
					gas: 21000n,
					gasPrice: 1_000_000_000n,
					nonce: 0n,
					data: "0x",
					gasUsed: 21000n,
					status: 1,
					type: 0,
				})
				yield* node.mining.mine(1)
				const data = yield* getTransactionsData(node)
				expect(data.transactions[0]?.blockNumber).toBe(1n)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("transaction has calldata", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				yield* node.txPool.addTransaction({
					hash: `0x${"ab".repeat(32)}`,
					from: `0x${"11".repeat(20)}`,
					to: `0x${"22".repeat(20)}`,
					value: 0n,
					gas: 50000n,
					gasPrice: 1_000_000_000n,
					nonce: 0n,
					data: "0xa9059cbb",
					gasUsed: 30000n,
					status: 1,
					type: 0,
				})
				yield* node.mining.mine(1)
				const data = yield* getTransactionsData(node)
				expect(data.transactions[0]?.data).toBe("0xa9059cbb")
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("returns newest first", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				yield* node.txPool.addTransaction({
					hash: `0x${"01".repeat(32)}`,
					from: `0x${"11".repeat(20)}`,
					to: `0x${"22".repeat(20)}`,
					value: 100n,
					gas: 21000n,
					gasPrice: 1_000_000_000n,
					nonce: 0n,
					data: "0x",
					gasUsed: 21000n,
					status: 1,
					type: 0,
				})
				yield* node.mining.mine(1)
				yield* node.txPool.addTransaction({
					hash: `0x${"02".repeat(32)}`,
					from: `0x${"11".repeat(20)}`,
					to: `0x${"33".repeat(20)}`,
					value: 200n,
					gas: 21000n,
					gasPrice: 1_000_000_000n,
					nonce: 1n,
					data: "0x",
					gasUsed: 21000n,
					status: 1,
					type: 0,
				})
				yield* node.mining.mine(1)
				const data = yield* getTransactionsData(node)
				expect(data.transactions.length).toBe(2)
				expect(data.transactions[0]?.blockNumber).toBe(2n)
				expect(data.transactions[1]?.blockNumber).toBe(1n)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("contract creation has undefined to", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				yield* node.txPool.addTransaction({
					hash: `0x${"cc".repeat(32)}`,
					from: `0x${"11".repeat(20)}`,
					// no to — contract creation
					value: 0n,
					gas: 100000n,
					gasPrice: 1_000_000_000n,
					nonce: 0n,
					data: "0x6080604052",
					gasUsed: 50000n,
					status: 1,
					type: 0,
				})
				yield* node.mining.mine(1)
				const data = yield* getTransactionsData(node)
				expect(data.transactions[0]?.to).toBeUndefined()
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("respects count parameter", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				for (let i = 0; i < 3; i++) {
					yield* node.txPool.addTransaction({
						hash: `0x${String(i + 1)
							.padStart(2, "0")
							.repeat(32)}`,
						from: `0x${"11".repeat(20)}`,
						to: `0x${"22".repeat(20)}`,
						value: BigInt(i * 100),
						gas: 21000n,
						gasPrice: 1_000_000_000n,
						nonce: BigInt(i),
						data: "0x",
						gasUsed: 21000n,
						status: 1,
						type: 0,
					})
					yield* node.mining.mine(1)
				}
				const data = yield* getTransactionsData(node, 2)
				expect(data.transactions.length).toBe(2)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)
	})

	describe("filterTransactions", () => {
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

		it.effect("empty query returns all", () =>
			Effect.sync(() => {
				const txs = [makeTx({ hash: "0xaaa" }), makeTx({ hash: "0xbbb" })]
				expect(filterTransactions(txs, "")).toEqual(txs)
			}),
		)

		it.effect("filters by address (from)", () =>
			Effect.sync(() => {
				const txs = [
					makeTx({ from: "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }),
					makeTx({ from: "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB" }),
				]
				const result = filterTransactions(txs, "AAAA")
				expect(result.length).toBe(1)
				expect(result[0]?.from).toContain("AAAA")
			}),
		)

		it.effect("filters by hash", () =>
			Effect.sync(() => {
				const txs = [makeTx({ hash: "0xdead" }), makeTx({ hash: "0xbeef" })]
				const result = filterTransactions(txs, "dead")
				expect(result.length).toBe(1)
			}),
		)

		it.effect("filters by status text 'success'", () =>
			Effect.sync(() => {
				const txs = [makeTx({ status: 1 }), makeTx({ status: 0 })]
				const result = filterTransactions(txs, "success")
				expect(result.length).toBe(1)
				expect(result[0]?.status).toBe(1)
			}),
		)

		it.effect("filters by status text 'fail'", () =>
			Effect.sync(() => {
				const txs = [makeTx({ status: 1 }), makeTx({ status: 0 })]
				const result = filterTransactions(txs, "fail")
				expect(result.length).toBe(1)
				expect(result[0]?.status).toBe(0)
			}),
		)

		it.effect("filters by type text 'legacy'", () =>
			Effect.sync(() => {
				const txs = [makeTx({ type: 0 }), makeTx({ type: 2 })]
				const result = filterTransactions(txs, "legacy")
				expect(result.length).toBe(1)
				expect(result[0]?.type).toBe(0)
			}),
		)

		it.effect("filters by type text 'eip-1559'", () =>
			Effect.sync(() => {
				const txs = [makeTx({ type: 0 }), makeTx({ type: 2 })]
				const result = filterTransactions(txs, "eip-1559")
				expect(result.length).toBe(1)
				expect(result[0]?.type).toBe(2)
			}),
		)

		it.effect("filter is case-insensitive", () =>
			Effect.sync(() => {
				const txs = [makeTx({ from: "0xAAAA" })]
				expect(filterTransactions(txs, "aaaa").length).toBe(1)
			}),
		)

		it.effect("filters by block number", () =>
			Effect.sync(() => {
				const txs = [makeTx({ blockNumber: 42n }), makeTx({ blockNumber: 100n })]
				const result = filterTransactions(txs, "42")
				expect(result.length).toBe(1)
			}),
		)
	})
})
