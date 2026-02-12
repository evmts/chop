import { Context, Effect, Layer, type Scope } from "effect"
import { bigintToBytes32, bytesToBigint } from "./conversions.js"
import { WasmExecutionError, WasmLoadError } from "./errors.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Parameters for EVM bytecode execution. */
export interface ExecuteParams {
	/** EVM bytecode to execute. */
	readonly bytecode: Uint8Array
	/** Caller address (20 bytes). Defaults to zero address. */
	readonly caller?: Uint8Array
	/** Contract address (20 bytes). Defaults to zero address. */
	readonly address?: Uint8Array
	/** Value transferred (32 bytes, big-endian). Defaults to 0. */
	readonly value?: Uint8Array
	/** Calldata appended to bytecode execution context. */
	readonly calldata?: Uint8Array
	/** Gas limit. Defaults to 10_000_000. */
	readonly gas?: bigint
}

/** Result of EVM execution. */
export interface ExecuteResult {
	/** Whether execution completed without error (STOP/RETURN). */
	readonly success: boolean
	/** Output data (RETURN data). */
	readonly output: Uint8Array
	/** Gas consumed during execution. */
	readonly gasUsed: bigint
}

/** Host callbacks for async EVM execution. */
export interface HostCallbacks {
	/** Called when EVM needs a storage value. Returns 32-byte value. */
	readonly onStorageRead?: (address: Uint8Array, slot: Uint8Array) => Effect.Effect<Uint8Array, WasmExecutionError>
	/** Called when EVM needs an account balance. Returns 32-byte value. */
	readonly onBalanceRead?: (address: Uint8Array) => Effect.Effect<Uint8Array, WasmExecutionError>
}

// ---------------------------------------------------------------------------
// Service definition
// ---------------------------------------------------------------------------

/** Shape of the EvmWasm service — execute EVM bytecode. */
export interface EvmWasmShape {
	/** Synchronous execution — all state must be pre-loaded. */
	readonly execute: (params: ExecuteParams) => Effect.Effect<ExecuteResult, WasmExecutionError>
	/** Async execution — yields on SLOAD/BALANCE and calls host callbacks. */
	readonly executeAsync: (
		params: ExecuteParams,
		callbacks: HostCallbacks,
	) => Effect.Effect<ExecuteResult, WasmExecutionError>
}

/** Service tag for the EVM WASM integration. */
export class EvmWasmService extends Context.Tag("EvmWasm")<EvmWasmService, EvmWasmShape>() {}

// ---------------------------------------------------------------------------
// Guillotine WASM exports interface
// ---------------------------------------------------------------------------

/** Minimal WASM memory interface (avoids dependency on DOM lib types). */
interface WasmMemoryLike {
	readonly buffer: ArrayBuffer
}

/** Exported functions from the guillotine-mini WASM module. */
interface GuillotineExports {
	readonly memory: WasmMemoryLike
	readonly evm_create: (hardfork_ptr: number, hardfork_len: number, log_level: number) => number
	readonly evm_destroy: (handle: number) => void
	readonly evm_set_bytecode: (handle: number, ptr: number, len: number) => number
	readonly evm_set_execution_context: (
		handle: number,
		gas: bigint,
		caller_ptr: number,
		address_ptr: number,
		value_ptr: number,
		calldata_ptr: number,
		calldata_len: number,
	) => number
	readonly evm_execute: (handle: number) => number
	readonly evm_is_success: (handle: number) => number
	readonly evm_get_output_len: (handle: number) => number
	readonly evm_get_output: (handle: number, buffer_ptr: number, len: number) => number
	readonly evm_get_gas_used: (handle: number) => bigint
	readonly evm_call_ffi: (handle: number, request_ptr: number) => number
	readonly evm_continue_ffi: (
		handle: number,
		continue_type: number,
		data_ptr: number,
		data_len: number,
		request_ptr: number,
	) => number
	readonly evm_enable_storage_injector: (handle: number) => number
	readonly evm_set_storage: (handle: number, addr_ptr: number, slot_ptr: number, value_ptr: number) => number
	readonly evm_set_balance: (handle: number, addr_ptr: number, balance_ptr: number) => number
}

// ---------------------------------------------------------------------------
// AsyncRequest layout — offsets into the WASM memory struct
// ---------------------------------------------------------------------------

