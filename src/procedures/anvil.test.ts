import { describe, it } from "@effect/vitest"
import { Effect, Ref } from "effect"
import { expect } from "vitest"
import { TevmNode, TevmNodeService } from "../node/index.js"
import type { WorldStateDump } from "../state/world-state.js"
import {
	anvilAutoImpersonateAccount,
	anvilDropAllTransactions,
	anvilDropTransaction,
	anvilDumpState,
	anvilEnableTraces,
	anvilImpersonateAccount,
	anvilLoadState,
	anvilMine,
	anvilNodeInfo,
	anvilRemoveBlockTimestampInterval,
	anvilReset,
	anvilSetBalance,
	anvilSetBlockGasLimit,
	anvilSetBlockTimestampInterval,
	anvilSetChainId,
	anvilSetCode,
	anvilSetCoinbase,
	anvilSetMinGasPrice,
	anvilSetNextBlockBaseFeePerGas,
	anvilSetNonce,
	anvilSetRpcUrl,
	anvilSetStorageAt,
	anvilStopImpersonatingAccount,
} from "./anvil.js"
import { ethGetBalance, ethGetCode, ethGetStorageAt, ethGetTransactionCount, ethSendTransaction } from "./eth.js"

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const TEST_ADDR = `0x${"00".repeat(19)}ff`

