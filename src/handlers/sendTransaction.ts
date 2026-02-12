import { Effect } from "effect"
import { hexToBytes } from "../evm/conversions.js"
import { ConversionError } from "../evm/errors.js"
import { calculateIntrinsicGas } from "../evm/intrinsic-gas.js"
import type { TevmNodeShape } from "../node/index.js"
import {
	InsufficientBalanceError,
	IntrinsicGasTooLowError,
	MaxFeePerGasTooLowError,
	NonceTooLowError,
} from "./errors.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Parameters for sendTransactionHandler. */
export interface SendTransactionParams {
	/** Sender address (0x-prefixed hex). Required. */
	readonly from: string
	/** Recipient address (0x-prefixed hex). Omit for contract creation. */
	readonly to?: string
	/** Value to send in wei. Defaults to 0. */
	readonly value?: bigint
	/** Gas limit. Defaults to 10_000_000. */
	readonly gas?: bigint
	/** Max fee per gas (EIP-1559). Defaults to baseFee. */
	readonly maxFeePerGas?: bigint
	/** Max priority fee per gas (EIP-1559). Defaults to 0. */
	readonly maxPriorityFeePerGas?: bigint
	/** Legacy gas price. Used if maxFeePerGas is not set. */
	readonly gasPrice?: bigint
	/** Explicit nonce. If omitted, uses account's current nonce. */
	readonly nonce?: bigint
	/** Calldata (0x-prefixed hex). */
	readonly data?: string
}

