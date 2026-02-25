/**
 * Performance benchmark tests for the chop CLI.
 *
 * Each benchmark runs 10 iterations, takes the median, and asserts
 * the median is below a defined threshold. This guards against
 * regressions in startup time, encoding, hashing, EVM calls, and
 * package size.
 */

/// <reference types="node" />

import { execSync } from "node:child_process"
import { readdirSync, statSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { Effect, ManagedRuntime } from "effect"
import { describe, expect, it } from "vitest"
import { abiDecodeHandler, abiEncodeHandler } from "../src/cli/commands/abi.js"
import { keccakHandler } from "../src/cli/commands/crypto.js"
import { callHandler } from "../src/handlers/call.js"
import { bytesToHex } from "../src/evm/conversions.js"
import { TevmNode, TevmNodeService } from "../src/node/index.js"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, "..")

const ITERATIONS = 10

/** Run a function `n` times, collect wall-clock durations, and return the median in ms. */
const medianOf = async (n: number, fn: () => Promise<void> | void): Promise<number> => {
	const times: number[] = []
	for (let i = 0; i < n; i++) {
		const start = Date.now()
		await fn()
		times.push(Date.now() - start)
	}
	times.sort((a, b) => a - b)
	// biome-ignore lint/style/noNonNullAssertion: array length is always n > 0
	return times[Math.floor(times.length / 2)]!
}

/** Recursively compute the total size of a directory in bytes. */
const dirSize = (dir: string): number => {
	let total = 0
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name)
		if (entry.isDirectory()) {
			total += dirSize(full)
		} else {
			total += statSync(full).size
		}
	}
	return total
}

// ---------------------------------------------------------------------------
// 1. CLI startup time < 1500ms
// ---------------------------------------------------------------------------
// Note: The threshold is generous because `bun run <file.ts>` includes bun's
// own process startup plus TypeScript transpilation, and varies significantly
// by machine load. The budget catches real regressions (e.g. heavy top-level
// imports) while not flaking on normal subprocess/load variance.

describe("CLI startup time", () => {
	it(
		"bun run bin/chop.ts --version completes in < 1500ms (median of 10)",
		async () => {
			// Warm up once so bun caches the transpilation
			execSync("bun run bin/chop.ts --version", {
				cwd: PROJECT_ROOT,
				stdio: "pipe",
			})

			const median = await medianOf(ITERATIONS, () => {
				execSync("bun run bin/chop.ts --version", {
					cwd: PROJECT_ROOT,
					stdio: "pipe",
				})
			})

			console.log(`  CLI startup median: ${median.toFixed(2)}ms`)
			expect(median).toBeLessThan(1500)
		},
		30_000,
	)
})

// ---------------------------------------------------------------------------
// 2. ABI encode/decode < 10ms
// ---------------------------------------------------------------------------

describe("ABI encode/decode performance", () => {
	const SIG = "(address,uint256)"
	const VALUES = [
		"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
		"1000000000000000000",
	] as const
	// Pre-computed encoded data for the decode path
	const ENCODED_DATA =
		"0x000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa960450000000000000000000000000000000000000000000000000de0b6b3a7640000"

	it("abiEncodeHandler completes in < 10ms (median of 10)", async () => {
		// Warm up
		await Effect.runPromise(abiEncodeHandler(SIG, VALUES, false))

		const median = await medianOf(ITERATIONS, async () => {
			await Effect.runPromise(abiEncodeHandler(SIG, VALUES, false))
		})

		console.log(`  ABI encode median: ${median.toFixed(2)}ms`)
		expect(median).toBeLessThan(10)
	})

	it("abiDecodeHandler completes in < 10ms (median of 10)", async () => {
		// Warm up
		await Effect.runPromise(abiDecodeHandler(SIG, ENCODED_DATA))

		const median = await medianOf(ITERATIONS, async () => {
			await Effect.runPromise(abiDecodeHandler(SIG, ENCODED_DATA))
		})

		console.log(`  ABI decode median: ${median.toFixed(2)}ms`)
		expect(median).toBeLessThan(10)
	})
})

// ---------------------------------------------------------------------------
// 3. Keccak hash < 1ms
// ---------------------------------------------------------------------------

describe("Keccak hash performance", () => {
	it("keccakHandler completes in < 1ms (median of 10)", async () => {
		// Warm up
		Effect.runSync(keccakHandler("transfer(address,uint256)"))

		const median = await medianOf(ITERATIONS, () => {
			Effect.runSync(keccakHandler("transfer(address,uint256)"))
		})

		console.log(`  Keccak hash median: ${median.toFixed(4)}ms`)
		expect(median).toBeLessThan(1)
	})
})

// ---------------------------------------------------------------------------
// 4. Local eth_call < 50ms
// ---------------------------------------------------------------------------

describe("Local eth_call performance", () => {
	it("callHandler via LocalTest completes in < 50ms (median of 10)", async () => {
		const runtime = ManagedRuntime.make(TevmNode.LocalTest())

		try {
			// Simple STOP bytecode — just starts the EVM and returns immediately
			const stopBytecode = bytesToHex(new Uint8Array([0x00]))

			// Warm up: initialize the node and run one call
			await runtime.runPromise(
				Effect.gen(function* () {
					const node = yield* TevmNodeService
					yield* callHandler(node)({ data: stopBytecode })
				}),
			)

			const median = await medianOf(ITERATIONS, async () => {
				await runtime.runPromise(
					Effect.gen(function* () {
						const node = yield* TevmNodeService
						yield* callHandler(node)({ data: stopBytecode })
					}),
				)
			})

			console.log(`  eth_call median: ${median.toFixed(2)}ms`)
			expect(median).toBeLessThan(50)
		} finally {
			await runtime.dispose()
		}
	})
})

// ---------------------------------------------------------------------------
// 5. npm package size < 5MB
// ---------------------------------------------------------------------------

describe("npm package size", () => {
	it(
		"dist/ directory is smaller than 5MB after build",
		() => {
			// Run the build
			execSync("bun run build", {
				cwd: PROJECT_ROOT,
				stdio: "pipe",
			})

			const distPath = join(PROJECT_ROOT, "dist")
			const totalBytes = dirSize(distPath)
			const totalMB = totalBytes / (1024 * 1024)

			console.log(`  dist/ size: ${totalMB.toFixed(2)}MB (${totalBytes} bytes)`)
			expect(totalMB).toBeLessThan(5)
		},
		60_000,
	)
})
