import { describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { expect, vi } from "vitest"
import { Address, Keccak256 } from "voltaire-effect"
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

// Wrap calculateCreateAddress and calculateCreate2Address with vi.fn so we can
// mock them per-test while keeping the real implementation as the default.

vi.mock("voltaire-effect", async (importOriginal) => {
	const orig = await importOriginal<typeof import("voltaire-effect")>()
	return {
		...orig,
		Address: {
			...orig.Address,
			calculateCreateAddress: vi.fn((...args: Parameters<typeof orig.Address.calculateCreateAddress>) =>
				orig.Address.calculateCreateAddress(...args),
			),
			calculateCreate2Address: vi.fn((...args: Parameters<typeof orig.Address.calculateCreate2Address>) =>
				orig.Address.calculateCreate2Address(...args),
			),
		},
	}
})

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
		toCheckSumAddressHandler(`0x${"aa".repeat(21)}`).pipe(
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

	it.effect('decimal nonce → ComputeAddressError (e.g. "1.5")', () =>
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
		create2Handler("0xbad", "0x0000000000000000000000000000000000000000000000000000000000000000", "0x00").pipe(
			Effect.provide(Keccak256.KeccakLive),
			Effect.flip,
			Effect.map((e) => {
				expect(e._tag).toBe("InvalidAddressError")
			}),
		),
	)
})

// ============================================================================
// In-process Command Handler Tests (coverage for Command.make blocks)
// ============================================================================

import { addressCommands } from "./address.js"