/** Result of a successful sendTransaction. */
export interface SendTransactionResult {
	/** Transaction hash (0x-prefixed, 32 bytes). */
	readonly hash: string
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Default gas limit for transactions. */
const DEFAULT_GAS = 10_000_000n

/**
 * Compute a deterministic transaction hash from sender + nonce.
 * In a real implementation this would be keccak256 of the RLP-encoded tx.
 * For our local devnet, we use a simpler deterministic hash.
 */
const computeTxHash = (from: string, nonce: bigint): string => {
	// Simple deterministic hash: pad from + nonce into 32 bytes
	const fromClean = from.toLowerCase().replace("0x", "")
	const nonceHex = nonce.toString(16).padStart(24, "0")
	return `0x${fromClean}${nonceHex}`
}

/**
 * Calculate effective gas price for EIP-1559 transactions.
 *
 * effectiveGasPrice = min(maxFeePerGas, baseFee + maxPriorityFeePerGas)
 */
const calculateEffectiveGasPrice = (
	baseFee: bigint,
	maxFeePerGas?: bigint,
	maxPriorityFeePerGas?: bigint,
	gasPrice?: bigint,
): bigint => {
	// Legacy gas price takes precedence if EIP-1559 fields not set
	if (maxFeePerGas === undefined && gasPrice !== undefined) {
		return gasPrice
	}

	const maxFee = maxFeePerGas ?? baseFee
	const priorityFee = maxPriorityFeePerGas ?? 0n

	// EIP-1559: effective = min(maxFee, baseFee + priorityFee)
	const basePlusPriority = baseFee + priorityFee
	return maxFee < basePlusPriority ? maxFee : basePlusPriority
}

/**
 * Wrap hexToBytes in Effect.try so ConversionError becomes a typed failure
 * rather than a thrown defect inside Effect.gen.
 */
const safeHexToBytes = (hex: string): Effect.Effect<Uint8Array, ConversionError> =>
	Effect.try({
		try: () => hexToBytes(hex),
		catch: (e) => e as ConversionError,
	})

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * Handler for eth_sendTransaction.
 *
 * Full validation pipeline:
 * 1. Get sender account
 * 2. Validate nonce (if explicit)
 * 3. Calculate effective gas price (EIP-1559)
 * 4. Validate maxFeePerGas >= baseFee
 * 5. Calculate intrinsic gas
 * 6. Validate gas >= intrinsic
 * 7. Validate balance >= value + gas * maxFeePerGas (worst-case reservation)
 * 8. Update sender (nonce = txNonce + 1, balance -= actualCost)
 * 9. Transfer value to recipient
 * 10. Store tx in pool as pending
 * 11. If auto-mine mode: mine(1) → creates block, marks mined, creates receipt
 * 12. Return deterministic tx hash
 */
export const sendTransactionHandler =
	(node: TevmNodeShape) =>
	(
		params: SendTransactionParams,
	): Effect.Effect<
		SendTransactionResult,
		InsufficientBalanceError | NonceTooLowError | IntrinsicGasTooLowError | MaxFeePerGasTooLowError | ConversionError
	> =>
		Effect.gen(function* () {
			const fromBytes = yield* safeHexToBytes(params.from)
			const value = params.value ?? 0n
			const gasLimit = params.gas ?? DEFAULT_GAS
			const calldataBytes = params.data ? yield* safeHexToBytes(params.data) : new Uint8Array(0)
			const isCreate = params.to === undefined

			// 1. Get sender account
			const senderAccount = yield* node.hostAdapter.getAccount(fromBytes)

			// 2. Validate nonce
			const txNonce = params.nonce ?? senderAccount.nonce
			if (txNonce < senderAccount.nonce) {
				return yield* Effect.fail(
					new NonceTooLowError({
						message: `nonce too low: expected ${senderAccount.nonce}, got ${txNonce}`,
						expected: senderAccount.nonce,
						actual: txNonce,
					}),
				)
			}

			// 3. Get base fee from latest block for EIP-1559
			const latestBlock = yield* node.blockchain
				.getHead()
				.pipe(Effect.catchTag("GenesisError", () => Effect.die("Chain not initialized")))
			const baseFee = latestBlock.baseFeePerGas

			// 4. Validate maxFeePerGas >= baseFee (reject underpriced EIP-1559 txs)
			if (params.maxFeePerGas !== undefined && params.maxFeePerGas < baseFee) {
				return yield* Effect.fail(
					new MaxFeePerGasTooLowError({
						message: `maxFeePerGas (${params.maxFeePerGas}) < baseFee (${baseFee})`,
						maxFeePerGas: params.maxFeePerGas,
						baseFee,
					}),
				)
			}

			const effectiveGasPrice = calculateEffectiveGasPrice(
				baseFee,
				params.maxFeePerGas,
				params.maxPriorityFeePerGas,
				params.gasPrice,
			)

			// 5. Calculate intrinsic gas
			const intrinsicGas = calculateIntrinsicGas(
				{
					data: calldataBytes,
					isCreate,
				},
				node.releaseSpec,
			)

			// 6. Validate gas >= intrinsic
			if (gasLimit < intrinsicGas) {
				return yield* Effect.fail(
					new IntrinsicGasTooLowError({
						message: `intrinsic gas too low: need ${intrinsicGas}, got ${gasLimit}`,
						required: intrinsicGas,
						provided: gasLimit,
					}),
				)
			}

			// 7. Validate balance >= value + gas * maxGasPrice (worst-case reservation)
			//    For EIP-1559: reserve gasLimit * maxFeePerGas (not effectiveGasPrice)
			//    For legacy: reserve gasLimit * gasPrice
			const maxGasPrice =
				params.maxFeePerGas === undefined && params.gasPrice !== undefined
					? params.gasPrice
					: (params.maxFeePerGas ?? baseFee)
			const maxCost = value + gasLimit * maxGasPrice
			if (senderAccount.balance < maxCost) {
				return yield* Effect.fail(
					new InsufficientBalanceError({
						message: `insufficient balance: need ${maxCost}, have ${senderAccount.balance}`,
						required: maxCost,
						available: senderAccount.balance,
					}),
				)
			}

			// 8. Compute tx hash (deterministic from sender + nonce)
			const txHash = computeTxHash(params.from, txNonce)

			// 9. For simple transfers, gasUsed = intrinsicGas
			//    For contract calls, we'd run EVM and get actual gas used
			const gasUsed = intrinsicGas

			// 10. Update sender: nonce = txNonce + 1, balance -= (value + gasUsed * effectiveGasPrice)
			const actualCost = value + gasUsed * effectiveGasPrice
			yield* node.hostAdapter.setAccount(fromBytes, {
				...senderAccount,
				nonce: txNonce + 1n,
				balance: senderAccount.balance - actualCost,
			})

			// 11. Transfer value to recipient (if not create and value > 0)
			if (params.to && value > 0n) {
				const toBytes = yield* safeHexToBytes(params.to)
				const recipientAccount = yield* node.hostAdapter.getAccount(toBytes)
				yield* node.hostAdapter.setAccount(toBytes, {
					...recipientAccount,
					balance: recipientAccount.balance + value,
				})
			}

			// 12. Store transaction in pool as PENDING (no block info yet).
			//     Include receipt-relevant fields so mine() can create proper receipts.
			yield* node.txPool.addTransaction({
				hash: txHash,
				from: params.from.toLowerCase(),
				...(params.to !== undefined ? { to: params.to.toLowerCase() } : {}),
				value,
				gas: gasLimit,
				gasPrice: effectiveGasPrice,
				nonce: txNonce,
				data: params.data ?? "0x",
				gasUsed,
				effectiveGasPrice,
				status: 1,
				type: params.maxFeePerGas !== undefined ? 2 : 0,
			})

			// 13. Auto-mine if in auto mode — mine(1) creates block, marks tx mined, creates receipt.
			const mode = yield* node.mining.getMode()
			if (mode === "auto") {
				yield* node.mining.mine(1)
			}

			return { hash: txHash } satisfies SendTransactionResult
		})
