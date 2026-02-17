/**
 * CLI E2E tests for RPC command wiring — send and rpc generic commands.
 *
 * Exercises the Command.make Effect.gen bodies for:
 * - sendCommand (lines 439-448 in rpc.ts) — non-JSON output path
 * - rpcGenericCommand (lines 468-475 in rpc.ts) — non-string result branch
 *
 * The rpc generic command has a branch:
 *   typeof result === "string" ? result : JSON.stringify(result, null, 2)
 *
 * eth_chainId returns a string ("0x7a69") → first branch
 * eth_getBlockByNumber returns an object → second branch (JSON.stringify)
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { type TestServer, runCli, startTestServer } from "../test-helpers.js"

const ZERO_ADDR = "0x0000000000000000000000000000000000000000"
const FUNDED_ADDR = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

// ============================================================================
// CLI E2E — send command non-JSON output path
// ============================================================================

describe("CLI E2E — send command non-JSON output", () => {
	let server: TestServer

	beforeAll(async () => {
		server = await startTestServer()
	}, 35_000)

	afterAll(() => {
		server?.kill()
	})

	it("send without --json outputs raw tx hash", () => {
		const result = runCli(
			`send --to ${ZERO_ADDR} --from ${FUNDED_ADDR} -r http://127.0.0.1:${server.port}`,
		)
		expect(result.exitCode).toBe(0)
		// Non-JSON output should be a plain tx hash (no JSON wrapping)
		const output = result.stdout.trim()
		expect(output).toMatch(/^0x[0-9a-f]{64}$/)
		// Verify it is NOT JSON (no braces)
		expect(output).not.toContain("{")
		expect(output).not.toContain("txHash")
	})

	it("send with --value without --json outputs raw tx hash", () => {
		const result = runCli(
			`send --to ${ZERO_ADDR} --from ${FUNDED_ADDR} --value 1000 -r http://127.0.0.1:${server.port}`,
		)
		expect(result.exitCode).toBe(0)
		const output = result.stdout.trim()
		expect(output).toMatch(/^0x[0-9a-f]{64}$/)
	})
})

// ============================================================================
// CLI E2E — rpc generic command non-string result branch
// ============================================================================

describe("CLI E2E — rpc command non-string result", () => {
	let server: TestServer

	beforeAll(async () => {
		server = await startTestServer()
	}, 35_000)

	afterAll(() => {
		server?.kill()
	})

	it("rpc eth_getBlockByNumber without --json outputs pretty-printed JSON (non-string result)", () => {
		// eth_getBlockByNumber returns a block object (not a string)
		// This exercises: typeof result === "string" ? result : JSON.stringify(result, null, 2)
		const result = runCli(
			`rpc eth_getBlockByNumber '"0x0"' false -r http://127.0.0.1:${server.port}`,
		)
		expect(result.exitCode).toBe(0)
		const output = result.stdout.trim()

		// The output should be pretty-printed JSON (an object with newlines and indentation)
		expect(output).toContain("{")
		expect(output).toContain("}")
		// Block objects have a "number" field
		const parsed = JSON.parse(output)
		expect(parsed).toHaveProperty("number")
		expect(parsed.number).toBe("0x0")
	})

	it("rpc eth_chainId without --json outputs raw string (string result)", () => {
		// eth_chainId returns a string "0x7a69"
		// This exercises: typeof result === "string" ? result (the string branch)
		const result = runCli(
			`rpc eth_chainId -r http://127.0.0.1:${server.port}`,
		)
		expect(result.exitCode).toBe(0)
		const output = result.stdout.trim()
		expect(output).toBe("0x7a69")
		// Should NOT be JSON-wrapped
		expect(output).not.toContain("{")
	})

	it("rpc eth_getBlockByNumber --json wraps result in JSON envelope", () => {
		// With --json, the result should be wrapped in { method, result } regardless of type
		const result = runCli(
			`rpc eth_getBlockByNumber '"0x0"' false -r http://127.0.0.1:${server.port} --json`,
		)
		expect(result.exitCode).toBe(0)
		const json = JSON.parse(result.stdout.trim())
		expect(json).toHaveProperty("method", "eth_getBlockByNumber")
		expect(json).toHaveProperty("result")
		expect(json.result).toHaveProperty("number", "0x0")
	})

	it("rpc with non-JSON-parseable params passes them as strings", () => {
		// Params that fail JSON.parse should be passed as raw strings
		// eth_getBalance with plain addresses (not JSON-quoted) should still work
		// because the handler falls back to treating them as strings
		const result = runCli(
			`rpc eth_getBalance ${ZERO_ADDR} latest -r http://127.0.0.1:${server.port}`,
		)
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("0x0")
	})
})
