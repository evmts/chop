/**
 * E2E tests targeting the PRIVATE formatter functions in chain.ts.
 *
 * Since formatBlock, formatTx, formatReceipt, formatLog, and formatLogs are
 * not exported, we exercise them indirectly through CLI commands that use
 * the non-JSON output path. Each test verifies that the human-readable
 * output contains the expected labelled fields produced by the formatter.
 *
 * Also covers the command-level wiring for baseFeeCommand and findBlockCommand.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { type TestServer, runCli, startTestServer } from "../test-helpers.js"

// ============================================================================
// Shared server — one test server for all tests in this file
// ============================================================================

let server: TestServer

beforeAll(async () => {
	server = await startTestServer()
}, 15_000)

afterAll(() => {
	server?.kill()
})

// Helper: build RPC URL for the test server
const rpcUrl = () => `http://127.0.0.1:${server.port}`

// Well-known hardhat account #0 (pre-funded in TevmNode.LocalTest)
const FROM = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
const ZERO_ADDR = "0x0000000000000000000000000000000000000000"

// ============================================================================
// formatBlock — exercised via `chop block <id> -r <url>` (no --json)
// ============================================================================

describe("formatBlock — non-JSON block output", () => {
	it("includes Block number, Hash, and Timestamp for genesis", () => {
		const result = runCli(`block 0 -r ${rpcUrl()}`)
		expect(result.exitCode).toBe(0)
		expect(result.stdout).toContain("Block:")
		expect(result.stdout).toContain("Hash:")
		expect(result.stdout).toContain("Timestamp:")
	})

	it("includes Gas Limit for genesis block", () => {
		const result = runCli(`block 0 -r ${rpcUrl()}`)
		expect(result.exitCode).toBe(0)
		expect(result.stdout).toContain("Gas Limit:")
	})

	it("includes Parent Hash for latest block", () => {
		const result = runCli(`block latest -r ${rpcUrl()}`)
		expect(result.exitCode).toBe(0)
		expect(result.stdout).toContain("Parent Hash:")
	})

	it("includes Transactions count in block with transactions", () => {
		// Send a transaction to create a block with txs
		const sendResult = runCli(`send --to ${ZERO_ADDR} --from ${FROM} -r ${rpcUrl()} --json`)
		expect(sendResult.exitCode).toBe(0)

		const result = runCli(`block latest -r ${rpcUrl()}`)
		expect(result.exitCode).toBe(0)
		expect(result.stdout).toContain("Transactions:")
	})

	it("includes Base Fee field when block has baseFeePerGas", () => {
		const result = runCli(`block latest -r ${rpcUrl()}`)
		expect(result.exitCode).toBe(0)
		// EIP-1559 blocks should have Base Fee in formatted output
		expect(result.stdout).toContain("Base Fee:")
	})

	it("displays numeric values as decimals, not hex", () => {
		const result = runCli(`block latest -r ${rpcUrl()}`)
		expect(result.exitCode).toBe(0)
		// Block number should appear as a decimal integer, not a hex string
		const blockLine = result.stdout.split("\n").find((l: string) => l.trimStart().startsWith("Block:"))
		expect(blockLine).toBeDefined()
		const value = blockLine?.replace(/.*Block:\s*/, "").trim()
		// Must be a valid non-negative integer in decimal form
		expect(Number.isInteger(Number(value))).toBe(true)
		expect(Number(value)).toBeGreaterThanOrEqual(0)
		// Must not be a hex string like "0x1"
		expect(value).not.toMatch(/^0x/)
	})
})

// ============================================================================
// formatTx — exercised via `chop tx <hash> -r <url>` (no --json)
// ============================================================================

