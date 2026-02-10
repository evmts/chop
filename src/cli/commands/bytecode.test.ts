import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { afterEach, expect, vi } from "vitest"
import { runCli } from "../test-helpers.js"
import {
	InvalidBytecodeError,
	SelectorLookupError,
	bytecodeCommands,
	disassembleCommand,
	disassembleHandler,
	fourByteCommand,
	fourByteEventCommand,
	fourByteEventHandler,
	fourByteHandler,
} from "./bytecode.js"

// Fetch type for mocking (not in ES2022 lib)
type FetchFn = (
	url: string,
) => Promise<{ ok: boolean; status: number; statusText: string; json: () => Promise<unknown> }>

/** Typed access to _global.fetch for mocking purposes */
const _global = globalThis as unknown as { fetch: FetchFn }

// ============================================================================
// Error Types
// ============================================================================

describe("InvalidBytecodeError", () => {
	it("has correct tag and fields", () => {
		const error = new InvalidBytecodeError({ message: "bad hex", data: "0xZZ" })
		expect(error._tag).toBe("InvalidBytecodeError")
		expect(error.message).toBe("bad hex")
		expect(error.data).toBe("0xZZ")
	})

	it.effect("can be caught by tag in Effect pipeline", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(new InvalidBytecodeError({ message: "boom", data: "0x" })).pipe(
				Effect.catchTag("InvalidBytecodeError", (e) => Effect.succeed(`caught: ${e.message}`)),
			)
			expect(result).toBe("caught: boom")
		}),
	)

	it("structural equality for same fields", () => {
		const a = new InvalidBytecodeError({ message: "same", data: "0x" })
		const b = new InvalidBytecodeError({ message: "same", data: "0x" })
		expect(a).toEqual(b)
	})
})

describe("SelectorLookupError", () => {
	it("has correct tag and fields", () => {
		const error = new SelectorLookupError({ message: "lookup failed", selector: "0xa9059cbb" })
		expect(error._tag).toBe("SelectorLookupError")
		expect(error.message).toBe("lookup failed")
		expect(error.selector).toBe("0xa9059cbb")
	})

	it("preserves cause", () => {
		const cause = new Error("network")
		const error = new SelectorLookupError({ message: "failed", selector: "0x00", cause })
		expect(error.cause).toBe(cause)
	})

	it("without cause has undefined cause", () => {
		const error = new SelectorLookupError({ message: "no cause", selector: "0x00" })
		expect(error.cause).toBeUndefined()
	})

	it.effect("can be caught by tag in Effect pipeline", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(new SelectorLookupError({ message: "boom", selector: "0x00" })).pipe(
				Effect.catchTag("SelectorLookupError", (e) => Effect.succeed(`caught: ${e.message}`)),
			)
			expect(result).toBe("caught: boom")
		}),
	)

	it("structural equality for same fields", () => {
		const a = new SelectorLookupError({ message: "same", selector: "0x00" })
		const b = new SelectorLookupError({ message: "same", selector: "0x00" })
		expect(a).toEqual(b)
	})
})

// ============================================================================
// disassembleHandler
// ============================================================================

