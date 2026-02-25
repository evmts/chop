import { Effect } from "effect"
import type { TevmNodeShape } from "../node/index.js"
import {
	anvilAutoImpersonateAccount,
	anvilDropAllTransactions,
	anvilDropTransaction,
	anvilDumpState,
	anvilEnableTraces,
	anvilImpersonateAccount,
	anvilLoadState,
	anvilMine,
	anvilNodeInfo,
	anvilRemoveBlockTimestampInterval,
	anvilReset,
	anvilSetBalance,
	anvilSetBlockGasLimit,
	anvilSetBlockTimestampInterval,
	anvilSetChainId,
	anvilSetCode,
	anvilSetCoinbase,
	anvilSetMinGasPrice,
	anvilSetNextBlockBaseFeePerGas,
	anvilSetNonce,
	anvilSetRpcUrl,
	anvilSetStorageAt,
	anvilStopImpersonatingAccount,
} from "./anvil.js"
import { debugTraceBlockByHash, debugTraceBlockByNumber, debugTraceCall, debugTraceTransaction } from "./debug.js"
import { type InternalError, MethodNotFoundError } from "./errors.js"
import {
	type Procedure,
	type ProcedureResult,
	ethAccounts,
	ethBlockNumber,
	ethCall,
	ethChainId,
	ethEstimateGas,
	ethFeeHistory,
	ethGasPrice,
	ethGetBalance,
	ethGetBlockByHash,
	ethGetBlockByNumber,
	ethGetBlockTransactionCountByHash,
	ethGetBlockTransactionCountByNumber,
	ethGetCode,
	ethGetFilterChanges,
	ethGetLogs,
	ethGetProof,
	ethGetStorageAt,
	ethGetTransactionByBlockHashAndIndex,
	ethGetTransactionByBlockNumberAndIndex,
	ethGetTransactionByHash,
	ethGetTransactionCount,
	ethGetTransactionReceipt,
	ethMaxPriorityFeePerGas,
	ethNewBlockFilter,
	ethNewFilter,
	ethNewPendingTransactionFilter,
	ethSendRawTransaction,
	ethSendTransaction,
	ethSign,
	ethUninstallFilter,
} from "./eth.js"
import {
	evmIncreaseTime,
	evmMine,
	evmRevert,
	evmSetAutomine,
	evmSetIntervalMining,
	evmSetNextBlockTimestamp,
	evmSnapshot,
} from "./evm.js"
import { netListening, netPeerCount, netVersion } from "./net.js"
import { web3ClientVersion, web3Sha3 } from "./web3.js"

// ---------------------------------------------------------------------------
// Method → Procedure mapping
// ---------------------------------------------------------------------------

