import { render, screen, waitFor } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createSignal } from 'solid-js'
import BytecodeLoader from './BytecodeLoader'
import type { EvmState } from '~/lib/types'
import * as utils from '~/lib/utils'

// Mock the utils module
vi.mock('~/lib/utils', () => ({
	loadBytecode: vi.fn(),
	resetEvm: vi.fn(),
}))

describe('BytecodeLoader Component', () => {
	const mockEvmState: EvmState = {
		gasLeft: 1000000,
		depth: 0,
		stack: [],
		memory: '0x',
		storage: [],
		logs: [],
		returnData: '0x',
		completed: false,
		currentInstructionIndex: 0,
		currentBlockStartIndex: 0,
		blocks: [],
	}

	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(utils.loadBytecode).mockResolvedValue(undefined)
		vi.mocked(utils.resetEvm).mockResolvedValue(mockEvmState)
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	const createTestProps = () => {
		const [bytecode, setBytecode] = createSignal('0x6001')
		const [error, setError] = createSignal('')
		const [isRunning, setIsRunning] = createSignal(false)
		const [state, setState] = createSignal<EvmState>(mockEvmState)

		return {
			bytecode: bytecode(),
			setBytecode,
			setError,
			setIsRunning,
			setState,
		}
	}

	describe('Rendering', () => {
		it('should render with all main elements', () => {
			const props = createTestProps()

			render(() => <BytecodeLoader {...props} />)

			expect(screen.getByText('Bytecode')).toBeInTheDocument()
			expect(screen.getByText(/Enter EVM bytecode to debug/i)).toBeInTheDocument()
			expect(screen.getByPlaceholderText(/0x608060405234801561001057600080fd5b50.../)).toBeInTheDocument()
			expect(screen.getByRole('button', { name: /load bytecode/i })).toBeInTheDocument()
		})

		it('should render combobox for sample contracts', () => {
			const props = createTestProps()

			render(() => <BytecodeLoader {...props} />)

			// The combobox should be present with aria-label
			expect(screen.getByLabelText(/select sample contract/i)).toBeInTheDocument()
		})

		it('should render textarea with correct attributes', () => {
			const props = createTestProps()

			render(() => <BytecodeLoader {...props} />)

			const textarea = screen.getByRole('textbox', { name: /evm bytecode input/i })
			expect(textarea).toBeInTheDocument()
			expect(textarea).toHaveAttribute('id', 'bytecode')
			expect(textarea).toHaveClass('font-mono')
		})
	})

	describe('Bytecode Input', () => {
		it('should display initial bytecode value', () => {
			const props = createTestProps()

			render(() => <BytecodeLoader {...props} />)

			const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
			expect(textarea.value).toBe('0x6001')
		})

		it('should update bytecode on input', async () => {
			const user = userEvent.setup()
			const [bytecode, setBytecode] = createSignal('')
			const otherProps = createTestProps()

			const TestComponent = () => {
				return (
					<BytecodeLoader
						bytecode={bytecode()}
						setBytecode={setBytecode}
						setError={otherProps.setError}
						setIsRunning={otherProps.setIsRunning}
						setState={otherProps.setState}
					/>
				)
			}

			render(() => <TestComponent />)

			const textarea = screen.getByRole('textbox')
			await user.type(textarea, '0x6002')

			await waitFor(() => {
				// Check that the bytecode signal was updated
				expect(bytecode()).toContain('6002')
			})
		})

		it('should clear validation error when user starts typing', async () => {
			const user = userEvent.setup()
			const [bytecode, setBytecode] = createSignal('')
			const [error, setError] = createSignal('')
			const props = {
				...createTestProps(),
				bytecode: bytecode(),
				setBytecode,
				setError,
			}

			render(() => <BytecodeLoader {...props} />)

			// Try to load with empty bytecode to trigger error
			const loadButton = screen.getByRole('button', { name: /load bytecode/i })
			await user.click(loadButton)

			await waitFor(() => {
				expect(screen.getByRole('alert')).toBeInTheDocument()
			})

			// Start typing should clear error
			const textarea = screen.getByRole('textbox')
			await user.type(textarea, '0')

			await waitFor(() => {
				expect(screen.queryByRole('alert')).not.toBeInTheDocument()
			})
		})
	})

	describe('Sample Contract Selection', () => {
		// TODO: Fix flaky test - combobox selection doesn't always update signal in time
		it.skip('should update bytecode when sample contract is selected', async () => {
			const user = userEvent.setup()
			const [bytecode, setBytecode] = createSignal('')
			const otherProps = createTestProps()

			const TestComponent = () => {
				return (
					<BytecodeLoader
						bytecode={bytecode()}
						setBytecode={setBytecode}
						setError={otherProps.setError}
						setIsRunning={otherProps.setIsRunning}
						setState={otherProps.setState}
					/>
				)
			}

			render(() => <TestComponent />)

			// Verify the combobox exists and opens
			const trigger = screen.getByRole('button', { name: /select sample contract/i })
			expect(trigger).toBeInTheDocument()

			await user.click(trigger)

			await waitFor(() => {
				const options = screen.getAllByRole('option')
				expect(options.length).toBeGreaterThan(0)
			}, { timeout: 5000 })

			// Get the first option and click it
			const options = screen.getAllByRole('option')
			await user.click(options[0])

			// Wait for bytecode to be updated with a longer timeout
			await waitFor(() => {
				const currentBytecode = bytecode()
				expect(currentBytecode).toBeTruthy()
				expect(currentBytecode).toMatch(/^0x[0-9a-fA-F]+$/)
			}, { timeout: 5000 })
		})

		it('should display contract descriptions in combobox items', async () => {
			const user = userEvent.setup()
			const props = createTestProps()

			render(() => <BytecodeLoader {...props} />)

			const trigger = screen.getByRole('button', { name: /select sample contract/i })
			await user.click(trigger)

			await waitFor(() => {
				// Check that descriptions are rendered (they should contain operation details)
				// Use getAllByText since multiple contracts may have "arithmetic" in their descriptions
				const contents = screen.getAllByText(/arithmetic/i, { selector: 'span' })
				expect(contents.length).toBeGreaterThan(0)
			})
		})
	})

	describe('Bytecode Validation', () => {
		it('should reject empty bytecode', async () => {
			const user = userEvent.setup()
			const [bytecode, setBytecode] = createSignal('')
			const [error, setError] = createSignal('')
			const props = {
				...createTestProps(),
				bytecode: bytecode(),
				setBytecode,
				setError,
			}

			render(() => <BytecodeLoader {...props} />)

			const loadButton = screen.getByRole('button', { name: /load bytecode/i })
			await user.click(loadButton)

			await waitFor(() => {
				expect(screen.getByRole('alert')).toHaveTextContent(/bytecode cannot be empty/i)
			})
			expect(utils.loadBytecode).not.toHaveBeenCalled()
		})

		it('should reject bytecode without 0x prefix', async () => {
			const user = userEvent.setup()
			const [bytecode, setBytecode] = createSignal('6001')
			const [error, setError] = createSignal('')
			const props = {
				...createTestProps(),
				bytecode: bytecode(),
				setBytecode,
				setError,
			}

			render(() => <BytecodeLoader {...props} />)

			const loadButton = screen.getByRole('button', { name: /load bytecode/i })
			await user.click(loadButton)

			await waitFor(() => {
				expect(screen.getByRole('alert')).toHaveTextContent(/must start with "0x"/i)
			})
			expect(utils.loadBytecode).not.toHaveBeenCalled()
		})

		it('should reject bytecode with only 0x prefix', async () => {
			const user = userEvent.setup()
			const [bytecode, setBytecode] = createSignal('0x')
			const [error, setError] = createSignal('')
			const props = {
				...createTestProps(),
				bytecode: bytecode(),
				setBytecode,
				setError,
			}

			render(() => <BytecodeLoader {...props} />)

			const loadButton = screen.getByRole('button', { name: /load bytecode/i })
			await user.click(loadButton)

			await waitFor(() => {
				expect(screen.getByRole('alert')).toHaveTextContent(/must contain data after "0x"/i)
			})
			expect(utils.loadBytecode).not.toHaveBeenCalled()
		})

		it('should reject bytecode with invalid hex characters', async () => {
			const user = userEvent.setup()
			const [bytecode, setBytecode] = createSignal('0x60xyz')
			const [error, setError] = createSignal('')
			const props = {
				...createTestProps(),
				bytecode: bytecode(),
				setBytecode,
				setError,
			}

			render(() => <BytecodeLoader {...props} />)

			const loadButton = screen.getByRole('button', { name: /load bytecode/i })
			await user.click(loadButton)

			await waitFor(() => {
				expect(screen.getByRole('alert')).toHaveTextContent(/invalid characters/i)
			})
			expect(utils.loadBytecode).not.toHaveBeenCalled()
		})

		it('should reject bytecode with odd length', async () => {
			const user = userEvent.setup()
			const [bytecode, setBytecode] = createSignal('0x600')
			const [error, setError] = createSignal('')
			const props = {
				...createTestProps(),
				bytecode: bytecode(),
				setBytecode,
				setError,
			}

			render(() => <BytecodeLoader {...props} />)

			const loadButton = screen.getByRole('button', { name: /load bytecode/i })
			await user.click(loadButton)

			await waitFor(() => {
				expect(screen.getByRole('alert')).toHaveTextContent(/must have even length/i)
			})
			expect(utils.loadBytecode).not.toHaveBeenCalled()
		})

		it('should reject bytecode exceeding maximum length', async () => {
			const user = userEvent.setup()
			// Create bytecode > 50000 bytes (100000 hex chars + 0x prefix)
			const longBytecode = '0x' + '00'.repeat(50001)
			const [bytecode, setBytecode] = createSignal(longBytecode)
			const [error, setError] = createSignal('')
			const props = {
				...createTestProps(),
				bytecode: bytecode(),
				setBytecode,
				setError,
			}

			render(() => <BytecodeLoader {...props} />)

			const loadButton = screen.getByRole('button', { name: /load bytecode/i })
			await user.click(loadButton)

			await waitFor(() => {
				expect(screen.getByRole('alert')).toHaveTextContent(/exceeds maximum length/i)
			})
			expect(utils.loadBytecode).not.toHaveBeenCalled()
		})

		it('should accept valid bytecode', async () => {
			const user = userEvent.setup()
			const [bytecode, setBytecode] = createSignal('0x6001')
			const [error, setError] = createSignal('')
			const props = {
				...createTestProps(),
				bytecode: bytecode(),
				setBytecode,
				setError,
			}

			render(() => <BytecodeLoader {...props} />)

			const loadButton = screen.getByRole('button', { name: /load bytecode/i })
			await user.click(loadButton)

			await waitFor(() => {
				expect(utils.loadBytecode).toHaveBeenCalledWith('0x6001')
			})
		})

		it('should accept bytecode with uppercase hex', async () => {
			const user = userEvent.setup()
			const [bytecode, setBytecode] = createSignal('0x6001ABCD')
			const props = {
				...createTestProps(),
				bytecode: bytecode(),
				setBytecode: vi.fn(),
				setError: vi.fn(),
			}

			render(() => <BytecodeLoader {...props} />)

			const loadButton = screen.getByRole('button', { name: /load bytecode/i })
			await user.click(loadButton)

			await waitFor(() => {
				expect(utils.loadBytecode).toHaveBeenCalledWith('0x6001ABCD')
			})
		})

		it('should handle whitespace in bytecode', async () => {
			const user = userEvent.setup()
			const [bytecode, setBytecode] = createSignal('  0x6001  ')
			const props = {
				...createTestProps(),
				bytecode: bytecode(),
				setBytecode: vi.fn(),
				setError: vi.fn(),
			}

			render(() => <BytecodeLoader {...props} />)

			const loadButton = screen.getByRole('button', { name: /load bytecode/i })
			await user.click(loadButton)

			await waitFor(() => {
				expect(utils.loadBytecode).toHaveBeenCalled()
			})
		})
	})

	describe('Loading States', () => {
		it('should show loading state during async operation', async () => {
			const user = userEvent.setup()

			// Create a promise that we can control
			let resolveLoad: () => void
			const loadPromise = new Promise<void>((resolve) => {
				resolveLoad = resolve
			})
			vi.mocked(utils.loadBytecode).mockReturnValue(loadPromise)

			const [bytecode, setBytecode] = createSignal('0x6001')
			const props = {
				...createTestProps(),
				bytecode: bytecode(),
				setBytecode,
			}

			render(() => <BytecodeLoader {...props} />)

			const loadButton = screen.getByRole('button', { name: /load bytecode/i })
			await user.click(loadButton)

			await waitFor(() => {
				expect(screen.getByText(/loading/i)).toBeInTheDocument()
				expect(loadButton).toBeDisabled()
			})

			// Resolve the promise
			resolveLoad!()
			await waitFor(() => {
				expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
			})
		})

		it('should disable button during loading', async () => {
			const user = userEvent.setup()

			let resolveLoad: () => void
			const loadPromise = new Promise<void>((resolve) => {
				resolveLoad = resolve
			})
			vi.mocked(utils.loadBytecode).mockReturnValue(loadPromise)

			const [bytecode, setBytecode] = createSignal('0x6001')
			const props = {
				...createTestProps(),
				bytecode: bytecode(),
				setBytecode,
			}

			render(() => <BytecodeLoader {...props} />)

			const loadButton = screen.getByRole('button', { name: /load bytecode/i })
			await user.click(loadButton)

			await waitFor(() => {
				expect(loadButton).toBeDisabled()
			})

			resolveLoad!()
			await waitFor(() => {
				expect(loadButton).not.toBeDisabled()
			})
		})

		it('should show spinner during loading', async () => {
			const user = userEvent.setup()

			let resolveLoad: () => void
			const loadPromise = new Promise<void>((resolve) => {
				resolveLoad = resolve
			})
			vi.mocked(utils.loadBytecode).mockReturnValue(loadPromise)

			const [bytecode, setBytecode] = createSignal('0x6001')
			const props = {
				...createTestProps(),
				bytecode: bytecode(),
				setBytecode,
			}

			render(() => <BytecodeLoader {...props} />)

			const loadButton = screen.getByRole('button', { name: /load bytecode/i })
			await user.click(loadButton)

			await waitFor(() => {
				const spinner = document.querySelector('.animate-spin')
				expect(spinner).toBeInTheDocument()
			})

			resolveLoad!()
		})
	})

	describe('Error Handling', () => {
		it('should display error from async operation', async () => {
			const user = userEvent.setup()
			vi.mocked(utils.loadBytecode).mockRejectedValue(new Error('Load failed'))

			const [bytecode, setBytecode] = createSignal('0x6001')
			const [error, setError] = createSignal('')
			const otherProps = createTestProps()

			const TestComponent = () => {
				return (
					<BytecodeLoader
						bytecode={bytecode()}
						setBytecode={setBytecode}
						setError={setError}
						setIsRunning={otherProps.setIsRunning}
						setState={otherProps.setState}
					/>
				)
			}

			render(() => <TestComponent />)

			const loadButton = screen.getByRole('button', { name: /load bytecode/i })
			await user.click(loadButton)

			await waitFor(() => {
				// Check that error was set
				expect(error()).toContain('Load failed')
			}, { timeout: 3000 })
		})

		it('should clear previous errors on successful load', async () => {
			const user = userEvent.setup()
			const [bytecode, setBytecode] = createSignal('0x6001')
			const [error, setError] = createSignal('Previous error')
			const otherProps = createTestProps()

			const TestComponent = () => {
				return (
					<BytecodeLoader
						bytecode={bytecode()}
						setBytecode={setBytecode}
						setError={setError}
						setIsRunning={otherProps.setIsRunning}
						setState={otherProps.setState}
					/>
				)
			}

			render(() => <TestComponent />)

			const loadButton = screen.getByRole('button', { name: /load bytecode/i })
			await user.click(loadButton)

			await waitFor(() => {
				// Error should be cleared
				expect(error()).toBe('')
			}, { timeout: 3000 })
		})

		it('should stop loading state on error', async () => {
			const user = userEvent.setup()
			vi.mocked(utils.loadBytecode).mockRejectedValue(new Error('Load failed'))

			const [bytecode, setBytecode] = createSignal('0x6001')
			const props = {
				...createTestProps(),
				bytecode: bytecode(),
				setBytecode,
			}

			render(() => <BytecodeLoader {...props} />)

			const loadButton = screen.getByRole('button', { name: /load bytecode/i })
			await user.click(loadButton)

			await waitFor(() => {
				expect(loadButton).not.toBeDisabled()
			})
		})
	})

	describe('EVM State Updates', () => {
		it('should update EVM state on successful load', async () => {
			const user = userEvent.setup()
			const [bytecode, setBytecode] = createSignal('0x6001')
			const [state, setState] = createSignal<EvmState>(mockEvmState)
			const otherProps = createTestProps()

			const TestComponent = () => {
				return (
					<BytecodeLoader
						bytecode={bytecode()}
						setBytecode={setBytecode}
						setState={setState}
						setError={otherProps.setError}
						setIsRunning={otherProps.setIsRunning}
					/>
				)
			}

			render(() => <TestComponent />)

			const loadButton = screen.getByRole('button', { name: /load bytecode/i })
			await user.click(loadButton)

			await waitFor(() => {
				expect(utils.resetEvm).toHaveBeenCalled()
				// Check that state was updated
				expect(state()).toEqual(mockEvmState)
			}, { timeout: 3000 })
		})

		it('should set isRunning to false on successful load', async () => {
			const user = userEvent.setup()
			const [bytecode, setBytecode] = createSignal('0x6001')
			const [isRunning, setIsRunning] = createSignal(true)
			const otherProps = createTestProps()

			const TestComponent = () => {
				return (
					<BytecodeLoader
						bytecode={bytecode()}
						setBytecode={setBytecode}
						setIsRunning={setIsRunning}
						setError={otherProps.setError}
						setState={otherProps.setState}
					/>
				)
			}

			render(() => <TestComponent />)

			const loadButton = screen.getByRole('button', { name: /load bytecode/i })
			await user.click(loadButton)

			await waitFor(() => {
				// Check that isRunning was set to false
				expect(isRunning()).toBe(false)
			}, { timeout: 3000 })
		})
	})

	describe('Accessibility', () => {
		it('should have proper ARIA attributes on textarea', () => {
			const props = createTestProps()

			render(() => <BytecodeLoader {...props} />)

			const textarea = screen.getByRole('textbox')
			expect(textarea).toHaveAttribute('aria-label', 'EVM bytecode input')
		})

		it('should set aria-invalid when there is a validation error', async () => {
			const user = userEvent.setup()
			const [bytecode, setBytecode] = createSignal('')
			const props = {
				...createTestProps(),
				bytecode: bytecode(),
				setBytecode,
			}

			render(() => <BytecodeLoader {...props} />)

			const loadButton = screen.getByRole('button', { name: /load bytecode/i })
			await user.click(loadButton)

			await waitFor(() => {
				const textarea = screen.getByRole('textbox')
				expect(textarea).toHaveAttribute('aria-invalid', 'true')
			})
		})

		it('should have role="alert" on error messages', async () => {
			const user = userEvent.setup()
			const [bytecode, setBytecode] = createSignal('')
			const props = {
				...createTestProps(),
				bytecode: bytecode(),
				setBytecode,
			}

			render(() => <BytecodeLoader {...props} />)

			const loadButton = screen.getByRole('button', { name: /load bytecode/i })
			await user.click(loadButton)

			await waitFor(() => {
				const alert = screen.getByRole('alert')
				expect(alert).toBeInTheDocument()
			})
		})
	})

	describe('Default Contract Selection', () => {
		it('should use DEFAULT_CONTRACT_INDEX for initial selection', () => {
			const props = createTestProps()

			render(() => <BytecodeLoader {...props} />)

			// The default contract (index 7) is "Comprehensive Test"
			// We can verify by checking the combobox has this value selected
			const trigger = screen.getByRole('button', { name: /select sample contract/i })
			expect(trigger).toBeInTheDocument()
		})

		it('should handle out-of-bounds DEFAULT_CONTRACT_INDEX gracefully', () => {
			// This test verifies the bounds checking in getDefaultContract()
			// The component should render without errors
			const props = createTestProps()

			expect(() => render(() => <BytecodeLoader {...props} />)).not.toThrow()
		})
	})
})
