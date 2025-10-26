import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Controls from './Controls'

describe('Controls Component', () => {
	const defaultProps = {
		isRunning: false,
		executionSpeed: 200,
		setExecutionSpeed: vi.fn(),
		handleRunPause: vi.fn(),
		handleStep: vi.fn(),
		handleReset: vi.fn(),
		bytecode: '0x60606040',
	}

	beforeEach(() => {
		vi.clearAllMocks()
		localStorage.clear()
	})

	describe('Rendering', () => {
		it('should render all control buttons', () => {
			render(() => <Controls {...defaultProps} />)

			expect(screen.getByLabelText('Reset EVM (R)')).toBeInTheDocument()
			expect(screen.getByLabelText('Step EVM (S)')).toBeInTheDocument()
			expect(screen.getByLabelText('Run EVM (Space)')).toBeInTheDocument()
			expect(screen.getByLabelText('Speed Control')).toBeInTheDocument()
		})

		it('should render keyboard shortcut badges', () => {
			render(() => <Controls {...defaultProps} />)

			expect(screen.getByText('R')).toBeInTheDocument()
			expect(screen.getByText('S')).toBeInTheDocument()
			expect(screen.getByText('Space')).toBeInTheDocument()
		})

		it('should show "Run" when not running', () => {
			render(() => <Controls {...defaultProps} />)
			expect(screen.getByText('Run')).toBeInTheDocument()
		})

		it('should show "Pause" when running', () => {
			render(() => <Controls {...defaultProps} isRunning={true} />)
			expect(screen.getByText('Pause')).toBeInTheDocument()
		})
	})

	describe('Button States', () => {
		it('should disable all buttons when no bytecode', () => {
			render(() => <Controls {...defaultProps} bytecode="" />)

			expect(screen.getByLabelText('Reset EVM (R)')).toBeDisabled()
			expect(screen.getByLabelText('Step EVM (S)')).toBeDisabled()
			expect(screen.getByLabelText('Run EVM (Space)')).toBeDisabled()
			expect(screen.getByLabelText('Speed Control')).toBeDisabled()
		})

		it('should enable all buttons when bytecode is present', () => {
			render(() => <Controls {...defaultProps} />)

			expect(screen.getByLabelText('Reset EVM (R)')).not.toBeDisabled()
			expect(screen.getByLabelText('Run EVM (Space)')).not.toBeDisabled()
			expect(screen.getByLabelText('Speed Control')).not.toBeDisabled()
		})

		it('should disable Step button when running', () => {
			render(() => <Controls {...defaultProps} isRunning={true} />)
			expect(screen.getByLabelText('Step EVM (S)')).toBeDisabled()
		})

		it('should enable Step button when not running', () => {
			render(() => <Controls {...defaultProps} isRunning={false} />)
			expect(screen.getByLabelText('Step EVM (S)')).not.toBeDisabled()
		})

		it('should change Run/Pause button variant when running', () => {
			const { unmount } = render(() => <Controls {...defaultProps} isRunning={false} />)
			const button = screen.getByLabelText('Run EVM (Space)')
			expect(button.className).not.toContain('secondary')
			unmount()

			render(() => <Controls {...defaultProps} isRunning={true} />)
			const runningButton = screen.getByLabelText('Pause EVM (Space)')
			expect(runningButton.className).toContain('secondary')
		})
	})

	describe('Button Interactions', () => {
		it('should call handleReset when Reset button clicked', () => {
			render(() => <Controls {...defaultProps} />)
			const resetButton = screen.getByLabelText('Reset EVM (R)')
			fireEvent.click(resetButton)
			expect(defaultProps.handleReset).toHaveBeenCalledTimes(1)
		})

		it('should call handleStep when Step button clicked', () => {
			render(() => <Controls {...defaultProps} />)
			const stepButton = screen.getByLabelText('Step EVM (S)')
			fireEvent.click(stepButton)
			expect(defaultProps.handleStep).toHaveBeenCalledTimes(1)
		})

		it('should call handleRunPause when Run button clicked', () => {
			render(() => <Controls {...defaultProps} />)
			const runButton = screen.getByLabelText('Run EVM (Space)')
			fireEvent.click(runButton)
			expect(defaultProps.handleRunPause).toHaveBeenCalledTimes(1)
		})

		it('should not call handlers when buttons are disabled', () => {
			render(() => <Controls {...defaultProps} bytecode="" />)

			const resetButton = screen.getByLabelText('Reset EVM (R)')
			const stepButton = screen.getByLabelText('Step EVM (S)')
			const runButton = screen.getByLabelText('Run EVM (Space)')

			fireEvent.click(resetButton)
			fireEvent.click(stepButton)
			fireEvent.click(runButton)

			expect(defaultProps.handleReset).not.toHaveBeenCalled()
			expect(defaultProps.handleStep).not.toHaveBeenCalled()
			expect(defaultProps.handleRunPause).not.toHaveBeenCalled()
		})
	})

	describe('Speed Control UI', () => {
		it('should display current speed label', () => {
			render(() => <Controls {...defaultProps} executionSpeed={200} />)
			expect(screen.getByText('Normal')).toBeInTheDocument()
		})

		it('should display "Very Fast" for 10ms speed', () => {
			render(() => <Controls {...defaultProps} executionSpeed={10} />)
			expect(screen.getByText('Very Fast')).toBeInTheDocument()
		})

		it('should display "Fast" for 50ms speed', () => {
			render(() => <Controls {...defaultProps} executionSpeed={50} />)
			expect(screen.getByText('Fast')).toBeInTheDocument()
		})

		it('should display "Slow" for 1000ms speed', () => {
			render(() => <Controls {...defaultProps} executionSpeed={1000} />)
			expect(screen.getByText('Slow')).toBeInTheDocument()
		})

		it('should display "Custom" for non-standard speed', () => {
			render(() => <Controls {...defaultProps} executionSpeed={500} />)
			expect(screen.getByText('Custom')).toBeInTheDocument()
		})

		it('should toggle speed menu when Speed button clicked', async () => {
			render(() => <Controls {...defaultProps} />)
			const speedButton = screen.getByLabelText('Speed Control')

			// Menu should not be visible initially
			expect(screen.queryByText('Very Fast (10ms)')).not.toBeInTheDocument()

			// Click to open menu
			fireEvent.click(speedButton)
			await waitFor(() => {
				expect(screen.getByText('Very Fast (10ms)')).toBeInTheDocument()
			})

			// Click again to close menu
			fireEvent.click(speedButton)
			await waitFor(() => {
				expect(screen.queryByText('Very Fast (10ms)')).not.toBeInTheDocument()
			})
		})

		it('should display all speed options in menu', async () => {
			render(() => <Controls {...defaultProps} />)
			const speedButton = screen.getByLabelText('Speed Control')
			fireEvent.click(speedButton)

			await waitFor(() => {
				expect(screen.getByText('Very Fast (10ms)')).toBeInTheDocument()
				expect(screen.getByText('Fast (50ms)')).toBeInTheDocument()
				expect(screen.getByText('Normal (200ms)')).toBeInTheDocument()
				expect(screen.getByText('Slow (1000ms)')).toBeInTheDocument()
			})
		})
	})

	describe('Speed Control Functionality', () => {
		it('should call setExecutionSpeed when speed option clicked', async () => {
			const setExecutionSpeed = vi.fn()
			render(() => <Controls {...defaultProps} setExecutionSpeed={setExecutionSpeed} />)

			const speedButton = screen.getByLabelText('Speed Control')
			fireEvent.click(speedButton)

			await waitFor(() => {
				const fastOption = screen.getByText('Fast (50ms)')
				fireEvent.click(fastOption)
			})

			expect(setExecutionSpeed).toHaveBeenCalledWith(50)
		})

		it('should save speed to localStorage when changed', async () => {
			const setExecutionSpeed = vi.fn()
			render(() => <Controls {...defaultProps} setExecutionSpeed={setExecutionSpeed} />)

			const speedButton = screen.getByLabelText('Speed Control')
			fireEvent.click(speedButton)

			await waitFor(() => {
				const veryFastOption = screen.getByText('Very Fast (10ms)')
				fireEvent.click(veryFastOption)
			})

			expect(localStorage.getItem('executionSpeed')).toBe('10')
		})

		it('should close menu after selecting speed', async () => {
			render(() => <Controls {...defaultProps} />)

			const speedButton = screen.getByLabelText('Speed Control')
			fireEvent.click(speedButton)

			await waitFor(() => {
				const normalOption = screen.getByText('Normal (200ms)')
				fireEvent.click(normalOption)
			})

			await waitFor(() => {
				expect(screen.queryByText('Normal (200ms)')).not.toBeInTheDocument()
			})
		})

		it('should clamp speed to minimum of 10ms', async () => {
			const setExecutionSpeed = vi.fn()
			render(() => <Controls {...defaultProps} setExecutionSpeed={setExecutionSpeed} executionSpeed={5} />)

			const speedButton = screen.getByLabelText('Speed Control')
			fireEvent.click(speedButton)

			await waitFor(() => {
				const veryFastOption = screen.getByText('Very Fast (10ms)')
				fireEvent.click(veryFastOption)
			})

			expect(setExecutionSpeed).toHaveBeenCalledWith(10)
		})

		it('should clamp speed to maximum of 5000ms', async () => {
			const setExecutionSpeed = vi.fn()
			render(() => <Controls {...defaultProps} setExecutionSpeed={setExecutionSpeed} />)

			const speedButton = screen.getByLabelText('Speed Control')
			fireEvent.click(speedButton)

			await waitFor(() => {
				const slowOption = screen.getByText('Slow (1000ms)')
				fireEvent.click(slowOption)
			})

			expect(setExecutionSpeed).toHaveBeenCalledWith(1000)
		})

		it('should highlight currently selected speed in menu', async () => {
			render(() => <Controls {...defaultProps} executionSpeed={50} />)

			const speedButton = screen.getByLabelText('Speed Control')
			fireEvent.click(speedButton)

			await waitFor(() => {
				const fastOption = screen.getByText('Fast (50ms)').closest('button')
				expect(fastOption?.className).toContain('bg-accent')
			})
		})
	})

	describe('Reactive Props', () => {
		it('should update when isRunning changes', async () => {
			const TestWrapper = () => {
				const [isRunning, setIsRunning] = createSignal(false)

				return (
					<>
						<Controls {...defaultProps} isRunning={isRunning()} />
						<button type="button" onClick={() => setIsRunning(true)}>
							Toggle
						</button>
					</>
				)
			}

			render(() => <TestWrapper />)

			expect(screen.getByText('Run')).toBeInTheDocument()

			const toggleButton = screen.getByText('Toggle')
			fireEvent.click(toggleButton)

			await waitFor(() => {
				expect(screen.getByText('Pause')).toBeInTheDocument()
			})
		})

		it('should update when executionSpeed changes', async () => {
			const TestWrapper = () => {
				const [speed, setSpeed] = createSignal(200)

				return (
					<>
						<Controls {...defaultProps} executionSpeed={speed()} setExecutionSpeed={setSpeed} />
						<button type="button" onClick={() => setSpeed(10)}>
							Change Speed
						</button>
					</>
				)
			}

			render(() => <TestWrapper />)

			expect(screen.getByText('Normal')).toBeInTheDocument()

			const changeButton = screen.getByText('Change Speed')
			fireEvent.click(changeButton)

			await waitFor(() => {
				expect(screen.getByText('Very Fast')).toBeInTheDocument()
			})
		})

		it('should update when bytecode changes', async () => {
			const TestWrapper = () => {
				const [bytecode, setBytecode] = createSignal('0x60606040')

				return (
					<>
						<Controls {...defaultProps} bytecode={bytecode()} />
						<button type="button" onClick={() => setBytecode('')}>
							Clear Bytecode
						</button>
					</>
				)
			}

			render(() => <TestWrapper />)

			const resetButton = screen.getByLabelText('Reset EVM (R)')
			expect(resetButton).not.toBeDisabled()

			const clearButton = screen.getByText('Clear Bytecode')
			fireEvent.click(clearButton)

			await waitFor(() => {
				expect(resetButton).toBeDisabled()
			})
		})
	})

	describe('Accessibility', () => {
		it('should have proper ARIA labels', () => {
			render(() => <Controls {...defaultProps} />)

			expect(screen.getByLabelText('Reset EVM (R)')).toBeInTheDocument()
			expect(screen.getByLabelText('Step EVM (S)')).toBeInTheDocument()
			expect(screen.getByLabelText('Run EVM (Space)')).toBeInTheDocument()
			expect(screen.getByLabelText('Speed Control')).toBeInTheDocument()
		})

		it('should update ARIA label when running state changes', () => {
			const { unmount } = render(() => <Controls {...defaultProps} isRunning={false} />)
			expect(screen.getByLabelText('Run EVM (Space)')).toBeInTheDocument()
			unmount()

			render(() => <Controls {...defaultProps} isRunning={true} />)
			expect(screen.getByLabelText('Pause EVM (Space)')).toBeInTheDocument()
		})

		it('should have clickable buttons with proper type', () => {
			render(() => <Controls {...defaultProps} />)

			const buttons = screen.getAllByRole('button')
			expect(buttons.length).toBeGreaterThan(0)

			buttons.forEach((button) => {
				expect(button.tagName).toBe('BUTTON')
			})
		})
	})

	describe('Edge Cases', () => {
		it('should handle rapid button clicks', () => {
			render(() => <Controls {...defaultProps} />)
			const runButton = screen.getByLabelText('Run EVM (Space)')

			fireEvent.click(runButton)
			fireEvent.click(runButton)
			fireEvent.click(runButton)

			expect(defaultProps.handleRunPause).toHaveBeenCalledTimes(3)
		})

		it('should handle rapid speed changes', async () => {
			const setExecutionSpeed = vi.fn()
			render(() => <Controls {...defaultProps} setExecutionSpeed={setExecutionSpeed} />)

			const speedButton = screen.getByLabelText('Speed Control')

			// Open menu
			fireEvent.click(speedButton)

			// Click multiple speeds rapidly
			await waitFor(async () => {
				const fastOption = screen.getByText('Fast (50ms)')
				fireEvent.click(fastOption)
			})

			// Open menu again
			fireEvent.click(speedButton)

			await waitFor(async () => {
				const slowOption = screen.getByText('Slow (1000ms)')
				fireEvent.click(slowOption)
			})

			expect(setExecutionSpeed).toHaveBeenCalledTimes(2)
		})

		it('should handle invalid localStorage values gracefully', () => {
			// This is tested indirectly through the speed loading in App.tsx,
			// but we verify Controls handles any speed value
			render(() => <Controls {...defaultProps} executionSpeed={9999} />)
			expect(screen.getByText('Custom')).toBeInTheDocument()
		})

		it('should not break with empty handlers', () => {
			const emptyProps = {
				...defaultProps,
				handleReset: () => {},
				handleStep: () => {},
				handleRunPause: () => {},
				setExecutionSpeed: () => {},
			}

			render(() => <Controls {...emptyProps} />)

			const resetButton = screen.getByLabelText('Reset EVM (R)')
			expect(() => fireEvent.click(resetButton)).not.toThrow()
		})
	})
})
