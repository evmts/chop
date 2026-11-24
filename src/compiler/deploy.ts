import type { CompiledContract } from "./compile.js"

export function localRpcUrl(value: string): URL {
	const url = new URL(value)
	if (
		!["http:", "https:"].includes(url.protocol) ||
		!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
		url.username ||
		url.password
	) {
		throw new Error("Deployment requires an HTTP(S) loopback RPC URL")
	}
	return url
}

async function rpc(url: URL, method: string, params: readonly unknown[] = []): Promise<unknown> {
	const response = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
		redirect: "error",
		signal: AbortSignal.timeout(5000),
	})
	if (!response.ok) throw new Error(`RPC returned HTTP ${response.status}`)
	const body = (await response.json()) as { error?: { message?: string }; result?: unknown }
	if (body.error) throw new Error(body.error.message ?? "RPC request failed")
	return body.result
}

export async function deployContract(url: URL, contract: CompiledContract, from?: string): Promise<string> {
	if (!/^0x(?:[0-9a-f]{2})+$/i.test(contract.bytecode)) {
		throw new Error("Contract has no deployable bytecode or requires linked libraries")
	}
	if (
		contract.abi.some(
			(item) =>
				typeof item === "object" &&
				item !== null &&
				"type" in item &&
				item.type === "constructor" &&
				"inputs" in item &&
				Array.isArray(item.inputs) &&
				item.inputs.length > 0,
		)
	) {
		throw new Error("Automatic deployment supports constructors without arguments")
	}
	let sender = from
	if (sender === undefined) {
		const accounts = await rpc(url, "eth_accounts")
		sender = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : undefined
	}
	if (sender === undefined || !/^0x[0-9a-f]{40}$/i.test(sender)) {
		throw new Error("Deployment requires an unlocked devnet account")
	}
	const hash = await rpc(url, "eth_sendTransaction", [{ from: sender, data: contract.bytecode }])
	if (typeof hash !== "string" || !/^0x[0-9a-f]{64}$/i.test(hash)) {
		throw new Error("RPC did not return a deployment transaction hash")
	}
	return hash
}
