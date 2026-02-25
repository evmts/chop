import { describe, it } from "@effect/vitest"
import { expect } from "vitest"
import { serializeBlock, serializeLog, serializeTransaction } from "./helpers.js"

describe("serializeBlock", () => {
	it("serializes block with correct fields", () => {
		const block = {
			hash: `0x${"aa".repeat(32)}`,
			parentHash: `0x${"bb".repeat(32)}`,
			number: 42n,
			timestamp: 1000000n,
			gasLimit: 30_000_000n,
			gasUsed: 21000n,
			baseFeePerGas: 1_000_000_000n,
			transactionHashes: ["0xabc"],
		}
		const result = serializeBlock(block, false)
		expect(result.number).toBe("0x2a")
		expect(result.hash).toBe(block.hash)
		expect(result.parentHash).toBe(block.parentHash)
		expect(result.gasLimit).toBe("0x1c9c380")
		expect(result.gasUsed).toBe("0x5208")
		expect(result.timestamp).toBe("0xf4240")
		expect(result.baseFeePerGas).toBe("0x3b9aca00")
		expect(result.transactions).toEqual(["0xabc"])
		expect(result.uncles).toEqual([])
	})

	it("serializes block with full transaction objects when includeFullTxs is true", () => {
		const block = {
			hash: `0x${"aa".repeat(32)}`,
			parentHash: `0x${"bb".repeat(32)}`,
			number: 42n,
			timestamp: 1000000n,
			gasLimit: 30_000_000n,
			gasUsed: 21000n,
			baseFeePerGas: 1_000_000_000n,
			transactionHashes: ["0xabc"],
		}
		const fullTxs = [
			{
				hash: "0xabc",
				from: "0x1234",
				to: "0x5678",
				value: 1000n,
				gas: 21000n,
				gasPrice: 1_000_000_000n,
				nonce: 0n,
				data: "0x",
				blockHash: block.hash,
				blockNumber: 42n,
				transactionIndex: 0,
				type: 2,
			},
		]
		const result = serializeBlock(block, true, fullTxs)
		expect(result.transactions).toEqual([
			expect.objectContaining({
				hash: "0xabc",
				from: "0x1234",
				to: "0x5678",
				value: "0x3e8",
			}),
		])
	})

	it("falls back to hashes when includeFullTxs is true but no fullTxs provided", () => {
		const block = {
			hash: `0x${"aa".repeat(32)}`,
			parentHash: `0x${"bb".repeat(32)}`,
			number: 42n,
			timestamp: 1000000n,
			gasLimit: 30_000_000n,
			gasUsed: 21000n,
			baseFeePerGas: 1_000_000_000n,
			transactionHashes: ["0xabc"],
		}
		const result = serializeBlock(block, true)
		expect(result.transactions).toEqual(["0xabc"])
	})

	it("handles missing transactionHashes", () => {
		const block = {
			hash: `0x${"aa".repeat(32)}`,
			parentHash: `0x${"bb".repeat(32)}`,
			number: 0n,
			timestamp: 0n,
			gasLimit: 30_000_000n,
			gasUsed: 0n,
			baseFeePerGas: 1_000_000_000n,
		}
		const result = serializeBlock(block, false)
		expect(result.transactions).toEqual([])
	})
})

describe("serializeTransaction", () => {
	it("serializes transaction with correct fields", () => {
		const tx = {
			hash: "0xdeadbeef",
			from: "0x1234",
			to: "0x5678",
			value: 1000n,
			gas: 21000n,
			gasPrice: 1_000_000_000n,
			nonce: 5n,
			data: "0x",
			blockHash: "0xblock",
			blockNumber: 1n,
			transactionIndex: 0,
			type: 2,
		}
		const result = serializeTransaction(tx)
		expect(result.hash).toBe("0xdeadbeef")
		expect(result.from).toBe("0x1234")
		expect(result.to).toBe("0x5678")
		expect(result.value).toBe("0x3e8")
		expect(result.gas).toBe("0x5208")
		expect(result.nonce).toBe("0x5")
		expect(result.blockNumber).toBe("0x1")
		expect(result.transactionIndex).toBe("0x0")
		expect(result.type).toBe("0x2")
	})

	it("handles null fields for pending tx", () => {
		const tx = {
			hash: "0xdeadbeef",
			from: "0x1234",
			value: 0n,
			gas: 21000n,
			gasPrice: 0n,
			nonce: 0n,
			data: "0x",
		}
		const result = serializeTransaction(tx)
		expect(result.to).toBeNull()
		expect(result.blockHash).toBeNull()
		expect(result.blockNumber).toBeNull()
		expect(result.transactionIndex).toBeNull()
	})
})

describe("serializeLog", () => {
	it("serializes log with correct fields", () => {
		const log = {
			address: "0x1234",
			topics: ["0xtopic1", "0xtopic2"],
			data: "0xdata",
			blockNumber: 1n,
			transactionHash: "0xtxhash",
			transactionIndex: 0,
			blockHash: "0xblockhash",
			logIndex: 2,
			removed: false,
		}
		const result = serializeLog(log)
		expect(result.address).toBe("0x1234")
		expect(result.topics).toEqual(["0xtopic1", "0xtopic2"])
		expect(result.blockNumber).toBe("0x1")
		expect(result.logIndex).toBe("0x2")
		expect(result.removed).toBe(false)
	})
})
