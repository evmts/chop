/**
 * Coverage-gap tests for procedures/eth.ts and procedures/anvil.ts.
 *
 * Targets:
 * 1. ethFeeHistory — GenesisError catch branch (eth.ts line 321)
 *    When blockchain.getHead() fails because no genesis is set, the catch
 *    produces a synthetic block with number=0n and default gas/fee values.
 *
 * 2. ethFeeHistory — BlockNotFoundError catch branch (eth.ts line 335)
 *    When blockchain.getBlockByNumber() fails for a block in the iteration
 *    range, the catch produces a synthetic block with default gas/fee values.
 *
 * 3. anvilNodeInfo — falsy rpcUrl branch (anvil.ts line 456)
 *    When nodeConfig.rpcUrl is undefined (or ""), the ternary returns {}
 *    instead of { forkUrl: rpcUrl }.
 */

import { describe, it } from "@effect/vitest"
import { Effect, Ref } from "effect"
import { expect } from "vitest"
import type { Block } from "../blockchain/block-store.js"
import { BlockNotFoundError, GenesisError } from "../blockchain/errors.js"
import type { TevmNodeShape } from "../node/index.js"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { anvilNodeInfo } from "./anvil.js"
import { ethFeeHistory } from "./eth.js"

// ---------------------------------------------------------------------------
// ethFeeHistory — GenesisError catch branch (line 321)
// ---------------------------------------------------------------------------

describe("ethFeeHistory — GenesisError catch branch", () => {
	it.effect("returns default fee data when blockchain has no genesis (getHead fails)", () =>
		Effect.gen(function* () {
			// Build a minimal mock node where getHead() fails with GenesisError.
			// The catch branch in ethFeeHistory produces:
			//   { number: 0n, baseFeePerGas: 1_000_000_000n, gasUsed: 0n, gasLimit: 30_000_000n }
			// With number=0n the loop runs min(blockCount, 0+1) = 1 iteration at block 0.
			// getBlockByNumber(0n) also fails => hits the BlockNotFoundError catch too,
			// but we focus on verifying the GenesisError fallback result shape.
			const mockNode = {
				blockchain: {
					getHead: () => Effect.fail(new GenesisError({ message: "no genesis" })),
					getBlockByNumber: (_n: bigint) => Effect.fail(new BlockNotFoundError({ identifier: `block ${_n}` })),
				},
			} as unknown as TevmNodeShape

			// Request blockCount=1, newestBlock="latest", no reward percentiles
			const result = (yield* ethFeeHistory(mockNode)(["0x1", "latest", []])) as Record<string, unknown>

			expect(result).toBeDefined()
			// oldestBlock should be 0x0 because the synthetic head has number=0n
			expect(result.oldestBlock).toBe("0x0")

			// baseFeePerGas: 1 iteration + 1 "next block" entry = 2 entries
			const baseFeePerGas = result.baseFeePerGas as string[]
			expect(baseFeePerGas).toHaveLength(2)
			// Each entry should be the default 1 gwei = 0x3b9aca00
			for (const fee of baseFeePerGas) {
				expect(fee).toBe("0x3b9aca00")
			}

			// gasUsedRatio: 1 entry, and since gasUsed=0 / gasLimit=30M, ratio = 0
			const gasUsedRatio = result.gasUsedRatio as number[]
			expect(gasUsedRatio).toHaveLength(1)
			expect(gasUsedRatio[0]).toBe(0)

			expect(result.reward).toEqual([])
		}),
	)
})

// ---------------------------------------------------------------------------
// ethFeeHistory — BlockNotFoundError catch branch (line 335)
// ---------------------------------------------------------------------------

