import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { bytesToHex } from "../evm/conversions.js"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { sendTransactionHandler } from "./sendTransaction.js"
import { traceTransactionHandler } from "./traceTransaction.js"

describe("traceTransactionHandler", () => {
	// -----------------------------------------------------------------------
	// Happy path: trace a mined transaction
	// -----------------------------------------------------------------------

	it.effect("traces a mined simple-transfer transaction", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// First, send a transaction to create something in the pool
			const from = node.accounts[0]!.address
			const to = node.accounts[1]!.address

			const { hash } = yield* sendTransactionHandler(node)({
				from,
				to,
				value: 1_000n,
			})

			// Now trace it
			const result = yield* traceTransactionHandler(node)({ hash })
			expect(result.failed).toBe(false)
			expect(result.gas).toBeTypeOf("bigint")
			expect(result.returnValue).toBe("0x")
			// Simple transfer to EOA → no code → empty structLogs
			expect(result.structLogs).toEqual([])
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	// -----------------------------------------------------------------------
	// Trace a transaction that executed bytecode
	// -----------------------------------------------------------------------

	it.effect("traces a transaction with deployed contract code", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			const from = node.accounts[0]!.address
			// Deploy code at some address first via setCode, then sendTransaction to it
			const contractAddr = "0x1111111111111111111111111111111111111111"

			// Deploy bytecode: PUSH1 0x42, PUSH1 0x00, MSTORE, PUSH1 0x20, PUSH1 0x00, RETURN
			const code = new Uint8Array([0x60, 0x42, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3])
			const codeHex = bytesToHex(code)

			// Set code at the contract address
			const { setCodeHandler } = yield* Effect.promise(() => import("./setCode.js"))
			yield* setCodeHandler(node)({ address: contractAddr, code: codeHex })

			// Send a transaction to the contract
			const { hash } = yield* sendTransactionHandler(node)({
				from,
				to: contractAddr,
				data: "0x",
			})

			// Trace it — should have structLogs since there's code at the address
			const result = yield* traceTransactionHandler(node)({ hash })
			expect(result.failed).toBe(false)
			expect(result.structLogs.length).toBeGreaterThan(0)
			expect(result.structLogs[0]?.op).toBe("PUSH1")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	// -----------------------------------------------------------------------
	// Error case: transaction not found
	// -----------------------------------------------------------------------

	it.effect("fails with TransactionNotFoundError for unknown hash", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			const result = yield* traceTransactionHandler(node)({
				hash: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
			}).pipe(Effect.catchTag("TransactionNotFoundError", (e) => Effect.succeed(e.hash)))

			expect(result).toBe("0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
