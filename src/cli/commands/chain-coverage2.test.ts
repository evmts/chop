import { FetchHttpClient } from "@effect/platform"
import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../../node/index.js"
import { startRpcServer } from "../../rpc/server.js"
import {
	InvalidBlockIdError,
	InvalidTimestampError,
	ReceiptNotFoundError,
	TransactionNotFoundError,
	blockHandler,
	findBlockHandler,
	logsHandler,
	parseBlockId,
	receiptHandler,
	txHandler,
} from "./chain.js"
import { sendHandler } from "./rpc.js"

// ============================================================================
// Helpers
// ============================================================================

/** Spin up a test RPC server, send a simple ETH transfer, return url + txHash. */
const setupWithTx = Effect.gen(function* () {
	const node = yield* TevmNodeService
	const server = yield* startRpcServer({ port: 0 }, node)
	const url = `http://127.0.0.1:${server.port}`

	const from = node.accounts[0]!.address
	const to = node.accounts[1]!.address
	const txHash = yield* sendHandler(url, to, from, undefined, [], "0")

	return { server, url, txHash, from, to, node }
})

/** Spin up a bare test RPC server (no transactions sent). */
const setupBare = Effect.gen(function* () {
	const node = yield* TevmNodeService
	const server = yield* startRpcServer({ port: 0 }, node)
	const url = `http://127.0.0.1:${server.port}`
	return { server, url, node }
})

// ============================================================================
// Error type tag tests
// ============================================================================

describe("error type tags", () => {
	it("TransactionNotFoundError has correct _tag", () => {
		const err = new TransactionNotFoundError({ message: "test" })
		expect(err._tag).toBe("TransactionNotFoundError")
		expect(err.message).toBe("test")
	})

	it("ReceiptNotFoundError has correct _tag", () => {
		const err = new ReceiptNotFoundError({ message: "test" })
		expect(err._tag).toBe("ReceiptNotFoundError")
		expect(err.message).toBe("test")
	})

	it("InvalidBlockIdError has correct _tag", () => {
		const err = new InvalidBlockIdError({ message: "bad block" })
		expect(err._tag).toBe("InvalidBlockIdError")
		expect(err.message).toBe("bad block")
	})

	it("InvalidTimestampError has correct _tag", () => {
		const err = new InvalidTimestampError({ message: "bad ts" })
		expect(err._tag).toBe("InvalidTimestampError")
		expect(err.message).toBe("bad ts")
	})
})

// ============================================================================
// txHandler
// ============================================================================

