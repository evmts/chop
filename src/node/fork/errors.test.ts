import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { ForkDataError, ForkRpcError, TransportTimeoutError } from "./errors.js"

describe("ForkRpcError", () => {
	it("has correct tag", () => {
		const error = new ForkRpcError({ method: "eth_getBalance", message: "timeout" })
		expect(error._tag).toBe("ForkRpcError")
		expect(error.method).toBe("eth_getBalance")
		expect(error.message).toBe("timeout")
	})

	it.effect("catchable by tag", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(new ForkRpcError({ method: "eth_call", message: "fail" })).pipe(
				Effect.catchTag("ForkRpcError", (e) => Effect.succeed(e.method)),
			)
			expect(result).toBe("eth_call")
		}),
	)
})

describe("ForkDataError", () => {
	it("has correct tag", () => {
		const error = new ForkDataError({ message: "invalid hex" })
		expect(error._tag).toBe("ForkDataError")
		expect(error.message).toBe("invalid hex")
	})

	it.effect("catchable by tag", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(new ForkDataError({ message: "bad" })).pipe(
				Effect.catchTag("ForkDataError", (e) => Effect.succeed(e.message)),
			)
			expect(result).toBe("bad")
		}),
	)
})

describe("TransportTimeoutError", () => {
	it("has correct tag", () => {
		const error = new TransportTimeoutError({ url: "http://localhost:8545", timeoutMs: 10000 })
		expect(error._tag).toBe("TransportTimeoutError")
		expect(error.url).toBe("http://localhost:8545")
		expect(error.timeoutMs).toBe(10000)
	})

	it.effect("catchable by tag", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(
				new TransportTimeoutError({ url: "http://localhost:8545", timeoutMs: 5000 }),
			).pipe(Effect.catchTag("TransportTimeoutError", (e) => Effect.succeed(e.timeoutMs)))
			expect(result).toBe(5000)
		}),
	)
})
