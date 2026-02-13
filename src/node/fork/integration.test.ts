/**
 * Integration tests for fork mode — acceptance criteria.
 *
 * Uses mock transport (no real RPC endpoint needed).
 * Tests:
 * 1. Fork → read balance → matches remote
 * 2. Fork → set balance → read → new balance
 * 3. Fork → read storage → matches remote
 * 4. Fork → call contract → correct return
 */

import { describe, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { expect } from "vitest"
import { bytesToBigint } from "../../evm/conversions.js"
import { hexToBytes } from "../../evm/conversions.js"
import { EMPTY_CODE_HASH } from "../../state/account.js"
import { TevmNode, TevmNodeService } from "../index.js"
import { type HttpTransportApi, HttpTransportService } from "./http-transport.js"

// ---------------------------------------------------------------------------
// Mock transport — simulates Ethereum mainnet responses
// ---------------------------------------------------------------------------

// USDC contract on mainnet
const USDC_ADDRESS = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
const USDC_HOLDER = "0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503" // Binance hot wallet (large USDC holder)
const USDC_BALANCE_SLOT = "0x0000000000000000000000000000000000000000000000000000000000000009" // Example slot

const MOCK_USDC_BALANCE = 1_000_000_000_000n // 1M USDC (6 decimals)
const MOCK_STORAGE_VALUE = 0xdeadbeefn

// Contract that reads storage slot 1 and returns it
const SIMPLE_CONTRACT_CODE = "0x60015460005260206000f3" // PUSH1 0x01, SLOAD, PUSH1 0x00, MSTORE, PUSH1 0x20, PUSH1 0x00, RETURN

const mockMainnetTransport: HttpTransportApi = {
	request: (method, params) => {
		const addr = (params as string[])[0]?.toLowerCase()

		if (method === "eth_getStorageAt") {
			// Return mock storage value for USDC holder at balance slot
			if (addr === USDC_HOLDER.toLowerCase()) {
				return Effect.succeed(`0x${MOCK_STORAGE_VALUE.toString(16).padStart(64, "0")}`) as Effect.Effect<unknown, never>
			}
			return Effect.succeed(`0x${"0".repeat(64)}`) as Effect.Effect<unknown, never>
		}

		if (method === "eth_getBalance") {
			if (addr === USDC_HOLDER.toLowerCase()) {
				return Effect.succeed(`0x${MOCK_USDC_BALANCE.toString(16)}`) as Effect.Effect<unknown, never>
			}
			return Effect.succeed("0x0") as Effect.Effect<unknown, never>
		}

		if (method === "eth_getTransactionCount") {
			return Effect.succeed("0x5") as Effect.Effect<unknown, never>
		}

		if (method === "eth_getCode") {
			if (addr === USDC_ADDRESS.toLowerCase()) {
				return Effect.succeed(SIMPLE_CONTRACT_CODE) as Effect.Effect<unknown, never>
			}
			return Effect.succeed("0x") as Effect.Effect<unknown, never>
		}

		return Effect.succeed("0x0") as Effect.Effect<unknown, never>
	},
	batchRequest: (calls) => {
		const results = calls.map((c) => {
			const addr = (c.params as string[])[0]?.toLowerCase()

			if (c.method === "eth_getBalance") {
				if (addr === USDC_HOLDER.toLowerCase()) {
					return `0x${MOCK_USDC_BALANCE.toString(16)}`
				}
				return "0x0"
			}
			if (c.method === "eth_getTransactionCount") {
				return "0x5"
			}
			if (c.method === "eth_getCode") {
				if (addr === USDC_ADDRESS.toLowerCase()) {
					return SIMPLE_CONTRACT_CODE
				}
				return "0x"
			}
			return "0x0"
		})
		return Effect.succeed(results) as Effect.Effect<readonly unknown[], never>
	},
}

const mockTransportLayer = Layer.succeed(HttpTransportService, mockMainnetTransport)

const ForkTestLayer = TevmNode.ForkTestWithTransport({ chainId: 1n, blockNumber: 18_000_000n }, mockTransportLayer)

// ---------------------------------------------------------------------------
// Acceptance test 1: fork → read balance → matches remote
// ---------------------------------------------------------------------------

describe("Fork mode — read remote balance", () => {
	it.effect("reads USDC holder balance from remote", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const addrBytes = hexToBytes(USDC_HOLDER)
			const account = yield* node.hostAdapter.getAccount(addrBytes)
			expect(account.balance).toBe(MOCK_USDC_BALANCE)
			expect(account.nonce).toBe(5n)
		}).pipe(Effect.provide(ForkTestLayer)),
	)

	it.effect("unknown address returns zero balance", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const unknownAddr = hexToBytes(`0x${"00".repeat(19)}ff`)
			const account = yield* node.hostAdapter.getAccount(unknownAddr)
			expect(account.balance).toBe(0n)
		}).pipe(Effect.provide(ForkTestLayer)),
	)
})

// ---------------------------------------------------------------------------
// Acceptance test 2: fork → set balance → read → new balance
// ---------------------------------------------------------------------------

