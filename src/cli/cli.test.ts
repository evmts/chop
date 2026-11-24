import { describe, expect, it } from "vitest"
import { runCli } from "./test-helpers.js"
import { VERSION } from "./version.js"

describe("chop CLI", () => {
	describe("--help", () => {
		it("exits 0", async () => {
			const result = await runCli("--help")
			expect(result.exitCode).toBe(0)
		})

		it("prints chop in help output", async () => {
			const result = await runCli("--help")
			expect(result.stdout).toContain("chop")
		})

		it("prints description", async () => {
			const result = await runCli("--help")
			expect(result.stdout).toContain("Ethereum Swiss Army knife")
		})
	})

	describe("--version", () => {
		it("exits 0", async () => {
			const result = await runCli("--version")
			expect(result.exitCode).toBe(0)
		})

		it("prints the version string", async () => {
			const result = await runCli("--version")
			expect(result.stdout.trim()).toContain(VERSION)
		})
	})

	describe("no arguments", () => {
		it("exits 0 and prints TTY fallback message (non-interactive)", async () => {
			const result = await runCli("")
			expect(result.exitCode).toBe(0)
			// When run via execSync (piped stdout), isTTY is false → fallback message
			expect(result.stdout).toContain("TUI requires an interactive terminal")
		})
	})

	describe("--json flag", () => {
		it("is accepted as a global option", async () => {
			const result = await runCli("--json")
			// Should not fail — the flag is recognized
			expect(result.exitCode).toBe(0)
		})

		it("short alias -j is accepted", async () => {
			const result = await runCli("-j")
			expect(result.exitCode).toBe(0)
		})
	})

	describe("--rpc-url flag", () => {
		it("is accepted with a value", async () => {
			const result = await runCli("--rpc-url http://localhost:8545")
			expect(result.exitCode).toBe(0)
		})

		it("short alias -r is accepted", async () => {
			const result = await runCli("-r http://localhost:8545")
			expect(result.exitCode).toBe(0)
		})
	})

	describe("nonexistent subcommand", () => {
		it("exits with non-zero code", async () => {
			const result = await runCli("nonexistent")
			expect(result.exitCode).not.toBe(0)
		})
	})
})
