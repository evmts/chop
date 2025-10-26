import '@testing-library/jest-dom'
import { cleanup } from '@solidjs/testing-library'
import { afterEach, beforeEach } from 'vitest'

// Cleanup after each test
afterEach(() => {
	cleanup()
})

// Setup window mocks before each test
beforeEach(() => {
	// Mock window functions that are used by App.tsx
	window.hello_world = async (name: string) => `Hello, ${name}!`
	window.load_bytecode = async (_bytecode: string) => 'OK'
	window.reset_evm = async () => 'OK'
	window.step_evm = async () => 'OK'
	window.get_evm_state = async () => 'OK'

	// Reset other window properties
	delete window.handleRunPause
	delete window.handleStep
	delete window.handleReset
	delete window.on_web_ui_ready
})

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
	writable: true,
	value: (query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: () => {}, // deprecated
		removeListener: () => {}, // deprecated
		addEventListener: () => {},
		removeEventListener: () => {},
		dispatchEvent: () => true,
	}),
})
