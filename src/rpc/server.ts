import * as http from "node:http"
import { Effect } from "effect"
import type { TevmNodeShape } from "../node/index.js"
import { handleRequest } from "./handler.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Configuration for the RPC HTTP server. */
export interface RpcServerConfig {
	/** Port to listen on (use 0 for random available port). */
	readonly port: number
	/** Host to bind to (default: "127.0.0.1"). */
	readonly host?: string
}

/** A running RPC server instance. */
export interface RpcServer {
	/** Actual port the server is listening on. */
	readonly port: number
	/** Gracefully shut down the server. */
	readonly close: () => Effect.Effect<void>
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

/**
 * Start an HTTP JSON-RPC server.
 *
 * Uses Effect.runPromise at the HTTP boundary (application edge) to bridge
 * the Effect world with Node.js http callbacks.
 *
 * @param config - Server configuration (port, host).
 * @param node - The TevmNode facade for handling RPC requests.
 * @returns An Effect that resolves to the running server.
 */
export const startRpcServer = (config: RpcServerConfig, node: TevmNodeShape): Effect.Effect<RpcServer> =>
	Effect.async<RpcServer>((resume) => {
		const server = http.createServer((req, res) => {
			// Only accept POST requests
			if (req.method !== "POST") {
				res.writeHead(405, { "Content-Type": "application/json" })
				res.end(
					JSON.stringify({
						jsonrpc: "2.0",
						error: { code: -32600, message: "Only POST method is allowed" },
						id: null,
					}),
				)
				return
			}

			// Read request body
			let body = ""
			req.on("data", (chunk: Buffer) => {
				body += chunk.toString()
			})

			req.on("end", () => {
				// Application edge — Effect.runPromise is appropriate here
				Effect.runPromise(handleRequest(node)(body)).then(
					(result) => {
						res.writeHead(200, { "Content-Type": "application/json" })
						res.end(result)
					},
					(_error) => {
						// Should never happen — handleRequest catches all errors
						res.writeHead(500, { "Content-Type": "application/json" })
						res.end(
							JSON.stringify({
								jsonrpc: "2.0",
								error: { code: -32603, message: "Unexpected server error" },
								id: null,
							}),
						)
					},
				)
			})
		})

		const host = config.host ?? "127.0.0.1"

		server.listen(config.port, host, () => {
			const addr = server.address()
			const actualPort = typeof addr === "object" && addr !== null ? addr.port : config.port

			resume(
				Effect.succeed({
					port: actualPort,
					close: () =>
						Effect.async<void>((resumeClose) => {
							server.close(() => {
								resumeClose(Effect.succeed(undefined as void))
							})
						}),
				}),
			)
		})
	})
