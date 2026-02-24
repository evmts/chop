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
			exclude: ["src/**/*.test.ts", "src/**/index.ts", "src/tui/**", "src/cli/test-server.ts", "src/cli/test-helpers.ts"],
			reporter: ["text", "html", "lcov", "json-summary"],
			thresholds: {
				"src/evm/**": {
					statements: 80,
					branches: 80,
					functions: 80,
					lines: 80,
				},
				"src/state/**": {
					statements: 80,
					branches: 80,
					functions: 80,
					lines: 80,
				},
				"src/blockchain/**": {
					statements: 80,
					branches: 80,
					functions: 80,
					lines: 80,
				},
				"src/node/**": {
					statements: 80,
					branches: 80,
					functions: 80,
					lines: 80,
				},
			},
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
			"#procedures": resolve(__dirname, "src/procedures"),
			"#mcp": resolve(__dirname, "src/mcp"),
			"#rpc": resolve(__dirname, "src/rpc"),
			"#shared": resolve(__dirname, "src/shared"),
		},
	},
})