/** Factory map: method name → (node) => Procedure. */
const methods: Record<string, (node: TevmNodeShape) => Procedure> = {
	// eth_* methods
	eth_chainId: ethChainId,
	eth_blockNumber: ethBlockNumber,
	eth_call: ethCall,
	eth_accounts: ethAccounts,
	eth_getBalance: ethGetBalance,
	eth_getCode: ethGetCode,
	eth_getStorageAt: ethGetStorageAt,
	eth_getTransactionCount: ethGetTransactionCount,
	eth_sendTransaction: ethSendTransaction,
	eth_getTransactionReceipt: ethGetTransactionReceipt,
	eth_getBlockByNumber: ethGetBlockByNumber,
	eth_getBlockByHash: ethGetBlockByHash,
	eth_getTransactionByHash: ethGetTransactionByHash,
	eth_gasPrice: ethGasPrice,
	eth_maxPriorityFeePerGas: ethMaxPriorityFeePerGas,
	eth_estimateGas: ethEstimateGas,
	eth_feeHistory: ethFeeHistory,
	eth_getLogs: ethGetLogs,
	eth_sign: ethSign,
	eth_getProof: ethGetProof,
	eth_newFilter: ethNewFilter,
	eth_getFilterChanges: ethGetFilterChanges,
	eth_uninstallFilter: ethUninstallFilter,
	eth_newBlockFilter: ethNewBlockFilter,
	eth_newPendingTransactionFilter: ethNewPendingTransactionFilter,
	eth_sendRawTransaction: ethSendRawTransaction,
	eth_getBlockTransactionCountByHash: ethGetBlockTransactionCountByHash,
	eth_getBlockTransactionCountByNumber: ethGetBlockTransactionCountByNumber,
	eth_getTransactionByBlockHashAndIndex: ethGetTransactionByBlockHashAndIndex,
	eth_getTransactionByBlockNumberAndIndex: ethGetTransactionByBlockNumberAndIndex,
	// net_* methods
	net_version: netVersion,
	net_listening: netListening,
	net_peerCount: netPeerCount,
	// web3_* methods
	web3_clientVersion: web3ClientVersion,
	web3_sha3: web3Sha3,
	// Anvil methods
	anvil_mine: anvilMine,
	anvil_setBalance: anvilSetBalance,
	anvil_setCode: anvilSetCode,
	anvil_setNonce: anvilSetNonce,
	anvil_setStorageAt: anvilSetStorageAt,
	anvil_impersonateAccount: anvilImpersonateAccount,
	anvil_stopImpersonatingAccount: anvilStopImpersonatingAccount,
	anvil_autoImpersonateAccount: anvilAutoImpersonateAccount,
	anvil_dumpState: anvilDumpState,
	anvil_loadState: anvilLoadState,
	anvil_reset: anvilReset,
	anvil_setMinGasPrice: anvilSetMinGasPrice,
	anvil_setNextBlockBaseFeePerGas: anvilSetNextBlockBaseFeePerGas,
	anvil_setCoinbase: anvilSetCoinbase,
	anvil_setBlockGasLimit: anvilSetBlockGasLimit,
	anvil_setBlockTimestampInterval: anvilSetBlockTimestampInterval,
	anvil_removeBlockTimestampInterval: anvilRemoveBlockTimestampInterval,
	anvil_setChainId: anvilSetChainId,
	anvil_setRpcUrl: anvilSetRpcUrl,
	anvil_dropTransaction: anvilDropTransaction,
	anvil_dropAllTransactions: anvilDropAllTransactions,
	anvil_enableTraces: anvilEnableTraces,
	anvil_nodeInfo: anvilNodeInfo,
	// debug_* methods
	debug_traceCall: debugTraceCall,
	debug_traceTransaction: debugTraceTransaction,
	debug_traceBlockByNumber: debugTraceBlockByNumber,
	debug_traceBlockByHash: debugTraceBlockByHash,
	// EVM methods
	evm_mine: evmMine,
	evm_setAutomine: evmSetAutomine,
	evm_setIntervalMining: evmSetIntervalMining,
	evm_snapshot: evmSnapshot,
	evm_revert: evmRevert,
	evm_increaseTime: evmIncreaseTime,
	evm_setNextBlockTimestamp: evmSetNextBlockTimestamp,
}

// ---------------------------------------------------------------------------
// Compatibility aliases
// ---------------------------------------------------------------------------

/**
 * Resolve compatibility aliases.
 * hardhat_* and ganache_* prefixes map to anvil_* methods.
 * Returns the original method name if no alias match is found.
 */
const resolveMethodAlias = (method: string): string => {
	if (method.startsWith("hardhat_")) {
		const suffix = method.slice(8) // Remove "hardhat_"
		const anvilMethod = `anvil_${suffix}`
		if (anvilMethod in methods) return anvilMethod
	}
	if (method.startsWith("ganache_")) {
		const suffix = method.slice(8) // Remove "ganache_"
		const anvilMethod = `anvil_${suffix}`
		if (anvilMethod in methods) return anvilMethod
	}
	return method
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

/**
 * Route a JSON-RPC method name + params to the appropriate procedure.
 * Returns the procedure result (hex string) or fails with MethodNotFoundError.
 *
 * Supports hardhat_* and ganache_* compatibility aliases for all anvil_* methods.
 */
export const methodRouter =
	(node: TevmNodeShape) =>
	(method: string, params: readonly unknown[]): Effect.Effect<ProcedureResult, MethodNotFoundError | InternalError> => {
		const resolved = resolveMethodAlias(method)
		const factory = methods[resolved]
		if (!factory) {
			return Effect.fail(new MethodNotFoundError({ method }))
		}
		return factory(node)(params)
	}
