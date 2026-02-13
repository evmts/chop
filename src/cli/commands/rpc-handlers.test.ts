import { Command } from "@effect/cli"
import { FetchHttpClient } from "@effect/platform"
import { NodeContext } from "@effect/platform-node"
import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { hexToBytes } from "../../evm/conversions.js"
import { TevmNode, TevmNodeService } from "../../node/index.js"
import { startRpcServer } from "../../rpc/server.js"
import {
	balanceCommand,
	balanceHandler,
	blockNumberCommand,
	blockNumberHandler,
	callCommand,
	callHandler,
	chainIdCommand,
	chainIdHandler,
	codeCommand,
	codeHandler,
	nonceCommand,
	nonceHandler,
	storageCommand,
	storageHandler,
} from "./rpc.js"

// ============================================================================
// hexToDecimal edge cases (tested indirectly through handlers)
// ============================================================================

describe("hexToDecimal — via chainIdHandler / blockNumberHandler", () => {
	it.effect("chainIdHandler converts hex chain ID to decimal string", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const result = yield* chainIdHandler(`http://127.0.0.1:${server.port}`)
				// 0x7a69 -> 31337
				expect(result).toBe("31337")
				// Must be a pure decimal string with no hex prefix
				expect(result).not.toContain("0x")
				// Must be parseable as a plain integer
				expect(Number.parseInt(result, 10).toString()).toBe(result)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("blockNumberHandler converts hex 0x0 to decimal '0'", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const result = yield* blockNumberHandler(`http://127.0.0.1:${server.port}`)
				expect(result).toBe("0")
				expect(result).not.toContain("0x")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("balanceHandler converts non-zero hex balance to decimal", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				// node.accounts[0] is funded with 10,000 ETH
				const funded = node.accounts[0]!
				const result = yield* balanceHandler(`http://127.0.0.1:${server.port}`, funded.address)
				const balanceWei = BigInt(result)
				// 10_000 ETH = 10_000 * 10^18 wei
				expect(balanceWei).toBe(10_000n * 10n ** 18n)
				// The result should be a pure decimal string
				expect(result).not.toContain("0x")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("nonceHandler converts non-zero hex nonce to decimal", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			// Set up an account with a specific non-zero nonce
			const testAddr = `0x${"ab".repeat(20)}`
			yield* node.hostAdapter.setAccount(hexToBytes(testAddr), {
				nonce: 7n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: new Uint8Array(0),
			})

			try {
				const result = yield* nonceHandler(`http://127.0.0.1:${server.port}`, testAddr)
				// 0x7 -> 7
				expect(result).toBe("7")
				expect(result).not.toContain("0x")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

// ============================================================================
// callHandler edge cases — invalid signature and wrong argument count
// ============================================================================

describe("callHandler — error edge cases", () => {
	it.effect("fails with InvalidSignatureError for malformed signature (no parens)", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const result = yield* callHandler(
					`http://127.0.0.1:${server.port}`,
					`0x${"00".repeat(20)}`,
					"noParensHere",
					[],
				).pipe(Effect.either)
				expect(result._tag).toBe("Left")
				if (result._tag === "Left") {
					expect(result.left._tag).toBe("InvalidSignatureError")
				}
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("fails with InvalidSignatureError for signature with invalid chars", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const result = yield* callHandler(
					`http://127.0.0.1:${server.port}`,
					`0x${"00".repeat(20)}`,
					"123bad!name(uint256)",
					[],
				).pipe(Effect.either)
				expect(result._tag).toBe("Left")
				if (result._tag === "Left") {
					expect(result.left._tag).toBe("InvalidSignatureError")
				}
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("fails with ArgumentCountError when too few args provided", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				// transfer(address,uint256) expects 2 args, provide only 1
				const result = yield* callHandler(
					`http://127.0.0.1:${server.port}`,
					`0x${"00".repeat(20)}`,
					"transfer(address,uint256)",
					["0x0000000000000000000000000000000000000001"],
				).pipe(Effect.either)
				expect(result._tag).toBe("Left")
				if (result._tag === "Left") {
					expect(result.left._tag).toBe("ArgumentCountError")
				}
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("fails with ArgumentCountError when too many args provided", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				// balanceOf(address) expects 1 arg, provide 2
				const result = yield* callHandler(
					`http://127.0.0.1:${server.port}`,
					`0x${"00".repeat(20)}`,
					"balanceOf(address)(uint256)",
					["0x0000000000000000000000000000000000000001", "0x0000000000000000000000000000000000000002"],
				).pipe(Effect.either)
				expect(result._tag).toBe("Left")
				if (result._tag === "Left") {
					expect(result.left._tag).toBe("ArgumentCountError")
				}
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("fails with InvalidSignatureError for unbalanced parens", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const result = yield* callHandler(
					`http://127.0.0.1:${server.port}`,
					`0x${"00".repeat(20)}`,
					"brokenSig(uint256",
					["42"],
				).pipe(Effect.either)
				expect(result._tag).toBe("Left")
				if (result._tag === "Left") {
					expect(result.left._tag).toBe("InvalidSignatureError")
				}
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

// ============================================================================
// Handler tests with funded / configured accounts
// ============================================================================

describe("balanceHandler — funded accounts", () => {
	it.effect("returns correct balance for second funded account", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const account = node.accounts[1]!
				const result = yield* balanceHandler(`http://127.0.0.1:${server.port}`, account.address)
				expect(BigInt(result)).toBe(10_000n * 10n ** 18n)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("returns zero for unfunded address", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const result = yield* balanceHandler(
					`http://127.0.0.1:${server.port}`,
					`0x${"de".repeat(20)}`,
				)
				expect(result).toBe("0")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("returns custom balance for manually-funded account", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			const testAddr = `0x${"ff".repeat(20)}`
			const customBalance = 12345678901234567890n
			yield* node.hostAdapter.setAccount(hexToBytes(testAddr), {
				nonce: 0n,
				balance: customBalance,
				codeHash: new Uint8Array(32),
				code: new Uint8Array(0),
			})

			try {
				const result = yield* balanceHandler(`http://127.0.0.1:${server.port}`, testAddr)
				expect(BigInt(result)).toBe(customBalance)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

describe("nonceHandler — accounts with non-zero nonce", () => {
	it.effect("returns zero nonce for funded account with no transactions", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const account = node.accounts[0]!
				const result = yield* nonceHandler(`http://127.0.0.1:${server.port}`, account.address)
				// Funded accounts start with nonce 0
				expect(result).toBe("0")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("returns correct nonce for account with high nonce", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			const testAddr = `0x${"bc".repeat(20)}`
			yield* node.hostAdapter.setAccount(hexToBytes(testAddr), {
				nonce: 999n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: new Uint8Array(0),
			})

			try {
				const result = yield* nonceHandler(`http://127.0.0.1:${server.port}`, testAddr)
				expect(result).toBe("999")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

// ============================================================================
// callHandler — success paths with deployed contracts
// ============================================================================

describe("callHandler — success with deployed contract", () => {
	it.effect("calls with no signature returns raw result", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			// Deploy contract that returns 0x42 as a 32-byte word
			// PUSH1 0x42, PUSH1 0x00, MSTORE, PUSH1 0x20, PUSH1 0x00, RETURN
			const contractAddr = `0x${"00".repeat(19)}99`
			const contractCode = new Uint8Array([0x60, 0x42, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3])
			yield* node.hostAdapter.setAccount(hexToBytes(contractAddr), {
				nonce: 0n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: contractCode,
			})

			try {
				const result = yield* callHandler(`http://127.0.0.1:${server.port}`, contractAddr, undefined, [])
				// Raw hex result, should contain 42 somewhere in the 32-byte word
				expect(result).toContain("42")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("calls with signature and output types decodes result", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			// Deploy contract that returns 0x42 (66 decimal) as a 32-byte word
			const contractAddr = `0x${"00".repeat(19)}88`
			const contractCode = new Uint8Array([0x60, 0x42, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3])
			yield* node.hostAdapter.setAccount(hexToBytes(contractAddr), {
				nonce: 0n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: contractCode,
			})

			try {
				// Signature with output types -> result is decoded via abiDecodeHandler
				const result = yield* callHandler(
					`http://127.0.0.1:${server.port}`,
					contractAddr,
					"getValue()(uint256)",
					[],
				)
				// 0x42 = 66 decimal
				expect(result).toContain("66")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("calls with signature without output types returns raw hex", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			const contractAddr = `0x${"00".repeat(19)}77`
			const contractCode = new Uint8Array([0x60, 0x42, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3])
			yield* node.hostAdapter.setAccount(hexToBytes(contractAddr), {
				nonce: 0n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: contractCode,
			})

			try {
				// Signature with NO output types -> returns raw hex
				const result = yield* callHandler(
					`http://127.0.0.1:${server.port}`,
					contractAddr,
					"getValue()",
					[],
				)
				// Should contain the hex representation
				expect(result).toContain("42")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("calls with signature, args, and output types encodes and decodes", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			// This contract ignores calldata and always returns 0x42
			const contractAddr = `0x${"00".repeat(19)}66`
			const contractCode = new Uint8Array([0x60, 0x42, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3])
			yield* node.hostAdapter.setAccount(hexToBytes(contractAddr), {
				nonce: 0n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: contractCode,
			})

			try {
				const result = yield* callHandler(
					`http://127.0.0.1:${server.port}`,
					contractAddr,
					"balanceOf(address)(uint256)",
					["0x0000000000000000000000000000000000000001"],
				)
				// 0x42 = 66
				expect(result).toContain("66")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

// ============================================================================
// codeHandler and storageHandler with deployed state
// ============================================================================

describe("codeHandler — with deployed bytecode", () => {
	it.effect("returns bytecode for a deployed contract", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			const contractAddr = `0x${"aa".repeat(20)}`
			// Simple bytecode: PUSH1 0xFF, PUSH1 0x00, MSTORE, PUSH1 0x20, PUSH1 0x00, RETURN
			const contractCode = new Uint8Array([0x60, 0xff, 0x60, 0x00, 0x52, 0x60, 0x20, 0x60, 0x00, 0xf3])
			yield* node.hostAdapter.setAccount(hexToBytes(contractAddr), {
				nonce: 1n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: contractCode,
			})

			try {
				const result = yield* codeHandler(`http://127.0.0.1:${server.port}`, contractAddr)
				expect(result).toContain("60ff")
				expect(result.startsWith("0x")).toBe(true)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("returns 0x for an EOA with no code", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				// An address that has no code deployed
				const result = yield* codeHandler(
					`http://127.0.0.1:${server.port}`,
					`0x${"11".repeat(20)}`,
				)
				expect(result).toBe("0x")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

describe("storageHandler — with set storage values", () => {
	it.effect("returns non-zero storage at specific slot", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)

			const testAddr = `0x${"bb".repeat(20)}`
			const slot = `0x${"00".repeat(31)}05`
			yield* node.hostAdapter.setAccount(hexToBytes(testAddr), {
				nonce: 0n,
				balance: 0n,
				codeHash: new Uint8Array(32),
				code: new Uint8Array(0),
			})
			yield* node.hostAdapter.setStorage(hexToBytes(testAddr), hexToBytes(slot), 255n)

			try {
				const result = yield* storageHandler(`http://127.0.0.1:${server.port}`, testAddr, slot)
				// 255 = 0xff
				expect(result).toContain("ff")
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)

	it.effect("returns zero storage at unset slot", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				const result = yield* storageHandler(
					`http://127.0.0.1:${server.port}`,
					`0x${"22".repeat(20)}`,
					`0x${"00".repeat(32)}`,
				)
				expect(result).toBe(`0x${"00".repeat(32)}`)
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest()), Effect.provide(FetchHttpClient.layer)),
	)
})

// ============================================================================
// In-process Command execution tests — covers Command.make bodies
// (lines 152-259, 281-289 in rpc.ts)
// ============================================================================

/**
 * Helper to run a Command in-process with the given argv.
 * This exercises the Command.make body code (option parsing, JSON formatting,
 * Console.log, Effect.provide(FetchHttpClient.layer), handleCommandErrors).
 *
 * Command.run expects process.argv format: [node, script, ...args]
 * The first two elements are stripped, so actual args start at index 2.
 */
const runCommand = (cmd: Command.Command<unknown>, argv: string[]) => {
	const runner = Command.run(
		Command.make("test").pipe(Command.withSubcommands([cmd])),
		{ name: "test", version: "0.0.0" },
	)
	return runner(["node", "script", ...argv]).pipe(Effect.provide(NodeContext.layer))
}

const ZERO_ADDR = "0x0000000000000000000000000000000000000000"
const ZERO_SLOT = "0x0000000000000000000000000000000000000000000000000000000000000000"

describe("Command.make bodies — in-process execution", () => {
	it.effect("chainIdCommand runs successfully in-process", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				yield* runCommand(chainIdCommand, ["chain-id", "-r", `http://127.0.0.1:${server.port}`])
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("chainIdCommand with --json flag runs successfully", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				yield* runCommand(chainIdCommand, ["chain-id", "-r", `http://127.0.0.1:${server.port}`, "--json"])
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("blockNumberCommand runs successfully in-process", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				yield* runCommand(blockNumberCommand, ["block-number", "-r", `http://127.0.0.1:${server.port}`])
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("blockNumberCommand with --json flag runs successfully", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				yield* runCommand(blockNumberCommand, ["block-number", "-r", `http://127.0.0.1:${server.port}`, "--json"])
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("balanceCommand runs successfully in-process", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				yield* runCommand(balanceCommand, ["balance", ZERO_ADDR, "-r", `http://127.0.0.1:${server.port}`])
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("balanceCommand with --json flag runs successfully", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				yield* runCommand(balanceCommand, [
					"balance",
					ZERO_ADDR,
					"-r",
					`http://127.0.0.1:${server.port}`,
					"--json",
				])
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("nonceCommand runs successfully in-process", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				yield* runCommand(nonceCommand, ["nonce", ZERO_ADDR, "-r", `http://127.0.0.1:${server.port}`])
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("nonceCommand with --json flag runs successfully", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				yield* runCommand(nonceCommand, ["nonce", ZERO_ADDR, "-r", `http://127.0.0.1:${server.port}`, "--json"])
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("codeCommand runs successfully in-process", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				yield* runCommand(codeCommand, ["code", ZERO_ADDR, "-r", `http://127.0.0.1:${server.port}`])
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("codeCommand with --json flag runs successfully", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				yield* runCommand(codeCommand, ["code", ZERO_ADDR, "-r", `http://127.0.0.1:${server.port}`, "--json"])
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("storageCommand runs successfully in-process", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				yield* runCommand(storageCommand, [
					"storage",
					ZERO_ADDR,
					ZERO_SLOT,
					"-r",
					`http://127.0.0.1:${server.port}`,
				])
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("storageCommand with --json flag runs successfully", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				yield* runCommand(storageCommand, [
					"storage",
					ZERO_ADDR,
					ZERO_SLOT,
					"-r",
					`http://127.0.0.1:${server.port}`,
					"--json",
				])
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("callCommand runs successfully in-process (no sig)", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				yield* runCommand(callCommand, [
					"call",
					"--to",
					ZERO_ADDR,
					"-r",
					`http://127.0.0.1:${server.port}`,
				])
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)

	it.effect("callCommand with --json flag runs successfully", () =>
		Effect.gen(function* () {
			const node = yield* TevmNodeService
			const server = yield* startRpcServer({ port: 0 }, node)
			try {
				yield* runCommand(callCommand, [
					"call",
					"--to",
					ZERO_ADDR,
					"-r",
					`http://127.0.0.1:${server.port}`,
					"--json",
				])
			} finally {
				yield* server.close()
			}
		}).pipe(Effect.provide(TevmNode.LocalTest())),
	)
})
