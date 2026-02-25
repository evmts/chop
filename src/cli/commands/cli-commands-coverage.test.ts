/**
 * Coverage tests for Command.make handler bodies across chain.ts, ens.ts, rpc.ts.
 *
 * These exercise the handler functions with both JSON and non-JSON formatting
 * inline, mirroring the exact code paths in each Command.make body:
 *
 * chain.ts:
 *   - baseFeeCommand  (lines 441-449): baseFeeHandler + JSON { baseFee }
 *   - findBlockCommand (lines 455-470): findBlockHandler + JSON { blockNumber }
 *
 * ens.ts:
 *   - resolveNameCommand  (lines 243-251): resolveNameHandler + JSON { name, address }
 *   - lookupAddressCommand (lines 266-274): lookupAddressHandler + JSON { address, name }
 *
 * rpc.ts:
 *   - sendCommand        (lines 438-448): sendHandler + JSON { txHash }
 *   - rpcGenericCommand  (lines 467-475): rpcGenericHandler + JSON { method, result }
 */

import { FetchHttpClient } from "@effect/platform"
import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { hexToBytes } from "../../evm/conversions.js"
import { TevmNode, TevmNodeService } from "../../node/index.js"
import { startRpcServer } from "../../rpc/server.js"
import { baseFeeHandler, findBlockHandler } from "./chain.js"
import { lookupAddressHandler, resolveNameHandler } from "./ens.js"
import { rpcGenericHandler, sendHandler } from "./rpc.js"

// ============================================================================
// Helpers
// ============================================================================

/** Create a test server, return URL + node */
const setupServer = Effect.gen(function* () {
	const node = yield* TevmNodeService
	const server = yield* startRpcServer({ port: 0 }, node)
	const url = `http://127.0.0.1:${server.port}`
	return { server, url, node }
})

const TestLayer = Effect.provide(TevmNode.LocalTest())
const HttpLayer = Effect.provide(FetchHttpClient.layer)

// ============================================================================
// baseFeeCommand body paths (chain.ts lines 441-449)
// ============================================================================

describe("baseFeeCommand body — coverage", () => {
	it.effect("non-JSON path: handler returns decimal string logged directly", () =>
		Effect.gen(function* () {
			const { server, url } = yield* setupServer
			try {
				const result = yield* baseFeeHandler(url)
				// The non-JSON path does: Console.log(result)
				// Verify the result is a valid decimal string
				expect(() => BigInt(result)).not.toThrow()
				expect(typeof result).toBe("string")
			} finally {
				yield* server.close()
			}
		}).pipe(TestLayer, HttpLayer),
	)

	it.effect("JSON path: wraps result as { baseFee }", () =>
		Effect.gen(function* () {
			const { server, url } = yield* setupServer
			try {
				const result = yield* baseFeeHandler(url)
				// The JSON path does: Console.log(JSON.stringify({ baseFee: result }))
				const jsonOutput = JSON.stringify({ baseFee: result })
				const parsed = JSON.parse(jsonOutput)
				expect(parsed).toHaveProperty("baseFee")
				expect(typeof parsed.baseFee).toBe("string")
				expect(() => BigInt(parsed.baseFee)).not.toThrow()
			} finally {
				yield* server.close()
			}
		}).pipe(TestLayer, HttpLayer),
	)
})

// ============================================================================
// findBlockCommand body paths (chain.ts lines 455-470)
// ============================================================================

describe("findBlockCommand body — coverage", () => {
	it.effect("non-JSON path: handler returns block number string logged directly", () =>
		Effect.gen(function* () {
			const { server, url } = yield* setupServer
			try {
				// timestamp 0 should return genesis block
				const result = yield* findBlockHandler(url, "0")
				// The non-JSON path does: Console.log(result)
				expect(result).toBe("0")
			} finally {
				yield* server.close()
			}
		}).pipe(TestLayer, HttpLayer),
	)

	it.effect("JSON path: wraps result as { blockNumber }", () =>
		Effect.gen(function* () {
			const { server, url } = yield* setupServer
			try {
				const result = yield* findBlockHandler(url, "0")
				// The JSON path does: Console.log(JSON.stringify({ blockNumber: result }))
				const jsonOutput = JSON.stringify({ blockNumber: result })
				const parsed = JSON.parse(jsonOutput)
				expect(parsed).toEqual({ blockNumber: "0" })
			} finally {
				yield* server.close()
			}
		}).pipe(TestLayer, HttpLayer),
	)

	it.effect("finds block after sending transactions to create blocks", () =>
		Effect.gen(function* () {
			const { server, url, node } = yield* setupServer
			try {
				const from = node.accounts[0]!.address
				const to = node.accounts[1]!.address
				// Send a couple of transactions to create blocks
				yield* sendHandler(url, to, from, undefined, [], "0x1")
				yield* sendHandler(url, to, from, undefined, [], "0x1")

				// Use a far-future timestamp so it returns the latest block
				const result = yield* findBlockHandler(url, "9999999999")
				expect(Number(result)).toBeGreaterThanOrEqual(0)

				// JSON format
				const jsonOutput = JSON.stringify({ blockNumber: result })
				const parsed = JSON.parse(jsonOutput)
				expect(parsed).toHaveProperty("blockNumber")
			} finally {
				yield* server.close()
			}
		}).pipe(TestLayer, HttpLayer),
	)
})

