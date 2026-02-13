/**
 * `chop node` command — start a local Ethereum JSON-RPC devnet.
 *
 * Starts an HTTP server, creates pre-funded test accounts,
 * prints a startup banner, and blocks until Ctrl+C.
 *
 * Supports fork mode with --fork-url and --fork-block-number.
 */

import { Command, Options } from "@effect/cli"
import { Console, Effect } from "effect"
import { DEFAULT_BALANCE, type TestAccount } from "../../node/accounts.js"
import type { ForkDataError } from "../../node/fork/errors.js"
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

const forkUrlOption = Options.text("fork-url").pipe(
	Options.withAlias("f"),
	Options.withDescription("Fork from a remote RPC URL"),
	Options.optional,
)

const forkBlockNumberOption = Options.integer("fork-block-number").pipe(
	Options.withDescription("Pin fork to a specific block number (default: latest)"),
	Options.optional,
)

// ---------------------------------------------------------------------------
// Banner formatter (pure)
// ---------------------------------------------------------------------------

/**
 * Format the startup banner with accounts and listening URL.
 *
 * @param port - The port the server is listening on.
 * @param accounts - The pre-funded test accounts.
 * @param forkUrl - Optional fork URL to display.
 * @param forkBlockNumber - Optional fork block number to display.
 * @returns A formatted banner string.
 */
export const formatBanner = (
	port: number,
	accounts: readonly TestAccount[],
	forkUrl?: string,
	forkBlockNumber?: bigint,
): string => {
	const ethAmount = DEFAULT_BALANCE / 10n ** 18n
	const lines: string[] = []

	lines.push("")
	lines.push("  ⛏️  chop node")
	lines.push("  ═══════════════════════════════════════════════════════════════")
	lines.push("")

	if (forkUrl !== undefined) {
		lines.push("  Fork Mode")
		lines.push("  ───────────────────────────────────────────────────────────────")
		lines.push(`  Fork URL: ${forkUrl}`)
		if (forkBlockNumber !== undefined) {
			lines.push(`  Block Number: ${forkBlockNumber}`)
		}
		lines.push("")
	}

	if (accounts.length > 0) {
		lines.push("  Available Accounts")
		lines.push("  ───────────────────────────────────────────────────────────────")
		for (let i = 0; i < accounts.length; i++) {
			lines.push(`  (${i}) ${accounts[i]?.address} (${ethAmount} ETH)`)
		}
		lines.push("")

		lines.push("  Private Keys")
		lines.push("  ───────────────────────────────────────────────────────────────")
		for (let i = 0; i < accounts.length; i++) {
			lines.push(`  (${i}) ${accounts[i]?.privateKey}`)
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
	readonly forkUrl?: string
	readonly forkBlockNumber?: bigint
}

/**
 * Start a local devnet server with pre-funded accounts.
 * Returns the server instance, accounts, and a close function.
 *
 * This is the testable core — no CLI dependency, no blocking.
 */
export const startNodeServer = (
	options: NodeServerOptions,
): Effect.Effect<
	{
		readonly server: RpcServer
		readonly accounts: readonly TestAccount[]
		readonly close: () => Effect.Effect<void>
		readonly forkBlockNumber?: bigint
	},
	ForkDataError
> =>
	Effect.gen(function* () {
		if (options.forkUrl !== undefined) {
			// Fork mode
			const forkNodeLayer = yield* TevmNode.ForkTest({
				forkUrl: options.forkUrl,
				...(options.forkBlockNumber !== undefined ? { forkBlockNumber: options.forkBlockNumber } : {}),
				...(options.chainId !== undefined ? { chainId: options.chainId } : {}),
				...(options.accounts !== undefined ? { accounts: options.accounts } : {}),
			})

			const node = yield* Effect.provide(TevmNodeService, forkNodeLayer)
			const server = yield* startRpcServer({ port: options.port }, node)

			return {
				server,
				accounts: node.accounts,
				close: server.close,
				...(options.forkBlockNumber !== undefined ? { forkBlockNumber: options.forkBlockNumber } : {}),
			}
		}

		// Local mode
		const nodeOpts = {
			...(options.chainId !== undefined ? { chainId: options.chainId } : {}),
			...(options.accounts !== undefined ? { accounts: options.accounts } : {}),
		}
		const nodeLayer = TevmNode.LocalTest(nodeOpts)

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
	{
		port: portOption,
		chainId: chainIdOption,
		accounts: accountsOption,
		forkUrl: forkUrlOption,
		forkBlockNumber: forkBlockNumberOption,
	},
	({ port, chainId, accounts: accountsCount, forkUrl, forkBlockNumber }) =>
		Effect.gen(function* () {
			const forkUrlValue = forkUrl._tag === "Some" ? forkUrl.value : undefined
			const forkBlockValue = forkBlockNumber._tag === "Some" ? BigInt(forkBlockNumber.value) : undefined

			const { server, accounts } = yield* startNodeServer({
				port,
				chainId: BigInt(chainId),
				accounts: accountsCount,
				...(forkUrlValue !== undefined ? { forkUrl: forkUrlValue } : {}),
				...(forkBlockValue !== undefined ? { forkBlockNumber: forkBlockValue } : {}),
			})

			// Print startup banner
			yield* Console.log(formatBanner(server.port, accounts, forkUrlValue, forkBlockValue))

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
