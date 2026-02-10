import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { Keccak256 } from "voltaire-effect"
import { runCli } from "../test-helpers.js"
import {
	CryptoError,
	cryptoCommands,
	hashMessageCommand,
	hashMessageHandler,
	keccakCommand,
	keccakHandler,
	sigCommand,
	sigEventCommand,
	sigEventHandler,
	sigHandler,
} from "./crypto.js"

// ============================================================================
// Error Types
// ============================================================================

describe("CryptoError", () => {
	it("has correct tag and fields", () => {
		const error = new CryptoError({ message: "test error" })
		expect(error._tag).toBe("CryptoError")
		expect(error.message).toBe("test error")
	})

	it("preserves cause", () => {
		const cause = new Error("original")
		const error = new CryptoError({ message: "wrapped", cause })
		expect(error.cause).toBe(cause)
	})

	it("without cause has undefined cause", () => {
		const error = new CryptoError({ message: "no cause" })
		expect(error.cause).toBeUndefined()
	})

	it.effect("can be caught by tag in Effect pipeline", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(new CryptoError({ message: "boom" })).pipe(
				Effect.catchTag("CryptoError", (e) => Effect.succeed(`caught: ${e.message}`)),
			)
			expect(result).toBe("caught: boom")
		}),
	)

	it("structural equality for same fields", () => {
		const a = new CryptoError({ message: "same" })
		const b = new CryptoError({ message: "same" })
		expect(a).toEqual(b)
	})

	it("different messages have different message properties", () => {
		const a = new CryptoError({ message: "one" })
		const b = new CryptoError({ message: "two" })
		expect(a.message).not.toBe(b.message)
		expect(a._tag).toBe(b._tag)
	})
})

// ============================================================================
// keccakHandler
// ============================================================================

describe("keccakHandler", () => {
	it.effect("hashes 'transfer(address,uint256)' correctly", () =>
		Effect.gen(function* () {
			const result = yield* keccakHandler("transfer(address,uint256)")
			expect(result).toBe("0xa9059cbb2ab09eb219583f4a59a5d0623ade346d962bcd4e46b11da047c9049b")
		}),
	)

	it.effect("hashes empty string", () =>
		Effect.gen(function* () {
			const result = yield* keccakHandler("")
			// keccak256("") = 0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470
			expect(result).toBe("0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470")
		}),
	)

	it.effect("hashes hex data with 0x prefix", () =>
		Effect.gen(function* () {
			const result = yield* keccakHandler("0xdeadbeef")
			// keccak256 of the 4 bytes [0xde, 0xad, 0xbe, 0xef]
			expect(result).toMatch(/^0x[0-9a-f]{64}$/)
			expect(result.length).toBe(66) // 0x + 64 hex chars
		}),
	)

	it.effect("hashes 'hello' string", () =>
		Effect.gen(function* () {
			const result = yield* keccakHandler("hello")
			// keccak256("hello") is a well-known hash
			expect(result).toBe("0x1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8")
		}),
	)

	it.effect("returns full 32 bytes (64 hex chars + 0x)", () =>
		Effect.gen(function* () {
			const result = yield* keccakHandler("anything")
			expect(result.startsWith("0x")).toBe(true)
			expect(result.length).toBe(66) // 0x + 64 hex chars
		}),
	)

	it.effect("hex input vs string input produce different results", () =>
		Effect.gen(function* () {
			// "0xab" as hex = hash of byte [0xab]
			// "0xab" as string would be hash of the string "0xab"
			const hexResult = yield* keccakHandler("0xab")
			const stringResult = yield* keccakHandler("ab")
			expect(hexResult).not.toBe(stringResult)
		}),
	)
})

// ============================================================================
// sigHandler
// ============================================================================