describe("formatTx — non-JSON transaction output", () => {
	let txHash: string

	beforeAll(() => {
		const sendResult = runCli(`send --to ${ZERO_ADDR} --from ${FROM} --value 0x1 -r ${rpcUrl()} --json`)
		expect(sendResult.exitCode).toBe(0)
		txHash = JSON.parse(sendResult.stdout.trim()).txHash
		expect(txHash).toBeDefined()
	})

	it("includes Hash field", () => {
		const result = runCli(`tx ${txHash} -r ${rpcUrl()}`)
		expect(result.exitCode).toBe(0)
		expect(result.stdout).toContain("Hash:")
		expect(result.stdout).toContain(txHash)
	})

	it("includes From field with sender address", () => {
		const result = runCli(`tx ${txHash} -r ${rpcUrl()}`)
		expect(result.exitCode).toBe(0)
		expect(result.stdout).toContain("From:")
	})

	it("includes To field", () => {
		const result = runCli(`tx ${txHash} -r ${rpcUrl()}`)
		expect(result.exitCode).toBe(0)
		expect(result.stdout).toContain("To:")
	})

	it("includes Value field in wei", () => {
		const result = runCli(`tx ${txHash} -r ${rpcUrl()}`)
		expect(result.exitCode).toBe(0)
		expect(result.stdout).toContain("Value:")
		expect(result.stdout).toContain("wei")
	})

	it("includes Gas and Block fields", () => {
		const result = runCli(`tx ${txHash} -r ${rpcUrl()}`)
		expect(result.exitCode).toBe(0)
		expect(result.stdout).toContain("Gas:")
		expect(result.stdout).toContain("Block:")
	})

	it("includes Input field", () => {
		const result = runCli(`tx ${txHash} -r ${rpcUrl()}`)
		expect(result.exitCode).toBe(0)
		expect(result.stdout).toContain("Input:")
	})
})

// ============================================================================
// formatReceipt — exercised via `chop receipt <hash> -r <url>` (no --json)
// ============================================================================

describe("formatReceipt — non-JSON receipt output", () => {
	let txHash: string

	beforeAll(() => {
		const sendResult = runCli(`send --to ${ZERO_ADDR} --from ${FROM} -r ${rpcUrl()} --json`)
		expect(sendResult.exitCode).toBe(0)
		txHash = JSON.parse(sendResult.stdout.trim()).txHash
		expect(txHash).toBeDefined()
	})

	it("includes Tx Hash field", () => {
		const result = runCli(`receipt ${txHash} -r ${rpcUrl()}`)
		expect(result.exitCode).toBe(0)
		expect(result.stdout).toContain("Tx Hash:")
		expect(result.stdout).toContain(txHash)
	})

	it("includes Status field showing Success", () => {
		const result = runCli(`receipt ${txHash} -r ${rpcUrl()}`)
		expect(result.exitCode).toBe(0)
		expect(result.stdout).toContain("Status:")
		expect(result.stdout).toContain("Success")
	})

	it("includes Block number field", () => {
		const result = runCli(`receipt ${txHash} -r ${rpcUrl()}`)
		expect(result.exitCode).toBe(0)
		expect(result.stdout).toContain("Block:")
	})

	it("includes From field", () => {
		const result = runCli(`receipt ${txHash} -r ${rpcUrl()}`)
		expect(result.exitCode).toBe(0)
		expect(result.stdout).toContain("From:")
	})

	it("includes To field", () => {
		const result = runCli(`receipt ${txHash} -r ${rpcUrl()}`)
		expect(result.exitCode).toBe(0)
		expect(result.stdout).toContain("To:")
	})

	it("includes Gas Used field", () => {
		const result = runCli(`receipt ${txHash} -r ${rpcUrl()}`)
		expect(result.exitCode).toBe(0)
		expect(result.stdout).toContain("Gas Used:")
	})

	it("includes Logs count", () => {
		const result = runCli(`receipt ${txHash} -r ${rpcUrl()}`)
		expect(result.exitCode).toBe(0)
		expect(result.stdout).toContain("Logs:")
	})
})

// ============================================================================
// formatLogs — exercised via `chop logs -r <url>` (no --json, empty case)
// ============================================================================