describe("anvilMine procedure", () => {
	it.effect("mines 1 block by default and returns null", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const headBefore = yield* node.blockchain.getHeadBlockNumber()

			const result = yield* anvilMine(node)([])

			expect(result).toBeNull()
			const headAfter = yield* node.blockchain.getHeadBlockNumber()
			expect(headAfter).toBe(headBefore + 1n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("mines specified number of blocks", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const headBefore = yield* node.blockchain.getHeadBlockNumber()

			yield* anvilMine(node)([3])

			const headAfter = yield* node.blockchain.getHeadBlockNumber()
			expect(headAfter).toBe(headBefore + 3n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("mines with hex block count", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const headBefore = yield* node.blockchain.getHeadBlockNumber()

			yield* anvilMine(node)(["0x5"])

			const headAfter = yield* node.blockchain.getHeadBlockNumber()
			// Number("0x5") = NaN — actually we need to handle hex. Let's check.
			// Note: Number("0x5") = 5 in JS! Hex string parsing works.
			expect(headAfter).toBe(headBefore + 5n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// anvil_setBalance
// ---------------------------------------------------------------------------

describe("anvilSetBalance procedure", () => {
	it.effect("set → getBalance → matches", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const oneEthHex = "0xde0b6b3a7640000" // 1 ETH in hex

			yield* anvilSetBalance(node)([TEST_ADDR, oneEthHex])
			const balance = yield* ethGetBalance(node)([TEST_ADDR])

			expect(balance).toBe("0xde0b6b3a7640000")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns null on success", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* anvilSetBalance(node)([TEST_ADDR, "0x1"])
			expect(result).toBeNull()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// anvil_setCode
// ---------------------------------------------------------------------------

describe("anvilSetCode procedure", () => {
	it.effect("set → getCode → matches", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const bytecode = "0x6080604052"

			yield* anvilSetCode(node)([TEST_ADDR, bytecode])
			const code = yield* ethGetCode(node)([TEST_ADDR])

			expect(code).toBe(bytecode)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns null on success", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* anvilSetCode(node)([TEST_ADDR, "0xdeadbeef"])
			expect(result).toBeNull()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// anvil_setNonce
// ---------------------------------------------------------------------------

describe("anvilSetNonce procedure", () => {
	it.effect("set → getTransactionCount → matches", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			yield* anvilSetNonce(node)([TEST_ADDR, "0x2a"]) // 42 in hex
			const nonce = yield* ethGetTransactionCount(node)([TEST_ADDR])

			expect(nonce).toBe("0x2a")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns null on success", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* anvilSetNonce(node)([TEST_ADDR, "0x1"])
			expect(result).toBeNull()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// anvil_setStorageAt
// ---------------------------------------------------------------------------

describe("anvilSetStorageAt procedure", () => {
	it.effect("set → getStorageAt → matches", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const slot = `0x${"00".repeat(32)}`
			const value = "0x42"

			yield* anvilSetStorageAt(node)([TEST_ADDR, slot, value])
			const stored = yield* ethGetStorageAt(node)([TEST_ADDR, slot])

			// ethGetStorageAt returns 32-byte zero-padded hex
			expect(stored).toBe(`0x${"00".repeat(31)}42`)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns true on success", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const slot = `0x${"00".repeat(32)}`
			const result = yield* anvilSetStorageAt(node)([TEST_ADDR, slot, "0x1"])
			expect(result).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// anvil_impersonateAccount / anvil_stopImpersonatingAccount
// ---------------------------------------------------------------------------

describe("anvilImpersonateAccount / anvilStopImpersonatingAccount", () => {
	it.effect("impersonate → send tx as impersonated address → succeeds", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const impersonatedAddr = `0x${"ab".repeat(20)}`

			// Give the impersonated address some ETH
			yield* anvilSetBalance(node)([impersonatedAddr, "0x56bc75e2d63100000"]) // 100 ETH

			// Impersonate
			const result = yield* anvilImpersonateAccount(node)([impersonatedAddr])
			expect(result).toBeNull()

			// Send tx as impersonated address
			const txResult = yield* ethSendTransaction(node)([
				{
					from: impersonatedAddr,
					to: `0x${"22".repeat(20)}`,
					value: "0xde0b6b3a7640000", // 1 ETH
				},
			])
			expect(typeof txResult).toBe("string")
			expect((txResult as string).startsWith("0x")).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("stop impersonation → send tx → fails", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const impersonatedAddr = `0x${"ab".repeat(20)}`

			// Give the address ETH and impersonate
			yield* anvilSetBalance(node)([impersonatedAddr, "0x56bc75e2d63100000"])
			yield* anvilImpersonateAccount(node)([impersonatedAddr])

			// Stop impersonating
			const stopResult = yield* anvilStopImpersonatingAccount(node)([impersonatedAddr])
			expect(stopResult).toBeNull()

			// Sending tx should fail now
			const txResult = yield* ethSendTransaction(node)([
				{
					from: impersonatedAddr,
					to: `0x${"22".repeat(20)}`,
					value: "0xde0b6b3a7640000",
				},
			]).pipe(Effect.either)

			expect(txResult._tag).toBe("Left")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// anvil_autoImpersonateAccount
// ---------------------------------------------------------------------------

describe("anvilAutoImpersonateAccount", () => {
	it.effect("auto impersonate → any address can send tx", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const randomAddr = `0x${"cd".repeat(20)}`

			// Give the address some ETH
			yield* anvilSetBalance(node)([randomAddr, "0x56bc75e2d63100000"])

			// Enable auto-impersonate
			const result = yield* anvilAutoImpersonateAccount(node)([true])
			expect(result).toBeNull()

			// Send tx as random address — should succeed
			const txResult = yield* ethSendTransaction(node)([
				{
					from: randomAddr,
					to: `0x${"22".repeat(20)}`,
					value: "0xde0b6b3a7640000",
				},
			])
			expect(typeof txResult).toBe("string")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("disable auto impersonate → unknown address cannot send tx", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const randomAddr = `0x${"cd".repeat(20)}`

			// Give the address some ETH
			yield* anvilSetBalance(node)([randomAddr, "0x56bc75e2d63100000"])

			// Enable then disable auto-impersonate
			yield* anvilAutoImpersonateAccount(node)([true])
			yield* anvilAutoImpersonateAccount(node)([false])

			// Send tx as random address — should fail
			const txResult = yield* ethSendTransaction(node)([
				{
					from: randomAddr,
					to: `0x${"22".repeat(20)}`,
					value: "0xde0b6b3a7640000",
				},
			]).pipe(Effect.either)

			expect(txResult._tag).toBe("Left")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ===========================================================================
// T3.7 — Remaining anvil_* methods
// ===========================================================================

const T37Layer = TevmNode.LocalTest()

// ---------------------------------------------------------------------------
// anvil_dumpState
// ---------------------------------------------------------------------------

describe("anvilDumpState", () => {
	it.effect("returns serialized state as an object", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* anvilDumpState(node)([])
			expect(result).toBeDefined()
			expect(typeof result).toBe("object")
			expect(result).not.toBeNull()
		}).pipe(Effect.provide(T37Layer)),
	)

	it.effect("dump includes pre-funded test accounts", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = (yield* anvilDumpState(node)([])) as WorldStateDump

			const addresses = Object.keys(result)
			expect(addresses.length).toBeGreaterThanOrEqual(10)

			for (const addr of addresses) {
				const account = result[addr]
				expect(account).toHaveProperty("nonce")
				expect(account).toHaveProperty("balance")
				expect(account).toHaveProperty("code")
				expect(account).toHaveProperty("storage")
			}
		}).pipe(Effect.provide(T37Layer)),
	)
})

// ---------------------------------------------------------------------------
// anvil_loadState
// ---------------------------------------------------------------------------

describe("anvilLoadState", () => {
	it.effect("restores serialized state and returns true", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const dump = yield* anvilDumpState(node)([])
			const result = yield* anvilLoadState(node)([dump])
			expect(result).toBe(true)
		}).pipe(Effect.provide(T37Layer)),
	)

	it.effect("round-trips state correctly (dump -> load -> dump matches)", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const dump1 = (yield* anvilDumpState(node)([])) as WorldStateDump
			yield* anvilReset(node)([])
			yield* anvilLoadState(node)([dump1])
			const dump2 = (yield* anvilDumpState(node)([])) as WorldStateDump
			const addr1 = Object.keys(dump1)
			const addr2 = Object.keys(dump2)

			for (const addr of addr1) {
				expect(addr2).toContain(addr)
				const a1 = dump1[addr]
				const a2 = dump2[addr]
				expect(a1).toBeDefined()
				expect(a2).toBeDefined()
				expect(a2?.balance).toBe(a1?.balance)
				expect(a2?.nonce).toBe(a1?.nonce)
			}
		}).pipe(Effect.provide(T37Layer)),
	)
})

// ---------------------------------------------------------------------------
// anvil_reset
// ---------------------------------------------------------------------------

describe("anvilReset", () => {
	it.effect("returns null on success", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* anvilReset(node)([])
			expect(result).toBeNull()
		}).pipe(Effect.provide(T37Layer)),
	)

	it.effect("clears world state", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const dumpBefore = (yield* anvilDumpState(node)([])) as WorldStateDump
			expect(Object.keys(dumpBefore).length).toBeGreaterThan(0)
			yield* anvilReset(node)([])
			const dumpAfter = (yield* anvilDumpState(node)([])) as WorldStateDump
			expect(Object.keys(dumpAfter).length).toBe(0)
		}).pipe(Effect.provide(T37Layer)),
	)

	it.effect("clears pending transactions", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			yield* node.txPool.addTransaction({
				hash: "0xdeadbeef",
				from: "0x0000000000000000000000000000000000000001",
				to: "0x0000000000000000000000000000000000000002",
				value: 0n,
				gas: 21000n,
				gasPrice: 1000000000n,
				nonce: 0n,
				data: "0x",
			})
			expect((yield* node.txPool.getPendingHashes()).length).toBe(1)
			yield* anvilReset(node)([])
			expect((yield* node.txPool.getPendingHashes()).length).toBe(0)
		}).pipe(Effect.provide(T37Layer)),
	)

	it.effect("updates rpcUrl when forking params provided", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			expect(yield* Ref.get(node.nodeConfig.rpcUrl)).toBeUndefined()
			yield* anvilReset(node)([{ jsonRpcUrl: "https://eth-mainnet.example.com" }])
			expect(yield* Ref.get(node.nodeConfig.rpcUrl)).toBe("https://eth-mainnet.example.com")
		}).pipe(Effect.provide(T37Layer)),
	)
})

// ---------------------------------------------------------------------------
// anvil_setMinGasPrice
// ---------------------------------------------------------------------------

describe("anvilSetMinGasPrice", () => {
	it.effect("sets min gas price and returns null", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* anvilSetMinGasPrice(node)(["0x3B9ACA00"])
			expect(result).toBeNull()
			expect(yield* Ref.get(node.nodeConfig.minGasPrice)).toBe(1000000000n)
		}).pipe(Effect.provide(T37Layer)),
	)
})

// ---------------------------------------------------------------------------
// anvil_setNextBlockBaseFeePerGas
// ---------------------------------------------------------------------------

describe("anvilSetNextBlockBaseFeePerGas", () => {
	it.effect("sets next block base fee and returns null", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* anvilSetNextBlockBaseFeePerGas(node)(["0x5F5E100"])
			expect(result).toBeNull()
			expect(yield* Ref.get(node.nodeConfig.nextBlockBaseFeePerGas)).toBe(100_000_000n)
		}).pipe(Effect.provide(T37Layer)),
	)

	it.effect("base fee is consumed after mining", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			yield* anvilSetNextBlockBaseFeePerGas(node)(["0x5F5E100"])
			expect(yield* Ref.get(node.nodeConfig.nextBlockBaseFeePerGas)).toBe(100_000_000n)
			yield* anvilMine(node)([])
			expect(yield* Ref.get(node.nodeConfig.nextBlockBaseFeePerGas)).toBeUndefined()
		}).pipe(Effect.provide(T37Layer)),
	)
})

// ---------------------------------------------------------------------------
// anvil_setCoinbase
// ---------------------------------------------------------------------------

describe("anvilSetCoinbase", () => {
	it.effect("sets coinbase address and returns null", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const addr = "0x1234567890abcdef1234567890abcdef12345678"
			expect(yield* anvilSetCoinbase(node)([addr])).toBeNull()
			expect(yield* Ref.get(node.nodeConfig.coinbase)).toBe(addr)
		}).pipe(Effect.provide(T37Layer)),
	)
})

// ---------------------------------------------------------------------------
// anvil_setBlockGasLimit
// ---------------------------------------------------------------------------

describe("anvilSetBlockGasLimit", () => {
	it.effect("sets block gas limit and returns true", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			expect(yield* anvilSetBlockGasLimit(node)(["0x1C9C380"])).toBe(true)
			expect(yield* Ref.get(node.nodeConfig.blockGasLimit)).toBe(30_000_000n)
		}).pipe(Effect.provide(T37Layer)),
	)
})

// ---------------------------------------------------------------------------
// anvil_setBlockTimestampInterval / anvil_removeBlockTimestampInterval
// ---------------------------------------------------------------------------

describe("anvilSetBlockTimestampInterval", () => {
	it.effect("sets timestamp interval and returns null", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			expect(yield* anvilSetBlockTimestampInterval(node)([12])).toBeNull()
			expect(yield* Ref.get(node.nodeConfig.blockTimestampInterval)).toBe(12n)
		}).pipe(Effect.provide(T37Layer)),
	)
})

