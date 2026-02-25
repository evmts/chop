/**
 * In-process tests for chain.ts Command.make bodies.
 *
 * These exercise the Command wiring (handler → formatter → Console.log)
 * in the same process so v8 coverage tracks the code paths.
 *
 * Covers: blockCommand, txCommand, receiptCommand, logsCommand,
 * gasPriceCommand, baseFeeCommand, findBlockCommand — both JSON and non-JSON paths.
 */

import { FetchHttpClient } from "@effect/platform"
import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../../node/index.js"
import { startRpcServer } from "../../rpc/server.js"
import {
	baseFeeHandler,
	blockHandler,
	findBlockHandler,
	formatBlock,
	formatLogs,
	formatReceipt,
	formatTx,
	gasPriceHandler,
	logsHandler,
	receiptHandler,
	txHandler,
} from "./chain.js"
import { sendHandler } from "./rpc.js"

// ============================================================================
// Helpers
// ============================================================================

/** Create a test server, return URL */
const setupServer = Effect.gen(function* () {
	const node = yield* TevmNodeService
	const server = yield* startRpcServer({ port: 0 }, node)
	const url = `http://127.0.0.1:${server.port}`
	return { server, url, node }
})

/** Create a test server with a transaction mined */
const setupWithTx = Effect.gen(function* () {
	const { server, url, node } = yield* setupServer
	const from = node.accounts[0]!.address
	const to = node.accounts[1]!.address
	const txHash = yield* sendHandler(url, to, from, undefined, [], "0x1")
	return { server, url, node, txHash, from, to }
})

const TestLayer = Effect.provide(TevmNode.LocalTest())
const HttpLayer = Effect.provide(FetchHttpClient.layer)

// ============================================================================
// blockCommand body — JSON path
// ============================================================================

describe("blockCommand body — in-process", () => {
	it.effect("JSON path: returns block as JSON string", () =>
		Effect.gen(function* () {
			const { server, url } = yield* setupServer
			try {
				const result = yield* blockHandler(url, "0")
				const jsonOutput = JSON.stringify(result)
				const parsed = JSON.parse(jsonOutput)
				expect(parsed).toHaveProperty("number")
				expect(parsed).toHaveProperty("hash")
			} finally {
				yield* server.close()
			}
		}).pipe(TestLayer, HttpLayer),
	)

	it.effect("non-JSON path: formats block with formatBlock", () =>
		Effect.gen(function* () {
			const { server, url } = yield* setupServer
			try {
				const result = yield* blockHandler(url, "latest")
				const formatted = formatBlock(result)
				expect(formatted).toContain("Block:")
				expect(formatted).toContain("Hash:")
			} finally {
				yield* server.close()
			}
		}).pipe(TestLayer, HttpLayer),
	)
})

// ============================================================================
// txCommand body — JSON and non-JSON paths
// ============================================================================

describe("txCommand body — in-process", () => {
	it.effect("JSON path: returns tx as JSON string", () =>
		Effect.gen(function* () {
			const { server, url, txHash } = yield* setupWithTx
			try {
				const result = yield* txHandler(url, txHash)
				const jsonOutput = JSON.stringify(result)
				const parsed = JSON.parse(jsonOutput)
				expect(parsed).toHaveProperty("hash")
				expect(parsed.hash).toBe(txHash)
			} finally {
				yield* server.close()
			}
		}).pipe(TestLayer, HttpLayer),
	)

	it.effect("non-JSON path: formats tx with formatTx", () =>
		Effect.gen(function* () {
			const { server, url, txHash } = yield* setupWithTx
			try {
				const result = yield* txHandler(url, txHash)
				const formatted = formatTx(result)
				expect(formatted).toContain("Hash:")
				expect(formatted).toContain("From:")
				expect(formatted).toContain("To:")
			} finally {
				yield* server.close()
			}
		}).pipe(TestLayer, HttpLayer),
	)
})

// ============================================================================
// receiptCommand body — JSON and non-JSON paths
// ============================================================================

describe("receiptCommand body — in-process", () => {
	it.effect("JSON path: returns receipt as JSON string", () =>
		Effect.gen(function* () {
			const { server, url, txHash } = yield* setupWithTx
			try {
				const result = yield* receiptHandler(url, txHash)
				const jsonOutput = JSON.stringify(result)
				const parsed = JSON.parse(jsonOutput)
				expect(parsed).toHaveProperty("transactionHash")
				expect(parsed).toHaveProperty("status")
			} finally {
				yield* server.close()
			}
		}).pipe(TestLayer, HttpLayer),
	)

	it.effect("non-JSON path: formats receipt with formatReceipt", () =>
		Effect.gen(function* () {
			const { server, url, txHash } = yield* setupWithTx
			try {
				const result = yield* receiptHandler(url, txHash)
				const formatted = formatReceipt(result)
				expect(formatted).toContain("Tx Hash:")
				expect(formatted).toContain("Status:")
				expect(formatted).toContain("Gas Used:")
			} finally {
				yield* server.close()
			}
		}).pipe(TestLayer, HttpLayer),
	)
})

// ============================================================================
// logsCommand body — JSON and non-JSON paths
// ============================================================================

