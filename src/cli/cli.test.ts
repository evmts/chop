import { describe, expect, it } from "vitest"
import { runCli } from "./test-helpers.js"
import { VERSION } from "./version.js"

describe("chop CLI", () => {
	describe("--help", () => {
		it("exits 0", () => {
			const result = runCli("--help")
			expect(result.exitCode).toBe(0)
		})

		it("prints chop in help output", () => {
			const result = runCli("--help")
			expect(result.stdout).toContain("chop")
		})

		it("prints description", () => {
			const result = runCli("--help")
			expect(result.stdout).toContain("Ethereum Swiss Army knife")
		})
	})

	describe("--version", () => {
		it("exits 0", () => {
			const result = runCli("--version")
			expect(result.exitCode).toBe(0)
		})

		it("prints the version string", () => {
			const result = runCli("--version")
			expect(result.stdout.trim()).toContain(VERSION)
		})
	})

	describe("no arguments", () => {
		it("exits 0 and prints TUI stub message", () => {
			const result = runCli("")
			expect(result.exitCode).toBe(0)
			expect(result.stdout).toContain("TUI not yet implemented")
		})
	})

	describe("--json flag", () => {
		it("is accepted as a global option", () => {
			const result = runCli("--json")
			// Should not fail — the flag is recognized
			expect(result.exitCode).toBe(0)
		})

		it("short alias -j is accepted", () => {
			const result = runCli("-j")
			expect(result.exitCode).toBe(0)
		})
	})

	describe("--rpc-url flag", () => {
		it("is accepted with a value", () => {
			const result = runCli("--rpc-url http://localhost:8545")
			expect(result.exitCode).toBe(0)
		})

		it("short alias -r is accepted", () => {
			const result = runCli("-r http://localhost:8545")
			expect(result.exitCode).toBe(0)
		})
	})

	describe("nonexistent subcommand", () => {
		it("exits with non-zero code", () => {
			const result = runCli("nonexistent")
			expect(result.exitCode).not.toBe(0)
		})
	})
})
