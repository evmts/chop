// Trace types for debug_* RPC methods.
// Defines the structured output of EVM execution tracing.

// ---------------------------------------------------------------------------
// Opcode name mapping
// ---------------------------------------------------------------------------

/** Map opcode byte values to human-readable names. */
export const OPCODE_NAMES: Record<number, string> = {
	0: "STOP",
	49: "BALANCE",
	81: "MLOAD",
	82: "MSTORE",
	84: "SLOAD",
	96: "PUSH1",
	243: "RETURN",
	253: "REVERT",
	254: "INVALID",
}

/** Gas cost per opcode for the mini EVM interpreter. */
export const OPCODE_GAS_COSTS: Record<number, bigint> = {
	0: 0n, // STOP
	49: 100n, // BALANCE
	81: 3n, // MLOAD
	82: 3n, // MSTORE
	84: 2100n, // SLOAD
	96: 3n, // PUSH1
	243: 0n, // RETURN
	253: 0n, // REVERT
	254: 0n, // INVALID
}

// ---------------------------------------------------------------------------
// Trace result types
// ---------------------------------------------------------------------------

/** A single step in the EVM execution trace (structLog entry). */
export interface StructLog {
	/** Program counter before executing this opcode. */
	readonly pc: number
	/** Opcode name (e.g. "PUSH1", "MSTORE"). */
	readonly op: string
	/** Remaining gas before executing this opcode. */
	readonly gas: bigint
	/** Gas cost of this opcode. */
	readonly gasCost: bigint
	/** Call depth (1 for top-level). */
	readonly depth: number
	/** Stack snapshot as 64-char zero-padded hex strings (no 0x prefix). */
	readonly stack: readonly string[]
	/** Memory snapshot (empty array in mini EVM). */
	readonly memory: readonly string[]
	/** Storage changes (empty object in mini EVM). */
	readonly storage: Record<string, string>
}

/** Result of a trace operation (debug_traceTransaction / debug_traceCall). */
export interface TraceResult {
	/** Total gas consumed. */
	readonly gas: bigint
	/** Whether execution failed (REVERT or error). */
	readonly failed: boolean
	/** Return data as hex string. */
	readonly returnValue: string
	/** Step-by-step execution trace. */
	readonly structLogs: readonly StructLog[]
}

/** Tracer configuration options. */
export interface TracerConfig {
	/** If true, omit storage from structLogs. */
	readonly disableStorage?: boolean
	/** If true, omit memory from structLogs. */
	readonly disableMemory?: boolean
	/** If true, omit stack from structLogs. */
	readonly disableStack?: boolean
}
