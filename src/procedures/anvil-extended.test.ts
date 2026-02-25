// Tests for T3.7 remaining anvil_* procedures.

import { describe, it } from "@effect/vitest"
import { Effect, Ref } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../node/index.js"
import {
	anvilDropAllTransactions,
	anvilDropTransaction,
	anvilDumpState,
	anvilEnableTraces,
	anvilLoadState,
	anvilNodeInfo,
	anvilRemoveBlockTimestampInterval,
	anvilReset,
	anvilSetBalance,
	anvilSetBlockGasLimit,
	anvilSetBlockTimestampInterval,
	anvilSetChainId,
	anvilSetCoinbase,
	anvilSetMinGasPrice,
	anvilSetNextBlockBaseFeePerGas,
	anvilSetRpcUrl,
} from "./anvil.js"
import { ethChainId, ethGetBalance } from "./eth.js"

const TEST_ADDR = `0x${"00".repeat(19)}ff`

// ---------------------------------------------------------------------------
// anvil_dumpState / anvil_loadState
// ---------------------------------------------------------------------------

describe("anvilDumpState procedure", () => {
	it.effect("returns serialized state JSON with accounts", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			// Set some state first
			yield* anvilSetBalance(node)([TEST_ADDR, "0xde0b6b3a7640000"])

			const result = yield* anvilDumpState(node)([])

			expect(result).toBeDefined()
			expect(typeof result).toBe("object")
			const dump = result as Record<string, unknown>
			// Should contain the test address
			expect(dump[TEST_ADDR]).toBeDefined()
			const acct = dump[TEST_ADDR] as Record<string, unknown>
			expect(acct.balance).toBe("0xde0b6b3a7640000")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

describe("anvilLoadState procedure", () => {
	it.effect("restores state from dumped JSON", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const targetAddr = `0x${"00".repeat(19)}aa`

			// Load state with a new account
			const stateToLoad = {
				[targetAddr]: {
					nonce: "0x5",
					balance: "0x1000",
					code: "0x",
					storage: {},
				},
			}
			const result = yield* anvilLoadState(node)([stateToLoad])
			expect(result).toBe(true)

			// Verify loaded state
			const balance = yield* ethGetBalance(node)([targetAddr])
			expect(balance).toBe("0x1000")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("dump → load round-trip preserves state", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Create some state
			yield* anvilSetBalance(node)([TEST_ADDR, "0x42"])

			// Dump it
			const dumped = yield* anvilDumpState(node)([])

			// Reset state
			yield* anvilReset(node)([])

			// Load it back
			yield* anvilLoadState(node)([dumped])

			// Verify
			const balance = yield* ethGetBalance(node)([TEST_ADDR])
			expect(balance).toBe("0x42")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// anvil_reset
// ---------------------------------------------------------------------------

describe("anvilReset procedure", () => {
	it.effect("resets state to empty and returns null", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Create some state
			yield* anvilSetBalance(node)([TEST_ADDR, "0x1000"])

			// Reset
			const result = yield* anvilReset(node)([])
			expect(result).toBeNull()

			// Balance should be 0 now (account was cleared)
			const balance = yield* ethGetBalance(node)([TEST_ADDR])
			expect(balance).toBe("0x0")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("accepts fork options with jsonRpcUrl", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			const result = yield* anvilReset(node)([{ jsonRpcUrl: "http://localhost:8545" }])
			expect(result).toBeNull()

			// Check that rpcUrl was updated
			const url = yield* Ref.get(node.nodeConfig.rpcUrl)
			expect(url).toBe("http://localhost:8545")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// anvil_setMinGasPrice
// ---------------------------------------------------------------------------

describe("anvilSetMinGasPrice procedure", () => {
	it.effect("sets min gas price and returns null", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			const result = yield* anvilSetMinGasPrice(node)(["0x3b9aca00"]) // 1 gwei
			expect(result).toBeNull()

			const gasPrice = yield* Ref.get(node.nodeConfig.minGasPrice)
			expect(gasPrice).toBe(1_000_000_000n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// anvil_setNextBlockBaseFeePerGas
// ---------------------------------------------------------------------------

describe("anvilSetNextBlockBaseFeePerGas procedure", () => {
	it.effect("sets next block base fee and returns null", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			const result = yield* anvilSetNextBlockBaseFeePerGas(node)(["0x77359400"]) // 2 gwei
			expect(result).toBeNull()

			const baseFee = yield* Ref.get(node.nodeConfig.nextBlockBaseFeePerGas)
			expect(baseFee).toBe(2_000_000_000n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// anvil_setCoinbase
// ---------------------------------------------------------------------------

describe("anvilSetCoinbase procedure", () => {
	it.effect("sets coinbase address and returns null", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const coinbaseAddr = `0x${"ab".repeat(20)}`

			const result = yield* anvilSetCoinbase(node)([coinbaseAddr])
			expect(result).toBeNull()

			const coinbase = yield* Ref.get(node.nodeConfig.coinbase)
			expect(coinbase).toBe(coinbaseAddr)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// anvil_setBlockGasLimit
// ---------------------------------------------------------------------------

describe("anvilSetBlockGasLimit procedure", () => {
	it.effect("sets block gas limit and returns true", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			const result = yield* anvilSetBlockGasLimit(node)(["0x1c9c380"]) // 30M
			expect(result).toBe(true)

			const gasLimit = yield* Ref.get(node.nodeConfig.blockGasLimit)
			expect(gasLimit).toBe(30_000_000n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// anvil_setBlockTimestampInterval / anvil_removeBlockTimestampInterval
// ---------------------------------------------------------------------------

describe("anvilSetBlockTimestampInterval procedure", () => {
	it.effect("sets timestamp interval and returns null", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			const result = yield* anvilSetBlockTimestampInterval(node)([12])
			expect(result).toBeNull()

			const interval = yield* Ref.get(node.nodeConfig.blockTimestampInterval)
			expect(interval).toBe(12n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

describe("anvilRemoveBlockTimestampInterval procedure", () => {
	it.effect("removes timestamp interval and returns true", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Set then remove
			yield* anvilSetBlockTimestampInterval(node)([12])
			const result = yield* anvilRemoveBlockTimestampInterval(node)([])
			expect(result).toBe(true)

			const interval = yield* Ref.get(node.nodeConfig.blockTimestampInterval)
			expect(interval).toBeUndefined()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// anvil_setChainId
// ---------------------------------------------------------------------------

describe("anvilSetChainId procedure", () => {
	it.effect("sets chain ID and returns null", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			const result = yield* anvilSetChainId(node)(["0x1"]) // mainnet
			expect(result).toBeNull()

			const chainId = yield* Ref.get(node.nodeConfig.chainId)
			expect(chainId).toBe(1n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("affects eth_chainId response", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			yield* anvilSetChainId(node)(["0xa"]) // 10
			const chainId = yield* ethChainId(node)([])
			expect(chainId).toBe("0xa")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// anvil_setRpcUrl
// ---------------------------------------------------------------------------

describe("anvilSetRpcUrl procedure", () => {
	it.effect("sets RPC URL and returns null", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			const result = yield* anvilSetRpcUrl(node)(["http://localhost:8545"])
			expect(result).toBeNull()

			const url = yield* Ref.get(node.nodeConfig.rpcUrl)
			expect(url).toBe("http://localhost:8545")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// anvil_dropTransaction / anvil_dropAllTransactions
// ---------------------------------------------------------------------------

describe("anvilDropTransaction procedure", () => {
	it.effect("returns null for non-existent pending tx", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const fakeTxHash = `0x${"ab".repeat(32)}`

			const result = yield* anvilDropTransaction(node)([fakeTxHash])
			expect(result).toBeNull() // Not found returns null
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

describe("anvilDropAllTransactions procedure", () => {
	it.effect("clears all pending transactions and returns null", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			const result = yield* anvilDropAllTransactions(node)([])
			expect(result).toBeNull()

			// Verify pool is empty
			const pending = yield* node.txPool.getPendingHashes()
			expect(pending.length).toBe(0)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// anvil_enableTraces
// ---------------------------------------------------------------------------

describe("anvilEnableTraces procedure", () => {
	it.effect("enables traces and returns null", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			const result = yield* anvilEnableTraces(node)([])
			expect(result).toBeNull()

			const enabled = yield* Ref.get(node.nodeConfig.tracesEnabled)
			expect(enabled).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// anvil_nodeInfo
// ---------------------------------------------------------------------------

describe("anvilNodeInfo procedure", () => {
	it.effect("returns node info object", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			const result = yield* anvilNodeInfo(node)([])

			expect(typeof result).toBe("object")
			const info = result as Record<string, unknown>
			expect(info.currentBlockNumber).toBeDefined()
			expect(info.currentBlockHash).toBeDefined()
			expect(info.chainId).toBe("0x7a69") // 31337 = 0x7a69
			expect(info.hardFork).toBe("prague")
			expect(info.miningMode).toBe("auto")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("reflects updated chain ID", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			yield* anvilSetChainId(node)(["0x1"])
			const result = yield* anvilNodeInfo(node)([])

			const info = result as Record<string, unknown>
			expect(info.chainId).toBe("0x1")
			expect(info.network).toBe(1)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
