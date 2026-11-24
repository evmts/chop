import { readdirSync } from "node:fs"
import type { CliRenderer } from "@opentui/core"
import { type CompiledContract, compileSolidity } from "../../compiler/compile.js"
import { deployContract, localRpcUrl } from "../../compiler/deploy.js"
import { getOpenTui } from "../opentui.js"
import { DRACULA } from "../theme.js"

export function createCompiler(renderer: CliRenderer, rpcUrl?: string) {
	const { BoxRenderable, ScrollBoxRenderable, TextRenderable } = getOpenTui()
	const container = new BoxRenderable(renderer, { flexGrow: 1, flexDirection: "column", padding: 1 })
	const title = new TextRenderable(renderer, { content: "Solidity Compiler", fg: DRACULA.cyan })
	const selection = new TextRenderable(renderer, { content: "", fg: DRACULA.foreground })
	const status = new TextRenderable(renderer, { content: "", fg: DRACULA.comment })
	const output = new ScrollBoxRenderable(renderer, { flexGrow: 1 })
	const detail = new TextRenderable(renderer, { content: "", wrapMode: "char" })
	output.add(detail)
	container.add(title)
	container.add(selection)
	container.add(status)
	container.add(output)

	let files: string[] = []
	let fileIndex = 0
	let contractIndex = 0
	let artifacts: readonly CompiledContract[] = []
	let diagnostics = ""
	let busy = false
	let feedback = ""
	let confirming = false

	const render = () => {
		const artifact = artifacts[contractIndex]
		selection.content =
			files[fileIndex] === undefined
				? "No .sol files in the current directory"
				: `File: ${files[fileIndex]} (${fileIndex + 1}/${files.length})`
		status.content = confirming
			? `Submit ${artifact?.name} to ${rpcUrl}? [Enter] Confirm  [Esc] Cancel`
			: feedback || "[j/k] Select file  [Enter] Compile  [h/l] Select contract  [s/m] Scroll  [r] Refresh"
		detail.content = artifact
			? `${artifact.name} (${contractIndex + 1}/${artifacts.length})${rpcUrl ? "  [d] Deploy" : ""}\n\n${diagnostics}\n\nABI\n${JSON.stringify(artifact.abi, null, 2)}\n\nBytecode\n${artifact.bytecode}`
			: diagnostics
		renderer.requestRender()
	}

	const clear = () => {
		artifacts = []
		contractIndex = 0
		diagnostics = ""
		feedback = ""
	}

	const refresh = () => {
		if (busy || confirming) return
		const previous = files[fileIndex]
		try {
			files = readdirSync(".", { withFileTypes: true })
				.filter((entry) => entry.isFile() && entry.name.endsWith(".sol"))
				.map((entry) => entry.name)
				.sort()
			fileIndex = previous === undefined ? 0 : Math.max(0, files.indexOf(previous))
			if (previous !== files[fileIndex]) clear()
		} catch {
			files = []
			clear()
			feedback = "Unable to list Solidity files"
		}
		render()
	}

	const run = async (message: string, action: () => Promise<void>) => {
		busy = true
		feedback = message
		render()
		try {
			await action()
		} catch (error) {
			feedback = error instanceof Error ? error.message : String(error)
		} finally {
			busy = false
			render()
		}
	}

	const handleKey = (key: string) => {
		if (busy) return

		const current = artifacts[contractIndex]
		if (confirming) {
			if (key === "escape") {
				confirming = false
				render()
			} else if (key === "return" && current && rpcUrl) {
				confirming = false
				void run("Submitting deployment...", async () => {
					const hash = await deployContract(localRpcUrl(rpcUrl), current)
					feedback = `Deployment submitted: ${hash}`
				})
			}
			return
		}

		const path = files[fileIndex]
		switch (key) {
			case "r":
				refresh()
				return
			case "j":
			case "k": {
				const next = Math.max(0, Math.min(files.length - 1, fileIndex + (key === "j" ? 1 : -1)))
				if (next !== fileIndex) clear()
				fileIndex = next
				break
			}
			case "h":
			case "l":
				contractIndex = Math.max(0, Math.min(artifacts.length - 1, contractIndex + (key === "l" ? 1 : -1)))
				break
			case "m":
			case "s":
				output.scrollBy(key === "m" ? 5 : -5)
				return
			case "return":
				if (!path) return
				clear()
				void run(`Compiling ${path}...`, async () => {
					const result = await compileSolidity({ path }, { optimize: false, runs: 200 })
					diagnostics = result.diagnostics.map(({ formattedMessage }) => formattedMessage).join("\n")
					if (!result.diagnostics.some(({ severity }) => severity === "error")) artifacts = result.contracts
					feedback =
						artifacts.length > 0
							? `Compiled ${artifacts.length} contract(s) with solc ${result.version}`
							: "No contracts emitted"
				})
				return
			case "d":
				if (current && rpcUrl) confirming = true
				break
		}
		render()
	}

	return { container, handleKey, refresh, isConfirming: () => confirming }
}
