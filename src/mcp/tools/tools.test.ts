/**
 * MCP tool integration tests.
 *
 * Tests each tool group by calling tools through the MCP client,
 * verifying correct responses and error handling.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { describe, expect, it } from "vitest"
import { createTestRuntime } from "../runtime.js"
import { createServer } from "../server.js"

const setupClient = async () => {
	const runtime = createTestRuntime()
	const server = createServer(runtime)
	const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
	await server.connect(serverTransport)
	const client = new Client({ name: "test-client", version: "1.0.0" })
	await client.connect(clientTransport)
	return { client, server, runtime }
}

const callTool = async (client: Client, name: string, args: Record<string, unknown> = {}) => {
	const result = await client.callTool({ name, arguments: args })
	return result
}

const getText = (result: Awaited<ReturnType<typeof callTool>>): string => {
	const content = result.content as Array<{ type: string; text: string }>
	return content[0]?.text ?? ""
}

// ============================================================================
// Crypto Tools
// ============================================================================

describe("crypto tools", () => {
	it("keccak256 hashes a string", async () => {
		const { client } = await setupClient()
		const result = await callTool(client, "keccak256", { data: "hello" })
		const text = getText(result)
		expect(text).toMatch(/^0x[0-9a-f]{64}$/)
		// Known keccak256("hello") hash
		expect(text).toBe("0x1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8")
	})

	it("keccak256 hashes hex bytes", async () => {
		const { client } = await setupClient()
		const result = await callTool(client, "keccak256", { data: "0xdeadbeef" })
		const text = getText(result)
		expect(text).toMatch(/^0x[0-9a-f]{64}$/)
	})

	it("function_selector computes selector", async () => {
		const { client } = await setupClient()
		const result = await callTool(client, "function_selector", { signature: "transfer(address,uint256)" })
		const text = getText(result)
		expect(text).toBe("0xa9059cbb")
	})

	it("event_topic computes topic", async () => {
		const { client } = await setupClient()
		const result = await callTool(client, "event_topic", { signature: "Transfer(address,address,uint256)" })
		const text = getText(result)
		expect(text).toMatch(/^0x[0-9a-f]{64}$/)
		expect(text).toBe("0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef")
	})
})

// ============================================================================
// Convert Tools
// ============================================================================

describe("convert tools", () => {
	it("from_wei converts wei to ether", async () => {
		const { client } = await setupClient()
		const result = await callTool(client, "from_wei", { amount: "1000000000000000000" })
		const text = getText(result)
		expect(text).toBe("1.000000000000000000")
	})

	it("to_wei converts ether to wei", async () => {
		const { client } = await setupClient()
		const result = await callTool(client, "to_wei", { amount: "1.5" })
		const text = getText(result)
		expect(text).toBe("1500000000000000000")
	})

	it("to_hex converts decimal to hex", async () => {
		const { client } = await setupClient()
		const result = await callTool(client, "to_hex", { value: "255" })
		const text = getText(result)
		expect(text).toBe("0xff")
	})

	it("to_dec converts hex to decimal", async () => {
		const { client } = await setupClient()
		const result = await callTool(client, "to_dec", { value: "0xff" })
		const text = getText(result)
		expect(text).toBe("255")
	})
})

// ============================================================================
// ABI Tools
// ============================================================================

describe("abi tools", () => {
	it("abi_encode encodes a uint256", async () => {
		const { client } = await setupClient()
		const result = await callTool(client, "abi_encode", {
			signature: "(uint256)",
			args: ["42"],
		})
		const text = getText(result)
		expect(text).toMatch(/^0x/)
		// uint256(42) should end with 2a padded to 32 bytes
		expect(text).toContain("2a")
	})

	it("abi_decode decodes a uint256", async () => {
		const { client } = await setupClient()
		// ABI-encoded uint256(42) = 0x + 32 bytes of zero-padded 42
		const encoded = "0x000000000000000000000000000000000000000000000000000000000000002a"
		const result = await callTool(client, "abi_decode", {
			signature: "(uint256)",
			data: encoded,
		})
		const text = getText(result)
		expect(text).toBe("42")
	})

	it("encode_calldata encodes function calldata", async () => {
		const { client } = await setupClient()
		const result = await callTool(client, "encode_calldata", {
			signature: "transfer(address,uint256)",
			args: ["0x0000000000000000000000000000000000000001", "100"],
		})
		const text = getText(result)
		expect(text).toMatch(/^0x/)
		// Should start with transfer selector
		expect(text.slice(0, 10)).toBe("0xa9059cbb")
	})

	it("decode_calldata decodes function calldata", async () => {
		const { client } = await setupClient()
		// First encode, then decode
		const encoded = await callTool(client, "encode_calldata", {
			signature: "transfer(address,uint256)",
			args: ["0x0000000000000000000000000000000000000001", "100"],
		})
		const result = await callTool(client, "decode_calldata", {
			signature: "transfer(address,uint256)",
			data: getText(encoded),
		})
		const text = getText(result)
		const parsed = JSON.parse(text)
		expect(parsed.name).toBe("transfer")
	})
})

// ============================================================================
// Address Tools
// ============================================================================

describe("address tools", () => {
	it("to_checksum checksums an address", async () => {
		const { client } = await setupClient()
		const result = await callTool(client, "to_checksum", {
			address: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
		})
		const text = getText(result)
		expect(text).toBe("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")
	})

	it("compute_address computes CREATE address", async () => {
		const { client } = await setupClient()
		const result = await callTool(client, "compute_address", {
			deployer: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
			nonce: "0",
		})
		const text = getText(result)
		expect(text).toMatch(/^0x[0-9a-fA-F]{40}$/)
	})
})

// ============================================================================
// Bytecode Tools
// ============================================================================

describe("bytecode tools", () => {
	it("disassemble disassembles bytecode", async () => {
		const { client } = await setupClient()
		// PUSH1 0x60 PUSH1 0x40 MSTORE
		const result = await callTool(client, "disassemble", { bytecode: "0x6060604052" })
		const text = getText(result)
		expect(text).toContain("PUSH1")
		expect(text).toContain("MSTORE")
	})

	it("disassemble handles empty bytecode", async () => {
		const { client } = await setupClient()
		const result = await callTool(client, "disassemble", { bytecode: "0x" })
		const text = getText(result)
		expect(text).toBe("")
	})
})

// ============================================================================
// Node-dependent Tools (chain, contract, devnet)
// ============================================================================

describe("devnet tools", () => {
	it("eth_accounts returns test accounts", async () => {
		const { client } = await setupClient()
		const result = await callTool(client, "eth_accounts")
		const text = getText(result)
		const accounts = JSON.parse(text)
		expect(accounts).toBeInstanceOf(Array)
		expect(accounts.length).toBeGreaterThan(0)
	})

	it("eth_blockNumber returns current block", async () => {
		const { client } = await setupClient()
		const result = await callTool(client, "eth_blockNumber")
		const text = getText(result)
		expect(text).toMatch(/^0x[0-9a-f]+$/)
	})

	it("eth_chainId returns chain id", async () => {
		const { client } = await setupClient()
		const result = await callTool(client, "eth_chainId")
		const text = getText(result)
		expect(text).toMatch(/^0x[0-9a-f]+$/)
	})

	it("anvil_mine mines a block", async () => {
		const { client } = await setupClient()
		const result = await callTool(client, "anvil_mine", { blocks: 1 })
		const text = getText(result)
		expect(text).toContain("Mined")
	})

	it("anvil_setBalance sets balance", async () => {
		const { client } = await setupClient()
		const addr = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
		await callTool(client, "anvil_setBalance", {
			address: addr,
			balance: "1000000000000000000",
		})
		const result = await callTool(client, "eth_getBalance", { address: addr })
		const text = getText(result)
		expect(text).toContain("1000000000000000000")
	})

	it("evm_snapshot and evm_revert round-trips", async () => {
		const { client } = await setupClient()
		const snapResult = await callTool(client, "evm_snapshot")
		const snapText = getText(snapResult)
		expect(snapText).toContain("Snapshot ID:")

		// Extract ID from "Snapshot ID: X"
		const id = snapText.replace("Snapshot ID: ", "").trim()

		const revertResult = await callTool(client, "evm_revert", { id })
		const revertText = getText(revertResult)
		expect(revertText).toContain("Reverted:")
	})
})
