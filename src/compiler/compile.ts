import { readFileSync, realpathSync } from "node:fs"
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path"
import { setTimeout } from "node:timers/promises"

export type SoliditySource = { readonly path: string } | { readonly inline: string }

export interface CompilerOptions {
	readonly optimize: boolean
	readonly runs: number
	readonly evmVersion?: string | undefined
}

interface Diagnostic {
	readonly severity: string
	readonly formattedMessage: string
}

interface SolcContract {
	readonly abi: readonly unknown[]
	readonly evm: {
		readonly bytecode: { readonly object: string }
		readonly deployedBytecode: { readonly object: string }
	}
}

export interface CompiledContract {
	readonly name: string
	readonly abi: readonly unknown[]
	readonly bytecode: string
	readonly deployedBytecode: string
}

interface Compilation {
	readonly version: string
	readonly contracts: readonly CompiledContract[]
	readonly diagnostics: readonly Diagnostic[]
}

export class SolidityCompileError extends Error {
	constructor(message: string) {
		super(message)
		this.name = "SolidityCompileError"
	}
}

const readSource = (path: string): string | undefined => {
	try {
		return readFileSync(path, "utf8")
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined
		throw error
	}
}

const within = (root: string, path: string): boolean => {
	const location = relative(root, path)
	return location !== ".." && !location.startsWith(`..${sep}`) && !isAbsolute(location)
}

/** Compile the entry source. File imports are confined to the entry file's directory. */
export async function compileSolidity(
	source: SoliditySource,
	options: CompilerOptions,
	files = new Map<string, string | undefined>(),
): Promise<Compilation> {
	if (!Number.isSafeInteger(options.runs) || options.runs < 0 || options.runs > 0xffffffff) {
		throw new SolidityCompileError("Optimizer runs must be an integer between 0 and 4294967295")
	}
	const path = "path" in source ? resolve(source.path) : undefined
	const entry = path ? basename(path) : "Input.sol"
	const root = path ? dirname(path) : undefined
	const contents = "inline" in source ? source.inline : readSource(resolve(source.path))
	if (path) files.set(path, contents)
	if (contents === undefined) throw new SolidityCompileError(`Source file not found: ${path}`)

	const solc = (await import("solc")).default
	const input = {
		language: "Solidity",
		sources: { [entry]: { content: contents } },
		settings: {
			optimizer: { enabled: options.optimize, runs: options.runs },
			evmVersion: options.evmVersion ?? "prague",
			outputSelection: { "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"] } },
		},
	}
	const output = JSON.parse(
		solc.compile(JSON.stringify(input), {
			import: (name) => {
				if (!root || isAbsolute(name)) return { error: "Only relative file imports are supported" }
				const imported = resolve(root, name)
				if (!within(root, imported)) return { error: "Import is outside the source directory" }
				try {
					const target = realpathSync(imported)
					if (!within(realpathSync(root), target)) return { error: "Import is outside the source directory" }
					const contents = readSource(imported)
					files.set(imported, contents)
					return contents === undefined ? { error: "Import file not found" } : { contents }
				} catch (error) {
					if ((error as NodeJS.ErrnoException).code === "ENOENT") files.set(imported, undefined)
					return { error: "Unable to read import file" }
				}
			},
		}),
	) as {
		readonly errors?: readonly Diagnostic[]
		readonly contracts?: Record<string, Record<string, SolcContract>>
	}
	const contracts = Object.entries(output.contracts?.[entry] ?? {}).map(([name, contract]) => ({
		name,
		abi: contract.abi,
		bytecode: `0x${contract.evm.bytecode.object}`,
		deployedBytecode: `0x${contract.evm.deployedBytecode.object}`,
	}))
	return { version: solc.version(), contracts, diagnostics: output.errors ?? [] }
}

/** Run once immediately and again when the entry or an imported file changes. */
export async function watchSolidity(
	compile: (files: Map<string, string | undefined>) => Promise<void>,
	signal: AbortSignal,
): Promise<void> {
	const files = new Map<string, string | undefined>()
	await compile(files)
	while (!signal.aborted) {
		try {
			await setTimeout(300, undefined, { signal })
		} catch (error) {
			if (signal.aborted) return
			throw error
		}
		if ([...files].some(([path, content]) => readSource(path) !== content)) {
			files.clear()
			await compile(files)
		}
	}
}
