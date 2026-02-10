/**
 * Cryptographic CLI commands.
 *
 * Commands:
 * - keccak: Keccak-256 hash of input data (full 32 bytes)
 * - sig: Compute 4-byte function selector from signature
 * - sig-event: Compute event topic (full keccak256) from event signature
 * - hash-message: EIP-191 signed message hash
 */

import { Args, Command } from "@effect/cli"
import { hashHex, hashString, selector, topic } from "@tevm/voltaire/Keccak256"
import { Console, Data, Effect } from "effect"
import { Hex, Keccak256 } from "voltaire-effect"
import { hashMessage, type KeccakService } from "voltaire-effect/crypto"
import { handleCommandErrors, jsonOption } from "../shared.js"

// ============================================================================
// Error Types
// ============================================================================

/** Error for cryptographic operation failures */
export class CryptoError extends Data.TaggedError("CryptoError")<{
	readonly message: string
	readonly cause?: unknown
}> {}

// ============================================================================
// Handler Logic (testable, separated from CLI wiring)
// ============================================================================

/**
 * Core keccak handler: computes keccak256 hash of input data.
 *
 * If input starts with '0x', it's treated as raw hex bytes.
 * Otherwise, it's treated as a UTF-8 string.
 */
export const keccakHandler = (data: string): Effect.Effect<string, CryptoError> =>
	Effect.try({
		try: () => {
			if (data.startsWith("0x")) {
				return Hex.fromBytes(hashHex(data))
			}
			return Hex.fromBytes(hashString(data))
		},
		catch: (e) =>
			new CryptoError({
				message: `Keccak256 hash failed: ${e instanceof Error ? e.message : String(e)}`,
				cause: e,
			}),
	})

/**
 * Core sig handler: computes 4-byte function selector from signature.
 *
 * Uses selector from @tevm/voltaire/Keccak256 for the computation.
 */
export const sigHandler = (signature: string): Effect.Effect<string, CryptoError> =>
	Effect.try({
		try: () => Hex.fromBytes(selector(signature)),
		catch: (e) =>
			new CryptoError({
				message: `Selector computation failed: ${e instanceof Error ? e.message : String(e)}`,
				cause: e,
			}),
	})

/**
 * Core sig-event handler: computes event topic (full keccak256) from event signature.
 *
 * Uses topic from @tevm/voltaire/Keccak256 for the computation.
 */
export const sigEventHandler = (signature: string): Effect.Effect<string, CryptoError> =>
	Effect.try({
		try: () => Hex.fromBytes(topic(signature)),
		catch: (e) =>
			new CryptoError({
				message: `Event topic computation failed: ${e instanceof Error ? e.message : String(e)}`,
				cause: e,
			}),
	})

/**
 * Core hash-message handler: computes EIP-191 signed message hash.
 *
 * Prefixes message with "\x19Ethereum Signed Message:\n" + length,
 * then computes keccak256 of the prefixed message.
 * Requires KeccakService.
 */
export const hashMessageHandler = (message: string): Effect.Effect<string, CryptoError, KeccakService> =>
	hashMessage(message).pipe(
		Effect.map((hash) => Hex.fromBytes(hash)),
		Effect.catchAllDefect((defect) =>
			Effect.fail(
				new CryptoError({
					message: `EIP-191 hash failed: ${defect instanceof Error ? defect.message : String(defect)}`,
					cause: defect,
				}),
			),
		),
	)

// ============================================================================
// Commands
// ============================================================================

/**
 * `chop keccak <data>`
 *
 * Compute the keccak256 hash of input data (full 32 bytes).
 * If input starts with '0x', it's treated as raw hex bytes.
 * Otherwise, it's treated as a UTF-8 string.
 */
export const keccakCommand = Command.make(
	"keccak",
	{
		data: Args.text({ name: "data" }).pipe(Args.withDescription("Data to hash (hex with 0x prefix, or UTF-8 string)")),
		json: jsonOption,
	},
	({ data, json }) =>
		Effect.gen(function* () {
			const result = yield* keccakHandler(data)
			if (json) {
				yield* Console.log(JSON.stringify({ result }))
			} else {
				yield* Console.log(result)
			}
		}).pipe(handleCommandErrors),
).pipe(Command.withDescription("Compute keccak256 hash of data"))

/**
 * `chop sig <signature>`
 *
 * Compute the 4-byte function selector from a function signature.
 */
export const sigCommand = Command.make(
	"sig",
	{
		signature: Args.text({ name: "signature" }).pipe(
			Args.withDescription("Function signature, e.g. 'transfer(address,uint256)'"),
		),
		json: jsonOption,
	},
	({ signature, json }) =>
		Effect.gen(function* () {
			const result = yield* sigHandler(signature)
			if (json) {
				yield* Console.log(JSON.stringify({ result }))
			} else {
				yield* Console.log(result)
			}
		}).pipe(handleCommandErrors),
).pipe(Command.withDescription("Compute 4-byte function selector from signature"))

/**
 * `chop sig-event <signature>`
 *
 * Compute the event topic (full keccak256 hash) from an event signature.
 */
export const sigEventCommand = Command.make(
	"sig-event",
	{
		signature: Args.text({ name: "signature" }).pipe(
			Args.withDescription("Event signature, e.g. 'Transfer(address,address,uint256)'"),
		),
		json: jsonOption,
	},
	({ signature, json }) =>
		Effect.gen(function* () {
			const result = yield* sigEventHandler(signature)
			if (json) {
				yield* Console.log(JSON.stringify({ result }))
			} else {
				yield* Console.log(result)
			}
		}).pipe(handleCommandErrors),
).pipe(Command.withDescription("Compute event topic hash from event signature"))

/**
 * `chop hash-message <message>`
 *
 * Compute EIP-191 signed message hash.
 * Prefixes with "\x19Ethereum Signed Message:\n" + length.
 */
export const hashMessageCommand = Command.make(
	"hash-message",
	{
		message: Args.text({ name: "message" }).pipe(Args.withDescription("Message to hash")),
		json: jsonOption,
	},
	({ message, json }) =>
		Effect.gen(function* () {
			const result = yield* hashMessageHandler(message)
			if (json) {
				yield* Console.log(JSON.stringify({ result }))
			} else {
				yield* Console.log(result)
			}
		}).pipe(Effect.provide(Keccak256.KeccakLive), handleCommandErrors),
).pipe(Command.withDescription("Compute EIP-191 signed message hash"))

// ============================================================================
// Exports
// ============================================================================

/** All crypto-related subcommands for registration with the root command. */
export const cryptoCommands = [keccakCommand, sigCommand, sigEventCommand, hashMessageCommand] as const