describe("disassembleHandler", () => {
	it.effect("disassembles 0x6080604052 → 3 instructions (PUSH1, PUSH1, MSTORE)", () =>
		Effect.gen(function* () {
			const result = yield* disassembleHandler("0x6080604052")
			expect(result).toHaveLength(3)

			expect(result[0]).toEqual({ pc: 0, opcode: "0x60", name: "PUSH1", pushData: "0x80" })
			expect(result[1]).toEqual({ pc: 2, opcode: "0x60", name: "PUSH1", pushData: "0x40" })
			expect(result[2]).toEqual({ pc: 4, opcode: "0x52", name: "MSTORE" })
		}),
	)

	it.effect("returns empty array for empty bytecode '0x'", () =>
		Effect.gen(function* () {
			const result = yield* disassembleHandler("0x")
			expect(result).toEqual([])
		}),
	)

	it.effect("disassembles single STOP opcode '0x00'", () =>
		Effect.gen(function* () {
			const result = yield* disassembleHandler("0x00")
			expect(result).toHaveLength(1)
			expect(result[0]).toEqual({ pc: 0, opcode: "0x00", name: "STOP" })
		}),
	)

	it.effect("disassembles PUSH1 with data", () =>
		Effect.gen(function* () {
			const result = yield* disassembleHandler("0x60ff")
			expect(result).toHaveLength(1)
			expect(result[0]).toEqual({ pc: 0, opcode: "0x60", name: "PUSH1", pushData: "0xff" })
		}),
	)

	it.effect("disassembles PUSH2 with 2 bytes of data", () =>
		Effect.gen(function* () {
			const result = yield* disassembleHandler("0x61aabb")
			expect(result).toHaveLength(1)
			expect(result[0]).toEqual({ pc: 0, opcode: "0x61", name: "PUSH2", pushData: "0xaabb" })
		}),
	)

	it.effect("disassembles PUSH32 with 32 bytes of data", () =>
		Effect.gen(function* () {
			const data = "aa".repeat(32)
			const result = yield* disassembleHandler(`0x7f${data}`)
			expect(result).toHaveLength(1)
			expect(result[0]?.name).toBe("PUSH32")
			expect(result[0]?.pushData).toBe(`0x${data}`)
			expect(result[0]?.pc).toBe(0)
		}),
	)

	it.effect("handles truncated PUSH at end of bytecode", () =>
		Effect.gen(function* () {
			// PUSH2 (0x61) needs 2 bytes but only 1 available
			const result = yield* disassembleHandler("0x61ff")
			expect(result).toHaveLength(1)
			expect(result[0]?.name).toBe("PUSH2")
			expect(result[0]?.pushData).toBe("0xff") // Only 1 byte instead of 2
		}),
	)

	it.effect("handles truncated PUSH with no data bytes", () =>
		Effect.gen(function* () {
			// PUSH1 (0x60) needs 1 byte but none available
			const result = yield* disassembleHandler("0x60")
			expect(result).toHaveLength(1)
			expect(result[0]?.name).toBe("PUSH1")
			expect(result[0]?.pushData).toBe("0x") // No data
		}),
	)

	it.effect("disassembles DUP1-DUP16 correctly", () =>
		Effect.gen(function* () {
			const result = yield* disassembleHandler("0x80") // DUP1
			expect(result[0]?.name).toBe("DUP1")

			const result16 = yield* disassembleHandler("0x8f") // DUP16
			expect(result16[0]?.name).toBe("DUP16")
		}),
	)

	it.effect("disassembles SWAP1-SWAP16 correctly", () =>
		Effect.gen(function* () {
			const result = yield* disassembleHandler("0x90") // SWAP1
			expect(result[0]?.name).toBe("SWAP1")

			const result16 = yield* disassembleHandler("0x9f") // SWAP16
			expect(result16[0]?.name).toBe("SWAP16")
		}),
	)

	it.effect("disassembles LOG0-LOG4 correctly", () =>
		Effect.gen(function* () {
			const result = yield* disassembleHandler("0xa0") // LOG0
			expect(result[0]?.name).toBe("LOG0")

			const result4 = yield* disassembleHandler("0xa4") // LOG4
			expect(result4[0]?.name).toBe("LOG4")
		}),
	)

	it.effect("formats unknown opcodes as UNKNOWN(0xNN)", () =>
		Effect.gen(function* () {
			const result = yield* disassembleHandler("0x0c") // Not a defined opcode
			expect(result[0]?.name).toBe("UNKNOWN(0x0c)")
		}),
	)

	it.effect("disassembles PUSH0 (0x5f) without data", () =>
		Effect.gen(function* () {
			const result = yield* disassembleHandler("0x5f")
			expect(result).toHaveLength(1)
			expect(result[0]?.name).toBe("PUSH0")
			expect(result[0]?.pushData).toBeUndefined() // PUSH0 has no immediate data
		}),
	)

	it.effect("tracks PC offsets correctly through PUSH instructions", () =>
		Effect.gen(function* () {
			// PUSH2 0xAABB (3 bytes) + STOP (1 byte)
			const result = yield* disassembleHandler("0x61aabb00")
			expect(result).toHaveLength(2)
			expect(result[0]?.pc).toBe(0) // PUSH2
			expect(result[1]?.pc).toBe(3) // STOP after 1 opcode + 2 data bytes
		}),
	)

	it.effect("disassembles common system opcodes", () =>
		Effect.gen(function* () {
			const result = yield* disassembleHandler("0xf0f1f2f3f4f5fafdfeff")
			const names = result.map((i) => i.name)
			expect(names).toEqual([
				"CREATE",
				"CALL",
				"CALLCODE",
				"RETURN",
				"DELEGATECALL",
				"CREATE2",
				"STATICCALL",
				"REVERT",
				"INVALID",
				"SELFDESTRUCT",
			])
		}),
	)

	it.effect("disassembles arithmetic opcodes", () =>
		Effect.gen(function* () {
			const result = yield* disassembleHandler("0x0001020304050607080900")
			const names = result.map((i) => i.name)
			expect(names).toEqual(["STOP", "ADD", "MUL", "SUB", "DIV", "SDIV", "MOD", "SMOD", "ADDMOD", "MULMOD", "STOP"])
		}),
	)

	it.effect("handles uppercase hex input", () =>
		Effect.gen(function* () {
			const result = yield* disassembleHandler("0x6080604052")
			const resultUpper = yield* disassembleHandler("0x6080604052".toUpperCase())
			// Should produce same instructions
			expect(result).toEqual(resultUpper)
		}),
	)
})

