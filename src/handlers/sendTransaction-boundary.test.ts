import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { hexToBytes } from "../evm/conversions.js"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { sendTransactionHandler } from "./sendTransaction.js"

// ============================================================================
// Legacy gasPrice path (lines 76-78)
// ============================================================================

describe("sendTransactionHandler — legacy gasPrice path", () => {
	it.effect("uses gasPrice when maxFeePerGas is not set (legacy tx)", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const sender = node.accounts[0]!

			const balanceBefore = (yield* node.hostAdapter.getAccount(hexToBytes(sender.address))).balance

			const result = yield* sendTransactionHandler(node)({
				from: sender.address,
				to: `0x${"22".repeat(20)}`,
				value: 0n,
				gasPrice: 2_000_000_000n, // 2 gwei — legacy
				gas: 21000n,
			})

			expect(result.hash).toBeDefined()

			// Verify gas was charged at gasPrice rate
			const balanceAfter = (yield* node.hostAdapter.getAccount(hexToBytes(sender.address))).balance
			const gasCost = balanceBefore - balanceAfter
			// Gas cost should be 21000 * 2 gwei = 42_000_000_000_000
			expect(gasCost).toBe(21000n * 2_000_000_000n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("uses gasPrice for balance check (maxGasPrice path, line 198)", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Create account with just enough for gasPrice but not enough for higher baseFee
			const testAddr = `0x${"aa".repeat(20)}`
			yield* node.impersonationManager.impersonate(testAddr)
			// gasPrice = 2 gwei, gas = 21000 → cost = 42_000_000_000_000
			const justEnough = 42_000_000_000_000n
			yield* node.hostAdapter.setAccount(hexToBytes(testAddr), {
				nonce: 0n,
				balance: justEnough,
				codeHash: new Uint8Array(32),
				code: new Uint8Array(0),
			})

			const result = yield* sendTransactionHandler(node)({
				from: testAddr,
				to: `0x${"22".repeat(20)}`,
				value: 0n,
				gasPrice: 2_000_000_000n,
				gas: 21000n,
			})

			expect(result.hash).toBeDefined()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("gasPrice insufficient balance check works correctly", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			const testAddr = `0x${"ab".repeat(20)}`
			yield* node.impersonationManager.impersonate(testAddr)
			// Not enough: gasPrice = 2 gwei, gas = 21000 → need 42_000_000_000_000
			yield* node.hostAdapter.setAccount(hexToBytes(testAddr), {
				nonce: 0n,
				balance: 1n, // way too little
				codeHash: new Uint8Array(32),
				code: new Uint8Array(0),
			})

			const result = yield* sendTransactionHandler(node)({
				from: testAddr,
				to: `0x${"22".repeat(20)}`,
				value: 0n,
				gasPrice: 2_000_000_000n,
				gas: 21000n,
			}).pipe(Effect.either)

			expect(result._tag).toBe("Left")
			if (result._tag === "Left") {
				expect(result.left._tag).toBe("InsufficientBalanceError")
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ============================================================================
// Contract creation (no to field)
// ============================================================================

describe("sendTransactionHandler — contract creation", () => {
	it.effect("handles tx without 'to' field (contract creation)", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const sender = node.accounts[0]!

			const result = yield* sendTransactionHandler(node)({
				from: sender.address,
				// no 'to' field = contract creation
				value: 0n,
				data: "0x6080604052", // minimal contract bytecode
			})

			expect(result.hash).toBeDefined()

			// Verify the tx was stored in pool without 'to'
			const tx = yield* node.txPool.getTransaction(result.hash)
			expect(tx.to).toBeUndefined()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ============================================================================
// Data field handling
// ============================================================================

describe("sendTransactionHandler — data field", () => {
	it.effect("handles tx with data field", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const sender = node.accounts[0]!

			const result = yield* sendTransactionHandler(node)({
				from: sender.address,
				to: `0x${"22".repeat(20)}`,
				value: 0n,
				data: "0xdeadbeef",
			})

			expect(result.hash).toBeDefined()
			const tx = yield* node.txPool.getTransaction(result.hash)
			expect(tx.data).toBe("0xdeadbeef")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("handles tx with empty data field", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const sender = node.accounts[0]!

			const result = yield* sendTransactionHandler(node)({
				from: sender.address,
				to: `0x${"22".repeat(20)}`,
				value: 0n,
				data: "0x",
			})

			expect(result.hash).toBeDefined()
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("fails with ConversionError for odd-length data hex", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const sender = node.accounts[0]!

			const result = yield* sendTransactionHandler(node)({
				from: sender.address,
				to: `0x${"22".repeat(20)}`,
				value: 0n,
				data: "0xabc", // odd-length hex → ConversionError
			}).pipe(Effect.either)

			expect(result._tag).toBe("Left")
			if (result._tag === "Left") {
				expect(result.left._tag).toBe("ConversionError")
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ============================================================================
// EIP-1559 effective gas price calculation
// ============================================================================

describe("sendTransactionHandler — effective gas price", () => {
	it.effect("uses min(maxFeePerGas, baseFee + priorityFee) for effective price", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const sender = node.accounts[0]!

			const balanceBefore = (yield* node.hostAdapter.getAccount(hexToBytes(sender.address))).balance

			yield* sendTransactionHandler(node)({
				from: sender.address,
				to: `0x${"22".repeat(20)}`,
				value: 0n,
				gas: 21000n,
				maxFeePerGas: 10_000_000_000n, // 10 gwei
				maxPriorityFeePerGas: 500_000_000n, // 0.5 gwei
			})

			const balanceAfter = (yield* node.hostAdapter.getAccount(hexToBytes(sender.address))).balance
			const gasCost = balanceBefore - balanceAfter
			// baseFee = 1 gwei, priority = 0.5 gwei → effective = 1.5 gwei
			// cost = 21000 * 1.5 gwei = 31_500_000_000_000
			expect(gasCost).toBe(21000n * 1_500_000_000n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("caps effective price at maxFeePerGas when baseFee + priority > maxFee", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const sender = node.accounts[0]!

			const balanceBefore = (yield* node.hostAdapter.getAccount(hexToBytes(sender.address))).balance

			yield* sendTransactionHandler(node)({
				from: sender.address,
				to: `0x${"22".repeat(20)}`,
				value: 0n,
				gas: 21000n,
				// maxFeePerGas < baseFee + priorityFee, but maxFeePerGas >= baseFee
				maxFeePerGas: 1_000_000_000n, // 1 gwei (= baseFee)
				maxPriorityFeePerGas: 5_000_000_000n, // 5 gwei
			})

			const balanceAfter = (yield* node.hostAdapter.getAccount(hexToBytes(sender.address))).balance
			const gasCost = balanceBefore - balanceAfter
			// effective = min(1 gwei, 1 gwei + 5 gwei) = 1 gwei
			// cost = 21000 * 1 gwei = 21_000_000_000_000
			expect(gasCost).toBe(21000n * 1_000_000_000n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ============================================================================
// Manual mining mode — tx not auto-mined
// ============================================================================

describe("sendTransactionHandler — manual mining mode", () => {
	it.effect("tx stays pending when mining mode is manual", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const sender = node.accounts[0]!

			// Switch to manual mode
			yield* node.mining.setAutomine(false)

			const result = yield* sendTransactionHandler(node)({
				from: sender.address,
				to: `0x${"22".repeat(20)}`,
				value: 0n,
			})

			// Tx should be in pool but pending (not mined)
			const pendingHashes = yield* node.txPool.getPendingHashes()
			expect(pendingHashes).toContain(result.hash)

			// Block number should still be 0 (no block mined)
			const head = yield* node.blockchain.getHead()
			expect(head.number).toBe(0n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
