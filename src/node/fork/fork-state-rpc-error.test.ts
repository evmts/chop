import { describe, it } from "@effect/vitest"
import { Cause, Effect, Layer, Option } from "effect"
import { expect } from "vitest"
import { JournalLive } from "../../state/journal.js"
import { WorldStateService } from "../../state/world-state.js"
import { ForkDataError, ForkRpcError } from "./errors.js"
import { ForkWorldStateLive } from "./fork-state.js"
import { type HttpTransportApi, HttpTransportService } from "./http-transport.js"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const addr1 = "0x0000000000000000000000000000000000000001"
const slot1 = "0x0000000000000000000000000000000000000000000000000000000000000001"

/**
 * Run an effect and capture its defect (die) value if it dies.
 * Returns the defect value, or fails the test if the effect succeeds.
 */
const captureDefect = <A>(effect: Effect.Effect<A, never, WorldStateService>): Effect.Effect<unknown, never, WorldStateService> =>
	effect.pipe(
		Effect.catchAllCause((cause) => {
			const dieOpt = Cause.dieOption(cause)
			if (Option.isSome(dieOpt)) {
				return Effect.succeed(dieOpt.value)
			}
			return Effect.die(new Error("Expected a defect (die) but got a different cause"))
		}),
		Effect.flatMap((result) => {
			// If we get here from the original effect succeeding, that's unexpected
			// but captureDefect only returns the defect, so we need a way to distinguish.
			// Actually, catchAllCause only runs on failure/defect, so if the original
			// effect succeeds, result will be the success value. We'll handle that in tests.
			return Effect.succeed(result)
		}),
	)

/**
 * Build a layer where batchRequest always fails with ForkRpcError.
 * This triggers the catch branch at line 55 of fork-state.ts.
 */
const FailingBatchLayer = (errorMessage: string) => {
	const transport: HttpTransportApi = {
		request: () => Effect.succeed("0x0") as Effect.Effect<unknown, ForkRpcError>,
		batchRequest: () =>
			Effect.fail(new ForkRpcError({ method: "batch", message: errorMessage })) as Effect.Effect<
				readonly unknown[],
				ForkRpcError
			>,
	}
	return ForkWorldStateLive({ blockNumber: 100n }).pipe(
		Layer.provide(JournalLive()),
		Layer.provide(Layer.succeed(HttpTransportService, transport)),
	)
}

/**
 * Build a layer where request("eth_getStorageAt") fails with ForkRpcError
 * but batchRequest succeeds (so account fetch works).
 * This triggers the catch branch at line 108 of fork-state.ts.
 */
const FailingStorageLayer = (errorMessage: string) => {
	const transport: HttpTransportApi = {
		request: (_method, _params) =>
			Effect.fail(new ForkRpcError({ method: "eth_getStorageAt", message: errorMessage })) as Effect.Effect<
				unknown,
				ForkRpcError
			>,
		batchRequest: () =>
			Effect.succeed(["0x64", "0x1", "0x"]) as Effect.Effect<readonly unknown[], ForkRpcError>,
	}
	return ForkWorldStateLive({ blockNumber: 100n }).pipe(
		Layer.provide(JournalLive()),
		Layer.provide(Layer.succeed(HttpTransportService, transport)),
	)
}

// ---------------------------------------------------------------------------
// Tests -- ForkRpcError catch branches
// ---------------------------------------------------------------------------

describe("ForkWorldState -- ForkRpcError catch branches", () => {
	it.effect("getAccount dies with ForkDataError when batchRequest fails with ForkRpcError (line 55)", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService

			// getAccount on an address not in local state triggers fetchRemoteAccount,
			// which calls batchRequest. The ForkRpcError is caught and re-wrapped as
			// ForkDataError, then promoted to a defect via Effect.die in resolveAccount.
			const defect = yield* captureDefect(ws.getAccount(addr1))

			const error = defect as ForkDataError
			expect(error._tag).toBe("ForkDataError")
			expect(error.message).toContain("Failed to fetch account")
			expect(error.message).toContain(addr1)
			expect(error.message).toContain("connection refused")
		}).pipe(Effect.provide(FailingBatchLayer("connection refused"))),
	)

	it.effect("getStorage dies with ForkDataError when eth_getStorageAt fails with ForkRpcError (line 108)", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService

			// getStorage on a slot not in local state triggers fetchRemoteStorage,
			// which calls request("eth_getStorageAt"). The batchRequest for the
			// account succeeds (returning a valid account), but the storage request
			// fails with ForkRpcError, caught and re-wrapped as ForkDataError,
			// then promoted to a defect via Effect.die in resolveStorage.
			const defect = yield* captureDefect(ws.getStorage(addr1, slot1))

			const error = defect as ForkDataError
			expect(error._tag).toBe("ForkDataError")
			expect(error.message).toContain("Failed to fetch storage")
			expect(error.message).toContain(addr1)
			expect(error.message).toContain(slot1)
			expect(error.message).toContain("rate limited")
		}).pipe(Effect.provide(FailingStorageLayer("rate limited"))),
	)

	it.effect("ForkDataError from batchRequest includes the original ForkRpcError message verbatim", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			const specificError = "upstream 502 bad gateway"

			const defect = yield* captureDefect(ws.getAccount(addr1))

			const error = defect as ForkDataError
			// The ForkDataError message should contain the original ForkRpcError message
			expect(error.message).toBe(`Failed to fetch account ${addr1}: ${specificError}`)
		}).pipe(Effect.provide(FailingBatchLayer("upstream 502 bad gateway"))),
	)
})