// ============================================================================
// disassembleHandler — error cases
// ============================================================================

describe("disassembleHandler — error cases", () => {
	it.effect("fails on missing 0x prefix", () =>
		Effect.gen(function* () {
			const error = yield* disassembleHandler("6080604052").pipe(Effect.flip)
			expect(error._tag).toBe("InvalidBytecodeError")
			expect(error.message).toContain("Bytecode must start with 0x")
			expect(error.data).toBe("6080604052")
		}),
	)

	it.effect("fails on invalid hex characters", () =>
		Effect.gen(function* () {
			const error = yield* disassembleHandler("0xZZZZ").pipe(Effect.flip)
			expect(error._tag).toBe("InvalidBytecodeError")
			expect(error.message).toContain("Invalid hex characters")
			expect(error.data).toBe("0xZZZZ")
		}),
	)

	it.effect("fails on odd-length hex string", () =>
		Effect.gen(function* () {
			const error = yield* disassembleHandler("0xabc").pipe(Effect.flip)
			expect(error._tag).toBe("InvalidBytecodeError")
			expect(error.message).toContain("Odd-length hex string")
			expect(error.data).toBe("0xabc")
		}),
	)
})

// ============================================================================
// fourByteHandler (with mocked fetch)
// ============================================================================

describe("fourByteHandler", () => {
	const originalFetch = _global.fetch

	afterEach(() => {
		_global.fetch = originalFetch
	})

	it.effect("returns signatures for known selector 0xa9059cbb", () => {
		_global.fetch = vi.fn().mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				ok: true,
				result: {
					function: {
						"0xa9059cbb": [{ name: "transfer(address,uint256)" }],
					},
				},
			}),
		}) as FetchFn

		return Effect.gen(function* () {
			const result = yield* fourByteHandler("0xa9059cbb")
			expect(result).toEqual(["transfer(address,uint256)"])
		})
	})

	it.effect("returns multiple signatures when available", () => {
		_global.fetch = vi.fn().mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				ok: true,
				result: {
					function: {
						"0x12345678": [{ name: "foo(uint256)" }, { name: "bar(address)" }],
					},
				},
			}),
		}) as FetchFn

		return Effect.gen(function* () {
			const result = yield* fourByteHandler("0x12345678")
			expect(result).toEqual(["foo(uint256)", "bar(address)"])
		})
	})

	it.effect("returns empty array when no signatures found", () => {
		_global.fetch = vi.fn().mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				ok: true,
				result: {
					function: {
						"0xdeadbeef": null,
					},
				},
			}),
		}) as FetchFn

		return Effect.gen(function* () {
			const result = yield* fourByteHandler("0xdeadbeef")
			expect(result).toEqual([])
		})
	})

	it.effect("fails on invalid selector format (too short)", () =>
		Effect.gen(function* () {
			const error = yield* fourByteHandler("0xa905").pipe(Effect.flip)
			expect(error._tag).toBe("SelectorLookupError")
			expect(error.message).toContain("Invalid 4-byte selector")
			expect(error.selector).toBe("0xa905")
		}),
	)

	it.effect("fails on invalid selector format (no 0x prefix)", () =>
		Effect.gen(function* () {
			const error = yield* fourByteHandler("a9059cbb").pipe(Effect.flip)
			expect(error._tag).toBe("SelectorLookupError")
			expect(error.message).toContain("Invalid 4-byte selector")
		}),
	)

	it.effect("fails on invalid selector format (too long)", () =>
		Effect.gen(function* () {
			const error = yield* fourByteHandler("0xa9059cbb00").pipe(Effect.flip)
			expect(error._tag).toBe("SelectorLookupError")
			expect(error.message).toContain("Invalid 4-byte selector")
		}),
	)

	it.effect("fails on network error", () => {
		_global.fetch = vi.fn().mockRejectedValueOnce(new Error("Network error")) as FetchFn

		return Effect.gen(function* () {
			const error = yield* fourByteHandler("0xa9059cbb").pipe(Effect.flip)
			expect(error._tag).toBe("SelectorLookupError")
			expect(error.message).toContain("Signature lookup failed")
			expect(error.cause).toBeInstanceOf(Error)
		})
	})

	it.effect("fails on HTTP error response", () => {
		_global.fetch = vi.fn().mockResolvedValueOnce({
			ok: false,
			status: 500,
			statusText: "Internal Server Error",
		}) as FetchFn

		return Effect.gen(function* () {
			const error = yield* fourByteHandler("0xa9059cbb").pipe(Effect.flip)
			expect(error._tag).toBe("SelectorLookupError")
			expect(error.message).toContain("HTTP 500")
		})
	})

	it.effect("handles uppercase selector", () => {
		_global.fetch = vi.fn().mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				ok: true,
				result: {
					function: {
						"0xa9059cbb": [{ name: "transfer(address,uint256)" }],
					},
				},
			}),
		}) as FetchFn

		return Effect.gen(function* () {
			const result = yield* fourByteHandler("0xA9059CBB")
			expect(result).toEqual(["transfer(address,uint256)"])
		})
	})
})

