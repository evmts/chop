import { describe, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { expect } from "vitest"
import { ForkConfigFromRpc, ForkConfigService, ForkConfigStatic, resolveForkConfig } from "./fork-config.js"
import { type HttpTransportApi, HttpTransportService } from "./http-transport.js"

// ---------------------------------------------------------------------------
// Mock transport helper
// ---------------------------------------------------------------------------

const mockTransport = (responses: Record<string, unknown>): HttpTransportApi => ({
	request: (method) =>
		Effect.gen(function* () {
			const result = responses[method]
			if (result === undefined) {
				return yield* Effect.fail(
					new (yield* Effect.sync(() => {
						// Use import to get ForkRpcError
						const { ForkRpcError } = require("./errors.js")
						return ForkRpcError
					}))({ method, message: "not found" }),
				)
			}
			return result
		}) as Effect.Effect<unknown, never>,
	batchRequest: (calls) =>
		Effect.succeed(calls.map((c) => responses[c.method])) as Effect.Effect<readonly unknown[], never>,
})

// ---------------------------------------------------------------------------
// ForkConfigStatic
// ---------------------------------------------------------------------------

describe("ForkConfigStatic", () => {
	it.effect("provides static config", () =>
		Effect.gen(function* () {
			const fc = yield* ForkConfigService
			expect(fc.config.chainId).toBe(1n)
			expect(fc.config.blockNumber).toBe(18_000_000n)
			expect(fc.url).toBe("http://localhost:8545")
		}).pipe(Effect.provide(ForkConfigStatic("http://localhost:8545", { chainId: 1n, blockNumber: 18_000_000n }))),
	)
})

// ---------------------------------------------------------------------------
// resolveForkConfig
// ---------------------------------------------------------------------------

describe("resolveForkConfig", () => {
	it.effect("resolves both chainId and blockNumber from batch", () =>
		Effect.gen(function* () {
			const transport = mockTransport({
				eth_chainId: "0x1",
				eth_blockNumber: "0x112a880",
			})
			const config = yield* resolveForkConfig(transport, { url: "http://localhost:8545" })
			expect(config.chainId).toBe(1n)
			expect(config.blockNumber).toBe(18_000_000n)
		}),
	)

	it.effect("resolves chainId only when blockNumber is provided", () =>
		Effect.gen(function* () {
			const transport = mockTransport({ eth_chainId: "0x5" })
			const config = yield* resolveForkConfig(transport, {
				url: "http://localhost:8545",
				blockNumber: 99n,
			})
			expect(config.chainId).toBe(5n)
			expect(config.blockNumber).toBe(99n)
		}),
	)

	it.effect("fails with ForkDataError on invalid hex", () =>
		Effect.gen(function* () {
			const transport = mockTransport({
				eth_chainId: "not-hex",
				eth_blockNumber: "0x1",
			})
			const error = yield* resolveForkConfig(transport, { url: "http://localhost:8545" }).pipe(Effect.flip)
			expect(error._tag).toBe("ForkDataError")
		}),
	)
})

// ---------------------------------------------------------------------------
// ForkConfigFromRpc (Layer)
// ---------------------------------------------------------------------------

describe("ForkConfigFromRpc", () => {
	it.effect("resolves config via HttpTransportService", () =>
		Effect.gen(function* () {
			const fc = yield* ForkConfigService
			expect(fc.config.chainId).toBe(1n)
			expect(fc.config.blockNumber).toBe(100n)
			expect(fc.url).toBe("http://mock:8545")
		}).pipe(
			Effect.provide(
				ForkConfigFromRpc({ url: "http://mock:8545" }).pipe(
					Layer.provide(
						Layer.succeed(HttpTransportService, {
							request: (method) =>
								Effect.succeed(method === "eth_chainId" ? "0x1" : "0x64") as Effect.Effect<unknown, never>,
							batchRequest: (calls) =>
								Effect.succeed(calls.map((c) => (c.method === "eth_chainId" ? "0x1" : "0x64"))) as Effect.Effect<
									readonly unknown[],
									never
								>,
						} satisfies HttpTransportApi),
					),
				),
			),
		),
	)
})

// ---------------------------------------------------------------------------
// Tag
// ---------------------------------------------------------------------------

describe("ForkConfigService — tag", () => {
	it("has correct tag key", () => {
		expect(ForkConfigService.key).toBe("ForkConfig")
	})
})
