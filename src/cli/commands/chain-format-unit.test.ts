/**
 * Unit tests for chain.ts format functions (formatBlock, formatTx, formatReceipt,
 * formatLog, formatLogs).
 *
 * These are tested directly (in-process) so v8 coverage tracks them properly.
 * Covers boundary conditions: empty objects, missing fields, partial data, edge values.
 */

import { describe, expect, it } from "vitest"
import { formatBlock, formatLog, formatLogs, formatReceipt, formatTx } from "./chain.js"

// ============================================================================
// formatBlock
// ============================================================================

describe("formatBlock", () => {
	it("formats a full block with all fields", () => {
		const block = {
			number: "0xa",
			hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
			parentHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
			timestamp: "0x60",
			gasUsed: "0x5208",
			gasLimit: "0x1c9c380",
			baseFeePerGas: "0x3b9aca00",
			miner: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
			transactions: ["0xaaa", "0xbbb"],
		}

		const result = formatBlock(block)
		expect(result).toContain("Block:")
		expect(result).toContain("10") // 0xa = 10
		expect(result).toContain("Hash:")
		expect(result).toContain("Parent Hash:")
		expect(result).toContain("Timestamp:")
		expect(result).toContain("Gas Used:")
		expect(result).toContain("Gas Limit:")
		expect(result).toContain("Base Fee:")
		expect(result).toContain("Miner:")
		expect(result).toContain("Transactions:   2")
	})

	it("formats a block with only number and hash", () => {
		const block = {
			number: "0x0",
			hash: "0xabc",
		}
		const result = formatBlock(block)
		expect(result).toContain("Block:")
		expect(result).toContain("Hash:")
		expect(result).not.toContain("Parent Hash:")
		expect(result).not.toContain("Miner:")
	})

	it("handles empty block object", () => {
		const result = formatBlock({})
		expect(result).toBe("")
	})

	it("handles block with zero number (genesis)", () => {
		const block = { number: "0x0" }
		// 0x0 is falsy as a string but the format should still show it
		// Actually "0x0" is truthy. 0x0 = 0 decimal.
		const result = formatBlock(block)
		expect(result).toContain("Block:")
		expect(result).toContain("0")
	})

	it("handles block with empty transaction array", () => {
		const block = { transactions: [] as string[] }
		const result = formatBlock(block)
		expect(result).toContain("Transactions:   0")
	})

	it("handles block with large hex values", () => {
		const block = {
			number: "0xffffffffffff",
			gasUsed: "0xffffffffffffffff",
		}
		const result = formatBlock(block)
		expect(result).toContain("Block:")
		expect(result).toContain("Gas Used:")
	})
})

// ============================================================================
// formatTx
// ============================================================================

describe("formatTx", () => {
	it("formats a full transaction with all fields", () => {
		const tx = {
			hash: "0xabc123",
			from: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
			to: "0x0000000000000000000000000000000000000001",
			value: "0xde0b6b3a7640000",
			nonce: "0x5",
			gas: "0x5208",
			gasPrice: "0x3b9aca00",
			blockNumber: "0xa",
			input: "0xa9059cbb",
		}

		const result = formatTx(tx)
		expect(result).toContain("Hash:")
		expect(result).toContain("0xabc123")
		expect(result).toContain("From:")
		expect(result).toContain("To:")
		expect(result).toContain("Value:")
		expect(result).toContain("wei")
		expect(result).toContain("Nonce:")
		expect(result).toContain("Gas:")
		expect(result).toContain("Gas Price:")
		expect(result).toContain("Block:")
		expect(result).toContain("Input:")
	})

	it("handles contract creation (null to)", () => {
		const tx = {
			hash: "0xdef",
			from: "0xaaa",
			to: null,
		}
		const result = formatTx(tx)
		expect(result).toContain("Hash:")
		expect(result).toContain("From:")
		// to is null which is falsy, so it won't render the To line
		// because the check is `if (tx.to)` and null is falsy
	})

	it("handles empty transaction object", () => {
		const result = formatTx({})
		expect(result).toBe("")
	})

	it("handles transaction with only hash", () => {
		const result = formatTx({ hash: "0x123" })
		expect(result).toContain("Hash:")
		expect(result).toContain("0x123")
		expect(result).not.toContain("From:")
	})

	it("handles zero value transaction", () => {
		const tx = { value: "0x0" }
		const result = formatTx(tx)
		expect(result).toContain("Value:")
		expect(result).toContain("0")
		expect(result).toContain("wei")
	})
})

// ============================================================================
// formatReceipt
// ============================================================================

