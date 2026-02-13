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
export { sendTransactionHandler } from "./sendTransaction.js"
export type { SendTransactionParams, SendTransactionResult } from "./sendTransaction.js"
export { mineHandler, setAutomineHandler, setIntervalMiningHandler } from "./mine.js"
export type { MineParams, MineResult } from "./mine.js"
export { getTransactionReceiptHandler } from "./getTransactionReceipt.js"
export type { GetTransactionReceiptParams } from "./getTransactionReceipt.js"
export { snapshotHandler, revertHandler } from "./snapshot.js"
export { setBalanceHandler } from "./setBalance.js"
export type { SetBalanceParams } from "./setBalance.js"
export { setCodeHandler } from "./setCode.js"
export type { SetCodeParams } from "./setCode.js"
export { setNonceHandler } from "./setNonce.js"
export type { SetNonceParams } from "./setNonce.js"
export { setStorageAtHandler } from "./setStorageAt.js"
export type { SetStorageAtParams } from "./setStorageAt.js"
export {
	impersonateAccountHandler,
	stopImpersonatingAccountHandler,
	autoImpersonateAccountHandler,
} from "./impersonate.js"
export { getBlockByNumberHandler } from "./getBlockByNumber.js"
export type { GetBlockByNumberParams } from "./getBlockByNumber.js"
export { getBlockByHashHandler } from "./getBlockByHash.js"
export type { GetBlockByHashParams } from "./getBlockByHash.js"
export { getTransactionByHashHandler } from "./getTransactionByHash.js"
export type { GetTransactionByHashParams } from "./getTransactionByHash.js"
export { gasPriceHandler } from "./gasPrice.js"
export { estimateGasHandler } from "./estimateGas.js"
export type { EstimateGasParams } from "./estimateGas.js"
export { getLogsHandler } from "./getLogs.js"
export type { GetLogsParams } from "./getLogs.js"
export { traceCallHandler } from "./traceCall.js"
export type { TraceCallParams } from "./traceCall.js"
export {
	InsufficientBalanceError,
	IntrinsicGasTooLowError,
	MaxFeePerGasTooLowError,
	NonceTooLowError,
	NotImpersonatedError,
	TransactionNotFoundError,
} from "./errors.js"
