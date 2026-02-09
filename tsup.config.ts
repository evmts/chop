import { defineConfig } from "tsup"

export default defineConfig({
	entry: {
		"bin/chop": "bin/chop.ts",
		"src/index": "src/index.ts",
		"src/cli/index": "src/cli/index.ts",
	},
	format: ["esm"],
	target: "node22",
	platform: "node",
	dts: true,
	sourcemap: true,
	clean: true,
	splitting: true,
	treeshake: true,
	skipNodeModulesBundle: true,
	external: ["bun:ffi", "bun:test", "@opentui/core", "@opentui/react"],
})
