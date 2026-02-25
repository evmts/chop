import { Context, Effect, Layer } from "effect"
import type { Block } from "./block-store.js"
import { InvalidBlockError } from "./errors.js"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** EIP-150: minimum gas limit for any block. */
const MIN_GAS_LIMIT = 5000n

/** EIP-150: gas limit adjustment factor (parent / 1024). */
const GAS_LIMIT_BOUND_DIVISOR = 1024n

/** EIP-1559: elasticity multiplier — target is gasLimit / 2. */
const ELASTICITY_MULTIPLIER = 2n

/** EIP-1559: base fee change denominator. */
const BASE_FEE_CHANGE_DENOMINATOR = 8n

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape of the BlockHeaderValidator service API. */
export interface BlockHeaderValidatorApi {
	/** Validate gas limit change is within EIP-150 bounds. */
	readonly validateGasLimit: (block: Block, parent: Block) => Effect.Effect<true, InvalidBlockError>
	/** Validate base fee matches EIP-1559 calculation. */
	readonly validateBaseFee: (block: Block, parent: Block) => Effect.Effect<true, InvalidBlockError>
	/** Validate timestamp is strictly greater than parent. */
	readonly validateTimestamp: (block: Block, parent: Block) => Effect.Effect<true, InvalidBlockError>
	/** Run all header validations. */
	readonly validate: (block: Block, parent: Block) => Effect.Effect<true, InvalidBlockError>
}

// ---------------------------------------------------------------------------
// Service tag
// ---------------------------------------------------------------------------

/** Context tag for BlockHeaderValidatorService. */
export class BlockHeaderValidatorService extends Context.Tag("BlockHeaderValidator")<
	BlockHeaderValidatorService,
	BlockHeaderValidatorApi
>() {}

// ---------------------------------------------------------------------------
// Pure validation helpers
// ---------------------------------------------------------------------------

/**
 * Calculate expected EIP-1559 base fee given parent block.
 *
 * If parentGasUsed == target: baseFee unchanged
 * If parentGasUsed > target: baseFee increases
 * If parentGasUsed < target: baseFee decreases (floor at 0)
 */
const calculateExpectedBaseFee = (parent: Block): bigint => {
	const parentGasTarget = parent.gasLimit / ELASTICITY_MULTIPLIER
	const parentBaseFee = parent.baseFeePerGas

	if (parent.gasUsed === parentGasTarget) {
		return parentBaseFee
	}

	if (parent.gasUsed > parentGasTarget) {
		const gasUsedDelta = parent.gasUsed - parentGasTarget
		const baseFeePerGasDelta = (parentBaseFee * gasUsedDelta) / parentGasTarget / BASE_FEE_CHANGE_DENOMINATOR
		// Minimum increase of 1
		const delta = baseFeePerGasDelta > 0n ? baseFeePerGasDelta : 1n
		return parentBaseFee + delta
	}

	// parent.gasUsed < parentGasTarget
	const gasUsedDelta = parentGasTarget - parent.gasUsed
	const baseFeePerGasDelta = (parentBaseFee * gasUsedDelta) / parentGasTarget / BASE_FEE_CHANGE_DENOMINATOR
	return parentBaseFee > baseFeePerGasDelta ? parentBaseFee - baseFeePerGasDelta : 0n
}

const validateGasLimitFn = (block: Block, parent: Block): Effect.Effect<true, InvalidBlockError> =>
	Effect.gen(function* () {
		const parentGasLimit = parent.gasLimit
		const limit = block.gasLimit
		const bound = parentGasLimit / GAS_LIMIT_BOUND_DIVISOR

		if (limit < MIN_GAS_LIMIT) {
			return yield* Effect.fail(
				new InvalidBlockError({
					message: `gas limit ${limit} is below minimum ${MIN_GAS_LIMIT}`,
				}),
			)
		}

		if (limit >= parentGasLimit + bound) {
			return yield* Effect.fail(
				new InvalidBlockError({
					message: `gas limit ${limit} exceeds upper bound (parent ${parentGasLimit} + ${bound - 1n})`,
				}),
			)
		}

		if (limit <= parentGasLimit - bound) {
			return yield* Effect.fail(
				new InvalidBlockError({
					message: `gas limit ${limit} below lower bound (parent ${parentGasLimit} - ${bound - 1n})`,
				}),
			)
		}

		return true as const
	})

const validateBaseFeeFn = (block: Block, parent: Block): Effect.Effect<true, InvalidBlockError> =>
	Effect.gen(function* () {
		const expected = calculateExpectedBaseFee(parent)
		if (block.baseFeePerGas !== expected) {
			return yield* Effect.fail(
				new InvalidBlockError({
					message: `base fee mismatch: expected ${expected}, got ${block.baseFeePerGas}`,
				}),
			)
		}
		return true as const
	})

const validateTimestampFn = (block: Block, parent: Block): Effect.Effect<true, InvalidBlockError> =>
	Effect.gen(function* () {
		if (block.timestamp <= parent.timestamp) {
			return yield* Effect.fail(
				new InvalidBlockError({
					message: `timestamp ${block.timestamp} must be greater than parent timestamp ${parent.timestamp}`,
				}),
			)
		}
		return true as const
	})

// ---------------------------------------------------------------------------
// Layer
// ---------------------------------------------------------------------------

/** Live layer for BlockHeaderValidatorService — pure validation logic. */
export const BlockHeaderValidatorLive: Layer.Layer<BlockHeaderValidatorService> = Layer.succeed(
	BlockHeaderValidatorService,
	{
		validateGasLimit: validateGasLimitFn,
		validateBaseFee: validateBaseFeeFn,
		validateTimestamp: validateTimestampFn,
		validate: (block, parent) =>
			Effect.gen(function* () {
				yield* validateGasLimitFn(block, parent)
				yield* validateBaseFeeFn(block, parent)
				yield* validateTimestampFn(block, parent)
				return true as const
			}),
	} satisfies BlockHeaderValidatorApi,
)
