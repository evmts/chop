/**
 * Effect functions that query TevmNodeShape for call history data.
 *
 * Walks blocks from head backwards, fetches PoolTransaction + TransactionReceipt
 * per tx hash, and maps to CallRecord[]. Returns newest first.
 *
 * No OpenTUI dependency — returns plain typed objects.
 * All errors are caught internally — call history should never fail.
 */

import { Effect } from "effect"
import type { TevmNodeShape } from "../../node/index.js"
import type { CallRecord, CallType } from "../services/call-history-store.js"

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

/**
 * Fetch call history from the node.
 *
 * Walks blocks from head backwards, collecting transactions and mapping
 * them to CallRecord objects. Returns newest first, limited to `count`.
 *
 * @param node - The TevmNodeShape to query
 * @param count - Maximum number of records to return (default 50)
 */
export const getCallHistory = (node: TevmNodeShape, count = 50): Effect.Effect<readonly CallRecord[]> =>
	Effect.gen(function* () {
		const headBlockNumber = yield* node.blockchain
			.getHeadBlockNumber()
			.pipe(Effect.catchTag("GenesisError", () => Effect.succeed(0n)))

		const records: CallRecord[] = []
		// Track seen tx hashes to deduplicate (block store hash collisions can cause
		// the same block to appear at multiple canonical numbers).
		const seen = new Set<string>()
		let nextId = 1

		// Walk backwards from head block (newest first)
		for (let n = headBlockNumber; n >= 0n && records.length < count; n--) {
			const block = yield* node.blockchain
				.getBlockByNumber(n)
				.pipe(Effect.catchTag("BlockNotFoundError", () => Effect.succeed(null)))
			if (block === null) break

			const hashes = block.transactionHashes ?? []
			for (const hash of hashes) {
				if (records.length >= count) break
				if (seen.has(hash)) continue
				seen.add(hash)

				// Fetch transaction and receipt
				const tx = yield* node.txPool
					.getTransaction(hash)
					.pipe(Effect.catchTag("TransactionNotFoundError", () => Effect.succeed(null)))
				if (tx === null) continue

				const receipt = yield* node.txPool
					.getReceipt(hash)
					.pipe(Effect.catchTag("TransactionNotFoundError", () => Effect.succeed(null)))

				// Determine call type
				const type: CallType = tx.to === undefined || tx.to === null ? "CREATE" : "CALL"

				// Build call record
				const record: CallRecord = {
					id: nextId++,
					type,
					from: tx.from,
					to: tx.to ?? "",
					value: tx.value,
					gasUsed: receipt?.gasUsed ?? tx.gasUsed ?? 0n,
					gasLimit: tx.gas,
					success: receipt ? receipt.status === 1 : tx.status === 1,
					calldata: tx.data,
					returnData: "0x", // Not available from pool transaction
					blockNumber: block.number,
					timestamp: block.timestamp,
					txHash: tx.hash,
					logs:
						receipt?.logs.map((log) => ({
							address: log.address,
							topics: log.topics,
							data: log.data,
						})) ?? [],
				}

				records.push(record)
			}
		}

		return records
	}).pipe(Effect.catchAll(() => Effect.succeed([] as readonly CallRecord[])))