describe("anvilRemoveBlockTimestampInterval", () => {
	it.effect("removes timestamp interval and returns true", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			yield* anvilSetBlockTimestampInterval(node)([12])
			expect(yield* Ref.get(node.nodeConfig.blockTimestampInterval)).toBe(12n)
			expect(yield* anvilRemoveBlockTimestampInterval(node)([])).toBe(true)
			expect(yield* Ref.get(node.nodeConfig.blockTimestampInterval)).toBeUndefined()
		}).pipe(Effect.provide(T37Layer)),
	)
})

// ---------------------------------------------------------------------------
// anvil_setChainId
// ---------------------------------------------------------------------------

describe("anvilSetChainId", () => {
	it.effect("sets chain ID and returns null", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			expect(yield* anvilSetChainId(node)(["0x2a"])).toBeNull()
			expect(yield* Ref.get(node.nodeConfig.chainId)).toBe(42n)
		}).pipe(Effect.provide(T37Layer)),
	)
})

// ---------------------------------------------------------------------------
// anvil_setRpcUrl
// ---------------------------------------------------------------------------

describe("anvilSetRpcUrl", () => {
	it.effect("sets RPC URL and returns null", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const url = "https://eth-mainnet.alchemyapi.io/v2/test"
			expect(yield* anvilSetRpcUrl(node)([url])).toBeNull()
			expect(yield* Ref.get(node.nodeConfig.rpcUrl)).toBe(url)
		}).pipe(Effect.provide(T37Layer)),
	)
})

