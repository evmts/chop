import { Effect } from "effect"
import { bytesToHex, hexToBytes } from "../evm/conversions.js"
import {
	blockNumberHandler,
	callHandler,
	chainIdHandler,
	estimateGasHandler,
	gasPriceHandler,
	getAccountsHandler,
	getBalanceHandler,
	getBlockByHashHandler,
	getBlockByNumberHandler,
	getCodeHandler,
	getLogsHandler,
	getStorageAtHandler,
	getTransactionByHashHandler,
	getTransactionCountHandler,
	getTransactionReceiptHandler,
	sendTransactionHandler,
} from "../handlers/index.js"
import type { TevmNodeShape } from "../node/index.js"
import { InternalError, InvalidParamsError, wrapErrors } from "./errors.js"
import { serializeBlock, serializeLog, serializeTransaction } from "./helpers.js"

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
export type ProcedureResult =
	| string
	| boolean
	| readonly string[]
	| readonly Record<string, unknown>[]
	| Record<string, unknown>
	| null
export type Procedure = (params: readonly unknown[]) => Effect.Effect<ProcedureResult, InternalError>

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
					logs: receipt.logs.map((log) => ({
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

// ---------------------------------------------------------------------------
// Block retrieval procedures
// ---------------------------------------------------------------------------

/** eth_getBlockByNumber → block object or null. */
export const ethGetBlockByNumber =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const blockTag = (params[0] as string) ?? "latest"
				const includeFullTxs = (params[1] as boolean) ?? false
				const block = yield* getBlockByNumberHandler(node)({ blockTag, includeFullTxs })
				if (!block) return null

				// Resolve full transactions when requested
				let fullTxs: import("../node/tx-pool.js").PoolTransaction[] | undefined
				if (includeFullTxs && block.transactionHashes) {
					fullTxs = []
					for (const txHash of block.transactionHashes) {
						const tx = yield* getTransactionByHashHandler(node)({ hash: txHash })
						if (tx) fullTxs.push(tx)
					}
				}

				return serializeBlock(block, includeFullTxs, fullTxs)
			}),
		)

/** eth_getBlockByHash → block object or null. */
export const ethGetBlockByHash =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const hash = params[0] as string
				const includeFullTxs = (params[1] as boolean) ?? false
				const block = yield* getBlockByHashHandler(node)({ hash, includeFullTxs })
				if (!block) return null

				// Resolve full transactions when requested
				let fullTxs: import("../node/tx-pool.js").PoolTransaction[] | undefined
				if (includeFullTxs && block.transactionHashes) {
					fullTxs = []
					for (const txHash of block.transactionHashes) {
						const tx = yield* getTransactionByHashHandler(node)({ hash: txHash })
						if (tx) fullTxs.push(tx)
					}
				}

				return serializeBlock(block, includeFullTxs, fullTxs)
			}),
		)

// ---------------------------------------------------------------------------
// Transaction retrieval procedures
// ---------------------------------------------------------------------------

/** eth_getTransactionByHash → transaction object or null. */
export const ethGetTransactionByHash =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const hash = params[0] as string
				const tx = yield* getTransactionByHashHandler(node)({ hash })
				if (!tx) return null
				return serializeTransaction(tx)
			}),
		)

// ---------------------------------------------------------------------------
// Gas / fee procedures
// ---------------------------------------------------------------------------

/** eth_gasPrice → hex gas price. */
export const ethGasPrice =
	(node: TevmNodeShape): Procedure =>
	(_params) =>
		wrapErrors(
			Effect.gen(function* () {
				const price = yield* gasPriceHandler(node)()
				return bigintToHex(price)
			}),
		)

/** eth_maxPriorityFeePerGas → "0x0" (local devnet, no priority fee needed). */
export const ethMaxPriorityFeePerGas =
	(_node: TevmNodeShape): Procedure =>
	(_params) =>
		Effect.succeed("0x0")

/** eth_estimateGas → hex gas estimate. */
export const ethEstimateGas =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const callObj = (params[0] ?? {}) as Record<string, unknown>
				const gas = yield* estimateGasHandler(node)({
					...(typeof callObj.to === "string" ? { to: callObj.to } : {}),
					...(typeof callObj.from === "string" ? { from: callObj.from } : {}),
					...(typeof callObj.data === "string" ? { data: callObj.data } : {}),
					...(callObj.value !== undefined ? { value: BigInt(callObj.value as string) } : {}),
					...(callObj.gas !== undefined ? { gas: BigInt(callObj.gas as string) } : {}),
				})
				return bigintToHex(gas)
			}),
		)