/** output_type at byte 0: 0=result, 1=need_storage, 2=need_balance */
const ASYNC_OUTPUT_TYPE_OFFSET = 0
/** address at byte 1: 20-byte address */
const ASYNC_ADDRESS_OFFSET = 1
/** slot at byte 21: 32-byte storage slot */
const ASYNC_SLOT_OFFSET = 21
/** Total size of AsyncRequest struct */
const ASYNC_REQUEST_SIZE = 16441

/** Scratch region base offset in WASM memory (above module data). */
const SCRATCH_BASE = 1048576 // 1 MB

// ---------------------------------------------------------------------------
// WASM memory helpers
// ---------------------------------------------------------------------------

/** Write bytes into WASM linear memory at a given offset. */
const writeToWasm = (memory: WasmMemoryLike, data: Uint8Array, offset: number): void => {
	new Uint8Array(memory.buffer).set(data, offset)
}

/** Read bytes from WASM linear memory. Returns a copy. */
const readFromWasm = (memory: WasmMemoryLike, offset: number, length: number): Uint8Array => {
	return new Uint8Array(memory.buffer.slice(offset, offset + length))
}

// ---------------------------------------------------------------------------
// EvmWasmLive — real WASM integration with acquireRelease lifecycle
// ---------------------------------------------------------------------------

/**
 * Live layer that loads guillotine-mini WASM and creates an EVM instance.
 * Resources are released when the scope closes (evm_destroy).
 *
 * @param wasmPath - Path to guillotine_mini.wasm file.
 * @param hardfork - Hardfork name (default: "cancun").
 */
export const EvmWasmLive = (
	wasmPath = "wasm/guillotine_mini.wasm",
	hardfork = "cancun",
): Layer.Layer<EvmWasmService, WasmLoadError, never> =>
	Layer.scoped(EvmWasmService, makeEvmWasmLive(wasmPath, hardfork))

