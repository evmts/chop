/**
 * Pure conversion utilities between EVM byte representations and
 * WorldState string/bigint representations.
 *
 * No Effect dependencies — all functions are pure and synchronous.
 */

import { ConversionError } from "./errors.js"

// ---------------------------------------------------------------------------
// Bytes ↔ Hex
// ---------------------------------------------------------------------------

/** Convert Uint8Array to 0x-prefixed lowercase hex string. */
export const bytesToHex = (bytes: Uint8Array): string =>
	`0x${Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("")}`

/** Convert 0x-prefixed hex string to Uint8Array. Throws ConversionError on malformed input. */
export const hexToBytes = (hex: string): Uint8Array => {
	const clean = hex.startsWith("0x") ? hex.slice(2) : hex
	if (clean.length % 2 !== 0) {
		throw new ConversionError({ message: `hexToBytes: odd-length hex string: ${hex}` })
	}
	const bytes = new Uint8Array(clean.length / 2)
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16)
	}
	return bytes
}

// ---------------------------------------------------------------------------
// Bigint ↔ Bytes32
// ---------------------------------------------------------------------------

/** Convert bigint to 32-byte big-endian Uint8Array. */
export const bigintToBytes32 = (n: bigint): Uint8Array => {
	const bytes = new Uint8Array(32)
	let val = n < 0n ? 0n : n
	for (let i = 31; i >= 0; i--) {
		bytes[i] = Number(val & 0xffn)
		val >>= 8n
	}
	return bytes
}

/** Convert big-endian Uint8Array to bigint. */
export const bytesToBigint = (bytes: Uint8Array): bigint => {
	let result = 0n
	for (let i = 0; i < bytes.length; i++) {
		const byte = bytes[i] ?? 0
		result = (result << 8n) | BigInt(byte)
	}
	return result
}
