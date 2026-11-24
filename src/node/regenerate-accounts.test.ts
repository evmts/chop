import { Address } from "@tevm/voltaire/Address"
import { Effect } from "effect"
import { describe, expect, it } from "vitest"
import { hexToBytes } from "../evm/conversions.js"
import { getAccountDetails } from "../tui/views/accounts-data.js"
import { DEFAULT_BALANCE } from "./accounts.js"
import { TevmNode, TevmNodeService } from "./index.js"

describe("regenerateAccounts", () => {
	it("replaces the original accounts, funds the new keys and invalidates earlier snapshots", async () => {
		await Effect.runPromise(
			Effect.gen(function* () {
				const node = yield* TevmNodeService
				const old = node.accounts
				const unrelated = hexToBytes("0x000000000000000000000000000000000000abcd")
				const first = old[0]
				if (!first) throw new Error("Expected a development account")
				const oldAccount = yield* node.hostAdapter.getAccount(hexToBytes(first.address))
				yield* node.hostAdapter.setAccount(unrelated, { ...oldAccount, balance: 12n })
				const snapshot = yield* node.snapshotManager.take()
				yield* node.impersonationManager.impersonate(first.address)
				yield* node.regenerateAccounts()

				expect(node.accounts).toHaveLength(10)
				expect(new Set(node.accounts.map(({ address }) => address)).size).toBe(10)
				const accountsView = yield* getAccountDetails(node)
				expect(accountsView.accounts.map(({ address }) => address)).toEqual(node.accounts.map(({ address }) => address))
				for (const { address, privateKey } of node.accounts) {
					expect(privateKey).toMatch(/^0x[0-9a-f]{64}$/)
					expect(Address.toChecksummed(Address.fromPrivateKey(hexToBytes(privateKey)))).toBe(address)
					expect(yield* node.hostAdapter.getAccount(hexToBytes(address))).toMatchObject({
						balance: DEFAULT_BALANCE,
						nonce: 0n,
					})
				}
				for (const { address } of old) {
					expect(yield* node.hostAdapter.getAccount(hexToBytes(address))).toMatchObject({ balance: 0n })
				}
				expect(node.impersonationManager.isImpersonated(first.address)).toBe(false)
				expect(yield* node.hostAdapter.getAccount(unrelated)).toMatchObject({ balance: 12n })
				expect(yield* Effect.either(node.snapshotManager.revert(snapshot))).toMatchObject({ _tag: "Left" })
			}).pipe(Effect.provide(TevmNode.LocalTest())),
		)
	})
})
