import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { hexToBytes } from "../evm/conversions.js"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { sendTransactionHandler } from "./sendTransaction.js"

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("sendTransactionHandler", () => {
	// -----------------------------------------------------------------------
	// Happy path: simple ETH transfer
	// -----------------------------------------------------------------------

	it.effect("returns a tx hash for a valid ETH transfer", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const sender = node.accounts[0]!

			const result = yield* sendTransactionHandler(node)({
				from: sender.address,
				to: `0x${"22".repeat(20)}`,
				value: 1_000_000_000_000_000_000n, // 1 ETH
			})

			expect(result.hash).toBeDefined()
			expect(result.hash.startsWith("0x")).toBe(true)
			expect(result.hash.length).toBe(66) // 0x + 64 hex chars
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("deducts value + gas cost from sender balance", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const sender = node.accounts[0]!
			const recipient = `0x${"22".repeat(20)}`

			// Get initial balance
			const senderBefore = yield* node.hostAdapter.getAccount(hexToBytes(sender.address))

			yield* sendTransactionHandler(node)({
				from: sender.address,
				to: recipient,
				value: 1_000_000_000_000_000_000n, // 1 ETH
			})

			const senderAfter = yield* node.hostAdapter.getAccount(hexToBytes(sender.address))

			// Balance should decrease by at least value (plus gas cost)
			expect(senderAfter.balance).toBeLessThan(senderBefore.balance)
			// Should have decreased by approximately 1 ETH + gas
			const decrease = senderBefore.balance - senderAfter.balance
			expect(decrease).toBeGreaterThanOrEqual(1_000_000_000_000_000_000n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("credits value to recipient", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const sender = node.accounts[0]!
			const recipient = `0x${"22".repeat(20)}`
			const value = 1_000_000_000_000_000_000n // 1 ETH

			yield* sendTransactionHandler(node)({
				from: sender.address,
				to: recipient,
				value,
			})

			const recipientAccount = yield* node.hostAdapter.getAccount(hexToBytes(recipient))
			expect(recipientAccount.balance).toBe(value)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("increments sender nonce", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const sender = node.accounts[0]!

			const nonceBefore = (yield* node.hostAdapter.getAccount(hexToBytes(sender.address))).nonce

			yield* sendTransactionHandler(node)({
				from: sender.address,
				to: `0x${"22".repeat(20)}`,
				value: 0n,
			})

			const nonceAfter = (yield* node.hostAdapter.getAccount(hexToBytes(sender.address))).nonce
			expect(nonceAfter).toBe(nonceBefore + 1n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("stores transaction in pool", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const sender = node.accounts[0]!

			const result = yield* sendTransactionHandler(node)({
				from: sender.address,
				to: `0x${"22".repeat(20)}`,
				value: 0n,
			})

			const storedTx = yield* node.txPool.getTransaction(result.hash)
			expect(storedTx.from.toLowerCase()).toBe(sender.address.toLowerCase())
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("generates receipt with status 1 for successful transfer", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const sender = node.accounts[0]!

			const result = yield* sendTransactionHandler(node)({
				from: sender.address,
				to: `0x${"22".repeat(20)}`,
				value: 0n,
			})

			const receipt = yield* node.txPool.getReceipt(result.hash)
			expect(receipt.status).toBe(1)
			expect(receipt.gasUsed).toBeGreaterThan(0n)
			expect(receipt.blockNumber).toBeGreaterThan(0n)
			expect(receipt.logs).toEqual([])
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	// -----------------------------------------------------------------------
	// Error: insufficient balance
	// -----------------------------------------------------------------------

	it.effect("fails with InsufficientBalanceError when balance too low", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Use an address with no balance — must impersonate since it's not a known account
			const poorAddr = `0x${"99".repeat(20)}`
			yield* node.impersonationManager.impersonate(poorAddr)
			yield* node.hostAdapter.setAccount(hexToBytes(poorAddr), {
				nonce: 0n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: new Uint8Array(0),
			})

			const result = yield* sendTransactionHandler(node)({
				from: poorAddr,
				to: `0x${"22".repeat(20)}`,
				value: 1_000_000_000_000_000_000n,
			}).pipe(Effect.either)

			expect(result._tag).toBe("Left")
			if (result._tag === "Left") {
				expect(result.left._tag).toBe("InsufficientBalanceError")
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	// -----------------------------------------------------------------------
	// Error: nonce too low
	// -----------------------------------------------------------------------

	it.effect("fails with NonceTooLowError when nonce is below account nonce", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const sender = node.accounts[0]!

			// First tx succeeds, increments nonce to 1
			yield* sendTransactionHandler(node)({
				from: sender.address,
				to: `0x${"22".repeat(20)}`,
				value: 0n,
			})

			// Send with explicit nonce 0 (now too low)
			const result = yield* sendTransactionHandler(node)({
				from: sender.address,
				to: `0x${"22".repeat(20)}`,
				value: 0n,
				nonce: 0n,
			}).pipe(Effect.either)

			expect(result._tag).toBe("Left")
			if (result._tag === "Left") {
				expect(result.left._tag).toBe("NonceTooLowError")
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	// -----------------------------------------------------------------------
	// Error: intrinsic gas too low
	// -----------------------------------------------------------------------

	it.effect("fails with IntrinsicGasTooLowError when gas is below intrinsic cost", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const sender = node.accounts[0]!

			const result = yield* sendTransactionHandler(node)({
				from: sender.address,
				to: `0x${"22".repeat(20)}`,
				value: 0n,
				gas: 100n, // Way too low (intrinsic is 21000)
			}).pipe(Effect.either)

			expect(result._tag).toBe("Left")
			if (result._tag === "Left") {
				expect(result.left._tag).toBe("IntrinsicGasTooLowError")
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	// -----------------------------------------------------------------------
	// Sequential transactions increment nonce
	// -----------------------------------------------------------------------

	it.effect("sequential transactions increment nonce correctly", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const sender = node.accounts[0]!

			yield* sendTransactionHandler(node)({
				from: sender.address,
				to: `0x${"22".repeat(20)}`,
				value: 0n,
			})

			yield* sendTransactionHandler(node)({
				from: sender.address,
				to: `0x${"22".repeat(20)}`,
				value: 0n,
			})

			const account = yield* node.hostAdapter.getAccount(hexToBytes(sender.address))
			expect(account.nonce).toBe(2n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	// -----------------------------------------------------------------------
	// Default gas
	// -----------------------------------------------------------------------

	it.effect("uses default gas when not specified", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const sender = node.accounts[0]!

			const result = yield* sendTransactionHandler(node)({
				from: sender.address,
				to: `0x${"22".repeat(20)}`,
				value: 0n,
			})

			// Should succeed with default gas
			expect(result.hash).toBeDefined()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	// -----------------------------------------------------------------------
	// Zero value transfer
	// -----------------------------------------------------------------------

	it.effect("handles zero-value transfer", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const sender = node.accounts[0]!

			const result = yield* sendTransactionHandler(node)({
				from: sender.address,
				to: `0x${"22".repeat(20)}`,
				value: 0n,
			})

			const receipt = yield* node.txPool.getReceipt(result.hash)
			expect(receipt.status).toBe(1)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	// -----------------------------------------------------------------------
	// Error: maxFeePerGas < baseFee
	// -----------------------------------------------------------------------

	it.effect("fails with MaxFeePerGasTooLowError when maxFeePerGas < baseFee", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const sender = node.accounts[0]!

			const result = yield* sendTransactionHandler(node)({
				from: sender.address,
				to: `0x${"22".repeat(20)}`,
				value: 0n,
				maxFeePerGas: 0n, // baseFee is 1_000_000_000n (1 gwei)
			}).pipe(Effect.either)

			expect(result._tag).toBe("Left")
			if (result._tag === "Left") {
				expect(result.left._tag).toBe("MaxFeePerGasTooLowError")
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	// -----------------------------------------------------------------------
	// Error: malformed hex input
	// -----------------------------------------------------------------------

	it.effect("fails with ConversionError for malformed hex address", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			const result = yield* sendTransactionHandler(node)({
				from: "0xZZZ", // odd-length, invalid hex
				to: `0x${"22".repeat(20)}`,
				value: 0n,
			}).pipe(Effect.either)

			expect(result._tag).toBe("Left")
			if (result._tag === "Left") {
				expect(result.left._tag).toBe("ConversionError")
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	// -----------------------------------------------------------------------
	// Nonce: explicit nonce > account nonce sets nonce correctly
	// -----------------------------------------------------------------------

	it.effect("sets nonce to txNonce + 1 when explicit nonce > account nonce", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const sender = node.accounts[0]!

			// Send with explicit nonce 5 (account nonce is 0)
			yield* sendTransactionHandler(node)({
				from: sender.address,
				to: `0x${"22".repeat(20)}`,
				value: 0n,
				nonce: 5n,
			})

			const account = yield* node.hostAdapter.getAccount(hexToBytes(sender.address))
			// Should be 6 (txNonce + 1), not 1 (senderAccount.nonce + 1)
			expect(account.nonce).toBe(6n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	// -----------------------------------------------------------------------
	// Balance check: uses maxFeePerGas for worst-case reservation
	// -----------------------------------------------------------------------

	it.effect("balance check uses maxFeePerGas (worst-case) not effectiveGasPrice", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Give account a precise balance: just enough for value + gas * effectiveGasPrice
			// but NOT enough for value + gas * maxFeePerGas
			const testAddr = `0x${"bb".repeat(20)}`
			yield* node.impersonationManager.impersonate(testAddr)
			// baseFee = 1_000_000_000n (1 gwei), maxFeePerGas = 10_000_000_000n (10 gwei)
			// effectiveGasPrice = min(10 gwei, 1 gwei + 0) = 1 gwei
			// With gas=21000: effective cost = 21000 * 1 gwei = 21_000_000_000_000
			// maxFee cost = 21000 * 10 gwei = 210_000_000_000_000
			const balanceTooLowForMaxFee = 100_000_000_000_000n // 0.0001 ETH — enough for effective, not max
			yield* node.hostAdapter.setAccount(hexToBytes(testAddr), {
				nonce: 0n,
				balance: balanceTooLowForMaxFee,
				codeHash: new Uint8Array(32),
				code: new Uint8Array(0),
			})

			const result = yield* sendTransactionHandler(node)({
				from: testAddr,
				to: `0x${"22".repeat(20)}`,
				value: 0n,
				gas: 21000n,
				maxFeePerGas: 10_000_000_000n, // 10 gwei — much higher than baseFee of 1 gwei
			}).pipe(Effect.either)

			// Should fail because balance < gas * maxFeePerGas (worst case)
			expect(result._tag).toBe("Left")
			if (result._tag === "Left") {
				expect(result.left._tag).toBe("InsufficientBalanceError")
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
