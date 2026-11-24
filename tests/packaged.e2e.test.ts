import { execFileSync, spawn } from "node:child_process"
import { mkdtemp, rename, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { expect, it } from "vitest"

const cli = resolve("dist/bin/chop.js")
const preamble = "// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\n"
const counter = `${preamble} contract Counter { uint public count = 42; }`

const start = (command: string, args: readonly string[]) => {
	const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] })
	let stdout = ""
	let stderr = ""
	let launchError: Error | undefined
	child.stdout.setEncoding("utf8").on("data", (text: string) => {
		stdout += text
	})
	child.stderr.setEncoding("utf8").on("data", (text: string) => {
		stderr += text
	})
	child.on("error", (error) => {
		launchError = error
	})
	const ended = new Promise<void>((done) => child.once("close", () => done()))
	return {
		stdout: () => stdout,
		stderr: () => stderr,
		waitFor: async (pattern: RegExp, read = () => stdout) => {
			await expect
				.poll(
					() => {
						if (launchError) throw launchError
						if (child.exitCode !== null) throw new Error(`Process exited ${child.exitCode}: ${stderr}`)
						return read().match(pattern)
					},
					{ timeout: 12_000 },
				)
				.not.toBeNull()
			return read().match(pattern)
		},
		stop: async () => {
			child.kill("SIGTERM")
			await ended
		},
	}
}

const rpc = async (url: string, method: string, params: readonly unknown[] = []): Promise<unknown> => {
	const response = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
	})
	expect(response.ok).toBe(true)
	const body = (await response.json()) as { result?: unknown; error?: unknown }
	expect(body.error).toBeUndefined()
	return body.result
}

it("packs the CLI and MCP binaries and serves MCP over stdio", async () => {
	const [pack] = JSON.parse(
		execFileSync("npm", ["pack", "--dry-run", "--ignore-scripts", "--json"], {
			encoding: "utf8",
		}),
	) as { files: { path: string; mode: number }[] }[]
	for (const file of ["dist/bin/chop.js", "dist/bin/chop-mcp.js"]) {
		const packed = pack?.files.find(({ path }) => path === file)
		expect(packed?.mode && packed.mode & 0o111).toBeTruthy()
	}
	expect(execFileSync(process.execPath, [cli, "--version"], { encoding: "utf8" })).toMatch(/^\d+\.\d+\.\d+/)
	const transport = new StdioClientTransport({ command: process.execPath, args: [resolve("dist/bin/chop-mcp.js")] })
	const client = new Client({ name: "chop-e2e", version: "1.0.0" })
	try {
		await client.connect(transport)
		expect((await client.listTools()).tools.map(({ name }) => name)).toContain("keccak256")
	} finally {
		await client.close()
	}
})

it("runs the packaged local RPC server on a dynamic port", { timeout: 20_000 }, async () => {
	const node = start(process.execPath, [cli, "node", "--port", "0", "--accounts", "1"])
	try {
		const port = (await node.waitFor(/Listening on http:\/\/127\.0\.0\.1:(\d+)/))?.[1]
		const url = `http://127.0.0.1:${port}`
		expect(await rpc(url, "eth_chainId")).toBe("0x7a69")
		expect(await rpc(url, "eth_accounts")).toHaveLength(1)
		const blocked = await fetch(url, {
			method: "POST",
			headers: { Origin: "https://example.com" },
			body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_accounts" }),
		})
		expect(blocked.status).toBe(403)
		const oversized = await fetch(url, { method: "POST", body: " ".repeat(1024 * 1024 + 1) })
		expect(oversized.status).toBe(413)
	} finally {
		await node.stop()
	}
})

it("recompiles imported files and deploys each successful compile to Anvil", { timeout: 45_000 }, async () => {
	const scratch = await mkdtemp(join(tmpdir(), "chop-e2e-"))
	const entry = join(scratch, "Counter.sol")
	const base = join(scratch, "Base.sol")
	const replacement = join(scratch, ".replace")
	const anvil = start("anvil", ["--port", "0", "--accounts", "1"])
	try {
		const listen = (await anvil.waitFor(/Listening on (127\.0\.0\.1:\d+)/))?.[1]
		const url = `http://${listen}`
		const [from] = (await rpc(url, "eth_accounts")) as string[]
		await writeFile(entry, counter.replace("contract Counter", 'import "./Base.sol"; contract Counter is Base'))
		await writeFile(base, `${preamble} contract Base {}`)
		const compiler = start(process.execPath, [
			cli,
			"compile",
			entry,
			"--format",
			"json",
			"--watch",
			"--deploy",
			url,
			"--from",
			String(from),
		])
		try {
			await compiler.waitFor(/Deployment submitted: 0x[0-9a-f]{64}/, compiler.stderr)
			const initialHash = compiler.stderr().match(/Deployment submitted: (0x[0-9a-f]{64})/)?.[1]
			const receipt = (await rpc(url, "eth_getTransactionReceipt", [initialHash])) as {
				status: string
				contractAddress: string
			}
			expect(receipt.status).toBe("0x1")
			expect(await rpc(url, "eth_getCode", [receipt.contractAddress, "latest"])).toMatch(/^0x[0-9a-f]+$/)
			expect(JSON.parse(compiler.stdout().trim()).contracts[0].abi[0].name).toBe("count")

			await writeFile(replacement, `${preamble} contract Base { uint public extra = 7; }`)
			await rename(replacement, base)
			await compiler.waitFor(/Deployment submitted:[\s\S]*Deployment submitted:/, compiler.stderr)
			const [first, second] = [...compiler.stderr().matchAll(/Deployment submitted: (0x[0-9a-f]{64})/g)]
			expect(first?.[1]).not.toBe(second?.[1])
			expect(await rpc(url, "eth_getTransactionReceipt", [second?.[1]])).toMatchObject({ status: "0x1" })
			expect(compiler.stdout()).toContain('"name":"extra"')
		} finally {
			await compiler.stop()
		}
	} finally {
		await anvil.stop()
		await rm(scratch, { recursive: true, force: true })
	}
})
