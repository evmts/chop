import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
	test: {
		pool: "forks",

		include: ["src/**/*.test.ts", "test/**/*.test.ts"],

		exclude: ["test/e2e/**", "node_modules/**"],

		testTimeout: 10_000,

		coverage: {
			provider: "v8",
			include: ["src/**/*.ts"],
			exclude: ["src/**/*.test.ts", "src/**/index.ts", "src/tui/**"],
			reporter: ["text", "html", "lcov", "json-summary"],
		},

		snapshotFormat: {
			printBasicPrototype: false,
		},

		alias: {
			"#cli": resolve(__dirname, "src/cli"),
			"#tui": resolve(__dirname, "src/tui"),
			"#node": resolve(__dirname, "src/node"),
			"#evm": resolve(__dirname, "src/evm"),
			"#state": resolve(__dirname, "src/state"),
			"#blockchain": resolve(__dirname, "src/blockchain"),
			"#handlers": resolve(__dirname, "src/handlers"),
			"#mcp": resolve(__dirname, "src/mcp"),
			"#rpc": resolve(__dirname, "src/rpc"),
			"#shared": resolve(__dirname, "src/shared"),
		},
	},
})
