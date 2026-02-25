import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { web3ClientVersion, web3Sha3 } from "./web3.js"

describe("web3ClientVersion", () => {
	it.effect("returns version string", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* web3ClientVersion(node)([])
			expect(result).toBe("chop/0.1.0")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

describe("web3Sha3", () => {
	it.effect("returns keccak256 hash of hex data", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* web3Sha3(node)(["0x68656c6c6f"])
			// keccak256 of "hello" as hex
			expect(typeof result).toBe("string")
			expect((result as string).startsWith("0x")).toBe(true)
			expect((result as string).length).toBe(66) // 0x + 64 hex chars
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns keccak256 hash of string data", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* web3Sha3(node)(["hello"])
			expect(typeof result).toBe("string")
			expect((result as string).startsWith("0x")).toBe(true)
			expect((result as string).length).toBe(66)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
