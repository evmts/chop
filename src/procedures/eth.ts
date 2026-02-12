import { Effect } from "effect"
import { bytesToHex } from "../evm/conversions.js"
import {
	blockNumberHandler,
	callHandler,
	chainIdHandler,
	getAccountsHandler,
	getBalanceHandler,
	getCodeHandler,
	getStorageAtHandler,
	getTransactionCountHandler,
	getTransactionReceiptHandler,
	sendTransactionHandler,
} from "../handlers/index.js"
import type { TevmNodeShape } from "../node/index.js"
import { InternalError } from "./errors.js"

// ---------------------------------------------------------------------------
// Serialization helpers
// ---------------------------------------------------------------------------

/** Convert bigint to minimal 0x-prefixed hex (e.g. 42n → "0x2a"). */
export const bigintToHex = (n: bigint): string => `0x${n.toString(16)}`

/** Convert bigint to 32-byte zero-padded 0x-prefixed hex. */
export const bigintToHex32 = (n: bigint): string => `0x${n.toString(16).padStart(64, "0")}`

// ---------------------------------------------------------------------------
// Procedure type — each takes params array, returns hex string
// ---------------------------------------------------------------------------

/** A JSON-RPC procedure: takes params array, returns a JSON-serializable result. */
export type ProcedureResult = string | readonly string[] | Record<string, unknown> | null
export type Procedure = (params: readonly unknown[]) => Effect.Effect<ProcedureResult, InternalError>

// ---------------------------------------------------------------------------
// Internal: wrap procedure body to catch both errors and defects
// ---------------------------------------------------------------------------

/** Catch all errors AND defects, wrapping them as InternalError. */
const wrapErrors = <A>(effect: Effect.Effect<A, unknown>): Effect.Effect<A, InternalError> =>
	effect.pipe(
		Effect.catchAll((e) => Effect.fail(new InternalError({ message: String(e) }))),
		Effect.catchAllDefect((defect) => Effect.fail(new InternalError({ message: String(defect) }))),
	)

// ---------------------------------------------------------------------------
// Procedures
// ---------------------------------------------------------------------------

/** eth_chainId → hex chain ID (e.g. "0x7a69" for 31337). */
export const ethChainId =
	(node: TevmNodeShape): Procedure =>
	(_params) =>
		chainIdHandler(node)().pipe(Effect.map(bigintToHex))

/** eth_blockNumber → hex block number (e.g. "0x0"). */
export const ethBlockNumber =
	(node: TevmNodeShape): Procedure =>
	(_params) =>
		wrapErrors(blockNumberHandler(node)().pipe(Effect.map(bigintToHex)))

/** eth_call → hex return data from EVM execution. */
export const ethCall =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const callObj = (params[0] ?? {}) as Record<string, unknown>
				const result = yield* callHandler(node)({
					...(typeof callObj.to === "string" ? { to: callObj.to } : {}),
					...(typeof callObj.from === "string" ? { from: callObj.from } : {}),
					...(typeof callObj.data === "string" ? { data: callObj.data } : {}),
					...(callObj.value !== undefined ? { value: BigInt(callObj.value as string) } : {}),
					...(callObj.gas !== undefined ? { gas: BigInt(callObj.gas as string) } : {}),
				})
				return bytesToHex(result.output)
			}),
		)

/** eth_getBalance → hex balance (minimal). */
export const ethGetBalance =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const address = params[0] as string
				const balance = yield* getBalanceHandler(node)({ address })
				return bigintToHex(balance)
			}),
		)

/** eth_getCode → hex bytecode. */
export const ethGetCode =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const address = params[0] as string
				const code = yield* getCodeHandler(node)({ address })
				return bytesToHex(code)
			}),
		)

/** eth_getStorageAt → 32-byte zero-padded hex value. */
export const ethGetStorageAt =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const address = params[0] as string
				const slot = params[1] as string
				const value = yield* getStorageAtHandler(node)({ address, slot })
				return bigintToHex32(value)
			}),
		)

/** eth_getTransactionCount → hex nonce (minimal). */
export const ethGetTransactionCount =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const address = params[0] as string
				const nonce = yield* getTransactionCountHandler(node)({ address })
				return bigintToHex(nonce)
			}),
		)

/** eth_accounts → array of account addresses. */
export const ethAccounts =
	(node: TevmNodeShape): Procedure =>
	(_params) =>
		getAccountsHandler(node)()

/** eth_sendTransaction → transaction hash. */
export const ethSendTransaction =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const txObj = (params[0] ?? {}) as Record<string, unknown>
				const result = yield* sendTransactionHandler(node)({
					from: txObj.from as string,
					...(typeof txObj.to === "string" ? { to: txObj.to } : {}),
					...(txObj.value !== undefined ? { value: BigInt(txObj.value as string) } : {}),
					...(txObj.gas !== undefined ? { gas: BigInt(txObj.gas as string) } : {}),
					...(txObj.gasPrice !== undefined ? { gasPrice: BigInt(txObj.gasPrice as string) } : {}),
					...(txObj.maxFeePerGas !== undefined ? { maxFeePerGas: BigInt(txObj.maxFeePerGas as string) } : {}),
					...(txObj.maxPriorityFeePerGas !== undefined
						? { maxPriorityFeePerGas: BigInt(txObj.maxPriorityFeePerGas as string) }
						: {}),
					...(txObj.nonce !== undefined ? { nonce: BigInt(txObj.nonce as string) } : {}),
					...(typeof txObj.data === "string" ? { data: txObj.data } : {}),
				})
				return result.hash
			}),
		)

/** eth_getTransactionReceipt → receipt object or null. */
export const ethGetTransactionReceipt =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const hash = params[0] as string
				const receipt = yield* getTransactionReceiptHandler(node)({ hash })
				if (receipt === null) return null
				// Serialize receipt to JSON-RPC format (bigints → hex strings)
				return {
					transactionHash: receipt.transactionHash,
					transactionIndex: bigintToHex(BigInt(receipt.transactionIndex)),
					blockHash: receipt.blockHash,
					blockNumber: bigintToHex(receipt.blockNumber),
					from: receipt.from,
					to: receipt.to,
					cumulativeGasUsed: bigintToHex(receipt.cumulativeGasUsed),
					gasUsed: bigintToHex(receipt.gasUsed),
					contractAddress: receipt.contractAddress,
					logs: receipt.logs.map((log, i) => ({
						address: log.address,
						topics: log.topics,
						data: log.data,
						blockNumber: bigintToHex(log.blockNumber),
						transactionHash: log.transactionHash,
						transactionIndex: bigintToHex(BigInt(log.transactionIndex)),
						blockHash: log.blockHash,
						logIndex: bigintToHex(BigInt(log.logIndex)),
						removed: log.removed,
					})),
					status: bigintToHex(BigInt(receipt.status)),
					effectiveGasPrice: bigintToHex(receipt.effectiveGasPrice),
					type: bigintToHex(BigInt(receipt.type)),
				} satisfies Record<string, unknown>
			}),
		)
