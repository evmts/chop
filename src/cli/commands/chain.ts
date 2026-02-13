/**
 * Chain query CLI commands — fetch blocks, transactions, receipts, logs, fees.
 *
 * Commands:
 * - block: Get block by number/tag/hash
 * - tx: Get transaction by hash
 * - receipt: Get transaction receipt by hash
 * - logs: Get logs matching a filter
 * - gas-price: Get current gas price
 * - base-fee: Get current base fee per gas
 * - find-block: Find block closest to a Unix timestamp
 *
 * All commands require --rpc-url / -r and support --json / -j.
 */

import { Args, Command, Options } from "@effect/cli"
import { FetchHttpClient, type HttpClient } from "@effect/platform"
import { Console, Data, Effect } from "effect"
import { type RpcClientError, rpcCall } from "../../rpc/client.js"
import { handleCommandErrors, hexToDecimal, jsonOption, rpcUrlOption } from "../shared.js"

// ============================================================================
// Error Types
// ============================================================================

/** Error for invalid block ID (not a number, tag, or hash). */
export class InvalidBlockIdError extends Data.TaggedError("InvalidBlockIdError")<{
	readonly message: string
}> {}

/** Error for transaction not found. */
export class TransactionNotFoundError extends Data.TaggedError("TransactionNotFoundError")<{
	readonly message: string
}> {}

/** Error for receipt not found. */
export class ReceiptNotFoundError extends Data.TaggedError("ReceiptNotFoundError")<{
	readonly message: string
}> {}

/** Error for invalid timestamp in find-block. */
export class InvalidTimestampError extends Data.TaggedError("InvalidTimestampError")<{
	readonly message: string
}> {}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Parse a block ID string into an RPC method + params pair.
 *
 * Supports: decimal number, hex number, block tags (latest/earliest/pending/safe/finalized),
 * or a 66-char block hash (dispatches to eth_getBlockByHash).
 */
export const parseBlockId = (id: string): Effect.Effect<{ method: string; params: unknown[] }, InvalidBlockIdError> => {
	const tags = ["latest", "earliest", "pending", "safe", "finalized"]
	if (tags.includes(id)) {
		return Effect.succeed({ method: "eth_getBlockByNumber", params: [id, true] })
	}
	// 0x-prefixed 66-char = block hash
	if (id.startsWith("0x") && id.length === 66) {
		return Effect.succeed({ method: "eth_getBlockByHash", params: [id, true] })
	}
	// 0x-prefixed hex number
	if (id.startsWith("0x")) {
		try {
			BigInt(id)
			return Effect.succeed({ method: "eth_getBlockByNumber", params: [id, true] })
		} catch {
			return Effect.fail(new InvalidBlockIdError({ message: `Invalid block ID: ${id}` }))
		}
	}
	// Decimal number
	try {
		const num = BigInt(id)
		if (num >= 0n) {
			return Effect.succeed({ method: "eth_getBlockByNumber", params: [`0x${num.toString(16)}`, true] })
		}
	} catch {
		// Not a valid decimal number, fall through to error
	}
	return Effect.fail(
		new InvalidBlockIdError({
			message: `Invalid block ID: ${id}. Expected a number, tag (latest/earliest/pending), or block hash.`,
		}),
	)
}

/**
 * Format a block object for human-readable output.
 */
const formatBlock = (block: Record<string, unknown>): string => {
	const lines: string[] = []
	const num = block.number
	if (num) lines.push(`Block:          ${hexToDecimal(num)}`)
	if (block.hash) lines.push(`Hash:           ${block.hash}`)
	if (block.parentHash) lines.push(`Parent Hash:    ${block.parentHash}`)
	if (block.timestamp) lines.push(`Timestamp:      ${hexToDecimal(block.timestamp)}`)
	if (block.gasUsed) lines.push(`Gas Used:       ${hexToDecimal(block.gasUsed)}`)
	if (block.gasLimit) lines.push(`Gas Limit:      ${hexToDecimal(block.gasLimit)}`)
	if (block.baseFeePerGas) lines.push(`Base Fee:       ${hexToDecimal(block.baseFeePerGas)}`)
	if (block.miner) lines.push(`Miner:          ${block.miner}`)
	const txs = block.transactions
	if (Array.isArray(txs)) lines.push(`Transactions:   ${txs.length}`)
	return lines.join("\n")
}

/**
 * Format a transaction object for human-readable output.
 */
