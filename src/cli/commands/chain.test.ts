import { FetchHttpClient } from "@effect/platform"
import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { afterAll, beforeAll, expect } from "vitest"
import { TevmNode, TevmNodeService } from "../../node/index.js"
import { startRpcServer } from "../../rpc/server.js"
import { type TestServer, runCli, startTestServer } from "../test-helpers.js"
import {
	baseFeeHandler,
	blockHandler,
	findBlockHandler,
	gasPriceHandler,
	logsHandler,
	parseBlockId,
} from "./chain.js"
import { sendHandler } from "./rpc.js"

// ============================================================================
// Handler tests — parseBlockId
// ============================================================================

describe("parseBlockId", () => {
	it.effect("parses 'latest' as tag", () =>
		Effect.gen(function* () {
			const result = yield* parseBlockId("latest")
			expect(result.method).toBe("eth_getBlockByNumber")
			expect(result.params[0]).toBe("latest")
		}),
	)

	it.effect("parses 'earliest' as tag", () =>
		Effect.gen(function* () {
			const result = yield* parseBlockId("earliest")
			expect(result.method).toBe("eth_getBlockByNumber")
			expect(result.params[0]).toBe("earliest")
		}),
	)

	it.effect("parses decimal number", () =>
		Effect.gen(function* () {
			const result = yield* parseBlockId("42")
			expect(result.method).toBe("eth_getBlockByNumber")
			expect(result.params[0]).toBe("0x2a")
		}),
	)

	it.effect("parses hex number", () =>
		Effect.gen(function* () {
			const result = yield* parseBlockId("0x2a")
			expect(result.method).toBe("eth_getBlockByNumber")
			expect(result.params[0]).toBe("0x2a")
		}),
	)

	it.effect("parses 66-char block hash", () =>
		Effect.gen(function* () {
			const hash = `0x${"ab".repeat(32)}`
			const result = yield* parseBlockId(hash)
			expect(result.method).toBe("eth_getBlockByHash")
			expect(result.params[0]).toBe(hash)
		}),
	)

	it.effect("fails on invalid block ID", () =>
		Effect.gen(function* () {
			const error = yield* parseBlockId("not-a-block").pipe(Effect.flip)
			expect(error._tag).toBe("InvalidBlockIdError")
		}),
	)
})

// ============================================================================
// Handler tests — blockHandler
// ============================================================================

