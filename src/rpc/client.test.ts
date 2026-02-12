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