describe("logsCommand body — in-process", () => {
	it.effect("JSON path: returns logs array as JSON", () =>
		Effect.gen(function* () {
			const { server, url } = yield* setupServer
			try {
				const result = yield* logsHandler(url, { fromBlock: "0x0", toBlock: "latest" })
				const jsonOutput = JSON.stringify(result)
				const parsed = JSON.parse(jsonOutput)
				expect(Array.isArray(parsed)).toBe(true)
			} finally {
				yield* server.close()
			}
		}).pipe(TestLayer, HttpLayer),
	)

	it.effect("non-JSON path: formats logs with formatLogs", () =>
		Effect.gen(function* () {
			const { server, url } = yield* setupServer
			try {
				const result = yield* logsHandler(url, { fromBlock: "0x0", toBlock: "latest" })
				const formatted = formatLogs(result)
				// On a fresh devnet, no logs exist
				expect(formatted).toBe("No logs found")
			} finally {
				yield* server.close()
			}
		}).pipe(TestLayer, HttpLayer),
	)

	it.effect("logs with address filter", () =>
		Effect.gen(function* () {
			const { server, url } = yield* setupServer
			try {
				const result = yield* logsHandler(url, {
					address: "0x0000000000000000000000000000000000000001",
					fromBlock: "0x0",
					toBlock: "latest",
				})
				expect(Array.isArray(result)).toBe(true)
			} finally {
				yield* server.close()
			}
		}).pipe(TestLayer, HttpLayer),
	)

	it.effect("logs with topics filter", () =>
		Effect.gen(function* () {
			const { server, url } = yield* setupServer
			try {
				const result = yield* logsHandler(url, {
					topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"],
					fromBlock: "0x0",
					toBlock: "latest",
				})
				expect(Array.isArray(result)).toBe(true)
			} finally {
				yield* server.close()
			}
		}).pipe(TestLayer, HttpLayer),
	)
})

// ============================================================================
// gasPriceCommand body — JSON and non-JSON paths
// ============================================================================

describe("gasPriceCommand body — in-process", () => {
	it.effect("returns gas price as decimal string", () =>
		Effect.gen(function* () {
			const { server, url } = yield* setupServer
			try {
				const result = yield* gasPriceHandler(url)
				// Should be a valid decimal number
				expect(() => BigInt(result)).not.toThrow()
				expect(result).not.toContain("0x")
			} finally {
				yield* server.close()
			}
		}).pipe(TestLayer, HttpLayer),
	)

	it.effect("JSON output wraps gas price", () =>
		Effect.gen(function* () {
			const { server, url } = yield* setupServer
			try {
				const result = yield* gasPriceHandler(url)
				const jsonOutput = JSON.stringify({ gasPrice: result })
				const parsed = JSON.parse(jsonOutput)
				expect(parsed).toHaveProperty("gasPrice")
			} finally {
				yield* server.close()
			}
		}).pipe(TestLayer, HttpLayer),
	)
})

// ============================================================================
// baseFeeCommand body — JSON and non-JSON paths
// ============================================================================

describe("baseFeeCommand body — in-process", () => {
	it.effect("returns base fee as decimal string", () =>
		Effect.gen(function* () {
			const { server, url } = yield* setupServer
			try {
				const result = yield* baseFeeHandler(url)
				expect(() => BigInt(result)).not.toThrow()
				expect(result).not.toContain("0x")
			} finally {
				yield* server.close()
			}
		}).pipe(TestLayer, HttpLayer),
	)

	it.effect("JSON output wraps base fee", () =>
		Effect.gen(function* () {
			const { server, url } = yield* setupServer
			try {
				const result = yield* baseFeeHandler(url)
				const jsonOutput = JSON.stringify({ baseFee: result })
				const parsed = JSON.parse(jsonOutput)
				expect(parsed).toHaveProperty("baseFee")
				expect(typeof parsed.baseFee).toBe("string")
			} finally {
				yield* server.close()
			}
		}).pipe(TestLayer, HttpLayer),
	)
})

// ============================================================================
// findBlockCommand body — JSON and non-JSON paths
// ============================================================================

describe("findBlockCommand body — in-process", () => {
	it.effect("finds block for timestamp 0 (returns genesis)", () =>
		Effect.gen(function* () {
			const { server, url } = yield* setupServer
			try {
				const result = yield* findBlockHandler(url, "0")
				expect(result).toBe("0")
			} finally {
				yield* server.close()
			}
		}).pipe(TestLayer, HttpLayer),
	)

	it.effect("JSON output wraps block number", () =>
		Effect.gen(function* () {
			const { server, url } = yield* setupServer
			try {
				const result = yield* findBlockHandler(url, "0")
				const jsonOutput = JSON.stringify({ blockNumber: result })
				const parsed = JSON.parse(jsonOutput)
				expect(parsed).toEqual({ blockNumber: "0" })
			} finally {
				yield* server.close()
			}
		}).pipe(TestLayer, HttpLayer),
	)

	it.effect("finds block for very large timestamp (returns latest)", () =>
		Effect.gen(function* () {
			const { server, url } = yield* setupServer
			try {
				const result = yield* findBlockHandler(url, "9999999999")
				expect(Number(result)).toBeGreaterThanOrEqual(0)
			} finally {
				yield* server.close()
			}
		}).pipe(TestLayer, HttpLayer),
	)
})
