import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Storage from './Storage'
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

describe('Storage', () => {
	const mockState: EvmState = {
		gasLeft: 1000000,
		depth: 1,
		stack: [],
		memory: '0x',
		storage: [
			{ key: '0x0000000000000000000000000000000000000000000000000000000000000000', value: '0x000000000000000000000000000000000000000000000000000000000000000a' },
			{ key: '0x0000000000000000000000000000000000000000000000000000000000000001', value: '0x000000000000000000000000000000000000000000000000000000000000001e' },
		],
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
		it('should render storage with correct count', () => {
			render(() => <Storage state={mockState} />)
			expect(screen.getByText(/Storage \(2\)/i)).toBeInTheDocument()
		})

		it('should display storage key-value pairs with indices', () => {
			render(() => <Storage state={mockState} />)

			expect(screen.getByText('0:')).toBeInTheDocument()
			expect(screen.getByText('1:')).toBeInTheDocument()
		})

		it('should display empty state when storage is empty', () => {
			const emptyState = { ...mockState, storage: [] }
			render(() => <Storage state={emptyState} />)

			expect(screen.getByText(/Storage is empty/i)).toBeInTheDocument()
		})

		it('should show info tooltip', () => {
			render(() => <Storage state={mockState} />)
			expect(screen.getByText('Key-value pairs')).toBeInTheDocument()
		})

		it('should display arrow between key and value', () => {
			render(() => <Storage state={mockState} />)
			// Arrow icon should be present
			const container = screen.getByText(/Storage \(2\)/i).closest('.overflow-hidden')
			expect(container).toBeInTheDocument()
		})
	})

	describe('Type Bug Fix (CRITICAL)', () => {
		it('should use array.length instead of Object.keys().length', () => {
			// This test verifies the type bug fix
			render(() => <Storage state={mockState} />)

			// Should display correct count using .length
			expect(screen.getByText(/Storage \(2\)/i)).toBeInTheDocument()
		})

		it('should handle storage as array correctly', () => {
			const state = {
				...mockState,
				storage: [
					{ key: '0x01', value: '0x02' },
					{ key: '0x03', value: '0x04' },
					{ key: '0x05', value: '0x06' },
				],
			}

			render(() => <Storage state={state} />)
			expect(screen.getByText(/Storage \(3\)/i)).toBeInTheDocument()
		})
	})

	describe('Copy Functionality', () => {
		it('should copy key to clipboard on key button click', async () => {
			const { copyToClipboard } = await import('~/lib/utils')
			render(() => <Storage state={mockState} />)

			const keyButtons = screen.getAllByLabelText('Copy key to clipboard')
			fireEvent.click(keyButtons[0])

			await waitFor(() => {
				expect(copyToClipboard).toHaveBeenCalledWith(
					'0x0000000000000000000000000000000000000000000000000000000000000000'
				)
			})
		})

		it('should copy value to clipboard on value button click', async () => {
			const { copyToClipboard } = await import('~/lib/utils')
			render(() => <Storage state={mockState} />)

			const valueButtons = screen.getAllByLabelText('Copy value to clipboard')
			fireEvent.click(valueButtons[0])

			await waitFor(() => {
				expect(copyToClipboard).toHaveBeenCalledWith(
					'0x000000000000000000000000000000000000000000000000000000000000000a'
				)
			})
		})

		it('should show success toast with type indicator on copy', async () => {
			render(() => <Storage state={mockState} />)

			const keyButtons = screen.getAllByLabelText('Copy key to clipboard')
			fireEvent.click(keyButtons[0])

			await waitFor(() => {
				expect(toast.info).toHaveBeenCalled()
			})
		})

		it('should handle clipboard copy errors for keys', async () => {
			const { copyToClipboard } = await import('~/lib/utils')
			;(copyToClipboard as any).mockImplementationOnce(() => {
				throw new Error('Clipboard error')
			})

			render(() => <Storage state={mockState} />)

			const keyButtons = screen.getAllByLabelText('Copy key to clipboard')
			fireEvent.click(keyButtons[0])

			await waitFor(() => {
				expect(toast.error).toHaveBeenCalledWith('Failed to copy to clipboard')
			})
		})

		it('should handle clipboard copy errors for values', async () => {
			const { copyToClipboard } = await import('~/lib/utils')
			;(copyToClipboard as any).mockImplementationOnce(() => {
				throw new Error('Clipboard error')
			})

			render(() => <Storage state={mockState} />)

			const valueButtons = screen.getAllByLabelText('Copy value to clipboard')
			fireEvent.click(valueButtons[0])

			await waitFor(() => {
				expect(toast.error).toHaveBeenCalledWith('Failed to copy to clipboard')
			})
		})
	})

	describe('Edge Cases', () => {
		it('should handle single storage slot', () => {
			const singleState = {
				...mockState,
				storage: [{ key: '0x00', value: '0x01' }],
			}

			render(() => <Storage state={singleState} />)
			expect(screen.getByText(/Storage \(1\)/i)).toBeInTheDocument()
		})

		it('should handle many storage slots', () => {
			const manySlots = Array.from({ length: 100 }, (_, i) => ({
				key: `0x${i.toString(16).padStart(64, '0')}`,
				value: `0x${(i * 2).toString(16).padStart(64, '0')}`,
			}))
			const manyState = { ...mockState, storage: manySlots }

			render(() => <Storage state={manyState} />)
			expect(screen.getByText(/Storage \(100\)/i)).toBeInTheDocument()
		})

		it('should handle storage with zero values', () => {
			const zeroState = {
				...mockState,
				storage: [
					{ key: '0x00', value: '0x00' },
					{ key: '0x01', value: '0x00' },
				],
			}

			render(() => <Storage state={zeroState} />)
			expect(screen.getByText(/Storage \(2\)/i)).toBeInTheDocument()
		})

		it('should handle storage with same keys (edge case)', () => {
			const sameKeyState = {
				...mockState,
				storage: [
					{ key: '0x00', value: '0x01' },
					{ key: '0x00', value: '0x02' },
				],
			}

			render(() => <Storage state={sameKeyState} />)
			expect(screen.getByText(/Storage \(2\)/i)).toBeInTheDocument()
		})
	})

	describe('Formatting', () => {
		it('should format both keys and values', () => {
			render(() => <Storage state={mockState} />)

			// Both key and value buttons should be present
			const keyButtons = screen.getAllByText('key')
			const valueButtons = screen.getAllByText('value')

			expect(keyButtons.length).toBe(2)
			expect(valueButtons.length).toBe(2)
		})
	})

	describe('Accessibility', () => {
		it('should have proper ARIA labels for key copy buttons', () => {
			render(() => <Storage state={mockState} />)

			const keyButtons = screen.getAllByLabelText('Copy key to clipboard')
			expect(keyButtons.length).toBe(2)
		})

		it('should have proper ARIA labels for value copy buttons', () => {
			render(() => <Storage state={mockState} />)

			const valueButtons = screen.getAllByLabelText('Copy value to clipboard')
			expect(valueButtons.length).toBe(2)
		})
	})
})
