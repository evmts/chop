/**
 * TUI entry point — launches the OpenTUI-based terminal interface.
 *
 * Uses dynamic imports to avoid loading @opentui/core on Node.js or
 * in non-TTY environments. Wrapped in Effect for error handling.
 *
 * Creates a local TevmNode (test mode) to provide live chain data
 * to the Dashboard view.
 *
 */

import { Effect } from "effect"
import type { TevmNodeShape } from "../node/index.js"
import { TuiError } from "./errors.js"
import { DRACULA } from "./theme.js"

/**
 * Start the TUI application.
 *
 * - Dynamically imports @opentui/core (Bun-only)
 * - Creates a CLI renderer with alternate screen and Dracula background
 * - Creates a local TevmNode for live dashboard data
 * - Composes the App and waits for quit signal
 * - Cleans up renderer on exit (guaranteed via Effect.ensuring)
 *
 * @param node - Optional TevmNodeShape for live dashboard data.
 *   If not provided, the TUI creates one internally via TevmNode.LocalTest().
 *
 * Fails with `TuiError` if:
 * - @opentui/core can't be imported (wrong runtime)
 * - Renderer initialization fails
 * - Runtime error during TUI operation
 */
export const startTui = (node?: TevmNodeShape, compilerRpcUrl?: string): Effect.Effect<void, TuiError> =>
	Effect.gen(function* () {
		// Resolve node — use provided node or create a local test node
		const resolvedNode = node ?? (yield* resolveDefaultNode())

		const opentui = yield* Effect.tryPromise({
			try: () => import("@opentui/core"),
			catch: (e) =>
				new TuiError({
					message: "TUI requires Bun runtime. Run with: bun run bin/chop.ts",
					cause: e,
				}),
		})

		const renderer = yield* Effect.tryPromise({
			try: () =>
				opentui.createCliRenderer({
					exitOnCtrlC: true,
					targetFps: 30,
					screenMode: "alternate-screen",
					backgroundColor: DRACULA.background,
				}),
			catch: (e) =>
				new TuiError({
					message: "Failed to initialize TUI renderer",
					cause: e,
				}),
		})

		yield* Effect.ensuring(
			Effect.gen(function* () {
				const appModule = yield* Effect.tryPromise({
					try: () => import("./App.js"),
					catch: (e) =>
						new TuiError({
							message: "Failed to load TUI app module",
							cause: e,
						}),
				})

				const app = appModule.createApp(renderer, resolvedNode, compilerRpcUrl)

				yield* Effect.tryPromise({
					try: () => app.waitForQuit,
					catch: (e) =>
						new TuiError({
							message: "TUI runtime error",
							cause: e,
						}),
				})
			}),
			Effect.sync(() => renderer.destroy()),
		)
	})

/**
 * Create a default TevmNode when none is provided.
 * Uses TevmNode.LocalTest() (no WASM dependency — safe for all environments).
 */
const resolveDefaultNode = (): Effect.Effect<TevmNodeShape, TuiError> =>
	Effect.gen(function* () {
		// Dynamic import to avoid circular dependencies at module load time
		const nodeModule = yield* Effect.tryPromise({
			try: () => import("../node/index.js"),
			catch: (e) =>
				new TuiError({
					message: "Failed to load node module for TUI",
					cause: e,
				}),
		})

		const layer = nodeModule.TevmNode.LocalTest()
		return yield* Effect.provide(nodeModule.TevmNodeService, layer).pipe(
			Effect.mapError(
				(e) =>
					new TuiError({
						message: "Failed to create local node for TUI",
						cause: e,
					}),
			),
		)
	})
