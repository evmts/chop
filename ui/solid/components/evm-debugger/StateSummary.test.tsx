import { render, screen } from '@solidjs/testing-library'
import { describe, it, expect, beforeEach } from 'vitest'
import StateSummary from './StateSummary'
import type { BlockJson, EvmState } from '~/lib/types'

describe('StateSummary', () => {
	const mockBlocks: BlockJson[] = [
		{
			beginIndex: 0,
			gasCost: 3,
			stackReq: 0,
			stackMaxGrowth: 1,
			pcs: [0, 2],
			opcodes: ['PUSH1', 'PUSH1'],
			hex: ['60', '60'],
			data: ['05', '0a'],
		},
		{
			beginIndex: 4,
			gasCost: 3,
			stackReq: 2,
			stackMaxGrowth: -1,
			pcs: [4],
			opcodes: ['ADD'],
			hex: ['01'],
			data: [''],
		},
	]

	const mockState: EvmState = {
		gasLeft: 1000000,
		depth: 1,
		stack: [],
		memory: '0x',
		storage: [],
		logs: [],
		returnData: '0x',
		completed: false,
		currentInstructionIndex: 0,
		currentBlockStartIndex: 0,
		blocks: mockBlocks,
	}

	beforeEach(() => {
		// Reset any mocks
	})

	describe('Rendering', () => {
		it('should render all state metrics', () => {
			render(() => <StateSummary state={mockState} isUpdating={false} />)

			expect(screen.getByText('Instr Idx')).toBeInTheDocument()
			expect(screen.getByText('Opcode')).toBeInTheDocument()
			expect(screen.getByText('Gas Left')).toBeInTheDocument()
			expect(screen.getByText('Depth')).toBeInTheDocument()
		})

		it('should display current instruction index and total', () => {
			render(() => <StateSummary state={mockState} isUpdating={false} />)

			expect(screen.getByText('0')).toBeInTheDocument()
			// Total should be calculated from blocks
			expect(screen.getByText(/\/ \d+/)).toBeInTheDocument()
		})

		it('should display current opcode', () => {
			render(() => <StateSummary state={mockState} isUpdating={false} />)

			expect(screen.getByText('PUSH1')).toBeInTheDocument()
		})

		it('should display gas left with formatting', () => {
			render(() => <StateSummary state={mockState} isUpdating={false} />)

			expect(screen.getByText('1,000,000')).toBeInTheDocument()
		})

		it('should display call depth', () => {
			render(() => <StateSummary state={mockState} isUpdating={false} />)

			expect(screen.getByText('1')).toBeInTheDocument()
		})
	})

	describe('Off-by-One Error Fix (CRITICAL)', () => {
		it('should calculate current offset correctly without off-by-one error', () => {
			const state = {
				...mockState,
				currentInstructionIndex: 4,
				currentBlockStartIndex: 4,
			}

			render(() => <StateSummary state={state} isUpdating={false} />)

			// Should show ADD opcode at index 0 of second block
			expect(screen.getByText('ADD')).toBeInTheDocument()
		})

		it('should handle offset calculation at block boundaries', () => {
			const state = {
				...mockState,
				currentInstructionIndex: 0,
				currentBlockStartIndex: 0,
			}

			render(() => <StateSummary state={state} isUpdating={false} />)

			expect(screen.getByText('PUSH1')).toBeInTheDocument()
		})

		it('should correctly identify opcode at second instruction in block', () => {
			const state = {
				...mockState,
				currentInstructionIndex: 1,
				currentBlockStartIndex: 0,
			}

			render(() => <StateSummary state={state} isUpdating={false} />)

			// Second instruction in first block
			expect(screen.getByText('PUSH1')).toBeInTheDocument()
		})
	})

	describe('Null Safety', () => {
		it('should handle missing blocks gracefully', () => {
			const state = { ...mockState, blocks: [] }

			render(() => <StateSummary state={state} isUpdating={false} />)

			expect(screen.getByText('UNKNOWN')).toBeInTheDocument()
		})

		it('should handle block without opcodes array', () => {
			const invalidBlock = { ...mockBlocks[0], opcodes: undefined as any }
			const state = { ...mockState, blocks: [invalidBlock] }

			render(() => <StateSummary state={state} isUpdating={false} />)

			expect(screen.getByText('UNKNOWN')).toBeInTheDocument()
		})

		it('should handle invalid current block index', () => {
			const state = {
				...mockState,
				currentBlockStartIndex: 999,
			}

			render(() => <StateSummary state={state} isUpdating={false} />)

			expect(screen.getByText('UNKNOWN')).toBeInTheDocument()
		})

		it('should handle out of bounds opcode index', () => {
			const state = {
				...mockState,
				currentInstructionIndex: 999,
				currentBlockStartIndex: 0,
			}

			render(() => <StateSummary state={state} isUpdating={false} />)

			expect(screen.getByText('UNKNOWN')).toBeInTheDocument()
		})
	})

	describe('Total Instructions Calculation', () => {
		it('should calculate total instructions from all blocks', () => {
			render(() => <StateSummary state={mockState} isUpdating={false} />)

			// First block: index 0, 2 opcodes = end at 2
			// Second block: index 4, 1 opcode = end at 5
			// Total should be 5
			expect(screen.getByText(/\/ 5/)).toBeInTheDocument()
		})

		it('should use createMemo for performance optimization', () => {
			const { rerender } = render(() => <StateSummary state={mockState} isUpdating={false} />)

			// Re-render with same state
			rerender(() => <StateSummary state={mockState} isUpdating={false} />)

			// Should still display correct total
			expect(screen.getByText(/\/ 5/)).toBeInTheDocument()
		})

		it('should handle empty blocks array', () => {
			const state = { ...mockState, blocks: [] }

			render(() => <StateSummary state={state} isUpdating={false} />)

			expect(screen.getByText(/\/ 0/)).toBeInTheDocument()
		})
	})

	describe('Gas Warnings', () => {
		it('should show critical warning for very low gas (<1000)', () => {
			const state = { ...mockState, gasLeft: 500 }

			render(() => <StateSummary state={state} isUpdating={false} />)

			expect(screen.getByText('critical')).toBeInTheDocument()
		})

		it('should show low warning for low gas (<10000)', () => {
			const state = { ...mockState, gasLeft: 5000 }

			render(() => <StateSummary state={state} isUpdating={false} />)

			expect(screen.getByText('low')).toBeInTheDocument()
		})

		it('should not show warning for normal gas levels', () => {
			const state = { ...mockState, gasLeft: 100000 }

			render(() => <StateSummary state={state} isUpdating={false} />)

			expect(screen.queryByText('critical')).not.toBeInTheDocument()
			expect(screen.queryByText('low')).not.toBeInTheDocument()
		})
	})

	describe('Execution Status', () => {
		it('should show completed status when execution is done', () => {
			const state = { ...mockState, completed: true }

			render(() => <StateSummary state={state} isUpdating={false} />)

			expect(screen.getByText('completed')).toBeInTheDocument()
		})

		it('should show running status when updating', () => {
			render(() => <StateSummary state={mockState} isUpdating={true} />)

			expect(screen.getByText('running')).toBeInTheDocument()
		})

		it('should show paused status when not updating and not completed', () => {
			render(() => <StateSummary state={mockState} isUpdating={false} />)

			expect(screen.getByText('paused')).toBeInTheDocument()
		})
	})

	describe('Update Animation', () => {
		it('should apply animate-pulse class when updating', () => {
			const { container } = render(() => <StateSummary state={mockState} isUpdating={true} />)

			const card = container.querySelector('.animate-pulse')
			expect(card).toBeInTheDocument()
		})

		it('should not apply animate-pulse class when not updating', () => {
			const { container } = render(() => <StateSummary state={mockState} isUpdating={false} />)

			const card = container.querySelector('.animate-pulse')
			expect(card).not.toBeInTheDocument()
		})
	})

	describe('Edge Cases', () => {
		it('should handle single block execution', () => {
			const state = {
				...mockState,
				blocks: [mockBlocks[0]],
				currentInstructionIndex: 1,
				currentBlockStartIndex: 0,
			}

			render(() => <StateSummary state={state} isUpdating={false} />)

			expect(screen.getByText('PUSH1')).toBeInTheDocument()
		})

		it('should handle large instruction indices', () => {
			const largeBlocks: BlockJson[] = Array.from({ length: 100 }, (_, i) => ({
				beginIndex: i * 10,
				gasCost: 3,
				stackReq: 0,
				stackMaxGrowth: 1,
				pcs: [i * 10],
				opcodes: [`OP${i}`],
				hex: ['60'],
				data: ['00'],
			}))

			const state = {
				...mockState,
				blocks: largeBlocks,
				currentInstructionIndex: 500,
				currentBlockStartIndex: 500,
			}

			render(() => <StateSummary state={state} isUpdating={false} />)

			expect(screen.getByText('500')).toBeInTheDocument()
		})

		it('should handle zero gas', () => {
			const state = { ...mockState, gasLeft: 0 }

			render(() => <StateSummary state={state} isUpdating={false} />)

			expect(screen.getByText('0')).toBeInTheDocument()
			expect(screen.getByText('critical')).toBeInTheDocument()
		})

		it('should handle max depth', () => {
			const state = { ...mockState, depth: 1024 }

			render(() => <StateSummary state={state} isUpdating={false} />)

			expect(screen.getByText('1024')).toBeInTheDocument()
		})
	})
})