// ============================================================================
// fourByteEventHandler (with mocked fetch)
// ============================================================================

describe("fourByteEventHandler", () => {
	const originalFetch = _global.fetch

	afterEach(() => {
		_global.fetch = originalFetch
	})

	it.effect("returns signatures for known event topic", () => {
		const topic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
		_global.fetch = vi.fn().mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				ok: true,
				result: {
					event: {
						[topic]: [{ name: "Transfer(address,address,uint256)" }],
					},
				},
			}),
		}) as FetchFn

		return Effect.gen(function* () {
			const result = yield* fourByteEventHandler(topic)
			expect(result).toEqual(["Transfer(address,address,uint256)"])
		})
	})

	it.effect("returns empty array when no event signatures found", () => {
		const topic = `0x${"00".repeat(32)}`
		_global.fetch = vi.fn().mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				ok: true,
				result: {
					event: {
						[topic]: null,
					},
				},
			}),
		}) as FetchFn

		return Effect.gen(function* () {
			const result = yield* fourByteEventHandler(topic)
			expect(result).toEqual([])
		})
	})

	it.effect("fails on invalid topic format (too short)", () =>
		Effect.gen(function* () {
			const error = yield* fourByteEventHandler("0xa9059cbb").pipe(Effect.flip)
			expect(error._tag).toBe("SelectorLookupError")
			expect(error.message).toContain("Invalid event topic")
			expect(error.selector).toBe("0xa9059cbb")
		}),
	)

	it.effect("fails on invalid topic format (no 0x prefix)", () =>
		Effect.gen(function* () {
			const error = yield* fourByteEventHandler("aa".repeat(32)).pipe(Effect.flip)
			expect(error._tag).toBe("SelectorLookupError")
			expect(error.message).toContain("Invalid event topic")
		}),
	)

	it.effect("fails on network error", () => {
		const topic = `0x${"ab".repeat(32)}`
		_global.fetch = vi.fn().mockRejectedValueOnce(new Error("timeout")) as FetchFn

		return Effect.gen(function* () {
			const error = yield* fourByteEventHandler(topic).pipe(Effect.flip)
			expect(error._tag).toBe("SelectorLookupError")
			expect(error.message).toContain("Signature lookup failed")
		})
	})
})

// ============================================================================
// Command exports
// ============================================================================

