/**
 * Additional coverage tests for `src/cli/commands/node.ts`.
 *
 * Covers:
 * - `formatBanner` edge cases (fork URL with/without block number, empty accounts)
 * - `startNodeServer` local mode path (no fork URL)
 * - `startNodeServer` with custom chainId and accounts count
 * - `NodeServerOptions` interface shape
 */

import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { DEFAULT_BALANCE } from "../../node/accounts.js"
import { type NodeServerOptions, formatBanner, startNodeServer } from "./node.js"

// ---------------------------------------------------------------------------
// formatBanner — coverage tests
// ---------------------------------------------------------------------------

describe("formatBanner — coverage", () => {
	const sampleAccount = {
		address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
		privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
	}

	it("basic banner with accounts shows address, key, and ETH balance", () => {
		const banner = formatBanner(8545, [sampleAccount])
		const ethAmount = DEFAULT_BALANCE / 10n ** 18n

		expect(banner).toContain("chop node")
		expect(banner).toContain("Available Accounts")
		expect(banner).toContain(sampleAccount.address)
		expect(banner).toContain("Private Keys")
		expect(banner).toContain(sampleAccount.privateKey)
		expect(banner).toContain(`${ethAmount} ETH`)
		expect(banner).toContain("http://127.0.0.1:8545")
	})

	it("with fork URL and fork block number shows both", () => {
		const banner = formatBanner(3000, [sampleAccount], "https://eth-mainnet.alchemyapi.io/v2/key", 19_500_000n)

		expect(banner).toContain("Fork Mode")
		expect(banner).toContain("Fork URL: https://eth-mainnet.alchemyapi.io/v2/key")
		expect(banner).toContain("Block Number: 19500000")
		expect(banner).toContain("http://127.0.0.1:3000")
	})

	it("with fork URL but no block number omits Block Number line", () => {
		const banner = formatBanner(4000, [sampleAccount], "https://rpc.ankr.com/eth")

		expect(banner).toContain("Fork Mode")
		expect(banner).toContain("Fork URL: https://rpc.ankr.com/eth")
		expect(banner).not.toContain("Block Number:")
	})

	it("with empty accounts list omits accounts and private keys sections", () => {
		const banner = formatBanner(5000, [])

		expect(banner).not.toContain("Available Accounts")
		expect(banner).not.toContain("Private Keys")
		expect(banner).toContain("http://127.0.0.1:5000")
		expect(banner).toContain("chop node")
	})
})

// ---------------------------------------------------------------------------
// startNodeServer — local mode coverage
// ---------------------------------------------------------------------------

describe("startNodeServer — local mode coverage", () => {
	it.effect("starts local node server and closes cleanly", () =>
		Effect.gen(function* () {
			const { server, accounts, close } = yield* startNodeServer({ port: 0 })

			expect(server.port).toBeGreaterThan(0)
			expect(accounts.length).toBeGreaterThan(0)

			yield* close()
		}),
	)

	it.effect("local mode with custom chainId", () =>
		Effect.gen(function* () {
			const { server, accounts, close } = yield* startNodeServer({
				port: 0,
				chainId: 1337n,
			})

			expect(server.port).toBeGreaterThan(0)
			expect(accounts.length).toBe(10) // default accounts count

			yield* close()
		}),
	)

	it.effect("local mode with custom accounts count", () =>
		Effect.gen(function* () {
			const {
				server: _server,
				accounts,
				close,
			} = yield* startNodeServer({
				port: 0,
				accounts: 3,
			})

			expect(accounts).toHaveLength(3)
			for (const acct of accounts) {
				expect(acct.address).toMatch(/^0x[0-9a-fA-F]{40}$/)
				expect(acct.privateKey).toMatch(/^0x[0-9a-fA-F]{64}$/)
			}

			yield* close()
		}),
	)

	it.effect("local mode with both custom chainId and accounts", () =>
		Effect.gen(function* () {
			const { server, accounts, close } = yield* startNodeServer({
				port: 0,
				chainId: 42n,
				accounts: 2,
			})

			expect(server.port).toBeGreaterThan(0)
			expect(accounts).toHaveLength(2)

			yield* close()
		}),
	)

	it.effect("local mode result does not include forkBlockNumber", () =>
		Effect.gen(function* () {
			const result = yield* startNodeServer({ port: 0 })

			expect(result.forkBlockNumber).toBeUndefined()

			yield* result.close()
		}),
	)
})

// ---------------------------------------------------------------------------
// NodeServerOptions — type-level verification
// ---------------------------------------------------------------------------

describe("NodeServerOptions interface", () => {
	it("accepts all optional params", () => {
		const opts: NodeServerOptions = {
			port: 8545,
			chainId: 1n,
			accounts: 5,
			forkUrl: "https://example.com",
			forkBlockNumber: 100n,
		}

		expect(opts.port).toBe(8545)
		expect(opts.chainId).toBe(1n)
		expect(opts.accounts).toBe(5)
		expect(opts.forkUrl).toBe("https://example.com")
		expect(opts.forkBlockNumber).toBe(100n)
	})

	it("accepts only required port param", () => {
		const opts: NodeServerOptions = { port: 0 }

		expect(opts.port).toBe(0)
		expect(opts.chainId).toBeUndefined()
		expect(opts.accounts).toBeUndefined()
		expect(opts.forkUrl).toBeUndefined()
		expect(opts.forkBlockNumber).toBeUndefined()
	})
})
