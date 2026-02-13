import { Effect } from "effect"
import type { TevmNodeShape } from "../node/index.js"
import {
	anvilAutoImpersonateAccount,
	anvilImpersonateAccount,
	anvilMine,
	anvilSetBalance,
	anvilSetCode,
	anvilSetNonce,
	anvilSetStorageAt,
	anvilStopImpersonatingAccount,
} from "./anvil.js"
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
import { evmMine, evmRevert, evmSetAutomine, evmSetIntervalMining, evmSnapshot } from "./evm.js"
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
	// EVM methods
	evm_mine: evmMine,
	evm_setAutomine: evmSetAutomine,
	evm_setIntervalMining: evmSetIntervalMining,
	evm_snapshot: evmSnapshot,
	evm_revert: evmRevert,
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

/**
 * Route a JSON-RPC method name + params to the appropriate procedure.
 * Returns the procedure result (hex string) or fails with MethodNotFoundError.
 */
export const methodRouter =
	(node: TevmNodeShape) =>
	(method: string, params: readonly unknown[]): Effect.Effect<ProcedureResult, MethodNotFoundError | InternalError> => {
		const factory = methods[method]
		if (!factory) {
			return Effect.fail(new MethodNotFoundError({ method }))
		}
		return factory(node)(params)
	}
