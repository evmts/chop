import { cleanup, fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { EvmState } from '~/lib/types'

// Mock the child components to focus on App.tsx behavior
vi.mock('~/components/evm-debugger/EvmDebugger', () => ({
	default: (props: any) => (
		<div data-testid="evm-debugger">
			<button data-testid="run-pause-btn" onClick={props.handleRunPause}>
				{props.isRunning() ? 'Pause' : 'Run'}
			</button>
			<button data-testid="step-btn" onClick={props.handleStep}>
				Step
			</button>
			<button data-testid="reset-btn" onClick={props.handleReset}>
				Reset
			</button>
			<div data-testid="error-message">{props.error()}</div>
			<div data-testid="dark-mode">{props.isDarkMode() ? 'dark' : 'light'}</div>
			<div data-testid="execution-speed">{props.executionSpeed()}</div>
		</div>
	),
}))

vi.mock('~/components/ui/sonner', () => ({
	Toaster: () => <div data-testid="toaster" />,
}))

const mockEvmState: EvmState = {
	gasLeft: 1000000,
	depth: 0,
	stack: ['0x01', '0x02'],
	memory: '0x',
	storage: [],
	logs: [],
	returnData: '0x',
	completed: false,
	currentInstructionIndex: 0,
	currentBlockStartIndex: 0,
	blocks: [],
}

describe('App Component', () => {
	beforeEach(() => {
		// Reset localStorage
		localStorage.clear()

		// Setup window function mocks - return JSON strings
		window.load_bytecode = vi.fn().mockResolvedValue(JSON.stringify({ success: true }))
		window.reset_evm = vi.fn().mockResolvedValue(JSON.stringify(mockEvmState))
		window.step_evm = vi.fn().mockResolvedValue(JSON.stringify(mockEvmState))
		window.get_evm_state = vi.fn().mockResolvedValue(JSON.stringify(mockEvmState))

		// Clear existing window handlers
		delete window.handleRunPause
		delete window.handleStep
		delete window.handleReset
		delete window.on_web_ui_ready
	})

	afterEach(() => {
		cleanup()
		vi.clearAllMocks()
	})

	describe('Initialization', () => {
		it('should render without crashing', () => {
			render(() => <App />)
			expect(screen.getByTestId('evm-debugger')).toBeInTheDocument()
		})

		it('should initialize with light mode by default', () => {
			render(() => <App />)
			expect(screen.getByTestId('dark-mode')).toHaveTextContent('light')
		})

		it('should initialize with default execution speed of 200ms', () => {
			render(() => <App />)
			expect(screen.getByTestId('execution-speed')).toHaveTextContent('200')
		})

		it('should not be running initially', () => {
			render(() => <App />)
			expect(screen.getByTestId('run-pause-btn')).toHaveTextContent('Run')
		})

		it('should have no error message initially', () => {
			render(() => <App />)
			expect(screen.getByTestId('error-message')).toBeEmptyDOMElement()
		})

		it('should load execution speed from localStorage', async () => {
			localStorage.setItem('executionSpeed', '500')
			render(() => <App />)
			await waitFor(() => {
				expect(screen.getByTestId('execution-speed')).toHaveTextContent('500')
			})
		})

		it('should ignore invalid execution speed from localStorage', async () => {
			localStorage.setItem('executionSpeed', 'invalid')
			render(() => <App />)
			await waitFor(() => {
				expect(screen.getByTestId('execution-speed')).toHaveTextContent('200')
			})
		})

		it('should clamp execution speed to valid range (10-5000)', async () => {
			localStorage.setItem('executionSpeed', '10000')
			render(() => <App />)
			await waitFor(() => {
				expect(screen.getByTestId('execution-speed')).toHaveTextContent('200')
			})
		})
	})

	describe('Window Functions Setup', () => {
		it('should set up window.handleRunPause before mount', () => {
			render(() => <App />)
			expect(window.handleRunPause).toBeDefined()
			expect(typeof window.handleRunPause).toBe('function')
		})

		it('should set up window.handleStep before mount', () => {
			render(() => <App />)
			expect(window.handleStep).toBeDefined()
			expect(typeof window.handleStep).toBe('function')
		})

		it('should set up window.handleReset before mount', () => {
			render(() => <App />)
			expect(window.handleReset).toBeDefined()
			expect(typeof window.handleReset).toBe('function')
		})

		it('should set up window.on_web_ui_ready before mount', () => {
			render(() => <App />)
			expect(window.on_web_ui_ready).toBeDefined()
			expect(typeof window.on_web_ui_ready).toBe('function')
		})

		it('should handle on_web_ui_ready called before mount completes (race condition)', async () => {
			// Call before render to simulate race condition
			render(() => <App />)

			// Call immediately - should queue the callback
			await window.on_web_ui_ready()

			// Wait for mount to complete and process queue
			await waitFor(() => {
				expect(window.load_bytecode).toHaveBeenCalled()
				expect(window.reset_evm).toHaveBeenCalled()
			})
		})

		it('should handle on_web_ui_ready called after mount', async () => {
			render(() => <App />)
			await waitFor(() => {})

			await window.on_web_ui_ready()

			expect(window.load_bytecode).toHaveBeenCalled()
			expect(window.reset_evm).toHaveBeenCalled()
		})
	})

	describe('Memory Leak Prevention', () => {
		it('should clean up window functions on unmount', () => {
			const { unmount } = render(() => <App />)

			expect(window.handleRunPause).toBeDefined()
			expect(window.handleStep).toBeDefined()
			expect(window.handleReset).toBeDefined()
			expect(window.on_web_ui_ready).toBeDefined()

			unmount()

			expect(window.handleRunPause).toBeUndefined()
			expect(window.handleStep).toBeUndefined()
			expect(window.handleReset).toBeUndefined()
			expect(window.on_web_ui_ready).toBeUndefined()
		})

		it('should remove keydown event listener on unmount', () => {
			const addEventListenerSpy = vi.spyOn(window, 'addEventListener')
			const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

			const { unmount } = render(() => <App />)

			const addCalls = addEventListenerSpy.mock.calls.filter((call) => call[0] === 'keydown')
			expect(addCalls.length).toBeGreaterThan(0)

			unmount()

			const removeCalls = removeEventListenerSpy.mock.calls.filter((call) => call[0] === 'keydown')
			expect(removeCalls.length).toBe(addCalls.length)
		})
	})

	describe('Dark Mode', () => {
		it('should detect system dark mode preference', () => {
			const matchMediaMock = vi.fn().mockReturnValue({
				matches: true,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			})
			window.matchMedia = matchMediaMock

			render(() => <App />)
			expect(screen.getByTestId('dark-mode')).toHaveTextContent('dark')
		})

		it('should add dark class to documentElement when dark mode is enabled', async () => {
			const matchMediaMock = vi.fn().mockReturnValue({
				matches: true,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			})
			window.matchMedia = matchMediaMock

			render(() => <App />)

			await waitFor(() => {
				expect(document.documentElement.classList.contains('dark')).toBe(true)
			})
		})

		it('should remove dark class when dark mode is disabled', async () => {
			const matchMediaMock = vi.fn().mockReturnValue({
				matches: false,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			})
			window.matchMedia = matchMediaMock

			render(() => <App />)

			await waitFor(() => {
				expect(document.documentElement.classList.contains('dark')).toBe(false)
			})
		})
	})

	describe('Run/Pause Functionality', () => {
		it('should toggle running state when handleRunPause is called', async () => {
			render(() => <App />)
			const button = screen.getByTestId('run-pause-btn')

			expect(button).toHaveTextContent('Run')

			fireEvent.click(button)
			await waitFor(() => {
				expect(button).toHaveTextContent('Pause')
			})

			fireEvent.click(button)
			await waitFor(() => {
				expect(button).toHaveTextContent('Run')
			})
		})

		it('should call step_evm repeatedly when running', async () => {
			vi.useFakeTimers()
			render(() => <App />)

			const button = screen.getByTestId('run-pause-btn')
			fireEvent.click(button)

			// Advance timers to trigger interval
			await vi.advanceTimersByTimeAsync(200)
			expect(window.step_evm).toHaveBeenCalledTimes(1)

			await vi.advanceTimersByTimeAsync(200)
			expect(window.step_evm).toHaveBeenCalledTimes(2)

			vi.useRealTimers()
		})

		it('should stop running when EVM completes', async () => {
			const completedState = { ...mockEvmState, completed: true }
			window.step_evm = vi.fn().mockResolvedValue(JSON.stringify(completedState))

			vi.useFakeTimers()
			render(() => <App />)

			const button = screen.getByTestId('run-pause-btn')
			fireEvent.click(button)

			await vi.advanceTimersByTimeAsync(200)

			await waitFor(() => {
				expect(button).toHaveTextContent('Run')
			})

			vi.useRealTimers()
		})

		it('should stop running and set error on step failure', async () => {
			window.step_evm = vi.fn().mockRejectedValue(new Error('Step failed'))

			vi.useFakeTimers()
			render(() => <App />)

			const button = screen.getByTestId('run-pause-btn')
			fireEvent.click(button)

			await vi.advanceTimersByTimeAsync(200)

			await waitFor(() => {
				expect(button).toHaveTextContent('Run')
				expect(screen.getByTestId('error-message')).toHaveTextContent('Step failed')
			})

			vi.useRealTimers()
		})

		it('should clear interval on cleanup when running', async () => {
			vi.useFakeTimers()
			const { unmount } = render(() => <App />)

			const button = screen.getByTestId('run-pause-btn')
			fireEvent.click(button)

			await vi.advanceTimersByTimeAsync(200)
			const callCount = (window.step_evm as any).mock.calls.length

			unmount()

			await vi.advanceTimersByTimeAsync(200)
			// Should not increase after unmount
			expect((window.step_evm as any).mock.calls.length).toBe(callCount)

			vi.useRealTimers()
		})
	})

	describe('Step Functionality', () => {
		it('should call step_evm when handleStep is called', async () => {
			render(() => <App />)
			const button = screen.getByTestId('step-btn')

			await fireEvent.click(button)

			await waitFor(() => {
				expect(window.step_evm).toHaveBeenCalledTimes(1)
			})
		})

		it('should clear error before stepping', async () => {
			window.step_evm = vi
				.fn()
				.mockRejectedValueOnce(new Error('First error'))
				.mockResolvedValueOnce(JSON.stringify(mockEvmState))

			render(() => <App />)
			const button = screen.getByTestId('step-btn')

			// First step - should error
			await fireEvent.click(button)
			await waitFor(() => {
				expect(screen.getByTestId('error-message')).toHaveTextContent('First error')
			})

			// Second step - should clear error
			await fireEvent.click(button)
			await waitFor(() => {
				const errorEl = screen.getByTestId('error-message')
				expect(errorEl.textContent).toBe('')
			})
		})

		it('should set error when step fails', async () => {
			window.step_evm = vi.fn().mockRejectedValue(new Error('Step failed'))

			render(() => <App />)
			const button = screen.getByTestId('step-btn')

			await fireEvent.click(button)

			await waitFor(() => {
				expect(screen.getByTestId('error-message')).toHaveTextContent('Step failed')
			})
		})
	})

	describe('Reset Functionality', () => {
		it('should call reset_evm when handleReset is called', async () => {
			render(() => <App />)
			const button = screen.getByTestId('reset-btn')

			await fireEvent.click(button)

			await waitFor(() => {
				expect(window.reset_evm).toHaveBeenCalled()
			})
		})

		it('should stop running when reset is called', async () => {
			render(() => <App />)
			const runPauseBtn = screen.getByTestId('run-pause-btn')
			const resetBtn = screen.getByTestId('reset-btn')

			// Start running
			fireEvent.click(runPauseBtn)
			await waitFor(() => {
				expect(runPauseBtn).toHaveTextContent('Pause')
			})

			// Reset
			await fireEvent.click(resetBtn)

			await waitFor(() => {
				expect(runPauseBtn).toHaveTextContent('Run')
			})
		})

		it('should clear error before resetting', async () => {
			window.reset_evm = vi
				.fn()
				.mockRejectedValueOnce(new Error('First error'))
				.mockResolvedValueOnce(JSON.stringify(mockEvmState))

			render(() => <App />)
			const button = screen.getByTestId('reset-btn')

			// First reset - should error
			await fireEvent.click(button)
			await waitFor(() => {
				expect(screen.getByTestId('error-message')).toHaveTextContent('First error')
			})

			// Second reset - should clear error
			await fireEvent.click(button)
			await waitFor(() => {
				const errorEl = screen.getByTestId('error-message')
				expect(errorEl.textContent).toBe('')
			})
		})

		it('should set error when reset fails', async () => {
			window.reset_evm = vi.fn().mockRejectedValue(new Error('Reset failed'))

			render(() => <App />)
			const button = screen.getByTestId('reset-btn')

			await fireEvent.click(button)

			await waitFor(() => {
				expect(screen.getByTestId('error-message')).toHaveTextContent('Reset failed')
			})
		})
	})

	describe('Keyboard Shortcuts', () => {
		it('should toggle run/pause on Space key', async () => {
			render(() => <App />)
			const button = screen.getByTestId('run-pause-btn')

			expect(button).toHaveTextContent('Run')

			fireEvent.keyDown(window, { code: 'Space', key: ' ' })

			await waitFor(() => {
				expect(button).toHaveTextContent('Pause')
			})
		})

		it('should call reset on R key', async () => {
			render(() => <App />)

			fireEvent.keyDown(window, { key: 'r' })

			await waitFor(() => {
				expect(window.reset_evm).toHaveBeenCalled()
			})
		})

		it('should call reset on uppercase R key', async () => {
			render(() => <App />)

			fireEvent.keyDown(window, { key: 'R' })

			await waitFor(() => {
				expect(window.reset_evm).toHaveBeenCalled()
			})
		})

		it('should step on S key when not running', async () => {
			render(() => <App />)

			fireEvent.keyDown(window, { key: 's' })

			await waitFor(() => {
				expect(window.step_evm).toHaveBeenCalled()
			})
		})

		it('should not step on S key when running', async () => {
			vi.useFakeTimers()
			render(() => <App />)

			// Start running
			fireEvent.keyDown(window, { code: 'Space', key: ' ' })
			await waitFor(() => {
				expect(screen.getByTestId('run-pause-btn')).toHaveTextContent('Pause')
			})

			const initialCallCount = (window.step_evm as any).mock.calls.length

			// Try to step while running
			fireEvent.keyDown(window, { key: 's' })
			await vi.advanceTimersByTimeAsync(50)

			// Should not increase call count
			expect((window.step_evm as any).mock.calls.length).toBe(initialCallCount)

			vi.useRealTimers()
		})

		it('should not trigger shortcuts when typing in input field', () => {
			render(() => <App />)

			const input = document.createElement('input')
			document.body.appendChild(input)

			fireEvent.keyDown(input, { code: 'Space', key: ' ' })

			// Should not toggle run/pause
			expect(screen.getByTestId('run-pause-btn')).toHaveTextContent('Run')

			document.body.removeChild(input)
		})

		it('should not trigger shortcuts when typing in textarea', () => {
			render(() => <App />)

			const textarea = document.createElement('textarea')
			document.body.appendChild(textarea)

			fireEvent.keyDown(textarea, { code: 'Space', key: ' ' })

			// Should not toggle run/pause
			expect(screen.getByTestId('run-pause-btn')).toHaveTextContent('Run')

			document.body.removeChild(textarea)
		})
	})

	describe('Error Handling', () => {
		it('should handle error from on_web_ui_ready', async () => {
			window.load_bytecode = vi.fn().mockRejectedValue(new Error('Load failed'))

			render(() => <App />)
			await window.on_web_ui_ready()

			await waitFor(() => {
				expect(screen.getByTestId('error-message')).toHaveTextContent('Load failed')
			})
		})

		it('should handle non-Error objects in catch blocks', async () => {
			window.step_evm = vi.fn().mockRejectedValue('String error')

			render(() => <App />)
			const button = screen.getByTestId('step-btn')

			await fireEvent.click(button)

			await waitFor(() => {
				expect(screen.getByTestId('error-message')).toHaveTextContent('String error')
			})
		})
	})

	describe('Component Integration', () => {
		it('should render Toaster component', () => {
			render(() => <App />)
			expect(screen.getByTestId('toaster')).toBeInTheDocument()
		})

		it('should render EvmDebugger component', () => {
			render(() => <App />)
			expect(screen.getByTestId('evm-debugger')).toBeInTheDocument()
		})
	})
})