// ---------------------------------------------------------------------------
// anvil_dropTransaction / anvil_dropAllTransactions
// ---------------------------------------------------------------------------

describe("anvilDropTransaction", () => {
	it.effect("removes a pending transaction and returns true", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const txHash = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
			yield* node.txPool.addTransaction({
				hash: txHash,
				from: "0x0000000000000000000000000000000000000001",
				to: "0x0000000000000000000000000000000000000002",
				value: 0n,
				gas: 21000n,
				gasPrice: 1000000000n,
				nonce: 0n,
				data: "0x",
			})
			expect(yield* anvilDropTransaction(node)([txHash])).toBe(true)
			expect(yield* node.txPool.getPendingHashes()).not.toContain(txHash)
		}).pipe(Effect.provide(T37Layer)),
	)

	it.effect("returns null when transaction is not found", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			expect(yield* anvilDropTransaction(node)(["0xnonexistent"])).toBeNull()
		}).pipe(Effect.provide(T37Layer)),
	)
})

describe("anvilDropAllTransactions", () => {
	it.effect("clears all pending transactions and returns null", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			for (let i = 0; i < 3; i++) {
				yield* node.txPool.addTransaction({
					hash: `0x${"0".repeat(63)}${i}`,
					from: "0x0000000000000000000000000000000000000001",
					to: "0x0000000000000000000000000000000000000002",
					value: 0n,
					gas: 21000n,
					gasPrice: 1000000000n,
					nonce: BigInt(i),
					data: "0x",
				})
			}
			expect((yield* node.txPool.getPendingHashes()).length).toBe(3)
			expect(yield* anvilDropAllTransactions(node)([])).toBeNull()
			expect((yield* node.txPool.getPendingHashes()).length).toBe(0)
		}).pipe(Effect.provide(T37Layer)),
	)
})