/** eth_feeHistory → fee history object. */
export const ethFeeHistory =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const blockCount = Number(params[0] as string)
				const head = yield* node.blockchain
					.getHead()
					.pipe(
						Effect.catchTag("GenesisError", () =>
							Effect.succeed({ number: 0n, baseFeePerGas: 1_000_000_000n, gasUsed: 0n, gasLimit: 30_000_000n }),
						),
					)

				const baseFeePerGas: string[] = []
				const gasUsedRatio: number[] = []
				const oldestBlock = head.number - BigInt(Math.min(blockCount, Number(head.number) + 1)) + 1n

				for (let i = 0; i < Math.min(blockCount, Number(head.number) + 1); i++) {
					const blockNum = oldestBlock + BigInt(i)
					const block = yield* node.blockchain
						.getBlockByNumber(blockNum)
						.pipe(
							Effect.catchTag("BlockNotFoundError", () =>
								Effect.succeed({ baseFeePerGas: 1_000_000_000n, gasUsed: 0n, gasLimit: 30_000_000n }),
							),
						)
					baseFeePerGas.push(bigintToHex(block.baseFeePerGas))
					gasUsedRatio.push(block.gasLimit > 0n ? Number(block.gasUsed) / Number(block.gasLimit) : 0)
				}

				// Add one more baseFee for the "next" block
				baseFeePerGas.push(bigintToHex(head.baseFeePerGas))

				return {
					oldestBlock: bigintToHex(oldestBlock),
					baseFeePerGas,
					gasUsedRatio,
					reward: [],
				} satisfies Record<string, unknown>
			}),
		)

// ---------------------------------------------------------------------------
// Log procedures
// ---------------------------------------------------------------------------

/** eth_getLogs → array of log objects. */
export const ethGetLogs =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const filterObj = (params[0] ?? {}) as Record<string, unknown>
				const logs = yield* getLogsHandler(node)({
					...(typeof filterObj.fromBlock === "string" ? { fromBlock: filterObj.fromBlock } : {}),
					...(typeof filterObj.toBlock === "string" ? { toBlock: filterObj.toBlock } : {}),
					...(filterObj.address !== undefined ? { address: filterObj.address as string | readonly string[] } : {}),
					...(filterObj.topics !== undefined
						? { topics: filterObj.topics as readonly (string | readonly string[] | null)[] }
						: {}),
					...(typeof filterObj.blockHash === "string" ? { blockHash: filterObj.blockHash } : {}),
				})
				return logs.map(serializeLog)
			}),
		)

// ---------------------------------------------------------------------------
// Signing / proof stubs
// ---------------------------------------------------------------------------

/** eth_sign → error (no private key signing in devnet). */
export const ethSign =
	(_node: TevmNodeShape): Procedure =>
	(_params) =>
		Effect.fail(new InternalError({ message: "eth_sign is not supported — use eth_sendTransaction instead" }))

/** eth_getProof → proof structure with actual account state (proofs are stubs). */
export const ethGetProof =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const address = params[0] as string
				const addrBytes = hexToBytes(address)
				const account = yield* node.hostAdapter.getAccount(addrBytes)
				return {
					address,
					accountProof: [],
					balance: bigintToHex(account.balance),
					codeHash: bytesToHex(account.codeHash),
					nonce: bigintToHex(account.nonce),
					storageHash: `0x${"00".repeat(32)}`,
					storageProof: [],
				} satisfies Record<string, unknown>
			}),
		)

// ---------------------------------------------------------------------------
// Filter procedures
// ---------------------------------------------------------------------------

/** eth_newFilter → hex filter ID. */
export const ethNewFilter =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const filterObj = (params[0] ?? {}) as Record<string, unknown>
				const head = yield* node.blockchain
					.getHead()
					.pipe(Effect.catchTag("GenesisError", () => Effect.succeed({ number: 0n })))

				const fromBlock = filterObj.fromBlock
					? filterObj.fromBlock === "latest"
						? head.number
						: BigInt(filterObj.fromBlock as string)
					: undefined
				const toBlock = filterObj.toBlock
					? filterObj.toBlock === "latest"
						? head.number
						: BigInt(filterObj.toBlock as string)
					: undefined

				const id = node.filterManager.newFilter(
					{
						...(fromBlock !== undefined ? { fromBlock } : {}),
						...(toBlock !== undefined ? { toBlock } : {}),
						...(filterObj.address !== undefined ? { address: filterObj.address as string | readonly string[] } : {}),
						...(filterObj.topics !== undefined
							? { topics: filterObj.topics as readonly (string | readonly string[] | null)[] }
							: {}),
					},
					head.number,
				)
				return id
			}),
		)

