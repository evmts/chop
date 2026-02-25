/**
 * MCP resource integration tests.
 *
 * Tests resource templates, static resources, and dynamic resource reading
 * through the MCP client, verifying correct responses and data formats.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { describe, expect, it } from "vitest"
import { createTestRuntime } from "./runtime.js"
import { createServer } from "./server.js"

/** Extract text from a resource content entry (handles text | blob union). */
const getResourceText = (content: { uri: string; text?: string; blob?: string }): string =>
	(content as { text: string }).text ?? ""

const setupClient = async () => {
	const runtime = createTestRuntime()
	const server = createServer(runtime)
	const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
	await server.connect(serverTransport)
	const client = new Client({ name: "test-client", version: "1.0.0" })
	await client.connect(clientTransport)
	return { client, server, runtime }
}

// ============================================================================
// Resource Templates
// ============================================================================

describe("resource templates", () => {
	it("lists all 4 resource templates", async () => {
		const { client } = await setupClient()
		const result = await client.listResourceTemplates()

		expect(result.resourceTemplates).toHaveLength(4)

		const names = result.resourceTemplates.map((t) => t.name)
		expect(names).toContain("Account Balance")
		expect(names).toContain("Storage Slot")
		expect(names).toContain("Block")
		expect(names).toContain("Transaction")
	})

	it("Account Balance template has correct structure", async () => {
		const { client } = await setupClient()
		const result = await client.listResourceTemplates()

		const template = result.resourceTemplates.find((t) => t.name === "Account Balance")
		expect(template).toBeDefined()
		expect(template?.uriTemplate).toBe("chop://account/{address}/balance")
		expect(template?.description).toBe("ETH balance of an Ethereum address in wei")
		expect(template?.mimeType).toBe("text/plain")
	})

	it("Storage Slot template has correct structure", async () => {
		const { client } = await setupClient()
		const result = await client.listResourceTemplates()

		const template = result.resourceTemplates.find((t) => t.name === "Storage Slot")
		expect(template).toBeDefined()
		expect(template?.uriTemplate).toBe("chop://account/{address}/storage/{slot}")
		expect(template?.description).toBe("Raw 32-byte storage slot value of a contract")
		expect(template?.mimeType).toBe("text/plain")
	})

	it("Block template has correct structure", async () => {
		const { client } = await setupClient()
		const result = await client.listResourceTemplates()

		const template = result.resourceTemplates.find((t) => t.name === "Block")
		expect(template).toBeDefined()
		expect(template?.uriTemplate).toBe("chop://block/{numberOrTag}")
		expect(template?.description).toBe("Block details by number or tag (latest, earliest, pending)")
		expect(template?.mimeType).toBe("application/json")
	})

	it("Transaction template has correct structure", async () => {
		const { client } = await setupClient()
		const result = await client.listResourceTemplates()

		const template = result.resourceTemplates.find((t) => t.name === "Transaction")
		expect(template).toBeDefined()
		expect(template?.uriTemplate).toBe("chop://tx/{hash}")
		expect(template?.description).toBe("Transaction details by hash")
		expect(template?.mimeType).toBe("application/json")
	})
})

// ============================================================================
// Static Resources
// ============================================================================

describe("static resources", () => {
	it("lists node/status and node/accounts", async () => {
		const { client } = await setupClient()
		const result = await client.listResources()

		expect(result.resources).toHaveLength(2)

		const uris = result.resources.map((r) => r.uri)
		expect(uris).toContain("chop://node/status")
		expect(uris).toContain("chop://node/accounts")
	})

	it("node/status resource has correct metadata", async () => {
		const { client } = await setupClient()
		const result = await client.listResources()

		const resource = result.resources.find((r) => r.uri === "chop://node/status")
		expect(resource).toBeDefined()
		expect(resource?.name).toBe("Node Status")
		expect(resource?.description).toBe("Current node status including block number and chain ID")
		expect(resource?.mimeType).toBe("application/json")
	})

	it("node/accounts resource has correct metadata", async () => {
		const { client } = await setupClient()
		const result = await client.listResources()

		const resource = result.resources.find((r) => r.uri === "chop://node/accounts")
		expect(resource).toBeDefined()
		expect(resource?.name).toBe("Node Accounts")
		expect(resource?.description).toBe("Pre-funded test accounts available on the local devnet")
		expect(resource?.mimeType).toBe("application/json")
	})
})

