/// <reference types="vite/client" />

/**
 * Global type declarations for the EVM Debugger application.
 */

/**
 * Extended Window interface for WebUI bridge functions.
 * These functions are exposed by the native Zig WebUI backend.
 */
declare global {
	interface Window {
		/**
		 * Example hello world function for testing.
		 * @param name - Name to greet
		 * @returns A greeting message
		 */
		hello_world: (name: string) => Promise<string>

		/**
		 * Loads EVM bytecode into the debugger.
		 * @param bytecode - Hexadecimal bytecode string (with or without 0x prefix)
		 * @returns JSON response containing success or error
		 */
		load_bytecode: (bytecode: string) => Promise<string>

		/**
		 * Resets the EVM to initial state.
		 * @returns JSON string containing the initial EVM state
		 */
		reset_evm: () => Promise<string>

		/**
		 * Steps forward one EVM instruction.
		 * @returns JSON string containing the updated EVM state
		 */
		step_evm: () => Promise<string>

		/**
		 * Gets the current EVM state.
		 * @returns JSON string containing the current EVM state
		 */
		get_evm_state: () => Promise<string>

		/**
		 * Handler for run/pause button.
		 * Attached by the frontend at mount time.
		 */
		handleRunPause: () => void

		/**
		 * Handler for step button.
		 * Attached by the frontend at mount time.
		 */
		handleStep: () => void

		/**
		 * Handler for reset button.
		 * Attached by the frontend at mount time.
		 */
		handleReset: () => void

		/**
		 * Callback invoked when WebUI is ready.
		 * Set by the frontend to initialize the EVM state.
		 */
		on_web_ui_ready: () => void
	}
}

/**
 * Vite environment variables.
 * Add custom environment variable types here.
 */
interface ImportMetaEnv {
	readonly VITE_APP_TITLE?: string
	// Add more env variables as needed
}

interface ImportMeta {
	readonly env: ImportMetaEnv
}
