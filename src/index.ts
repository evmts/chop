/**
 * Chop — Ethereum Swiss Army knife
 *
 * Public API re-exports.
 */

// Shared types (voltaire-effect branded primitives)
export type { AddressType, HashType, HexType } from "./shared/types.js"
export { Abi, Address, Bytes32, Hash, Hex, Rlp, Selector, Signature } from "./shared/types.js"

// Shared errors
export { ChopError } from "./shared/errors.js"

// CLI
export { cli, root } from "./cli/index.js"
export { CliError } from "./cli/errors.js"
export { VERSION } from "./cli/version.js"
