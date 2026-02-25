import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { describe, expect, it } from "vitest"
import { createRuntime } from "./runtime.js"
import { createServer } from "./server.js"

describe("MCP Server", () => {
	const setupClient = async () => {
		const runtime = createRuntime()
		const server = createServer(runtime)
		const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
		await server.connect(serverTransport)
		const client = new Client({ name: "test-client", version: "1.0.0" })
		await client.connect(clientTransport)
		return { client, server, runtime }
	}

	it("returns server info with correct name and version", async () => {
		const { client } = await setupClient()
		const info = client.getServerVersion()
		expect(info).toBeDefined()
		expect(info?.name).toBe("chop")
		expect(info?.version).toBe("0.1.0")
	})

	it("reports tool capabilities", async () => {
		const { client } = await setupClient()
		const caps = client.getServerCapabilities()
		expect(caps).toBeDefined()
	})

	it("exposes tools capability when tools are registered", async () => {
		const { client } = await setupClient()
		const caps = client.getServerCapabilities()
		expect(caps?.tools).toBeDefined()
	})

	it("lists all registered tools", async () => {
		const { client } = await setupClient()
		const { tools } = await client.listTools()
		expect(tools.length).toBeGreaterThan(0)
		// Verify a few key tools exist
		const names = tools.map((t) => t.name)
		expect(names).toContain("keccak256")
		expect(names).toContain("from_wei")
		expect(names).toContain("abi_encode")
		expect(names).toContain("to_checksum")
		expect(names).toContain("disassemble")
		expect(names).toContain("eth_call")
		expect(names).toContain("eth_blockNumber")
		expect(names).toContain("anvil_mine")
	})

	it("lists all registered prompts", async () => {
		const { client } = await setupClient()
		const { prompts } = await client.listPrompts()
		const names = prompts.map((p) => p.name)
		expect(names).toContain("analyze-contract")
		expect(names).toContain("debug-tx")
		expect(names).toContain("inspect-storage")
		expect(names).toContain("setup-test-env")
	})

	it("returns messages for analyze-contract prompt", async () => {
		const { client } = await setupClient()
		const result = await client.getPrompt({
			name: "analyze-contract",
			arguments: { address: "0x0000000000000000000000000000000000000001" },
		})
		expect(result.messages.length).toBeGreaterThan(0)
		const lastMsg = result.messages[result.messages.length - 1]
		const content = lastMsg?.content as { type: string; text: string }
		expect(content.text).toContain("0x0000000000000000000000000000000000000001")
	})

	it("returns messages for setup-test-env prompt (no args)", async () => {
		const { client } = await setupClient()
		const result = await client.getPrompt({ name: "setup-test-env" })
		expect(result.messages.length).toBeGreaterThan(0)
	})
})
