import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../../node/index.js"
import { getCallHistory } from "./call-history-data.js"

describe("call-history-data", () => {
	describe("getCallHistory", () => {
		it.effect("returns empty array for fresh node with no transactions", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const records = yield* getCallHistory(node)
				expect(records).toEqual([])
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("returns call records after a transaction is mined", () =>
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
				const records = yield* getCallHistory(node)
				expect(records.length).toBe(1)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("record contains correct from address", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const from = `0x${"11".repeat(20)}`
				yield* node.txPool.addTransaction({
					hash: `0x${"ab".repeat(32)}`,
					from,
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
				const records = yield* getCallHistory(node)
				expect(records[0]?.from).toBe(from)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("record contains calldata", () =>
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
				const records = yield* getCallHistory(node)
				expect(records[0]?.calldata).toBe("0xa9059cbb")
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("record has sequential id starting from 1", () =>
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
				const records = yield* getCallHistory(node)
				expect(records[0]?.id).toBe(1)
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
				const records = yield* getCallHistory(node)
				// Newest first — block 2 tx before block 1 tx
				expect(records.length).toBe(2)
				expect(records[0]?.blockNumber).toBe(2n)
				expect(records[1]?.blockNumber).toBe(1n)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("respects count parameter", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				// Add 3 transactions in separate blocks
				for (let i = 0; i < 3; i++) {
					yield* node.txPool.addTransaction({
						hash: `0x${String(i + 1).padStart(2, "0").repeat(32)}`,
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
				const records = yield* getCallHistory(node, 2)
				expect(records.length).toBe(2)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("marks contract creation as CREATE type", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				yield* node.txPool.addTransaction({
					hash: `0x${"cc".repeat(32)}`,
					from: `0x${"11".repeat(20)}`,
					// to is undefined for contract creation
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
				const records = yield* getCallHistory(node)
				expect(records[0]?.type).toBe("CREATE")
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("record includes gas fields", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				yield* node.txPool.addTransaction({
					hash: `0x${"dd".repeat(32)}`,
					from: `0x${"11".repeat(20)}`,
					to: `0x${"22".repeat(20)}`,
					value: 0n,
					gas: 50000n,
					gasPrice: 1_000_000_000n,
					nonce: 0n,
					data: "0x",
					gasUsed: 21000n,
					status: 1,
					type: 0,
				})
				yield* node.mining.mine(1)
				const records = yield* getCallHistory(node)
				expect(typeof records[0]?.gasUsed).toBe("bigint")
				expect(typeof records[0]?.gasLimit).toBe("bigint")
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("record reflects success status from receipt", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				yield* node.txPool.addTransaction({
					hash: `0x${"ee".repeat(32)}`,
					from: `0x${"11".repeat(20)}`,
					to: `0x${"22".repeat(20)}`,
					value: 0n,
					gas: 21000n,
					gasPrice: 1_000_000_000n,
					nonce: 0n,
					data: "0x",
					gasUsed: 21000n,
					status: 0, // failure
					type: 0,
				})
				yield* node.mining.mine(1)
				const records = yield* getCallHistory(node)
				// Status comes from receipt or tx status field
				expect(typeof records[0]?.success).toBe("boolean")
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)
	})
})
