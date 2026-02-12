import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { bigintToBytes32, bytesToBigint, hexToBytes } from "../evm/conversions.js"
import { DEFAULT_BALANCE } from "./accounts.js"
import { TevmNode, TevmNodeService } from "./index.js"

// ---------------------------------------------------------------------------
// Tag identity
// ---------------------------------------------------------------------------

describe("TevmNodeService — tag", () => {
	it("has correct tag key", () => {
		expect(TevmNodeService.key).toBe("TevmNode")
	})
})

// ---------------------------------------------------------------------------
// Node creation and genesis
// ---------------------------------------------------------------------------

describe("TevmNodeService — genesis initialization", () => {
	it.effect("genesis block is initialized at block 0", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const head = yield* node.blockchain.getHead()
			expect(head.number).toBe(0n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("default chain ID is 31337", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			expect(node.chainId).toBe(31337n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("custom chain ID is respected", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			expect(node.chainId).toBe(42n)
		}).pipe(Effect.provide(TevmNode.LocalTest({ chainId: 42n }))),
	)

	it.effect("blockchain getBlockByNumber(0n) returns genesis", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const genesis = yield* node.blockchain.getBlockByNumber(0n)
			expect(genesis.number).toBe(0n)
			expect(genesis.gasLimit).toBe(30_000_000n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// Pre-funded accounts
// ---------------------------------------------------------------------------

describe("TevmNodeService — accounts", () => {
	it.effect("default creates 10 accounts", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			expect(node.accounts).toHaveLength(10)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("custom accounts count is respected", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			expect(node.accounts).toHaveLength(5)
		}).pipe(Effect.provide(TevmNode.LocalTest({ accounts: 5 }))),
	)

	it.effect("accounts are funded with DEFAULT_BALANCE", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const first = node.accounts[0]!
			const addrBytes = hexToBytes(first.address)
			const account = yield* node.hostAdapter.getAccount(addrBytes)
			expect(account.balance).toBe(DEFAULT_BALANCE)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// Sub-service accessibility
// ---------------------------------------------------------------------------

describe("TevmNodeService — sub-service accessibility", () => {
	it.effect("evm is accessible", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			expect(node.evm).toBeDefined()
			expect(typeof node.evm.execute).toBe("function")
			expect(typeof node.evm.executeAsync).toBe("function")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("hostAdapter is accessible", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			expect(node.hostAdapter).toBeDefined()
			expect(typeof node.hostAdapter.getAccount).toBe("function")
			expect(typeof node.hostAdapter.setAccount).toBe("function")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("blockchain is accessible", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			expect(node.blockchain).toBeDefined()
			expect(typeof node.blockchain.getHead).toBe("function")
			expect(typeof node.blockchain.putBlock).toBe("function")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("releaseSpec is accessible", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			expect(node.releaseSpec).toBeDefined()
			expect(node.releaseSpec.hardfork).toBe("prague")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// Acceptance test 1: create node → execute simple call → get result
// ---------------------------------------------------------------------------

describe("TevmNodeService — integration: simple call", () => {
	it.effect("execute simple call returns correct result", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Bytecode: PUSH1 0x42, PUSH1 0x00, MSTORE, PUSH1 0x20, PUSH1 0x00, RETURN
			const bytecode = new Uint8Array([0x60, 0x42, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3])

			const result = yield* node.evm.executeAsync({ bytecode }, node.hostAdapter.hostCallbacks)

			expect(result.success).toBe(true)
			expect(bytesToBigint(result.output)).toBe(0x42n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// Acceptance test 2: create node → set balance → get balance → matches
// ---------------------------------------------------------------------------

describe("TevmNodeService — integration: set/get balance", () => {
	it.effect("set balance then get balance matches", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const addr = hexToBytes(`0x${"00".repeat(19)}01`)
			const account = {
				nonce: 0n,
				balance: 1_000_000n,
				codeHash: new Uint8Array(32),
				code: new Uint8Array(0),
			}
			yield* node.hostAdapter.setAccount(addr, account)
			const retrieved = yield* node.hostAdapter.getAccount(addr)
			expect(retrieved.balance).toBe(1_000_000n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// Acceptance test 3: create node → deploy contract → call contract → correct return
// ---------------------------------------------------------------------------

describe("TevmNodeService — integration: deploy + call contract", () => {
	it.effect("deploy contract then call returns correct storage value", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const contractAddr = hexToBytes(`0x${"00".repeat(19)}42`)

			// Contract code: PUSH1 0x01 (slot), SLOAD, PUSH1 0x00, MSTORE, PUSH1 0x20, PUSH1 0x00, RETURN
			const contractCode = new Uint8Array([0x60, 0x01, 0x54, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3])

			// Deploy: set account with code
			yield* node.hostAdapter.setAccount(contractAddr, {
				nonce: 0n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: contractCode,
			})

			// Set storage at slot 1 to 0xdeadbeef
			yield* node.hostAdapter.setStorage(contractAddr, bigintToBytes32(1n), 0xdeadbeefn)

			// Call the contract — SLOAD slot 1, MSTORE at 0, RETURN 32 bytes
			const result = yield* node.evm.executeAsync(
				{ bytecode: contractCode, address: contractAddr },
				node.hostAdapter.hostCallbacks,
			)

			expect(result.success).toBe(true)
			expect(bytesToBigint(result.output)).toBe(0xdeadbeefn)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// Snapshot/restore through node
// ---------------------------------------------------------------------------

describe("TevmNodeService — integration: snapshot/restore", () => {
	it.effect("snapshot → modify → restore → original values", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const addr = hexToBytes(`0x${"00".repeat(19)}03`)

			// Set initial account
			yield* node.hostAdapter.setAccount(addr, {
				nonce: 0n,
				balance: 100n,
				codeHash: new Uint8Array(32),
				code: new Uint8Array(0),
			})

			// Snapshot
			const snap = yield* node.hostAdapter.snapshot()

			// Modify
			yield* node.hostAdapter.setAccount(addr, {
				nonce: 1n,
				balance: 999n,
				codeHash: new Uint8Array(32),
				code: new Uint8Array(0),
			})

			// Verify modified
			const modified = yield* node.hostAdapter.getAccount(addr)
			expect(modified.balance).toBe(999n)

			// Restore
			yield* node.hostAdapter.restore(snap)

			// Verify restored
			const restored = yield* node.hostAdapter.getAccount(addr)
			expect(restored.balance).toBe(100n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// Single provide — all services from one layer
// ---------------------------------------------------------------------------

describe("TevmNodeService — single provide", () => {
	it.effect("all services satisfied by single Effect.provide", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// EVM works
			const result = yield* node.evm.execute({ bytecode: new Uint8Array([0x00]) })
			expect(result.success).toBe(true)

			// Blockchain works
			const head = yield* node.blockchain.getHead()
			expect(head.number).toBe(0n)

			// HostAdapter works
			const addr = hexToBytes(`0x${"00".repeat(19)}05`)
			yield* node.hostAdapter.setAccount(addr, {
				nonce: 5n,
				balance: 42n,
				codeHash: new Uint8Array(32),
				code: new Uint8Array(0),
			})
			const acct = yield* node.hostAdapter.getAccount(addr)
			expect(acct.nonce).toBe(5n)

			// ReleaseSpec works
			expect(node.releaseSpec.hardfork).toBe("prague")
			expect(node.chainId).toBe(31337n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
