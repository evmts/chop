import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const pkg = require("../../package.json") as { version: string }

/**
 * Application version from package.json.
 * Used by Command.run for --version output.
 */
export const VERSION: string = pkg.version