const formatTx = (tx: Record<string, unknown>): string => {
	const lines: string[] = []
	if (tx.hash) lines.push(`Hash:        ${tx.hash}`)
	if (tx.from) lines.push(`From:        ${tx.from}`)
	if (tx.to) lines.push(`To:          ${tx.to ?? "(contract creation)"}`)
	if (tx.value) lines.push(`Value:       ${hexToDecimal(tx.value)} wei`)
	if (tx.nonce) lines.push(`Nonce:       ${hexToDecimal(tx.nonce)}`)
	if (tx.gas) lines.push(`Gas:         ${hexToDecimal(tx.gas)}`)
	if (tx.gasPrice) lines.push(`Gas Price:   ${hexToDecimal(tx.gasPrice)}`)
	if (tx.blockNumber) lines.push(`Block:       ${hexToDecimal(tx.blockNumber)}`)
	if (tx.input) lines.push(`Input:       ${tx.input}`)
	return lines.join("\n")
}

/**
 * Format a receipt object for human-readable output.
 */
const formatReceipt = (receipt: Record<string, unknown>): string => {
	const lines: string[] = []
	if (receipt.transactionHash) lines.push(`Tx Hash:       ${receipt.transactionHash}`)
	if (receipt.status) lines.push(`Status:        ${receipt.status === "0x1" ? "Success" : "Reverted"}`)
	if (receipt.blockNumber) lines.push(`Block:         ${hexToDecimal(receipt.blockNumber)}`)
	if (receipt.from) lines.push(`From:          ${receipt.from}`)
	if (receipt.to) lines.push(`To:            ${receipt.to ?? "(contract creation)"}`)
	if (receipt.gasUsed) lines.push(`Gas Used:      ${hexToDecimal(receipt.gasUsed)}`)
	if (receipt.contractAddress) lines.push(`Contract:      ${receipt.contractAddress}`)
	const logs = receipt.logs
	if (Array.isArray(logs)) lines.push(`Logs:          ${logs.length}`)
	return lines.join("\n")
}

/**
 * Format a single log entry for human-readable output.
 */
const formatLog = (log: Record<string, unknown>): string => {
	const lines: string[] = []
	lines.push(`Address: ${log.address ?? ""}`)
	const topics = (log.topics as string[]) ?? []
	for (let i = 0; i < topics.length; i++) {
		lines.push(`Topic ${i}: ${topics[i]}`)
	}
	lines.push(`Data:    ${log.data ?? "0x"}`)
	lines.push("---")
	return lines.join("\n")
}

/**
 * Format a logs result set for human-readable output.
 */
const formatLogs = (logs: readonly Record<string, unknown>[]): string => {
	if (logs.length === 0) return "No logs found"
	return logs.map(formatLog).join("\n")
}

// ============================================================================
// Handler functions (testable, separated from CLI wiring)
// ============================================================================

/**
 * Get a block by number, tag, or hash.
 */
export const blockHandler = (
	rpcUrl: string,
	blockId: string,
): Effect.Effect<Record<string, unknown>, RpcClientError | InvalidBlockIdError, HttpClient.HttpClient> =>
	Effect.gen(function* () {
		const { method, params } = yield* parseBlockId(blockId)
		const result = yield* rpcCall(rpcUrl, method, params)
		if (result === null || result === undefined) {
			return yield* Effect.fail(new InvalidBlockIdError({ message: `Block not found: ${blockId}` }))
		}
		return result as Record<string, unknown>
	})

/**
 * Get a transaction by hash.
 */
export const txHandler = (
	rpcUrl: string,
	hash: string,
): Effect.Effect<Record<string, unknown>, RpcClientError | TransactionNotFoundError, HttpClient.HttpClient> =>
	Effect.gen(function* () {
		const result = yield* rpcCall(rpcUrl, "eth_getTransactionByHash", [hash])
		if (result === null || result === undefined) {
			return yield* Effect.fail(new TransactionNotFoundError({ message: `Transaction not found: ${hash}` }))
		}
		return result as Record<string, unknown>
	})

/**
 * Get a transaction receipt by hash.
 */
export const receiptHandler = (
	rpcUrl: string,
	hash: string,
): Effect.Effect<Record<string, unknown>, RpcClientError | ReceiptNotFoundError, HttpClient.HttpClient> =>
	Effect.gen(function* () {
		const result = yield* rpcCall(rpcUrl, "eth_getTransactionReceipt", [hash])
		if (result === null || result === undefined) {
			return yield* Effect.fail(new ReceiptNotFoundError({ message: `Receipt not found: ${hash}` }))
		}
		return result as Record<string, unknown>
	})

/**
 * Get logs matching a filter.
 */
