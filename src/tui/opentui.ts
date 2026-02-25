/**
 * Shared lazy-import helper for @opentui/core.
 *
 * Uses `require()` so that the module is loaded lazily at call-time rather
 * than at import-time.  This keeps the rest of the TUI code testable in
 * environments where the native Bun FFI backing is unavailable.
 *
 * Single source of truth -- every TUI component should import from here
 * instead of calling `require("@opentui/core")` directly.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
export const getOpenTui = () => require("@opentui/core") as typeof import("@opentui/core")
