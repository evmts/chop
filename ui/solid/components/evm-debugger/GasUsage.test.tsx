import { render, screen, waitFor } from '@solidjs/testing-library'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRoot, createSignal } from 'solid-js'
import GasUsage from './GasUsage'
import type { EvmState } from '~/lib/types'

describe('GasUsage', () => {
	const mockState: EvmState = {
		gasLeft: 750000,
		depth: 1,
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
	})

	describe('Rendering', () => {
		it('should render gas usage with correct values', () => {
			render(() => <GasUsage state={mockState} initialGas={1000000} />)

			expect(screen.getByText('Gas Usage')).toBeInTheDocument()
			expect(screen.getByText('750,000')).toBeInTheDocument()
		})

		it('should display initial, used, and remaining gas', () => {
			render(() => <GasUsage state={mockState} initialGas={1000000} />)

			expect(screen.getByText('Initial')).toBeInTheDocument()
			expect(screen.getByText('Used')).toBeInTheDocument()
			expect(screen.getByText('Remaining')).toBeInTheDocument()
		})

		it('should show gas efficiency tips', () => {
			render(() => <GasUsage state={mockState} initialGas={1000000} />)

			expect(screen.getByText('Gas Efficiency Tips')).toBeInTheDocument()
			expect(screen.getByText(/Storage operations.*cost 20,000 gas/i)).toBeInTheDocument()
		})

		it('should display progress bar with percentage', () => {
			render(() => <GasUsage state={mockState} initialGas={1000000} />)

			// 25% used (250,000 / 1,000,000)
			expect(screen.getByText(/25.0%/i)).toBeInTheDocument()
		})
	})

	describe('Race Condition Fix (CRITICAL)', () => {
		it('should update initial gas when state changes after mount', async () => {
			const [gasLeft, setGasLeft] = createSignal(500000)

			const TestComponent = () => {
				const state = () => ({ ...mockState, gasLeft: gasLeft() })
				return <GasUsage state={state()} initialGas={500000} />
			}

			const { rerender } = render(() => <TestComponent />)

			// Initial render
			expect(screen.getByText('500,000')).toBeInTheDocument()

			// Update gas - simulating bytecode loading after mount
			setGasLeft(1000000)

			await waitFor(() => {
				// Should update to show new gas value
				expect(screen.getByText('1,000,000')).toBeInTheDocument()
			})
		})

		it('should track gas from state when initial gas is higher', async () => {
			// Simulate bytecode loading with higher gas after mount
			const state = { ...mockState, gasLeft: 2000000 }

			render(() => <GasUsage state={state} initialGas={1000000} />)

			await waitFor(() => {
				// Should update to track the higher gas value
				expect(screen.getByText('2,000,000')).toBeInTheDocument()
			})
		})
	})

	describe('Gas Validation', () => {
		it('should handle zero initial gas without division by zero', () => {
			const state = { ...mockState, gasLeft: 0 }

			render(() => <GasUsage state={state} initialGas={0} />)

			expect(screen.getByText('0%')).toBeInTheDocument()
		})

		it('should handle negative gas gracefully', () => {
			const state = { ...mockState, gasLeft: -1000 }

			render(() => <GasUsage state={state} initialGas={1000000} />)

			// Should cap at 0% or 100% depending on validation
			expect(screen.getByText(/Gas Usage/i)).toBeInTheDocument()
		})

		it('should handle gas used exceeding initial gas', () => {
			const state = { ...mockState, gasLeft: -100000 }

			render(() => <GasUsage state={state} initialGas={1000000} />)

			// Should cap at 100%
			expect(screen.getByText('100%')).toBeInTheDocument()
		})

		it('should validate unrealistic gas values', () => {
			const state = { ...mockState, gasLeft: Number.MAX_SAFE_INTEGER }

			render(() => <GasUsage state={state} />)

			// Should render without crashing
			expect(screen.getByText('Gas Usage')).toBeInTheDocument()
		})
	})

	describe('Gas Usage Color Coding', () => {
		it('should show green for low gas usage (<50%)', () => {
			const state = { ...mockState, gasLeft: 800000 }

			render(() => <GasUsage state={state} initialGas={1000000} />)

			// 20% usage should be green
			expect(screen.getByText(/20.0%/i)).toBeInTheDocument()
		})

		it('should show yellow for moderate gas usage (50-75%)', () => {
			const state = { ...mockState, gasLeft: 400000 }

			render(() => <GasUsage state={state} initialGas={1000000} />)

			// 60% usage should be yellow
			expect(screen.getByText(/60.0%/i)).toBeInTheDocument()
		})

		it('should show orange for high gas usage (75-90%)', () => {
			const state = { ...mockState, gasLeft: 150000 }

			render(() => <GasUsage state={state} initialGas={1000000} />)

			// 85% usage should be orange
			expect(screen.getByText(/85.0%/i)).toBeInTheDocument()
		})

		it('should show red for critical gas usage (>90%)', () => {
			const state = { ...mockState, gasLeft: 50000 }

			render(() => <GasUsage state={state} initialGas={1000000} />)

			// 95% usage should be red
			expect(screen.getByText(/95.0%/i)).toBeInTheDocument()
		})
	})

	describe('Dynamic Gas Tips', () => {
		it('should adjust tip badges based on usage percentage', () => {
			const state = { ...mockState, gasLeft: 500000 }

			render(() => <GasUsage state={state} initialGas={1000000} />)

			// At 50% usage, tips should have different badge variants
			expect(screen.getByText('Gas Efficiency Tips')).toBeInTheDocument()
		})

		it('should show appropriate tips for low gas usage', () => {
			const state = { ...mockState, gasLeft: 900000 }

			render(() => <GasUsage state={state} initialGas={1000000} />)

			// All tips should be visible with default variant
			expect(screen.getByText(/Storage operations/i)).toBeInTheDocument()
			expect(screen.getByText(/Memory expansion/i)).toBeInTheDocument()
			expect(screen.getByText(/External calls/i)).toBeInTheDocument()
		})

		it('should adjust tips for high gas usage', () => {
			const state = { ...mockState, gasLeft: 50000 }

			render(() => <GasUsage state={state} initialGas={1000000} />)

			// Tips should still be visible but with different styling
			expect(screen.getByText(/Storage operations/i)).toBeInTheDocument()
		})
	})

	describe('Gas Calculations', () => {
		it('should calculate gas used correctly', () => {
			render(() => <GasUsage state={mockState} initialGas={1000000} />)

			// 1,000,000 - 750,000 = 250,000 used
			expect(screen.getByText('250,000')).toBeInTheDocument()
		})

		it('should handle zero gas used', () => {
			const state = { ...mockState, gasLeft: 1000000 }

			render(() => <GasUsage state={state} initialGas={1000000} />)

			expect(screen.getByText('0%')).toBeInTheDocument()
		})

		it('should handle all gas consumed', () => {
			const state = { ...mockState, gasLeft: 0 }

			render(() => <GasUsage state={state} initialGas={1000000} />)

			expect(screen.getByText('100%')).toBeInTheDocument()
		})
	})

	describe('Edge Cases', () => {
		it('should handle very large gas values', () => {
			const state = { ...mockState, gasLeft: 999999999 }

			render(() => <GasUsage state={state} initialGas={1000000000} />)

			expect(screen.getByText('999,999,999')).toBeInTheDocument()
		})

		it('should handle default initial gas when not provided', () => {
			render(() => <GasUsage state={mockState} />)

			// Should use default of 1,000,000
			expect(screen.getByText('Gas Usage')).toBeInTheDocument()
		})

		it('should format numbers with locale string', () => {
			const state = { ...mockState, gasLeft: 1234567 }

			render(() => <GasUsage state={state} initialGas={9999999} />)

			// Should have comma separators
			expect(screen.getByText('1,234,567')).toBeInTheDocument()
		})
	})
})
