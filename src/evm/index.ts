// EVM module — WASM integration, host adapter, and conversion utilities

export { ConversionError, WasmExecutionError, WasmLoadError } from "./errors.js"
export { bigintToBytes32, bytesToBigint, bytesToHex, hexToBytes } from "./conversions.js"
export { HostAdapterLive, HostAdapterService, HostAdapterTest } from "./host-adapter.js"
export type { HostAdapterShape } from "./host-adapter.js"
export { ReleaseSpecLive, ReleaseSpecService } from "./release-spec.js"
export type { ReleaseSpecShape } from "./release-spec.js"
export { EvmWasmLive, EvmWasmService, EvmWasmTest, makeEvmWasmTestWithCleanup } from "./wasm.js"
export type { EvmWasmShape, ExecuteParams, ExecuteResult, ExecuteTraceResult, HostCallbacks } from "./wasm.js"
export { OPCODE_GAS_COSTS, OPCODE_NAMES } from "./trace-types.js"
export type { StructLog, TraceResult, TracerConfig } from "./trace-types.js"
