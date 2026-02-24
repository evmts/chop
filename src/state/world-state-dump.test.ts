/**
 * Tests for WorldState dumpState / loadState / clearState.
 *
 * Covers:
 * - dumpState with accounts that have storage → correct serialized output
 * - dumpState with accounts without storage → storage field is empty object
 * - dumpState with no accounts → returns empty object
 * - dumpState serializes nonce, balance, and code as hex
 * - loadState with storage entries → correctly loads storage
 * - loadState then dumpState round-trip → matches original
 * - loadState with empty storage → works correctly
 * - loadState merges with existing state (does not overwrite unrelated accounts)
 * - clearState → empties everything
 * - clearState then dumpState → empty object
 * - Multiple accounts with storage → all serialized correctly
 */

import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { EMPTY_ACCOUNT, EMPTY_CODE_HASH } from "./account.js"
import { WorldStateService, WorldStateTest } from "./world-state.js"
import type { WorldStateDump } from "./world-state.js"

const ADDR1 = "0x0000000000000000000000000000000000000aaa"
const ADDR2 = "0x0000000000000000000000000000000000000bbb"
const ADDR3 = "0x0000000000000000000000000000000000000ccc"
const SLOT_A = "0x0000000000000000000000000000000000000000000000000000000000000001"
const SLOT_B = "0x0000000000000000000000000000000000000000000000000000000000000002"
const SLOT_C = "0x0000000000000000000000000000000000000000000000000000000000000003"

// ---------------------------------------------------------------------------
// dumpState
// ---------------------------------------------------------------------------

describe("WorldState — dumpState", () => {
	it.effect("dumps state with storage entries", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			yield* ws.setAccount(ADDR1, { nonce: 1n, balance: 100n, code: new Uint8Array(0), codeHash: EMPTY_CODE_HASH })
			yield* ws.setStorage(ADDR1, SLOT_A, 42n)
			yield* ws.setStorage(ADDR1, SLOT_B, 255n)

			const dump = yield* ws.dumpState()

			expect(dump[ADDR1]).toBeDefined()
			expect(dump[ADDR1]?.nonce).toBe("0x1")
			expect(dump[ADDR1]?.balance).toBe("0x64")
			expect(dump[ADDR1]?.storage[SLOT_A]).toBe("0x2a")
			expect(dump[ADDR1]?.storage[SLOT_B]).toBe("0xff")
		}).pipe(Effect.provide(WorldStateTest)),
	)

	it.effect("dumps account without storage as empty storage object", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			yield* ws.setAccount(ADDR1, { nonce: 5n, balance: 200n, code: new Uint8Array(0), codeHash: EMPTY_CODE_HASH })

			const dump = yield* ws.dumpState()

			expect(dump[ADDR1]).toBeDefined()
			expect(dump[ADDR1]?.storage).toEqual({})
		}).pipe(Effect.provide(WorldStateTest)),
	)

	it.effect("dumpState with no accounts returns empty object", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			const dump = yield* ws.dumpState()
			expect(dump).toEqual({})
		}).pipe(Effect.provide(WorldStateTest)),
	)

	it.effect("dumps nonce, balance, and code as hex strings", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			const code = new Uint8Array([0x60, 0x00, 0x60, 0x00, 0xfd]) // PUSH1 0x00 PUSH1 0x00 REVERT
			yield* ws.setAccount(ADDR1, { nonce: 10n, balance: 1000n, code, codeHash: EMPTY_CODE_HASH })

			const dump = yield* ws.dumpState()

			expect(dump[ADDR1]?.nonce).toBe("0xa")
			expect(dump[ADDR1]?.balance).toBe("0x3e8")
			expect(dump[ADDR1]?.code).toBe("0x60006000fd")
		}).pipe(Effect.provide(WorldStateTest)),
	)

	it.effect("dumps multiple accounts with independent storage", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			yield* ws.setAccount(ADDR1, { nonce: 1n, balance: 10n, code: new Uint8Array(0), codeHash: EMPTY_CODE_HASH })
			yield* ws.setAccount(ADDR2, { nonce: 2n, balance: 20n, code: new Uint8Array(0), codeHash: EMPTY_CODE_HASH })
			yield* ws.setStorage(ADDR1, SLOT_A, 100n)
			yield* ws.setStorage(ADDR2, SLOT_B, 200n)

			const dump = yield* ws.dumpState()

			expect(dump[ADDR1]?.storage[SLOT_A]).toBe("0x64")
			expect(dump[ADDR1]?.storage[SLOT_B]).toBeUndefined()
			expect(dump[ADDR2]?.storage[SLOT_B]).toBe("0xc8")
			expect(dump[ADDR2]?.storage[SLOT_A]).toBeUndefined()
		}).pipe(Effect.provide(WorldStateTest)),
	)

	it.effect("dumps large storage value correctly", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			const largeValue = 2n ** 128n - 1n
			yield* ws.setAccount(ADDR1, { ...EMPTY_ACCOUNT })
			yield* ws.setStorage(ADDR1, SLOT_A, largeValue)

			const dump = yield* ws.dumpState()

			expect(dump[ADDR1]?.storage[SLOT_A]).toBe(`0x${largeValue.toString(16)}`)
		}).pipe(Effect.provide(WorldStateTest)),
	)
})

