// EVM module — WASM integration, host adapter, and conversion utilities

export { ConversionError, WasmExecutionError, WasmLoadError } from "./errors.js"
export { bigintToBytes32, bytesToBigint, bytesToHex, hexToBytes } from "./conversions.js"
export { HostAdapterLive, HostAdapterService, HostAdapterTest } from "./host-adapter.js"
export type { HostAdapterShape } from "./host-adapter.js"
export { EvmWasmLive, EvmWasmService, EvmWasmTest, makeEvmWasmTestWithCleanup } from "./wasm.js"
export type { EvmWasmShape, ExecuteParams, ExecuteResult, HostCallbacks } from "./wasm.js"
