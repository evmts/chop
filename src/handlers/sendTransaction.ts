import { Effect } from "effect"
import { hexToBytes } from "../evm/conversions.js"
import { calculateIntrinsicGas } from "../evm/intrinsic-gas.js"
import type { TevmNodeShape } from "../node/index.js"
import type { TransactionReceipt } from "../node/tx-pool.js"
import { InsufficientBalanceError, IntrinsicGasTooLowError, NonceTooLowError } from "./errors.js"

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
 * 4. Calculate intrinsic gas
 * 5. Validate gas >= intrinsic
 * 6. Validate balance >= value + gas * gasPrice
 * 7. Update sender (nonce++, balance -= maxCost)
 * 8. Transfer value to recipient
 * 9. Refund unused gas (for simple transfers, all gas above intrinsic)
 * 10. Auto-mine block
 * 11. Store tx + receipt in txPool
 * 12. Return deterministic tx hash
 */
export const sendTransactionHandler =
	(node: TevmNodeShape) =>
	(
		params: SendTransactionParams,
	): Effect.Effect<SendTransactionResult, InsufficientBalanceError | NonceTooLowError | IntrinsicGasTooLowError> =>
		Effect.gen(function* () {
			const fromBytes = hexToBytes(params.from)
			const value = params.value ?? 0n
			const gasLimit = params.gas ?? DEFAULT_GAS
			const calldataBytes = params.data ? hexToBytes(params.data) : new Uint8Array(0)
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
			const latestBlock = yield* node.blockchain.getHead().pipe(
				Effect.catchTag("GenesisError", () => Effect.die("Chain not initialized")),
			)
			const baseFee = latestBlock.baseFeePerGas

			const effectiveGasPrice = calculateEffectiveGasPrice(
				baseFee,
				params.maxFeePerGas,
				params.maxPriorityFeePerGas,
				params.gasPrice,
			)

			// 4. Calculate intrinsic gas
			const intrinsicGas = calculateIntrinsicGas(
				{
					data: calldataBytes,
					isCreate,
				},
				node.releaseSpec,
			)

			// 5. Validate gas >= intrinsic
			if (gasLimit < intrinsicGas) {
				return yield* Effect.fail(
					new IntrinsicGasTooLowError({
						message: `intrinsic gas too low: need ${intrinsicGas}, got ${gasLimit}`,
						required: intrinsicGas,
						provided: gasLimit,
					}),
				)
			}

			// 6. Validate balance >= value + gas * gasPrice
			const maxCost = value + gasLimit * effectiveGasPrice
			if (senderAccount.balance < maxCost) {
				return yield* Effect.fail(
					new InsufficientBalanceError({
						message: `insufficient balance: need ${maxCost}, have ${senderAccount.balance}`,
						required: maxCost,
						available: senderAccount.balance,
					}),
				)
			}

			// 7. Compute tx hash (deterministic from sender + nonce)
			const txHash = computeTxHash(params.from, txNonce)

			// 8. For simple transfers, gasUsed = intrinsicGas
			//    For contract calls, we'd run EVM and get actual gas used
			const gasUsed = intrinsicGas

			// 9. Update sender: nonce++, balance -= (value + gasUsed * effectiveGasPrice)
			const actualCost = value + gasUsed * effectiveGasPrice
			yield* node.hostAdapter.setAccount(fromBytes, {
				...senderAccount,
				nonce: senderAccount.nonce + 1n,
				balance: senderAccount.balance - actualCost,
			})

			// 10. Transfer value to recipient (if not create and value > 0)
			if (params.to && value > 0n) {
				const toBytes = hexToBytes(params.to)
				const recipientAccount = yield* node.hostAdapter.getAccount(toBytes)
				yield* node.hostAdapter.setAccount(toBytes, {
					...recipientAccount,
					balance: recipientAccount.balance + value,
				})
			}

			// 11. Auto-mine block
			const newBlockNumber = latestBlock.number + 1n
			const newBlockHash = `0x${newBlockNumber.toString(16).padStart(64, "0")}`
			const newBlock = {
				hash: newBlockHash,
				parentHash: latestBlock.hash,
				number: newBlockNumber,
				timestamp: BigInt(Math.floor(Date.now() / 1000)),
				gasLimit: latestBlock.gasLimit,
				gasUsed,
				baseFeePerGas: baseFee,
			}
			yield* node.blockchain.putBlock(newBlock)

			// 12. Store transaction in pool
			yield* node.txPool.addTransaction({
				hash: txHash,
				from: params.from.toLowerCase(),
				...(params.to !== undefined ? { to: params.to.toLowerCase() } : {}),
				value,
				gas: gasLimit,
				gasPrice: effectiveGasPrice,
				nonce: txNonce,
				data: params.data ?? "0x",
				blockHash: newBlockHash,
				blockNumber: newBlockNumber,
				transactionIndex: 0,
			})

			// Mark as mined immediately (auto-mine mode)
			// We just added the tx above, so TransactionNotFoundError is impossible here — die if it happens.
			yield* node.txPool.markMined(txHash, newBlockHash, newBlockNumber, 0).pipe(
				Effect.catchTag("TransactionNotFoundError", (e) => Effect.die(e)),
			)

			// 13. Store receipt
			const receipt: TransactionReceipt = {
				transactionHash: txHash,
				transactionIndex: 0,
				blockHash: newBlockHash,
				blockNumber: newBlockNumber,
				from: params.from.toLowerCase(),
				to: params.to?.toLowerCase() ?? null,
				cumulativeGasUsed: gasUsed,
				gasUsed,
				contractAddress: null,
				logs: [],
				status: 1,
				effectiveGasPrice,
				type: params.maxFeePerGas !== undefined ? 2 : 0,
			}
			yield* node.txPool.addReceipt(receipt)

			return { hash: txHash } satisfies SendTransactionResult
		})
