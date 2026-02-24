import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { bytesToHex } from "../evm/conversions.js"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { debugTraceBlockByHash, debugTraceBlockByNumber, debugTraceCall, debugTraceTransaction } from "./debug.js"
import { methodRouter } from "./router.js"

// ---------------------------------------------------------------------------
// debugTraceCall — branch coverage for optional param spreads
// ---------------------------------------------------------------------------

describe("debugTraceCall branch coverage", () => {
	it.effect("empty params [] — exercises params[0] ?? {} fallback, handler rejects (no to/data)", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Call with empty params — code defaults callObj to {}
			// All conditional spreads take the false branch (no fields present)
			// Handler then rejects because neither 'to' nor 'data' is provided
			const result = yield* debugTraceCall(node)([]).pipe(
				Effect.catchTag("InternalError", (e) => Effect.succeed(`error: ${e.message}`)),
			)
			expect(typeof result).toBe("string")
			expect((result as string).startsWith("error:")).toBe(true)
			expect(result as string).toContain("traceCall requires either")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("only 'to' field — exercises typeof callObj.to === 'string' branch", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const to = node.accounts[1]?.address

			// Only 'to' is set — from/data/value/gas branches all take false path
			const result = (yield* debugTraceCall(node)([{ to }])) as Record<string, unknown>
			expect(result.failed).toBe(false)
			expect(typeof result.gas).toBe("string")
			expect(result.returnValue).toBe("0x")
			expect((result.structLogs as unknown[]).length).toBe(0) // EOA target, no code
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("from + data + value + gas — exercises all conditional spread branches as true", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const from = node.accounts[0]?.address

			// PUSH1 0x42, PUSH1 0x00, MSTORE, PUSH1 0x20, PUSH1 0x00, RETURN
			const data = bytesToHex(new Uint8Array([0x60, 0x42, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3]))

			const result = (yield* debugTraceCall(node)([
				{
					from,
					data,
					value: "0x0",
					gas: "0xfffff",
				},
			])) as Record<string, unknown>

			expect(result.failed).toBe(false)
			expect(typeof result.gas).toBe("string")
			expect(result.gas).toMatch(/^0x/)

			const structLogs = result.structLogs as Record<string, unknown>[]
			expect(structLogs.length).toBe(6)

			// Verify each structLog has gas/gasCost as hex strings (serialization)
			for (const log of structLogs) {
				expect(typeof log.gas).toBe("string")
				expect((log.gas as string).startsWith("0x")).toBe(true)
				expect(typeof log.gasCost).toBe("string")
				expect((log.gasCost as string).startsWith("0x")).toBe(true)
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("numeric 'to' and 'from' (not string) with valid 'data' — exercises typeof !== 'string' branches", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Pass numeric values for 'to' and 'from' so typeof !== 'string' branches are taken
			// 'data' is a valid string so handler won't reject
			// STOP opcode
			const data = bytesToHex(new Uint8Array([0x00]))
			const result = (yield* debugTraceCall(node)([
				{
					to: 12345, // not a string — should be skipped
					from: 67890, // not a string — should be skipped
					data, // valid string — included
					value: "0x0", // value uses !== undefined check, so this is included
					gas: "0xfffff", // gas uses !== undefined check, so this is included
				},
			])) as Record<string, unknown>

			// Should succeed — to/from were skipped, data/value/gas included
			expect(result.failed).toBe(false)
			expect(typeof result.gas).toBe("string")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("only 'from' field — handler rejects (no to/data), exercises from branch", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const from = node.accounts[0]?.address

			// from is set but to/data are missing — handler rejects
			const result = yield* debugTraceCall(node)([{ from }]).pipe(
				Effect.catchTag("InternalError", (e) => Effect.succeed(`error: ${e.message}`)),
			)
			expect(typeof result).toBe("string")
			expect((result as string).startsWith("error:")).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("only 'data' field — exercises data-only branch", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Simple STOP opcode
			const data = bytesToHex(new Uint8Array([0x00]))
			const result = (yield* debugTraceCall(node)([{ data }])) as Record<string, unknown>
			expect(result.failed).toBe(false)
			expect(typeof result.gas).toBe("string")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("value and gas without to/from/data — handler rejects, exercises value+gas branches", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// value and gas are set but to/data missing — handler rejects
			const result = yield* debugTraceCall(node)([
				{
					value: "0x0",
					gas: "0x5208",
				},
			]).pipe(Effect.catchTag("InternalError", (e) => Effect.succeed(`error: ${e.message}`)))

			expect(typeof result).toBe("string")
			expect((result as string).startsWith("error:")).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// debugTraceTransaction — serialized output format
// ---------------------------------------------------------------------------

describe("debugTraceTransaction serialized output format", () => {
	it.effect("serialized result has gas as hex string, returnValue as hex, and structLogs array", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const router = methodRouter(node)

			const from = node.accounts[0]?.address
			const to = node.accounts[1]?.address

			// Send a transaction (auto-mines)
			const hash = (yield* router("eth_sendTransaction", [{ from, to, value: "0x3e8" }])) as string

			const result = (yield* debugTraceTransaction(node)([hash])) as Record<string, unknown>

			// Verify serialized output shape
			expect(typeof result.gas).toBe("string")
			expect((result.gas as string).startsWith("0x")).toBe(true)
			expect(typeof result.failed).toBe("boolean")
			expect(typeof result.returnValue).toBe("string")
			expect(Array.isArray(result.structLogs)).toBe(true)

			// Simple value transfer — no contract code
			expect(result.failed).toBe(false)
			expect(result.returnValue).toBe("0x")
			expect((result.structLogs as unknown[]).length).toBe(0)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// debugTraceBlockByNumber — empty block (no transactions)
// ---------------------------------------------------------------------------

describe("debugTraceBlockByNumber branch coverage", () => {
	it.effect("block with no transactions returns empty array", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Genesis block (block 0) has no transactions
			const results = (yield* debugTraceBlockByNumber(node)(["0x0"])) as Record<string, unknown>[]
			expect(Array.isArray(results)).toBe(true)
			expect(results.length).toBe(0)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("block with transaction returns array with serialized trace", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const router = methodRouter(node)

			const from = node.accounts[0]?.address
			const to = node.accounts[1]?.address

			// Mine a tx into block 1
			yield* router("eth_sendTransaction", [{ from, to, value: "0x3e8" }])

			const results = (yield* debugTraceBlockByNumber(node)(["0x1"])) as Record<string, unknown>[]
			expect(results.length).toBe(1)

			const entry = results[0]!
			expect(typeof entry.txHash).toBe("string")

			const traceResult = entry.result as Record<string, unknown>
			expect(typeof traceResult.gas).toBe("string")
			expect((traceResult.gas as string).startsWith("0x")).toBe(true)
			expect(traceResult.failed).toBe(false)
			expect(Array.isArray(traceResult.structLogs)).toBe(true)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// debugTraceBlockByHash — empty block (no transactions)
// ---------------------------------------------------------------------------

describe("debugTraceBlockByHash branch coverage", () => {
	it.effect("block with no transactions returns empty array", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const router = methodRouter(node)

			// Get genesis block hash
			const block = (yield* router("eth_getBlockByNumber", ["0x0", false])) as Record<string, unknown>
			const blockHash = block.hash as string

			const results = (yield* debugTraceBlockByHash(node)([blockHash])) as Record<string, unknown>[]
			expect(Array.isArray(results)).toBe(true)
			expect(results.length).toBe(0)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("block with transaction returns serialized trace entries", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const router = methodRouter(node)

			const from = node.accounts[0]?.address
			const to = node.accounts[1]?.address

			yield* router("eth_sendTransaction", [{ from, to, value: "0x3e8" }])

			// Get block 1 hash
			const block = (yield* router("eth_getBlockByNumber", ["0x1", false])) as Record<string, unknown>
			const blockHash = block.hash as string

			const results = (yield* debugTraceBlockByHash(node)([blockHash])) as Record<string, unknown>[]
			expect(results.length).toBe(1)

			const entry = results[0]!
			expect(typeof entry.txHash).toBe("string")

			const traceResult = entry.result as Record<string, unknown>
			expect(typeof traceResult.gas).toBe("string")
			expect((traceResult.gas as string).startsWith("0x")).toBe(true)
			expect(traceResult.failed).toBe(false)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})

// ---------------------------------------------------------------------------
// serializeStructLog — output validation through debugTraceCall
// ---------------------------------------------------------------------------

describe("serializeStructLog output validation", () => {
	it.effect("structLog gas and gasCost are hex strings, pc/depth are numbers", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// PUSH1 0x42, STOP — produces 2 structLogs
			const data = bytesToHex(new Uint8Array([0x60, 0x42, 0x00]))

			const result = (yield* debugTraceCall(node)([{ data }])) as Record<string, unknown>
			const structLogs = result.structLogs as Record<string, unknown>[]
			expect(structLogs.length).toBe(2)

			for (const log of structLogs) {
				// gas and gasCost should be hex strings (bigint serialized)
				expect(typeof log.gas).toBe("string")
				expect((log.gas as string).startsWith("0x")).toBe(true)
				expect(typeof log.gasCost).toBe("string")
				expect((log.gasCost as string).startsWith("0x")).toBe(true)

				// pc and depth should remain as numbers
				expect(typeof log.pc).toBe("number")
				expect(typeof log.depth).toBe("number")

				// op should be a string
				expect(typeof log.op).toBe("string")

				// stack, memory, storage should be present
				expect(Array.isArray(log.stack)).toBe(true)
				expect(Array.isArray(log.memory)).toBe(true)
				expect(typeof log.storage).toBe("object")
			}

			// Verify first log (PUSH1)
			expect(structLogs[0]?.pc).toBe(0)
			expect(structLogs[0]?.op).toBe("PUSH1")

			// Verify second log (STOP)
			expect(structLogs[1]?.pc).toBe(2)
			expect(structLogs[1]?.op).toBe("STOP")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("top-level result gas is hex string (bigint serialization)", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Simple STOP opcode
			const data = bytesToHex(new Uint8Array([0x00]))
			const result = (yield* debugTraceCall(node)([{ data }])) as Record<string, unknown>

			// gas should be a hex string
			expect(typeof result.gas).toBe("string")
			expect((result.gas as string).startsWith("0x")).toBe(true)

			// Parse the hex back to verify it's valid
			const gasValue = BigInt(result.gas as string)
			expect(gasValue).toBeGreaterThanOrEqual(0n)
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