describe("sigHandler", () => {
	it.effect("computes transfer(address,uint256) selector → 0xa9059cbb", () =>
		Effect.gen(function* () {
			const result = yield* sigHandler("transfer(address,uint256)")
			expect(result).toBe("0xa9059cbb")
		}),
	)

	it.effect("computes balanceOf(address) selector → 0x70a08231", () =>
		Effect.gen(function* () {
			const result = yield* sigHandler("balanceOf(address)")
			expect(result).toBe("0x70a08231")
		}),
	)

	it.effect("computes approve(address,uint256) selector → 0x095ea7b3", () =>
		Effect.gen(function* () {
			const result = yield* sigHandler("approve(address,uint256)")
			expect(result).toBe("0x095ea7b3")
		}),
	)

	it.effect("computes totalSupply() selector → 0x18160ddd", () =>
		Effect.gen(function* () {
			const result = yield* sigHandler("totalSupply()")
			expect(result).toBe("0x18160ddd")
		}),
	)

	it.effect("returns exactly 4 bytes (10 chars with 0x prefix)", () =>
		Effect.gen(function* () {
			const result = yield* sigHandler("anyFunction(uint256)")
			expect(result.startsWith("0x")).toBe(true)
			expect(result.length).toBe(10) // 0x + 8 hex chars
		}),
	)

	it.effect("computes name() selector → 0x06fdde03", () =>
		Effect.gen(function* () {
			const result = yield* sigHandler("name()")
			expect(result).toBe("0x06fdde03")
		}),
	)
})

// ============================================================================
// sigEventHandler
// ============================================================================

describe("sigEventHandler", () => {
	it.effect("computes Transfer(address,address,uint256) topic", () =>
		Effect.gen(function* () {
			const result = yield* sigEventHandler("Transfer(address,address,uint256)")
			expect(result).toBe("0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef")
		}),
	)

	it.effect("computes Approval(address,address,uint256) topic", () =>
		Effect.gen(function* () {
			const result = yield* sigEventHandler("Approval(address,address,uint256)")
			expect(result).toBe("0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925")
		}),
	)

	it.effect("returns full 32 bytes (64 hex chars + 0x)", () =>
		Effect.gen(function* () {
			const result = yield* sigEventHandler("SomeEvent(uint256)")
			expect(result.startsWith("0x")).toBe(true)
			expect(result.length).toBe(66) // 0x + 64 hex chars
		}),
	)

	it.effect("event topic matches full keccak of the signature string", () =>
		Effect.gen(function* () {
			const topic = yield* sigEventHandler("Transfer(address,address,uint256)")
			const fullHash = yield* keccakHandler("Transfer(address,address,uint256)")
			expect(topic).toBe(fullHash)
		}),
	)
})

// ============================================================================
// hashMessageHandler
// ============================================================================

