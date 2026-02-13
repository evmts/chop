import { FetchHttpClient } from "@effect/platform"
import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { afterAll, beforeAll, expect } from "vitest"
import { hexToBytes } from "../../evm/conversions.js"
import { TevmNode, TevmNodeService } from "../../node/index.js"
import { startRpcServer } from "../../rpc/server.js"
import { type TestServer, runCli, startTestServer } from "../test-helpers.js"
import {
	balanceHandler,
	blockNumberHandler,
	callHandler,
	chainIdHandler,
	codeHandler,
	estimateHandler,
	nonceHandler,
	rpcGenericHandler,
	sendHandler,
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

// ============================================================================
// Additional coverage: callHandler with signature, JSON outputs, hexToDecimal
// ============================================================================

describe("callHandler — with function signature", () => {
	it.effect("calls with signature and decodes output", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			// Deploy contract at 0x00...42 that returns 0x42 as a 32-byte word
			const contractAddr = `0x${"00".repeat(19)}42`
			const contractCode = new Uint8Array([0x60, 0x42, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3])
			yield* node.hostAdapter.setAccount(hexToBytes(contractAddr), {
				nonce: 0n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: contractCode,
			})

			try {
				// Call with a signature that has output types → decodes the result
				const result = yield* callHandler(`http://127.0.0.1:${server.port}`, contractAddr, "getValue()(uint256)", [])
				// Should decode the uint256 output
				expect(result).toContain("66") // 0x42 = 66 decimal
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("calls with signature that has no output types", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			const contractAddr = `0x${"00".repeat(19)}42`
			const contractCode = new Uint8Array([0x60, 0x42, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3])
			yield* node.hostAdapter.setAccount(hexToBytes(contractAddr), {
				nonce: 0n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: contractCode,
			})

			try {
				// Call with a signature that has NO output types → returns raw hex
				const result = yield* callHandler(`http://127.0.0.1:${server.port}`, contractAddr, "getValue()", [])
				// Should return raw hex since no output types
				expect(result).toContain("42")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("calls with signature and args to encode calldata", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			// This contract just returns whatever it receives
			const contractAddr = `0x${"00".repeat(19)}42`
			const contractCode = new Uint8Array([0x60, 0x42, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3])
			yield* node.hostAdapter.setAccount(hexToBytes(contractAddr), {
				nonce: 0n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: contractCode,
			})

			try {
				const result = yield* callHandler(
					`http://127.0.0.1:${server.port}`,
					contractAddr,
					"balanceOf(address)(uint256)",
					["0x0000000000000000000000000000000000000001"],
				)
				// The result should be decoded from the contract's output
				expect(result).toContain("66") // 0x42 = 66
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

describe("CLI E2E — RPC JSON output for all commands", () => {
	let server: TestServer

	beforeAll(async () => {
		server = await startTestServer()
	}, 15_000)

	afterAll(() => {
		server?.kill()
	})

	it("chop code --json outputs structured JSON", () => {
		const addr = "0x0000000000000000000000000000000000000000"
		const result = runCli(`code ${addr} -r http://127.0.0.1:${server.port} --json`)
		expect(result.exitCode).toBe(0)
		const json = JSON.parse(result.stdout.trim())
		expect(json).toHaveProperty("address", addr)
		expect(json).toHaveProperty("code")
	})

	it("chop storage --json outputs structured JSON", () => {
		const addr = "0x0000000000000000000000000000000000000000"
		const slot = "0x0000000000000000000000000000000000000000000000000000000000000000"
		const result = runCli(`storage ${addr} ${slot} -r http://127.0.0.1:${server.port} --json`)
		expect(result.exitCode).toBe(0)
		const json = JSON.parse(result.stdout.trim())
		expect(json).toHaveProperty("address", addr)
		expect(json).toHaveProperty("slot", slot)
		expect(json).toHaveProperty("value")
	})

	it("chop code --json for contract with bytecode", () => {
		const contractAddr = `0x${"00".repeat(19)}42`
		const result = runCli(`code ${contractAddr} -r http://127.0.0.1:${server.port} --json`)
		expect(result.exitCode).toBe(0)
		const json = JSON.parse(result.stdout.trim())
		expect(json.address).toBe(contractAddr)
		expect(json.code).toContain("604260005260206000f3")
	})
})

// ============================================================================
// Handler tests — estimateHandler
// ============================================================================

describe("estimateHandler", () => {
	it.effect("estimates gas for a simple call", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const result = yield* estimateHandler(
					`http://127.0.0.1:${server.port}`,
					"0x0000000000000000000000000000000000000000",
					undefined,
					[],
				)
				expect(Number(result)).toBeGreaterThan(0)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

// ============================================================================
// Handler tests — sendHandler
// ============================================================================

describe("sendHandler", () => {
	it.effect("sends a transaction and returns tx hash", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const result = yield* sendHandler(
					`http://127.0.0.1:${server.port}`,
					"0x0000000000000000000000000000000000000000",
					"0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // funded test account
					undefined,
					[],
				)
				expect(result).toMatch(/^0x[0-9a-f]{64}$/)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("sends a transaction with value parameter", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const result = yield* sendHandler(
					`http://127.0.0.1:${server.port}`,
					"0x0000000000000000000000000000000000000000",
					"0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
					undefined,
					[],
					"1000", // value in wei (decimal)
				)
				expect(result).toMatch(/^0x[0-9a-f]{64}$/)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("sends a transaction with hex value parameter", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const result = yield* sendHandler(
					`http://127.0.0.1:${server.port}`,
					"0x0000000000000000000000000000000000000000",
					"0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
					undefined,
					[],
					"0x3e8", // value in wei (hex, 1000 decimal)
				)
				expect(result).toMatch(/^0x[0-9a-f]{64}$/)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

// ============================================================================
// Handler tests — rpcGenericHandler
// ============================================================================

describe("rpcGenericHandler", () => {
	it.effect("executes a raw JSON-RPC call", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const result = yield* rpcGenericHandler(`http://127.0.0.1:${server.port}`, "eth_chainId", [])
				expect(result).toBe("0x7a69")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("passes JSON-parsed params correctly", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const result = yield* rpcGenericHandler(
					`http://127.0.0.1:${server.port}`,
					"eth_getBalance",
					['"0x0000000000000000000000000000000000000000"', '"latest"'],
				)
				expect(result).toBe("0x0")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

// ============================================================================
// CLI E2E — new RPC commands error handling
// ============================================================================

describe("CLI E2E — new RPC commands error handling", () => {
	it("estimate with invalid URL exits non-zero", () => {
		const result = runCli("estimate --to 0x0000000000000000000000000000000000000000 -r http://127.0.0.1:1")
		expect(result.exitCode).not.toBe(0)
	})

	it("send with invalid URL exits non-zero", () => {
		const result = runCli(
			"send --to 0x0000000000000000000000000000000000000000 --from 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 -r http://127.0.0.1:1",
		)
		expect(result.exitCode).not.toBe(0)
	})

	it("rpc with invalid URL exits non-zero", () => {
		const result = runCli("rpc eth_chainId -r http://127.0.0.1:1")
		expect(result.exitCode).not.toBe(0)
	})
})

// ============================================================================
// CLI E2E — new RPC commands success
// ============================================================================

describe("CLI E2E — new RPC commands success", () => {
	let server: TestServer

	beforeAll(async () => {
		server = await startTestServer()
	}, 15_000)

	afterAll(() => {
		server?.kill()
	})

	it("chop estimate returns a gas value", () => {
		const result = runCli(
			`estimate --to 0x0000000000000000000000000000000000000000 -r http://127.0.0.1:${server.port}`,
		)
		expect(result.exitCode).toBe(0)
		expect(Number(result.stdout.trim())).toBeGreaterThan(0)
	})

	it("chop estimate --json outputs structured JSON", () => {
		const result = runCli(
			`estimate --to 0x0000000000000000000000000000000000000000 -r http://127.0.0.1:${server.port} --json`,
		)
		expect(result.exitCode).toBe(0)
		const json = JSON.parse(result.stdout.trim())
		expect(json).toHaveProperty("gas")
		expect(Number(json.gas)).toBeGreaterThan(0)
	})

	it("chop send returns a tx hash", () => {
		const from = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
		const result = runCli(
			`send --to 0x0000000000000000000000000000000000000000 --from ${from} -r http://127.0.0.1:${server.port}`,
		)
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toMatch(/^0x[0-9a-f]{64}$/)
	})

	it("chop send --json outputs structured JSON", () => {
		const from = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
		const result = runCli(
			`send --to 0x0000000000000000000000000000000000000000 --from ${from} -r http://127.0.0.1:${server.port} --json`,
		)
		expect(result.exitCode).toBe(0)
		const json = JSON.parse(result.stdout.trim())
		expect(json).toHaveProperty("txHash")
		expect(json.txHash).toMatch(/^0x[0-9a-f]{64}$/)
	})

	it("chop rpc eth_chainId returns result", () => {
		const result = runCli(`rpc eth_chainId -r http://127.0.0.1:${server.port}`)
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("0x7a69")
	})

	it("chop rpc --json outputs structured JSON", () => {
		const result = runCli(`rpc eth_chainId -r http://127.0.0.1:${server.port} --json`)
		expect(result.exitCode).toBe(0)
		const json = JSON.parse(result.stdout.trim())
		expect(json).toHaveProperty("method", "eth_chainId")
		expect(json).toHaveProperty("result", "0x7a69")
	})

	it("chop rpc with params works", () => {
		const result = runCli(
			`rpc eth_getBalance '"0x0000000000000000000000000000000000000000"' '"latest"' -r http://127.0.0.1:${server.port}`,
		)
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("0x0")
	})
})
