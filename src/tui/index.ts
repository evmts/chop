/**
 * TUI entry point — launches the OpenTUI-based terminal interface.
 *
 * Uses dynamic imports to avoid loading @opentui/core on Node.js or
 * in non-TTY environments. Wrapped in Effect for error handling.
 */

import { Effect } from "effect"
import { TuiError } from "./errors.js"

/**
 * Start the TUI application.
 *
 * - Dynamically imports @opentui/core (Bun-only)
 * - Creates a CLI renderer with alternate screen and Dracula background
 * - Composes the App and waits for quit signal
 * - Cleans up renderer on exit
 *
 * Fails with `TuiError` if:
 * - @opentui/core can't be imported (wrong runtime)
 * - Renderer initialization fails
 * - Runtime error during TUI operation
 */
export const startTui: Effect.Effect<void, TuiError> = Effect.gen(function* () {
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
				useAlternateScreen: true,
				backgroundColor: "#282A36",
			}),
		catch: (e) =>
			new TuiError({
				message: "Failed to initialize TUI renderer",
				cause: e,
			}),
	})

	const appModule = yield* Effect.tryPromise({
		try: () => import("./App.js"),
		catch: (e) =>
			new TuiError({
				message: "Failed to load TUI app module",
				cause: e,
			}),
	})

	const app = appModule.createApp(renderer)

	yield* Effect.tryPromise({
		try: () => app.waitForQuit,
		catch: (e) =>
			new TuiError({
				message: "TUI runtime error",
				cause: e,
			}),
	})

	renderer.destroy()
})
