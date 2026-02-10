import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect } from "vitest"
import { Keccak256 } from "voltaire-effect"
import { runCli } from "../test-helpers.js"
import {
	ComputeAddressError,
	InvalidAddressError,
	InvalidHexError,
	computeAddressCommand,
	computeAddressHandler,
	create2Command,
	create2Handler,
	toCheckSumAddressCommand,
	toCheckSumAddressHandler,
} from "./address.js"

// ---------------------------------------------------------------------------
// Error Types
// ---------------------------------------------------------------------------

describe("InvalidAddressError", () => {
	it("has correct tag and fields", () => {
		const error = new InvalidAddressError({
			message: "Invalid address",
			address: "0xbad",
		})
		expect(error._tag).toBe("InvalidAddressError")
		expect(error.address).toBe("0xbad")
		expect(error.message).toBe("Invalid address")
	})

	it.effect("can be caught by tag in Effect pipeline", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(new InvalidAddressError({ message: "bad", address: "0x123" })).pipe(
				Effect.catchTag("InvalidAddressError", (e) => Effect.succeed(`caught: ${e.address}`)),
			)
			expect(result).toBe("caught: 0x123")
		}),
	)
})

describe("InvalidHexError", () => {
	it("has correct tag and fields", () => {
		const error = new InvalidHexError({
			message: "Invalid hex",
			hex: "0xgg",
		})
		expect(error._tag).toBe("InvalidHexError")
		expect(error.hex).toBe("0xgg")
	})
})

describe("ComputeAddressError", () => {
	it("has correct tag and fields", () => {
		const error = new ComputeAddressError({
			message: "Computation failed",
		})
		expect(error._tag).toBe("ComputeAddressError")
		expect(error.message).toBe("Computation failed")
	})

	it("preserves cause", () => {
		const cause = new Error("original")
		const error = new ComputeAddressError({
			message: "wrapped",
			cause,
		})
		expect(error.cause).toBe(cause)
	})
})

// ---------------------------------------------------------------------------
// toCheckSumAddressHandler
// ---------------------------------------------------------------------------

