import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { bytesToHex } from "../evm/conversions.js"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { methodRouter } from "./router.js"

describe("debug_traceCall", () => {
	it.effect("traces simple bytecode via RPC — structLogs have pc, op, gas, depth, stack", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const router = methodRouter(node)

			// PUSH1 0x42, PUSH1 0x00, MSTORE, PUSH1 0x20, PUSH1 0x00, RETURN
			const data = bytesToHex(new Uint8Array([0x60, 0x42, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3]))

			const result = (yield* router("debug_traceCall", [{ data }])) as Record<string, unknown>
			expect(result.failed).toBe(false)
			expect(typeof result.gas).toBe("string") // hex string after serialization

			const structLogs = result.structLogs as Record<string, unknown>[]
			expect(structLogs.length).toBe(6)

			// Verify first entry
			const first = structLogs[0]!
			expect(first.pc).toBe(0)
			expect(first.op).toBe("PUSH1")
			expect(typeof first.gas).toBe("string") // hex
			expect(first.depth).toBe(1)
			expect(Array.isArray(first.stack)).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("traces reverted call — trace shows revert point", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const router = methodRouter(node)

			// PUSH1 0x00, PUSH1 0x00, REVERT
			const data = bytesToHex(new Uint8Array([0x60, 0x00, 0x60, 0x00, 0xfd]))

			const result = (yield* router("debug_traceCall", [{ data }])) as Record<string, unknown>
			expect(result.failed).toBe(true)

			const structLogs = result.structLogs as Record<string, unknown>[]
			expect(structLogs.length).toBe(3)

			const last = structLogs[2]!
			expect(last.op).toBe("REVERT")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

describe("debug_traceTransaction", () => {
	it.effect("traces a mined transaction via RPC", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const router = methodRouter(node)

			const from = node.accounts[0]!.address
			const to = node.accounts[1]!.address

			// Send a transaction first
			const hash = (yield* router("eth_sendTransaction", [{ from, to, value: "0x3e8" }])) as string

			// Trace it
			const result = (yield* router("debug_traceTransaction", [hash])) as Record<string, unknown>
			expect(result.failed).toBe(false)
			expect(typeof result.gas).toBe("string")
			expect(result.returnValue).toBe("0x")
			// Simple transfer → no code → empty structLogs
			expect((result.structLogs as unknown[]).length).toBe(0)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

describe("debug_traceBlockByNumber", () => {
	it.effect("traces all transactions in a block via RPC", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const router = methodRouter(node)

			const from = node.accounts[0]!.address
			const to = node.accounts[1]!.address

			// Send a transaction (auto-mines to block 1)
			yield* router("eth_sendTransaction", [{ from, to, value: "0x3e8" }])

			// Trace block 1
			const results = (yield* router("debug_traceBlockByNumber", ["0x1"])) as Record<string, unknown>[]
			expect(results.length).toBe(1)
			expect(results[0]!.txHash).toBeDefined()
			expect((results[0]!.result as Record<string, unknown>).failed).toBe(false)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

describe("debug_traceBlockByHash", () => {
	it.effect("traces all transactions in a block by hash via RPC", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const router = methodRouter(node)

			const from = node.accounts[0]!.address
			const to = node.accounts[1]!.address

			// Send a transaction (auto-mines to block 1)
			yield* router("eth_sendTransaction", [{ from, to, value: "0x3e8" }])

			// Get block 1's hash via eth_getBlockByNumber
			const block = (yield* router("eth_getBlockByNumber", ["0x1", false])) as Record<string, unknown>
			const blockHash = block.hash as string

			// Trace by hash
			const results = (yield* router("debug_traceBlockByHash", [blockHash])) as Record<string, unknown>[]
			expect(results.length).toBe(1)
			expect(results[0]!.txHash).toBeDefined()
			expect((results[0]!.result as Record<string, unknown>).failed).toBe(false)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

describe("debug_* method routing", () => {
	const debugMethods: Record<string, readonly unknown[]> = {
		debug_traceCall: [{ data: "0x00" }],
	}

	for (const [method, params] of Object.entries(debugMethods)) {
		it.effect(`routes ${method} to a procedure`, () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const result = yield* methodRouter(node)(method, params)
				expect(result).toBeDefined()
				expect(typeof result).toBe("object")
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)
	}

	it.effect("routes unknown debug method to MethodNotFoundError", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const result = yield* methodRouter(node)("debug_nonexistent", []).pipe(
				Effect.catchTag("MethodNotFoundError", (e) => Effect.succeed(e.method)),
			)
			expect(result).toBe("debug_nonexistent")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