describe("formatLogs — non-JSON logs output (empty)", () => {
	it("prints 'No logs found' for devnet with no events", () => {
		const result = runCli(`logs --from-block 0x0 --to-block latest -r ${rpcUrl()}`)
		expect(result.exitCode).toBe(0)
		expect(result.stdout).toContain("No logs found")
	})
})

// ============================================================================
// gas-price — non-JSON output path
// ============================================================================

describe("gas-price — non-JSON output", () => {
	it("prints a plain decimal number (not JSON)", () => {
		const result = runCli(`gas-price -r ${rpcUrl()}`)
		expect(result.exitCode).toBe(0)
		const value = result.stdout.trim()
		// Should be a plain number, not wrapped in JSON
		expect(() => BigInt(value)).not.toThrow()
		expect(value).not.toContain("{")
		expect(value).not.toContain("gasPrice")
	})
})

// ============================================================================
// baseFeeCommand wiring — non-JSON and --json paths
// ============================================================================

describe("baseFeeCommand — CLI wiring", () => {
	it("non-JSON: prints a plain decimal number", () => {
		const result = runCli(`base-fee -r ${rpcUrl()}`)
		expect(result.exitCode).toBe(0)
		const value = result.stdout.trim()
		// Should be a plain decimal number
		expect(() => BigInt(value)).not.toThrow()
		expect(Number(value)).toBeGreaterThanOrEqual(0)
		// Must not be JSON-wrapped
		expect(value).not.toContain("{")
		expect(value).not.toContain("baseFee")
	})

	it("--json: outputs { baseFee: <string> }", () => {
		const result = runCli(`base-fee -r ${rpcUrl()} --json`)
		expect(result.exitCode).toBe(0)
		const json = JSON.parse(result.stdout.trim())
		expect(json).toHaveProperty("baseFee")
		expect(typeof json.baseFee).toBe("string")
		expect(Number(json.baseFee)).toBeGreaterThanOrEqual(0)
	})
})

// ============================================================================
// findBlockCommand wiring — non-JSON and --json paths
// ============================================================================

describe("findBlockCommand — CLI wiring", () => {
	it("non-JSON: prints a plain block number for timestamp 0", () => {
		const result = runCli(`find-block 0 -r ${rpcUrl()}`)
		expect(result.exitCode).toBe(0)
		const value = result.stdout.trim()
		expect(value).toBe("0")
		// Must not be JSON-wrapped
		expect(value).not.toContain("{")
		expect(value).not.toContain("blockNumber")
	})

	it("--json: outputs { blockNumber: <string> } for timestamp 0", () => {
		const result = runCli(`find-block 0 -r ${rpcUrl()} --json`)
		expect(result.exitCode).toBe(0)
		const json = JSON.parse(result.stdout.trim())
		expect(json).toEqual({ blockNumber: "0" })
	})

	it("non-JSON: prints block number for very large timestamp", () => {
		const result = runCli(`find-block 9999999999 -r ${rpcUrl()}`)
		expect(result.exitCode).toBe(0)
		const value = result.stdout.trim()
		// With only genesis block, should return "0" or a small number
		expect(() => Number.parseInt(value, 10)).not.toThrow()
		expect(Number(value)).toBeGreaterThanOrEqual(0)
	})

	it("--json: outputs structured JSON for large timestamp", () => {
		const result = runCli(`find-block 9999999999 -r ${rpcUrl()} --json`)
		expect(result.exitCode).toBe(0)
		const json = JSON.parse(result.stdout.trim())
		expect(json).toHaveProperty("blockNumber")
		expect(typeof json.blockNumber).toBe("string")
	})

	it("invalid timestamp exits non-zero", () => {
		const result = runCli(`find-block abc -r ${rpcUrl()}`)
		expect(result.exitCode).not.toBe(0)
	})

	it("negative timestamp exits non-zero", () => {
		const result = runCli(`find-block -- -1 -r ${rpcUrl()}`)
		expect(result.exitCode).not.toBe(0)
	})
})