describe("formatReceipt", () => {
	it("formats a full successful receipt", () => {
		const receipt = {
			transactionHash: "0xabc",
			status: "0x1",
			blockNumber: "0x5",
			from: "0xfrom",
			to: "0xto",
			gasUsed: "0x5208",
			contractAddress: null,
			logs: [{ address: "0x1", topics: [], data: "0x" }],
		}

		const result = formatReceipt(receipt)
		expect(result).toContain("Tx Hash:")
		expect(result).toContain("0xabc")
		expect(result).toContain("Status:")
		expect(result).toContain("Success")
		expect(result).toContain("Block:")
		expect(result).toContain("From:")
		expect(result).toContain("To:")
		expect(result).toContain("Gas Used:")
		expect(result).toContain("Logs:          1")
		// contractAddress is null so should not appear
		expect(result).not.toContain("Contract:")
	})

	it("formats a reverted receipt", () => {
		const receipt = {
			transactionHash: "0xdef",
			status: "0x0",
		}
		const result = formatReceipt(receipt)
		expect(result).toContain("Status:")
		expect(result).toContain("Reverted")
	})

	it("formats receipt with contract creation", () => {
		const receipt = {
			transactionHash: "0xghi",
			contractAddress: "0x1234567890abcdef1234567890abcdef12345678",
			to: null,
		}
		const result = formatReceipt(receipt)
		expect(result).toContain("Contract:")
		expect(result).toContain("0x1234567890abcdef1234567890abcdef12345678")
	})

	it("handles empty receipt object", () => {
		const result = formatReceipt({})
		expect(result).toBe("")
	})

	it("handles receipt with zero logs", () => {
		const receipt = { logs: [] as unknown[] }
		const result = formatReceipt(receipt)
		expect(result).toContain("Logs:          0")
	})
})

// ============================================================================
// formatLog
// ============================================================================

describe("formatLog", () => {
	it("formats a log entry with address, topics, and data", () => {
		const log = {
			address: "0x1234",
			topics: [
				"0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
				"0x0000000000000000000000001234567890abcdef1234567890abcdef12345678",
			],
			data: "0xdeadbeef",
		}

		const result = formatLog(log)
		expect(result).toContain("Address: 0x1234")
		expect(result).toContain("Topic 0:")
		expect(result).toContain("Topic 1:")
		expect(result).toContain("Data:    0xdeadbeef")
		expect(result).toContain("---")
	})

	it("formats log with no topics", () => {
		const log = {
			address: "0xfoo",
			topics: [],
			data: "0x",
		}
		const result = formatLog(log)
		expect(result).toContain("Address: 0xfoo")
		expect(result).not.toContain("Topic 0:")
		expect(result).toContain("Data:    0x")
	})

	it("formats log with missing fields (uses defaults)", () => {
		const log = {}
		const result = formatLog(log)
		expect(result).toContain("Address: ")
		expect(result).toContain("Data:    0x")
		expect(result).toContain("---")
	})

	it("formats log with single topic", () => {
		const log = {
			address: "0xaddr",
			topics: ["0xtopic0"],
			data: "0xdata",
		}
		const result = formatLog(log)
		expect(result).toContain("Topic 0: 0xtopic0")
		expect(result).not.toContain("Topic 1:")
	})

	it("formats log with four topics (max)", () => {
		const log = {
			address: "0xaddr",
			topics: ["0xt0", "0xt1", "0xt2", "0xt3"],
			data: "0x",
		}
		const result = formatLog(log)
		expect(result).toContain("Topic 0: 0xt0")
		expect(result).toContain("Topic 1: 0xt1")
		expect(result).toContain("Topic 2: 0xt2")
		expect(result).toContain("Topic 3: 0xt3")
	})
})

// ============================================================================
// formatLogs
// ============================================================================

describe("formatLogs", () => {
	it("returns 'No logs found' for empty array", () => {
		const result = formatLogs([])
		expect(result).toBe("No logs found")
	})

	it("formats a single log entry", () => {
		const logs = [{ address: "0xabc", topics: ["0xt0"], data: "0xdata" }]
		const result = formatLogs(logs)
		expect(result).toContain("Address: 0xabc")
		expect(result).toContain("Topic 0: 0xt0")
		expect(result).toContain("Data:    0xdata")
		expect(result).toContain("---")
	})

	it("formats multiple log entries separated by newlines", () => {
		const logs = [
			{ address: "0x111", topics: [], data: "0x" },
			{ address: "0x222", topics: [], data: "0xff" },
		]
		const result = formatLogs(logs)
		expect(result).toContain("Address: 0x111")
		expect(result).toContain("Address: 0x222")
		// Two separator lines
		const separators = result.split("---").length - 1
		expect(separators).toBe(2)
	})
})
