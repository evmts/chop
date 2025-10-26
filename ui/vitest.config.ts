import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import solid from 'vite-plugin-solid'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
	plugins: [solid({ dev: true }), tsconfigPaths()],
	test: {
		environment: 'happy-dom',
		globals: true,
		setupFiles: ['./test/setup.ts'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html', 'lcov'],
			include: ['solid/**/*.{ts,tsx}'],
			exclude: [
				'solid/**/*.test.{ts,tsx}',
				'solid/**/*.spec.{ts,tsx}',
				'solid/**/index.tsx',
				'solid/vite-env.d.ts',
				'solid/**/*.d.ts',
			],
			thresholds: {
				lines: 80,
				functions: 80,
				branches: 80,
				statements: 80,
			},
		},
		// Allows tests to access imported types
		typecheck: {
			enabled: false,
		},
		server: {
			deps: {
				inline: [/solid-js/, /@solidjs/, /@kobalte/, /lucide-solid/, /solid-prevent-scroll/, /solid-primitives/, /@corvu/],
			},
		},
	},
	resolve: {
		conditions: ['development', 'browser'],
		alias: {
			'lucide-solid/icons': fileURLToPath(
				new URL('./node_modules/lucide-solid/dist/source/icons', import.meta.url)
			),
		},
	},
})
