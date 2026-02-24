import { FetchHttpClient } from "@effect/platform"
import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { RpcClientError, rpcCall } from "./client.js"
import { startRpcServer } from "./server.js"

// ============================================================================
// RpcClientError
// ============================================================================

describe("RpcClientError", () => {
	it("has correct tag and fields", () => {
		const error = new RpcClientError({ message: "test error" })
		expect(error._tag).toBe("RpcClientError")
		expect(error.message).toBe("test error")
	})

	it("preserves cause", () => {
		const cause = new Error("original")
		const error = new RpcClientError({ message: "wrapped", cause })
		expect(error.cause).toBe(cause)
	})

	it.effect("can be caught by tag in Effect pipeline", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(new RpcClientError({ message: "boom" })).pipe(
				Effect.catchTag("RpcClientError", (e) => Effect.succeed(`caught: ${e.message}`)),
			)
			expect(result).toBe("caught: boom")
		}),
	)
})

// ============================================================================
// rpcCall — against real RPC server
// ============================================================================

describe("rpcCall", () => {
	it.effect("calls eth_chainId successfully", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const result = yield* rpcCall(`http://127.0.0.1:${server.port}`, "eth_chainId", [])
				expect(result).toBe("0x7a69") // 31337 in hex
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("calls eth_blockNumber successfully", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const result = yield* rpcCall(`http://127.0.0.1:${server.port}`, "eth_blockNumber", [])
				expect(result).toBe("0x0")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("calls eth_getBalance successfully", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const result = yield* rpcCall(`http://127.0.0.1:${server.port}`, "eth_getBalance", [
					"0x0000000000000000000000000000000000000000",
					"latest",
				])
				expect(result).toBe("0x0")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("returns RpcClientError for unknown RPC method", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const error = yield* rpcCall(`http://127.0.0.1:${server.port}`, "eth_unknownMethod", []).pipe(Effect.flip)
				expect(error._tag).toBe("RpcClientError")
				expect(error.message).toContain("RPC error")
				expect(error.message).toContain("-32601")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("returns RpcClientError for connection failure (bad URL)", () =>
		Effect.gen(function* () {
			const error = yield* rpcCall("http://127.0.0.1:1", "eth_chainId", []).pipe(Effect.flip)
			expect(error._tag).toBe("RpcClientError")
			expect(error.message).toContain("RPC request failed")
		}).pipe(Effect.provide(FetchHttpClient.layer)),
	)
})

// ============================================================================
// rpcCall — edge cases for response parsing and validation
// ============================================================================

import * as http from "node:http"

/** Start a mock HTTP server that returns a custom response body. */
const startMockServer = (responseBody: string, statusCode = 200): Promise<{ port: number; close: () => void }> =>
	new Promise((resolve) => {
		const server = http.createServer((_req, res) => {
			res.writeHead(statusCode, { "Content-Type": "application/json" })
			res.end(responseBody)
		})
		server.listen(0, "127.0.0.1", () => {
			const addr = server.address()
			const port = typeof addr === "object" && addr !== null ? addr.port : 0
			resolve({ port, close: () => server.close() })
		})
	})

describe("rpcCall — malformed response handling", () => {
	it.effect("returns RpcClientError when response body is not valid JSON", () =>
		Effect.gen(function* () {
			const mock = yield* Effect.promise(() => startMockServer("not valid json at all {{{"))
			try {
				const error = yield* rpcCall(`http://127.0.0.1:${mock.port}`, "eth_chainId", []).pipe(Effect.flip)
				expect(error._tag).toBe("RpcClientError")
				expect(error.message).toContain("Failed to parse RPC response")
			} finally {
				mock.close()
			}
		}).pipe(Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("returns RpcClientError when response has no jsonrpc field", () =>
		Effect.gen(function* () {
			// Returns valid JSON but not a JSON-RPC response
			const mock = yield* Effect.promise(() => startMockServer(JSON.stringify({ result: "0x1" })))
			try {
				const error = yield* rpcCall(`http://127.0.0.1:${mock.port}`, "eth_chainId", []).pipe(Effect.flip)
				expect(error._tag).toBe("RpcClientError")
				expect(error.message).toContain("Malformed JSON-RPC response")
			} finally {
				mock.close()
			}
		}).pipe(Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("returns RpcClientError when response is a JSON null value", () =>
		Effect.gen(function* () {
			const mock = yield* Effect.promise(() => startMockServer("null"))
			try {
				const error = yield* rpcCall(`http://127.0.0.1:${mock.port}`, "eth_chainId", []).pipe(Effect.flip)
				expect(error._tag).toBe("RpcClientError")
				expect(error.message).toContain("Malformed JSON-RPC response")
			} finally {
				mock.close()
			}
		}).pipe(Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("returns RpcClientError when response is a JSON string", () =>
		Effect.gen(function* () {
			const mock = yield* Effect.promise(() => startMockServer('"just a string"'))
			try {
				const error = yield* rpcCall(`http://127.0.0.1:${mock.port}`, "eth_chainId", []).pipe(Effect.flip)
				expect(error._tag).toBe("RpcClientError")
				expect(error.message).toContain("Malformed JSON-RPC response")
			} finally {
				mock.close()
			}
		}).pipe(Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("returns RpcClientError when response is a JSON number", () =>
		Effect.gen(function* () {
			const mock = yield* Effect.promise(() => startMockServer("42"))
			try {
				const error = yield* rpcCall(`http://127.0.0.1:${mock.port}`, "eth_chainId", []).pipe(Effect.flip)
				expect(error._tag).toBe("RpcClientError")
				expect(error.message).toContain("Malformed JSON-RPC response")
			} finally {
				mock.close()
			}
		}).pipe(Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("returns RpcClientError when response is a JSON array (not object)", () =>
		Effect.gen(function* () {
			const mock = yield* Effect.promise(() => startMockServer("[1, 2, 3]"))
			try {
				const error = yield* rpcCall(`http://127.0.0.1:${mock.port}`, "eth_chainId", []).pipe(Effect.flip)
				expect(error._tag).toBe("RpcClientError")
				expect(error.message).toContain("Malformed JSON-RPC response")
			} finally {
				mock.close()
			}
		}).pipe(Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("returns RpcClientError with error details when response has error field", () =>
		Effect.gen(function* () {
			const mock = yield* Effect.promise(() =>
				startMockServer(
					JSON.stringify({
						jsonrpc: "2.0",
						error: { code: -32000, message: "Custom error message" },
						id: 1,
					}),
				),
			)
			try {
				const error = yield* rpcCall(`http://127.0.0.1:${mock.port}`, "eth_test", []).pipe(Effect.flip)
				expect(error._tag).toBe("RpcClientError")
				expect(error.message).toContain("-32000")
				expect(error.message).toContain("Custom error message")
			} finally {
				mock.close()
			}
		}).pipe(Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("succeeds when response has valid JSON-RPC shape with null result", () =>
		Effect.gen(function* () {
			const mock = yield* Effect.promise(() => startMockServer(JSON.stringify({ jsonrpc: "2.0", result: null, id: 1 })))
			try {
				const result = yield* rpcCall(`http://127.0.0.1:${mock.port}`, "eth_test", [])
				expect(result).toBeNull()
			} finally {
				mock.close()
			}
		}).pipe(Effect.provide(FetchHttpClient.layer)),
	)
})
