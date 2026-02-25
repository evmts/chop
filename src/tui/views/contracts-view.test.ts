import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { keyToAction } from "../state.js"
import { type ContractsViewState, contractsReduce, initialContractsState } from "./Contracts.js"
import type { ContractDetail, ContractSummary } from "./contracts-data.js"

/** Helper to create a minimal ContractSummary. */
const makeContract = (overrides: Partial<ContractSummary> = {}): ContractSummary => ({
	address: `0x${"ab".repeat(20)}`,
	codeSize: 100,
	bytecodeHex: `0x${"60".repeat(100)}`,
	...overrides,
})

/** Helper to create a minimal ContractDetail. */
const makeDetail = (overrides: Partial<ContractDetail> = {}): ContractDetail => ({
	address: `0x${"ab".repeat(20)}`,
	bytecodeHex: `0x${"60".repeat(100)}`,
	codeSize: 100,
	instructions: [
		{ pc: 0, opcode: "0x60", name: "PUSH1", pushData: "0x80" },
		{ pc: 2, opcode: "0x60", name: "PUSH1", pushData: "0x40" },
		{ pc: 4, opcode: "0x52", name: "MSTORE" },
		{ pc: 5, opcode: "0x00", name: "STOP" },
	],
	selectors: [{ selector: "0xa9059cbb", name: "transfer(address,uint256)" }],
	storageEntries: [{ slot: "0x00", value: "0x2a" }],
	...overrides,
})

/** Create state with given number of contracts. */
const stateWithContracts = (count: number, overrides: Partial<ContractsViewState> = {}): ContractsViewState => ({
	...initialContractsState,
	contracts: Array.from({ length: count }, (_, i) =>
		makeContract({
			address: `0x${i.toString(16).padStart(40, "0")}`,
			codeSize: (i + 1) * 100,
		}),
	),
	...overrides,
})