describe("ethFeeHistory — BlockNotFoundError catch branch", () => {
	it.effect("uses default fee values when getBlockByNumber fails for a block in range", () =>
		Effect.gen(function* () {
			// Mock node where getHead() succeeds with a block at number=2,
			// but getBlockByNumber() fails for all blocks => exercises the
			// BlockNotFoundError catch at line 335 on every loop iteration.
			const headBlock: Block = {
				hash: `0x${"aa".repeat(32)}`,
				parentHash: `0x${"00".repeat(32)}`,
				number: 2n,
				timestamp: 1000n,
				gasLimit: 30_000_000n,
				gasUsed: 0n,
				baseFeePerGas: 2_000_000_000n,
			}

			const mockNode = {
				blockchain: {
					getHead: () => Effect.succeed(headBlock),
					getBlockByNumber: (_n: bigint) => Effect.fail(new BlockNotFoundError({ identifier: `block ${_n}` })),
				},
			} as unknown as TevmNodeShape

			// Request blockCount=3, which yields min(3, 2+1) = 3 iterations
			// oldestBlock = 2 - 3 + 1 = 0, iterating blocks 0, 1, 2
			// All three getBlockByNumber calls will fail => catch produces defaults
			const result = (yield* ethFeeHistory(mockNode)(["0x3", "latest", []])) as Record<string, unknown>

			expect(result).toBeDefined()
			expect(result.oldestBlock).toBe("0x0")

			// baseFeePerGas: 3 loop iterations + 1 "next block" = 4 entries
			const baseFeePerGas = result.baseFeePerGas as string[]
			expect(baseFeePerGas).toHaveLength(4)

			// The first 3 entries come from the BlockNotFoundError catch default (1 gwei)
			for (let i = 0; i < 3; i++) {
				expect(baseFeePerGas[i]).toBe("0x3b9aca00")
			}
			// The last entry is the head's baseFeePerGas (2 gwei = 0x77359400)
			expect(baseFeePerGas[3]).toBe("0x77359400")

			// gasUsedRatio: 3 entries, all 0 (default gasUsed=0, gasLimit=30M)
			const gasUsedRatio = result.gasUsedRatio as number[]
			expect(gasUsedRatio).toHaveLength(3)
			for (const ratio of gasUsedRatio) {
				expect(ratio).toBe(0)
			}

			expect(result.reward).toEqual([])
		}),
	)

	it.effect("mixes real blocks and fallback blocks when only some are missing", () =>
		Effect.gen(function* () {
			// Head is at block 2. Block 0 and 2 exist, block 1 is missing.
			const headBlock: Block = {
				hash: `0x${"bb".repeat(32)}`,
				parentHash: `0x${"00".repeat(32)}`,
				number: 2n,
				timestamp: 2000n,
				gasLimit: 30_000_000n,
				gasUsed: 15_000_000n, // 50% gas used
				baseFeePerGas: 2_000_000_000n,
			}

			const block0: Block = {
				hash: `0x${"00".repeat(31)}01`,
				parentHash: `0x${"00".repeat(32)}`,
				number: 0n,
				timestamp: 0n,
				gasLimit: 30_000_000n,
				gasUsed: 0n,
				baseFeePerGas: 1_000_000_000n,
			}

			const block2: Block = {
				hash: `0x${"cc".repeat(32)}`,
				parentHash: `0x${"00".repeat(32)}`,
				number: 2n,
				timestamp: 2000n,
				gasLimit: 30_000_000n,
				gasUsed: 15_000_000n,
				baseFeePerGas: 2_000_000_000n,
			}

			const mockNode = {
				blockchain: {
					getHead: () => Effect.succeed(headBlock),
					getBlockByNumber: (n: bigint) => {
						if (n === 0n) return Effect.succeed(block0)
						if (n === 2n) return Effect.succeed(block2)
						// Block 1 is missing
						return Effect.fail(new BlockNotFoundError({ identifier: `block ${n}` }))
					},
				},
			} as unknown as TevmNodeShape

			// Request blockCount=3 covering blocks 0, 1, 2
			const result = (yield* ethFeeHistory(mockNode)(["0x3", "latest", []])) as Record<string, unknown>

			expect(result.oldestBlock).toBe("0x0")

			const baseFeePerGas = result.baseFeePerGas as string[]
			expect(baseFeePerGas).toHaveLength(4) // 3 loop + 1 next

			// Block 0: real baseFee = 1 gwei
			expect(baseFeePerGas[0]).toBe("0x3b9aca00")
			// Block 1: missing => fallback default = 1 gwei
			expect(baseFeePerGas[1]).toBe("0x3b9aca00")
			// Block 2: real baseFee = 2 gwei
			expect(baseFeePerGas[2]).toBe("0x77359400")
			// Next block: head's baseFee = 2 gwei
			expect(baseFeePerGas[3]).toBe("0x77359400")

			const gasUsedRatio = result.gasUsedRatio as number[]
			expect(gasUsedRatio).toHaveLength(3)
			// Block 0: 0/30M = 0
			expect(gasUsedRatio[0]).toBe(0)
			// Block 1: missing => fallback 0/30M = 0
			expect(gasUsedRatio[1]).toBe(0)
			// Block 2: 15M/30M = 0.5
			expect(gasUsedRatio[2]).toBe(0.5)
		}),
	)
})

// ---------------------------------------------------------------------------
// anvilNodeInfo — falsy rpcUrl branch (line 456)
// ---------------------------------------------------------------------------

describe("anvilNodeInfo — falsy rpcUrl branch", () => {
	it.effect("returns empty forkConfig when rpcUrl is undefined", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Default LocalTest node has rpcUrl = undefined (falsy).
			// This exercises: rpcUrl ? { forkUrl: rpcUrl } : {}
			// The falsy branch should produce forkConfig: {}
			const result = (yield* anvilNodeInfo(node)([])) as Record<string, unknown>

			expect(result).toBeDefined()
			expect(result.forkConfig).toEqual({})
			// Verify it does NOT have a forkUrl key
			expect(result.forkConfig).not.toHaveProperty("forkUrl")

			// Sanity-check other fields are still present
			expect(result.currentBlockNumber).toBe("0x0")
			expect(result.chainId).toBe("0x7a69") // 31337
			expect(result.hardFork).toBe("prague")
			expect(result.miningMode).toBe("auto")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("returns empty forkConfig when rpcUrl is empty string", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService

			// Explicitly set rpcUrl to "" (also falsy)
			yield* Ref.set(node.nodeConfig.rpcUrl, "")

			const result = (yield* anvilNodeInfo(node)([])) as Record<string, unknown>

			expect(result.forkConfig).toEqual({})
			expect(result.forkConfig).not.toHaveProperty("forkUrl")
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
