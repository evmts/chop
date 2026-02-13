import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { hexToBytes } from "../evm/conversions.js"
import { TevmNode, TevmNodeService } from "../node/index.js"
import {
	anvilAutoImpersonateAccount,
	anvilImpersonateAccount,
	anvilMine,
	anvilSetBalance,
	anvilSetCode,
	anvilSetNonce,
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