describe("blockHandler", () => {
	it.effect("returns genesis block data", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const result = yield* blockHandler(`http://127.0.0.1:${server.port}`, "latest")
				expect(result["number"]).toBe("0x0")
				expect(result).toHaveProperty("hash")
				expect(result).toHaveProperty("timestamp")
				expect(result).toHaveProperty("gasLimit")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("returns block by decimal number", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const result = yield* blockHandler(`http://127.0.0.1:${server.port}`, "0")
				expect(result["number"]).toBe("0x0")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

// ============================================================================
// Handler tests — gasPriceHandler
// ============================================================================

describe("gasPriceHandler", () => {
	it.effect("returns gas price as decimal string", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const result = yield* gasPriceHandler(`http://127.0.0.1:${server.port}`)
				expect(Number(result)).toBeGreaterThanOrEqual(0)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

// ============================================================================
// Handler tests — baseFeeHandler
// ============================================================================

describe("baseFeeHandler", () => {
	it.effect("returns base fee as decimal string", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const result = yield* baseFeeHandler(`http://127.0.0.1:${server.port}`)
				expect(Number(result)).toBeGreaterThanOrEqual(0)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

// ============================================================================
// Handler tests — logsHandler
// ============================================================================

describe("logsHandler", () => {
	it.effect("returns empty array when no logs match", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const result = yield* logsHandler(`http://127.0.0.1:${server.port}`, {
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
})

// ============================================================================
// Handler tests — findBlockHandler
// ============================================================================

describe("findBlockHandler", () => {
	it.effect("returns 0 for genesis timestamp", () =>
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

	it.effect("returns latest block for very large timestamp", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const result = yield* findBlockHandler(`http://127.0.0.1:${server.port}`, "9999999999")
				expect(result).toBe("0") // only genesis block exists
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("fails on invalid timestamp", () =>
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

	it.effect("fails on negative timestamp", () =>
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
})

// ============================================================================
// CLI E2E tests — error handling with invalid URL
// ============================================================================

describe("CLI E2E — chain commands error handling", () => {
	it("block with invalid URL exits non-zero", () => {
		const result = runCli("block latest -r http://127.0.0.1:1")
		expect(result.exitCode).not.toBe(0)
	})

	it("tx with invalid URL exits non-zero", () => {
		const result = runCli(`tx 0x${"00".repeat(32)} -r http://127.0.0.1:1`)
		expect(result.exitCode).not.toBe(0)
	})

	it("receipt with invalid URL exits non-zero", () => {
		const result = runCli(`receipt 0x${"00".repeat(32)} -r http://127.0.0.1:1`)
		expect(result.exitCode).not.toBe(0)
	})

	it("logs with invalid URL exits non-zero", () => {
		const result = runCli("logs -r http://127.0.0.1:1")
		expect(result.exitCode).not.toBe(0)
	})

	it("gas-price with invalid URL exits non-zero", () => {
		const result = runCli("gas-price -r http://127.0.0.1:1")
		expect(result.exitCode).not.toBe(0)
	})

	it("base-fee with invalid URL exits non-zero", () => {
		const result = runCli("base-fee -r http://127.0.0.1:1")
		expect(result.exitCode).not.toBe(0)
	})

	it("find-block with invalid URL exits non-zero", () => {
		const result = runCli("find-block 0 -r http://127.0.0.1:1")
		expect(result.exitCode).not.toBe(0)
	})
})

// ============================================================================
// CLI E2E success tests with running server
// ============================================================================

describe("CLI E2E — chain commands success", () => {
	let server: TestServer

	beforeAll(async () => {
		server = await startTestServer()
	}, 15_000)

	afterAll(() => {
		server?.kill()
	})

	it("chop block latest returns block data", () => {
		const result = runCli(`block latest -r http://127.0.0.1:${server.port}`)
		expect(result.exitCode).toBe(0)
		expect(result.stdout).toContain("Block:")
		expect(result.stdout).toContain("Hash:")
	})

	it("chop block 0 returns genesis block", () => {
		const result = runCli(`block 0 -r http://127.0.0.1:${server.port}`)
		expect(result.exitCode).toBe(0)
		expect(result.stdout).toContain("Block:")
	})

	it("chop block --json outputs structured JSON", () => {
		const result = runCli(`block latest -r http://127.0.0.1:${server.port} --json`)
		expect(result.exitCode).toBe(0)
		const json = JSON.parse(result.stdout.trim())
		expect(json).toHaveProperty("number")
		expect(json).toHaveProperty("hash")
		expect(json).toHaveProperty("timestamp")
	})

	it("chop gas-price returns a number", () => {
		const result = runCli(`gas-price -r http://127.0.0.1:${server.port}`)
		expect(result.exitCode).toBe(0)
		expect(Number(result.stdout.trim())).toBeGreaterThanOrEqual(0)
	})

	it("chop gas-price --json outputs structured JSON", () => {
		const result = runCli(`gas-price -r http://127.0.0.1:${server.port} --json`)
		expect(result.exitCode).toBe(0)
		const json = JSON.parse(result.stdout.trim())
		expect(json).toHaveProperty("gasPrice")
	})

	it("chop base-fee returns a number", () => {
		const result = runCli(`base-fee -r http://127.0.0.1:${server.port}`)
		expect(result.exitCode).toBe(0)
		expect(Number(result.stdout.trim())).toBeGreaterThanOrEqual(0)
	})

	it("chop base-fee --json outputs structured JSON", () => {
		const result = runCli(`base-fee -r http://127.0.0.1:${server.port} --json`)
		expect(result.exitCode).toBe(0)
		const json = JSON.parse(result.stdout.trim())
		expect(json).toHaveProperty("baseFee")
	})

	it("chop logs returns empty result for devnet", () => {
		const result = runCli(`logs --from-block 0x0 --to-block latest -r http://127.0.0.1:${server.port}`)
		expect(result.exitCode).toBe(0)
		expect(result.stdout).toContain("No logs found")
	})

	it("chop logs --json returns empty array", () => {
		const result = runCli(`logs --from-block 0x0 --to-block latest -r http://127.0.0.1:${server.port} --json`)
		expect(result.exitCode).toBe(0)
		const json = JSON.parse(result.stdout.trim())
		expect(json).toEqual([])
	})

	it("chop find-block 0 returns block 0", () => {
		const result = runCli(`find-block 0 -r http://127.0.0.1:${server.port}`)
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("0")
	})

	it("chop find-block --json outputs structured JSON", () => {
		const result = runCli(`find-block 0 -r http://127.0.0.1:${server.port} --json`)
		expect(result.exitCode).toBe(0)
		const json = JSON.parse(result.stdout.trim())
		expect(json).toEqual({ blockNumber: "0" })
	})

	it("chop find-block with invalid timestamp exits non-zero", () => {
		const result = runCli(`find-block abc -r http://127.0.0.1:${server.port}`)
		expect(result.exitCode).not.toBe(0)
	})

	it("chop tx returns transaction data after sending", () => {
		const from = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
		// First send a transaction to create one
		const sendResult = runCli(
			`send --to 0x0000000000000000000000000000000000000000 --from ${from} -r http://127.0.0.1:${server.port} --json`,
		)
		expect(sendResult.exitCode).toBe(0)
		const { txHash } = JSON.parse(sendResult.stdout.trim())

		// Now query the transaction
		const result = runCli(`tx ${txHash} -r http://127.0.0.1:${server.port}`)
		expect(result.exitCode).toBe(0)
		expect(result.stdout).toContain("Hash:")
		expect(result.stdout).toContain("From:")
	})

	it("chop tx --json outputs structured JSON", () => {
		const from = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
		const sendResult = runCli(
			`send --to 0x0000000000000000000000000000000000000000 --from ${from} -r http://127.0.0.1:${server.port} --json`,
		)
		expect(sendResult.exitCode).toBe(0)
		const { txHash } = JSON.parse(sendResult.stdout.trim())

		const result = runCli(`tx ${txHash} -r http://127.0.0.1:${server.port} --json`)
		expect(result.exitCode).toBe(0)
		const json = JSON.parse(result.stdout.trim())
		expect(json).toHaveProperty("hash")
		expect(json).toHaveProperty("from")
	})

	it("chop receipt returns receipt data after sending", () => {
		const from = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
		const sendResult = runCli(
			`send --to 0x0000000000000000000000000000000000000000 --from ${from} -r http://127.0.0.1:${server.port} --json`,
		)
		expect(sendResult.exitCode).toBe(0)
		const { txHash } = JSON.parse(sendResult.stdout.trim())

		const result = runCli(`receipt ${txHash} -r http://127.0.0.1:${server.port}`)
		expect(result.exitCode).toBe(0)
		expect(result.stdout).toContain("Tx Hash:")
		expect(result.stdout).toContain("Status:")
	})

	it("chop receipt --json outputs structured JSON", () => {
		const from = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
		const sendResult = runCli(
			`send --to 0x0000000000000000000000000000000000000000 --from ${from} -r http://127.0.0.1:${server.port} --json`,
		)
		expect(sendResult.exitCode).toBe(0)
		const { txHash } = JSON.parse(sendResult.stdout.trim())

		const result = runCli(`receipt ${txHash} -r http://127.0.0.1:${server.port} --json`)
		expect(result.exitCode).toBe(0)
		const json = JSON.parse(result.stdout.trim())
		expect(json).toHaveProperty("transactionHash")
		expect(json).toHaveProperty("status")
	})
})