const makeEvmWasmLive = (wasmPath: string, hardfork: string): Effect.Effect<EvmWasmShape, WasmLoadError, Scope.Scope> =>
	Effect.gen(function* () {
		// Load WASM binary from disk
		const wasmBinary = yield* Effect.tryPromise({
			try: async () => {
				const { readFile } = await import("node:fs/promises")
				const buf = await readFile(wasmPath)
				return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
			},
			catch: (e) => new WasmLoadError({ message: `Failed to read WASM file: ${wasmPath}`, cause: e }),
		})

		// Instantiate WASM module with env imports
		const wasmImports = {
			env: {
				js_opcode_callback: (_opcode: number, _frame_ptr: number) => 0,
				js_precompile_callback: (
					_addr: number,
					_input: number,
					_inputLen: number,
					_gas: bigint,
					_outLen: number,
					_outPtr: number,
					_gasUsed: number,
				) => 0,
			},
		}

		// Use globalThis to access WebAssembly (available in Node.js/Bun but not in ES2022 lib types)
		const WA = globalThis as unknown as {
			WebAssembly: {
				instantiate: (
					bytes: ArrayBuffer | Uint8Array,
					imports: Record<string, Record<string, unknown>>,
				) => Promise<{ instance: { exports: Record<string, unknown> } }>
			}
		}

		const wasmResult = yield* Effect.tryPromise({
			try: () => WA.WebAssembly.instantiate(wasmBinary, wasmImports),
			catch: (e) => new WasmLoadError({ message: "Failed to instantiate WASM module", cause: e }),
		})

		const exports = wasmResult.instance.exports as unknown as GuillotineExports
		const memory = exports.memory

		// Create EVM instance
		const hardforkBytes = new Uint8Array(Array.from(hardfork).map((c) => c.charCodeAt(0)))
		const hardforkPtr = SCRATCH_BASE
		writeToWasm(memory, hardforkBytes, hardforkPtr)

		const handle = exports.evm_create(hardforkPtr, hardforkBytes.length, 0)
		if (!handle) {
			return yield* Effect.fail(new WasmLoadError({ message: "evm_create returned null handle" }))
		}

		// Register cleanup finalizer
		yield* Effect.addFinalizer(() => Effect.sync(() => exports.evm_destroy(handle)))

		// Bump allocator state for scratch memory
		let scratchOffset = SCRATCH_BASE + 256 // Leave room for hardfork string

		const alloc = (size: number): number => {
			const ptr = scratchOffset
			scratchOffset = (scratchOffset + size + 7) & ~7 // 8-byte align
			return ptr
		}

		const resetScratch = (): void => {
			scratchOffset = SCRATCH_BASE + 256
		}

		// Build service implementation
		const execute = (params: ExecuteParams): Effect.Effect<ExecuteResult, WasmExecutionError> =>
			Effect.gen(function* () {
				resetScratch()

				// Set bytecode
				const bcPtr = alloc(params.bytecode.length)
				writeToWasm(memory, params.bytecode, bcPtr)
				if (!exports.evm_set_bytecode(handle, bcPtr, params.bytecode.length)) {
					return yield* Effect.fail(new WasmExecutionError({ message: "evm_set_bytecode failed" }))
				}

				// Set execution context
				const gas = params.gas ?? 10_000_000n
				const callerPtr = alloc(20)
				writeToWasm(memory, params.caller ?? new Uint8Array(20), callerPtr)
				const addressPtr = alloc(20)
				writeToWasm(memory, params.address ?? new Uint8Array(20), addressPtr)
				const valuePtr = alloc(32)
				writeToWasm(memory, params.value ?? new Uint8Array(32), valuePtr)
				const calldataPtr = alloc(params.calldata?.length ?? 0)
				if (params.calldata) writeToWasm(memory, params.calldata, calldataPtr)

				if (
					!exports.evm_set_execution_context(
						handle,
						gas,
						callerPtr,
						addressPtr,
						valuePtr,
						calldataPtr,
						params.calldata?.length ?? 0,
					)
				) {
					return yield* Effect.fail(new WasmExecutionError({ message: "evm_set_execution_context failed" }))
				}

				// Execute
				exports.evm_execute(handle)
				const success = !!exports.evm_is_success(handle)
				const gasUsed = exports.evm_get_gas_used(handle)

				// Read output
				const outputLen = exports.evm_get_output_len(handle)
				if (outputLen > 0) {
					const outputPtr = alloc(outputLen)
					exports.evm_get_output(handle, outputPtr, outputLen)
					return { success, output: readFromWasm(memory, outputPtr, outputLen), gasUsed }
				}

				return { success, output: new Uint8Array(0), gasUsed }
			})

		const executeAsync = (
			params: ExecuteParams,
			callbacks: HostCallbacks,
		): Effect.Effect<ExecuteResult, WasmExecutionError> =>
			Effect.gen(function* () {
				resetScratch()

				// Enable storage injector for async protocol
				exports.evm_enable_storage_injector(handle)

				// Set bytecode
				const bcPtr = alloc(params.bytecode.length)
				writeToWasm(memory, params.bytecode, bcPtr)
				if (!exports.evm_set_bytecode(handle, bcPtr, params.bytecode.length)) {
					return yield* Effect.fail(new WasmExecutionError({ message: "evm_set_bytecode failed" }))
				}

				// Set execution context
				const gas = params.gas ?? 10_000_000n
				const callerPtr = alloc(20)
				writeToWasm(memory, params.caller ?? new Uint8Array(20), callerPtr)
				const addressPtr = alloc(20)
				writeToWasm(memory, params.address ?? new Uint8Array(20), addressPtr)
				const valuePtr = alloc(32)
				writeToWasm(memory, params.value ?? new Uint8Array(32), valuePtr)
				const calldataPtr = alloc(params.calldata?.length ?? 0)
				if (params.calldata) writeToWasm(memory, params.calldata, calldataPtr)

				if (
					!exports.evm_set_execution_context(
						handle,
						gas,
						callerPtr,
						addressPtr,
						valuePtr,
						calldataPtr,
						params.calldata?.length ?? 0,
					)
				) {
					return yield* Effect.fail(new WasmExecutionError({ message: "evm_set_execution_context failed" }))
				}

				// Start async execution
				const requestPtr = alloc(ASYNC_REQUEST_SIZE)
				exports.evm_call_ffi(handle, requestPtr)

				// Async loop: yield on NeedStorage/NeedBalance, resume with data
				for (;;) {
					const outputByte = readFromWasm(memory, requestPtr + ASYNC_OUTPUT_TYPE_OFFSET, 1)
					const outputType = outputByte[0] ?? 0

					if (outputType === 0) {
						// Result — execution complete
						const success = !!exports.evm_is_success(handle)
						const gasUsed = exports.evm_get_gas_used(handle)
						const outputLen = exports.evm_get_output_len(handle)
						if (outputLen > 0) {
							const outPtr = alloc(outputLen)
							exports.evm_get_output(handle, outPtr, outputLen)
							return { success, output: readFromWasm(memory, outPtr, outputLen), gasUsed }
						}
						return { success, output: new Uint8Array(0), gasUsed }
					}

					if (outputType === 1 && callbacks.onStorageRead) {
						// NeedStorage — provide storage value
						const address = readFromWasm(memory, requestPtr + ASYNC_ADDRESS_OFFSET, 20)
						const slot = readFromWasm(memory, requestPtr + ASYNC_SLOT_OFFSET, 32)
						const storageValue = yield* callbacks.onStorageRead(address, slot)

						// Pack response: address (20) + slot (32) + value (32) = 84 bytes
						const responseData = new Uint8Array(84)
						responseData.set(address, 0)
						responseData.set(slot, 20)
						responseData.set(storageValue, 52)
						const dataPtr = alloc(84)
						writeToWasm(memory, responseData, dataPtr)

						exports.evm_continue_ffi(handle, 1, dataPtr, 84, requestPtr)
					} else if (outputType === 2 && callbacks.onBalanceRead) {
						// NeedBalance — provide balance
						const address = readFromWasm(memory, requestPtr + ASYNC_ADDRESS_OFFSET, 20)
						const balance = yield* callbacks.onBalanceRead(address)

						// Pack response: address (20) + balance (32) = 52 bytes
						const responseData = new Uint8Array(52)
						responseData.set(address, 0)
						responseData.set(balance, 20)
						const dataPtr = alloc(52)
						writeToWasm(memory, responseData, dataPtr)

						exports.evm_continue_ffi(handle, 2, dataPtr, 52, requestPtr)
					} else {
						return yield* Effect.fail(
							new WasmExecutionError({
								message: `Unexpected async output type: ${outputType}`,
							}),
						)
					}
				}
			})

		return { execute, executeAsync } satisfies EvmWasmShape
	})

