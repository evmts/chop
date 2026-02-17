/**
 * Shared test helpers for CLI E2E tests.
 *
 * Provides a `runCli` helper that executes chop commands
 * via child_process and captures stdout/stderr/exitCode,
 * plus `startTestServer` to launch a background RPC server
 * for true end-to-end CLI testing.
 */

import { type ChildProcess, execSync, spawn } from "node:child_process"

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

// ============================================================================
// Background RPC Server for E2E Tests
// ============================================================================

/** Handle to a background test RPC server. */
export interface TestServer {
	/** Port the server is listening on. */
	readonly port: number
	/** Kill the server process. */
	readonly kill: () => void
}

/**
 * Start a background RPC server for E2E testing.
 *
 * Spawns `src/cli/test-server.ts` in a child process. The server
 * pre-deploys a contract at `0x00...42` that returns `0x42` when called.
 * Resolves once the server prints its port.
 *
 * The caller MUST call `server.kill()` in `afterAll()` to clean up.
 */
export function startTestServer(): Promise<TestServer> {
	const timeout = Number(process.env.TEST_SERVER_TIMEOUT ?? 30_000)

	return new Promise((resolve, reject) => {
		const proc: ChildProcess = spawn("bun", ["run", "src/cli/test-server.ts"], {
			cwd: process.cwd(),
			stdio: ["pipe", "pipe", "pipe"],
			env: { ...process.env, NO_COLOR: "1" },
		})

		let started = false

		proc.stdout?.on("data", (data: Buffer) => {
			const match = data.toString().match(/PORT:(\d+)/)
			if (match && !started) {
				started = true
				resolve({
					port: Number(match[1]),
					kill: () => proc.kill(),
				})
			}
		})

		proc.stderr?.on("data", (_data: Buffer) => {
			// Ignore stderr noise during startup
		})

		proc.on("exit", (code) => {
			if (!started) {
				reject(new Error(`Test server exited with code ${code} before starting`))
			}
		})

		setTimeout(() => {
			if (!started) {
				proc.kill()
				reject(new Error(`Test server start timeout (${timeout}ms)`))
			}
		}, timeout)
	})
}