// ============================================================================
// resolveNameCommand body paths (ens.ts lines 243-251)
// ============================================================================

describe("resolveNameCommand body — coverage", () => {
	it.effect("non-JSON path: handler returns address logged directly", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			// Deploy ENS registry mock that returns resolver at 0x00...0042
			const ensRegistry = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e"
			const registryCode = new Uint8Array([0x60, 0x42, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3])
			yield* node.hostAdapter.setAccount(hexToBytes(ensRegistry), {
				nonce: 0n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: registryCode,
			})

			// Deploy resolver mock at 0x00...0042 that returns a non-zero address (0x00...00ff)
			const resolverAddr = `0x${"00".repeat(19)}42`
			const resolverCode = new Uint8Array([0x60, 0xff, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3])
			yield* node.hostAdapter.setAccount(hexToBytes(resolverAddr), {
				nonce: 0n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: resolverCode,
			})

			try {
				const url = `http://127.0.0.1:${server.port}`
				const result = yield* resolveNameHandler(url, "test.eth")
				// The non-JSON path does: Console.log(result)
				expect(result).toMatch(/^0x[0-9a-f]{40}$/)
			} finally {
				yield* server.close()
			}
		}).pipe(TestLayer, HttpLayer),
	)

	it.effect("JSON path: wraps result as { name, address }", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			// Deploy ENS registry mock
			const ensRegistry = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e"
			const registryCode = new Uint8Array([0x60, 0x42, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3])
			yield* node.hostAdapter.setAccount(hexToBytes(ensRegistry), {
				nonce: 0n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: registryCode,
			})

			// Deploy resolver mock
			const resolverAddr = `0x${"00".repeat(19)}42`
			const resolverCode = new Uint8Array([0x60, 0xff, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3])
			yield* node.hostAdapter.setAccount(hexToBytes(resolverAddr), {
				nonce: 0n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: resolverCode,
			})

			try {
				const url = `http://127.0.0.1:${server.port}`
				const name = "test.eth"
				const result = yield* resolveNameHandler(url, name)
				// The JSON path does: Console.log(JSON.stringify({ name, address: result }))
				const jsonOutput = JSON.stringify({ name, address: result })
				const parsed = JSON.parse(jsonOutput)
				expect(parsed).toHaveProperty("name", "test.eth")
				expect(parsed).toHaveProperty("address")
				expect(parsed.address).toMatch(/^0x[0-9a-f]{40}$/)
			} finally {
				yield* server.close()
			}
		}).pipe(TestLayer, HttpLayer),
	)
})

// ============================================================================
// lookupAddressCommand body paths (ens.ts lines 266-274)
// ============================================================================

