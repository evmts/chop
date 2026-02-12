/**
 * Shared CLI utilities.
 *
 * Common options, validation helpers, and error handlers
 * used across multiple CLI command modules.
 */

import { Options } from "@effect/cli"
import { Console, Effect } from "effect"
import { Hex } from "voltaire-effect"

// ============================================================================
// Shared Options
// ============================================================================

/** --json / -j: Output results as JSON */
export const jsonOption = Options.boolean("json").pipe(
	Options.withAlias("j"),
	Options.withDescription("Output results as JSON"),
)

/** --rpc-url / -r: Ethereum JSON-RPC endpoint URL (required by default) */
export const rpcUrlOption = Options.text("rpc-url").pipe(
	Options.withAlias("r"),
	Options.withDescription("Ethereum JSON-RPC endpoint URL"),
)

// ============================================================================
// Shared Validation
// ============================================================================

/**
 * Validate hex string and convert to bytes.
 *
 * Parameterized by error constructor so each command module
 * can produce its own tagged error type.
 */
export const validateHexData = <E>(
	data: string,
	mkError: (message: string, data: string) => E,
): Effect.Effect<Uint8Array, E> =>
	Effect.try({
		try: () => {
			if (!data.startsWith("0x")) {
				throw new Error("Hex data must start with 0x")
			}
			const clean = data.slice(2)
			if (!/^[0-9a-fA-F]*$/.test(clean)) {
				throw new Error("Invalid hex characters")
			}
			if (clean.length % 2 !== 0) {
				throw new Error("Odd-length hex string")
			}
			return Hex.toBytes(data)
		},
		catch: (e) => mkError(`Invalid hex data: ${e instanceof Error ? e.message : String(e)}`, data),
	})

// ============================================================================
// Shared Error Handler
// ============================================================================

/**
 * Unified error handler for CLI commands.
 * Prints the error message to stderr and re-fails so the CLI exits non-zero.
 */
export const handleCommandErrors = <A, E extends { readonly message: string }>(
	effect: Effect.Effect<A, E, never>,
): Effect.Effect<A, E, never> => effect.pipe(Effect.tapError((e) => Console.error(e.message)))
