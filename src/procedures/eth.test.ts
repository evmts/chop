import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { bigintToBytes32, bytesToHex, hexToBytes } from "../evm/conversions.js"
import { TevmNode, TevmNodeService } from "../node/index.js"
import {
	bigintToHex,
	bigintToHex32,
	ethBlockNumber,
	ethCall,
	ethChainId,
	ethGetBalance,
	ethGetCode,
	ethGetStorageAt,
	ethGetTransactionCount,
} from "./eth.js"

const CONTRACT_ADDR = `0x${"00".repeat(19)}42`

describe("Procedure helpers", () => {
	it("bigintToHex converts correctly", () => {
		expect(bigintToHex(0n)).toBe("0x0")
		expect(bigintToHex(31337n)).toBe("0x7a69")
		expect(bigintToHex(255n)).toBe("0xff")
	})

	it("bigintToHex32 pads to 64 hex chars", () => {
		expect(bigintToHex32(0n)).toBe(`0x${"0".repeat(64)}`)
		expect(bigintToHex32(1n)).toBe(`0x${"0".repeat(63)}1`)
		expect(bigintToHex32(0xdeadbeefn)).toBe(`0x${"0".repeat(56)}deadbeef`)
	})
})

describe("ethChainId", () => {
	it.effect("returns hex chain ID", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* ethChainId(node)([])
			expect(result).toBe("0x7a69")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

describe("ethBlockNumber", () => {
	it.effect("returns hex block number", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* ethBlockNumber(node)([])
			expect(result).toBe("0x0")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

describe("ethCall", () => {
	it.effect("executes raw bytecode via eth_call params", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Bytecode: PUSH1 0x42, PUSH1 0x00, MSTORE, PUSH1 0x20, PUSH1 0x00, RETURN
			const data = bytesToHex(new Uint8Array([0x60, 0x42, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3]))
			const result = yield* ethCall(node)([{ data }])
			// 0x42 as 32 bytes → ends with ...0042
			expect(result).toContain("42")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("calls deployed contract", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Contract code: PUSH1 0x99, PUSH1 0x00, MSTORE, PUSH1 0x20, PUSH1 0x00, RETURN
			const contractCode = new Uint8Array([0x60, 0x99, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3])
			yield* node.hostAdapter.setAccount(hexToBytes(CONTRACT_ADDR), {
				nonce: 0n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: contractCode,
			})

			const result = yield* ethCall(node)([{ to: CONTRACT_ADDR }])
			expect(result).toContain("99")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

describe("ethGetBalance", () => {
	it.effect("returns hex balance", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const addr = `0x${"00".repeat(19)}ab`

			// Set balance
			yield* node.hostAdapter.setAccount(hexToBytes(addr), {
				nonce: 0n,
				balance: 1000n,
				codeHash: new Uint8Array(32),
				code: new Uint8Array(0),
			})

			const result = yield* ethGetBalance(node)([addr])
			expect(result).toBe("0x3e8") // 1000 = 0x3e8
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns 0x0 for non-existent account", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* ethGetBalance(node)([`0x${"00".repeat(19)}cd`])
			expect(result).toBe("0x0")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

describe("ethGetCode", () => {
	it.effect("returns hex code for deployed contract", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			const code = new Uint8Array([0x60, 0x42])
			yield* node.hostAdapter.setAccount(hexToBytes(CONTRACT_ADDR), {
				nonce: 0n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code,
			})

			const result = yield* ethGetCode(node)([CONTRACT_ADDR])
			expect(result).toBe("0x6042")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns 0x for EOA", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* ethGetCode(node)([`0x${"00".repeat(19)}ee`])
			expect(result).toBe("0x")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

describe("ethGetStorageAt", () => {
	it.effect("returns 32-byte padded hex for storage value", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const slot = bytesToHex(bigintToBytes32(1n))

			// Set storage
			yield* node.hostAdapter.setAccount(hexToBytes(CONTRACT_ADDR), {
				nonce: 0n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: new Uint8Array(0),
			})
			yield* node.hostAdapter.setStorage(hexToBytes(CONTRACT_ADDR), bigintToBytes32(1n), 0xdeadbeefn)

			const result = yield* ethGetStorageAt(node)([CONTRACT_ADDR, slot])
			expect(result).toBe(`0x${"0".repeat(56)}deadbeef`)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns zero for unset slot", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const slot = bytesToHex(bigintToBytes32(99n))
			const result = yield* ethGetStorageAt(node)([CONTRACT_ADDR, slot])
			expect(result).toBe(`0x${"0".repeat(64)}`)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

describe("ethGetTransactionCount", () => {
	it.effect("returns hex nonce", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const addr = `0x${"00".repeat(19)}bb`

			yield* node.hostAdapter.setAccount(hexToBytes(addr), {
				nonce: 5n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: new Uint8Array(0),
			})

			const result = yield* ethGetTransactionCount(node)([addr])
			expect(result).toBe("0x5")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns 0x0 for non-existent account", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* ethGetTransactionCount(node)([`0x${"00".repeat(19)}cc`])
			expect(result).toBe("0x0")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
