/**
 * Address utility CLI commands.
 *
 * Commands:
 * - to-check-sum-address: Convert address to EIP-55 checksummed form
 * - compute-address: Compute CREATE address from deployer + nonce
 * - create2: Compute CREATE2 address from deployer + salt + init-code
 */

import { Args, Command, Options } from "@effect/cli"
import { Console, Data, Effect } from "effect"
import { Address, Hash, Keccak256 } from "voltaire-effect"
import { handleCommandErrors, jsonOption, validateHexData } from "../shared.js"

// ============================================================================
// Error Types
// ============================================================================

/** Error for invalid Ethereum addresses */
export class InvalidAddressError extends Data.TaggedError("InvalidAddressError")<{
	readonly message: string
	readonly address: string
}> {}

/** Error for invalid hex data (salt, init-code) */
export class InvalidHexError extends Data.TaggedError("InvalidHexError")<{
	readonly message: string
	readonly hex: string
}> {}

/** Error for address computation failures */
export class ComputeAddressError extends Data.TaggedError("ComputeAddressError")<{
	readonly message: string
	readonly cause?: unknown
}> {}

// ============================================================================
// Validation Helpers
// ============================================================================

/** Validate and parse an address from a hex string */
const validateAddress = (raw: string) =>
	Address.fromHex(raw).pipe(
		Effect.catchAll(() =>
			Effect.fail(
				new InvalidAddressError({
					message: `Invalid address: "${raw}". Expected a 40-character hex string with 0x prefix.`,
					address: raw,
				}),
			),
		),
	)

/** Validate hex data and convert to Uint8Array */
const validateHexDataAsInvalidHex = (raw: string): Effect.Effect<Uint8Array, InvalidHexError> =>
	validateHexData(raw, (message, hex) => new InvalidHexError({ message, hex }))

/** Validate a 32-byte salt from hex string */
const validateSalt = (raw: string) =>
	Effect.gen(function* () {
		if (!raw.startsWith("0x")) {
			return yield* Effect.fail(
				new InvalidHexError({
					message: `Invalid salt: "${raw}". Expected a 32-byte (64-character) hex string with 0x prefix.`,
					hex: raw,
				}),
			)
		}
		return yield* Hash.fromHex(raw).pipe(
			Effect.catchAll(() =>
				Effect.fail(
					new InvalidHexError({
						message: `Invalid salt: "${raw}". Expected a 32-byte (64-character) hex string with 0x prefix.`,
						hex: raw,
					}),
				),
			),
		)
	})

// ============================================================================
// Handler Logic (testable, separated from CLI wiring)
// ============================================================================

/** Core to-check-sum-address logic: validates and checksums an address. */
export const toCheckSumAddressHandler = (rawAddr: string) =>
	Effect.gen(function* () {
		const addr = yield* validateAddress(rawAddr)
		return yield* Address.toChecksummed(addr)
	})

/** Core compute-address logic: computes CREATE address from deployer + nonce. */
export const computeAddressHandler = (rawDeployer: string, rawNonce: string) =>
	Effect.gen(function* () {
		const deployer = yield* validateAddress(rawDeployer)

		const nonce = yield* Effect.try({
			try: () => {
				const n = BigInt(rawNonce)
				if (n < 0n) {
					throw new Error("Nonce must be non-negative")
				}
				return n
			},
			catch: (e) =>
				new ComputeAddressError({
					message: `Invalid nonce: "${rawNonce}". ${e instanceof Error ? e.message : "Expected a non-negative integer."}`,
					cause: e,
				}),
		})

		const contractAddr = yield* Address.calculateCreateAddress(deployer, nonce).pipe(
			Effect.catchAll((e) =>
				Effect.fail(
					new ComputeAddressError({
						message: `Failed to compute CREATE address: ${e instanceof Error ? e.message : String(e)}`,
						cause: e,
					}),
				),
			),
		)

		return yield* Address.toChecksummed(contractAddr)
	})

/** Core create2 logic: computes CREATE2 address from deployer + salt + init-code. */
export const create2Handler = (rawDeployer: string, rawSalt: string, rawInitCode: string) =>
	Effect.gen(function* () {
		const deployer = yield* validateAddress(rawDeployer)
		const salt = yield* validateSalt(rawSalt)
		const initCode = yield* validateHexDataAsInvalidHex(rawInitCode)

		const contractAddr = yield* Address.calculateCreate2Address(deployer, salt, initCode).pipe(
			Effect.catchAll((e) =>
				Effect.fail(
					new ComputeAddressError({
						message: `Failed to compute CREATE2 address: ${e instanceof Error ? e.message : String(e)}`,
						cause: e,
					}),
				),
			),
		)

		return yield* Address.toChecksummed(contractAddr)
	})

// ============================================================================
// Commands
// ============================================================================

/**
 * `chop to-check-sum-address <addr>`
 *
 * Convert an Ethereum address to its EIP-55 checksummed form.
 */
export const toCheckSumAddressCommand = Command.make(
	"to-check-sum-address",
	{
		addr: Args.text({ name: "addr" }).pipe(Args.withDescription("Ethereum address to checksum")),
		json: jsonOption,
	},
	({ addr, json }) =>
		Effect.gen(function* () {
			const result = yield* toCheckSumAddressHandler(addr)
			if (json) {
				yield* Console.log(JSON.stringify({ result }))
			} else {
				yield* Console.log(result)
			}
		}).pipe(Effect.provide(Keccak256.KeccakLive), handleCommandErrors),
).pipe(Command.withDescription("Convert address to EIP-55 checksummed form"))

/**
 * `chop compute-address --deployer <addr> --nonce <n>`
 *
 * Compute the contract address that would be deployed via CREATE.
 */
export const computeAddressCommand = Command.make(
	"compute-address",
	{
		deployer: Options.text("deployer").pipe(Options.withDescription("Deployer address")),
		nonce: Options.text("nonce").pipe(Options.withDescription("Transaction nonce")),
		json: jsonOption,
	},
	({ deployer, nonce, json }) =>
		Effect.gen(function* () {
			const result = yield* computeAddressHandler(deployer, nonce)
			if (json) {
				yield* Console.log(JSON.stringify({ result }))
			} else {
				yield* Console.log(result)
			}
		}).pipe(Effect.provide(Keccak256.KeccakLive), handleCommandErrors),
).pipe(Command.withDescription("Compute CREATE contract address from deployer + nonce"))

/**
 * `chop create2 --deployer <addr> --salt <hex> --init-code <hex>`
 *
 * Compute the contract address that would be deployed via CREATE2.
 */
export const create2Command = Command.make(
	"create2",
	{
		deployer: Options.text("deployer").pipe(Options.withDescription("Deployer/factory address")),
		salt: Options.text("salt").pipe(Options.withDescription("32-byte salt as hex")),
		initCode: Options.text("init-code").pipe(Options.withDescription("Contract init code as hex")),
		json: jsonOption,
	},
	({ deployer, salt, initCode, json }) =>
		Effect.gen(function* () {
			const result = yield* create2Handler(deployer, salt, initCode)
			if (json) {
				yield* Console.log(JSON.stringify({ result }))
			} else {
				yield* Console.log(result)
			}
		}).pipe(Effect.provide(Keccak256.KeccakLive), handleCommandErrors),
).pipe(Command.withDescription("Compute CREATE2 contract address"))

// ============================================================================
// Exports
// ============================================================================

/** All address-related subcommands for registration with the root command. */
export const addressCommands = [toCheckSumAddressCommand, computeAddressCommand, create2Command] as const
