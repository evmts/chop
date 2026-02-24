import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { ForkRpcError } from "./errors.js"
import { resolveForkConfig } from "./fork-config.js"
import type { HttpTransportApi } from "./http-transport.js"

// ---------------------------------------------------------------------------
// Transport helpers that fail with ForkRpcError
// ---------------------------------------------------------------------------

/** Transport whose `request` always fails with ForkRpcError. */
const failingRequestTransport: HttpTransportApi = {
	request: (method) => Effect.fail(new ForkRpcError({ method, message: "connection refused" })),
	batchRequest: () => Effect.succeed([]) as Effect.Effect<readonly unknown[], ForkRpcError>,
}

/** Transport whose `batchRequest` always fails with ForkRpcError. */
const failingBatchTransport: HttpTransportApi = {
	request: () => Effect.succeed("0x1") as Effect.Effect<unknown, ForkRpcError>,
	batchRequest: (_calls) => Effect.fail(new ForkRpcError({ method: "batch", message: "network timeout" })),
}

// ---------------------------------------------------------------------------
// ForkRpcError catch branches in resolveForkConfig
// ---------------------------------------------------------------------------

describe("resolveForkConfig — ForkRpcError catch branches", () => {
	it.effect("line 77: wraps ForkRpcError as ForkDataError when eth_chainId fails (blockNumber provided)", () =>
		Effect.gen(function* () {
			const error = yield* resolveForkConfig(failingRequestTransport, {
				url: "http://localhost:8545",
				blockNumber: 42n,
			}).pipe(Effect.flip)

			expect(error._tag).toBe("ForkDataError")
			expect(error.message).toBe("Failed to fetch chain ID: connection refused")
		}),
	)

	it.effect("line 92: wraps ForkRpcError as ForkDataError when batchRequest fails (no blockNumber)", () =>
		Effect.gen(function* () {
			const error = yield* resolveForkConfig(failingBatchTransport, {
				url: "http://localhost:8545",
			}).pipe(Effect.flip)

			expect(error._tag).toBe("ForkDataError")
			expect(error.message).toBe("Failed to fetch fork config: network timeout")
		}),
	)
})