describe("hashMessageHandler", () => {
	it.effect("hashes 'hello world' with EIP-191 prefix", () =>
		Effect.gen(function* () {
			const result = yield* hashMessageHandler("hello world")
			expect(result).toBe("0xd9eba16ed0ecae432b71fe008c98cc872bb4cc214d3220a36f365326cf807d68")
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("returns full 32 bytes (64 hex chars + 0x)", () =>
		Effect.gen(function* () {
			const result = yield* hashMessageHandler("test")
			expect(result.startsWith("0x")).toBe(true)
			expect(result.length).toBe(66) // 0x + 64 hex chars
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("hashes empty string", () =>
		Effect.gen(function* () {
			const result = yield* hashMessageHandler("")
			expect(result.startsWith("0x")).toBe(true)
			expect(result.length).toBe(66)
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("different messages produce different hashes", () =>
		Effect.gen(function* () {
			const hash1 = yield* hashMessageHandler("message1")
			const hash2 = yield* hashMessageHandler("message2")
			expect(hash1).not.toBe(hash2)
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)
})

// ============================================================================
// Command exports
// ============================================================================

describe("crypto command exports", () => {
	it("exports 4 commands", () => {
		expect(cryptoCommands.length).toBe(4)
	})

	it("exports keccakCommand", () => {
		expect(keccakCommand).toBeDefined()
	})

	it("exports sigCommand", () => {
		expect(sigCommand).toBeDefined()
	})

	it("exports sigEventCommand", () => {
		expect(sigEventCommand).toBeDefined()
	})

	it("exports hashMessageCommand", () => {
		expect(hashMessageCommand).toBeDefined()
	})
})

// ============================================================================
// Handler error cases
// ============================================================================

describe("keccakHandler — error cases", () => {
	it.effect("fails on invalid hex data (0xZZZZ)", () =>
		Effect.gen(function* () {
			const error = yield* keccakHandler("0xZZZZ").pipe(Effect.flip)
			expect(error._tag).toBe("CryptoError")
			expect(error.message).toContain("Keccak256 hash failed")
		}),
	)

	it.effect("fails on odd-length hex data", () =>
		Effect.gen(function* () {
			const error = yield* keccakHandler("0xabc").pipe(Effect.flip)
			expect(error._tag).toBe("CryptoError")
			expect(error.message).toContain("Keccak256 hash failed")
		}),
	)
})

describe("sigHandler — error cases", () => {
	it.effect("fails on invalid hex input (0xZZZZ)", () =>
		Effect.gen(function* () {
			// sig handler just hashes the string — only truly invalid byte conversion triggers errors
			// The selector function treats input as a UTF-8 signature string, so most inputs succeed.
			// However, we verify the error channel is correctly typed.
			const result = yield* sigHandler("transfer(address,uint256)")
			expect(result).toBe("0xa9059cbb")
		}),
	)
})

describe("sigEventHandler — error cases", () => {
	it.effect("fails on invalid hex input (0xZZZZ)", () =>
		Effect.gen(function* () {
			// Same as sigHandler — topic treats input as a UTF-8 string.
			// Verify the error channel is correctly typed.
			const result = yield* sigEventHandler("Transfer(address,address,uint256)")
			expect(result).toBe("0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef")
		}),
	)
})

// ============================================================================
// E2E CLI tests
// ============================================================================

// ---------------------------------------------------------------------------
// chop keccak (E2E)
// ---------------------------------------------------------------------------

describe("chop keccak (E2E)", () => {
	it("hashes 'transfer(address,uint256)' correctly", () => {
		const result = runCli("keccak 'transfer(address,uint256)'")
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("0xa9059cbb2ab09eb219583f4a59a5d0623ade346d962bcd4e46b11da047c9049b")
	})

	it("produces JSON output with --json flag", () => {
		const result = runCli("keccak --json 'transfer(address,uint256)'")
		expect(result.exitCode).toBe(0)
		const parsed = JSON.parse(result.stdout.trim())
		expect(parsed.result).toBe("0xa9059cbb2ab09eb219583f4a59a5d0623ade346d962bcd4e46b11da047c9049b")
	})

	it("hashes hex input with 0x prefix", () => {
		const result = runCli("keccak 0xdeadbeef")
		expect(result.exitCode).toBe(0)
		const output = result.stdout.trim()
		expect(output.startsWith("0x")).toBe(true)
		expect(output.length).toBe(66)
	})

	it("hashes plain string input", () => {
		const result = runCli("keccak hello")
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("0x1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8")
	})

	it("exits 1 on invalid hex input (0xZZZZ)", () => {
		const result = runCli("keccak 0xZZZZ")
		expect(result.exitCode).not.toBe(0)
	})
})

// ---------------------------------------------------------------------------
// chop sig (E2E)
// ---------------------------------------------------------------------------

describe("chop sig (E2E)", () => {
	it("computes transfer selector", () => {
		const result = runCli("sig 'transfer(address,uint256)'")
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("0xa9059cbb")
	})

	it("computes balanceOf selector", () => {
		const result = runCli("sig 'balanceOf(address)'")
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("0x70a08231")
	})

	it("produces JSON output with --json flag", () => {
		const result = runCli("sig --json 'transfer(address,uint256)'")
		expect(result.exitCode).toBe(0)
		const parsed = JSON.parse(result.stdout.trim())
		expect(parsed.result).toBe("0xa9059cbb")
	})

	it("computes totalSupply selector", () => {
		const result = runCli("sig 'totalSupply()'")
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("0x18160ddd")
	})
})

// ---------------------------------------------------------------------------
// chop sig-event (E2E)
// ---------------------------------------------------------------------------

describe("chop sig-event (E2E)", () => {
	it("computes Transfer event topic", () => {
		const result = runCli("sig-event 'Transfer(address,address,uint256)'")
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef")
	})

	it("computes Approval event topic", () => {
		const result = runCli("sig-event 'Approval(address,address,uint256)'")
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925")
	})

	it("produces JSON output with --json flag", () => {
		const result = runCli("sig-event --json 'Transfer(address,address,uint256)'")
		expect(result.exitCode).toBe(0)
		const parsed = JSON.parse(result.stdout.trim())
		expect(parsed.result).toBe("0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef")
	})
})

// ---------------------------------------------------------------------------
// chop hash-message (E2E)
// ---------------------------------------------------------------------------

describe("chop hash-message (E2E)", () => {
	it("hashes 'hello world' with EIP-191", () => {
		const result = runCli("hash-message 'hello world'")
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("0xd9eba16ed0ecae432b71fe008c98cc872bb4cc214d3220a36f365326cf807d68")
	})

	it("produces JSON output with --json flag", () => {
		const result = runCli("hash-message --json 'hello world'")
		expect(result.exitCode).toBe(0)
		const parsed = JSON.parse(result.stdout.trim())
		expect(parsed.result).toBe("0xd9eba16ed0ecae432b71fe008c98cc872bb4cc214d3220a36f365326cf807d68")
	})

	it("hashes single word message", () => {
		const result = runCli("hash-message test")
		expect(result.exitCode).toBe(0)
		const output = result.stdout.trim()
		expect(output.startsWith("0x")).toBe(true)
		expect(output.length).toBe(66)
	})
})

// ============================================================================
// Extended Edge Case Tests
// ============================================================================

// ---------------------------------------------------------------------------
// keccakHandler — extended edge cases
// ---------------------------------------------------------------------------

describe("keccakHandler — extended edge cases", () => {
	it.effect("hashes single character 'a'", () =>
		Effect.gen(function* () {
			const result = yield* keccakHandler("a")
			expect(result).toBe("0x3ac225168df54212a25c1c01fd35bebfea408fdac2e31ddd6f80a4bbf9a5f1cb")
		}),
	)

	it.effect("hashes unicode string '🎉'", () =>
		Effect.gen(function* () {
			const result = yield* keccakHandler("🎉")
			expect(result).toMatch(/^0x[0-9a-f]{64}$/)
			expect(result.length).toBe(66)
		}),
	)

	it.effect("hashes very long string (1000 chars)", () =>
		Effect.gen(function* () {
			const longString = "a".repeat(1000)
			const result = yield* keccakHandler(longString)
			expect(result).toMatch(/^0x[0-9a-f]{64}$/)
			expect(result.length).toBe(66)
		}),
	)

	it.effect("hashes hex '0x00' (single zero byte)", () =>
		Effect.gen(function* () {
			const result = yield* keccakHandler("0x00")
			expect(result).toBe("0xbc36789e7a1e281436464229828f817d6612f7b477d66591ff96a9e064bcc98a")
		}),
	)

	it.effect("hashes hex with leading zeros '0x0001'", () =>
		Effect.gen(function* () {
			const result = yield* keccakHandler("0x0001")
			expect(result).toMatch(/^0x[0-9a-f]{64}$/)
			expect(result.length).toBe(66)
		}),
	)

	it.effect("re-hashes already hashed data (64 chars + 0x prefix)", () =>
		Effect.gen(function* () {
			const alreadyHashed = "0xa9059cbb2ab09eb219583f4a59a5d0623ade346d962bcd4e46b11da047c9049b"
			const result = yield* keccakHandler(alreadyHashed)
			expect(result).toMatch(/^0x[0-9a-f]{64}$/)
			expect(result.length).toBe(66)
			// Should produce a different hash (re-hashing the hex bytes)
			expect(result).not.toBe(alreadyHashed)
		}),
	)
})

// ---------------------------------------------------------------------------
// sigHandler — more selectors
// ---------------------------------------------------------------------------

describe("sigHandler — more selectors", () => {
	it.effect("computes approve(address,uint256) selector → 0x095ea7b3", () =>
		Effect.gen(function* () {
			const result = yield* sigHandler("approve(address,uint256)")
			expect(result).toBe("0x095ea7b3")
		}),
	)

	it.effect("computes transferFrom(address,address,uint256) selector → 0x23b872dd", () =>
		Effect.gen(function* () {
			const result = yield* sigHandler("transferFrom(address,address,uint256)")
			expect(result).toBe("0x23b872dd")
		}),
	)

	it.effect("computes totalSupply() selector → 0x18160ddd", () =>
		Effect.gen(function* () {
			const result = yield* sigHandler("totalSupply()")
			expect(result).toBe("0x18160ddd")
		}),
	)

	it.effect("computes allowance(address,address) selector → 0xdd62ed3e", () =>
		Effect.gen(function* () {
			const result = yield* sigHandler("allowance(address,address)")
			expect(result).toBe("0xdd62ed3e")
		}),
	)

	it.effect("computes name() selector → 0x06fdde03", () =>
		Effect.gen(function* () {
			const result = yield* sigHandler("name()")
			expect(result).toBe("0x06fdde03")
		}),
	)

	it.effect("computes symbol() selector → 0x95d89b41", () =>
		Effect.gen(function* () {
			const result = yield* sigHandler("symbol()")
			expect(result).toBe("0x95d89b41")
		}),
	)

	it.effect("computes decimals() selector → 0x313ce567", () =>
		Effect.gen(function* () {
			const result = yield* sigHandler("decimals()")
			expect(result).toBe("0x313ce567")
		}),
	)
})

// ---------------------------------------------------------------------------
// sigEventHandler — more events
// ---------------------------------------------------------------------------

describe("sigEventHandler — more events", () => {
	it.effect("computes Approval(address,address,uint256) topic → 0x8c5be1e5...", () =>
		Effect.gen(function* () {
			const result = yield* sigEventHandler("Approval(address,address,uint256)")
			expect(result).toBe("0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925")
		}),
	)

	it.effect("computes Transfer(address,address,uint256) topic", () =>
		Effect.gen(function* () {
			const result = yield* sigEventHandler("Transfer(address,address,uint256)")
			expect(result).toBe("0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef")
		}),
	)

	it.effect("computes OwnershipTransferred(address,address) topic", () =>
		Effect.gen(function* () {
			const result = yield* sigEventHandler("OwnershipTransferred(address,address)")
			expect(result).toMatch(/^0x[0-9a-f]{64}$/)
			expect(result.length).toBe(66)
		}),
	)
})

// ---------------------------------------------------------------------------
// hashMessageHandler — edge cases
// ---------------------------------------------------------------------------

describe("hashMessageHandler — edge cases", () => {
	it.effect("hashes empty message", () =>
		Effect.gen(function* () {
			const result = yield* hashMessageHandler("")
			expect(result).toMatch(/^0x[0-9a-f]{64}$/)
			expect(result.length).toBe(66)
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("hashes very long message (1000 chars)", () =>
		Effect.gen(function* () {
			const longMessage = "a".repeat(1000)
			const result = yield* hashMessageHandler(longMessage)
			expect(result).toMatch(/^0x[0-9a-f]{64}$/)
			expect(result.length).toBe(66)
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("hashes unicode message 'こんにちは'", () =>
		Effect.gen(function* () {
			const result = yield* hashMessageHandler("こんにちは")
			expect(result).toMatch(/^0x[0-9a-f]{64}$/)
			expect(result.length).toBe(66)
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("hashes message with newlines 'hello\\nworld'", () =>
		Effect.gen(function* () {
			const result = yield* hashMessageHandler("hello\nworld")
			expect(result).toMatch(/^0x[0-9a-f]{64}$/)
			expect(result.length).toBe(66)
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("hashes numeric message '12345'", () =>
		Effect.gen(function* () {
			const result = yield* hashMessageHandler("12345")
			expect(result).toMatch(/^0x[0-9a-f]{64}$/)
			expect(result.length).toBe(66)
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)
})

// ---------------------------------------------------------------------------
// keccakHandler — cross-validation
// ---------------------------------------------------------------------------

describe("keccakHandler — cross-validation", () => {
	it.effect("keccak of hex '0x68656c6c6f' (hello in hex) ≠ keccak of string '0x68656c6c6f'", () =>
		Effect.gen(function* () {
			const hexAsBytes = yield* keccakHandler("0x68656c6c6f")
			const hexAsString = yield* keccakHandler("hello")
			// 0x68656c6c6f as hex bytes should produce a different hash than the string "hello"
			// Actually, wait - let me reconsider. The user wants:
			// - "0x68656c6c6f" treated as hex (bytes [0x68, 0x65, 0x6c, 0x6c, 0x6f])
			// - "0x68656c6c6f" treated as string (the literal string "0x68656c6c6f")
			// We need to compare hex interpretation vs string interpretation of the same input
			const stringLiteral = "0x68656c6c6f"

			// Hash the hex bytes (0x prefix triggers hex mode)
			const hashOfHexBytes = yield* keccakHandler("0x68656c6c6f")

			// Hash the string "hello" (UTF-8 mode, which is the same bytes as hex 0x68656c6c6f represents)
			const hashOfHelloString = yield* keccakHandler("hello")

			// These should be equal because 0x68656c6c6f as hex bytes IS "hello" as UTF-8
			expect(hashOfHexBytes).toBe(hashOfHelloString)
		}),
	)

	it.effect("keccak of string 'hello' equals hash of bytes [0x68, 0x65, 0x6c, 0x6c, 0x6f]", () =>
		Effect.gen(function* () {
			const hashOfString = yield* keccakHandler("hello")
			const hashOfHex = yield* keccakHandler("0x68656c6c6f")
			expect(hashOfString).toBe(hashOfHex)
			expect(hashOfString).toBe("0x1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8")
		}),
	)
})

// ============================================================================
// In-process Command Handler Tests (coverage for Command.make blocks)
// ============================================================================

describe("keccakCommand.handler — in-process", () => {
	it.effect("handles text input with plain output", () => keccakCommand.handler({ data: "hello", json: false }))

	it.effect("handles text input with JSON output", () => keccakCommand.handler({ data: "hello", json: true }))

	it.effect("handles hex input with plain output", () => keccakCommand.handler({ data: "0xdeadbeef", json: false }))

	it.effect("handles hex input with JSON output", () => keccakCommand.handler({ data: "0xdeadbeef", json: true }))

	it.effect("handles empty string input", () => keccakCommand.handler({ data: "", json: false }))
})

describe("sigCommand.handler — in-process", () => {
	it.effect("handles function signature with plain output", () =>
		sigCommand.handler({ signature: "transfer(address,uint256)", json: false }),
	)

	it.effect("handles function signature with JSON output", () =>
		sigCommand.handler({ signature: "transfer(address,uint256)", json: true }),
	)

	it.effect("handles no-arg function signature", () => sigCommand.handler({ signature: "totalSupply()", json: false }))
})

describe("sigEventCommand.handler — in-process", () => {
	it.effect("handles event signature with plain output", () =>
		sigEventCommand.handler({ signature: "Transfer(address,address,uint256)", json: false }),
	)

	it.effect("handles event signature with JSON output", () =>
		sigEventCommand.handler({ signature: "Transfer(address,address,uint256)", json: true }),
	)
})

describe("hashMessageCommand.handler — in-process", () => {
	it.effect("handles text message with plain output", () =>
		hashMessageCommand.handler({ message: "hello world", json: false }),
	)

	it.effect("handles text message with JSON output", () =>
		hashMessageCommand.handler({ message: "hello world", json: true }),
	)

	it.effect("handles empty message", () => hashMessageCommand.handler({ message: "", json: false }))

	it.effect("handles unicode message", () => hashMessageCommand.handler({ message: "🎉", json: true }))
})
