import { FetchHttpClient } from "@effect/platform"
import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../../node/index.js"
import { startRpcServer } from "../../rpc/server.js"
import { runCli } from "../test-helpers.js"
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
