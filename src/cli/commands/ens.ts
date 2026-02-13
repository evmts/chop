/**
 * ENS CLI commands — name resolution and hashing.
 *
 * Commands:
 * - namehash: Compute ENS namehash (pure keccak256 recursive, no RPC)
 * - resolve-name: Resolve ENS name to address (RPC)
 * - lookup-address: Reverse lookup address to ENS name (RPC)
 *
 * resolve-name and lookup-address require --rpc-url / -r.
 * All commands support --json / -j.
 */

import { Args, Command } from "@effect/cli"
import { FetchHttpClient, type HttpClient } from "@effect/platform"
import { hashHex, hashString } from "@tevm/voltaire/Keccak256"
import { Console, Data, Effect } from "effect"
import { Hex } from "voltaire-effect"
import { hexToBytes } from "../../evm/conversions.js"
import { type RpcClientError, rpcCall } from "../../rpc/client.js"
import { handleCommandErrors, jsonOption, rpcUrlOption } from "../shared.js"

// ============================================================================
// Error Types
// ============================================================================

/** Error for ENS-related failures. */
export class EnsError extends Data.TaggedError("EnsError")<{
	readonly message: string
	readonly cause?: unknown
}> {}

// ============================================================================
// Constants
// ============================================================================

/**
 * ENS Registry address (same on all networks).
 * @see https://docs.ens.domains/learn/deployments
 */
const ENS_REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e"

/** Function selector for `resolver(bytes32)` → returns address */
const RESOLVER_SELECTOR = "0178b8bf"

/** Function selector for `addr(bytes32)` → returns address */
const ADDR_SELECTOR = "3b3b57de"

/** Function selector for `name(bytes32)` → returns string */
const NAME_SELECTOR = "691f3431"

// ============================================================================
// Helpers
// ============================================================================

/**
 * Concatenate two Uint8Arrays.
 */
const concatBytes = (a: Uint8Array, b: Uint8Array): Uint8Array => {
	const result = new Uint8Array(a.length + b.length)
	result.set(a, 0)
	result.set(b, a.length)
	return result
}

// ============================================================================
// Handler functions (testable, separated from CLI wiring)
// ============================================================================

/**
 * Compute ENS namehash of a name (pure computation).
 *
 * Algorithm: namehash("") = bytes32(0)
 * namehash(name) = keccak256(namehash(parent) + keccak256(label))
 *
 * @see https://docs.ens.domains/resolution/names#namehash
 */
export const namehashHandler = (name: string): Effect.Effect<string, EnsError> =>
	Effect.try({
		try: () => {
			if (name === "") {
				return `0x${"00".repeat(32)}`
			}

			const labels = name.split(".")
			let node = new Uint8Array(32) // start with bytes32(0)

			// Process from right to left
			for (let i = labels.length - 1; i >= 0; i--) {
				const label = labels[i] as string
				const labelHash = new Uint8Array(hashString(label))
				node = new Uint8Array(hashHex(Hex.fromBytes(concatBytes(node, labelHash))))
			}

			return Hex.fromBytes(node)
		},
		catch: (e) =>
			new EnsError({
				message: `Namehash computation failed: ${e instanceof Error ? e.message : String(e)}`,
				cause: e,
			}),
	})

/**
 * Resolve an ENS name to an Ethereum address via RPC.
 *
 * 1. Compute namehash of the name
 * 2. Call ENS registry resolver(namehash) to get resolver address
 * 3. Call resolver addr(namehash) to get the address
 */
export const resolveNameHandler = (
	rpcUrl: string,
	name: string,
): Effect.Effect<string, RpcClientError | EnsError, HttpClient.HttpClient> =>
	Effect.gen(function* () {
		const nameHash = yield* namehashHandler(name)
		const nameHashClean = nameHash.slice(2) // remove 0x prefix

		// Call resolver(bytes32) on ENS registry
		const resolverData = `0x${RESOLVER_SELECTOR}${nameHashClean}`
		const resolverResult = yield* rpcCall(rpcUrl, "eth_call", [
			{ to: ENS_REGISTRY, data: resolverData },
			"latest",
		]).pipe(Effect.mapError((e) => new EnsError({ message: `ENS registry call failed: ${e.message}`, cause: e })))

		const resolverHex = String(resolverResult)
		// Extract address from 32-byte return (last 20 bytes of 32-byte word)
		const resolverAddr = `0x${resolverHex.slice(26)}`

		if (resolverAddr === `0x${"00".repeat(20)}`) {
			return yield* Effect.fail(new EnsError({ message: `No resolver found for name: ${name}` }))
		}

		// Call addr(bytes32) on the resolver
		const addrData = `0x${ADDR_SELECTOR}${nameHashClean}`
		const addrResult = yield* rpcCall(rpcUrl, "eth_call", [{ to: resolverAddr, data: addrData }, "latest"]).pipe(
			Effect.mapError((e) => new EnsError({ message: `ENS resolver call failed: ${e.message}`, cause: e })),
		)

		const addrHex = String(addrResult)
		const address = `0x${addrHex.slice(26)}`

		if (address === `0x${"00".repeat(20)}`) {
			return yield* Effect.fail(new EnsError({ message: `Name not resolved: ${name}` }))
		}

		return address
	})