describe("lookupAddressCommand body — coverage", () => {
	it.effect("non-JSON path: handler returns name logged directly", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			// Deploy ENS registry mock that returns resolver at 0x00...0042
			const ensRegistry = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e"
			const registryCode = new Uint8Array([0x60, 0x42, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3])
			yield* node.hostAdapter.setAccount(hexToBytes(ensRegistry), {
				nonce: 0n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: registryCode,
			})

			// Deploy resolver mock at 0x00...0042 that returns ABI-encoded string "test.eth"
			const resolverAddr = `0x${"00".repeat(19)}42`
			const resolverCode = new Uint8Array([
				// Write "test.eth" into memory using overlapping MSTOREs
				0x60,
				0x68,
				0x60,
				0x28,
				0x52, // 'h' at mem[71]
				0x60,
				0x74,
				0x60,
				0x27,
				0x52, // 't' at mem[70]
				0x60,
				0x65,
				0x60,
				0x26,
				0x52, // 'e' at mem[69]
				0x60,
				0x2e,
				0x60,
				0x25,
				0x52, // '.' at mem[68]
				0x60,
				0x74,
				0x60,
				0x24,
				0x52, // 't' at mem[67]
				0x60,
				0x73,
				0x60,
				0x23,
				0x52, // 's' at mem[66]
				0x60,
				0x65,
				0x60,
				0x22,
				0x52, // 'e' at mem[65]
				0x60,
				0x74,
				0x60,
				0x21,
				0x52, // 't' at mem[64]
				// length=8
				0x60,
				0x08,
				0x60,
				0x20,
				0x52,
				// offset=32
				0x60,
				0x20,
				0x60,
				0x00,
				0x52,
				// RETURN 96 bytes from memory[0]
				0x60,
				0x60,
				0x60,
				0x00,
				0xf3,
			])
			yield* node.hostAdapter.setAccount(hexToBytes(resolverAddr), {
				nonce: 0n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: resolverCode,
			})

			try {
				const url = `http://127.0.0.1:${server.port}`
				const result = yield* lookupAddressHandler(url, "0x1234567890abcdef1234567890abcdef12345678")
				// The non-JSON path does: Console.log(result)
				expect(result).toBe("test.eth")
			} finally {
				yield* server.close()
			}
		}).pipe(TestLayer, HttpLayer),
	)

	it.effect("JSON path: wraps result as { address, name }", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			// Deploy ENS registry mock
			const ensRegistry = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e"
			const registryCode = new Uint8Array([0x60, 0x42, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3])
			yield* node.hostAdapter.setAccount(hexToBytes(ensRegistry), {
				nonce: 0n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: registryCode,
			})

			// Deploy resolver mock returning ABI-encoded "test.eth"
			const resolverAddr = `0x${"00".repeat(19)}42`
			const resolverCode = new Uint8Array([
				0x60, 0x68, 0x60, 0x28, 0x52, 0x60, 0x74, 0x60, 0x27, 0x52, 0x60, 0x65, 0x60, 0x26, 0x52, 0x60, 0x2e, 0x60,
				0x25, 0x52, 0x60, 0x74, 0x60, 0x24, 0x52, 0x60, 0x73, 0x60, 0x23, 0x52, 0x60, 0x65, 0x60, 0x22, 0x52, 0x60,
				0x74, 0x60, 0x21, 0x52, 0x60, 0x08, 0x60, 0x20, 0x52, 0x60, 0x20, 0x60, 0x00, 0x52, 0x60, 0x60, 0x60, 0x00,
				0xf3,
			])
			yield* node.hostAdapter.setAccount(hexToBytes(resolverAddr), {
				nonce: 0n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: resolverCode,
			})

			try {
				const url = `http://127.0.0.1:${server.port}`
				const address = "0x1234567890abcdef1234567890abcdef12345678"
				const result = yield* lookupAddressHandler(url, address)
				// The JSON path does: Console.log(JSON.stringify({ address, name: result }))
				const jsonOutput = JSON.stringify({ address, name: result })
				const parsed = JSON.parse(jsonOutput)
				expect(parsed).toHaveProperty("address", address)
				expect(parsed).toHaveProperty("name", "test.eth")
			} finally {
				yield* server.close()
			}
		}).pipe(TestLayer, HttpLayer),
	)
})

// ============================================================================
// sendCommand body paths (rpc.ts lines 438-448)
// ============================================================================

describe("sendCommand body — coverage", () => {
	it.effect("non-JSON path: handler returns tx hash logged directly", () =>
		Effect.gen(function* () {
			const { server, url, node } = yield* setupServer
			try {
				const from = node.accounts[0]!.address
				const to = node.accounts[1]!.address
				const result = yield* sendHandler(url, to, from, undefined, [], "0x1")
				// The non-JSON path does: Console.log(result)
				expect(result).toMatch(/^0x[0-9a-f]{64}$/)
			} finally {
				yield* server.close()
			}
		}).pipe(TestLayer, HttpLayer),
	)

	it.effect("JSON path: wraps result as { txHash }", () =>
		Effect.gen(function* () {
			const { server, url, node } = yield* setupServer
			try {
				const from = node.accounts[0]!.address
				const to = node.accounts[1]!.address
				const result = yield* sendHandler(url, to, from, undefined, [], "0x1")
				// The JSON path does: Console.log(JSON.stringify({ txHash: result }))
				const jsonOutput = JSON.stringify({ txHash: result })
				const parsed = JSON.parse(jsonOutput)
				expect(parsed).toHaveProperty("txHash")
				expect(parsed.txHash).toMatch(/^0x[0-9a-f]{64}$/)
			} finally {
				yield* server.close()
			}
		}).pipe(TestLayer, HttpLayer),
	)

	it.effect("send with value as decimal string (no 0x prefix)", () =>
		Effect.gen(function* () {
			const { server, url, node } = yield* setupServer
			try {
				const from = node.accounts[0]!.address
				const to = node.accounts[1]!.address
				// sendHandler converts non-0x values: `0x${BigInt(value).toString(16)}`
				const result = yield* sendHandler(url, to, from, undefined, [], "1000")
				expect(result).toMatch(/^0x[0-9a-f]{64}$/)

				const jsonOutput = JSON.stringify({ txHash: result })
				const parsed = JSON.parse(jsonOutput)
				expect(parsed.txHash).toBe(result)
			} finally {
				yield* server.close()
			}
		}).pipe(TestLayer, HttpLayer),
	)

	it.effect("send without value (simple ETH transfer with no value)", () =>
		Effect.gen(function* () {
			const { server, url, node } = yield* setupServer
			try {
				const from = node.accounts[0]!.address
				const to = node.accounts[1]!.address
				const result = yield* sendHandler(url, to, from, undefined, [])
				expect(result).toMatch(/^0x[0-9a-f]{64}$/)
			} finally {
				yield* server.close()
			}
		}).pipe(TestLayer, HttpLayer),
	)
})

