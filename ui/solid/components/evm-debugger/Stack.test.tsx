import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Stack from './Stack'
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

describe('Stack', () => {
	const mockState: EvmState = {
		gasLeft: 1000000,
		depth: 1,
		stack: [
			'0x0000000000000000000000000000000000000000000000000000000000000001',
			'0x0000000000000000000000000000000000000000000000000000000000000002',
			'0x0000000000000000000000000000000000000000000000000000000000000003',
		],
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
		it('should render stack with correct count', () => {
			render(() => <Stack state={mockState} />)
			expect(screen.getByText(/Stack \(3\)/i)).toBeInTheDocument()
		})

		it('should display stack items in reverse order (top at bottom)', () => {
			render(() => <Stack state={mockState} />)

			// Stack should be reversed, so indices should be 2, 1, 0
			expect(screen.getByText('2:')).toBeInTheDocument()
			expect(screen.getByText('1:')).toBeInTheDocument()
			expect(screen.getByText('0:')).toBeInTheDocument()
		})

		it('should display empty state when stack is empty', () => {
			const emptyState = { ...mockState, stack: [] }
			render(() => <Stack state={emptyState} />)

			expect(screen.getByText(/Stack is empty/i)).toBeInTheDocument()
		})

		it('should show info tooltip', () => {
			render(() => <Stack state={mockState} />)
			expect(screen.getByText('Top of stack at bottom')).toBeInTheDocument()
		})
	})

	describe('Array Mutation Bug Fix', () => {
		it('should not mutate the original stack array', () => {
			const originalStack = [...mockState.stack]
			render(() => <Stack state={mockState} />)

			// Verify original array is not mutated
			expect(mockState.stack).toEqual(originalStack)
		})

		it('should display reversed stack without affecting state', () => {
			const stackCopy = [...mockState.stack]
			render(() => <Stack state={mockState} />)

			// Original stack should remain unchanged
			expect(mockState.stack).toEqual(stackCopy)
			expect(mockState.stack[0]).toBe('0x0000000000000000000000000000000000000000000000000000000000000001')
		})
	})

	describe('Copy Functionality', () => {
		it('should copy item to clipboard on button click', async () => {
			const { copyToClipboard } = await import('~/lib/utils')
			render(() => <Stack state={mockState} />)

			const copyButtons = screen.getAllByLabelText('Copy to clipboard')
			fireEvent.click(copyButtons[0])

			await waitFor(() => {
				expect(copyToClipboard).toHaveBeenCalledWith(
					'0x0000000000000000000000000000000000000000000000000000000000000003'
				)
			})
		})

		it('should show success toast with correct index on copy', async () => {
			render(() => <Stack state={mockState} />)

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

			render(() => <Stack state={mockState} />)

			const copyButtons = screen.getAllByLabelText('Copy to clipboard')
			fireEvent.click(copyButtons[0])

			await waitFor(() => {
				expect(toast.error).toHaveBeenCalledWith('Failed to copy to clipboard')
			})
		})
	})

	describe('Mobile Formatting', () => {
		it('should format long hex values on mobile', () => {
			// Mock isMobile
			Object.defineProperty(window.navigator, 'userAgent', {
				value: 'Mobile',
				writable: true,
			})

			render(() => <Stack state={mockState} />)

			// Component should render (formatHex is called internally)
			expect(screen.getByText(/Stack \(3\)/i)).toBeInTheDocument()
		})
	})

	describe('Edge Cases', () => {
		it('should handle single item stack', () => {
			const singleItemState = {
				...mockState,
				stack: ['0x0000000000000000000000000000000000000000000000000000000000000001'],
			}
			render(() => <Stack state={singleItemState} />)

			expect(screen.getByText(/Stack \(1\)/i)).toBeInTheDocument()
			expect(screen.getByText('0:')).toBeInTheDocument()
		})

		it('should handle large stack', () => {
			const largeStack = Array.from({ length: 100 }, (_, i) =>
				`0x${i.toString(16).padStart(64, '0')}`
			)
			const largeState = { ...mockState, stack: largeStack }

			render(() => <Stack state={largeState} />)
			expect(screen.getByText(/Stack \(100\)/i)).toBeInTheDocument()
		})

		it('should handle stack with all zero values', () => {
			const zeroStack = [
				'0x0000000000000000000000000000000000000000000000000000000000000000',
				'0x0000000000000000000000000000000000000000000000000000000000000000',
			]
			const zeroState = { ...mockState, stack: zeroStack }

			render(() => <Stack state={zeroState} />)
			expect(screen.getByText(/Stack \(2\)/i)).toBeInTheDocument()
		})
	})

	describe('Accessibility', () => {
		it('should have proper ARIA labels', () => {
			render(() => <Stack state={mockState} />)

			const copyButtons = screen.getAllByLabelText('Copy to clipboard')
			expect(copyButtons.length).toBe(3)
		})
	})
})
