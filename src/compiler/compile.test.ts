import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, it } from "vitest"
import { compileSolidity } from "./compile.js"
import { localRpcUrl } from "./deploy.js"

const options = { optimize: true, runs: 200, evmVersion: "cancun" }
const preamble = "// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\n"

it("compiles inline Solidity to creation bytecode, runtime bytecode and an ABI", async () => {
	const result = await compileSolidity({ inline: `${preamble} contract Counter { uint public count; }` }, options)
	expect(result.version).toMatch(/^0\.8\./)
	expect(result.diagnostics).toEqual([])
	expect(result.contracts).toEqual([
		{
			name: "Counter",
			abi: [expect.objectContaining({ name: "count" })],
			bytecode: expect.stringMatching(/^0x[0-9a-f]+$/),
			deployedBytecode: expect.stringMatching(/^0x[0-9a-f]+$/),
		},
	])
})

it("tracks local imports and refuses to read symlinks outside the project", async () => {
	const scratch = await mkdtemp(join(tmpdir(), "chop-solidity-"))
	const root = await mkdtemp(join(scratch, "project-"))
	try {
		const entry = join(root, "Entry.sol")
		const dependency = join(root, "Base.sol")
		const base = `${preamble} contract Base {}`
		await writeFile(entry, `${preamble} import "./Base.sol"; contract Entry is Base {}`)
		await writeFile(dependency, base)
		const files = new Map()
		const result = await compileSolidity({ path: entry }, options, files)
		expect(result.contracts.map(({ name }) => name)).toEqual(["Entry"])
		expect(files.get(dependency)).toBe(base)

		const outside = join(scratch, "Outside.sol")
		await rm(dependency)
		await writeFile(outside, base)
		await symlink(outside, dependency)
		const denied = await compileSolidity({ path: entry }, options)
		expect(denied.contracts).toEqual([])
		expect(denied.diagnostics).toContainEqual(
			expect.objectContaining({
				severity: "error",
				formattedMessage: expect.stringContaining("Import is outside the source directory"),
			}),
		)
	} finally {
		await rm(scratch, { recursive: true, force: true })
	}
})

it("validates optimizer settings and deployment URLs", async () => {
	await expect(compileSolidity({ inline: "" }, { ...options, runs: -1 })).rejects.toThrow("Optimizer runs")
	expect(localRpcUrl("http://[::1]:8545/").hostname).toBe("[::1]")
	expect(() => localRpcUrl("https://example.com")).toThrow("loopback")
	expect(() => localRpcUrl("http://user:password@localhost:8545")).toThrow("loopback")
})