export const logsHandler = (
	rpcUrl: string,
	opts: {
		readonly address?: string
		readonly topics?: readonly string[]
		readonly fromBlock?: string
		readonly toBlock?: string
	},
): Effect.Effect<readonly Record<string, unknown>[], RpcClientError, HttpClient.HttpClient> =>
	Effect.gen(function* () {
		const filter: Record<string, unknown> = {
			fromBlock: opts.fromBlock ?? "latest",
			toBlock: opts.toBlock ?? "latest",
		}
		if (opts.address) filter.address = opts.address
		if (opts.topics && opts.topics.length > 0) filter.topics = [...opts.topics]
		const result = yield* rpcCall(rpcUrl, "eth_getLogs", [filter])
		return (result ?? []) as readonly Record<string, unknown>[]
	})

/**
 * Get current gas price as a decimal string (wei).
 */
export const gasPriceHandler = (rpcUrl: string): Effect.Effect<string, RpcClientError, HttpClient.HttpClient> =>
	rpcCall(rpcUrl, "eth_gasPrice", []).pipe(Effect.map(hexToDecimal))

/**
 * Get current base fee per gas as a decimal string (wei).
 */
export const baseFeeHandler = (
	rpcUrl: string,
): Effect.Effect<string, RpcClientError | InvalidBlockIdError, HttpClient.HttpClient> =>
	Effect.gen(function* () {
		const block = yield* blockHandler(rpcUrl, "latest")
		const baseFee = block.baseFeePerGas
		if (typeof baseFee !== "string") {
			return yield* Effect.fail(new InvalidBlockIdError({ message: "Latest block does not have baseFeePerGas" }))
		}
		return hexToDecimal(baseFee)
	})

/**
 * Find the block number closest to (and ≤) a Unix timestamp using binary search.
 */
export const findBlockHandler = (
	rpcUrl: string,
	targetTimestamp: string,
): Effect.Effect<string, RpcClientError | InvalidTimestampError | InvalidBlockIdError, HttpClient.HttpClient> =>
	Effect.gen(function* () {
		const target = Number(targetTimestamp)
		if (!Number.isFinite(target) || target < 0) {
			return yield* Effect.fail(new InvalidTimestampError({ message: `Invalid timestamp: ${targetTimestamp}` }))
		}

		const latestBlock = yield* blockHandler(rpcUrl, "latest")
		const latestNumber = Number(BigInt(latestBlock.number as string))
		const latestTimestamp = Number(BigInt(latestBlock.timestamp as string))

		if (target >= latestTimestamp) return String(latestNumber)
		if (latestNumber === 0) return "0"

		const genesisBlock = yield* blockHandler(rpcUrl, "0")
		const genesisTimestamp = Number(BigInt(genesisBlock.timestamp as string))

		if (target <= genesisTimestamp) return "0"

		// Binary search for block with timestamp closest to and ≤ target
		let low = 0
		let high = latestNumber

		while (low < high) {
			const mid = Math.floor((low + high + 1) / 2)
			const midBlock = yield* blockHandler(rpcUrl, String(mid))
			const midTimestamp = Number(BigInt(midBlock.timestamp as string))

			if (midTimestamp <= target) {
				low = mid
			} else {
				high = mid - 1
			}
		}

		return String(low)
	})

// ============================================================================
// Command definitions
// ============================================================================

/**
 * `chop block <number|tag|hash> -r <url>`
 */
export const blockCommand = Command.make(
	"block",
	{
		blockId: Args.text({ name: "block-id" }).pipe(
			Args.withDescription("Block number, tag (latest/earliest/pending), or block hash"),
		),
		rpcUrl: rpcUrlOption,
		json: jsonOption,
	},
	({ blockId, rpcUrl, json }) =>
		Effect.gen(function* () {
			const result = yield* blockHandler(rpcUrl, blockId)
			if (json) {
				yield* Console.log(JSON.stringify(result))
			} else {
				yield* Console.log(formatBlock(result))
			}
		}).pipe(Effect.provide(FetchHttpClient.layer), handleCommandErrors),
).pipe(Command.withDescription("Get a block by number, tag, or hash"))

/**
 * `chop tx <hash> -r <url>`
 */
export const txCommand = Command.make(
	"tx",
	{
		hash: Args.text({ name: "hash" }).pipe(Args.withDescription("Transaction hash (0x-prefixed)")),
		rpcUrl: rpcUrlOption,
		json: jsonOption,
	},
	({ hash, rpcUrl, json }) =>
		Effect.gen(function* () {
			const result = yield* txHandler(rpcUrl, hash)
			if (json) {
				yield* Console.log(JSON.stringify(result))
			} else {
				yield* Console.log(formatTx(result))
			}
		}).pipe(Effect.provide(FetchHttpClient.layer), handleCommandErrors),
).pipe(Command.withDescription("Get a transaction by hash"))

/**
 * `chop receipt <hash> -r <url>`
 */
