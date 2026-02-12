/**
 * `chop node` command — start a local Ethereum JSON-RPC devnet.
 *
 * Starts an HTTP server, creates pre-funded test accounts,
 * prints a startup banner, and blocks until Ctrl+C.
 */

import { Command, Options } from "@effect/cli"
import { Console, Effect } from "effect"
import { type TestAccount, getTestAccounts } from "../../node/accounts.js"
import { TevmNode, TevmNodeService } from "../../node/index.js"
import type { RpcServer } from "../../rpc/server.js"
import { startRpcServer } from "../../rpc/server.js"

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

const portOption = Options.integer("port").pipe(
	Options.withAlias("p"),
	Options.withDescription("Port to listen on"),
	Options.withDefault(8545),
)

const chainIdOption = Options.integer("chain-id").pipe(
	Options.withDescription("Chain ID for the local devnet"),
	Options.withDefault(31337),
)

const accountsOption = Options.integer("accounts").pipe(
	Options.withAlias("a"),
	Options.withDescription("Number of pre-funded test accounts (max 10)"),
	Options.withDefault(10),
)

// ---------------------------------------------------------------------------
// Banner formatter (pure)
// ---------------------------------------------------------------------------

/**
 * Format the startup banner with accounts and listening URL.
 *
 * @param port - The port the server is listening on.
 * @param accounts - The pre-funded test accounts.
 * @returns A formatted banner string.
 */
export const formatBanner = (port: number, accounts: readonly TestAccount[]): string => {
	const lines: string[] = []

	lines.push("")
	lines.push("  ⛏️  chop node")
	lines.push("  ═══════════════════════════════════════════════════════════════")
	lines.push("")

	if (accounts.length > 0) {
		lines.push("  Available Accounts")
		lines.push("  ───────────────────────────────────────────────────────────────")
		for (let i = 0; i < accounts.length; i++) {
			lines.push(`  (${i}) ${accounts[i]!.address} (10000 ETH)`)
		}
		lines.push("")

		lines.push("  Private Keys")
		lines.push("  ───────────────────────────────────────────────────────────────")
		for (let i = 0; i < accounts.length; i++) {
			lines.push(`  (${i}) ${accounts[i]!.privateKey}`)
		}
		lines.push("")
	}

	lines.push(`  Listening on http://127.0.0.1:${port}`)
	lines.push("")

	return lines.join("\n")
}

// ---------------------------------------------------------------------------
// Server starter (testable, separated from CLI wiring)
// ---------------------------------------------------------------------------

/** Options for startNodeServer. */
export interface NodeServerOptions {
	readonly port: number
	readonly chainId?: bigint
	readonly accounts?: number
}

/**
 * Start a local devnet server with pre-funded accounts.
 * Returns the server instance, accounts, and a close function.
 *
 * This is the testable core — no CLI dependency, no blocking.
 */
export const startNodeServer = (
	options: NodeServerOptions,
): Effect.Effect<{
	readonly server: RpcServer
	readonly accounts: readonly TestAccount[]
	readonly close: () => Effect.Effect<void>
}> =>
	Effect.gen(function* () {
		const nodeLayer = TevmNode.LocalTest({
			chainId: options.chainId,
			accounts: options.accounts,
		})

		const node = yield* Effect.provide(TevmNodeService, nodeLayer)
		const server = yield* startRpcServer({ port: options.port }, node)

		return {
			server,
			accounts: node.accounts,
			close: server.close,
		}
	})

// ---------------------------------------------------------------------------
// Command definition
// ---------------------------------------------------------------------------

/**
 * `chop node` — start a local Ethereum devnet.
 *
 * Prints a banner with funded accounts and private keys,
 * starts an HTTP JSON-RPC server, and blocks until interrupted.
 */
export const nodeCommand = Command.make(
	"node",
	{ port: portOption, chainId: chainIdOption, accounts: accountsOption },
	({ port, chainId, accounts: accountsCount }) =>
		Effect.gen(function* () {
			const { server, accounts } = yield* startNodeServer({
				port,
				chainId: BigInt(chainId),
				accounts: accountsCount,
			})

			// Print startup banner
			yield* Console.log(formatBanner(server.port, accounts))

			// Block until interrupted (Ctrl+C)
			yield* Effect.never.pipe(
				Effect.onInterrupt(() =>
					Effect.gen(function* () {
						yield* server.close()
						yield* Console.log("\n  Shutting down...")
					}),
				),
			)
		}),
).pipe(Command.withDescription("Start a local Ethereum devnet"))

// ---------------------------------------------------------------------------
// Export for registration
// ---------------------------------------------------------------------------

export const nodeCommands = [nodeCommand] as const
