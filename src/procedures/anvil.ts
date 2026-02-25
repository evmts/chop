// Anvil-specific JSON-RPC procedures (anvil_* methods).

import { Effect, Ref } from "effect"
import {
	autoImpersonateAccountHandler,
	impersonateAccountHandler,
	stopImpersonatingAccountHandler,
} from "../handlers/impersonate.js"
import { mineHandler } from "../handlers/mine.js"
import { setBalanceHandler } from "../handlers/setBalance.js"
import { setCodeHandler } from "../handlers/setCode.js"
import { setNonceHandler } from "../handlers/setNonce.js"
import { setStorageAtHandler } from "../handlers/setStorageAt.js"
import type { TevmNodeShape } from "../node/index.js"
import { wrapErrors } from "./errors.js"
import { type Procedure, bigintToHex } from "./eth.js"

// ---------------------------------------------------------------------------
// Procedures
// ---------------------------------------------------------------------------

/**
 * anvil_mine → mine N blocks (default 1).
 * Reads nodeConfig overrides (baseFee, gasLimit, timestamp, timeOffset, interval)
 * and passes them to the mining service.
 * Params: [blockCount?, timestampDelta?]
 * Returns: null on success.
 */
export const anvilMine =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const blockCount = params[0] !== undefined ? Number(params[0]) : 1

				// Read nodeConfig overrides
				const baseFeePerGas = yield* Ref.get(node.nodeConfig.nextBlockBaseFeePerGas)
				const gasLimit = yield* Ref.get(node.nodeConfig.blockGasLimit)
				const nextBlockTimestamp = yield* Ref.get(node.nodeConfig.nextBlockTimestamp)
				const timeOffset = yield* Ref.get(node.nodeConfig.timeOffset)
				const blockTimestampInterval = yield* Ref.get(node.nodeConfig.blockTimestampInterval)

				yield* mineHandler(node)({
					blockCount,
					options: {
						...(baseFeePerGas !== undefined ? { baseFeePerGas } : {}),
						...(gasLimit !== undefined ? { gasLimit } : {}),
						...(nextBlockTimestamp !== undefined ? { nextBlockTimestamp } : {}),
						...(timeOffset !== 0n ? { timeOffset } : {}),
						...(blockTimestampInterval !== undefined ? { blockTimestampInterval } : {}),
					},
				})

				// Consume one-shot overrides
				if (baseFeePerGas !== undefined) {
					yield* Ref.set(node.nodeConfig.nextBlockBaseFeePerGas, undefined)
				}
				if (nextBlockTimestamp !== undefined) {
					yield* Ref.set(node.nodeConfig.nextBlockTimestamp, undefined)
				}

				return null
			}),
		)

/**
 * anvil_setBalance → set account ETH balance.
 * Params: [address: hex string, balance: hex string]
 * Returns: null on success.
 */
export const anvilSetBalance =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const address = params[0] as string
				const balance = BigInt(params[1] as string)
				yield* setBalanceHandler(node)({ address, balance })
				return null
			}),
		)

/**
 * anvil_setCode → set account bytecode.
 * Params: [address: hex string, code: hex string]
 * Returns: null on success.
 */
export const anvilSetCode =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const address = params[0] as string
				const code = params[1] as string
				yield* setCodeHandler(node)({ address, code })
				return null
			}),
		)

/**
 * anvil_setNonce → set account nonce.
 * Params: [address: hex string, nonce: hex string]
 * Returns: null on success.
 */
export const anvilSetNonce =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const address = params[0] as string
				const nonce = BigInt(params[1] as string)
				yield* setNonceHandler(node)({ address, nonce })
				return null
			}),
		)

/**
 * anvil_setStorageAt → set individual storage slot.
 * Params: [address: hex string, slot: hex string, value: hex string]
 * Returns: true on success.
 */
export const anvilSetStorageAt =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const address = params[0] as string
				const slot = params[1] as string
				const value = params[2] as string
				yield* setStorageAtHandler(node)({ address, slot, value })
				return true
			}),
		)

