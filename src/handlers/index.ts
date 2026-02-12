// Handlers module — business logic layer for core eth_* methods.
// Each handler takes a TevmNodeShape and returns a function
// that produces domain-typed results via Effect.

export { callHandler } from "./call.js"
export type { CallParams, CallResult } from "./call.js"
export { blockNumberHandler } from "./blockNumber.js"
export { chainIdHandler } from "./chainId.js"
export { HandlerError } from "./errors.js"
export { getBalanceHandler } from "./getBalance.js"
export type { GetBalanceParams } from "./getBalance.js"
export { getCodeHandler } from "./getCode.js"
export type { GetCodeParams } from "./getCode.js"
export { getStorageAtHandler } from "./getStorageAt.js"
export type { GetStorageAtParams } from "./getStorageAt.js"
export { getAccountsHandler } from "./getAccounts.js"
export { getTransactionCountHandler } from "./getTransactionCount.js"
export type { GetTransactionCountParams } from "./getTransactionCount.js"
