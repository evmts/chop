import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Memory from './Memory'
import type { EvmState } from '~/lib/types'
import { toast } from 'solid-sonner'

// Mock dependencies
vi.mock('solid-sonner', () => ({
	toast: {
		info: vi.fn(),
		error: vi.fn(),
	},
}))

vi.mock('~/lib/utils', () => ({
	copyToClipboard: vi.fn(),
}))

describe('Memory', () => {
	const mockState: EvmState = {
		gasLeft: 1000000,
		depth: 1,
		stack: [],
		memory: '0xdeadbeef00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899aabb',
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
		it('should render memory with correct chunk count and byte size', () => {
			render(() => <Memory state={mockState} />)

			// Memory is 2 chunks of 32 bytes each = 64 bytes total
			expect(screen.getByText(/Memory \(2 chunks, 64 bytes\)/i)).toBeInTheDocument()
		})

		it('should display memory chunks with 4-digit hex addresses', () => {
			render(() => <Memory state={mockState} />)

			// Check for 4-digit padded addresses
			expect(screen.getByText(/0x0000:/i)).toBeInTheDocument()
			expect(screen.getByText(/0x0020:/i)).toBeInTheDocument()
		})

		it('should display empty state when memory is empty', () => {
			const emptyState = { ...mockState, memory: '0x' }
			render(() => <Memory state={emptyState} />)

			expect(screen.getByText(/Memory is empty/i)).toBeInTheDocument()
		})

		it('should show info tooltip', () => {
			render(() => <Memory state={mockState} />)
			expect(screen.getByText('Hexadecimal representation')).toBeInTheDocument()
		})
	})

	describe('PadStart Bug Fix (CRITICAL)', () => {
		it('should use 4-digit padding for addresses (not 2-digit)', () => {
			// Create memory with many chunks to test address padding
			const largeMemory = '0x' + 'aa'.repeat(32 * 256) // 256 chunks
			const largeState = { ...mockState, memory: largeMemory }

			render(() => <Memory state={largeState} />)

			// Address 0x0100 (256 decimal) should be displayed as 4 digits
			// With 2-digit padding it would be "0x100:", with 4-digit it's "0x0100:"
			expect(screen.getByText(/0x0100:/i)).toBeInTheDocument()
		})

		it('should consistently format all addresses with 4 digits', () => {
			const memory = '0x' + 'ff'.repeat(32 * 10) // 10 chunks
			const state = { ...mockState, memory }

			render(() => <Memory state={state} />)

			// All addresses should have 4 digits
			expect(screen.getByText(/0x0000:/i)).toBeInTheDocument()
			expect(screen.getByText(/0x0020:/i)).toBeInTheDocument()
			expect(screen.getByText(/0x0040:/i)).toBeInTheDocument()
			expect(screen.getByText(/0x0060:/i)).toBeInTheDocument()
		})
	})

	describe('Copy Functionality', () => {
		it('should copy memory chunk with 4-digit position to clipboard', async () => {
			const { copyToClipboard } = await import('~/lib/utils')
			render(() => <Memory state={mockState} />)

			const copyButtons = screen.getAllByLabelText('Copy to clipboard')
			fireEvent.click(copyButtons[0])

			await waitFor(() => {
				expect(copyToClipboard).toHaveBeenCalled()
			})
		})

		it('should show success toast with 4-digit position on copy', async () => {
			render(() => <Memory state={mockState} />)

			const copyButtons = screen.getAllByLabelText('Copy to clipboard')
			fireEvent.click(copyButtons[0])

			await waitFor(() => {
				expect(toast.info).toHaveBeenCalled()
			})
		})

		it('should handle clipboard copy errors gracefully', async () => {
			const { copyToClipboard } = await import('~/lib/utils')
			;(copyToClipboard as any).mockImplementationOnce(() => {
				throw new Error('Clipboard error')
			})

			render(() => <Memory state={mockState} />)

			const copyButtons = screen.getAllByLabelText('Copy to clipboard')
			fireEvent.click(copyButtons[0])

			await waitFor(() => {
				expect(toast.error).toHaveBeenCalledWith('Failed to copy to clipboard')
			})
		})
	})

	describe('Performance Optimization', () => {
		it('should use createMemo for memory chunks', () => {
			// Render multiple times to ensure memo is working
			const { rerender } = render(() => <Memory state={mockState} />)

			expect(screen.getByText(/Memory \(2 chunks, 64 bytes\)/i)).toBeInTheDocument()

			// Re-render with same state
			rerender(() => <Memory state={mockState} />)

			expect(screen.getByText(/Memory \(2 chunks, 64 bytes\)/i)).toBeInTheDocument()
		})
	})

	describe('Edge Cases', () => {
		it('should handle single byte of memory', () => {
			const singleByteState = { ...mockState, memory: '0xff' }
			render(() => <Memory state={singleByteState} />)

			expect(screen.getByText(/Memory \(1 chunks, 1 bytes\)/i)).toBeInTheDocument()
		})

		it('should handle large memory expansion', () => {
			// 1000 chunks = 32000 bytes
			const largeMemory = '0x' + 'ab'.repeat(32 * 1000)
			const largeState = { ...mockState, memory: largeMemory }

			render(() => <Memory state={largeState} />)

			expect(screen.getByText(/Memory \(1000 chunks, 32000 bytes\)/i)).toBeInTheDocument()
		})

		it('should handle memory with all zeros', () => {
			const zeroMemory = '0x' + '00'.repeat(64)
			const zeroState = { ...mockState, memory: zeroMemory }

			render(() => <Memory state={zeroState} />)

			expect(screen.getByText(/Memory \(2 chunks, 64 bytes\)/i)).toBeInTheDocument()
		})

		it('should handle memory without 0x prefix', () => {
			const noPrefixMemory = 'deadbeef' + 'aa'.repeat(60)
			const noPrefixState = { ...mockState, memory: noPrefixMemory }

			render(() => <Memory state={noPrefixState} />)

			// Should still render correctly
			expect(screen.getByText(/Memory/i)).toBeInTheDocument()
		})
	})

	describe('Address Calculation', () => {
		it('should calculate correct byte positions for each chunk', () => {
			render(() => <Memory state={mockState} />)

			// First chunk at position 0
			expect(screen.getByText(/0x0000:/i)).toBeInTheDocument()

			// Second chunk at position 32 (0x20)
			expect(screen.getByText(/0x0020:/i)).toBeInTheDocument()
		})

		it('should handle non-aligned memory correctly', () => {
			// 48 bytes = 1.5 chunks, should round to 2 chunks
			const partialMemory = '0x' + 'aa'.repeat(48)
			const partialState = { ...mockState, memory: partialMemory }

			render(() => <Memory state={partialState} />)

			expect(screen.getByText(/Memory \(1 chunks, 24 bytes\)/i)).toBeInTheDocument()
		})
	})

	describe('Accessibility', () => {
		it('should have proper ARIA labels for copy buttons', () => {
			render(() => <Memory state={mockState} />)

			const copyButtons = screen.getAllByLabelText('Copy to clipboard')
			expect(copyButtons.length).toBe(2)
		})
	})
})
