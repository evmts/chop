/**
 * Test helper: starts an RPC server with a pre-deployed contract.
 *
 * Used by E2E tests that need a running RPC endpoint.
 * Prints "PORT:<number>" to stdout when ready.
 *
 * The deployed contract at 0x00...42 returns 0x42 (66 decimal) as a 32-byte word
 * when called (bytecode: PUSH1 0x42, PUSH1 0x00, MSTORE, PUSH1 0x20, PUSH1 0x00, RETURN).
 */

import { Effect } from "effect"
import { hexToBytes } from "../evm/conversions.js"
import { TevmNode, TevmNodeService } from "../node/index.js"
import { startRpcServer } from "../rpc/server.js"

const main = Effect.gen(function* () {
	const node = yield* TevmNodeService

	// Deploy a simple contract at 0x00...42 that returns 0x42
	const contractAddr = `0x${"00".repeat(19)}42`
	const contractCode = new Uint8Array([0x60, 0x42, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3])
	yield* node.hostAdapter.setAccount(hexToBytes(contractAddr), {
		nonce: 0n,
		balance: 0n,
		codeHash: new Uint8Array(32),
		code: contractCode,
	})

	const server = yield* startRpcServer({ port: 0 }, node)
	console.log(`PORT:${server.port}`)

	// Keep process alive until killed
	yield* Effect.never
}).pipe(Effect.provide(TevmNode.LocalTest()))

Effect.runPromise(main)