describe("Fork mode — set balance overrides remote", () => {
	it.effect("set balance overrides remote balance", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const addrBytes = hexToBytes(USDC_HOLDER)

			// Verify remote balance
			const before = yield* node.hostAdapter.getAccount(addrBytes)
			expect(before.balance).toBe(MOCK_USDC_BALANCE)

			// Set new balance locally
			yield* node.hostAdapter.setAccount(addrBytes, {
				nonce: before.nonce,
				balance: 42n,
				codeHash: EMPTY_CODE_HASH,
				code: new Uint8Array(0),
			})

			// Read new balance
			const after = yield* node.hostAdapter.getAccount(addrBytes)
			expect(after.balance).toBe(42n)
		}).pipe(Effect.provide(ForkTestLayer)),
	)

	it.effect("set balance on new address works", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const newAddr = hexToBytes(`0x${"00".repeat(19)}aa`)

			yield* node.hostAdapter.setAccount(newAddr, {
				nonce: 0n,
				balance: 1_000_000n,
				codeHash: EMPTY_CODE_HASH,
				code: new Uint8Array(0),
			})

			const account = yield* node.hostAdapter.getAccount(newAddr)
			expect(account.balance).toBe(1_000_000n)
		}).pipe(Effect.provide(ForkTestLayer)),
	)
})

// ---------------------------------------------------------------------------
// Acceptance test 3: fork → read storage → matches remote
// ---------------------------------------------------------------------------

describe("Fork mode — read remote storage", () => {
	it.effect("reads storage from remote", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const addrBytes = hexToBytes(USDC_HOLDER)
			const slotBytes = hexToBytes(USDC_BALANCE_SLOT)
			const value = yield* node.hostAdapter.getStorage(addrBytes, slotBytes)
			expect(value).toBe(MOCK_STORAGE_VALUE)
		}).pipe(Effect.provide(ForkTestLayer)),
	)

	it.effect("unknown storage slot returns 0", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const addrBytes = hexToBytes(`0x${"00".repeat(19)}ff`)
			const slotBytes = hexToBytes(`0x${"00".repeat(31)}01`)
			const value = yield* node.hostAdapter.getStorage(addrBytes, slotBytes)
			expect(value).toBe(0n)
		}).pipe(Effect.provide(ForkTestLayer)),
	)
})

// ---------------------------------------------------------------------------
// Acceptance test 4: fork → call contract → correct return
// ---------------------------------------------------------------------------

describe("Fork mode — call contract", () => {
	it.effect("execute contract code that reads storage", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const contractAddr = hexToBytes(USDC_ADDRESS)

			// Get the contract code from remote
			const acct = yield* node.hostAdapter.getAccount(contractAddr)
			expect(acct.code.length).toBeGreaterThan(0)

			// Set storage at slot 1 for the contract
			yield* node.hostAdapter.setStorage(contractAddr, hexToBytes(`0x${"00".repeat(31)}01`), 0xcafen)

			// Execute the contract code: PUSH1 0x01, SLOAD, PUSH1 0x00, MSTORE, PUSH1 0x20, PUSH1 0x00, RETURN
			const result = yield* node.evm.executeAsync(
				{ bytecode: acct.code, address: contractAddr },
				node.hostAdapter.hostCallbacks,
			)

			expect(result.success).toBe(true)
			expect(bytesToBigint(result.output)).toBe(0xcafen)
		}).pipe(Effect.provide(ForkTestLayer)),
	)
})

// ---------------------------------------------------------------------------
// Fork mode — snapshot/restore preserves fork overlay
// ---------------------------------------------------------------------------

describe("Fork mode — snapshot/restore with fork overlay", () => {
	it.effect("snapshot → modify → restore → back to remote value", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const addrBytes = hexToBytes(USDC_HOLDER)

			// Read remote
			const remote = yield* node.hostAdapter.getAccount(addrBytes)
			expect(remote.balance).toBe(MOCK_USDC_BALANCE)

			// Snapshot
			const snap = yield* node.hostAdapter.snapshot()

			// Modify
			yield* node.hostAdapter.setAccount(addrBytes, {
				...remote,
				balance: 42n,
			})
			expect((yield* node.hostAdapter.getAccount(addrBytes)).balance).toBe(42n)

			// Restore
			yield* node.hostAdapter.restore(snap)

			// Should be back to remote (cached)
			const after = yield* node.hostAdapter.getAccount(addrBytes)
			expect(after.balance).toBe(MOCK_USDC_BALANCE)
		}).pipe(Effect.provide(ForkTestLayer)),
	)
})

// ---------------------------------------------------------------------------
// Pre-funded test accounts work in fork mode
// ---------------------------------------------------------------------------

describe("Fork mode — test accounts", () => {
	it.effect("test accounts are funded", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			expect(node.accounts.length).toBeGreaterThan(0)

			const first = node.accounts[0]
			if (first === undefined) throw new Error("No test accounts")
			const addrBytes = hexToBytes(first.address)
			const account = yield* node.hostAdapter.getAccount(addrBytes)
			// Should have DEFAULT_BALANCE (10,000 ETH)
			expect(account.balance).toBe(10_000n * 10n ** 18n)
		}).pipe(Effect.provide(ForkTestLayer)),
	)

	it.effect("chain ID is correct", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			expect(node.chainId).toBe(1n)
		}).pipe(Effect.provide(ForkTestLayer)),
	)
})