export const receiptCommand = Command.make(
	"receipt",
	{
		hash: Args.text({ name: "hash" }).pipe(Args.withDescription("Transaction hash (0x-prefixed)")),
		rpcUrl: rpcUrlOption,
		json: jsonOption,
	},
	({ hash, rpcUrl, json }) =>
		Effect.gen(function* () {
			const result = yield* receiptHandler(rpcUrl, hash)
			if (json) {
				yield* Console.log(JSON.stringify(result))
			} else {
				yield* Console.log(formatReceipt(result))
			}
		}).pipe(Effect.provide(FetchHttpClient.layer), handleCommandErrors),
).pipe(Command.withDescription("Get a transaction receipt by hash"))

/**
 * `chop logs --address <addr> --topic <topic> -r <url>`
 */
export const logsCommand = Command.make(
	"logs",
	{
		address: Options.text("address").pipe(
			Options.withAlias("a"),
			Options.withDescription("Contract address to filter logs"),
			Options.optional,
		),
		topic: Options.text("topic").pipe(
			Options.withAlias("t"),
			Options.withDescription("Event topic to filter (can be repeated)"),
			Options.optional,
		),
		fromBlock: Options.text("from-block").pipe(
			Options.withDescription("Start block (number or tag, default: latest)"),
			Options.optional,
		),
		toBlock: Options.text("to-block").pipe(
			Options.withDescription("End block (number or tag, default: latest)"),
			Options.optional,
		),
		rpcUrl: rpcUrlOption,
		json: jsonOption,
	},
	({ address, topic, fromBlock, toBlock, rpcUrl, json }) =>
		Effect.gen(function* () {
			const opts: {
				address?: string
				topics?: readonly string[]
				fromBlock?: string
				toBlock?: string
			} = {}
			if (address._tag === "Some") opts.address = address.value
			if (topic._tag === "Some") opts.topics = [topic.value]
			if (fromBlock._tag === "Some") opts.fromBlock = fromBlock.value
			if (toBlock._tag === "Some") opts.toBlock = toBlock.value
			const result = yield* logsHandler(rpcUrl, opts)
			if (json) {
				yield* Console.log(JSON.stringify(result))
			} else {
				yield* Console.log(formatLogs(result))
			}
		}).pipe(Effect.provide(FetchHttpClient.layer), handleCommandErrors),
).pipe(Command.withDescription("Get logs matching a filter"))

/**
 * `chop gas-price -r <url>`
 */
export const gasPriceCommand = Command.make(
	"gas-price",
	{ rpcUrl: rpcUrlOption, json: jsonOption },
	({ rpcUrl, json }) =>
		Effect.gen(function* () {
			const result = yield* gasPriceHandler(rpcUrl)
			if (json) {
				yield* Console.log(JSON.stringify({ gasPrice: result }))
			} else {
				yield* Console.log(result)
			}
		}).pipe(Effect.provide(FetchHttpClient.layer), handleCommandErrors),
).pipe(Command.withDescription("Get the current gas price (wei)"))

/**
 * `chop base-fee -r <url>`
 */
export const baseFeeCommand = Command.make("base-fee", { rpcUrl: rpcUrlOption, json: jsonOption }, ({ rpcUrl, json }) =>
	Effect.gen(function* () {
		const result = yield* baseFeeHandler(rpcUrl)
		if (json) {
			yield* Console.log(JSON.stringify({ baseFee: result }))
		} else {
			yield* Console.log(result)
		}
	}).pipe(Effect.provide(FetchHttpClient.layer), handleCommandErrors),
).pipe(Command.withDescription("Get the current base fee per gas (wei)"))

/**
 * `chop find-block <timestamp> -r <url>`
 */
export const findBlockCommand = Command.make(
	"find-block",
	{
		timestamp: Args.text({ name: "timestamp" }).pipe(Args.withDescription("Unix timestamp to search for")),
		rpcUrl: rpcUrlOption,
		json: jsonOption,
	},
	({ timestamp, rpcUrl, json }) =>
		Effect.gen(function* () {
			const result = yield* findBlockHandler(rpcUrl, timestamp)
			if (json) {
				yield* Console.log(JSON.stringify({ blockNumber: result }))
			} else {
				yield* Console.log(result)
			}
		}).pipe(Effect.provide(FetchHttpClient.layer), handleCommandErrors),
).pipe(Command.withDescription("Find the block closest to a Unix timestamp"))

// ============================================================================
// Exports
// ============================================================================

/** All chain query subcommands for registration with the root command. */
export const chainCommands = [
	blockCommand,
	txCommand,
	receiptCommand,
	logsCommand,
	gasPriceCommand,
	baseFeeCommand,
	findBlockCommand,
] as const
