import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import type { BlockchainApi } from "../blockchain/blockchain.js"
import { BlockNotFoundError, GenesisError } from "../blockchain/errors.js"
import type { TevmNodeShape } from "../node/index.js"
import { TransactionNotFoundError } from "./errors.js"
import { getLogsHandler } from "./getLogs.js"

// ---------------------------------------------------------------------------
// Mock node where blockchain.getHead() always fails with GenesisError
// ---------------------------------------------------------------------------

const makeGenesisErrorNode = (): TevmNodeShape => {
	const blockchain: BlockchainApi = {
		initGenesis: () => Effect.void,
		getHead: () => Effect.fail(new GenesisError({ message: "Chain not initialized" })),
		getBlock: (hash) => Effect.fail(new BlockNotFoundError({ identifier: hash })),
		getBlockByNumber: (num) => Effect.fail(new BlockNotFoundError({ identifier: String(num) })),
		putBlock: () => Effect.void,
		getHeadBlockNumber: () => Effect.fail(new GenesisError({ message: "Chain not initialized" })),
		getLatestBlock: () => Effect.fail(new GenesisError({ message: "Chain not initialized" })),
	}

	// Only blockchain and txPool are accessed by getLogsHandler
	return {
		blockchain,
		txPool: {
			addTransaction: () => Effect.void,
			getTransaction: (hash: string) => Effect.fail(new TransactionNotFoundError({ hash })),
			addReceipt: () => Effect.void,
			getReceipt: (hash: string) => Effect.fail(new TransactionNotFoundError({ hash })),
			getPendingHashes: () => Effect.succeed([]),
			getPendingTransactions: () => Effect.succeed([]),
			markMined: (hash: string) => Effect.fail(new TransactionNotFoundError({ hash })),
			dropTransaction: (hash: string) => Effect.fail(new TransactionNotFoundError({ hash })),
			dropAllTransactions: () => Effect.void,
		},
	} as unknown as TevmNodeShape
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getLogsHandler — GenesisError catch path", () => {
	it.effect("returns empty array when getHead() fails with GenesisError (default params)", () =>
		Effect.gen(function* () {
			const node = makeGenesisErrorNode()
			const logs = yield* getLogsHandler(node)({})
			expect(logs).toEqual([])
		}),
	)

	it.effect("returns empty array with fromBlock/toBlock when getHead() fails with GenesisError", () =>
		Effect.gen(function* () {
			const node = makeGenesisErrorNode()
			const logs = yield* getLogsHandler(node)({
				fromBlock: "earliest",
				toBlock: "latest",
			})
			expect(logs).toEqual([])
		}),
	)

	it.effect("returns empty array with blockHash when getHead() fails with GenesisError", () =>
		Effect.gen(function* () {
			const node = makeGenesisErrorNode()
			const logs = yield* getLogsHandler(node)({
				blockHash: `0x${"ab".repeat(32)}`,
			})
			expect(logs).toEqual([])
		}),
	)

	it.effect("fallback head has number=0n so fromBlock defaults to 0n", () =>
		Effect.gen(function* () {
			const node = makeGenesisErrorNode()
			// With "latest" for both, fromBlock and toBlock resolve to head.number = 0n
			const logs = yield* getLogsHandler(node)({
				fromBlock: "latest",
				toBlock: "latest",
			})
			expect(logs).toEqual([])
		}),
	)

	it.effect("handles pending block tag on genesis error fallback", () =>
		Effect.gen(function* () {
			const node = makeGenesisErrorNode()
			const logs = yield* getLogsHandler(node)({
				fromBlock: "pending",
				toBlock: "pending",
			})
			expect(logs).toEqual([])
		}),
	)
})
