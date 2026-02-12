import { FetchHttpClient } from "@effect/platform"
import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { afterAll, beforeAll, expect } from "vitest"
import { TevmNode, TevmNodeService } from "../../node/index.js"
import { startRpcServer } from "../../rpc/server.js"
import { type TestServer, runCli, startTestServer } from "../test-helpers.js"
import {
	balanceHandler,
	blockNumberHandler,
	callHandler,
	chainIdHandler,
	codeHandler,
	nonceHandler,
	storageHandler,
} from "./rpc.js"

// ============================================================================
// Handler tests — chainIdHandler
// ============================================================================

describe("chainIdHandler", () => {
	it.effect("returns chain ID as decimal string", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const result = yield* chainIdHandler(`http://127.0.0.1:${server.port}`)
				expect(result).toBe("31337")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

// ============================================================================
// Handler tests — blockNumberHandler
// ============================================================================

describe("blockNumberHandler", () => {
	it.effect("returns block number as decimal string", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const result = yield* blockNumberHandler(`http://127.0.0.1:${server.port}`)
				expect(result).toBe("0")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

// ============================================================================
// Handler tests — balanceHandler
// ============================================================================

describe("balanceHandler", () => {
	it.effect("returns balance as decimal wei string", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const result = yield* balanceHandler(
					`http://127.0.0.1:${server.port}`,
					"0x0000000000000000000000000000000000000000",
				)
				expect(result).toBe("0")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

// ============================================================================
// Handler tests — nonceHandler
// ============================================================================

describe("nonceHandler", () => {
	it.effect("returns nonce as decimal string", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const result = yield* nonceHandler(
					`http://127.0.0.1:${server.port}`,
					"0x0000000000000000000000000000000000000000",
				)
				expect(result).toBe("0")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

// ============================================================================
// Handler tests — codeHandler
// ============================================================================

describe("codeHandler", () => {
	it.effect("returns code as hex string", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const result = yield* codeHandler(
					`http://127.0.0.1:${server.port}`,
					"0x0000000000000000000000000000000000000000",
				)
				expect(result).toBe("0x")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

// ============================================================================
// Handler tests — storageHandler
// ============================================================================

describe("storageHandler", () => {
	it.effect("returns storage value as hex string", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const result = yield* storageHandler(
					`http://127.0.0.1:${server.port}`,
					"0x0000000000000000000000000000000000000000",
					"0x0000000000000000000000000000000000000000000000000000000000000000",
				)
				expect(result).toBe("0x0000000000000000000000000000000000000000000000000000000000000000")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

// ============================================================================
// Handler tests — callHandler
// ============================================================================

describe("callHandler", () => {
	it.effect("calls with raw calldata (no sig)", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				// eth_call with empty data to zero address should return 0x
				const result = yield* callHandler(
					`http://127.0.0.1:${server.port}`,
					"0x0000000000000000000000000000000000000000",
					undefined,
					[],
				)
				expect(result).toBe("0x")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

// ============================================================================
// CLI E2E tests (using runCli helper)
// ============================================================================

describe("CLI E2E — RPC commands", () => {
	// Note: These E2E tests need a running RPC server.
	// For true E2E, we'd start a server in the background.
	// Instead, we test against an invalid URL to verify error handling.

	it("chain-id with invalid URL exits non-zero", () => {
		const result = runCli("chain-id -r http://127.0.0.1:1")
		expect(result.exitCode).not.toBe(0)
		expect(result.stderr).toContain("RPC request failed")
	})

	it("block-number with invalid URL exits non-zero", () => {
		const result = runCli("block-number -r http://127.0.0.1:1")
		expect(result.exitCode).not.toBe(0)
		expect(result.stderr).toContain("RPC request failed")
	})

	it("balance with invalid URL exits non-zero", () => {
		const result = runCli("balance 0x0000000000000000000000000000000000000000 -r http://127.0.0.1:1")
		expect(result.exitCode).not.toBe(0)
		expect(result.stderr).toContain("RPC request failed")
	})

	it("nonce with invalid URL exits non-zero", () => {
		const result = runCli("nonce 0x0000000000000000000000000000000000000000 -r http://127.0.0.1:1")
		expect(result.exitCode).not.toBe(0)
		expect(result.stderr).toContain("RPC request failed")
	})

	it("code with invalid URL exits non-zero", () => {
		const result = runCli("code 0x0000000000000000000000000000000000000000 -r http://127.0.0.1:1")
		expect(result.exitCode).not.toBe(0)
		expect(result.stderr).toContain("RPC request failed")
	})

	it("storage with invalid URL exits non-zero", () => {
		const result = runCli(
			"storage 0x0000000000000000000000000000000000000000 0x0000000000000000000000000000000000000000000000000000000000000000 -r http://127.0.0.1:1",
		)
		expect(result.exitCode).not.toBe(0)
		expect(result.stderr).toContain("RPC request failed")
	})

	it("call with invalid URL exits non-zero", () => {
		const result = runCli("call --to 0x0000000000000000000000000000000000000000 -r http://127.0.0.1:1")
		expect(result.exitCode).not.toBe(0)
		expect(result.stderr).toContain("RPC request failed")
	})
})

// ============================================================================
// JSON output tests (using runCli with --json flag against invalid URL)
// ============================================================================

describe("CLI E2E — --json flag error output", () => {
	it("chain-id --json with invalid URL exits non-zero", () => {
		const result = runCli("chain-id -r http://127.0.0.1:1 --json")
		expect(result.exitCode).not.toBe(0)
	})
})

// ============================================================================
// CLI E2E success tests (using runCli with a running RPC server)
// ============================================================================

const ZERO_ADDR = "0x0000000000000000000000000000000000000000"
const ZERO_SLOT = "0x0000000000000000000000000000000000000000000000000000000000000000"
const CONTRACT_ADDR = `0x${"00".repeat(19)}42`

describe("CLI E2E — RPC success with running server", () => {
	let server: TestServer

	beforeAll(async () => {
		server = await startTestServer()
	}, 15_000)

	afterAll(() => {
		server?.kill()
	})

	// Issue 1: true CLI E2E success tests using runCli() against a running server

	it("chop chain-id returns correct value", () => {
		const result = runCli(`chain-id -r http://127.0.0.1:${server.port}`)
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("31337")
	})

	it("chop block-number returns correct value", () => {
		const result = runCli(`block-number -r http://127.0.0.1:${server.port}`)
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("0")
	})

	it("chop balance returns correct value", () => {
		const result = runCli(`balance ${ZERO_ADDR} -r http://127.0.0.1:${server.port}`)
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("0")
	})

	it("chop nonce returns correct value", () => {
		const result = runCli(`nonce ${ZERO_ADDR} -r http://127.0.0.1:${server.port}`)
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("0")
	})

	it("chop code returns correct value for EOA", () => {
		const result = runCli(`code ${ZERO_ADDR} -r http://127.0.0.1:${server.port}`)
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("0x")
	})

	it("chop storage returns correct value", () => {
		const result = runCli(`storage ${ZERO_ADDR} ${ZERO_SLOT} -r http://127.0.0.1:${server.port}`)
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe(ZERO_SLOT)
	})

	// Issue 2: E2E test — start server → deploy contract → chop call → correct return

	it("chop call against deployed contract returns correct result", () => {
		const result = runCli(`call --to ${CONTRACT_ADDR} -r http://127.0.0.1:${server.port}`)
		expect(result.exitCode).toBe(0)
		// Contract returns 0x42 as a 32-byte word
		expect(result.stdout.trim()).toContain("42")
	})

	it("chop code returns bytecode for deployed contract", () => {
		const result = runCli(`code ${CONTRACT_ADDR} -r http://127.0.0.1:${server.port}`)
		expect(result.exitCode).toBe(0)
		// Contract bytecode: 604260005260206000f3
		expect(result.stdout.trim()).toContain("604260005260206000f3")
	})

	// Issue 3: --json flag success tests with structured JSON output

	it("chop chain-id --json outputs structured JSON", () => {
		const result = runCli(`chain-id -r http://127.0.0.1:${server.port} --json`)
		expect(result.exitCode).toBe(0)
		const json = JSON.parse(result.stdout.trim())
		expect(json).toEqual({ chainId: "31337" })
	})

	it("chop block-number --json outputs structured JSON", () => {
		const result = runCli(`block-number -r http://127.0.0.1:${server.port} --json`)
		expect(result.exitCode).toBe(0)
		const json = JSON.parse(result.stdout.trim())
		expect(json).toEqual({ blockNumber: "0" })
	})

	it("chop balance --json outputs structured JSON", () => {
		const result = runCli(`balance ${ZERO_ADDR} -r http://127.0.0.1:${server.port} --json`)
		expect(result.exitCode).toBe(0)
		const json = JSON.parse(result.stdout.trim())
		expect(json).toEqual({ address: ZERO_ADDR, balance: "0" })
	})

	it("chop nonce --json outputs structured JSON", () => {
		const result = runCli(`nonce ${ZERO_ADDR} -r http://127.0.0.1:${server.port} --json`)
		expect(result.exitCode).toBe(0)
		const json = JSON.parse(result.stdout.trim())
		expect(json).toEqual({ address: ZERO_ADDR, nonce: "0" })
	})

	it("chop call --json outputs structured JSON", () => {
		const result = runCli(`call --to ${CONTRACT_ADDR} -r http://127.0.0.1:${server.port} --json`)
		expect(result.exitCode).toBe(0)
		const json = JSON.parse(result.stdout.trim())
		expect(json.to).toBe(CONTRACT_ADDR)
		expect(json.result).toContain("42")
	})
})
