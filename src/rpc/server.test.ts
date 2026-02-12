import * as http from "node:http"
import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { bytesToHex, hexToBytes } from "../evm/conversions.js"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { startRpcServer } from "./server.js"

// ---------------------------------------------------------------------------
// Helper — send an HTTP request using node:http (no fetch/DOM dependency)
// ---------------------------------------------------------------------------

interface RpcResult {
	jsonrpc: string
	result?: unknown
	error?: { code: number; message: string }
	id: number | string | null
}

const httpPost = (port: number, body: string): Promise<{ status: number; body: string }> =>
	new Promise((resolve, reject) => {
		const req = http.request(
			{ hostname: "127.0.0.1", port, method: "POST", path: "/", headers: { "Content-Type": "application/json" } },
			(res) => {
				let data = ""
				res.on("data", (chunk: Buffer) => {
					data += chunk.toString()
				})
				res.on("end", () => {
					resolve({ status: res.statusCode ?? 0, body: data })
				})
			},
		)
		req.on("error", reject)
		req.write(body)
		req.end()
	})

const httpGet = (port: number): Promise<{ status: number; body: string }> =>
	new Promise((resolve, reject) => {
		const req = http.request({ hostname: "127.0.0.1", port, method: "GET", path: "/" }, (res) => {
			let data = ""
			res.on("data", (chunk: Buffer) => {
				data += chunk.toString()
			})
			res.on("end", () => {
				resolve({ status: res.statusCode ?? 0, body: data })
			})
		})
		req.on("error", reject)
		req.end()
	})