/**
 * anvil_impersonateAccount → start impersonating an address.
 * Params: [address: hex string]
 * Returns: null on success.
 */
export const anvilImpersonateAccount =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const address = params[0] as string
				yield* impersonateAccountHandler(node)(address)
				return null
			}),
		)

/**
 * anvil_stopImpersonatingAccount → stop impersonating an address.
 * Params: [address: hex string]
 * Returns: null on success.
 */
export const anvilStopImpersonatingAccount =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const address = params[0] as string
				yield* stopImpersonatingAccountHandler(node)(address)
				return null
			}),
		)

/**
 * anvil_autoImpersonateAccount → toggle auto-impersonation.
 * Params: [enabled: boolean]
 * Returns: null on success.
 */
export const anvilAutoImpersonateAccount =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const enabled = Boolean(params[0])
				yield* autoImpersonateAccountHandler(node)(enabled)
				return null
			}),
		)

// ---------------------------------------------------------------------------
// State dump / load / reset
// ---------------------------------------------------------------------------

/**
 * anvil_dumpState → serialize entire world state to JSON.
 * Params: [] (none)
 * Returns: serialized state object.
 */
export const anvilDumpState =
	(node: TevmNodeShape): Procedure =>
	(_params) =>
		wrapErrors(
			Effect.gen(function* () {
				const dump = yield* node.hostAdapter.dumpState()
				return dump as Record<string, unknown>
			}),
		)

/**
 * anvil_loadState → restore serialized state from JSON.
 * Params: [state: serialized state object]
 * Returns: true on success.
 */
export const anvilLoadState =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const stateData = params[0] as Record<string, unknown>
				yield* node.hostAdapter.loadState(stateData as unknown as import("../state/world-state.js").WorldStateDump)
				return true
			}),
		)

/**
 * anvil_reset → reset node to initial state.
 * Params: [forking?: { jsonRpcUrl?: string, blockNumber?: hex }]
 * Returns: null on success.
 */
export const anvilReset =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				// Clear all world state
				yield* node.hostAdapter.clearState()
				// Clear pending transactions
				yield* node.txPool.dropAllTransactions()

				// If forking params provided, update the RPC URL
				const forkOpts = params[0] as { jsonRpcUrl?: string; blockNumber?: string } | undefined
				if (forkOpts?.jsonRpcUrl) {
					yield* Ref.set(node.nodeConfig.rpcUrl, forkOpts.jsonRpcUrl)
				}

				return null
			}),
		)

// ---------------------------------------------------------------------------
// Gas / fee configuration
// ---------------------------------------------------------------------------

/**
 * anvil_setMinGasPrice → set minimum gas price.
 * Params: [gasPrice: hex string]
 * Returns: null on success.
 */
export const anvilSetMinGasPrice =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const gasPrice = BigInt(params[0] as string)
				yield* Ref.set(node.nodeConfig.minGasPrice, gasPrice)
				return null
			}),
		)

/**
 * anvil_setNextBlockBaseFeePerGas → set base fee for next mined block.
 * Params: [baseFee: hex string]
 * Returns: null on success.
 */
export const anvilSetNextBlockBaseFeePerGas =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const baseFee = BigInt(params[0] as string)
				yield* Ref.set(node.nodeConfig.nextBlockBaseFeePerGas, baseFee)
				return null
			}),
		)

// ---------------------------------------------------------------------------
// Block / chain configuration
// ---------------------------------------------------------------------------

/**
 * anvil_setCoinbase → set the coinbase address for mined blocks.
 * Params: [address: hex string]
 * Returns: null on success.
 */
export const anvilSetCoinbase =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const address = params[0] as string
				yield* Ref.set(node.nodeConfig.coinbase, address)
				return null
			}),
		)

/**
 * anvil_setBlockGasLimit → set the block gas limit.
 * Params: [gasLimit: hex string]
 * Returns: true on success.
 */
