/**
 * Re-exports branded Ethereum types from voltaire-effect.
 *
 * RULE: Never create custom Address/Hash/Hex types.
 * Always use voltaire-effect primitives.
 */

// Branded type aliases
export type { AddressType, HashType, HexType } from "voltaire-effect"

// Namespace modules with schemas, encoders, decoders
export {
	Abi,
	Address,
	Bytes32,
	Hash,
	Hex,
	Rlp,
	Selector,
	Signature,
} from "voltaire-effect"
