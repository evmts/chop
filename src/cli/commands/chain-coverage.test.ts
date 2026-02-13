import { FetchHttpClient } from "@effect/platform"
import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../../node/index.js"
import { startRpcServer } from "../../rpc/server.js"
import {
	txHandler,
	receiptHandler,
	findBlockHandler,
	blockHandler,
	parseBlockId,
	logsHandler,
	gasPriceHandler,
	baseFeeHandler,
	InvalidBlockIdError,
	InvalidTimestampError,
} from "./chain.js"
import { sendHandler } from "./rpc.js"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a test RPC server and send a simple transaction, returning the URL and tx hash. */
const setupWithTx = Effect.gen(function* () {
	const node = yield* TevmNodeService
	const server = yield* startRpcServer({ port: 0 }, node)
	const url = `http://127.0.0.1:${server.port}`

	// Send a simple ETH transfer
	const from = node.accounts[0]!.address
	const to = node.accounts[1]!.address
	const txHash = yield* sendHandler(url, to, from, undefined, [], "0")

	return { server, url, txHash, node }
})

// ---------------------------------------------------------------------------
// txHandler — covers lines 189-199
// ---------------------------------------------------------------------------

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
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("fails with TransactionNotFoundError for unknown hash", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const error = yield* txHandler(
					`http://127.0.0.1:${server.port}`,
					`0x${"00".repeat(32)}`,
				).pipe(Effect.flip)
				expect(error._tag).toBe("TransactionNotFoundError")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

// ---------------------------------------------------------------------------
// receiptHandler — covers lines 204-214
// ---------------------------------------------------------------------------

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

	it.effect("fails with ReceiptNotFoundError for unknown hash", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const error = yield* receiptHandler(
					`http://127.0.0.1:${server.port}`,
					`0x${"00".repeat(32)}`,
				).pipe(Effect.flip)
				expect(error._tag).toBe("ReceiptNotFoundError")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

// ---------------------------------------------------------------------------
// findBlockHandler — binary search path (covers lines 286-301)
// ---------------------------------------------------------------------------

describe("findBlockHandler — binary search", () => {
	it.effect("finds block by timestamp with multiple blocks", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			const url = `http://127.0.0.1:${server.port}`
			try {
				const from = node.accounts[0]!.address
				const to = node.accounts[1]!.address

				// Mine several blocks to create a chain with different timestamps
				yield* sendHandler(url, to, from, undefined, [], "0")
				yield* sendHandler(url, to, from, undefined, [], "0")
				yield* sendHandler(url, to, from, undefined, [], "0")

				// Get the latest block timestamp
				const block = yield* blockHandler(url, "latest")
				const latestTs = Number(BigInt(block.timestamp as string))

				// Search for the latest timestamp — should find a block
				const result = yield* findBlockHandler(url, String(latestTs))
				expect(Number(result)).toBeGreaterThan(0)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("returns 0 for timestamp before genesis", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const result = yield* findBlockHandler(`http://127.0.0.1:${server.port}`, "0")
				expect(result).toBe("0")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("returns latest block for future timestamp", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			const url = `http://127.0.0.1:${server.port}`
			try {
				const result = yield* findBlockHandler(url, "9999999999")
				expect(result).toBe("0") // Only genesis exists
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("fails with InvalidTimestampError for negative timestamp", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const error = yield* findBlockHandler(`http://127.0.0.1:${server.port}`, "-1").pipe(Effect.flip)
				expect(error._tag).toBe("InvalidTimestampError")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("fails with InvalidTimestampError for non-numeric timestamp", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const error = yield* findBlockHandler(`http://127.0.0.1:${server.port}`, "abc").pipe(Effect.flip)
				expect(error._tag).toBe("InvalidTimestampError")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

// ---------------------------------------------------------------------------
// parseBlockId — covers lines 56-88
// ---------------------------------------------------------------------------

describe("parseBlockId", () => {
	it.effect("parses block tag 'latest'", () =>
		Effect.gen(function* () {
			const result = yield* parseBlockId("latest")
			expect(result.method).toBe("eth_getBlockByNumber")
			expect(result.params[0]).toBe("latest")
		}),
	)

	it.effect("parses block tag 'earliest'", () =>
		Effect.gen(function* () {
			const result = yield* parseBlockId("earliest")
			expect(result.method).toBe("eth_getBlockByNumber")
			expect(result.params[0]).toBe("earliest")
		}),
	)

	it.effect("parses block tag 'pending'", () =>
		Effect.gen(function* () {
			const result = yield* parseBlockId("pending")
			expect(result.method).toBe("eth_getBlockByNumber")
			expect(result.params[0]).toBe("pending")
		}),
	)

	it.effect("parses block tag 'safe'", () =>
		Effect.gen(function* () {
			const result = yield* parseBlockId("safe")
			expect(result.method).toBe("eth_getBlockByNumber")
			expect(result.params[0]).toBe("safe")
		}),
	)

	it.effect("parses block tag 'finalized'", () =>
		Effect.gen(function* () {
			const result = yield* parseBlockId("finalized")
			expect(result.method).toBe("eth_getBlockByNumber")
			expect(result.params[0]).toBe("finalized")
		}),
	)

	it.effect("parses 66-char hex block hash", () =>
		Effect.gen(function* () {
			const blockHash = `0x${"ab".repeat(32)}`
			const result = yield* parseBlockId(blockHash)
			expect(result.method).toBe("eth_getBlockByHash")
			expect(result.params[0]).toBe(blockHash)
		}),
	)

	it.effect("parses hex block number", () =>
		Effect.gen(function* () {
			const result = yield* parseBlockId("0xa")
			expect(result.method).toBe("eth_getBlockByNumber")
			expect(result.params[0]).toBe("0xa")
		}),
	)

	it.effect("fails on invalid hex", () =>
		Effect.gen(function* () {
			const error = yield* parseBlockId("0xzzzz").pipe(Effect.flip)
			expect(error).toBeInstanceOf(InvalidBlockIdError)
		}),
	)

	it.effect("parses decimal block number", () =>
		Effect.gen(function* () {
			const result = yield* parseBlockId("100")
			expect(result.method).toBe("eth_getBlockByNumber")
			expect(result.params[0]).toBe("0x64")
		}),
	)

	it.effect("fails on non-numeric string", () =>
		Effect.gen(function* () {
			const error = yield* parseBlockId("foobar").pipe(Effect.flip)
			expect(error).toBeInstanceOf(InvalidBlockIdError)
		}),
	)
})

// ---------------------------------------------------------------------------
// blockHandler — covers lines 173-184
// ---------------------------------------------------------------------------

describe("blockHandler", () => {
	it.effect("returns genesis block by number '0'", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const result = yield* blockHandler(`http://127.0.0.1:${server.port}`, "0")
				expect(result).toHaveProperty("number")
				expect(result).toHaveProperty("hash")
				expect(result).toHaveProperty("timestamp")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("returns block by 'latest' tag", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const result = yield* blockHandler(`http://127.0.0.1:${server.port}`, "latest")
				expect(result).toHaveProperty("number")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

// ---------------------------------------------------------------------------
// logsHandler — covers lines 219-237
// ---------------------------------------------------------------------------

describe("logsHandler", () => {
	it.effect("returns empty logs when no matching events", () =>
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

	it.effect("accepts address and topics filter options", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const result = yield* logsHandler(`http://127.0.0.1:${server.port}`, {
					address: `0x${"11".repeat(20)}`,
					topics: [`0x${"aa".repeat(32)}`],
					fromBlock: "earliest",
					toBlock: "latest",
				})
				expect(Array.isArray(result)).toBe(true)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

// ---------------------------------------------------------------------------
// gasPriceHandler — covers line 242-243
// ---------------------------------------------------------------------------

describe("gasPriceHandler", () => {
	it.effect("returns gas price as a decimal string", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const result = yield* gasPriceHandler(`http://127.0.0.1:${server.port}`)
				expect(typeof result).toBe("string")
				// Should be a decimal number string
				expect(Number(result)).toBeGreaterThanOrEqual(0)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

// ---------------------------------------------------------------------------
// baseFeeHandler — covers lines 248-258
// ---------------------------------------------------------------------------

describe("baseFeeHandler", () => {
	it.effect("returns base fee as a decimal string", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const result = yield* baseFeeHandler(`http://127.0.0.1:${server.port}`)
				expect(typeof result).toBe("string")
				expect(Number(result)).toBeGreaterThanOrEqual(0)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})
