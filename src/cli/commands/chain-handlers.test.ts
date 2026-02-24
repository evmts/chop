/**
 * Comprehensive tests for chain.ts handler functions and helpers.
 *
 * Covers: parseBlockId, blockHandler, txHandler, receiptHandler,
 * logsHandler, gasPriceHandler, baseFeeHandler, findBlockHandler,
 * and the private formatting functions (indirectly via handler output shapes).
 */

import { FetchHttpClient } from "@effect/platform"
import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../../node/index.js"
import { rpcCall } from "../../rpc/client.js"
import { startRpcServer } from "../../rpc/server.js"
import {
	baseFeeHandler,
	blockHandler,
	findBlockHandler,
	gasPriceHandler,
	logsHandler,
	parseBlockId,
	receiptHandler,
	txHandler,
} from "./chain.js"

// ============================================================================
// parseBlockId — boundary/edge cases
// ============================================================================

describe("parseBlockId — boundary/edge cases", () => {
	it.effect("parses 'pending' tag", () =>
		Effect.gen(function* () {
			const result = yield* parseBlockId("pending")
			expect(result.method).toBe("eth_getBlockByNumber")
			expect(result.params).toEqual(["pending", true])
		}),
	)

	it.effect("parses 'safe' tag", () =>
		Effect.gen(function* () {
			const result = yield* parseBlockId("safe")
			expect(result.method).toBe("eth_getBlockByNumber")
			expect(result.params).toEqual(["safe", true])
		}),
	)

	it.effect("parses 'finalized' tag", () =>
		Effect.gen(function* () {
			const result = yield* parseBlockId("finalized")
			expect(result.method).toBe("eth_getBlockByNumber")
			expect(result.params).toEqual(["finalized", true])
		}),
	)

	it.effect("rejects invalid hex 0xZZZ with InvalidBlockIdError", () =>
		Effect.gen(function* () {
			const error = yield* parseBlockId("0xZZZ").pipe(Effect.flip)
			expect(error._tag).toBe("InvalidBlockIdError")
			expect(error.message).toContain("Invalid block ID")
		}),
	)

	it.effect("rejects non-numeric non-tag string with InvalidBlockIdError", () =>
		Effect.gen(function* () {
			const error = yield* parseBlockId("foobar").pipe(Effect.flip)
			expect(error._tag).toBe("InvalidBlockIdError")
			expect(error.message).toContain("Invalid block ID")
			expect(error.message).toContain("foobar")
		}),
	)

	it.effect("parses decimal '0' as block number 0x0", () =>
		Effect.gen(function* () {
			const result = yield* parseBlockId("0")
			expect(result.method).toBe("eth_getBlockByNumber")
			expect(result.params).toEqual(["0x0", true])
		}),
	)

	it.effect("parses 66-char hex as block hash (eth_getBlockByHash)", () =>
		Effect.gen(function* () {
			const hash = `0x${"ab".repeat(32)}`
			const result = yield* parseBlockId(hash)
			expect(result.method).toBe("eth_getBlockByHash")
			expect(result.params).toEqual([hash, true])
		}),
	)

	it.effect("parses valid hex number 0xff", () =>
		Effect.gen(function* () {
			const result = yield* parseBlockId("0xff")
			expect(result.method).toBe("eth_getBlockByNumber")
			expect(result.params).toEqual(["0xff", true])
		}),
	)
})

// ============================================================================
// blockHandler — edge cases
// ============================================================================