/** eth_getFilterChanges → changes since last poll. */
export const ethGetFilterChanges =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const filterId = params[0] as string
				const filter = node.filterManager.getFilter(filterId)
				if (!filter) {
					return yield* Effect.fail(new InvalidParamsError({ message: `Filter ${filterId} not found` }))
				}

				const head = yield* node.blockchain
					.getHead()
					.pipe(Effect.catchTag("GenesisError", () => Effect.succeed({ number: 0n })))

				if (filter.type === "block") {
					// Return block hashes since last poll
					const hashes: string[] = []
					for (let i = filter.lastPolledBlock + 1n; i <= head.number; i++) {
						const block = yield* node.blockchain
							.getBlockByNumber(i)
							.pipe(Effect.catchTag("BlockNotFoundError", () => Effect.succeed(null)))
						if (block) hashes.push(block.hash)
					}
					node.filterManager.updateLastPolled(filterId, head.number)
					return hashes
				}

				if (filter.type === "pendingTransaction") {
					// Return pending tx hashes
					const pending = yield* node.txPool.getPendingHashes()
					node.filterManager.updateLastPolled(filterId, head.number)
					return pending
				}

				// Log filter: return logs since last poll
				const logs = yield* getLogsHandler(node)({
					fromBlock: bigintToHex(filter.lastPolledBlock + 1n),
					toBlock: "latest",
					...(filter.criteria?.address !== undefined ? { address: filter.criteria.address } : {}),
					...(filter.criteria?.topics !== undefined ? { topics: filter.criteria.topics } : {}),
				})
				node.filterManager.updateLastPolled(filterId, head.number)
				return logs.map(serializeLog)
			}),
		)

/** eth_uninstallFilter → boolean success. */
export const ethUninstallFilter =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.sync(() => {
				const filterId = params[0] as string
				return node.filterManager.removeFilter(filterId)
			}),
		)

/** eth_newBlockFilter → hex filter ID. */
export const ethNewBlockFilter =
	(node: TevmNodeShape): Procedure =>
	(_params) =>
		wrapErrors(
			Effect.gen(function* () {
				const head = yield* node.blockchain
					.getHead()
					.pipe(Effect.catchTag("GenesisError", () => Effect.succeed({ number: 0n })))
				return node.filterManager.newBlockFilter(head.number)
			}),
		)

/** eth_newPendingTransactionFilter → hex filter ID. */
export const ethNewPendingTransactionFilter =
	(node: TevmNodeShape): Procedure =>
	(_params) =>
		wrapErrors(
			Effect.gen(function* () {
				const head = yield* node.blockchain
					.getHead()
					.pipe(Effect.catchTag("GenesisError", () => Effect.succeed({ number: 0n })))
				return node.filterManager.newPendingTransactionFilter(head.number)
			}),
		)

// ---------------------------------------------------------------------------
// Raw transaction stub
// ---------------------------------------------------------------------------

/** eth_sendRawTransaction → error (needs RLP tx decoding, not yet implemented). */
export const ethSendRawTransaction =
	(_node: TevmNodeShape): Procedure =>
	(_params) =>
		Effect.fail(
			new InternalError({ message: "eth_sendRawTransaction is not yet implemented — use eth_sendTransaction instead" }),
		)

// ---------------------------------------------------------------------------
// Block transaction count procedures
// ---------------------------------------------------------------------------

/** eth_getBlockTransactionCountByHash → hex count of transactions in a block by hash. */
export const ethGetBlockTransactionCountByHash =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const hash = params[0] as string
				const block = yield* getBlockByHashHandler(node)({ hash, includeFullTxs: false })
				if (!block) return null
				return bigintToHex(BigInt(block.transactionHashes?.length ?? 0))
			}),
		)

/** eth_getBlockTransactionCountByNumber → hex count of transactions in a block by number. */
export const ethGetBlockTransactionCountByNumber =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const blockTag = (params[0] as string) ?? "latest"
				const block = yield* getBlockByNumberHandler(node)({ blockTag, includeFullTxs: false })
				if (!block) return null
				return bigintToHex(BigInt(block.transactionHashes?.length ?? 0))
			}),
		)

// ---------------------------------------------------------------------------
// Transaction-by-index procedures
// ---------------------------------------------------------------------------

/** eth_getTransactionByBlockHashAndIndex → tx object or null. */
export const ethGetTransactionByBlockHashAndIndex =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const hash = params[0] as string
				const index = Number(params[1] as string)
				const block = yield* getBlockByHashHandler(node)({ hash, includeFullTxs: false })
				if (!block || !block.transactionHashes) return null
				const txHash = block.transactionHashes[index]
				if (!txHash) return null
				const tx = yield* getTransactionByHashHandler(node)({ hash: txHash })
				if (!tx) return null
				return serializeTransaction(tx)
			}),
		)

/** eth_getTransactionByBlockNumberAndIndex → tx object or null. */
export const ethGetTransactionByBlockNumberAndIndex =
	(node: TevmNodeShape): Procedure =>
	(params) =>
		wrapErrors(
			Effect.gen(function* () {
				const blockTag = (params[0] as string) ?? "latest"
				const index = Number(params[1] as string)
				const block = yield* getBlockByNumberHandler(node)({ blockTag, includeFullTxs: false })
				if (!block || !block.transactionHashes) return null
				const txHash = block.transactionHashes[index]
				if (!txHash) return null
				const tx = yield* getTransactionByHashHandler(node)({ hash: txHash })
				if (!tx) return null
				return serializeTransaction(tx)
			}),
		)
