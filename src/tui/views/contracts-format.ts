/**
 * Pure formatting utilities for contracts view display.
 *
 * No OpenTUI or Effect dependencies — all functions are pure and synchronous.
 */

import type { DisassembledInstruction } from "../../cli/commands/bytecode.js"

// ---------------------------------------------------------------------------
// Re-exports from dashboard-format for convenience
// ---------------------------------------------------------------------------

export { truncateAddress, truncateHash } from "./dashboard-format.js"

// ---------------------------------------------------------------------------
// Code size formatting
// ---------------------------------------------------------------------------

/** Format code size in bytes as human-readable ("42 B", "1.5 KB"). */
export const formatCodeSize = (bytes: number): string => {
	if (bytes < 1000) return `${bytes} B`
	const kb = bytes / 1024
	return `${kb.toFixed(1)} KB`
}

// ---------------------------------------------------------------------------
// PC offset formatting
// ---------------------------------------------------------------------------

/** Format a program counter offset as "0x0042". */
export const formatPc = (pc: number): string => `0x${pc.toString(16).padStart(4, "0")}`

// ---------------------------------------------------------------------------
// Disassembly line formatting
// ---------------------------------------------------------------------------

/** Format a single disassembled instruction as "0x0042: PUSH1 0x80". */
export const formatDisassemblyLine = (inst: DisassembledInstruction): string => {
	const pcStr = formatPc(inst.pc)
	if (inst.pushData !== undefined) {
		return `${pcStr}: ${inst.name} ${inst.pushData}`
	}
	return `${pcStr}: ${inst.name}`
}

// ---------------------------------------------------------------------------
// Bytecode hex dump formatting
// ---------------------------------------------------------------------------

/** Number of bytes per line in hex dump. */
const HEX_BYTES_PER_LINE = 16

/**
 * Format raw bytecode hex as a hex dump with offsets.
 *
 * @param bytecodeHex - 0x-prefixed bytecode string
 * @param lineOffset - Number of lines to skip (for scrolling)
 * @returns Multi-line hex dump string
 */
export const formatBytecodeHex = (bytecodeHex: string, lineOffset: number): string => {
	const hex = bytecodeHex.slice(2) // strip 0x
	if (hex.length === 0) return ""

	const totalBytes = hex.length / 2
	const lines: string[] = []

	for (let byteIdx = lineOffset * HEX_BYTES_PER_LINE; byteIdx < totalBytes; byteIdx += HEX_BYTES_PER_LINE) {
		const offsetStr = byteIdx.toString(16).padStart(4, "0")
		const byteParts: string[] = []
		for (let j = 0; j < HEX_BYTES_PER_LINE && byteIdx + j < totalBytes; j++) {
			const charIdx = (byteIdx + j) * 2
			byteParts.push(hex.substring(charIdx, charIdx + 2))
		}
		lines.push(`${offsetStr}: ${byteParts.join(" ")}`)
	}

	return lines.join("\n")
}

// ---------------------------------------------------------------------------
// Storage value formatting
// ---------------------------------------------------------------------------

/** Format a storage value hex string for display. */
export const formatStorageValue = (valueHex: string): string => valueHex

// ---------------------------------------------------------------------------
// Selector formatting
// ---------------------------------------------------------------------------

/** Format a function selector with optional resolved name. */
export const formatSelector = (selector: string, resolvedName?: string): string => {
	if (resolvedName) {
		return `${selector}  ${resolvedName}`
	}
	return `${selector}  (unknown)`
}
