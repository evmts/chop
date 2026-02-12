// Procedures module — JSON-RPC serialization wrappers around handlers.
// Each procedure maps JSON-RPC params to domain handlers and serializes results.

export {
	InternalError,
	InvalidParamsError,
	InvalidRequestError,
	MethodNotFoundError,
	ParseError,
	RpcErrorCode,
	rpcErrorCode,
	rpcErrorMessage,
} from "./errors.js"
export type { RpcError } from "./errors.js"

export {
	bigintToHex,
	bigintToHex32,
	ethBlockNumber,
	ethCall,
	ethChainId,
	ethGetBalance,
	ethGetCode,
	ethGetStorageAt,
	ethGetTransactionCount,
} from "./eth.js"
export type { Procedure } from "./eth.js"

export { anvilMine } from "./anvil.js"

export { evmMine, evmSetAutomine, evmSetIntervalMining } from "./evm.js"

export { methodRouter } from "./router.js"

export {
	makeErrorResponse,
	makeSuccessResponse,
} from "./types.js"
export type {
	JsonRpcErrorResponse,
	JsonRpcRequest,
	JsonRpcResponse,
	JsonRpcSuccessResponse,
} from "./types.js"