describe("blockHandler — edge cases", () => {
	it.effect("returns genesis block for block '0'", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const result = yield* blockHandler(`http://127.0.0.1:${server.port}`, "0")
				expect(result).toBeDefined()
				expect(result.number).toBe("0x0")
				expect(result.hash).toBeDefined()
				expect(result.parentHash).toBeDefined()
				expect(result.timestamp).toBeDefined()
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("returns block with baseFeePerGas for 'latest'", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const result = yield* blockHandler(`http://127.0.0.1:${server.port}`, "latest")
				expect(result).toBeDefined()
				expect(result.baseFeePerGas).toBeDefined()
				expect(typeof result.baseFeePerGas).toBe("string")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("returns InvalidBlockIdError for non-existent block number", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const error = yield* blockHandler(`http://127.0.0.1:${server.port}`, "999999").pipe(Effect.flip)
				expect(error._tag).toBe("InvalidBlockIdError")
				expect(error.message).toContain("Block not found")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

// ============================================================================
// txHandler — edge cases
// ============================================================================

describe("txHandler — edge cases", () => {
	it.effect("returns TransactionNotFoundError for non-existent tx hash", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const fakeHash = `0x${"00".repeat(32)}`
				const error = yield* txHandler(`http://127.0.0.1:${server.port}`, fakeHash).pipe(Effect.flip)
				expect(error._tag).toBe("TransactionNotFoundError")
				expect(error.message).toContain("Transaction not found")
				expect(error.message).toContain(fakeHash)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("returns transaction data when tx exists", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			const url = `http://127.0.0.1:${server.port}`
			const sender = node.accounts[0]!

			try {
				// Send a transaction to create one
				const txHash = yield* rpcCall(url, "eth_sendTransaction", [
					{
						from: sender.address,
						to: `0x${"22".repeat(20)}`,
						value: "0xde0b6b3a7640000", // 1 ETH
					},
				])

				// Now query it via the handler
				const result = yield* txHandler(url, txHash as string)
				expect(result).toBeDefined()
				expect(result.hash).toBe(txHash)
				expect(result.from).toBeDefined()
				expect(result.to).toBeDefined()
				expect(result.value).toBeDefined()
				expect(result.blockNumber).toBeDefined()
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

// ============================================================================
// receiptHandler — edge cases
// ============================================================================

describe("receiptHandler — edge cases", () => {
	it.effect("returns ReceiptNotFoundError for non-existent tx hash", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const fakeHash = `0x${"00".repeat(32)}`
				const error = yield* receiptHandler(`http://127.0.0.1:${server.port}`, fakeHash).pipe(Effect.flip)
				expect(error._tag).toBe("ReceiptNotFoundError")
				expect(error.message).toContain("Receipt not found")
				expect(error.message).toContain(fakeHash)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("returns receipt data when tx has been mined", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			const url = `http://127.0.0.1:${server.port}`
			const sender = node.accounts[0]!

			try {
				// Send a transaction (auto-mined)
				const txHash = yield* rpcCall(url, "eth_sendTransaction", [
					{
						from: sender.address,
						to: `0x${"22".repeat(20)}`,
						value: "0x0",
					},
				])

				// Query the receipt
				const result = yield* receiptHandler(url, txHash as string)
				expect(result).toBeDefined()
				expect(result.transactionHash).toBe(txHash)
				expect(result.status).toBe("0x1") // success
				expect(result.blockNumber).toBeDefined()
				expect(result.gasUsed).toBeDefined()
				expect(Array.isArray(result.logs)).toBe(true)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

// ============================================================================
// logsHandler — edge cases
// ============================================================================

describe("logsHandler — edge cases", () => {
	it.effect("returns empty array with no filters on a fresh node (block 0)", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const result = yield* logsHandler(`http://127.0.0.1:${server.port}`, {})
				expect(Array.isArray(result)).toBe(true)
				expect(result.length).toBe(0)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("returns empty array with address filter for non-existent contract", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const result = yield* logsHandler(`http://127.0.0.1:${server.port}`, {
					address: `0x${"99".repeat(20)}`,
					fromBlock: "0x0",
					toBlock: "latest",
				})
				expect(Array.isArray(result)).toBe(true)
				expect(result.length).toBe(0)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("returns empty array with topic filter on fresh node", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const result = yield* logsHandler(`http://127.0.0.1:${server.port}`, {
					topics: [`0x${"ab".repeat(32)}`],
					fromBlock: "0x0",
					toBlock: "latest",
				})
				expect(Array.isArray(result)).toBe(true)
				expect(result.length).toBe(0)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("uses default fromBlock/toBlock of 'latest' when not specified", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				// No fromBlock or toBlock specified — defaults to "latest"/"latest"
				const result = yield* logsHandler(`http://127.0.0.1:${server.port}`, {
					address: `0x${"11".repeat(20)}`,
				})
				expect(Array.isArray(result)).toBe(true)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

// ============================================================================
// gasPriceHandler
// ============================================================================

describe("gasPriceHandler", () => {
	it.effect("returns a decimal gas price string", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const result = yield* gasPriceHandler(`http://127.0.0.1:${server.port}`)
				// Should be a decimal string (no 0x prefix)
				expect(result).not.toContain("0x")
				expect(BigInt(result)).toBeGreaterThanOrEqual(0n)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

// ============================================================================
// baseFeeHandler — edge cases
// ============================================================================

describe("baseFeeHandler", () => {
	it.effect("returns a decimal base fee string from the latest block", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const result = yield* baseFeeHandler(`http://127.0.0.1:${server.port}`)
				// Should be a decimal string (no 0x prefix)
				expect(result).not.toContain("0x")
				// Genesis block has baseFeePerGas = 1_000_000_000 (1 gwei)
				expect(BigInt(result)).toBe(1_000_000_000n)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

// ============================================================================
// findBlockHandler — edge cases
// ============================================================================

describe("findBlockHandler — edge cases", () => {
	it.effect("returns InvalidTimestampError for non-numeric timestamp", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const error = yield* findBlockHandler(`http://127.0.0.1:${server.port}`, "not-a-number").pipe(Effect.flip)
				expect(error._tag).toBe("InvalidTimestampError")
				expect(error.message).toContain("Invalid timestamp")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("returns InvalidTimestampError for negative timestamp", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const error = yield* findBlockHandler(`http://127.0.0.1:${server.port}`, "-1").pipe(Effect.flip)
				expect(error._tag).toBe("InvalidTimestampError")
				expect(error.message).toContain("Invalid timestamp")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("returns latest block number when target >= latest timestamp", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			const url = `http://127.0.0.1:${server.port}`
			try {
				// Use a timestamp far in the future
				const futureTimestamp = String(Math.floor(Date.now() / 1000) + 100_000)
				const result = yield* findBlockHandler(url, futureTimestamp)
				// On a fresh node, latest = 0
				expect(result).toBe("0")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("returns '0' when target <= genesis timestamp", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			const url = `http://127.0.0.1:${server.port}`
			try {
				// Mine a block so latestNumber > 0 (otherwise it short-circuits to "0" before genesis check)
				yield* rpcCall(url, "evm_mine", [])

				// Use timestamp 0 (before genesis)
				const result = yield* findBlockHandler(url, "0")
				expect(result).toBe("0")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("exercises binary search path with multiple blocks", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			const url = `http://127.0.0.1:${server.port}`
			try {
				// Get genesis timestamp
				const genesisBlock = yield* blockHandler(url, "0")
				const genesisTs = Number(BigInt(genesisBlock.timestamp as string))

				// Set next block timestamp to genesis + 100 and mine
				yield* rpcCall(url, "evm_setNextBlockTimestamp", [`0x${(genesisTs + 100).toString(16)}`])
				yield* rpcCall(url, "evm_mine", [])

				// Set next block timestamp to genesis + 200 and mine
				yield* rpcCall(url, "evm_setNextBlockTimestamp", [`0x${(genesisTs + 200).toString(16)}`])
				yield* rpcCall(url, "evm_mine", [])

				// Set next block timestamp to genesis + 300 and mine
				yield* rpcCall(url, "evm_setNextBlockTimestamp", [`0x${(genesisTs + 300).toString(16)}`])
				yield* rpcCall(url, "evm_mine", [])

				// Search for genesis + 150 — should find block 1 (ts = genesis+100, which is <= target)
				const result = yield* findBlockHandler(url, String(genesisTs + 150))
				const foundBlockNum = Number(result)

				// The result should be block 1 (timestamp genesis+100 is <= genesis+150)
				// but block 2 (timestamp genesis+200) is > genesis+150
				expect(foundBlockNum).toBe(1)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

// ============================================================================
// Format functions — tested indirectly through handler output shapes
// ============================================================================

describe("format functions — indirect coverage via handler return shapes", () => {
	it.effect("blockHandler returns object with expected fields for formatBlock", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			const url = `http://127.0.0.1:${server.port}`
			try {
				const block = yield* blockHandler(url, "0")

				// formatBlock accesses these fields — verify they exist
				expect(block.number).toBeDefined()
				expect(block.hash).toBeDefined()
				expect(block.parentHash).toBeDefined()
				expect(block.timestamp).toBeDefined()
				expect(block.gasLimit).toBeDefined()
				expect(block.baseFeePerGas).toBeDefined()
				// gasUsed and miner may or may not be present on genesis
				expect(block.transactions).toBeDefined()
				expect(Array.isArray(block.transactions)).toBe(true)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("txHandler returns object with expected fields for formatTx", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			const url = `http://127.0.0.1:${server.port}`
			const sender = node.accounts[0]!

			try {
				const txHash = (yield* rpcCall(url, "eth_sendTransaction", [
					{
						from: sender.address,
						to: `0x${"22".repeat(20)}`,
						value: "0xde0b6b3a7640000",
					},
				])) as string

				const tx = yield* txHandler(url, txHash)
				// formatTx accesses these fields
				expect(tx.hash).toBe(txHash)
				expect(tx.from).toBeDefined()
				expect(tx.to).toBeDefined()
				expect(tx.value).toBeDefined()
				expect(tx.blockNumber).toBeDefined()
				expect(tx.input).toBeDefined()
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("receiptHandler returns object with expected fields for formatReceipt", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			const url = `http://127.0.0.1:${server.port}`
			const sender = node.accounts[0]!

			try {
				const txHash = (yield* rpcCall(url, "eth_sendTransaction", [
					{
						from: sender.address,
						to: `0x${"22".repeat(20)}`,
						value: "0x0",
					},
				])) as string

				const receipt = yield* receiptHandler(url, txHash)
				// formatReceipt accesses these fields
				expect(receipt.transactionHash).toBe(txHash)
				expect(receipt.status).toBeDefined()
				expect(receipt.blockNumber).toBeDefined()
				expect(receipt.from).toBeDefined()
				expect(receipt.to).toBeDefined()
				expect(receipt.gasUsed).toBeDefined()
				expect(receipt.logs).toBeDefined()
				expect(Array.isArray(receipt.logs)).toBe(true)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})
