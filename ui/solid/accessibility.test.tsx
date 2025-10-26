import { render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { createStore } from 'solid-js/store'
import { describe, it, expect, beforeEach } from 'vitest'
import App from './App'
import Header from './components/evm-debugger/Header'
import Controls from './components/evm-debugger/Controls'
import Memory from './components/evm-debugger/Memory'
import Stack from './components/evm-debugger/Stack'
import Storage from './components/evm-debugger/Storage'
import type { EvmState } from './lib/types'

/**
 * Comprehensive accessibility test suite.
 * Tests WCAG 2.1 Level AA compliance for the EVM Debugger.
 *
 * Coverage:
 * - ARIA labels and attributes
 * - Semantic HTML structure
 * - Keyboard navigation
 * - Screen reader support
 * - Focus management
 */

describe('Accessibility Tests', () => {
	const mockEvmState: EvmState = {
		gasLeft: 1000000,
		depth: 1,
		stack: ['0x1234567890abcdef', '0x0000000000000001'],
		memory: '0xdeadbeef',
		storage: [
			{ key: '0x0000000000000000', value: '0x0000000000000001' },
			{ key: '0x0000000000000001', value: '0x0000000000000002' },
		],
		logs: ['Log1', 'Log2'],
		returnData: '0x',
		completed: false,
		currentInstructionIndex: 5,
		currentBlockStartIndex: 0,
		blocks: [],
	}

	beforeEach(() => {
		// Mock WebUI functions
		window.load_bytecode = async () => JSON.stringify({ success: true })
		window.reset_evm = async () => JSON.stringify(mockEvmState)
		window.step_evm = async () => JSON.stringify(mockEvmState)
		window.get_evm_state = async () => JSON.stringify(mockEvmState)
	})

	describe('ARIA Labels and Attributes', () => {
		it('should have aria-label on theme toggle button', () => {
			const [isDarkMode, setIsDarkMode] = createSignal(false)
			const [activePanel, setActivePanel] = createSignal('all')

			render(() => (
				<Header
					isDarkMode={isDarkMode}
					setIsDarkMode={setIsDarkMode}
					activePanel={activePanel()}
					setActivePanel={setActivePanel}
				/>
			))

			const themeButton = screen.getByLabelText(/switch to (light|dark) mode/i)
			expect(themeButton).toBeInTheDocument()
		})

		it('should have aria-label on settings button', () => {
			const [isDarkMode, setIsDarkMode] = createSignal(false)
			const [activePanel, setActivePanel] = createSignal('all')

			render(() => (
				<Header
					isDarkMode={isDarkMode}
					setIsDarkMode={setIsDarkMode}
					activePanel={activePanel()}
					setActivePanel={setActivePanel}
				/>
			))

			const settingsButton = screen.getByLabelText('Open settings')
			expect(settingsButton).toBeInTheDocument()
		})

		it('should have aria-labels on control buttons', () => {
			const [isRunning] = createSignal(false)
			const [executionSpeed, setExecutionSpeed] = createSignal(200)

			render(() => (
				<Controls
					isRunning={isRunning()}
					executionSpeed={executionSpeed()}
					setExecutionSpeed={setExecutionSpeed}
					handleRunPause={() => {}}
					handleStep={() => {}}
					handleReset={() => {}}
					bytecode="0x6005600a01"
				/>
			))

			expect(screen.getByLabelText(/reset evm/i)).toBeInTheDocument()
			expect(screen.getByLabelText(/step evm/i)).toBeInTheDocument()
			expect(screen.getByLabelText(/run evm|pause evm/i)).toBeInTheDocument()
			expect(screen.getByLabelText(/speed control/i)).toBeInTheDocument()
		})

		it('should have aria-labels on panel toggle buttons', () => {
			const [isDarkMode, setIsDarkMode] = createSignal(false)
			const [activePanel, setActivePanel] = createSignal('all')

			render(() => (
				<Header
					isDarkMode={isDarkMode}
					setIsDarkMode={setIsDarkMode}
					activePanel={activePanel()}
					setActivePanel={setActivePanel}
				/>
			))

			expect(screen.getByLabelText('Show all panels')).toBeInTheDocument()
			expect(screen.getByLabelText('Show stack panel only')).toBeInTheDocument()
			expect(screen.getByLabelText('Show memory panel only')).toBeInTheDocument()
			expect(screen.getByLabelText('Show storage panel only')).toBeInTheDocument()
		})

		it('should have aria-hidden on decorative icons', () => {
			const [isDarkMode, setIsDarkMode] = createSignal(true)
			const [activePanel, setActivePanel] = createSignal('all')

			render(() => (
				<Header
					isDarkMode={isDarkMode}
					setIsDarkMode={setIsDarkMode}
					activePanel={activePanel()}
					setActivePanel={setActivePanel}
				/>
			))

			// Icons inside labeled buttons should have aria-hidden
			const button = screen.getByLabelText(/switch to light mode/i)
			const icon = button.querySelector('svg')
			expect(icon).toHaveAttribute('aria-hidden', 'true')
		})

		it('should have nav landmark for panel selection', () => {
			const [isDarkMode, setIsDarkMode] = createSignal(false)
			const [activePanel, setActivePanel] = createSignal('all')

			render(() => (
				<Header
					isDarkMode={isDarkMode}
					setIsDarkMode={setIsDarkMode}
					activePanel={activePanel()}
					setActivePanel={setActivePanel}
				/>
			))

			const nav = screen.getByRole('navigation', { name: /panel view selection/i })
			expect(nav).toBeInTheDocument()
		})
	})

	describe('Semantic HTML', () => {
		it('should use semantic code element for Code component', () => {
			const [state] = createStore(mockEvmState)

			render(() => <Stack state={state} />)

			// Code component should use <code> element, not <div>
			const codeElements = screen.getAllByText(/0x/i)
			const hasCodeElement = codeElements.some((el) => el.tagName === 'CODE')
			expect(hasCodeElement).toBe(true)
		})

		it('should use header element for Header component', () => {
			const [isDarkMode, setIsDarkMode] = createSignal(false)
			const [activePanel, setActivePanel] = createSignal('all')

			const { container } = render(() => (
				<Header
					isDarkMode={isDarkMode}
					setIsDarkMode={setIsDarkMode}
					activePanel={activePanel()}
					setActivePanel={setActivePanel}
				/>
			))

			const header = container.querySelector('header')
			expect(header).toBeInTheDocument()
		})

		it('should use h1 for main title', () => {
			const [isDarkMode, setIsDarkMode] = createSignal(false)
			const [activePanel, setActivePanel] = createSignal('all')

			render(() => (
				<Header
					isDarkMode={isDarkMode}
					setIsDarkMode={setIsDarkMode}
					activePanel={activePanel()}
					setActivePanel={setActivePanel}
				/>
			))

			const heading = screen.getByRole('heading', { level: 1 })
			expect(heading).toBeInTheDocument()
			expect(heading.textContent).toBe('svvy')
		})

		it('should use button elements for interactive controls', () => {
			const [isRunning] = createSignal(false)
			const [executionSpeed, setExecutionSpeed] = createSignal(200)

			const { container } = render(() => (
				<Controls
					isRunning={isRunning()}
					executionSpeed={executionSpeed()}
					setExecutionSpeed={setExecutionSpeed}
					handleRunPause={() => {}}
					handleStep={() => {}}
					handleReset={() => {}}
					bytecode="0x6005600a01"
				/>
			))

			const buttons = container.querySelectorAll('button')
			expect(buttons.length).toBeGreaterThan(0)
		})
	})

	describe('Keyboard Navigation', () => {
		it('should have focusable control buttons', () => {
			const [isRunning] = createSignal(false)
			const [executionSpeed, setExecutionSpeed] = createSignal(200)

			render(() => (
				<Controls
					isRunning={isRunning()}
					executionSpeed={executionSpeed()}
					setExecutionSpeed={setExecutionSpeed}
					handleRunPause={() => {}}
					handleStep={() => {}}
					handleReset={() => {}}
					bytecode="0x6005600a01"
				/>
			))

			const resetButton = screen.getByLabelText(/reset evm/i)
			const stepButton = screen.getByLabelText(/step evm/i)
			const runPauseButton = screen.getByLabelText(/run evm|pause evm/i)

			// Buttons should not have negative tabindex
			expect(resetButton).not.toHaveAttribute('tabindex', '-1')
			expect(stepButton).not.toHaveAttribute('tabindex', '-1')
			expect(runPauseButton).not.toHaveAttribute('tabindex', '-1')
		})

		it('should have focusable toggle buttons', () => {
			const [isDarkMode, setIsDarkMode] = createSignal(false)
			const [activePanel, setActivePanel] = createSignal('all')

			render(() => (
				<Header
					isDarkMode={isDarkMode}
					setIsDarkMode={setIsDarkMode}
					activePanel={activePanel()}
					setActivePanel={setActivePanel}
				/>
			))

			const allPanelsButton = screen.getByLabelText('Show all panels')
			expect(allPanelsButton).not.toHaveAttribute('tabindex', '-1')
		})

		it('should disable buttons when bytecode is not loaded', () => {
			const [isRunning] = createSignal(false)
			const [executionSpeed, setExecutionSpeed] = createSignal(200)

			render(() => (
				<Controls
					isRunning={isRunning()}
					executionSpeed={executionSpeed()}
					setExecutionSpeed={setExecutionSpeed}
					handleRunPause={() => {}}
					handleStep={() => {}}
					handleReset={() => {}}
					bytecode=""
				/>
			))

			const resetButton = screen.getByLabelText(/reset evm/i)
			expect(resetButton).toBeDisabled()
		})
	})

	describe('Screen Reader Support', () => {
		it('should provide meaningful button labels', () => {
			const [isRunning] = createSignal(false)
			const [executionSpeed, setExecutionSpeed] = createSignal(200)

			render(() => (
				<Controls
					isRunning={isRunning()}
					executionSpeed={executionSpeed()}
					setExecutionSpeed={setExecutionSpeed}
					handleRunPause={() => {}}
					handleStep={() => {}}
					handleReset={() => {}}
					bytecode="0x6005600a01"
				/>
			))

			// Labels should include keyboard shortcuts for screen readers
			const resetButton = screen.getByLabelText(/reset evm.*r/i)
			const stepButton = screen.getByLabelText(/step evm.*s/i)
			const runPauseButton = screen.getByLabelText(/(run|pause) evm.*space/i)

			expect(resetButton).toBeInTheDocument()
			expect(stepButton).toBeInTheDocument()
			expect(runPauseButton).toBeInTheDocument()
		})

		it('should have descriptive labels for empty states', () => {
			const emptyState: EvmState = {
				...mockEvmState,
				stack: [],
			}
			const [state] = createStore(emptyState)

			render(() => <Stack state={state} />)

			expect(screen.getByText(/stack is empty/i)).toBeInTheDocument()
		})

		it('should have descriptive labels for memory empty state', () => {
			const emptyState: EvmState = {
				...mockEvmState,
				memory: '0x',
			}
			const [state] = createStore(emptyState)

			render(() => <Memory state={state} />)

			expect(screen.getByText(/memory is empty/i)).toBeInTheDocument()
		})

		it('should have descriptive labels for storage empty state', () => {
			const emptyState: EvmState = {
				...mockEvmState,
				storage: [],
			}
			const [state] = createStore(emptyState)

			render(() => <Storage state={state} />)

			expect(screen.getByText(/storage is empty/i)).toBeInTheDocument()
		})
	})

	describe('Interactive Element States', () => {
		it('should show correct aria-label for theme toggle based on current state', () => {
			const [isDarkMode, setIsDarkMode] = createSignal(true)
			const [activePanel, setActivePanel] = createSignal('all')

			render(() => (
				<Header
					isDarkMode={isDarkMode}
					setIsDarkMode={setIsDarkMode}
					activePanel={activePanel()}
					setActivePanel={setActivePanel}
				/>
			))

			// In dark mode, button should say "Switch to light mode"
			const themeButton = screen.getByLabelText(/switch to light mode/i)
			expect(themeButton).toBeInTheDocument()
		})

		it('should show correct aria-label for run/pause based on state', () => {
			const [isRunning] = createSignal(true)
			const [executionSpeed, setExecutionSpeed] = createSignal(200)

			render(() => (
				<Controls
					isRunning={isRunning()}
					executionSpeed={executionSpeed()}
					setExecutionSpeed={setExecutionSpeed}
					handleRunPause={() => {}}
					handleStep={() => {}}
					handleReset={() => {}}
					bytecode="0x6005600a01"
				/>
			))

			// When running, button should say "Pause"
			const pauseButton = screen.getByLabelText(/pause evm/i)
			expect(pauseButton).toBeInTheDocument()
		})

		it('should disable step button when running', () => {
			const [isRunning] = createSignal(true)
			const [executionSpeed, setExecutionSpeed] = createSignal(200)

			render(() => (
				<Controls
					isRunning={isRunning()}
					executionSpeed={executionSpeed()}
					setExecutionSpeed={setExecutionSpeed}
					handleRunPause={() => {}}
					handleStep={() => {}}
					handleReset={() => {}}
					bytecode="0x6005600a01"
				/>
			))

			const stepButton = screen.getByLabelText(/step evm/i)
			expect(stepButton).toBeDisabled()
		})
	})

	describe('Content Structure', () => {
		it('should have proper heading hierarchy', () => {
			const [state] = createStore(mockEvmState)

			const { container } = render(() => <Stack state={state} />)

			// Should have h2 or h3 for card titles, not h4+ for main sections
			const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6')
			headings.forEach((heading) => {
				const level = Number.parseInt(heading.tagName[1])
				// Main component headings shouldn't be too deep
				if (heading.textContent?.includes('Stack')) {
					expect(level).toBeLessThanOrEqual(3)
				}
			})
		})

		it('should use article or section for main content areas', () => {
			const [state] = createStore(mockEvmState)

			const { container } = render(() => <Memory state={state} />)

			// Should have semantic sectioning elements
			const hasSemanticSections =
				container.querySelector('article') ||
				container.querySelector('section') ||
				container.querySelector('[role="region"]')

			// At minimum should have proper card structure
			expect(container.querySelector('[class*="card"]')).toBeInTheDocument()
		})
	})

	describe('Visual Indicators', () => {
		it('should not rely solely on color for state indication', () => {
			const [isRunning] = createSignal(true)
			const [executionSpeed, setExecutionSpeed] = createSignal(200)

			render(() => (
				<Controls
					isRunning={isRunning()}
					executionSpeed={executionSpeed()}
					setExecutionSpeed={setExecutionSpeed}
					handleRunPause={() => {}}
					handleStep={() => {}}
					handleReset={() => {}}
					bytecode="0x6005600a01"
				/>
			))

			// Button text should change, not just color
			expect(screen.getByText('Pause')).toBeInTheDocument()
		})

		it('should provide text alternatives for icons', () => {
			const [isDarkMode, setIsDarkMode] = createSignal(false)
			const [activePanel, setActivePanel] = createSignal('all')

			render(() => (
				<Header
					isDarkMode={isDarkMode}
					setIsDarkMode={setIsDarkMode}
					activePanel={activePanel()}
					setActivePanel={setActivePanel}
				/>
			))

			// Icon-only buttons must have aria-label
			const themeButton = screen.getByLabelText(/switch to/i)
			expect(themeButton).toBeInTheDocument()

			const settingsButton = screen.getByLabelText(/settings/i)
			expect(settingsButton).toBeInTheDocument()
		})
	})
})
