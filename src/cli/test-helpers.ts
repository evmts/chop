/**
 * Shared test helpers for CLI E2E tests.
 *
 * Provides a `runCli` helper that executes chop commands
 * via child_process and captures stdout/stderr/exitCode.
 */

import { execSync } from "node:child_process"

/**
 * Run the chop CLI with the given arguments and capture output.
 *
 * @param args - CLI arguments string (e.g. "keccak 'hello'")
 * @returns Object with stdout, stderr, and exitCode
 */
export function runCli(args: string): {
	stdout: string
	stderr: string
	exitCode: number
} {
	try {
		const stdout = execSync(`bun run bin/chop.ts ${args}`, {
			cwd: process.cwd(),
			encoding: "utf-8",
			timeout: 15_000,
			env: { ...process.env, NO_COLOR: "1" },
			stdio: ["pipe", "pipe", "pipe"],
		})
		return { stdout, stderr: "", exitCode: 0 }
	} catch (error) {
		const e = error as {
			stdout?: string
			stderr?: string
			status?: number
		}
		return {
			stdout: (e.stdout ?? "").toString(),
			stderr: (e.stderr ?? "").toString(),
			exitCode: e.status ?? 1,
		}
	}
}
