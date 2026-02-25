/**
 * Root CLI command definition for chop.
 *
 * Uses @effect/cli for declarative command/option/arg definitions.
 * Built-in --help, --version, --completions, --wizard are provided automatically.
 */

import { Command, Options } from "@effect/cli"
import { Console, Effect } from "effect"
import { abiCommands } from "./commands/abi.js"
import { addressCommands } from "./commands/address.js"
import { bytecodeCommands } from "./commands/bytecode.js"
import { chainCommands } from "./commands/chain.js"
import { convertCommands } from "./commands/convert.js"
import { cryptoCommands } from "./commands/crypto.js"
import { ensCommands } from "./commands/ens.js"
import { nodeCommands } from "./commands/node.js"
import { rpcCommands } from "./commands/rpc.js"
import { jsonOption, rpcUrlOption } from "./shared.js"
import { VERSION } from "./version.js"

// ---------------------------------------------------------------------------
// Global Options
// ---------------------------------------------------------------------------

/** --rpc-url / -r: optional at root level, required by RPC subcommands */
const optionalRpcUrl = rpcUrlOption.pipe(Options.optional)

// ---------------------------------------------------------------------------
// Root Command
// ---------------------------------------------------------------------------

/**
 * The root `chop` command.
 *
 * When invoked with no subcommand:
 * - If stdout is a TTY, launches the TUI (OpenTUI)
 * - Otherwise, prints a fallback message
 *
 * Global options (--json, --rpc-url) are available to all subcommands.
 */
export const root = Command.make(
	"chop",
	{ json: jsonOption, rpcUrl: optionalRpcUrl },
	({ json: _json, rpcUrl: _rpcUrl }) =>
		Effect.gen(function* () {
			// Non-interactive terminal — print fallback message
			if (!process.stdout.isTTY) {
				yield* Console.log("chop: TUI requires an interactive terminal. Use --help for CLI usage.")
				return
			}

			// Attempt to launch TUI via dynamic import (avoids loading OpenTUI in tests/CI)
			const tuiModule = yield* Effect.tryPromise({
				try: () => import("../tui/index.js"),
				catch: () => null,
			})

			if (!tuiModule) {
				yield* Console.log("chop: TUI requires Bun runtime. Install Bun from https://bun.sh")
				return
			}

			yield* tuiModule.startTui().pipe(Effect.catchTag("TuiError", (e) => Console.error(`TUI error: ${e.message}`)))
		}),
).pipe(
	Command.withDescription("Ethereum Swiss Army knife"),
	Command.withSubcommands([
		...abiCommands,
		...addressCommands,
		...bytecodeCommands,
		...chainCommands,
		...convertCommands,
		...cryptoCommands,
		...ensCommands,
		...rpcCommands,
		...nodeCommands,
	]),
)

// ---------------------------------------------------------------------------
// CLI Runner
// ---------------------------------------------------------------------------

/**
 * CLI runner — parses argv, dispatches to commands, handles --help/--version.
 *
 * Usage at the application edge:
 * ```ts
 * cli(process.argv).pipe(
 *   Effect.provide(NodeContext.layer),
 *   NodeRuntime.runMain
 * )
 * ```
 */
export const cli = Command.run(root, {
	name: "chop",
	version: VERSION,
})
