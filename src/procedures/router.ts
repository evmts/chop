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
	ethGetBalance,
	ethGetCode,
	ethGetStorageAt,
	ethGetTransactionCount,
	ethGetTransactionReceipt,
	ethSendTransaction,
} from "./eth.js"
import { evmMine, evmRevert, evmSetAutomine, evmSetIntervalMining, evmSnapshot } from "./evm.js"

// ---------------------------------------------------------------------------
// Method → Procedure mapping
// ---------------------------------------------------------------------------

/** Factory map: method name → (node) => Procedure. */
const methods: Record<string, (node: TevmNodeShape) => Procedure> = {
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