// ---------------------------------------------------------------------------
// loadState
// ---------------------------------------------------------------------------

describe("WorldState — loadState", () => {
	it.effect("loads state with storage entries", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			const dump: WorldStateDump = {
				[ADDR1]: {
					nonce: "0x5",
					balance: "0x3e8",
					code: "0x",
					storage: {
						[SLOT_A]: "0x2a",
						[SLOT_B]: "0xff",
					},
				},
			}

			yield* ws.loadState(dump)

			const account = yield* ws.getAccount(ADDR1)
			expect(account.nonce).toBe(5n)
			expect(account.balance).toBe(1000n)

			const valA = yield* ws.getStorage(ADDR1, SLOT_A)
			expect(valA).toBe(42n)

			const valB = yield* ws.getStorage(ADDR1, SLOT_B)
			expect(valB).toBe(255n)
		}).pipe(Effect.provide(WorldStateTest)),
	)

	it.effect("loads state with empty storage", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			const dump: WorldStateDump = {
				[ADDR1]: {
					nonce: "0x1",
					balance: "0x10",
					code: "0x",
					storage: {},
				},
			}

			yield* ws.loadState(dump)

			const account = yield* ws.getAccount(ADDR1)
			expect(account.nonce).toBe(1n)
			expect(account.balance).toBe(16n)

			// No storage should be set
			const val = yield* ws.getStorage(ADDR1, SLOT_A)
			expect(val).toBe(0n)
		}).pipe(Effect.provide(WorldStateTest)),
	)

	it.effect("loads state with code", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			const dump: WorldStateDump = {
				[ADDR1]: {
					nonce: "0x0",
					balance: "0x0",
					code: "0x60006000fd",
					storage: {},
				},
			}

			yield* ws.loadState(dump)

			const account = yield* ws.getAccount(ADDR1)
			expect(account.code).toEqual(new Uint8Array([0x60, 0x00, 0x60, 0x00, 0xfd]))
		}).pipe(Effect.provide(WorldStateTest)),
	)

	it.effect("loadState merges with existing state (does not overwrite unrelated accounts)", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			// Set up existing account
			yield* ws.setAccount(ADDR1, { nonce: 1n, balance: 100n, code: new Uint8Array(0), codeHash: EMPTY_CODE_HASH })

			// Load a different account
			const dump: WorldStateDump = {
				[ADDR2]: {
					nonce: "0x3",
					balance: "0xc8",
					code: "0x",
					storage: {},
				},
			}
			yield* ws.loadState(dump)

			// Original account should still exist
			const acct1 = yield* ws.getAccount(ADDR1)
			expect(acct1.nonce).toBe(1n)
			expect(acct1.balance).toBe(100n)

			// New account should also exist
			const acct2 = yield* ws.getAccount(ADDR2)
			expect(acct2.nonce).toBe(3n)
			expect(acct2.balance).toBe(200n)
		}).pipe(Effect.provide(WorldStateTest)),
	)

	it.effect("loadState overwrites existing account at same address", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			yield* ws.setAccount(ADDR1, { nonce: 1n, balance: 100n, code: new Uint8Array(0), codeHash: EMPTY_CODE_HASH })

			const dump: WorldStateDump = {
				[ADDR1]: {
					nonce: "0xa",
					balance: "0x1f4",
					code: "0x",
					storage: {},
				},
			}
			yield* ws.loadState(dump)

			const account = yield* ws.getAccount(ADDR1)
			expect(account.nonce).toBe(10n)
			expect(account.balance).toBe(500n)
		}).pipe(Effect.provide(WorldStateTest)),
	)

	it.effect("loadState with multiple accounts and storage", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			const dump: WorldStateDump = {
				[ADDR1]: {
					nonce: "0x1",
					balance: "0xa",
					code: "0x",
					storage: { [SLOT_A]: "0x7b" },
				},
				[ADDR2]: {
					nonce: "0x2",
					balance: "0x14",
					code: "0x",
					storage: { [SLOT_B]: "0xf6", [SLOT_C]: "0x171" },
				},
			}

			yield* ws.loadState(dump)

			const acct1 = yield* ws.getAccount(ADDR1)
			expect(acct1.nonce).toBe(1n)

			const acct2 = yield* ws.getAccount(ADDR2)
			expect(acct2.nonce).toBe(2n)

			expect(yield* ws.getStorage(ADDR1, SLOT_A)).toBe(123n)
			expect(yield* ws.getStorage(ADDR2, SLOT_B)).toBe(246n)
			expect(yield* ws.getStorage(ADDR2, SLOT_C)).toBe(369n)
		}).pipe(Effect.provide(WorldStateTest)),
	)
})

