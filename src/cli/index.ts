/**
 * Root CLI command definition for chop.
 *
 * Uses @effect/cli for declarative command/option/arg definitions.
 * Built-in --help, --version, --completions, --wizard are provided automatically.
 */

import { Command, Options } from "@effect/cli"
import { Console } from "effect"
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
 * When invoked with no subcommand, prints TUI stub message.
 * Global options (--json, --rpc-url) are available to all subcommands.
 */
export const root = Command.make(
	"chop",
	{ json: jsonOption, rpcUrl: optionalRpcUrl },
	({ json: _json, rpcUrl: _rpcUrl }) => Console.log("TUI not yet implemented"),
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
