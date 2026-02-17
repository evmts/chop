/**
 * CLI E2E tests for ENS command wiring — resolve-name and lookup-address.
 *
 * Exercises the Command.make Effect.gen bodies (lines 244-251, 267-274 in ens.ts)
 * by running the CLI commands against a real test server.
 *
 * resolve-name: The test server has no ENS registry, so eth_call returns "0x".
 *   The command treats this as a successful (though bogus) result, exercising
 *   the success output paths for both JSON and non-JSON branches.
 *
 * lookup-address: The reverse lookup eventually hits the "0x" / length <= 2
 *   guard and fails with EnsError, exercising the error path through
 *   handleCommandErrors.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { type TestServer, runCli, startTestServer } from "../test-helpers.js"

// ============================================================================
// CLI E2E — resolve-name command wiring against running server
// ============================================================================

describe("CLI E2E — resolve-name command wiring", () => {
	let server: TestServer

	beforeAll(async () => {
		server = await startTestServer()
	}, 35_000)

	afterAll(() => {
		server?.kill()
	})

	it("resolve-name outputs address (exercises non-JSON output path)", () => {
		const result = runCli(`resolve-name vitalik.eth -r http://127.0.0.1:${server.port}`)
		expect(result.exitCode).toBe(0)
		// Without ENS registry, resolves to "0x" (bogus but exercises command wiring)
		const output = result.stdout.trim()
		expect(output.startsWith("0x")).toBe(true)
	})

	it("resolve-name --json outputs structured JSON (exercises JSON output path)", () => {
		const result = runCli(`resolve-name vitalik.eth -r http://127.0.0.1:${server.port} --json`)
		expect(result.exitCode).toBe(0)
		const json = JSON.parse(result.stdout.trim())
		expect(json).toHaveProperty("name", "vitalik.eth")
		expect(json).toHaveProperty("address")
	})

	it("resolve-name with multi-level name exercises command wiring", () => {
		const result = runCli(`resolve-name sub.domain.eth -r http://127.0.0.1:${server.port}`)
		expect(result.exitCode).toBe(0)
		const output = result.stdout.trim()
		expect(output.startsWith("0x")).toBe(true)
	})

	it("resolve-name --json with multi-level name outputs structured JSON", () => {
		const result = runCli(`resolve-name sub.domain.eth -r http://127.0.0.1:${server.port} --json`)
		expect(result.exitCode).toBe(0)
		const json = JSON.parse(result.stdout.trim())
		expect(json).toHaveProperty("name", "sub.domain.eth")
		expect(json).toHaveProperty("address")
	})
})

// ============================================================================
// CLI E2E — lookup-address command wiring against running server
// ============================================================================

describe("CLI E2E — lookup-address command wiring", () => {
	let server: TestServer

	beforeAll(async () => {
		server = await startTestServer()
	}, 35_000)

	afterAll(() => {
		server?.kill()
	})

	it("lookup-address exits non-zero (no ENS registry on devnet)", () => {
		const addr = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
		const result = runCli(`lookup-address ${addr} -r http://127.0.0.1:${server.port}`)
		expect(result.exitCode).not.toBe(0)
		const combined = result.stderr + result.stdout
		expect(combined.length).toBeGreaterThan(0)
	})

	it("lookup-address --json exits non-zero with error output", () => {
		const addr = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
		const result = runCli(`lookup-address ${addr} -r http://127.0.0.1:${server.port} --json`)
		expect(result.exitCode).not.toBe(0)
		const combined = result.stderr + result.stdout
		expect(combined.length).toBeGreaterThan(0)
	})

	it("lookup-address with zero address exits non-zero", () => {
		const addr = "0x0000000000000000000000000000000000000000"
		const result = runCli(`lookup-address ${addr} -r http://127.0.0.1:${server.port}`)
		expect(result.exitCode).not.toBe(0)
	})
})
