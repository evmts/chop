/**
 * Pure Effect functions that query TevmNodeShape for contracts view data.
 *
 * No OpenTUI dependency — returns plain typed objects.
 * All errors are caught internally — the contracts view should never fail.
 */

import { Effect } from "effect"
import type { DisassembledInstruction } from "../../cli/commands/bytecode.js"
import { disassembleHandler } from "../../cli/commands/bytecode.js"
import type { TevmNodeShape } from "../../node/index.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Summary info for a single contract in the list. */
export interface ContractSummary {
	/** Hex address of the contract (0x-prefixed). */
	readonly address: string
	/** Bytecode size in bytes. */
	readonly codeSize: number
	/** Raw bytecode hex (0x-prefixed). */
	readonly bytecodeHex: string
}

/** A resolved function selector with optional name. */
export interface ResolvedSelector {
	/** 4-byte selector hex (0x-prefixed). */
	readonly selector: string
	/** Resolved function name, or undefined if unknown. */
	readonly name?: string
}

/** A storage slot with its value. */
export interface StorageEntry {
	/** Slot key (hex). */
	readonly slot: string
	/** Slot value (hex). */
	readonly value: string
}

/** Full detail for a selected contract. */
export interface ContractDetail {
	/** Contract address. */
	readonly address: string
	/** Raw bytecode hex. */
	readonly bytecodeHex: string
	/** Bytecode size in bytes. */
	readonly codeSize: number
	/** Disassembled instructions. */
	readonly instructions: readonly DisassembledInstruction[]
	/** Extracted function selectors (PUSH4 + EQ pattern). */
	readonly selectors: readonly ResolvedSelector[]
	/** First N storage slots. */
	readonly storageEntries: readonly StorageEntry[]
}

/** Aggregated data for the contracts view list. */
export interface ContractsViewData {
	/** All contracts found via dumpState. */
	readonly contracts: readonly ContractSummary[]
}

// ---------------------------------------------------------------------------
// Selector extraction
// ---------------------------------------------------------------------------

/**
 * Extract 4-byte function selectors from bytecode by scanning for the
 * PUSH4 + EQ pattern used by Solidity's function dispatch.
 *
 * Solidity compilers generate:
 *   PUSH4 <selector>   (opcode 0x63)
 *   EQ                 (opcode 0x14)
 *
 * @param instructions - Disassembled instruction list
 * @returns Array of unique 4-byte selectors (0x-prefixed, 8 hex chars)
 */
export const extractSelectors = (instructions: readonly DisassembledInstruction[]): readonly string[] => {
	const selectors: string[] = []
	const seen = new Set<string>()

	for (let i = 0; i < instructions.length - 1; i++) {
		const inst = instructions[i]!
		const next = instructions[i + 1]!

		// PUSH4 is opcode 0x63, EQ is opcode 0x14
		if (inst.name === "PUSH4" && inst.pushData && next.name === "EQ") {
			const selector = inst.pushData.toLowerCase()
			if (!seen.has(selector)) {
				seen.add(selector)
				selectors.push(selector)
			}
		}
	}

	return selectors
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

/** Fetch all contracts from the world state via dumpState. */
export const getContractsData = (node: TevmNodeShape): Effect.Effect<ContractsViewData> =>
	Effect.gen(function* () {
		const dump = yield* node.hostAdapter.dumpState()

		const contracts: ContractSummary[] = []

		for (const [address, serializedAccount] of Object.entries(dump)) {
			// Filter: only accounts with non-empty code (contracts)
			if (serializedAccount.code && serializedAccount.code !== "0x" && serializedAccount.code.length > 2) {
				const codeHex = serializedAccount.code.startsWith("0x") ? serializedAccount.code : `0x${serializedAccount.code}`
				const codeSize = (codeHex.length - 2) / 2 // subtract "0x", each byte = 2 hex chars

				contracts.push({
					address: address.startsWith("0x") ? address : `0x${address}`,
					codeSize,
					bytecodeHex: codeHex,
				})
			}
		}

		// Sort by address for deterministic ordering
		contracts.sort((a, b) => a.address.localeCompare(b.address))

		return { contracts }
	}).pipe(Effect.catchAll(() => Effect.succeed({ contracts: [] as readonly ContractSummary[] })))

/**
 * Get full detail for a single contract.
 *
 * Disassembles bytecode, extracts selectors, and reads storage slots.
 */
export const getContractDetail = (node: TevmNodeShape, contract: ContractSummary): Effect.Effect<ContractDetail> =>
	Effect.gen(function* () {
		// Disassemble bytecode
		const instructions = yield* disassembleHandler(contract.bytecodeHex).pipe(
			Effect.catchAll(() => Effect.succeed([] as readonly DisassembledInstruction[])),
		)

		// Extract selectors from disassembly
		const selectorHexes = extractSelectors(instructions)
		const selectors: ResolvedSelector[] = selectorHexes.map((s) => ({ selector: s }))

		// Read storage entries from dumpState
		const dump = yield* node.hostAdapter.dumpState()
		const rawAddress = contract.address.startsWith("0x") ? contract.address : `0x${contract.address}`
		// Try both with and without 0x prefix for lookup
		const accountDump = dump[rawAddress] ?? dump[rawAddress.slice(2)]
		const storageEntries: StorageEntry[] = []

		if (accountDump?.storage) {
			const entries = Object.entries(accountDump.storage)
			// Take first 10 entries
			for (let i = 0; i < Math.min(entries.length, 10); i++) {
				const [slot, value] = entries[i]!
				storageEntries.push({
					slot: slot.startsWith("0x") ? slot : `0x${slot}`,
					value: value.startsWith("0x") ? value : `0x${value}`,
				})
			}
		}

		return {
			address: contract.address,
			bytecodeHex: contract.bytecodeHex,
			codeSize: contract.codeSize,
			instructions,
			selectors,
			storageEntries,
		}
	}).pipe(
		Effect.catchAll(() =>
			Effect.succeed({
				address: contract.address,
				bytecodeHex: contract.bytecodeHex,
				codeSize: contract.codeSize,
				instructions: [] as readonly DisassembledInstruction[],
				selectors: [] as readonly ResolvedSelector[],
				storageEntries: [] as readonly StorageEntry[],
			}),
		),
	)
