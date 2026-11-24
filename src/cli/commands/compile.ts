import { Args, Command, Options } from "@effect/cli"
import { Console, Effect, Option } from "effect"
import { compileSolidity, watchSolidity } from "../../compiler/compile.js"
import { deployContract, localRpcUrl } from "../../compiler/deploy.js"
import { handleCommandErrors } from "../shared.js"

const options = {
	file: Args.file({ name: "file" }).pipe(Args.optional),
	source: Options.text("source").pipe(Options.withDescription("Inline Solidity source"), Options.optional),
	format: Options.choice("format", ["json", "hex", "combined"]).pipe(Options.withDefault("combined")),
	contract: Options.text("contract").pipe(Options.withDescription("Select a contract by name"), Options.optional),
	optimize: Options.boolean("optimize"),
	runs: Options.integer("optimizer-runs").pipe(Options.withDefault(200)),
	evmVersion: Options.text("evm-version").pipe(Options.optional),
	watch: Options.boolean("watch"),
	deploy: Options.text("deploy").pipe(
		Options.withDescription("Submit bytecode to a loopback development RPC"),
		Options.optional,
	),
	from: Options.text("from").pipe(Options.withDescription("Unlocked sender for deployment"), Options.optional),
}

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error))

export const compileCommand = Command.make("compile", options, (args) =>
	Effect.tryPromise({
		try: async (signal) => {
			const path = Option.getOrUndefined(args.file)
			const inline = Option.getOrUndefined(args.source)
			if ((path === undefined) === (inline === undefined)) throw new Error("Supply either a file or --source")
			if (args.watch && path === undefined) throw new Error("--watch requires a file")
			const deploy = Option.getOrUndefined(args.deploy)
			const from = Option.getOrUndefined(args.from)
			if ((deploy === undefined) !== (from === undefined)) throw new Error("--deploy requires --from, and vice versa")
			const rpc = deploy === undefined ? undefined : localRpcUrl(deploy)
			const source = path === undefined ? { inline: inline ?? "" } : { path }

			const run = async (files?: Map<string, string | undefined>) => {
				const result = await compileSolidity(
					source,
					{
						optimize: args.optimize,
						runs: args.runs,
						evmVersion: Option.getOrUndefined(args.evmVersion),
					},
					files,
				)
				const diagnostics = result.diagnostics.map(({ formattedMessage }) => formattedMessage.trimEnd())
				if (result.diagnostics.some(({ severity }) => severity === "error")) {
					throw new Error(diagnostics.join("\n"))
				}
				for (const diagnostic of diagnostics) await Effect.runPromise(Console.error(diagnostic))

				const name = Option.getOrUndefined(args.contract)
				const contracts =
					name === undefined ? result.contracts : result.contracts.filter((contract) => contract.name === name)
				if (contracts.length === 0)
					throw new Error(name === undefined ? "No contracts in entry source" : `Unknown contract: ${name}`)
				const selected = contracts[0]
				if ((args.format === "hex" || rpc) && (contracts.length !== 1 || selected === undefined)) {
					throw new Error("Select a single contract with --contract")
				}
				switch (args.format) {
					case "json":
						await Effect.runPromise(Console.log(JSON.stringify({ ...result, contracts })))
						break
					case "hex":
						await Effect.runPromise(Console.log(selected?.bytecode))
						break
					case "combined":
						for (const contract of contracts) {
							await Effect.runPromise(
								Console.log(`${contract.name}\nABI: ${JSON.stringify(contract.abi)}\nBytecode: ${contract.bytecode}`),
							)
						}
						break
				}
				if (rpc && selected) {
					const hash = await deployContract(rpc, selected, from)
					await Effect.runPromise(Console.error(`Deployment submitted: ${hash}`))
				}
			}

			if (!args.watch) return run()
			await watchSolidity(async (files) => {
				try {
					await run(files)
				} catch (error) {
					await Effect.runPromise(Console.error(messageOf(error)))
				}
			}, signal)
		},
		catch: (error) => new Error(messageOf(error)),
	}).pipe(handleCommandErrors),
).pipe(Command.withDescription("Compile Solidity from a file or inline source"))
