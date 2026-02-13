import { Effect } from "effect"
import {
	traceBlockByHashHandler,
	traceBlockByNumberHandler,
	traceCallHandler,
	traceTransactionHandler,
} from "../handlers/index.js"
import type { TevmNodeShape } from "../node/index.js"
import { wrapErrors } from "./errors.js"
import type { Procedure } from "./eth.js"
import { bigintToHex } from "./eth.js"

// ---------------------------------------------------------------------------
// Serialization helpers
// ---------------------------------------------------------------------------

/**
 * Serialize a StructLog for JSON-RPC output.
 * Converts bigint fields to hex strings for JSON compatibility.
 */
const serializeStructLog = (log: import("../evm/trace-types.js").StructLog): Record<string, unknown> => ({
	pc: log.pc,
	op: log.op,
	gas: bigintToHex(log.gas),
	gasCost: bigintToHex(log.gasCost),
	depth: log.depth,
	stack: log.stack,
	memory: log.memory,
	storage: log.storage,
})

/**
 * Serialize a TraceResult for JSON-RPC output.
 * Converts gas from bigint to hex.
 */
const serializeTraceResult = (result: import("../evm/trace-types.js").TraceResult): Record<string, unknown> => ({
	gas: bigintToHex(result.gas),
	failed: result.failed,
	returnValue: result.returnValue,
	structLogs: result.structLogs.map(serializeStructLog),
})

// ---------------------------------------------------------------------------
// Procedures
// ---------------------------------------------------------------------------

/** debug_traceCall → trace result object with structLogs. */
export const debugTraceCall =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const callObj = (params[0] ?? {}) as Record<string, unknown>
				const result = yield* traceCallHandler(node)({
					...(typeof callObj.to === "string" ? { to: callObj.to } : {}),
					...(typeof callObj.from === "string" ? { from: callObj.from } : {}),
					...(typeof callObj.data === "string" ? { data: callObj.data } : {}),
					...(callObj.value !== undefined ? { value: BigInt(callObj.value as string) } : {}),
					...(callObj.gas !== undefined ? { gas: BigInt(callObj.gas as string) } : {}),
				})
				return serializeTraceResult(result)
			}),
		)

/** debug_traceTransaction → trace result object with structLogs. */
export const debugTraceTransaction =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const hash = params[0] as string
				const result = yield* traceTransactionHandler(node)({ hash })
				return serializeTraceResult(result)
			}),
		)

/** debug_traceBlockByNumber → array of trace results (one per tx). */
export const debugTraceBlockByNumber =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const blockNumber = BigInt(params[0] as string)
				const results = yield* traceBlockByNumberHandler(node)({ blockNumber })
				return results.map((entry) => ({
					txHash: entry.txHash,
					result: serializeTraceResult(entry.result),
				}))
			}),
		)

/** debug_traceBlockByHash → array of trace results (one per tx). */
export const debugTraceBlockByHash =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const blockHash = params[0] as string
				const results = yield* traceBlockByHashHandler(node)({ blockHash })
				return results.map((entry) => ({
					txHash: entry.txHash,
					result: serializeTraceResult(entry.result),
				}))
			}),
		)