// ---------------------------------------------------------------------------
// Round-trip: loadState then dumpState
// ---------------------------------------------------------------------------

describe("WorldState — loadState/dumpState round-trip", () => {
	it.effect("dump matches original after load (no storage)", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			const original: WorldStateDump = {
				[ADDR1]: {
					nonce: "0x5",
					balance: "0x3e8",
					code: "0x",
					storage: {},
				},
			}

			yield* ws.loadState(original)
			const dumped = yield* ws.dumpState()

			expect(dumped[ADDR1]?.nonce).toBe(original[ADDR1]?.nonce)
			expect(dumped[ADDR1]?.balance).toBe(original[ADDR1]?.balance)
			expect(dumped[ADDR1]?.code).toBe(original[ADDR1]?.code)
			expect(dumped[ADDR1]?.storage).toEqual(original[ADDR1]?.storage)
		}).pipe(Effect.provide(WorldStateTest)),
	)

	it.effect("dump matches original after load (with storage)", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			const original: WorldStateDump = {
				[ADDR1]: {
					nonce: "0x1",
					balance: "0x64",
					code: "0x",
					storage: {
						[SLOT_A]: "0x2a",
						[SLOT_B]: "0xff",
					},
				},
			}

			yield* ws.loadState(original)
			const dumped = yield* ws.dumpState()

			expect(dumped[ADDR1]?.nonce).toBe("0x1")
			expect(dumped[ADDR1]?.balance).toBe("0x64")
			expect(dumped[ADDR1]?.storage[SLOT_A]).toBe("0x2a")
			expect(dumped[ADDR1]?.storage[SLOT_B]).toBe("0xff")
		}).pipe(Effect.provide(WorldStateTest)),
	)

	it.effect("dump matches original after load (multiple accounts)", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			const original: WorldStateDump = {
				[ADDR1]: {
					nonce: "0x1",
					balance: "0xa",
					code: "0x",
					storage: { [SLOT_A]: "0x1" },
				},
				[ADDR2]: {
					nonce: "0x2",
					balance: "0x14",
					code: "0x",
					storage: { [SLOT_B]: "0x2" },
				},
				[ADDR3]: {
					nonce: "0x3",
					balance: "0x1e",
					code: "0x",
					storage: {},
				},
			}

			yield* ws.loadState(original)
			const dumped = yield* ws.dumpState()

			for (const addr of [ADDR1, ADDR2, ADDR3]) {
				expect(dumped[addr]?.nonce).toBe(original[addr]?.nonce)
				expect(dumped[addr]?.balance).toBe(original[addr]?.balance)
			}
			expect(dumped[ADDR1]?.storage[SLOT_A]).toBe("0x1")
			expect(dumped[ADDR2]?.storage[SLOT_B]).toBe("0x2")
			expect(dumped[ADDR3]?.storage).toEqual({})
		}).pipe(Effect.provide(WorldStateTest)),
	)
})