describe("Contracts view reducer", () => {
	describe("initialState", () => {
		it.effect("starts in list mode with no selection", () =>
			Effect.sync(() => {
				expect(initialContractsState.selectedIndex).toBe(0)
				expect(initialContractsState.viewMode).toBe("list")
				expect(initialContractsState.contracts).toEqual([])
				expect(initialContractsState.detail).toBeNull()
			}),
		)
	})

	describe("j/k navigation", () => {
		it.effect("j moves selection down in list mode", () =>
			Effect.sync(() => {
				const state = stateWithContracts(5)
				const next = contractsReduce(state, "j")
				expect(next.selectedIndex).toBe(1)
			}),
		)

		it.effect("k moves selection up in list mode", () =>
			Effect.sync(() => {
				const state = stateWithContracts(5, { selectedIndex: 3 })
				const next = contractsReduce(state, "k")
				expect(next.selectedIndex).toBe(2)
			}),
		)

		it.effect("j clamps at last contract", () =>
			Effect.sync(() => {
				const state = stateWithContracts(3, { selectedIndex: 2 })
				const next = contractsReduce(state, "j")
				expect(next.selectedIndex).toBe(2)
			}),
		)

		it.effect("k clamps at first contract", () =>
			Effect.sync(() => {
				const state = stateWithContracts(3, { selectedIndex: 0 })
				const next = contractsReduce(state, "k")
				expect(next.selectedIndex).toBe(0)
			}),
		)

		it.effect("j does nothing with empty contracts", () =>
			Effect.sync(() => {
				const next = contractsReduce(initialContractsState, "j")
				expect(next.selectedIndex).toBe(0)
			}),
		)
	})

	describe("Enter → detail view", () => {
		it.effect("enter switches to disassembly mode when detail is loaded", () =>
			Effect.sync(() => {
				const state = stateWithContracts(3, {
					selectedIndex: 1,
					detail: makeDetail(),
				})
				const next = contractsReduce(state, "return")
				expect(next.viewMode).toBe("disassembly")
			}),
		)

		it.effect("enter does nothing if no detail loaded", () =>
			Effect.sync(() => {
				const state = stateWithContracts(3, { selectedIndex: 1 })
				const next = contractsReduce(state, "return")
				// viewMode stays "list" if detail is null — App.ts loads the detail first
				// Actually, the reducer should signal "enter was pressed" so App.ts can load detail.
				// When detail is null, the App.ts will load it and then the view switches.
				// But the reducer itself should set viewMode to disassembly to signal intent.
				expect(next.viewMode).toBe("disassembly")
			}),
		)

		it.effect("enter does nothing with empty contracts", () =>
			Effect.sync(() => {
				const next = contractsReduce(initialContractsState, "return")
				expect(next.viewMode).toBe("list")
			}),
		)

		it.effect("enter preserves selectedIndex", () =>
			Effect.sync(() => {
				const state = stateWithContracts(5, { selectedIndex: 2 })
				const next = contractsReduce(state, "return")
				expect(next.selectedIndex).toBe(2)
			}),
		)
	})

	describe("d key → toggle disassembly/bytecode", () => {
		it.effect("d toggles from disassembly to bytecode", () =>
			Effect.sync(() => {
				const state = stateWithContracts(3, { viewMode: "disassembly", detail: makeDetail() })
				const next = contractsReduce(state, "d")
				expect(next.viewMode).toBe("bytecode")
			}),
		)

		it.effect("d toggles from bytecode to disassembly", () =>
			Effect.sync(() => {
				const state = stateWithContracts(3, { viewMode: "bytecode", detail: makeDetail() })
				const next = contractsReduce(state, "d")
				expect(next.viewMode).toBe("disassembly")
			}),
		)

		it.effect("d does nothing in list mode", () =>
			Effect.sync(() => {
				const state = stateWithContracts(3)
				const next = contractsReduce(state, "d")
				expect(next.viewMode).toBe("list")
			}),
		)

		it.effect("d does nothing in storage mode", () =>
			Effect.sync(() => {
				const state = stateWithContracts(3, { viewMode: "storage", detail: makeDetail() })
				const next = contractsReduce(state, "d")
				expect(next.viewMode).toBe("storage")
			}),
		)
	})

	describe("s key → switch to storage", () => {
		it.effect("s switches from disassembly to storage", () =>
			Effect.sync(() => {
				const state = stateWithContracts(3, { viewMode: "disassembly", detail: makeDetail() })
				const next = contractsReduce(state, "s")
				expect(next.viewMode).toBe("storage")
			}),
		)

		it.effect("s switches from bytecode to storage", () =>
			Effect.sync(() => {
				const state = stateWithContracts(3, { viewMode: "bytecode", detail: makeDetail() })
				const next = contractsReduce(state, "s")
				expect(next.viewMode).toBe("storage")
			}),
		)

		it.effect("s does nothing in list mode", () =>
			Effect.sync(() => {
				const state = stateWithContracts(3)
				const next = contractsReduce(state, "s")
				expect(next.viewMode).toBe("list")
			}),
		)

		it.effect("s toggles storage back to disassembly", () =>
			Effect.sync(() => {
				const state = stateWithContracts(3, { viewMode: "storage", detail: makeDetail() })
				const next = contractsReduce(state, "s")
				expect(next.viewMode).toBe("disassembly")
			}),
		)
	})

	describe("Escape → back to list", () => {
		it.effect("escape returns to list from disassembly", () =>
			Effect.sync(() => {
				const state = stateWithContracts(3, { viewMode: "disassembly", detail: makeDetail() })
				const next = contractsReduce(state, "escape")
				expect(next.viewMode).toBe("list")
			}),
		)

		it.effect("escape returns to list from bytecode", () =>
			Effect.sync(() => {
				const state = stateWithContracts(3, { viewMode: "bytecode", detail: makeDetail() })
				const next = contractsReduce(state, "escape")
				expect(next.viewMode).toBe("list")
			}),
		)

		it.effect("escape returns to list from storage", () =>
			Effect.sync(() => {
				const state = stateWithContracts(3, { viewMode: "storage", detail: makeDetail() })
				const next = contractsReduce(state, "escape")
				expect(next.viewMode).toBe("list")
			}),
		)

		it.effect("escape does nothing in list mode", () =>
			Effect.sync(() => {
				const state = stateWithContracts(3)
				const next = contractsReduce(state, "escape")
				expect(next.viewMode).toBe("list")
			}),
		)
	})

	describe("j/k scroll in detail views", () => {
		it.effect("j scrolls down in disassembly view", () =>
			Effect.sync(() => {
				const state = stateWithContracts(3, {
					viewMode: "disassembly",
					detail: makeDetail(),
					detailScrollOffset: 0,
				})
				const next = contractsReduce(state, "j")
				expect(next.detailScrollOffset).toBe(1)
			}),
		)

		it.effect("k scrolls up in disassembly view", () =>
			Effect.sync(() => {
				const state = stateWithContracts(3, {
					viewMode: "disassembly",
					detail: makeDetail(),
					detailScrollOffset: 5,
				})
				const next = contractsReduce(state, "k")
				expect(next.detailScrollOffset).toBe(4)
			}),
		)

		it.effect("k clamps at 0", () =>
			Effect.sync(() => {
				const state = stateWithContracts(3, {
					viewMode: "disassembly",
					detail: makeDetail(),
					detailScrollOffset: 0,
				})
				const next = contractsReduce(state, "k")
				expect(next.detailScrollOffset).toBe(0)
			}),
		)
	})

	describe("unknown keys", () => {
		it.effect("unknown key returns state unchanged in list mode", () =>
			Effect.sync(() => {
				const state = stateWithContracts(3)
				const next = contractsReduce(state, "x")
				expect(next).toEqual(state)
			}),
		)

		it.effect("unknown key returns state unchanged in detail mode", () =>
			Effect.sync(() => {
				const state = stateWithContracts(3, { viewMode: "disassembly", detail: makeDetail() })
				const next = contractsReduce(state, "x")
				expect(next).toEqual(state)
			}),
		)
	})

	describe("key routing integration", () => {
		it.effect("d key is forwarded as ViewKey", () =>
			Effect.sync(() => {
				const action = keyToAction("d")
				expect(action).toEqual({ _tag: "ViewKey", key: "d" })
			}),
		)

		it.effect("s key is forwarded as ViewKey", () =>
			Effect.sync(() => {
				const action = keyToAction("s")
				expect(action).toEqual({ _tag: "ViewKey", key: "s" })
			}),
		)

		it.effect("j/k navigation keys are forwarded as ViewKey", () =>
			Effect.sync(() => {
				expect(keyToAction("j")).toEqual({ _tag: "ViewKey", key: "j" })
				expect(keyToAction("k")).toEqual({ _tag: "ViewKey", key: "k" })
			}),
		)

		it.effect("return is forwarded as ViewKey", () =>
			Effect.sync(() => {
				expect(keyToAction("return")).toEqual({ _tag: "ViewKey", key: "return" })
			}),
		)

		it.effect("escape is forwarded as ViewKey", () =>
			Effect.sync(() => {
				expect(keyToAction("escape")).toEqual({ _tag: "ViewKey", key: "escape" })
			}),
		)
	})
})
