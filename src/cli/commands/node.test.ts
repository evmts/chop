import * as http from "node:http"
import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { DEFAULT_BALANCE } from "../../node/accounts.js"
import { formatBanner } from "./node.js"

// ---------------------------------------------------------------------------
// Helper — send JSON-RPC via node:http (same as rpc/server.test.ts)
// ---------------------------------------------------------------------------

interface RpcResult {
	jsonrpc: string
	result?: unknown
	error?: { code: number; message: string }
	id: number | string | null
}

const httpPost = (port: number, body: string): Promise<{ status: number; body: string }> =>
	new Promise((resolve, reject) => {
		const req = http.request(
			{ hostname: "127.0.0.1", port, method: "POST", path: "/", headers: { "Content-Type": "application/json" } },
			(res) => {
				let data = ""
				res.on("data", (chunk: Buffer) => {
					data += chunk.toString()
				})
				res.on("end", () => {
					resolve({ status: res.statusCode ?? 0, body: data })
				})
			},
		)
		req.on("error", reject)
		req.write(body)
		req.end()
	})

const rpcCall = (port: number, method: string, params: unknown[] = []) =>
	Effect.tryPromise({
		try: async () => {
			const body = JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 })
			const res = await httpPost(port, body)
			return JSON.parse(res.body) as RpcResult
		},
		catch: (e) => new Error(`http request failed: ${e}`),
	})

// ---------------------------------------------------------------------------
// formatBanner — pure function tests
// ---------------------------------------------------------------------------

describe("formatBanner", () => {
	it("includes listening URL", () => {
		const banner = formatBanner(8545, [
			{
				address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
				privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
			},
		])
		expect(banner).toContain("http://127.0.0.1:8545")
	})

	it("includes account addresses and private keys", () => {
		const banner = formatBanner(8545, [
			{
				address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
				privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
			},
		])
		expect(banner).toContain("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")
		expect(banner).toContain("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80")
	})

	it("includes balance in ETH", () => {
		const banner = formatBanner(8545, [
			{
				address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
				privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
			},
		])
		expect(banner).toContain("10000")
	})

	it("shows correct number of accounts", () => {
		const accounts = [
			{
				address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
				privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
			},
			{
				address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
				privateKey: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
			},
		]
		const banner = formatBanner(8545, accounts)
		expect(banner).toContain("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")
		expect(banner).toContain("0x70997970C51812dc3A010C7d01b50e0d17dc79C8")
	})
})

// ---------------------------------------------------------------------------
// E2E: startNodeServer — starts a server, talk to it via HTTP
// ---------------------------------------------------------------------------

// We import startNodeServer which creates the node + server internally
import { startNodeServer } from "./node.js"

describe("chop node — E2E", () => {
	it.effect("default chainId is 0x7a69 (31337)", () =>
		Effect.gen(function* () {
			const { server, close } = yield* startNodeServer({ port: 0 })

			const res = yield* rpcCall(server.port, "eth_chainId")
			expect(res.result).toBe("0x7a69")

			yield* close()
		}),
	)

	it.effect("custom chain-id 42 → eth_chainId returns 0x2a", () =>
		Effect.gen(function* () {
			const { server, close } = yield* startNodeServer({ port: 0, chainId: 42n })

			const res = yield* rpcCall(server.port, "eth_chainId")
			expect(res.result).toBe("0x2a")

			yield* close()
		}),
	)

	it.effect("accounts 5 → eth_accounts returns 5 addresses", () =>
		Effect.gen(function* () {
			const { server, close } = yield* startNodeServer({ port: 0, accounts: 5 })

			const res = yield* rpcCall(server.port, "eth_accounts")
			const addresses = res.result as string[]
			expect(addresses).toHaveLength(5)
			for (const addr of addresses) {
				expect(addr).toMatch(/^0x[0-9a-fA-F]{40}$/)
			}

			yield* close()
		}),
	)

	it.effect("funded accounts have 10000 ETH balance", () =>
		Effect.gen(function* () {
			const { server, close } = yield* startNodeServer({ port: 0, accounts: 1 })

			// Get the first account address
			const accountsRes = yield* rpcCall(server.port, "eth_accounts")
			const addr = (accountsRes.result as string[])[0]!

			// Get balance
			const balanceRes = yield* rpcCall(server.port, "eth_getBalance", [addr, "latest"])
			const balance = BigInt(balanceRes.result as string)
			expect(balance).toBe(DEFAULT_BALANCE)

			yield* close()
		}),
	)

	it.effect("graceful shutdown closes the server", () =>
		Effect.gen(function* () {
			const { server, close } = yield* startNodeServer({ port: 0 })

			// Verify server is working
			const res = yield* rpcCall(server.port, "eth_chainId")
			expect(res.result).toBe("0x7a69")

			// Close
			yield* close()

			// After close, requests should fail
			const result = yield* Effect.tryPromise({
				try: () => httpPost(server.port, JSON.stringify({ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 })),
				catch: (e) => e,
			}).pipe(Effect.either)

			expect(result._tag).toBe("Left")
		}),
	)
})

// ---------------------------------------------------------------------------
// formatBanner — edge cases
// ---------------------------------------------------------------------------