export const anvilSetBlockGasLimit =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const gasLimit = BigInt(params[0] as string)
				yield* Ref.set(node.nodeConfig.blockGasLimit, gasLimit)
				return true
			}),
		)

/**
 * anvil_setBlockTimestampInterval → set seconds between block timestamps.
 * Params: [seconds: number]
 * Returns: null on success.
 */
export const anvilSetBlockTimestampInterval =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const seconds = BigInt(Number(params[0]))
				yield* Ref.set(node.nodeConfig.blockTimestampInterval, seconds)
				return null
			}),
		)

/**
 * anvil_removeBlockTimestampInterval → remove timestamp interval.
 * Params: [] (none)
 * Returns: true on success.
 */
export const anvilRemoveBlockTimestampInterval =
	(node: TevmNodeShape): Procedure =>
	(_params) =>
		wrapErrors(
			Effect.gen(function* () {
				yield* Ref.set(node.nodeConfig.blockTimestampInterval, undefined)
				return true
			}),
		)

/**
 * anvil_setChainId → set the chain ID.
 * Params: [chainId: hex string]
 * Returns: null on success.
 */
export const anvilSetChainId =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const chainId = BigInt(params[0] as string)
				yield* Ref.set(node.nodeConfig.chainId, chainId)
				return null
			}),
		)

/**
 * anvil_setRpcUrl → set the fork RPC URL.
 * Params: [url: string]
 * Returns: null on success.
 */
export const anvilSetRpcUrl =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const url = params[0] as string
				yield* Ref.set(node.nodeConfig.rpcUrl, url)
				return null
			}),
		)

// ---------------------------------------------------------------------------
// Transaction management
// ---------------------------------------------------------------------------

/**
 * anvil_dropTransaction → remove a pending transaction.
 * Params: [txHash: hex string]
 * Returns: true if found and removed, null otherwise.
 */
export const anvilDropTransaction =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const hash = params[0] as string
				const result = yield* node.txPool
					.dropTransaction(hash)
					.pipe(Effect.catchTag("TransactionNotFoundError", () => Effect.succeed(null as boolean | null)))
				return result
			}),
		)

/**
 * anvil_dropAllTransactions → clear all pending transactions.
 * Params: [] (none)
 * Returns: null on success.
 */
export const anvilDropAllTransactions =
	(node: TevmNodeShape): Procedure =>
	(_params) =>
		wrapErrors(
			Effect.gen(function* () {
				yield* node.txPool.dropAllTransactions()
				return null
			}),
		)

// ---------------------------------------------------------------------------
// Miscellaneous
// ---------------------------------------------------------------------------

/**
 * anvil_enableTraces → enable or disable execution traces.
 * Params: [] (none — toggles on)
 * Returns: null on success.
 */
export const anvilEnableTraces =
	(node: TevmNodeShape): Procedure =>
	(_params) =>
		wrapErrors(
			Effect.gen(function* () {
				yield* Ref.set(node.nodeConfig.tracesEnabled, true)
				return null
			}),
		)

/**
 * anvil_nodeInfo → return node information.
 * Params: [] (none)
 * Returns: object with node info.
 */
export const anvilNodeInfo =
	(node: TevmNodeShape): Procedure =>
	(_params) =>
		wrapErrors(
			Effect.gen(function* () {
				const headBlock = yield* node.blockchain.getHead().pipe(Effect.catchTag("GenesisError", (e) => Effect.die(e)))
				const mode = yield* node.mining.getMode()
				const chainId = yield* Ref.get(node.nodeConfig.chainId)
				const rpcUrl = yield* Ref.get(node.nodeConfig.rpcUrl)

				return {
					currentBlockNumber: bigintToHex(headBlock.number),
					currentBlockTimestamp: bigintToHex(headBlock.timestamp),
					currentBlockHash: headBlock.hash,
					chainId: bigintToHex(chainId),
					hardFork: "prague",
					network: Number(chainId),
					forkConfig: rpcUrl ? { forkUrl: rpcUrl } : {},
					miningMode: mode,
				} as Record<string, unknown>
			}),
		)