// ---------------------------------------------------------------------------
// anvil_enableTraces
// ---------------------------------------------------------------------------

describe("anvilEnableTraces", () => {
	it.effect("enables traces and returns null", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			expect(yield* Ref.get(node.nodeConfig.tracesEnabled)).toBe(false)
			expect(yield* anvilEnableTraces(node)([])).toBeNull()
			expect(yield* Ref.get(node.nodeConfig.tracesEnabled)).toBe(true)
		}).pipe(Effect.provide(T37Layer)),
	)
})

// ---------------------------------------------------------------------------
// anvil_nodeInfo
// ---------------------------------------------------------------------------

describe("anvilNodeInfo", () => {
	it.effect("returns node information object with all fields", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* anvilNodeInfo(node)([])
			expect(result).toBeDefined()
			expect(typeof result).toBe("object")
			const info = result as Record<string, unknown>
			expect(info).toHaveProperty("currentBlockNumber")
			expect(info).toHaveProperty("currentBlockTimestamp")
			expect(info).toHaveProperty("currentBlockHash")
			expect(info).toHaveProperty("chainId")
			expect(info).toHaveProperty("hardFork")
			expect(info).toHaveProperty("network")
			expect(info).toHaveProperty("miningMode")
		}).pipe(Effect.provide(T37Layer)),
	)

	it.effect("returns correct default values", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const info = (yield* anvilNodeInfo(node)([])) as Record<string, unknown>
			expect(info.chainId).toBe("0x7a69")
			expect(info.network).toBe(31337)
			expect(info.currentBlockNumber).toBe("0x0")
			expect(info.hardFork).toBe("prague")
			expect(info.miningMode).toBe("auto")
		}).pipe(Effect.provide(T37Layer)),
	)

	it.effect("reflects updated chain ID after anvilSetChainId", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			yield* anvilSetChainId(node)(["0x2a"])
			const info = (yield* anvilNodeInfo(node)([])) as Record<string, unknown>
			expect(info.chainId).toBe("0x2a")
			expect(info.network).toBe(42)
		}).pipe(Effect.provide(T37Layer)),
	)
})

// ---------------------------------------------------------------------------
// anvil_mine with nodeConfig overrides
// ---------------------------------------------------------------------------

describe("anvilMine with nodeConfig overrides", () => {
	it.effect("mines with base fee override then clears it", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			yield* Ref.set(node.nodeConfig.nextBlockBaseFeePerGas, 42n)
			yield* anvilMine(node)([1])
			expect(yield* Ref.get(node.nodeConfig.nextBlockBaseFeePerGas)).toBeUndefined()
		}).pipe(Effect.provide(T37Layer)),
	)

	it.effect("mines with timestamp override then clears it", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			yield* Ref.set(node.nodeConfig.nextBlockTimestamp, 9999999n)
			yield* anvilMine(node)([1])
			expect(yield* Ref.get(node.nodeConfig.nextBlockTimestamp)).toBeUndefined()
		}).pipe(Effect.provide(T37Layer)),
	)
})
