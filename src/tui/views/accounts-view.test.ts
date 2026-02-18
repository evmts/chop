import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { keyToAction } from "../state.js"
import {
	type AccountsViewState,
	accountsReduce,
	initialAccountsState,
} from "./Accounts.js"
import type { AccountDetail } from "./accounts-data.js"

/** Helper to create a minimal AccountDetail. */
const makeAccount = (overrides: Partial<AccountDetail> = {}): AccountDetail => ({
	address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
	balance: 10_000n * 10n ** 18n,
	nonce: 0n,
	code: new Uint8Array(),
	isContract: false,
	...overrides,
})

/** Create state with a given number of accounts. */
const stateWithAccounts = (count: number, overrides: Partial<AccountsViewState> = {}): AccountsViewState => ({
	...initialAccountsState,
	accounts: Array.from({ length: count }, (_, i) =>
		makeAccount({ address: `0x${(i + 1).toString(16).padStart(40, "0")}` }),
	),
	...overrides,
})

describe("Accounts view reducer", () => {
	describe("initialState", () => {
		it.effect("starts in list mode with no selection", () =>
			Effect.sync(() => {
				expect(initialAccountsState.selectedIndex).toBe(0)
				expect(initialAccountsState.viewMode).toBe("list")
				expect(initialAccountsState.accounts).toEqual([])
				expect(initialAccountsState.fundAmount).toBe("")
				expect(initialAccountsState.inputActive).toBe(false)
				expect(initialAccountsState.impersonatedAddresses.size).toBe(0)
			}),
		)
	})

	describe("j/k navigation", () => {
		it.effect("j moves selection down", () =>
			Effect.sync(() => {
				const state = stateWithAccounts(5)
				const next = accountsReduce(state, "j")
				expect(next.selectedIndex).toBe(1)
			}),
		)

		it.effect("k moves selection up", () =>
			Effect.sync(() => {
				const state = stateWithAccounts(5, { selectedIndex: 3 })
				const next = accountsReduce(state, "k")
				expect(next.selectedIndex).toBe(2)
			}),
		)

		it.effect("j clamps at last account", () =>
			Effect.sync(() => {
				const state = stateWithAccounts(3, { selectedIndex: 2 })
				const next = accountsReduce(state, "j")
				expect(next.selectedIndex).toBe(2)
			}),
		)

		it.effect("k clamps at first account", () =>
			Effect.sync(() => {
				const state = stateWithAccounts(3, { selectedIndex: 0 })
				const next = accountsReduce(state, "k")
				expect(next.selectedIndex).toBe(0)
			}),
		)

		it.effect("j does nothing with empty accounts", () =>
			Effect.sync(() => {
				const next = accountsReduce(initialAccountsState, "j")
				expect(next.selectedIndex).toBe(0)
			}),
		)
	})

	describe("Enter → detail view", () => {
		it.effect("enter switches to detail mode", () =>
			Effect.sync(() => {
				const state = stateWithAccounts(3, { selectedIndex: 1 })
				const next = accountsReduce(state, "return")
				expect(next.viewMode).toBe("detail")
			}),
		)

		it.effect("enter preserves selectedIndex", () =>
			Effect.sync(() => {
				const state = stateWithAccounts(5, { selectedIndex: 2 })
				const next = accountsReduce(state, "return")
				expect(next.selectedIndex).toBe(2)
			}),
		)

		it.effect("enter does nothing with empty accounts", () =>
			Effect.sync(() => {
				const next = accountsReduce(initialAccountsState, "return")
				expect(next.viewMode).toBe("list")
			}),
		)
	})

	describe("Escape → back to list", () => {
		it.effect("escape returns to list mode from detail", () =>
			Effect.sync(() => {
				const state = stateWithAccounts(3, { viewMode: "detail", selectedIndex: 1 })
				const next = accountsReduce(state, "escape")
				expect(next.viewMode).toBe("list")
			}),
		)

		it.effect("escape cancels fund prompt", () =>
			Effect.sync(() => {
				const state = stateWithAccounts(3, { viewMode: "fundPrompt", inputActive: true, fundAmount: "5.0" })
				const next = accountsReduce(state, "escape")
				expect(next.viewMode).toBe("list")
				expect(next.inputActive).toBe(false)
				expect(next.fundAmount).toBe("")
			}),
		)

		it.effect("escape does nothing in list mode", () =>
			Effect.sync(() => {
				const state = stateWithAccounts(3)
				const next = accountsReduce(state, "escape")
				expect(next.viewMode).toBe("list")
			}),
		)
	})

	describe("f → fund prompt", () => {
		it.effect("f activates fund prompt in list mode", () =>
			Effect.sync(() => {
				const state = stateWithAccounts(3)
				const next = accountsReduce(state, "f")
				expect(next.viewMode).toBe("fundPrompt")
				expect(next.inputActive).toBe(true)
				expect(next.fundAmount).toBe("")
			}),
		)

		it.effect("f activates fund prompt in detail mode", () =>
			Effect.sync(() => {
				const state = stateWithAccounts(3, { viewMode: "detail" })
				const next = accountsReduce(state, "f")
				expect(next.viewMode).toBe("fundPrompt")
				expect(next.inputActive).toBe(true)
			}),
		)

		it.effect("f does nothing with empty accounts", () =>
			Effect.sync(() => {
				const next = accountsReduce(initialAccountsState, "f")
				expect(next.viewMode).toBe("list")
			}),
		)
	})

	describe("fund prompt input", () => {
		it.effect("typing appends to fund amount", () =>
			Effect.sync(() => {
				const state = stateWithAccounts(3, { viewMode: "fundPrompt", inputActive: true, fundAmount: "1" })
				const next = accountsReduce(state, "0")
				expect(next.fundAmount).toBe("10")
			}),
		)

		it.effect("typing dot appends decimal point", () =>
			Effect.sync(() => {
				const state = stateWithAccounts(3, { viewMode: "fundPrompt", inputActive: true, fundAmount: "5" })
				const next = accountsReduce(state, ".")
				expect(next.fundAmount).toBe("5.")
			}),
		)

		it.effect("backspace removes last character", () =>
			Effect.sync(() => {
				const state = stateWithAccounts(3, { viewMode: "fundPrompt", inputActive: true, fundAmount: "10.5" })
				const next = accountsReduce(state, "backspace")
				expect(next.fundAmount).toBe("10.")
			}),
		)

		it.effect("backspace on empty does nothing", () =>
			Effect.sync(() => {
				const state = stateWithAccounts(3, { viewMode: "fundPrompt", inputActive: true, fundAmount: "" })
				const next = accountsReduce(state, "backspace")
				expect(next.fundAmount).toBe("")
			}),
		)

		it.effect("return in fund prompt signals fundConfirmed", () =>
			Effect.sync(() => {
				const state = stateWithAccounts(3, { viewMode: "fundPrompt", inputActive: true, fundAmount: "5.0" })
				const next = accountsReduce(state, "return")
				expect(next.viewMode).toBe("list")
				expect(next.inputActive).toBe(false)
				expect(next.fundConfirmed).toBe(true)
				expect(next.fundAmount).toBe("5.0")
			}),
		)

		it.effect("return with empty amount cancels", () =>
			Effect.sync(() => {
				const state = stateWithAccounts(3, { viewMode: "fundPrompt", inputActive: true, fundAmount: "" })
				const next = accountsReduce(state, "return")
				expect(next.viewMode).toBe("list")
				expect(next.inputActive).toBe(false)
				expect(next.fundConfirmed).toBe(false)
			}),
		)

		it.effect("ignores non-numeric/dot characters", () =>
			Effect.sync(() => {
				const state = stateWithAccounts(3, { viewMode: "fundPrompt", inputActive: true, fundAmount: "5" })
				const next = accountsReduce(state, "a")
				expect(next.fundAmount).toBe("5")
			}),
		)
	})

	describe("i → impersonate", () => {
		it.effect("i toggles impersonation in list mode", () =>
			Effect.sync(() => {
				const state = stateWithAccounts(3)
				const next = accountsReduce(state, "i")
				expect(next.impersonateRequested).toBe(true)
			}),
		)

		it.effect("i toggles impersonation in detail mode", () =>
			Effect.sync(() => {
				const state = stateWithAccounts(3, { viewMode: "detail" })
				const next = accountsReduce(state, "i")
				expect(next.impersonateRequested).toBe(true)
			}),
		)

		it.effect("i does nothing with empty accounts", () =>
			Effect.sync(() => {
				const next = accountsReduce(initialAccountsState, "i")
				expect(next.impersonateRequested).toBe(false)
			}),
		)
	})

	describe("key routing integration", () => {
		it.effect("f and i keys are forwarded as ViewKey when in VIEW_KEYS", () =>
			Effect.sync(() => {
				// f and i should be recognized by keyToAction
				const fAction = keyToAction("f")
				const iAction = keyToAction("i")
				expect(fAction).toEqual({ _tag: "ViewKey", key: "f" })
				expect(iAction).toEqual({ _tag: "ViewKey", key: "i" })
			}),
		)

		it.effect("fund prompt captures all keys in input mode", () =>
			Effect.sync(() => {
				// Simulate: user presses 'f' to activate fund mode, types amount
				let state = stateWithAccounts(3)

				// Press "f" to activate fund prompt
				state = accountsReduce(state, "f")
				expect(state.viewMode).toBe("fundPrompt")
				expect(state.inputActive).toBe(true)

				// With inputMode=true, all keys become ViewKey
				const action1 = keyToAction("1", state.inputActive)
				expect(action1).toEqual({ _tag: "ViewKey", key: "1" })

				// Type "10"
				state = accountsReduce(state, "1")
				state = accountsReduce(state, "0")
				expect(state.fundAmount).toBe("10")

				// Press return to confirm
				state = accountsReduce(state, "return")
				expect(state.viewMode).toBe("list")
				expect(state.fundConfirmed).toBe(true)
				expect(state.fundAmount).toBe("10")
			}),
		)

		it.effect("pressing 'q' during fund input does NOT quit (inputMode passthrough)", () =>
			Effect.sync(() => {
				const state: AccountsViewState = {
					...initialAccountsState,
					accounts: [makeAccount()],
					viewMode: "fundPrompt",
					inputActive: true,
					fundAmount: "",
				}

				// With inputMode=true, 'q' becomes ViewKey, not Quit
				const action = keyToAction("q", state.inputActive)
				expect(action?._tag).toBe("ViewKey")

				// Reducer ignores non-numeric chars
				const next = accountsReduce(state, "q")
				expect(next.fundAmount).toBe("")
				expect(next.inputActive).toBe(true)
			}),
		)
	})
})