describe("bytecode command exports", () => {
	it("exports 3 commands", () => {
		expect(bytecodeCommands.length).toBe(3)
	})

	it("exports disassembleCommand", () => {
		expect(disassembleCommand).toBeDefined()
	})

	it("exports fourByteCommand", () => {
		expect(fourByteCommand).toBeDefined()
	})

	it("exports fourByteEventCommand", () => {
		expect(fourByteEventCommand).toBeDefined()
	})
})

// ============================================================================
// In-process Command Handler Tests
// ============================================================================

describe("disassembleCommand.handler — in-process", () => {
	it.effect("handles bytecode with plain output", () =>
		disassembleCommand.handler({ bytecode: "0x6080604052", json: false }),
	)

	it.effect("handles bytecode with JSON output", () =>
		disassembleCommand.handler({ bytecode: "0x6080604052", json: true }),
	)

	it.effect("handles empty bytecode with plain output", () =>
		disassembleCommand.handler({ bytecode: "0x", json: false }),
	)

	it.effect("handles empty bytecode with JSON output", () => disassembleCommand.handler({ bytecode: "0x", json: true }))
})

describe("fourByteCommand.handler — in-process", () => {
	const originalFetch = _global.fetch

	afterEach(() => {
		_global.fetch = originalFetch
	})

	it.effect("handles selector with plain output", () => {
		_global.fetch = vi.fn().mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				ok: true,
				result: { function: { "0xa9059cbb": [{ name: "transfer(address,uint256)" }] } },
			}),
		}) as FetchFn

		return fourByteCommand.handler({ selector: "0xa9059cbb", json: false })
	})

	it.effect("handles selector with JSON output", () => {
		_global.fetch = vi.fn().mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				ok: true,
				result: { function: { "0xa9059cbb": [{ name: "transfer(address,uint256)" }] } },
			}),
		}) as FetchFn

		return fourByteCommand.handler({ selector: "0xa9059cbb", json: true })
	})
})

describe("fourByteEventCommand.handler — in-process", () => {
	const originalFetch = _global.fetch

	afterEach(() => {
		_global.fetch = originalFetch
	})

	it.effect("handles topic with plain output", () => {
		const topic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
		_global.fetch = vi.fn().mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				ok: true,
				result: { event: { [topic]: [{ name: "Transfer(address,address,uint256)" }] } },
			}),
		}) as FetchFn

		return fourByteEventCommand.handler({ topic, json: false })
	})

	it.effect("handles topic with JSON output", () => {
		const topic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
		_global.fetch = vi.fn().mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				ok: true,
				result: { event: { [topic]: [{ name: "Transfer(address,address,uint256)" }] } },
			}),
		}) as FetchFn

		return fourByteEventCommand.handler({ topic, json: true })
	})
})

// ============================================================================
// E2E CLI tests
// ============================================================================

// ---------------------------------------------------------------------------
// chop disassemble (E2E)
// ---------------------------------------------------------------------------

describe("chop disassemble (E2E)", () => {
	it("disassembles 0x6080604052 into opcode listing with PC offsets", () => {
		const result = runCli("disassemble 0x6080604052")
		expect(result.exitCode).toBe(0)
		const lines = result.stdout.trim().split("\n")
		expect(lines).toHaveLength(3)
		expect(lines[0]).toContain("PUSH1")
		expect(lines[0]).toContain("0x80")
		expect(lines[1]).toContain("PUSH1")
		expect(lines[1]).toContain("0x40")
		expect(lines[2]).toContain("MSTORE")
	})

	it("produces JSON output with --json flag", () => {
		const result = runCli("disassemble --json 0x6080604052")
		expect(result.exitCode).toBe(0)
		const parsed = JSON.parse(result.stdout.trim())
		expect(parsed.result).toHaveLength(3)
		expect(parsed.result[0].name).toBe("PUSH1")
		expect(parsed.result[0].pushData).toBe("0x80")
		expect(parsed.result[0].pc).toBe(0)
		expect(parsed.result[1].name).toBe("PUSH1")
		expect(parsed.result[1].pushData).toBe("0x40")
		expect(parsed.result[1].pc).toBe(2)
		expect(parsed.result[2].name).toBe("MSTORE")
		expect(parsed.result[2].pc).toBe(4)
	})

	it("returns empty output for empty bytecode 0x", () => {
		const result = runCli("disassemble 0x")
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("")
	})

	it("returns empty JSON array for empty bytecode 0x with --json", () => {
		const result = runCli("disassemble --json 0x")
		expect(result.exitCode).toBe(0)
		const parsed = JSON.parse(result.stdout.trim())
		expect(parsed.result).toEqual([])
	})

	it("exits non-zero on invalid hex input (0xZZZZ)", () => {
		const result = runCli("disassemble 0xZZZZ")
		expect(result.exitCode).not.toBe(0)
	})

	it("exits non-zero on missing 0x prefix", () => {
		const result = runCli("disassemble 6080604052")
		expect(result.exitCode).not.toBe(0)
	})

	it("disassembles single STOP opcode", () => {
		const result = runCli("disassemble 0x00")
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toContain("STOP")
	})

	it("handles PUSH32 with full data", () => {
		const data = "ab".repeat(32)
		const result = runCli(`disassemble 0x7f${data}`)
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toContain("PUSH32")
		expect(result.stdout.trim()).toContain(`0x${data}`)
	})
})