describe("toCheckSumAddressHandler", () => {
	it.effect("checksums Vitalik's lowercase address", () =>
		Effect.gen(function* () {
			const result = yield* toCheckSumAddressHandler("0xd8da6bf26964af9d7eed9e03e53415d37aa96045")
			expect(result).toBe("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("checksums uppercase address", () =>
		Effect.gen(function* () {
			const result = yield* toCheckSumAddressHandler("0xD8DA6BF26964AF9D7EED9E03E53415D37AA96045")
			expect(result).toBe("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("passes through already checksummed address", () =>
		Effect.gen(function* () {
			const result = yield* toCheckSumAddressHandler("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")
			expect(result).toBe("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("checksums zero address", () =>
		Effect.gen(function* () {
			const result = yield* toCheckSumAddressHandler("0x0000000000000000000000000000000000000000")
			expect(result).toBe("0x0000000000000000000000000000000000000000")
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("checksums all-ff address", () =>
		Effect.gen(function* () {
			const result = yield* toCheckSumAddressHandler("0xffffffffffffffffffffffffffffffffffffffff")
			// All-ff address checksummed
			expect(result.toLowerCase()).toBe("0xffffffffffffffffffffffffffffffffffffffff")
			expect(result.startsWith("0x")).toBe(true)
			expect(result.length).toBe(42)
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("fails on invalid address (too short)", () =>
		Effect.gen(function* () {
			const error = yield* toCheckSumAddressHandler("0x1234").pipe(Effect.flip)
			expect(error._tag).toBe("InvalidAddressError")
			expect(error.address).toBe("0x1234")
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("fails on non-hex string", () =>
		Effect.gen(function* () {
			const error = yield* toCheckSumAddressHandler("not-an-address").pipe(Effect.flip)
			expect(error._tag).toBe("InvalidAddressError")
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("fails on empty string", () =>
		Effect.gen(function* () {
			const error = yield* toCheckSumAddressHandler("").pipe(Effect.flip)
			expect(error._tag).toBe("InvalidAddressError")
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("fails on address too long", () =>
		Effect.gen(function* () {
			const error = yield* toCheckSumAddressHandler(`0x${"aa".repeat(21)}`).pipe(Effect.flip)
			expect(error._tag).toBe("InvalidAddressError")
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)
})

// ---------------------------------------------------------------------------
// computeAddressHandler
// ---------------------------------------------------------------------------

describe("computeAddressHandler", () => {
	it.effect("computes CREATE address for Hardhat deployer nonce 0", () =>
		Effect.gen(function* () {
			// Hardhat's first default account deploying at nonce 0
			// 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 with nonce 0
			// produces 0x5FbDB2315678afecb367f032d93F642f64180aa3
			const result = yield* computeAddressHandler("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", "0")
			expect(result.toLowerCase()).toBe("0x5fbdb2315678afecb367f032d93f642f64180aa3")
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("computes CREATE address for nonce 1", () =>
		Effect.gen(function* () {
			// Hardhat deployer nonce 1
			// 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 with nonce 1
			// produces 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
			const result = yield* computeAddressHandler("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", "1")
			expect(result.toLowerCase()).toBe("0xe7f1725e7734ce288f8367e1bb143e90bb3f0512")
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("returns checksummed address", () =>
		Effect.gen(function* () {
			const result = yield* computeAddressHandler("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", "0")
			// Should have mixed case (checksummed)
			expect(result).toMatch(/^0x[0-9a-fA-F]{40}$/)
			// Specifically verify it's checksummed
			expect(result).toBe("0x5FbDB2315678afecb367f032d93F642f64180aa3")
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("fails on invalid deployer address", () =>
		Effect.gen(function* () {
			const error = yield* computeAddressHandler("0xbad", "0").pipe(Effect.flip)
			expect(error._tag).toBe("InvalidAddressError")
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("fails on invalid nonce (non-numeric)", () =>
		Effect.gen(function* () {
			const error = yield* computeAddressHandler("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", "abc").pipe(Effect.flip)
			expect(error._tag).toBe("ComputeAddressError")
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("fails on negative nonce", () =>
		Effect.gen(function* () {
			const error = yield* computeAddressHandler("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", "-1").pipe(Effect.flip)
			expect(error._tag).toBe("ComputeAddressError")
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)
})

// ---------------------------------------------------------------------------
// create2Handler
// ---------------------------------------------------------------------------

describe("create2Handler", () => {
	it.effect("computes CREATE2 address for EIP-1014 test vector 0", () =>
		Effect.gen(function* () {
			// EIP-1014 Example 0:
			// deployer: 0x0000000000000000000000000000000000000000
			// salt: 0x0000000000000000000000000000000000000000000000000000000000000000
			// init-code: 0x00 (single zero byte)
			// Expected: 0x4D1A2e2bB4F88F0250f26Ffff098B0b30B26BF38
			const result = yield* create2Handler(
				"0x0000000000000000000000000000000000000000",
				"0x0000000000000000000000000000000000000000000000000000000000000000",
				"0x00",
			)
			expect(result).toBe("0x4D1A2e2bB4F88F0250f26Ffff098B0b30B26BF38")
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("computes CREATE2 with non-zero salt", () =>
		Effect.gen(function* () {
			// deployer: 0x0000000000000000000000000000000000000000
			// salt: 0x0000000000000000000000000000000000000000000000000000000000000001
			// init-code: 0x00
			// Expected: 0x90954Abfd77F834cbAbb76D9DA5e0e93F2f42464
			const result = yield* create2Handler(
				"0x0000000000000000000000000000000000000000",
				"0x0000000000000000000000000000000000000000000000000000000000000001",
				"0x00",
			)
			expect(result).toBe("0x90954Abfd77F834cbAbb76D9DA5e0e93F2f42464")
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("returns checksummed address", () =>
		Effect.gen(function* () {
			const result = yield* create2Handler(
				"0x0000000000000000000000000000000000000000",
				"0x0000000000000000000000000000000000000000000000000000000000000000",
				"0x00",
			)
			// EIP-1014 test vector 0 — exact checksummed output
			expect(result).toBe("0x4D1A2e2bB4F88F0250f26Ffff098B0b30B26BF38")
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("fails on invalid deployer address", () =>
		Effect.gen(function* () {
			const error = yield* create2Handler(
				"0xbad",
				"0x0000000000000000000000000000000000000000000000000000000000000000",
				"0x00",
			).pipe(Effect.flip)
			expect(error._tag).toBe("InvalidAddressError")
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("fails on invalid salt (not 32 bytes)", () =>
		Effect.gen(function* () {
			const error = yield* create2Handler(
				"0x0000000000000000000000000000000000000000",
				"0x01", // Not 32 bytes
				"0x00",
			).pipe(Effect.flip)
			expect(error._tag).toBe("InvalidHexError")
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("fails on invalid init-code hex", () =>
		Effect.gen(function* () {
			const error = yield* create2Handler(
				"0x0000000000000000000000000000000000000000",
				"0x0000000000000000000000000000000000000000000000000000000000000000",
				"not-hex",
			).pipe(Effect.flip)
			expect(error._tag).toBe("InvalidHexError")
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("fails on salt without 0x prefix", () =>
		Effect.gen(function* () {
			const error = yield* create2Handler(
				"0x0000000000000000000000000000000000000000",
				"0000000000000000000000000000000000000000000000000000000000000000",
				"0x00",
			).pipe(Effect.flip)
			expect(error._tag).toBe("InvalidHexError")
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)
})

// ---------------------------------------------------------------------------
// Command exports
// ---------------------------------------------------------------------------

describe("address command exports", () => {
	it("exports toCheckSumAddressCommand", () => {
		expect(toCheckSumAddressCommand).toBeDefined()
	})

	it("exports computeAddressCommand", () => {
		expect(computeAddressCommand).toBeDefined()
	})

	it("exports create2Command", () => {
		expect(create2Command).toBeDefined()
	})
})

// ---------------------------------------------------------------------------
// E2E CLI tests
// ---------------------------------------------------------------------------

describe("chop to-check-sum-address (E2E)", () => {
	it("checksums Vitalik's address", () => {
		const result = runCli("to-check-sum-address 0xd8da6bf26964af9d7eed9e03e53415d37aa96045")
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")
	})

	it("produces JSON output with --json flag", () => {
		const result = runCli("to-check-sum-address --json 0xd8da6bf26964af9d7eed9e03e53415d37aa96045")
		expect(result.exitCode).toBe(0)
		const parsed = JSON.parse(result.stdout.trim())
		expect(parsed.result).toBe("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")
	})

	it("exits 1 on invalid address", () => {
		const result = runCli("to-check-sum-address 0xbad")
		expect(result.exitCode).not.toBe(0)
	})

	it("exits 1 on non-hex address", () => {
		const result = runCli("to-check-sum-address not-an-address")
		expect(result.exitCode).not.toBe(0)
	})
})

describe("chop compute-address (E2E)", () => {
	it("computes CREATE address for Hardhat deployer nonce 0", () => {
		const result = runCli("compute-address --deployer 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 --nonce 0")
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim().toLowerCase()).toBe("0x5fbdb2315678afecb367f032d93f642f64180aa3")
	})

	it("produces JSON output with --json flag", () => {
		const result = runCli("compute-address --json --deployer 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 --nonce 0")
		expect(result.exitCode).toBe(0)
		const parsed = JSON.parse(result.stdout.trim())
		expect(parsed.result.toLowerCase()).toBe("0x5fbdb2315678afecb367f032d93f642f64180aa3")
	})

	it("exits 1 on invalid deployer address", () => {
		const result = runCli("compute-address --deployer 0xbad --nonce 0")
		expect(result.exitCode).not.toBe(0)
	})

	it("exits 1 on invalid nonce", () => {
		const result = runCli("compute-address --deployer 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 --nonce abc")
		expect(result.exitCode).not.toBe(0)
	})
})

describe("chop create2 (E2E)", () => {
	it("computes CREATE2 address for EIP-1014 test vector", () => {
		const result = runCli(
			"create2 --deployer 0x0000000000000000000000000000000000000000 --salt 0x0000000000000000000000000000000000000000000000000000000000000000 --init-code 0x00",
		)
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("0x4D1A2e2bB4F88F0250f26Ffff098B0b30B26BF38")
	})

	it("produces JSON output with --json flag", () => {
		const result = runCli(
			"create2 --json --deployer 0x0000000000000000000000000000000000000000 --salt 0x0000000000000000000000000000000000000000000000000000000000000000 --init-code 0x00",
		)
		expect(result.exitCode).toBe(0)
		const parsed = JSON.parse(result.stdout.trim())
		expect(parsed.result).toBe("0x4D1A2e2bB4F88F0250f26Ffff098B0b30B26BF38")
	})

	it("exits 1 on invalid deployer", () => {
		const result = runCli(
			"create2 --deployer 0xbad --salt 0x0000000000000000000000000000000000000000000000000000000000000000 --init-code 0x00",
		)
		expect(result.exitCode).not.toBe(0)
	})

	it("exits 1 on invalid salt", () => {
		const result = runCli("create2 --deployer 0x0000000000000000000000000000000000000000 --salt 0x01 --init-code 0x00")
		expect(result.exitCode).not.toBe(0)
	})

	it("exits 1 on invalid init-code", () => {
		const result = runCli(
			"create2 --deployer 0x0000000000000000000000000000000000000000 --salt 0x0000000000000000000000000000000000000000000000000000000000000000 --init-code not-hex",
		)
		expect(result.exitCode).not.toBe(0)
	})
})

// ---------------------------------------------------------------------------
// Boundary Conditions — toCheckSumAddressHandler
// ---------------------------------------------------------------------------

describe("toCheckSumAddressHandler — boundary conditions", () => {
	it.effect("zero address → 0x0000000000000000000000000000000000000000", () =>
		toCheckSumAddressHandler("0x0000000000000000000000000000000000000000").pipe(
			Effect.provide(Keccak256.KeccakLive),
			Effect.map((result) => {
				expect(result).toBe("0x0000000000000000000000000000000000000000")
			}),
		),
	)

	it.effect("max address (all ff) → proper checksummed form", () =>
		toCheckSumAddressHandler("0xffffffffffffffffffffffffffffffffffffffff").pipe(
			Effect.provide(Keccak256.KeccakLive),
			Effect.map((result) => {
				expect(result.toLowerCase()).toBe("0xffffffffffffffffffffffffffffffffffffffff")
				expect(result.startsWith("0x")).toBe(true)
				expect(result.length).toBe(42)
			}),
		),
	)

	it.effect("address with only numbers (no letters) → passes through", () =>
		toCheckSumAddressHandler("0x1111111111111111111111111111111111111111").pipe(
			Effect.provide(Keccak256.KeccakLive),
			Effect.map((result) => {
				expect(result).toBe("0x1111111111111111111111111111111111111111")
			}),
		),
	)

	it.effect("too short address → InvalidAddressError", () =>
		toCheckSumAddressHandler("0x1234").pipe(
			Effect.provide(Keccak256.KeccakLive),
			Effect.flip,
			Effect.map((e) => {
				expect(e._tag).toBe("InvalidAddressError")
			}),
		),
	)

	it.effect("too long address → InvalidAddressError", () =>
		toCheckSumAddressHandler("0x" + "aa".repeat(21)).pipe(
			Effect.provide(Keccak256.KeccakLive),
			Effect.flip,
			Effect.map((e) => {
				expect(e._tag).toBe("InvalidAddressError")
			}),
		),
	)

	it.effect("missing 0x prefix → fails", () =>
		toCheckSumAddressHandler("d8da6bf26964af9d7eed9e03e53415d37aa96045").pipe(
			Effect.provide(Keccak256.KeccakLive),
			Effect.flip,
			Effect.map((e) => {
				expect(e._tag).toBe("InvalidAddressError")
			}),
		),
	)

	it.effect("non-hex characters → fails", () =>
		toCheckSumAddressHandler("0xgggggggggggggggggggggggggggggggggggggggg").pipe(
			Effect.provide(Keccak256.KeccakLive),
			Effect.flip,
			Effect.map((e) => {
				expect(e._tag).toBe("InvalidAddressError")
			}),
		),
	)

	it.effect("empty string → InvalidAddressError", () =>
		toCheckSumAddressHandler("").pipe(
			Effect.provide(Keccak256.KeccakLive),
			Effect.flip,
			Effect.map((e) => {
				expect(e._tag).toBe("InvalidAddressError")
			}),
		),
	)
})

// ---------------------------------------------------------------------------
// Boundary Conditions — computeAddressHandler
// ---------------------------------------------------------------------------

describe("computeAddressHandler — boundary conditions", () => {
	it.effect("nonce 0 → known address (using known deployer)", () =>
		computeAddressHandler("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", "0").pipe(
			Effect.provide(Keccak256.KeccakLive),
			Effect.map((result) => {
				expect(result.toLowerCase()).toBe("0x5fbdb2315678afecb367f032d93f642f64180aa3")
			}),
		),
	)

	it.effect("high nonce (1000000) → succeeds without error", () =>
		computeAddressHandler("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", "1000000").pipe(
			Effect.provide(Keccak256.KeccakLive),
			Effect.map((result) => {
				expect(result).toMatch(/^0x[0-9a-fA-F]{40}$/)
			}),
		),
	)

	it.effect("negative nonce → ComputeAddressError", () =>
		computeAddressHandler("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", "-1").pipe(
			Effect.provide(Keccak256.KeccakLive),
			Effect.flip,
			Effect.map((e) => {
				expect(e._tag).toBe("ComputeAddressError")
			}),
		),
	)

	it.effect("non-numeric nonce → ComputeAddressError", () =>
		computeAddressHandler("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", "abc").pipe(
			Effect.provide(Keccak256.KeccakLive),
			Effect.flip,
			Effect.map((e) => {
				expect(e._tag).toBe("ComputeAddressError")
			}),
		),
	)

	it.effect("decimal nonce → ComputeAddressError (e.g. \"1.5\")", () =>
		computeAddressHandler("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", "1.5").pipe(
			Effect.provide(Keccak256.KeccakLive),
			Effect.flip,
			Effect.map((e) => {
				expect(e._tag).toBe("ComputeAddressError")
			}),
		),
	)

	it.effect("empty nonce string → succeeds (BigInt('') === 0n)", () =>
		computeAddressHandler("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", "").pipe(
			Effect.provide(Keccak256.KeccakLive),
			Effect.map((result) => {
				expect(result.startsWith("0x")).toBe(true)
				expect(result.length).toBe(42)
			}),
		),
	)

	it.effect("invalid deployer → InvalidAddressError", () =>
		computeAddressHandler("0xbad", "0").pipe(
			Effect.provide(Keccak256.KeccakLive),
			Effect.flip,
			Effect.map((e) => {
				expect(e._tag).toBe("InvalidAddressError")
			}),
		),
	)
})

// ---------------------------------------------------------------------------
// Boundary Conditions — create2Handler
// ---------------------------------------------------------------------------

describe("create2Handler — boundary conditions", () => {
	it.effect("zero salt (0x + 64 zeros) → valid result", () =>
		create2Handler(
			"0x0000000000000000000000000000000000000000",
			"0x0000000000000000000000000000000000000000000000000000000000000000",
			"0x00",
		).pipe(
			Effect.provide(Keccak256.KeccakLive),
			Effect.map((result) => {
				expect(result).toBe("0x4D1A2e2bB4F88F0250f26Ffff098B0b30B26BF38")
			}),
		),
	)

	it.effect("max salt (0x + 64 f's) → valid result", () =>
		create2Handler(
			"0x0000000000000000000000000000000000000000",
			"0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
			"0x00",
		).pipe(
			Effect.provide(Keccak256.KeccakLive),
			Effect.map((result) => {
				expect(result).toMatch(/^0x[0-9a-fA-F]{40}$/)
			}),
		),
	)

	it.effect("empty init code (0x) → valid result (empty code)", () =>
		create2Handler(
			"0x0000000000000000000000000000000000000000",
			"0x0000000000000000000000000000000000000000000000000000000000000000",
			"0x",
		).pipe(
			Effect.provide(Keccak256.KeccakLive),
			Effect.map((result) => {
				expect(result).toMatch(/^0x[0-9a-fA-F]{40}$/)
			}),
		),
	)

	it.effect("salt too short (not 32 bytes) → InvalidHexError", () =>
		create2Handler("0x0000000000000000000000000000000000000000", "0x01", "0x00").pipe(
			Effect.provide(Keccak256.KeccakLive),
			Effect.flip,
			Effect.map((e) => {
				expect(e._tag).toBe("InvalidHexError")
			}),
		),
	)

	it.effect("salt not hex → InvalidHexError", () =>
		create2Handler("0x0000000000000000000000000000000000000000", "not-a-salt", "0x00").pipe(
			Effect.provide(Keccak256.KeccakLive),
			Effect.flip,
			Effect.map((e) => {
				expect(e._tag).toBe("InvalidHexError")
			}),
		),
	)

	it.effect("init code not hex → InvalidHexError", () =>
		create2Handler(
			"0x0000000000000000000000000000000000000000",
			"0x0000000000000000000000000000000000000000000000000000000000000000",
			"not-hex",
		).pipe(
			Effect.provide(Keccak256.KeccakLive),
			Effect.flip,
			Effect.map((e) => {
				expect(e._tag).toBe("InvalidHexError")
			}),
		),
	)

	it.effect("invalid deployer → fails", () =>
		create2Handler(
			"0xbad",
			"0x0000000000000000000000000000000000000000000000000000000000000000",
			"0x00",
		).pipe(
			Effect.provide(Keccak256.KeccakLive),
			Effect.flip,
			Effect.map((e) => {
				expect(e._tag).toBe("InvalidAddressError")
			}),
		),
	)
})
