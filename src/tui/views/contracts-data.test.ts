import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import type { DisassembledInstruction } from "../../cli/commands/bytecode.js"
import { TevmNode, TevmNodeService } from "../../node/index.js"
import { extractSelectors, getContractDetail, getContractsData } from "./contracts-data.js"

describe("contracts-data", () => {
	describe("extractSelectors", () => {
		it.effect("returns empty for empty instructions", () =>
			Effect.sync(() => {
				expect(extractSelectors([])).toEqual([])
			}),
		)

		it.effect("extracts PUSH4+EQ pattern", () =>
			Effect.sync(() => {
				const instructions: DisassembledInstruction[] = [
					{ pc: 0, opcode: "0x63", name: "PUSH4", pushData: "0xa9059cbb" },
					{ pc: 5, opcode: "0x14", name: "EQ" },
				]
				const selectors = extractSelectors(instructions)
				expect(selectors).toEqual(["0xa9059cbb"])
			}),
		)

		it.effect("extracts multiple selectors", () =>
			Effect.sync(() => {
				const instructions: DisassembledInstruction[] = [
					{ pc: 0, opcode: "0x63", name: "PUSH4", pushData: "0xa9059cbb" },
					{ pc: 5, opcode: "0x14", name: "EQ" },
					{ pc: 10, opcode: "0x63", name: "PUSH4", pushData: "0x70a08231" },
					{ pc: 15, opcode: "0x14", name: "EQ" },
				]
				const selectors = extractSelectors(instructions)
				expect(selectors).toEqual(["0xa9059cbb", "0x70a08231"])
			}),
		)

		it.effect("deduplicates selectors", () =>
			Effect.sync(() => {
				const instructions: DisassembledInstruction[] = [
					{ pc: 0, opcode: "0x63", name: "PUSH4", pushData: "0xa9059cbb" },
					{ pc: 5, opcode: "0x14", name: "EQ" },
					{ pc: 10, opcode: "0x63", name: "PUSH4", pushData: "0xa9059cbb" },
					{ pc: 15, opcode: "0x14", name: "EQ" },
				]
				const selectors = extractSelectors(instructions)
				expect(selectors).toEqual(["0xa9059cbb"])
			}),
		)

		it.effect("ignores PUSH4 not followed by EQ", () =>
			Effect.sync(() => {
				const instructions: DisassembledInstruction[] = [
					{ pc: 0, opcode: "0x63", name: "PUSH4", pushData: "0xa9059cbb" },
					{ pc: 5, opcode: "0x00", name: "STOP" },
				]
				const selectors = extractSelectors(instructions)
				expect(selectors).toEqual([])
			}),
		)

		it.effect("ignores non-PUSH4 followed by EQ", () =>
			Effect.sync(() => {
				const instructions: DisassembledInstruction[] = [
					{ pc: 0, opcode: "0x60", name: "PUSH1", pushData: "0x80" },
					{ pc: 2, opcode: "0x14", name: "EQ" },
				]
				const selectors = extractSelectors(instructions)
				expect(selectors).toEqual([])
			}),
		)
	})

	describe("getContractsData", () => {
		it.effect("returns empty array on fresh node (no deployed contracts)", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const data = yield* getContractsData(node)
				// Fresh node only has pre-funded test accounts (EOAs), no contracts
				expect(data.contracts.length).toBe(0)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("detects contract after deploying code via setCode", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService

				// Deploy a simple contract via hostAdapter
				const contractAddr = new Uint8Array(20)
				contractAddr[19] = 0x42 // 0x0...042
				const code = new Uint8Array([0x60, 0x80, 0x60, 0x40, 0x52, 0x00]) // PUSH1 0x80 PUSH1 0x40 MSTORE STOP

				// Set account with code
				yield* node.hostAdapter.setAccount(contractAddr, {
					nonce: 0n,
					balance: 0n,
					codeHash: new Uint8Array(32),
					code,
				})

				const data = yield* getContractsData(node)
				expect(data.contracts.length).toBeGreaterThanOrEqual(1)

				// Find our contract
				const found = data.contracts.find((c) => c.address.endsWith("42"))
				expect(found).toBeDefined()
				expect(found!.codeSize).toBe(6) // 6 bytes of bytecode
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("contract summary has expected fields", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService

				const contractAddr = new Uint8Array(20)
				contractAddr[19] = 0x99
				const code = new Uint8Array([0x60, 0x00, 0x60, 0x00, 0xfd]) // PUSH1 0 PUSH1 0 REVERT

				yield* node.hostAdapter.setAccount(contractAddr, {
					nonce: 0n,
					balance: 0n,
					codeHash: new Uint8Array(32),
					code,
				})

				const data = yield* getContractsData(node)
				const contract = data.contracts.find((c) => c.address.endsWith("99"))
				expect(contract).toBeDefined()
				expect(typeof contract!.address).toBe("string")
				expect(typeof contract!.codeSize).toBe("number")
				expect(typeof contract!.bytecodeHex).toBe("string")
				expect(contract!.bytecodeHex.startsWith("0x")).toBe(true)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)
	})

	describe("getContractDetail", () => {
		it.effect("disassembles bytecode", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService

				const contractAddr = new Uint8Array(20)
				contractAddr[19] = 0x55
				// PUSH1 0x80 PUSH1 0x40 MSTORE STOP
				const code = new Uint8Array([0x60, 0x80, 0x60, 0x40, 0x52, 0x00])

				yield* node.hostAdapter.setAccount(contractAddr, {
					nonce: 0n,
					balance: 0n,
					codeHash: new Uint8Array(32),
					code,
				})

				const data = yield* getContractsData(node)
				const contract = data.contracts.find((c) => c.address.endsWith("55"))
				expect(contract).toBeDefined()

				const detail = yield* getContractDetail(node, contract!)
				expect(detail.instructions.length).toBeGreaterThan(0)
				expect(detail.instructions[0]!.name).toBe("PUSH1")
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("extracts selectors from bytecode with PUSH4+EQ pattern", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService

				const contractAddr = new Uint8Array(20)
				contractAddr[19] = 0x77
				// Bytecode: PUSH4 0xa9059cbb EQ STOP
				const code = new Uint8Array([0x63, 0xa9, 0x05, 0x9c, 0xbb, 0x14, 0x00])

				yield* node.hostAdapter.setAccount(contractAddr, {
					nonce: 0n,
					balance: 0n,
					codeHash: new Uint8Array(32),
					code,
				})

				const data = yield* getContractsData(node)
				const contract = data.contracts.find((c) => c.address.endsWith("77"))
				expect(contract).toBeDefined()

				const detail = yield* getContractDetail(node, contract!)
				expect(detail.selectors.length).toBe(1)
				expect(detail.selectors[0]!.selector).toBe("0xa9059cbb")
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("reads storage entries", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService

				const contractAddr = new Uint8Array(20)
				contractAddr[19] = 0x88
				const code = new Uint8Array([0x00]) // STOP

				yield* node.hostAdapter.setAccount(contractAddr, {
					nonce: 0n,
					balance: 0n,
					codeHash: new Uint8Array(32),
					code,
				})

				// Set a storage slot
				const slot = new Uint8Array(32)
				slot[31] = 1 // slot 0x01
				yield* node.hostAdapter.setStorage(contractAddr, slot, 42n)

				const data = yield* getContractsData(node)
				const contract = data.contracts.find((c) => c.address.endsWith("88"))
				expect(contract).toBeDefined()

				const detail = yield* getContractDetail(node, contract!)
				expect(detail.storageEntries.length).toBeGreaterThanOrEqual(1)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)

		it.effect("detail has expected fields", () =>
			Effect.gen(function* () {
				const node = yield* TevmNodeService

				const contractAddr = new Uint8Array(20)
				contractAddr[19] = 0xaa
				const code = new Uint8Array([0x60, 0x00, 0x00]) // PUSH1 0 STOP

				yield* node.hostAdapter.setAccount(contractAddr, {
					nonce: 0n,
					balance: 0n,
					codeHash: new Uint8Array(32),
					code,
				})

				const data = yield* getContractsData(node)
				const contract = data.contracts.find((c) => c.address.endsWith("aa"))
				expect(contract).toBeDefined()

				const detail = yield* getContractDetail(node, contract!)
				expect(typeof detail.address).toBe("string")
				expect(typeof detail.bytecodeHex).toBe("string")
				expect(typeof detail.codeSize).toBe("number")
				expect(Array.isArray(detail.instructions)).toBe(true)
				expect(Array.isArray(detail.selectors)).toBe(true)
				expect(Array.isArray(detail.storageEntries)).toBe(true)
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)
	})
})