describe("txHandler", () => {
	it.effect("returns transaction data for a valid tx hash", () =>
		Effect.gen(function* () {
			const { server, url, txHash } = yield* setupWithTx
			try {
				const result = yield* txHandler(url, txHash)
				expect(result).toHaveProperty("hash")
				expect(result.hash).toBe(txHash)
				expect(result).toHaveProperty("from")
				expect(result).toHaveProperty("to")
				expect(result).toHaveProperty("value")
				expect(result).toHaveProperty("blockNumber")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("returned tx contains expected fields from formatTx path", () =>
		Effect.gen(function* () {
			const { server, url, txHash, from } = yield* setupWithTx
			try {
				const result = yield* txHandler(url, txHash)
				// Verify all the fields that formatTx reads
				expect(typeof result.hash).toBe("string")
				expect(typeof result.from).toBe("string")
				// from address should match (case-insensitive)
				expect((result.from as string).toLowerCase()).toBe(from.toLowerCase())
				// gas, nonce, input should be present
				expect(result).toHaveProperty("gas")
				expect(result).toHaveProperty("nonce")
				expect(result).toHaveProperty("input")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("fails with TransactionNotFoundError for unknown hash", () =>
		Effect.gen(function* () {
			const { server, url } = yield* setupBare
			try {
				const unknownHash = `0x${"00".repeat(32)}`
				const error = yield* txHandler(url, unknownHash).pipe(Effect.flip)
				expect(error._tag).toBe("TransactionNotFoundError")
				expect(error).toBeInstanceOf(TransactionNotFoundError)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("TransactionNotFoundError message contains the hash", () =>
		Effect.gen(function* () {
			const { server, url } = yield* setupBare
			try {
				const badHash = `0x${"ff".repeat(32)}`
				const error = yield* txHandler(url, badHash).pipe(Effect.flip)
				expect(error._tag).toBe("TransactionNotFoundError")
				expect((error as TransactionNotFoundError).message).toContain(badHash)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

// ============================================================================
// receiptHandler
// ============================================================================

describe("receiptHandler", () => {
	it.effect("returns receipt for a mined transaction", () =>
		Effect.gen(function* () {
			const { server, url, txHash } = yield* setupWithTx
			try {
				const result = yield* receiptHandler(url, txHash)
				expect(result).toHaveProperty("transactionHash")
				expect(result.transactionHash).toBe(txHash)
				expect(result).toHaveProperty("blockNumber")
				expect(result).toHaveProperty("status")
				expect(result).toHaveProperty("gasUsed")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("receipt contains fields used by formatReceipt", () =>
		Effect.gen(function* () {
			const { server, url, txHash, from } = yield* setupWithTx
			try {
				const result = yield* receiptHandler(url, txHash)
				// Verify all the fields that formatReceipt reads
				expect(typeof result.transactionHash).toBe("string")
				expect(typeof result.status).toBe("string")
				expect(typeof result.blockNumber).toBe("string")
				expect(typeof result.from).toBe("string")
				expect((result.from as string).toLowerCase()).toBe(from.toLowerCase())
				expect(typeof result.gasUsed).toBe("string")
				// logs should be an array
				expect(Array.isArray(result.logs)).toBe(true)
				// status should be 0x1 for a successful simple transfer
				expect(result.status).toBe("0x1")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("fails with ReceiptNotFoundError for unknown hash", () =>
		Effect.gen(function* () {
			const { server, url } = yield* setupBare
			try {
				const unknownHash = `0x${"00".repeat(32)}`
				const error = yield* receiptHandler(url, unknownHash).pipe(Effect.flip)
				expect(error._tag).toBe("ReceiptNotFoundError")
				expect(error).toBeInstanceOf(ReceiptNotFoundError)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("ReceiptNotFoundError message contains the hash", () =>
		Effect.gen(function* () {
			const { server, url } = yield* setupBare
			try {
				const badHash = `0x${"ee".repeat(32)}`
				const error = yield* receiptHandler(url, badHash).pipe(Effect.flip)
				expect(error._tag).toBe("ReceiptNotFoundError")
				expect((error as ReceiptNotFoundError).message).toContain(badHash)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

// ============================================================================
// parseBlockId — edge cases not covered by chain.test.ts
// ============================================================================

describe("parseBlockId edge cases", () => {
	it.effect("parses 'pending' tag", () =>
		Effect.gen(function* () {
			const result = yield* parseBlockId("pending")
			expect(result.method).toBe("eth_getBlockByNumber")
			expect(result.params[0]).toBe("pending")
			expect(result.params[1]).toBe(true)
		}),
	)

	it.effect("parses 'safe' tag", () =>
		Effect.gen(function* () {
			const result = yield* parseBlockId("safe")
			expect(result.method).toBe("eth_getBlockByNumber")
			expect(result.params[0]).toBe("safe")
			expect(result.params[1]).toBe(true)
		}),
	)

	it.effect("parses 'finalized' tag", () =>
		Effect.gen(function* () {
			const result = yield* parseBlockId("finalized")
			expect(result.method).toBe("eth_getBlockByNumber")
			expect(result.params[0]).toBe("finalized")
			expect(result.params[1]).toBe(true)
		}),
	)

	it.effect("fails on invalid hex like 0xZZZZ", () =>
		Effect.gen(function* () {
			const error = yield* parseBlockId("0xZZZZ").pipe(Effect.flip)
			expect(error._tag).toBe("InvalidBlockIdError")
			expect(error).toBeInstanceOf(InvalidBlockIdError)
			expect(error.message).toContain("0xZZZZ")
		}),
	)

	it.effect("fails on arbitrary text like 'hello world'", () =>
		Effect.gen(function* () {
			const error = yield* parseBlockId("hello world").pipe(Effect.flip)
			expect(error._tag).toBe("InvalidBlockIdError")
		}),
	)

	it.effect("parses zero as decimal", () =>
		Effect.gen(function* () {
			const result = yield* parseBlockId("0")
			expect(result.method).toBe("eth_getBlockByNumber")
			expect(result.params[0]).toBe("0x0")
		}),
	)

	it.effect("parses large decimal block number", () =>
		Effect.gen(function* () {
			const result = yield* parseBlockId("1000000")
			expect(result.method).toBe("eth_getBlockByNumber")
			expect(result.params[0]).toBe("0xf4240")
		}),
	)

	it.effect("parses 0x0 as hex block number", () =>
		Effect.gen(function* () {
			const result = yield* parseBlockId("0x0")
			expect(result.method).toBe("eth_getBlockByNumber")
			expect(result.params[0]).toBe("0x0")
		}),
	)

	it.effect("fails on 0x prefix with invalid hex characters", () =>
		Effect.gen(function* () {
			const error = yield* parseBlockId("0xGHI").pipe(Effect.flip)
			expect(error._tag).toBe("InvalidBlockIdError")
		}),
	)
})

// ============================================================================
// blockHandler — block not found for very high block number
// ============================================================================

describe("blockHandler — not found cases", () => {
	it.effect("fails with InvalidBlockIdError for block number beyond chain tip", () =>
		Effect.gen(function* () {
			const { server, url } = yield* setupBare
			try {
				const error = yield* blockHandler(url, "999999").pipe(Effect.flip)
				// Should fail because block 999999 does not exist on a fresh devnet
				expect(error._tag).toBe("InvalidBlockIdError")
				expect(error.message).toContain("999999")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("fails with InvalidBlockIdError for hex block number beyond chain tip", () =>
		Effect.gen(function* () {
			const { server, url } = yield* setupBare
			try {
				const error = yield* blockHandler(url, "0xffffff").pipe(Effect.flip)
				expect(error._tag).toBe("InvalidBlockIdError")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("fails for non-existent block hash", () =>
		Effect.gen(function* () {
			const { server, url } = yield* setupBare
			try {
				const fakeHash = `0x${"de".repeat(32)}`
				const error = yield* blockHandler(url, fakeHash).pipe(Effect.flip)
				expect(error._tag).toBe("InvalidBlockIdError")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

// ============================================================================
// logsHandler — with address and topics params
// ============================================================================

describe("logsHandler — with filter options", () => {
	it.effect("returns empty array with address filter on devnet", () =>
		Effect.gen(function* () {
			const { server, url } = yield* setupBare
			try {
				const result = yield* logsHandler(url, {
					address: `0x${"11".repeat(20)}`,
					fromBlock: "earliest",
					toBlock: "latest",
				})
				expect(Array.isArray(result)).toBe(true)
				expect(result.length).toBe(0)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("returns empty array with topics filter on devnet", () =>
		Effect.gen(function* () {
			const { server, url } = yield* setupBare
			try {
				const result = yield* logsHandler(url, {
					topics: [`0x${"aa".repeat(32)}`],
					fromBlock: "earliest",
					toBlock: "latest",
				})
				expect(Array.isArray(result)).toBe(true)
				expect(result.length).toBe(0)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("returns empty array with both address and topics filter", () =>
		Effect.gen(function* () {
			const { server, url } = yield* setupBare
			try {
				const result = yield* logsHandler(url, {
					address: `0x${"22".repeat(20)}`,
					topics: [`0x${"bb".repeat(32)}`, `0x${"cc".repeat(32)}`],
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

	it.effect("defaults fromBlock/toBlock to latest when not specified", () =>
		Effect.gen(function* () {
			const { server, url } = yield* setupBare
			try {
				// Call with empty opts — logsHandler defaults fromBlock/toBlock to "latest"
				const result = yield* logsHandler(url, {})
				expect(Array.isArray(result)).toBe(true)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

// ============================================================================
// findBlockHandler — binary search with multiple blocks
// ============================================================================

describe("findBlockHandler — binary search path", () => {
	it.effect("finds correct block with multiple blocks mined", () =>
		Effect.gen(function* () {
			const { server, url, node } = yield* setupBare
			try {
				const from = node.accounts[0]!.address
				const to = node.accounts[1]!.address

				// Mine several blocks by sending transactions
				yield* sendHandler(url, to, from, undefined, [], "0")
				yield* sendHandler(url, to, from, undefined, [], "0")
				yield* sendHandler(url, to, from, undefined, [], "0")
				yield* sendHandler(url, to, from, undefined, [], "0")

				// Get the latest block to know its timestamp
				const latest = yield* blockHandler(url, "latest")
				const latestNumber = Number(BigInt(latest.number as string))
				const latestTs = Number(BigInt(latest.timestamp as string))

				// We should have at least 4 blocks
				expect(latestNumber).toBeGreaterThanOrEqual(4)

				// Search for the latest timestamp — should return the latest block number
				const result = yield* findBlockHandler(url, String(latestTs))
				expect(Number(result)).toBe(latestNumber)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("returns latest block number for a far-future timestamp", () =>
		Effect.gen(function* () {
			const { server, url, node } = yield* setupBare
			try {
				const from = node.accounts[0]!.address
				const to = node.accounts[1]!.address

				// Mine a couple of blocks
				yield* sendHandler(url, to, from, undefined, [], "0")
				yield* sendHandler(url, to, from, undefined, [], "0")

				const latest = yield* blockHandler(url, "latest")
				const latestNumber = Number(BigInt(latest.number as string))

				// Far future timestamp should return latest block
				const result = yield* findBlockHandler(url, "99999999999")
				expect(Number(result)).toBe(latestNumber)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("returns 0 for timestamp at or before genesis", () =>
		Effect.gen(function* () {
			const { server, url, node } = yield* setupBare
			try {
				const from = node.accounts[0]!.address
				const to = node.accounts[1]!.address

				// Mine some blocks so the chain has history
				yield* sendHandler(url, to, from, undefined, [], "0")
				yield* sendHandler(url, to, from, undefined, [], "0")

				// Get genesis timestamp
				const genesis = yield* blockHandler(url, "0")
				const genesisTs = Number(BigInt(genesis.timestamp as string))

				// Searching for genesis timestamp should return 0
				const result = yield* findBlockHandler(url, String(genesisTs))
				expect(result).toBe("0")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("finds a mid-chain block by timestamp with binary search", () =>
		Effect.gen(function* () {
			const { server, url, node } = yield* setupBare
			try {
				const from = node.accounts[0]!.address
				const to = node.accounts[1]!.address

				// Mine several blocks
				yield* sendHandler(url, to, from, undefined, [], "0")
				yield* sendHandler(url, to, from, undefined, [], "0")
				yield* sendHandler(url, to, from, undefined, [], "0")
				yield* sendHandler(url, to, from, undefined, [], "0")
				yield* sendHandler(url, to, from, undefined, [], "0")

				// Get the timestamp of block 3 (mid-chain)
				const block3 = yield* blockHandler(url, "3")
				const block3Ts = Number(BigInt(block3.timestamp as string))

				// Search for block 3's exact timestamp
				const result = yield* findBlockHandler(url, String(block3Ts))
				// Should return block 3 (or a block with the same timestamp)
				expect(Number(result)).toBeGreaterThanOrEqual(3)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("fails with InvalidTimestampError for Infinity", () =>
		Effect.gen(function* () {
			const { server, url } = yield* setupBare
			try {
				const error = yield* findBlockHandler(url, "Infinity").pipe(Effect.flip)
				expect(error._tag).toBe("InvalidTimestampError")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

// ============================================================================
// txHandler + receiptHandler integration — verify fields match
// ============================================================================

describe("txHandler + receiptHandler integration", () => {
	it.effect("tx and receipt for the same hash reference the same block", () =>
		Effect.gen(function* () {
			const { server, url, txHash } = yield* setupWithTx
			try {
				const tx = yield* txHandler(url, txHash)
				const receipt = yield* receiptHandler(url, txHash)

				// Both should reference the same block number
				expect(tx.blockNumber).toBe(receipt.blockNumber)
				// The receipt's transactionHash should match the tx hash
				expect(receipt.transactionHash).toBe(tx.hash)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("receipt status is 0x1 for a simple successful transfer", () =>
		Effect.gen(function* () {
			const { server, url, txHash } = yield* setupWithTx
			try {
				const receipt = yield* receiptHandler(url, txHash)
				expect(receipt.status).toBe("0x1")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})
