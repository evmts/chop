// MCP runtime — bridges Effect handlers to async MCP tool handlers.
// Provides lazy TevmNode lifecycle for node-dependent tools.

import { Effect, ManagedRuntime } from "effect"
import type { Layer } from "effect"
import { TevmNode, TevmNodeService } from "../node/index.js"
import type { TevmNodeShape } from "../node/index.js"

// ---------------------------------------------------------------------------
// McpRuntime interface
// ---------------------------------------------------------------------------

/** Abstraction over Effect execution for MCP tool handlers. */
export interface McpRuntime {
	/** Run a pure Effect (no node dependency). */
	readonly runPure: <A>(effect: Effect.Effect<A, unknown>) => Promise<A>
	/** Run an Effect that needs a TevmNode. Lazily initializes the node on first call. */
	readonly runWithNode: <A>(fn: (node: TevmNodeShape) => Effect.Effect<A, unknown>) => Promise<A>
	/** Dispose the managed runtime (for graceful shutdown). */
	readonly dispose: () => Promise<void>
}

// ---------------------------------------------------------------------------
// Tool result helpers
// ---------------------------------------------------------------------------

/** Wrap a string as a successful MCP tool result. */
export const toolResult = (text: string) => ({
	content: [{ type: "text" as const, text }],
})

/** Wrap an error message as an MCP tool error result. */
export const toolError = (message: string) => ({
	content: [{ type: "text" as const, text: message }],
	isError: true as const,
})

/** JSON replacer that converts bigint to hex strings. */
export const bigintReplacer = (_key: string, value: unknown) =>
	typeof value === "bigint" ? `0x${value.toString(16)}` : value

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create an McpRuntime. By default uses TevmNode.Local() for production.
 * Pass a custom nodeLayer (e.g. TevmNode.LocalTest()) for testing.
 */
export const createRuntime = (nodeLayer?: Layer.Layer<TevmNodeService, unknown>): McpRuntime => {
	let managedRuntime: ManagedRuntime.ManagedRuntime<TevmNodeService, unknown> | null = null

	const getRuntime = () => {
		if (!managedRuntime) {
			managedRuntime = ManagedRuntime.make(nodeLayer ?? TevmNode.Local())
		}
		return managedRuntime
	}

	const extractMessage = (e: unknown): string => {
		if (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") {
			return (e as { message: string }).message
		}
		return String(e)
	}

	return {
		runPure: <A>(effect: Effect.Effect<A, unknown>): Promise<A> =>
			Effect.runPromise(effect.pipe(Effect.catchAll((e) => Effect.fail(new Error(extractMessage(e)))))),

		runWithNode: <A>(fn: (node: TevmNodeShape) => Effect.Effect<A, unknown>): Promise<A> =>
			getRuntime().runPromise(
				Effect.gen(function* () {
					const node = yield* TevmNodeService
					return yield* fn(node)
				}).pipe(Effect.catchAll((e) => Effect.fail(new Error(extractMessage(e))))),
			),

		dispose: async () => {
			if (managedRuntime) {
				await managedRuntime.dispose()
				managedRuntime = null
			}
		},
	}
}

/** Create a test runtime using TevmNode.LocalTest() (no WASM needed). */
export const createTestRuntime = (): McpRuntime => createRuntime(TevmNode.LocalTest())
