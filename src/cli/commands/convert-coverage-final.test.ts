import { describe, it } from "@effect/vitest"
import { Effect, Either } from "effect"
import { expect } from "vitest"
import { fromRlpHandler, toRlpHandler } from "./convert.js"

// ============================================================================
// fromRlpHandler — formatRlpDecoded String(data) fallback (line 475)
// ============================================================================

describe("fromRlpHandler — formatRlpDecoded fallback coverage", () => {
	it.effect("decodes single-byte value 0x05 (< 0x80, self-representing RLP byte)", () =>
		Effect.gen(function* () {
			// A single byte in the range [0x00, 0x7f] is its own RLP encoding.
			// Rlp.decode may return this as a Uint8Array (hitting the first branch)
			// or a BrandedRlp with type "bytes". Either way we verify the result
			// is a valid hex string so the function doesn't fall through to String().
			const result = yield* fromRlpHandler("0x05")
			expect(result).toBe("0x05")
		}),
	)

	it.effect("decodes RLP-encoded integer 0 (0x80 encodes empty bytes)", () =>
		Effect.gen(function* () {
			// 0x80 is the RLP encoding of an empty byte string.
			// formatRlpDecoded should handle the empty Uint8Array via the
			// Uint8Array branch or BrandedRlp bytes branch, yielding "0x".
			const result = yield* fromRlpHandler("0x80")
			expect(result).toBe("0x")
		}),
	)

	it.effect("decodes RLP with BrandedRlp 'bytes' type for longer data (>= 56 bytes)", () =>
		Effect.gen(function* () {
			// Encode a 56-byte payload (triggers long-string RLP prefix 0xb838).
			// On decode, the BrandedRlp should have type "bytes" with a Uint8Array value.
			const payload = `0x${"cc".repeat(56)}`
			const encoded = yield* toRlpHandler([payload])
			const decoded = yield* fromRlpHandler(encoded)
			expect(decoded).toBe(payload)
		}),
	)
})

// ============================================================================
// toRlpHandler — RLP encode failure catchAll (lines 549-554)
// ============================================================================

describe("toRlpHandler — encode edge cases and error paths", () => {
	it.effect("fails with InvalidHexError on odd-length hex '0xabc'", () =>
		Effect.gen(function* () {
			// "0xabc" is 3 hex chars after prefix — odd-length.
			// Hex.toBytes should reject this before Rlp.encode is reached,
			// producing an InvalidHexError from the Effect.try catch.
			const result = yield* toRlpHandler(["0xabc"]).pipe(Effect.either)
			expect(Either.isLeft(result)).toBe(true)
			if (Either.isLeft(result)) {
				expect(result.left._tag).toBe("InvalidHexError")
				expect(result.left.message).toContain("Invalid hex data")
			}
		}),
	)

	it.effect("encodes and round-trips a list of empty byte strings", () =>
		Effect.gen(function* () {
			// Multiple empty hex values — each 0x encodes to the RLP empty string (0x80).
			// This exercises the list-encoding path with edge-case empty inputs.
			const encoded = yield* toRlpHandler(["0x", "0x", "0x"])
			expect(encoded).toMatch(/^0x/)
			// Round-trip: decode should produce a JSON array with 3 empty hex strings
			const decoded = yield* fromRlpHandler(encoded)
			const parsed = JSON.parse(decoded)
			expect(Array.isArray(parsed)).toBe(true)
			expect(parsed).toHaveLength(3)
			for (const item of parsed) {
				expect(item).toBe("0x")
			}
		}),
	)
})