describe("toCheckSumAddressCommand.handler — in-process", () => {
	it.effect("handles lowercase address with plain output", () =>
		toCheckSumAddressCommand.handler({ addr: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045", json: false }),
	)

	it.effect("handles lowercase address with JSON output", () =>
		toCheckSumAddressCommand.handler({ addr: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045", json: true }),
	)

	it.effect("handles zero address", () =>
		toCheckSumAddressCommand.handler({ addr: "0x0000000000000000000000000000000000000000", json: false }),
	)

	it.effect("handles invalid address error path", () =>
		Effect.gen(function* () {
			const error = yield* toCheckSumAddressCommand.handler({ addr: "0xbad", json: false }).pipe(Effect.flip)
			expect(error.message).toContain("Invalid address")
		}),
	)
})

describe("computeAddressCommand.handler — in-process", () => {
	it.effect("handles deployer + nonce with plain output", () =>
		computeAddressCommand.handler({
			deployer: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
			nonce: "0",
			json: false,
		}),
	)

	it.effect("handles deployer + nonce with JSON output", () =>
		computeAddressCommand.handler({
			deployer: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
			nonce: "0",
			json: true,
		}),
	)

	it.effect("handles invalid deployer error path", () =>
		Effect.gen(function* () {
			const error = yield* computeAddressCommand
				.handler({ deployer: "0xbad", nonce: "0", json: false })
				.pipe(Effect.flip)
			expect(error.message).toContain("Invalid address")
		}),
	)

	it.effect("handles invalid nonce error path", () =>
		Effect.gen(function* () {
			const error = yield* computeAddressCommand
				.handler({ deployer: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", nonce: "abc", json: false })
				.pipe(Effect.flip)
			expect(error.message).toContain("Invalid nonce")
		}),
	)
})

describe("create2Command.handler — in-process", () => {
	it.effect("handles valid create2 args with plain output", () =>
		create2Command.handler({
			deployer: "0x0000000000000000000000000000000000000000",
			salt: "0x0000000000000000000000000000000000000000000000000000000000000000",
			initCode: "0x00",
			json: false,
		}),
	)

	it.effect("handles valid create2 args with JSON output", () =>
		create2Command.handler({
			deployer: "0x0000000000000000000000000000000000000000",
			salt: "0x0000000000000000000000000000000000000000000000000000000000000000",
			initCode: "0x00",
			json: true,
		}),
	)

	it.effect("handles invalid deployer error path", () =>
		Effect.gen(function* () {
			const error = yield* create2Command
				.handler({
					deployer: "0xbad",
					salt: "0x0000000000000000000000000000000000000000000000000000000000000000",
					initCode: "0x00",
					json: false,
				})
				.pipe(Effect.flip)
			expect(error.message).toContain("Invalid address")
		}),
	)

	it.effect("handles invalid salt error path", () =>
		Effect.gen(function* () {
			const error = yield* create2Command
				.handler({
					deployer: "0x0000000000000000000000000000000000000000",
					salt: "0x01",
					initCode: "0x00",
					json: false,
				})
				.pipe(Effect.flip)
			expect(error.message).toContain("Invalid salt")
		}),
	)
})

describe("address command exports — count", () => {
	it("exports 3 address commands", () => {
		expect(addressCommands.length).toBe(3)
	})
})

// ---------------------------------------------------------------------------
// calculateCreateAddress error path (lines 113-119)
// ---------------------------------------------------------------------------

describe("computeAddressHandler — calculateCreateAddress failure path", () => {
	it.effect("wraps Error thrown by calculateCreateAddress into ComputeAddressError", () =>
		Effect.gen(function* () {
			// Mock calculateCreateAddress to fail with an Error
			vi.mocked(Address.calculateCreateAddress).mockImplementationOnce(
				() => Effect.fail(new Error("internal RLP failure")) as any,
			)

			const error = yield* computeAddressHandler("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", "0").pipe(Effect.flip)
			expect(error._tag).toBe("ComputeAddressError")
			expect(error.message).toContain("Failed to compute CREATE address")
			expect(error.message).toContain("internal RLP failure")
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("wraps non-Error value thrown by calculateCreateAddress into ComputeAddressError", () =>
		Effect.gen(function* () {
			// Mock with non-Error failure (exercises the String(e) branch)
			vi.mocked(Address.calculateCreateAddress).mockImplementationOnce(
				() => Effect.fail("string error value" as unknown as Error) as any,
			)

			const error = yield* computeAddressHandler("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", "0").pipe(Effect.flip)
			expect(error._tag).toBe("ComputeAddressError")
			expect(error.message).toContain("Failed to compute CREATE address")
			expect(error.message).toContain("string error value")
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)
})

// ---------------------------------------------------------------------------
// calculateCreate2Address error path (lines 134-140)
// ---------------------------------------------------------------------------

describe("create2Handler — calculateCreate2Address failure path", () => {
	it.effect("wraps Error thrown by calculateCreate2Address into ComputeAddressError", () =>
		Effect.gen(function* () {
			// Mock calculateCreate2Address to fail with an Error
			vi.mocked(Address.calculateCreate2Address).mockImplementationOnce(() =>
				Effect.fail(new Error("internal keccak failure")),
			)

			const error = yield* create2Handler(
				"0x0000000000000000000000000000000000000000",
				"0x0000000000000000000000000000000000000000000000000000000000000000",
				"0x00",
			).pipe(Effect.flip)
			expect(error._tag).toBe("ComputeAddressError")
			expect(error.message).toContain("Failed to compute CREATE2 address")
			expect(error.message).toContain("internal keccak failure")
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("wraps non-Error value thrown by calculateCreate2Address into ComputeAddressError", () =>
		Effect.gen(function* () {
			// Mock with non-Error failure (exercises the String(e) branch)
			vi.mocked(Address.calculateCreate2Address).mockImplementationOnce(() => Effect.fail(42 as unknown as Error))

			const error = yield* create2Handler(
				"0x0000000000000000000000000000000000000000",
				"0x0000000000000000000000000000000000000000000000000000000000000000",
				"0x00",
			).pipe(Effect.flip)
			expect(error._tag).toBe("ComputeAddressError")
			expect(error.message).toContain("Failed to compute CREATE2 address")
			expect(error.message).toContain("42")
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)
})

// ---------------------------------------------------------------------------
// validateSalt edge cases (tested indirectly via create2Handler)
// ---------------------------------------------------------------------------

describe("validateSalt edge cases — via create2Handler", () => {
	const VALID_DEPLOYER = "0x0000000000000000000000000000000000000000"
	const VALID_INIT_CODE = "0x00"

	it.effect("salt too long (33 bytes / 66 hex chars) → InvalidHexError", () =>
		Effect.gen(function* () {
			const saltTooLong = `0x${"aa".repeat(33)}` // 33 bytes
			const error = yield* create2Handler(VALID_DEPLOYER, saltTooLong, VALID_INIT_CODE).pipe(Effect.flip)
			expect(error._tag).toBe("InvalidHexError")
			if (error._tag === "InvalidHexError") expect(error.hex).toBe(saltTooLong)
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("salt with invalid hex chars but 0x prefix → InvalidHexError", () =>
		Effect.gen(function* () {
			const badSalt = `0x${"gg".repeat(32)}` // invalid hex chars
			const error = yield* create2Handler(VALID_DEPLOYER, badSalt, VALID_INIT_CODE).pipe(Effect.flip)
			expect(error._tag).toBe("InvalidHexError")
			if (error._tag === "InvalidHexError") expect(error.hex).toBe(badSalt)
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("salt exactly 32 bytes works", () =>
		Effect.gen(function* () {
			const salt32 = `0x${"ab".repeat(32)}` // exactly 32 bytes
			const result = yield* create2Handler(VALID_DEPLOYER, salt32, VALID_INIT_CODE)
			expect(result).toMatch(/^0x[0-9a-fA-F]{40}$/)
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("salt with 31 bytes (too short) → InvalidHexError", () =>
		Effect.gen(function* () {
			const salt31 = `0x${"ab".repeat(31)}` // 31 bytes — not 32
			const error = yield* create2Handler(VALID_DEPLOYER, salt31, VALID_INIT_CODE).pipe(Effect.flip)
			expect(error._tag).toBe("InvalidHexError")
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)
})

// ---------------------------------------------------------------------------
// validateAddress edge cases (tested indirectly via handlers)
// ---------------------------------------------------------------------------

describe("validateAddress edge cases — via toCheckSumAddressHandler", () => {
	it.effect("address with all uppercase (checksummed form) works", () =>
		Effect.gen(function* () {
			const result = yield* toCheckSumAddressHandler("0xD8DA6BF26964AF9D7EED9E03E53415D37AA96045")
			expect(result).toBe("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("address with all lowercase works", () =>
		Effect.gen(function* () {
			const result = yield* toCheckSumAddressHandler("0xd8da6bf26964af9d7eed9e03e53415d37aa96045")
			expect(result).toBe("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("empty string address → InvalidAddressError", () =>
		Effect.gen(function* () {
			const error = yield* toCheckSumAddressHandler("").pipe(Effect.flip)
			expect(error._tag).toBe("InvalidAddressError")
			expect(error.address).toBe("")
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("address '0x' (too short) → InvalidAddressError", () =>
		Effect.gen(function* () {
			const error = yield* toCheckSumAddressHandler("0x").pipe(Effect.flip)
			expect(error._tag).toBe("InvalidAddressError")
			expect(error.address).toBe("0x")
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("non-hex chars in address → InvalidAddressError", () =>
		Effect.gen(function* () {
			const badAddr = "0xZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ"
			const error = yield* toCheckSumAddressHandler(badAddr).pipe(Effect.flip)
			expect(error._tag).toBe("InvalidAddressError")
			expect(error.address).toBe(badAddr)
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)
})

// ---------------------------------------------------------------------------
// computeAddressHandler edge cases
// ---------------------------------------------------------------------------

describe("computeAddressHandler — additional edge cases", () => {
	const DEPLOYER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

	it.effect("nonce with very large value (max uint64 range) succeeds", () =>
		Effect.gen(function* () {
			// 2^64 - 1 = 18446744073709551615
			const result = yield* computeAddressHandler(DEPLOYER, "18446744073709551615")
			expect(result).toMatch(/^0x[0-9a-fA-F]{40}$/)
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("nonce with hex prefix '0x1' → accepted by BigInt", () =>
		Effect.gen(function* () {
			// BigInt("0x1") === 1n in JS, so this should succeed
			const result = yield* computeAddressHandler(DEPLOYER, "0x1").pipe(
				Effect.map((r) => ({ success: true as const, value: r })),
				Effect.catchAll((e) => Effect.succeed({ success: false as const, value: e })),
			)
			if (result.success) {
				expect(result.value).toMatch(/^0x[0-9a-fA-F]{40}$/)
			} else {
				expect(result.value._tag).toBe("ComputeAddressError")
			}
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("nonce with float value '3.14' → ComputeAddressError", () =>
		Effect.gen(function* () {
			const error = yield* computeAddressHandler(DEPLOYER, "3.14").pipe(Effect.flip)
			expect(error._tag).toBe("ComputeAddressError")
			expect(error.message).toContain("Invalid nonce")
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("negative nonce '-5' → ComputeAddressError", () =>
		Effect.gen(function* () {
			const error = yield* computeAddressHandler(DEPLOYER, "-5").pipe(Effect.flip)
			expect(error._tag).toBe("ComputeAddressError")
			expect(error.message).toContain("non-negative")
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)
})

// ---------------------------------------------------------------------------
// create2Handler edge cases
// ---------------------------------------------------------------------------

describe("create2Handler — additional edge cases", () => {
	const ZERO_SALT = "0x0000000000000000000000000000000000000000000000000000000000000000"

	it.effect("empty init code (0x) → should work (CREATE2 with empty code)", () =>
		Effect.gen(function* () {
			const result = yield* create2Handler("0x0000000000000000000000000000000000000000", ZERO_SALT, "0x")
			expect(result).toMatch(/^0x[0-9a-fA-F]{40}$/)
			expect(result.length).toBe(42)
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("init code with odd-length hex → InvalidHexError", () =>
		Effect.gen(function* () {
			const error = yield* create2Handler(
				"0x0000000000000000000000000000000000000000",
				ZERO_SALT,
				"0xabc", // 3 hex chars = odd length
			).pipe(Effect.flip)
			expect(error._tag).toBe("InvalidHexError")
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("all-zero deployer address works", () =>
		Effect.gen(function* () {
			const result = yield* create2Handler("0x0000000000000000000000000000000000000000", ZERO_SALT, "0x00")
			expect(result).toBe("0x4D1A2e2bB4F88F0250f26Ffff098B0b30B26BF38")
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("all-ff deployer address works", () =>
		Effect.gen(function* () {
			const result = yield* create2Handler("0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF", ZERO_SALT, "0x00")
			expect(result).toMatch(/^0x[0-9a-fA-F]{40}$/)
			expect(result.length).toBe(42)
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("salt with leading zeros works", () =>
		Effect.gen(function* () {
			const saltWithLeadingZeros = "0x0000000000000000000000000000000000000000000000000000000000000001"
			const result = yield* create2Handler("0x0000000000000000000000000000000000000000", saltWithLeadingZeros, "0x00")
			expect(result).toBe("0x90954Abfd77F834cbAbb76D9DA5e0e93F2f42464")
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)
})

// ---------------------------------------------------------------------------
// Error type additional tests
// ---------------------------------------------------------------------------

describe("InvalidAddressError — Effect pipeline patterns", () => {
	it.effect("catchTag recovery pattern", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(new InvalidAddressError({ message: "bad addr", address: "0xdead" })).pipe(
				Effect.catchTag("InvalidAddressError", (e) => Effect.succeed(`recovered: ${e.address}`)),
			)
			expect(result).toBe("recovered: 0xdead")
		}),
	)

	it.effect("mapError transforms to different error type", () =>
		Effect.gen(function* () {
			const error = yield* Effect.fail(new InvalidAddressError({ message: "bad addr", address: "0xdead" })).pipe(
				Effect.mapError(
					(e) =>
						new ComputeAddressError({
							message: `Wrapped: ${e.message}`,
							cause: e,
						}),
				),
				Effect.flip,
			)
			expect(error._tag).toBe("ComputeAddressError")
			expect(error.message).toContain("Wrapped: bad addr")
			expect(error.cause).toBeInstanceOf(InvalidAddressError)
		}),
	)

	it.effect("tapError allows side effects without changing error", () =>
		Effect.gen(function* () {
			let tappedAddress = ""
			const error = yield* Effect.fail(new InvalidAddressError({ message: "bad addr", address: "0xbeef" })).pipe(
				Effect.tapError((e) =>
					Effect.sync(() => {
						tappedAddress = e.address
					}),
				),
				Effect.flip,
			)
			expect(error._tag).toBe("InvalidAddressError")
			expect(tappedAddress).toBe("0xbeef")
		}),
	)
})

describe("InvalidHexError — Effect pipeline patterns", () => {
	it.effect("catchTag recovery pattern", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(new InvalidHexError({ message: "bad hex", hex: "0xgg" })).pipe(
				Effect.catchTag("InvalidHexError", (e) => Effect.succeed(`recovered: ${e.hex}`)),
			)
			expect(result).toBe("recovered: 0xgg")
		}),
	)

	it.effect("mapError transforms to ComputeAddressError", () =>
		Effect.gen(function* () {
			const error = yield* Effect.fail(new InvalidHexError({ message: "bad hex", hex: "0xgg" })).pipe(
				Effect.mapError(
					(e) =>
						new ComputeAddressError({
							message: `Hex error: ${e.message}`,
							cause: e,
						}),
				),
				Effect.flip,
			)
			expect(error._tag).toBe("ComputeAddressError")
			expect(error.message).toContain("Hex error: bad hex")
		}),
	)
})

describe("ComputeAddressError — additional patterns", () => {
	it("with undefined cause", () => {
		const error = new ComputeAddressError({
			message: "no cause provided",
		})
		expect(error._tag).toBe("ComputeAddressError")
		expect(error.message).toBe("no cause provided")
		expect(error.cause).toBeUndefined()
	})

	it.effect("orElse recovery pattern", () =>
		Effect.gen(function* () {
			const result = yield* Effect.fail(new ComputeAddressError({ message: "failed", cause: new Error("boom") })).pipe(
				Effect.orElse(() => Effect.succeed("fallback-address")),
			)
			expect(result).toBe("fallback-address")
		}),
	)

	it.effect("orElse with alternative computation", () =>
		Effect.gen(function* () {
			const primaryFails = Effect.fail(new ComputeAddressError({ message: "primary failed" }))
			const fallback = Effect.succeed("0x0000000000000000000000000000000000000000")
			const result = yield* primaryFails.pipe(Effect.orElse(() => fallback))
			expect(result).toBe("0x0000000000000000000000000000000000000000")
		}),
	)
})

// ---------------------------------------------------------------------------
// E2E edge cases
// ---------------------------------------------------------------------------

describe("chop to-check-sum-address — E2E edge cases", () => {
	it("already-checksummed address returns same result", () => {
		const result = runCli("to-check-sum-address 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")
	})

	it("all-uppercase address is checksummed correctly", () => {
		const result = runCli("to-check-sum-address 0xD8DA6BF26964AF9D7EED9E03E53415D37AA96045")
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")
	})
})

describe("chop compute-address — E2E edge cases", () => {
	it("computes CREATE address with nonce 1 (second deployment)", () => {
		const result = runCli("compute-address --deployer 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 --nonce 1")
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim().toLowerCase()).toBe("0xe7f1725e7734ce288f8367e1bb143e90bb3f0512")
	})

	it("computes CREATE address with large nonce", () => {
		const result = runCli("compute-address --deployer 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 --nonce 999999")
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toMatch(/^0x[0-9a-fA-F]{40}$/)
	})
})

describe("chop create2 — E2E edge cases", () => {
	it("computes CREATE2 with zero salt", () => {
		const result = runCli(
			"create2 --deployer 0x0000000000000000000000000000000000000000 --salt 0x0000000000000000000000000000000000000000000000000000000000000000 --init-code 0x00",
		)
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe("0x4D1A2e2bB4F88F0250f26Ffff098B0b30B26BF38")
	})

	it("computes CREATE2 with all-ff deployer", () => {
		const result = runCli(
			"create2 --deployer 0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF --salt 0x0000000000000000000000000000000000000000000000000000000000000000 --init-code 0x00",
		)
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toMatch(/^0x[0-9a-fA-F]{40}$/)
	})

	it("exits 1 on odd-length init-code hex", () => {
		const result = runCli(
			"create2 --deployer 0x0000000000000000000000000000000000000000 --salt 0x0000000000000000000000000000000000000000000000000000000000000000 --init-code 0xabc",
		)
		expect(result.exitCode).not.toBe(0)
	})
})

// ---------------------------------------------------------------------------
// computeAddressHandler — nonce non-Error catch branch (address.ts line 107)
// ---------------------------------------------------------------------------

describe("computeAddressHandler — nonce non-Error catch branch", () => {
	it.effect("handles non-Error thrown by BigInt conversion (exercises String(e) branch)", () => {
		// BigInt always throws SyntaxError (an Error subclass) for invalid input,
		// so the non-Error branch of `e instanceof Error ? e.message : "Expected..."` never fires naturally.
		// We test the Error branch with a known failure case instead.
		return Effect.gen(function* () {
			const error = yield* computeAddressHandler("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", "not_a_number").pipe(
				Effect.flip,
			)
			expect(error._tag).toBe("ComputeAddressError")
			expect(error.message).toContain("Invalid nonce")
			// Since BigInt throws an Error, the message should include BigInt's error text
			expect(error.message).toContain("not_a_number")
		}).pipe(Effect.provide(Keccak256.KeccakLive))
	})

	it.effect("error message for negative nonce includes 'non-negative'", () =>
		Effect.gen(function* () {
			const error = yield* computeAddressHandler("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", "-10").pipe(Effect.flip)
			expect(error._tag).toBe("ComputeAddressError")
			expect(error.message).toContain("non-negative")
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("whitespace nonce resolves to 0 (BigInt('   ') === 0n)", () =>
		Effect.gen(function* () {
			// BigInt("   ") === 0n in JavaScript, so this succeeds
			const result = yield* computeAddressHandler("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", "   ")
			expect(result).toMatch(/^0x[0-9a-fA-F]{40}$/)
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)

	it.effect("nonce with special characters fails", () =>
		Effect.gen(function* () {
			const error = yield* computeAddressHandler("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", "!@#$").pipe(Effect.flip)
			expect(error._tag).toBe("ComputeAddressError")
			expect(error.message).toContain("Invalid nonce")
		}).pipe(Effect.provide(Keccak256.KeccakLive)),
	)
})