// ============================================================================
// Reading Resources
// ============================================================================

describe("reading resources", () => {
	it("reads chop://node/status", async () => {
		const { client } = await setupClient()
		const result = await client.readResource({ uri: "chop://node/status" })

		expect(result.contents).toHaveLength(1)

		const content = result.contents[0]
		expect(content?.uri).toBe("chop://node/status")
		expect(content?.mimeType).toBe("application/json")

		const text = content ? getResourceText(content) : ""
		const data = JSON.parse(text)

		expect(data).toHaveProperty("blockNumber")
		expect(data).toHaveProperty("chainId")
		expect(data.blockNumber).toMatch(/^0x[0-9a-f]+$/)
		expect(data.chainId).toMatch(/^0x[0-9a-f]+$/)
	})

	it("reads chop://node/accounts", async () => {
		const { client } = await setupClient()
		const result = await client.readResource({ uri: "chop://node/accounts" })

		expect(result.contents).toHaveLength(1)

		const content = result.contents[0]
		expect(content?.uri).toBe("chop://node/accounts")
		expect(content?.mimeType).toBe("application/json")

		const text = content ? getResourceText(content) : ""
		const accounts = JSON.parse(text)

		expect(Array.isArray(accounts)).toBe(true)
		expect(accounts.length).toBeGreaterThan(0)
		// Check first account is a valid address
		expect(accounts[0]).toMatch(/^0x[0-9a-fA-F]{40}$/)
	})

	it("reads chop://block/latest", async () => {
		const { client } = await setupClient()
		const result = await client.readResource({ uri: "chop://block/latest" })

		expect(result.contents).toHaveLength(1)

		const content = result.contents[0]
		expect(content?.uri).toBe("chop://block/latest")
		expect(content?.mimeType).toBe("application/json")

		const text = content ? getResourceText(content) : ""
		const block = JSON.parse(text)

		// Verify block has expected fields
		expect(block).toHaveProperty("number")
		expect(block).toHaveProperty("hash")
		expect(block).toHaveProperty("timestamp")
		expect(block).toHaveProperty("gasLimit")
	})

	it("reads chop://block/0 (genesis)", async () => {
		const { client } = await setupClient()
		const result = await client.readResource({ uri: "chop://block/0" })

		expect(result.contents).toHaveLength(1)

		const content = result.contents[0]
		expect(content?.uri).toBe("chop://block/0")
		expect(content?.mimeType).toBe("application/json")

		const text = content ? getResourceText(content) : ""
		const block = JSON.parse(text)

		expect(block.number).toBe("0x0")
	})

	it("reads account balance via template", async () => {
		const { client } = await setupClient()
		// Use a test account address
		const address = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
		const uri = `chop://account/${address}/balance`
		const result = await client.readResource({ uri })

		expect(result.contents).toHaveLength(1)

		const content = result.contents[0]
		expect(content?.uri).toBe(uri)
		expect(content?.mimeType).toBe("text/plain")

		const text = content ? getResourceText(content) : ""
		// Should contain hex value and wei amount
		expect(text).toMatch(/^0x[0-9a-f]+/)
		expect(text).toContain("wei")
	})

	it("reads storage slot via template", async () => {
		const { client } = await setupClient()
		// Use any address and slot 0 (properly padded)
		const address = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
		const slot = "0x00"
		const uri = `chop://account/${address}/storage/${slot}`
		const result = await client.readResource({ uri })

		expect(result.contents).toHaveLength(1)

		const content = result.contents[0]
		expect(content?.uri).toBe(uri)
		expect(content?.mimeType).toBe("text/plain")

		const text = content ? getResourceText(content) : ""
		// Should be a 32-byte hex value (0x + 64 hex chars)
		expect(text).toMatch(/^0x[0-9a-f]{64}$/)
	})
})