// ---------------------------------------------------------------------------
// chop 4byte (E2E) — uses real API
// ---------------------------------------------------------------------------

describe("chop 4byte (E2E)", () => {
	it("looks up transfer selector 0xa9059cbb", () => {
		const result = runCli("4byte 0xa9059cbb")
		expect(result.exitCode).toBe(0)
		expect(result.stdout).toContain("transfer(address,uint256)")
	}, 15_000)

	it("produces JSON output with --json flag", () => {
		const result = runCli("4byte --json 0xa9059cbb")
		expect(result.exitCode).toBe(0)
		const parsed = JSON.parse(result.stdout.trim())
		expect(parsed.result).toContain("transfer(address,uint256)")
	}, 15_000)

	it("exits non-zero on invalid selector format", () => {
		const result = runCli("4byte 0xZZZZ")
		expect(result.exitCode).not.toBe(0)
	})

	it("exits non-zero on missing argument", () => {
		const result = runCli("4byte")
		expect(result.exitCode).not.toBe(0)
	})
})

// ---------------------------------------------------------------------------
// chop 4byte-event (E2E) — uses real API
// ---------------------------------------------------------------------------

describe("chop 4byte-event (E2E)", () => {
	it("looks up Transfer event topic", () => {
		const topic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
		const result = runCli(`4byte-event ${topic}`)
		expect(result.exitCode).toBe(0)
		expect(result.stdout).toContain("Transfer(address,address,uint256)")
	}, 15_000)

	it("produces JSON output with --json flag", () => {
		const topic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
		const result = runCli(`4byte-event --json ${topic}`)
		expect(result.exitCode).toBe(0)
		const parsed = JSON.parse(result.stdout.trim())
		expect(parsed.result).toContain("Transfer(address,address,uint256)")
	}, 15_000)

	it("exits non-zero on invalid topic format", () => {
		const result = runCli("4byte-event 0xa9059cbb")
		expect(result.exitCode).not.toBe(0)
	})

	it("exits non-zero on missing argument", () => {
		const result = runCli("4byte-event")
		expect(result.exitCode).not.toBe(0)
	})
})

// ============================================================================
// Additional edge cases
// ============================================================================

