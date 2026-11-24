#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { createRuntime } from "../src/mcp/runtime.js"
import { createServer } from "../src/mcp/server.js"

const runtime = createRuntime()
const server = createServer(runtime)
const transport = new StdioServerTransport()

server.server.onclose = () => {
	void runtime.dispose().catch((error: unknown) => {
		console.error(error)
		process.exitCode = 1
	})
}

await server.connect(transport)