// ---------------------------------------------------------------------------
// Mini EVM interpreter — pure TypeScript test double
// ---------------------------------------------------------------------------

/** Convert a bigint to a 20-byte big-endian address. */
const bigintToAddress = (n: bigint): Uint8Array => {
	const bytes = new Uint8Array(20)
	let val = n < 0n ? 0n : n
	for (let i = 19; i >= 0; i--) {
		bytes[i] = Number(val & 0xffn)
		val >>= 8n
	}
	return bytes
}

/**
 * Minimal EVM interpreter supporting a subset of opcodes.
 * Used as a test double for EvmWasmService when the real WASM binary
 * is not available.
 *
 * Supported opcodes:
 * - 0x00 STOP
 * - 0x31 BALANCE (async only)
 * - 0x51 MLOAD
 * - 0x52 MSTORE
 * - 0x54 SLOAD (async only)
 * - 0x60 PUSH1
 * - 0xf3 RETURN
 */
const runMiniEvm = (
	params: ExecuteParams,
	callbacks?: HostCallbacks,
): Effect.Effect<ExecuteResult, WasmExecutionError> =>
	Effect.gen(function* () {
		const { bytecode } = params
		const stack: bigint[] = []
		const memory = new Uint8Array(4096)
		let pc = 0
		let gasUsed = 0n

		while (pc < bytecode.length) {
			const opcode = bytecode[pc]

			if (opcode === undefined) break

			switch (opcode) {
				case 0x00: {
					// STOP
					return { success: true, output: new Uint8Array(0), gasUsed }
				}

				case 0x31: {
					// BALANCE
					const addr = stack.pop()
					if (addr === undefined) {
						return yield* Effect.fail(new WasmExecutionError({ message: "BALANCE: stack underflow" }))
					}
					const addrBytes = bigintToAddress(addr)
					if (callbacks?.onBalanceRead) {
						const balanceBytes = yield* callbacks.onBalanceRead(addrBytes)
						stack.push(bytesToBigint(balanceBytes))
					} else {
						stack.push(0n)
					}
					pc++
					gasUsed += 100n
					break
				}

				case 0x51: {
					// MLOAD
					const mloadOffset = stack.pop()
					if (mloadOffset === undefined) {
						return yield* Effect.fail(new WasmExecutionError({ message: "MLOAD: stack underflow" }))
					}
					const off = Number(mloadOffset)
					const word = new Uint8Array(memory.buffer.slice(off, off + 32))
					stack.push(bytesToBigint(word))
					pc++
					gasUsed += 3n
					break
				}

				case 0x52: {
					// MSTORE
					const mstoreOffset = stack.pop()
					const mstoreValue = stack.pop()
					if (mstoreOffset === undefined || mstoreValue === undefined) {
						return yield* Effect.fail(new WasmExecutionError({ message: "MSTORE: stack underflow" }))
					}
					const valueBytes = bigintToBytes32(mstoreValue)
					memory.set(valueBytes, Number(mstoreOffset))
					pc++
					gasUsed += 3n
					break
				}

				case 0x54: {
					// SLOAD
					const slot = stack.pop()
					if (slot === undefined) {
						return yield* Effect.fail(new WasmExecutionError({ message: "SLOAD: stack underflow" }))
					}
					const slotBytes = bigintToBytes32(slot)
					if (callbacks?.onStorageRead) {
						const storageValue = yield* callbacks.onStorageRead(params.address ?? new Uint8Array(20), slotBytes)
						stack.push(bytesToBigint(storageValue))
					} else {
						stack.push(0n)
					}
					pc++
					gasUsed += 2100n
					break
				}

				case 0x60: {
					// PUSH1
					pc++
					const val = bytecode[pc]
					if (val === undefined) {
						return yield* Effect.fail(new WasmExecutionError({ message: "PUSH1: unexpected end of bytecode" }))
					}
					stack.push(BigInt(val))
					pc++
					gasUsed += 3n
					break
				}

				case 0xf3: {
					// RETURN
					const retOffset = stack.pop()
					const retSize = stack.pop()
					if (retOffset === undefined || retSize === undefined) {
						return yield* Effect.fail(new WasmExecutionError({ message: "RETURN: stack underflow" }))
					}
					const start = Number(retOffset)
					const end = start + Number(retSize)
					const output = new Uint8Array(memory.buffer.slice(start, end))
					return { success: true, output, gasUsed }
				}

				default:
					return yield* Effect.fail(
						new WasmExecutionError({ message: `Unsupported opcode: 0x${opcode.toString(16).padStart(2, "0")}` }),
					)
			}
		}

		// Fell off end of bytecode — implicit STOP
		return { success: true, output: new Uint8Array(0), gasUsed }
	})