describe("disassembleHandler — additional edge cases", () => {
	it.effect("disassembles KECCAK256 (0x20)", () =>
		Effect.gen(function* () {
			const result = yield* disassembleHandler("0x20")
			expect(result[0]?.name).toBe("KECCAK256")
		}),
	)

	it.effect("disassembles environmental opcodes", () =>
		Effect.gen(function* () {
			const result = yield* disassembleHandler("0x30313233343536")
			const names = result.map((i) => i.name)
			expect(names).toEqual(["ADDRESS", "BALANCE", "ORIGIN", "CALLER", "CALLVALUE", "CALLDATALOAD", "CALLDATASIZE"])
		}),
	)

	it.effect("disassembles block info opcodes", () =>
		Effect.gen(function* () {
			const result = yield* disassembleHandler("0x404142434445464748")
			const names = result.map((i) => i.name)
			expect(names).toEqual([
				"BLOCKHASH",
				"COINBASE",
				"TIMESTAMP",
				"NUMBER",
				"PREVRANDAO",
				"GASLIMIT",
				"CHAINID",
				"SELFBALANCE",
				"BASEFEE",
			])
		}),
	)

	it.effect("disassembles stack/memory/flow opcodes", () =>
		Effect.gen(function* () {
			const result = yield* disassembleHandler("0x505152535455565758595a5b")
			const names = result.map((i) => i.name)
			expect(names).toEqual([
				"POP",
				"MLOAD",
				"MSTORE",
				"MSTORE8",
				"SLOAD",
				"SSTORE",
				"JUMP",
				"JUMPI",
				"PC",
				"MSIZE",
				"GAS",
				"JUMPDEST",
			])
		}),
	)

	it.effect("disassembles comparison/bitwise opcodes", () =>
		Effect.gen(function* () {
			const result = yield* disassembleHandler("0x10111213141516171819")
			const names = result.map((i) => i.name)
			expect(names).toEqual(["LT", "GT", "SLT", "SGT", "EQ", "ISZERO", "AND", "OR", "XOR", "NOT"])
		}),
	)

	it.effect("disassembles multiple PUSH instructions with varying sizes", () =>
		Effect.gen(function* () {
			// PUSH1 0xff, PUSH3 0xaabbcc, STOP
			const result = yield* disassembleHandler("0x60ff62aabbcc00")
			expect(result).toHaveLength(3)
			expect(result[0]).toEqual({ pc: 0, opcode: "0x60", name: "PUSH1", pushData: "0xff" })
			expect(result[1]).toEqual({ pc: 2, opcode: "0x62", name: "PUSH3", pushData: "0xaabbcc" })
			expect(result[2]).toEqual({ pc: 6, opcode: "0x00", name: "STOP" })
		}),
	)

	it.effect("correctly indexes all 16 DUP opcodes", () =>
		Effect.gen(function* () {
			for (let i = 0; i < 16; i++) {
				const opcode = (0x80 + i).toString(16).padStart(2, "0")
				const result = yield* disassembleHandler(`0x${opcode}`)
				expect(result[0]?.name).toBe(`DUP${i + 1}`)
			}
		}),
	)

	it.effect("correctly indexes all 16 SWAP opcodes", () =>
		Effect.gen(function* () {
			for (let i = 0; i < 16; i++) {
				const opcode = (0x90 + i).toString(16).padStart(2, "0")
				const result = yield* disassembleHandler(`0x${opcode}`)
				expect(result[0]?.name).toBe(`SWAP${i + 1}`)
			}
		}),
	)

	it.effect("correctly indexes all 32 PUSH opcodes", () =>
		Effect.gen(function* () {
			for (let i = 0; i < 32; i++) {
				const opcode = (0x60 + i).toString(16).padStart(2, "0")
				const data = "ff".repeat(i + 1)
				const result = yield* disassembleHandler(`0x${opcode}${data}`)
				expect(result[0]?.name).toBe(`PUSH${i + 1}`)
			}
		}),
	)
})

describe("fourByteHandler — additional edge cases", () => {
	const originalFetch = _global.fetch

	afterEach(() => {
		_global.fetch = originalFetch
	})

	it.effect("fails on invalid hex characters in selector", () =>
		Effect.gen(function* () {
			const error = yield* fourByteHandler("0xGGGGGGGG").pipe(Effect.flip)
			expect(error._tag).toBe("SelectorLookupError")
			expect(error.message).toContain("Invalid 4-byte selector")
		}),
	)

	it.effect("handles API returning ok: false", () => {
		_global.fetch = vi.fn().mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				ok: false,
				result: {},
			}),
		}) as FetchFn

		return Effect.gen(function* () {
			const error = yield* fourByteHandler("0xa9059cbb").pipe(Effect.flip)
			expect(error._tag).toBe("SelectorLookupError")
			expect(error.message).toContain("API returned ok: false")
		})
	})

	it.effect("handles API returning empty array for selector", () => {
		_global.fetch = vi.fn().mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				ok: true,
				result: {
					function: {
						"0xdeadbeef": [],
					},
				},
			}),
		}) as FetchFn

		return Effect.gen(function* () {
			const result = yield* fourByteHandler("0xdeadbeef")
			expect(result).toEqual([])
		})
	})
})
