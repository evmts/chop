// RPC module — HTTP JSON-RPC server + client for the TevmNode.

export { handleRequest } from "./handler.js"
export { startRpcServer } from "./server.js"
export type { RpcServer, RpcServerConfig } from "./server.js"

// Client — makes JSON-RPC calls to a remote node
export { RpcClientError, rpcCall } from "./client.js"
export type { JsonRpcResponseShape } from "./client.js"