// ---------------------------------------------------------------------------
// EvmWasmTest — mini interpreter Layer for testing
// ---------------------------------------------------------------------------

/**
 * Test layer using a pure TypeScript mini EVM interpreter.
 * No WASM binary required. Supports PUSH1, MSTORE, MLOAD, RETURN,
 * STOP, SLOAD (async), and BALANCE (async).
 */
export const EvmWasmTest: Layer.Layer<EvmWasmService, never, never> = Layer.scoped(
	EvmWasmService,
	Effect.gen(function* () {
		yield* Effect.addFinalizer(() => Effect.void)

		return {
			execute: (params) => runMiniEvm(params),
			executeAsync: (params, callbacks) => runMiniEvm(params, callbacks),
		} satisfies EvmWasmShape
	}),
)

/**
 * Create a test layer that tracks whether cleanup was called.
 * Used for verifying acquireRelease lifecycle semantics.
 */
export const makeEvmWasmTestWithCleanup = (tracker: {
	cleaned: boolean
}): Layer.Layer<EvmWasmService, never, never> =>
	Layer.scoped(
		EvmWasmService,
		Effect.gen(function* () {
			yield* Effect.addFinalizer(() =>
				Effect.sync(() => {
					tracker.cleaned = true
				}),
			)

			return {
				execute: (params) => runMiniEvm(params),
				executeAsync: (params, callbacks) => runMiniEvm(params, callbacks),
			} satisfies EvmWasmShape
		}),
	)