/**
 * Reverse lookup an address to an ENS name via RPC.
 *
 * 1. Compute reverse name: <addr>.addr.reverse
 * 2. Compute namehash of the reverse name
 * 3. Call ENS registry resolver(namehash) to get resolver address
 * 4. Call resolver name(namehash) to get the name
 */
export const lookupAddressHandler = (
	rpcUrl: string,
	address: string,
): Effect.Effect<string, RpcClientError | EnsError, HttpClient.HttpClient> =>
	Effect.gen(function* () {
		// Build reverse name: remove 0x, lowercase, append .addr.reverse
		const cleanAddr = address.toLowerCase().replace("0x", "")
		const reverseName = `${cleanAddr}.addr.reverse`
		const nameHash = yield* namehashHandler(reverseName)
		const nameHashClean = nameHash.slice(2)

		// Call resolver(bytes32) on ENS registry
		const resolverData = `0x${RESOLVER_SELECTOR}${nameHashClean}`
		const resolverResult = yield* rpcCall(rpcUrl, "eth_call", [
			{ to: ENS_REGISTRY, data: resolverData },
			"latest",
		]).pipe(Effect.mapError((e) => new EnsError({ message: `ENS registry call failed: ${e.message}`, cause: e })))

		const resolverHex = String(resolverResult)
		const resolverAddr = `0x${resolverHex.slice(26)}`

		if (resolverAddr === `0x${"00".repeat(20)}`) {
			return yield* Effect.fail(new EnsError({ message: `No resolver found for address: ${address}` }))
		}

		// Call name(bytes32) on the resolver
		const nameData = `0x${NAME_SELECTOR}${nameHashClean}`
		const nameResult = yield* rpcCall(rpcUrl, "eth_call", [{ to: resolverAddr, data: nameData }, "latest"]).pipe(
			Effect.mapError((e) => new EnsError({ message: `ENS resolver call failed: ${e.message}`, cause: e })),
		)

		const nameHex = String(nameResult)
		if (nameHex === "0x" || nameHex.length <= 2) {
			return yield* Effect.fail(new EnsError({ message: `No name found for address: ${address}` }))
		}

		// Decode ABI-encoded string (offset + length + data)
		try {
			const data = hexToBytes(nameHex.slice(2))
			// Skip first 32 bytes (offset), read next 32 bytes as length
			const length = Number(BigInt(`0x${nameHex.slice(66, 130)}`))
			const nameBytes = data.slice(64, 64 + length)
			return new TextDecoder().decode(nameBytes)
		} catch {
			return yield* Effect.fail(new EnsError({ message: `Failed to decode name for address: ${address}` }))
		}
	})

// ============================================================================
// Command definitions
// ============================================================================

/**
 * `chop namehash <name>`
 *
 * Compute ENS namehash (pure computation, no RPC required).
 */
export const namehashCommand = Command.make(
	"namehash",
	{
		name: Args.text({ name: "name" }).pipe(Args.withDescription("ENS name (e.g. 'vitalik.eth')")),
		json: jsonOption,
	},
	({ name, json }) =>
		Effect.gen(function* () {
			const result = yield* namehashHandler(name)
			if (json) {
				yield* Console.log(JSON.stringify({ name, hash: result }))
			} else {
				yield* Console.log(result)
			}
		}).pipe(handleCommandErrors),
).pipe(Command.withDescription("Compute ENS namehash of a name"))

/**
 * `chop resolve-name <name> -r <url>`
 *
 * Resolve ENS name to Ethereum address.
 */
export const resolveNameCommand = Command.make(
	"resolve-name",
	{
		name: Args.text({ name: "name" }).pipe(Args.withDescription("ENS name to resolve (e.g. 'vitalik.eth')")),
		rpcUrl: rpcUrlOption,
		json: jsonOption,
	},
	({ name, rpcUrl, json }) =>
		Effect.gen(function* () {
			const result = yield* resolveNameHandler(rpcUrl, name)
			if (json) {
				yield* Console.log(JSON.stringify({ name, address: result }))
			} else {
				yield* Console.log(result)
			}
		}).pipe(Effect.provide(FetchHttpClient.layer), handleCommandErrors),
).pipe(Command.withDescription("Resolve an ENS name to an Ethereum address"))

/**
 * `chop lookup-address <addr> -r <url>`
 *
 * Reverse lookup an address to an ENS name.
 */
export const lookupAddressCommand = Command.make(
	"lookup-address",
	{
		address: Args.text({ name: "address" }).pipe(Args.withDescription("Ethereum address to look up (0x-prefixed)")),
		rpcUrl: rpcUrlOption,
		json: jsonOption,
	},
	({ address, rpcUrl, json }) =>
		Effect.gen(function* () {
			const result = yield* lookupAddressHandler(rpcUrl, address)
			if (json) {
				yield* Console.log(JSON.stringify({ address, name: result }))
			} else {
				yield* Console.log(result)
			}
		}).pipe(Effect.provide(FetchHttpClient.layer), handleCommandErrors),
).pipe(Command.withDescription("Reverse lookup an address to an ENS name"))

// ============================================================================
// Exports
// ============================================================================

/** All ENS-related subcommands for registration with the root command. */
export const ensCommands = [namehashCommand, resolveNameCommand, lookupAddressCommand] as const