// ---------------------------------------------------------------------------
// clearState
// ---------------------------------------------------------------------------

describe("WorldState — clearState", () => {
	it.effect("clearState empties all accounts", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			yield* ws.setAccount(ADDR1, { nonce: 1n, balance: 100n, code: new Uint8Array(0), codeHash: EMPTY_CODE_HASH })
			yield* ws.setAccount(ADDR2, { nonce: 2n, balance: 200n, code: new Uint8Array(0), codeHash: EMPTY_CODE_HASH })

			yield* ws.clearState()

			const acct1 = yield* ws.getAccount(ADDR1)
			const acct2 = yield* ws.getAccount(ADDR2)
			expect(acct1.nonce).toBe(0n)
			expect(acct1.balance).toBe(0n)
			expect(acct2.nonce).toBe(0n)
			expect(acct2.balance).toBe(0n)
		}).pipe(Effect.provide(WorldStateTest)),
	)

	it.effect("clearState empties storage", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			yield* ws.setAccount(ADDR1, { ...EMPTY_ACCOUNT })
			yield* ws.setStorage(ADDR1, SLOT_A, 42n)

			yield* ws.clearState()

			const val = yield* ws.getStorage(ADDR1, SLOT_A)
			expect(val).toBe(0n)
		}).pipe(Effect.provide(WorldStateTest)),
	)

	it.effect("clearState then dumpState returns empty object", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			yield* ws.setAccount(ADDR1, { nonce: 1n, balance: 100n, code: new Uint8Array(0), codeHash: EMPTY_CODE_HASH })
			yield* ws.setStorage(ADDR1, SLOT_A, 99n)

			yield* ws.clearState()
			const dump = yield* ws.dumpState()

			expect(dump).toEqual({})
		}).pipe(Effect.provide(WorldStateTest)),
	)

	it.effect("can setAccount after clearState", () =>
		Effect.gen(function* () {
			const ws = yield* WorldStateService
			yield* ws.setAccount(ADDR1, { nonce: 1n, balance: 100n, code: new Uint8Array(0), codeHash: EMPTY_CODE_HASH })
			yield* ws.clearState()

			yield* ws.setAccount(ADDR2, { nonce: 5n, balance: 500n, code: new Uint8Array(0), codeHash: EMPTY_CODE_HASH })
			const acct = yield* ws.getAccount(ADDR2)
			expect(acct.nonce).toBe(5n)
			expect(acct.balance).toBe(500n)

			const dump = yield* ws.dumpState()
			expect(Object.keys(dump)).toEqual([ADDR2])
		}).pipe(Effect.provide(WorldStateTest)),
	)
})