describe("formatBanner — edge cases", () => {
	it("empty accounts array omits accounts and private keys sections", () => {
		const banner = formatBanner(9999, [])
		expect(banner).not.toContain("Available Accounts")
		expect(banner).not.toContain("Private Keys")
		expect(banner).toContain("http://127.0.0.1:9999")
	})

	it("fork mode banner includes Fork Mode section with URL", () => {
		const banner = formatBanner(
			8545,
			[
				{
					address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
					privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
				},
			],
			"https://mainnet.infura.io/v3/abc123",
		)
		expect(banner).toContain("Fork Mode")
		expect(banner).toContain("Fork URL: https://mainnet.infura.io/v3/abc123")
		// Without forkBlockNumber, should not include Block Number line
		expect(banner).not.toContain("Block Number:")
	})

	it("fork mode banner includes block number when provided", () => {
		const banner = formatBanner(
			8545,
			[
				{
					address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
					privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
				},
			],
			"https://mainnet.infura.io/v3/abc123",
			18_000_000n,
		)
		expect(banner).toContain("Fork Mode")
		expect(banner).toContain("Fork URL: https://mainnet.infura.io/v3/abc123")
		expect(banner).toContain("Block Number: 18000000")
	})

	it("fork mode banner with empty accounts shows fork info but no accounts", () => {
		const banner = formatBanner(8545, [], "https://rpc.example.com")
		expect(banner).toContain("Fork Mode")
		expect(banner).toContain("Fork URL: https://rpc.example.com")
		expect(banner).not.toContain("Available Accounts")
		expect(banner).not.toContain("Private Keys")
		expect(banner).toContain("http://127.0.0.1:8545")
	})
})

// ---------------------------------------------------------------------------
// E2E: startNodeServer — fork mode (uses local server as fork target)
// ---------------------------------------------------------------------------

describe("chop node — fork mode E2E", () => {
	it.effect("fork mode server responds to eth_chainId", () =>
		Effect.gen(function* () {
			// Start a local server as the fork target
			const local = yield* startNodeServer({ port: 0 })

			// Start a fork server pointing at the local server
			const fork = yield* startNodeServer({
				port: 0,
				forkUrl: `http://127.0.0.1:${local.server.port}`,
			})

			const res = yield* rpcCall(fork.server.port, "eth_chainId")
			// Fork should inherit chain ID from the upstream (31337 = 0x7a69)
			expect(res.result).toBe("0x7a69")

			yield* fork.close()
			yield* local.close()
		}),
	)

	it.effect("fork mode server has funded accounts", () =>
		Effect.gen(function* () {
			const local = yield* startNodeServer({ port: 0 })

			const fork = yield* startNodeServer({
				port: 0,
				forkUrl: `http://127.0.0.1:${local.server.port}`,
				accounts: 3,
			})

			// Verify the fork server returns funded accounts
			const res = yield* rpcCall(fork.server.port, "eth_accounts")
			const addresses = res.result as string[]
			expect(addresses).toHaveLength(3)

			// Verify first account has balance
			const balanceRes = yield* rpcCall(fork.server.port, "eth_getBalance", [addresses[0], "latest"])
			const balance = BigInt(balanceRes.result as string)
			expect(balance).toBe(DEFAULT_BALANCE)

			yield* fork.close()
			yield* local.close()
		}),
	)

	it.effect("fork mode returns accounts in startNodeServer result", () =>
		Effect.gen(function* () {
			const local = yield* startNodeServer({ port: 0 })

			const fork = yield* startNodeServer({
				port: 0,
				forkUrl: `http://127.0.0.1:${local.server.port}`,
				accounts: 2,
			})

			// The returned accounts should match what the server reports
			expect(fork.accounts).toHaveLength(2)
			for (const acct of fork.accounts) {
				expect(acct.address).toMatch(/^0x[0-9a-fA-F]{40}$/)
				expect(acct.privateKey).toMatch(/^0x[0-9a-fA-F]{64}$/)
			}

			yield* fork.close()
			yield* local.close()
		}),
	)

	it.effect("fork mode with custom chainId overrides upstream", () =>
		Effect.gen(function* () {
			const local = yield* startNodeServer({ port: 0 })

			const fork = yield* startNodeServer({
				port: 0,
				forkUrl: `http://127.0.0.1:${local.server.port}`,
				chainId: 999n,
			})

			const res = yield* rpcCall(fork.server.port, "eth_chainId")
			expect(res.result).toBe("0x3e7") // 999 in hex

			yield* fork.close()
			yield* local.close()
		}),
	)

	it.effect("fork mode graceful shutdown closes the server", () =>
		Effect.gen(function* () {
			const local = yield* startNodeServer({ port: 0 })

			const fork = yield* startNodeServer({
				port: 0,
				forkUrl: `http://127.0.0.1:${local.server.port}`,
			})

			// Verify fork server is working
			const res = yield* rpcCall(fork.server.port, "eth_chainId")
			expect(res.result).toBe("0x7a69")

			// Close fork server
			yield* fork.close()

			// After close, requests should fail
			const result = yield* Effect.tryPromise({
				try: () => httpPost(fork.server.port, JSON.stringify({ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 })),
				catch: (e) => e,
			}).pipe(Effect.either)

			expect(result._tag).toBe("Left")

			yield* local.close()
		}),
	)
})
