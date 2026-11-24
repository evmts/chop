import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const directory = mkdtempSync(join(tmpdir(), "chop-package-"))
const command = (file, args) => execFileSync(file, args, { cwd: directory, stdio: "inherit" })

try {
	const archive = execFileSync("npm", ["pack", "--ignore-scripts", "--silent", "--pack-destination", directory], {
		encoding: "utf8",
	}).trim()
	writeFileSync(join(directory, "package.json"), '{"private":true}\n')
	command("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", `./${archive}`])
	command("npm", ["audit", "--audit-level=high", "--omit=dev"])
	const bin = join(directory, "node_modules", "@tevm", "chop", "dist", "bin", "chop.js")
	command(process.execPath, [bin, "--version"])
	const bytecode = execFileSync(process.execPath, [
		bin, "compile", "--source", "// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0; contract Packaged {}",
		"--format", "hex",
	], { cwd: directory, encoding: "utf8" }).trim()
	if (!/^0x[0-9a-f]+$/.test(bytecode)) throw new Error("Installed compiler failed to emit bytecode")
} finally {
	rmSync(directory, { recursive: true, force: true })
}
