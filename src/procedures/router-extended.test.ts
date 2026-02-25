// Tests for T3.7 — verify all new methods are registered in the router.

import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { methodRouter } from "./router.js"

// ---------------------------------------------------------------------------
// All new anvil_* methods
// ---------------------------------------------------------------------------

const anvilMethods: Record<string, { params: readonly unknown[]; expectedType: string }> = {
	anvil_dumpState: { params: [], expectedType: "object" },
	anvil_loadState: {
		params: [
			{
				[`0x${"00".repeat(19)}bb`]: {
					nonce: "0x0",
					balance: "0x0",
					code: "0x",
					storage: {},
				},
			},
		],
		expectedType: "boolean",
	},
	anvil_reset: { params: [], expectedType: "null" },
	anvil_setMinGasPrice: { params: ["0x1"], expectedType: "null" },
	anvil_setNextBlockBaseFeePerGas: { params: ["0x1"], expectedType: "null" },
	anvil_setCoinbase: { params: [`0x${"00".repeat(20)}`], expectedType: "null" },
	anvil_setBlockGasLimit: { params: ["0x1c9c380"], expectedType: "boolean" },
	anvil_setBlockTimestampInterval: { params: [12], expectedType: "null" },
	anvil_removeBlockTimestampInterval: { params: [], expectedType: "boolean" },
	anvil_setChainId: { params: ["0x1"], expectedType: "null" },
	anvil_setRpcUrl: { params: ["http://localhost:8545"], expectedType: "null" },
	anvil_dropTransaction: { params: [`0x${"ab".repeat(32)}`], expectedType: "null" },
	anvil_dropAllTransactions: { params: [], expectedType: "null" },
	anvil_enableTraces: { params: [], expectedType: "null" },
	anvil_nodeInfo: { params: [], expectedType: "object" },
}

const evmMethods: Record<string, { params: readonly unknown[]; expectedType: string; expectedValue?: string }> = {
	evm_increaseTime: { params: [60], expectedType: "string" },
	evm_setNextBlockTimestamp: { params: [2_000_000_000], expectedType: "string" },
	evm_setAutomine: { params: [true], expectedType: "string", expectedValue: "true" },
}

describe("router — T3.7 anvil_* methods", () => {
	for (const [method, { params, expectedType }] of Object.entries(anvilMethods)) {
		it.effect(`routes ${method} successfully`, () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const result = yield* methodRouter(node)(method, params)

				if (expectedType === "null") {
					expect(result).toBeNull()
				} else if (expectedType === "boolean") {
					expect(typeof result).toBe("boolean")
				} else if (expectedType === "string") {
					expect(typeof result).toBe("string")
				} else if (expectedType === "object") {
					expect(typeof result).toBe("object")
				}
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)
	}
})

describe("router — T3.7 evm_* methods", () => {
	for (const [method, { params, expectedType, expectedValue }] of Object.entries(evmMethods)) {
		it.effect(`routes ${method} successfully`, () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const result = yield* methodRouter(node)(method, params)

				if (expectedValue !== undefined) {
					expect(result).toBe(expectedValue)
				} else if (expectedType === "string") {
					expect(typeof result).toBe("string")
					expect((result as string).startsWith("0x")).toBe(true)
				}
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)
	}
})
