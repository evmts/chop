import { Effect } from "effect"
import fc from "fast-check"
import { expect, it } from "vitest"
import { abiDecodeHandler, abiEncodeHandler } from "../src/cli/commands/abi.js"
import { bigintToBytes32, bytesToBigint, bytesToHex, hexToBytes } from "../src/evm/conversions.js"

const uint256 = fc.bigInt({ min: 0n, max: (1n << 256n) - 1n })

it("round-trips arbitrary binary data through hex", () => {
	fc.assert(
		fc.property(fc.uint8Array({ maxLength: 1024 }), (bytes) => {
			expect(hexToBytes(bytesToHex(bytes))).toEqual(bytes)
		}),
		{ numRuns: 500 },
	)
})

it("round-trips unsigned EVM words and preserves their byte width", () => {
	fc.assert(
		fc.property(uint256, (value) => {
			const bytes = bigintToBytes32(value)
			expect(bytes).toHaveLength(32)
			expect(bytesToBigint(bytes)).toBe(value)
		}),
		{ numRuns: 500 },
	)
})

it("round-trips typed calldata values including full-width uint256", async () => {
	const signature = "(uint256,bool,bytes)"
	await fc.assert(
		fc.asyncProperty(uint256, fc.boolean(), fc.uint8Array({ maxLength: 96 }), async (value, flag, bytes) => {
			const hex = bytesToHex(bytes)
			const encoded = await Effect.runPromise(abiEncodeHandler(signature, [String(value), String(flag), hex], false))
			const decoded = await Effect.runPromise(abiDecodeHandler(signature, encoded))
			expect(decoded).toEqual([String(value), String(flag), hex])
		}),
		{ numRuns: 150 },
	)
})