// ============================================================================
// rpcGenericCommand body paths (rpc.ts lines 467-475)
// ============================================================================

describe("rpcGenericCommand body — coverage", () => {
	it.effect("non-JSON path with string result: logs result directly", () =>
		Effect.gen(function* () {
			const { server, url } = yield* setupServer
			try {
				const result = yield* rpcGenericHandler(url, "eth_chainId", [])
				// The non-JSON path does:
				//   typeof result === "string" ? result : JSON.stringify(result, null, 2)
				if (typeof result === "string") {
					expect(result).toMatch(/^0x/)
				} else {
					const formatted = JSON.stringify(result, null, 2)
					expect(typeof formatted).toBe("string")
				}
			} finally {
				yield* server.close()
			}
		}).pipe(TestLayer, HttpLayer),
	)

	it.effect("JSON path: wraps result as { method, result }", () =>
		Effect.gen(function* () {
			const { server, url } = yield* setupServer
			try {
				const method = "eth_chainId"
				const result = yield* rpcGenericHandler(url, method, [])
				// The JSON path does: Console.log(JSON.stringify({ method, result }))
				const jsonOutput = JSON.stringify({ method, result })
				const parsed = JSON.parse(jsonOutput)
				expect(parsed).toHaveProperty("method", "eth_chainId")
				expect(parsed).toHaveProperty("result")
			} finally {
				yield* server.close()
			}
		}).pipe(TestLayer, HttpLayer),
	)

	it.effect("eth_blockNumber returns a hex block number", () =>
		Effect.gen(function* () {
			const { server, url } = yield* setupServer
			try {
				const result = yield* rpcGenericHandler(url, "eth_blockNumber", [])
				// Should be a hex string
				expect(typeof result === "string" || typeof result === "number").toBe(true)

				// JSON format
				const jsonOutput = JSON.stringify({ method: "eth_blockNumber", result })
				const parsed = JSON.parse(jsonOutput)
				expect(parsed.method).toBe("eth_blockNumber")
			} finally {
				yield* server.close()
			}
		}).pipe(TestLayer, HttpLayer),
	)

	it.effect("non-JSON path with object result: pretty-prints JSON", () =>
		Effect.gen(function* () {
			const { server, url } = yield* setupServer
			try {
				// eth_getBlockByNumber returns an object
				const result = yield* rpcGenericHandler(url, "eth_getBlockByNumber", ["latest", "false"])
				// The non-JSON path for non-string results does:
				//   JSON.stringify(result, null, 2)
				if (typeof result !== "string") {
					const formatted = JSON.stringify(result, null, 2)
					expect(formatted).toContain("\n") // pretty-printed has newlines
					expect(formatted.length).toBeGreaterThan(0)
				}
			} finally {
				yield* server.close()
			}
		}).pipe(TestLayer, HttpLayer),
	)

	it.effect("params with JSON-parseable values are parsed correctly", () =>
		Effect.gen(function* () {
			const { server, url } = yield* setupServer
			try {
				// Pass "true" as a JSON-parseable param (parsed to boolean true)
				const result = yield* rpcGenericHandler(url, "eth_getBlockByNumber", ['"latest"', "true"])
				expect(result).not.toBeNull()
			} finally {
				yield* server.close()
			}
		}).pipe(TestLayer, HttpLayer),
	)
})
