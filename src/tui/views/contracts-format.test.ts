import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import {
	formatBytecodeHex,
	formatCodeSize,
	formatDisassemblyLine,
	formatPc,
	formatSelector,
	formatStorageValue,
} from "./contracts-format.js"

describe("contracts-format", () => {
	describe("formatCodeSize", () => {
		it.effect("formats zero bytes", () =>
			Effect.sync(() => {
				expect(formatCodeSize(0)).toBe("0 B")
			}),
		)

		it.effect("formats small byte count", () =>
			Effect.sync(() => {
				expect(formatCodeSize(42)).toBe("42 B")
			}),
		)

		it.effect("formats kilobyte range", () =>
			Effect.sync(() => {
				expect(formatCodeSize(1024)).toBe("1.0 KB")
			}),
		)

		it.effect("formats fractional kilobytes", () =>
			Effect.sync(() => {
				expect(formatCodeSize(2560)).toBe("2.5 KB")
			}),
		)

		it.effect("formats exact kilobytes", () =>
			Effect.sync(() => {
				expect(formatCodeSize(5120)).toBe("5.0 KB")
			}),
		)

		it.effect("formats sub-kilobyte", () =>
			Effect.sync(() => {
				expect(formatCodeSize(999)).toBe("999 B")
			}),
		)
	})

	describe("formatPc", () => {
		it.effect("formats zero as 0x0000", () =>
			Effect.sync(() => {
				expect(formatPc(0)).toBe("0x0000")
			}),
		)

		it.effect("formats small number", () =>
			Effect.sync(() => {
				expect(formatPc(10)).toBe("0x000a")
			}),
		)

		it.effect("formats larger number", () =>
			Effect.sync(() => {
				expect(formatPc(0xff)).toBe("0x00ff")
			}),
		)

		it.effect("formats number > 0xfff", () =>
			Effect.sync(() => {
				expect(formatPc(0x1234)).toBe("0x1234")
			}),
		)
	})

	describe("formatDisassemblyLine", () => {
		it.effect("formats instruction without push data", () =>
			Effect.sync(() => {
				const result = formatDisassemblyLine({ pc: 0, opcode: "0x00", name: "STOP" })
				expect(result).toBe("0x0000: STOP")
			}),
		)

		it.effect("formats instruction with push data", () =>
			Effect.sync(() => {
				const result = formatDisassemblyLine({
					pc: 5,
					opcode: "0x60",
					name: "PUSH1",
					pushData: "0x80",
				})
				expect(result).toBe("0x0005: PUSH1 0x80")
			}),
		)
	})

	describe("formatBytecodeHex", () => {
		it.effect("formats empty bytecode", () =>
			Effect.sync(() => {
				expect(formatBytecodeHex("0x", 0)).toBe("")
			}),
		)

		it.effect("formats short bytecode on one line", () =>
			Effect.sync(() => {
				const result = formatBytecodeHex("0x60806040", 0)
				expect(result).toBe("0000: 60 80 60 40")
			}),
		)

		it.effect("wraps long bytecode at 16 bytes per line", () =>
			Effect.sync(() => {
				// 32 bytes = 2 lines of 16
				const hex = `0x${"ab".repeat(32)}`
				const lines = formatBytecodeHex(hex, 0).split("\n")
				expect(lines.length).toBe(2)
			}),
		)

		it.effect("respects offset parameter", () =>
			Effect.sync(() => {
				const hex = `0x${"ab".repeat(48)}`
				const result = formatBytecodeHex(hex, 1)
				const lines = result.split("\n")
				// Should start from line offset 1 (skip first line)
				expect(lines[0]).toContain("0010:")
			}),
		)
	})

	describe("formatStorageValue", () => {
		it.effect("formats zero", () =>
			Effect.sync(() => {
				expect(formatStorageValue("0x0")).toBe("0x0")
			}),
		)

		it.effect("passes through hex strings", () =>
			Effect.sync(() => {
				const hex = `0x${"ab".repeat(32)}`
				expect(formatStorageValue(hex)).toBe(hex)
			}),
		)
	})

	describe("formatSelector", () => {
		it.effect("formats selector with resolved name", () =>
			Effect.sync(() => {
				expect(formatSelector("0xa9059cbb", "transfer(address,uint256)")).toBe("0xa9059cbb  transfer(address,uint256)")
			}),
		)

		it.effect("formats selector without resolved name", () =>
			Effect.sync(() => {
				expect(formatSelector("0xa9059cbb")).toBe("0xa9059cbb  (unknown)")
			}),
		)
	})
})