const rpcCall = (port: number, body: unknown) =>
	Effect.tryPromise({
		try: async () => {
			const raw = typeof body === "string" ? body : JSON.stringify(body)
			const res = await httpPost(port, raw)
			return JSON.parse(res.body) as RpcResult | RpcResult[]
		},
		catch: (e) => new Error(`http request failed: ${e}`),
	})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RPC Server", () => {
	// -----------------------------------------------------------------------
	// Acceptance: eth_chainId → 0x7a69
	// -----------------------------------------------------------------------

	it.effect("eth_chainId returns 0x7a69 (31337)", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			const res = (yield* rpcCall(server.port, {
				jsonrpc: "2.0",
				method: "eth_chainId",
				params: [],
				id: 1,
			})) as RpcResult

			expect(res.result).toBe("0x7a69")
			expect(res.id).toBe(1)

			yield* server.close()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	// -----------------------------------------------------------------------
	// Acceptance: eth_blockNumber → 0x0
	// -----------------------------------------------------------------------

	it.effect("eth_blockNumber returns 0x0", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			const res = (yield* rpcCall(server.port, {
				jsonrpc: "2.0",
				method: "eth_blockNumber",
				params: [],
				id: 1,
			})) as RpcResult

			expect(res.result).toBe("0x0")

			yield* server.close()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	// -----------------------------------------------------------------------
	// Acceptance: eth_call with deployed contract → correct return
	// -----------------------------------------------------------------------

	it.effect("eth_call with deployed contract returns correct result", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			// Deploy contract: PUSH1 0x42, PUSH1 0x00, MSTORE, PUSH1 0x20, PUSH1 0x00, RETURN
			const contractCode = new Uint8Array([0x60, 0x42, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3])
			const contractAddr = `0x${"00".repeat(19)}42`

			yield* node.hostAdapter.setAccount(hexToBytes(contractAddr), {
				nonce: 0n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: contractCode,
			})

			const res = (yield* rpcCall(server.port, {
				jsonrpc: "2.0",
				method: "eth_call",
				params: [{ to: contractAddr }],
				id: 1,
			})) as RpcResult

			// Output is 32 bytes with value 0x42
			expect(res.result).toContain("42")
			expect(res.error).toBeUndefined()

			yield* server.close()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	// -----------------------------------------------------------------------
	// Acceptance: batch request → batch response
	// -----------------------------------------------------------------------

	it.effect("batch request returns batch response", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			const res = (yield* rpcCall(server.port, [
				{ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 },
				{ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 2 },
			])) as RpcResult[]

			expect(Array.isArray(res)).toBe(true)
			expect(res).toHaveLength(2)
			expect(res[0]?.result).toBe("0x7a69")
			expect(res[1]?.result).toBe("0x0")

			yield* server.close()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	// -----------------------------------------------------------------------
	// Acceptance: unknown method → -32601 error
	// -----------------------------------------------------------------------

	it.effect("unknown method returns -32601 error", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			const res = (yield* rpcCall(server.port, {
				jsonrpc: "2.0",
				method: "eth_unknownMethod",
				params: [],
				id: 1,
			})) as RpcResult

			expect(res.error?.code).toBe(-32601)
			expect(res.id).toBe(1)

			yield* server.close()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	// -----------------------------------------------------------------------
	// Acceptance: invalid JSON → -32700 error
	// -----------------------------------------------------------------------

	it.effect("invalid JSON returns -32700 error", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			const res = yield* Effect.tryPromise({
				try: async () => {
					const raw = await httpPost(server.port, "not valid json {{{")
					return JSON.parse(raw.body) as RpcResult
				},
				catch: (e) => new Error(`http request failed: ${e}`),
			})

			expect(res.error?.code).toBe(-32700)
			expect(res.id).toBeNull()

			yield* server.close()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	// -----------------------------------------------------------------------
	// Non-POST returns 405
	// -----------------------------------------------------------------------

	it.effect("GET request returns 405", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			const res = yield* Effect.tryPromise({
				try: () => httpGet(server.port),
				catch: (e) => new Error(`http request failed: ${e}`),
			})

			expect(res.status).toBe(405)

			yield* server.close()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	// -----------------------------------------------------------------------
	// eth_call with raw bytecode through HTTP stack
	// -----------------------------------------------------------------------

	it.effect("eth_call with raw bytecode returns correct hex", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			// Bytecode: PUSH1 0x42, PUSH1 0x00, MSTORE, PUSH1 0x20, PUSH1 0x00, RETURN
			const data = bytesToHex(new Uint8Array([0x60, 0x42, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3]))

			const res = (yield* rpcCall(server.port, {
				jsonrpc: "2.0",
				method: "eth_call",
				params: [{ data }],
				id: 1,
			})) as RpcResult

			expect(res.result).toContain("42")
			expect(res.error).toBeUndefined()

			yield* server.close()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// Additional coverage: server edge cases
// ---------------------------------------------------------------------------

describe("RPC Server — edge cases", () => {
	it.effect("server graceful shutdown prevents further connections", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			// Verify server is working
			const res1 = (yield* rpcCall(server.port, {
				jsonrpc: "2.0",
				method: "eth_chainId",
				params: [],
				id: 1,
			})) as RpcResult

			expect(res1.result).toBe("0x7a69")

			// Close server
			yield* server.close()

			// Attempt another request after close should fail
			const result = yield* Effect.tryPromise({
				try: () => httpPost(server.port, JSON.stringify({ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 2 })),
				catch: (e) => e,
			}).pipe(Effect.either)

			// Connection should be refused after close
			expect(result._tag).toBe("Left")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("server handles empty batch request", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			const res = (yield* rpcCall(server.port, [])) as RpcResult

			// Empty batch → invalid request error
			expect(res.error?.code).toBe(-32600)

			yield* server.close()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("server handles request with missing method", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			const res = (yield* rpcCall(server.port, {
				jsonrpc: "2.0",
				params: [],
				id: 1,
			})) as RpcResult

			expect(res.error).toBeDefined()
			expect(res.error?.code).toBe(-32600)
			expect(res.id).toBe(1)

			yield* server.close()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("server handles request with invalid jsonrpc field", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			const res = (yield* rpcCall(server.port, {
				jsonrpc: "1.0",
				method: "eth_chainId",
				params: [],
				id: 1,
			})) as RpcResult

			expect(res.error).toBeDefined()
			expect(res.error?.code).toBe(-32600)

			yield* server.close()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("server handles request with no params (omitted)", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			// No params field at all — should default to []
			const res = (yield* rpcCall(server.port, {
				jsonrpc: "2.0",
				method: "eth_chainId",
				id: 1,
			})) as RpcResult

			expect(res.result).toBe("0x7a69")
			expect(res.error).toBeUndefined()

			yield* server.close()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("server handles request with no id (notification style)", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			const res = (yield* rpcCall(server.port, {
				jsonrpc: "2.0",
				method: "eth_chainId",
				params: [],
			})) as RpcResult

			expect(res.result).toBe("0x7a69")
			expect(res.id).toBeNull()

			yield* server.close()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("server handles request body that is a JSON primitive (not object)", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			// Send a JSON string value instead of an object
			const res = yield* Effect.tryPromise({
				try: async () => {
					const raw = await httpPost(server.port, '"hello"')
					return JSON.parse(raw.body) as RpcResult
				},
				catch: (e) => new Error(`http request failed: ${e}`),
			})

			expect(res.error).toBeDefined()
			expect(res.error?.code).toBe(-32600)

			yield* server.close()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("server handles request body that is a JSON number", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			const res = yield* Effect.tryPromise({
				try: async () => {
					const raw = await httpPost(server.port, "42")
					return JSON.parse(raw.body) as RpcResult
				},
				catch: (e) => new Error(`http request failed: ${e}`),
			})

			expect(res.error).toBeDefined()
			expect(res.error?.code).toBe(-32600)

			yield* server.close()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("server handles batch with mixed valid and invalid requests", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			const res = (yield* rpcCall(server.port, [
				{ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 },
				{ jsonrpc: "1.0", method: "eth_chainId", params: [], id: 2 }, // invalid jsonrpc
				{ jsonrpc: "2.0", method: "eth_unknownMethod", params: [], id: 3 }, // unknown method
			])) as RpcResult[]

			expect(Array.isArray(res)).toBe(true)
			expect(res).toHaveLength(3)
			expect(res[0]?.result).toBe("0x7a69")
			expect(res[1]?.error).toBeDefined()
			expect(res[2]?.error?.code).toBe(-32601)

			yield* server.close()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("server with custom host parameter", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0, host: "127.0.0.1" }, node)

			const res = (yield* rpcCall(server.port, {
				jsonrpc: "2.0",
				method: "eth_chainId",
				params: [],
				id: 1,
			})) as RpcResult

			expect(res.result).toBe("0x7a69")

			yield* server.close()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
