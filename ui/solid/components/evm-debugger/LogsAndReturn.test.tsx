import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import LogsAndReturn from './LogsAndReturn'
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

describe('LogsAndReturn', () => {
	const mockState: EvmState = {
		gasLeft: 1000000,
		depth: 1,
		stack: [],
		memory: '0x',
		storage: [],
		logs: [
			'0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1',
			'0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa2',
		],
		returnData: '0x48656c6c6f20576f726c64',
		completed: false,
		currentInstructionIndex: 0,
		currentBlockStartIndex: 0,
		blocks: [],
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe('Rendering', () => {
		it('should render tabs for logs and return data', () => {
			render(() => <LogsAndReturn state={mockState} />)

			expect(screen.getByText('Return data')).toBeInTheDocument()
			expect(screen.getByText(/Logs \(2\)/i)).toBeInTheDocument()
		})

		it('should default to return data tab', () => {
			render(() => <LogsAndReturn state={mockState} />)

			expect(screen.getByText('0x48656c6c6f20576f726c64')).toBeInTheDocument()
		})

		it('should show info tooltip', () => {
			render(() => <LogsAndReturn state={mockState} />)

			expect(screen.getByText('Function return data and event logs')).toBeInTheDocument()
		})
	})

	describe('Tab Switching', () => {
		it('should switch to logs tab when clicked', async () => {
			render(() => <LogsAndReturn state={mockState} />)

			const logsTab = screen.getByLabelText('Show logs')
			fireEvent.click(logsTab)

			await waitFor(() => {
				expect(screen.getByText('0:')).toBeInTheDocument()
				expect(screen.getByText('1:')).toBeInTheDocument()
			})
		})

		it('should switch back to return data tab', async () => {
			render(() => <LogsAndReturn state={mockState} />)

			const logsTab = screen.getByLabelText('Show logs')
			fireEvent.click(logsTab)

			const returnTab = screen.getByLabelText('Show return data')
			fireEvent.click(returnTab)

			await waitFor(() => {
				expect(screen.getByText('0x48656c6c6f20576f726c64')).toBeInTheDocument()
			})
		})
	})

	describe('Logs Display', () => {
		it('should display all logs with indices', async () => {
			render(() => <LogsAndReturn state={mockState} />)

			const logsTab = screen.getByLabelText('Show logs')
			fireEvent.click(logsTab)

			await waitFor(() => {
				expect(screen.getByText('0:')).toBeInTheDocument()
				expect(screen.getByText('1:')).toBeInTheDocument()
			})
		})

		it('should display empty state when no logs', async () => {
			const emptyState = { ...mockState, logs: [] }
			render(() => <LogsAndReturn state={emptyState} />)

			const logsTab = screen.getByLabelText('Show logs')
			fireEvent.click(logsTab)

			await waitFor(() => {
				expect(screen.getByText(/No logs emitted/i)).toBeInTheDocument()
			})
		})

		it('should update log count in tab label', () => {
			const manyLogsState = {
				...mockState,
				logs: Array.from({ length: 10 }, (_, i) => `0x${i}`),
			}

			render(() => <LogsAndReturn state={manyLogsState} />)

			expect(screen.getByText(/Logs \(10\)/i)).toBeInTheDocument()
		})
	})

	describe('Return Data Display', () => {
		it('should display return data', () => {
			render(() => <LogsAndReturn state={mockState} />)

			expect(screen.getByText('0x48656c6c6f20576f726c64')).toBeInTheDocument()
		})

		it('should display empty state when no return data', () => {
			const emptyState = { ...mockState, returnData: '0x' }
			render(() => <LogsAndReturn state={emptyState} />)

			expect(screen.getByText(/No return data/i)).toBeInTheDocument()
		})

		it('should treat "0x" as empty return data', () => {
			const state = { ...mockState, returnData: '0x' }
			render(() => <LogsAndReturn state={state} />)

			expect(screen.getByText(/No return data/i)).toBeInTheDocument()
		})
	})

	describe('Copy Functionality - Logs', () => {
		it('should copy log to clipboard on button click', async () => {
			const { copyToClipboard } = await import('~/lib/utils')
			render(() => <LogsAndReturn state={mockState} />)

			const logsTab = screen.getByLabelText('Show logs')
			fireEvent.click(logsTab)

			await waitFor(() => {
				const copyButtons = screen.getAllByLabelText('Copy to clipboard')
				fireEvent.click(copyButtons[0])
			})

			await waitFor(() => {
				expect(copyToClipboard).toHaveBeenCalledWith(
					'0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1'
				)
			})
		})

		it('should show success toast with index on log copy', async () => {
			render(() => <LogsAndReturn state={mockState} />)

			const logsTab = screen.getByLabelText('Show logs')
			fireEvent.click(logsTab)

			await waitFor(() => {
				const copyButtons = screen.getAllByLabelText('Copy to clipboard')
				fireEvent.click(copyButtons[0])
			})

			await waitFor(() => {
				expect(toast.info).toHaveBeenCalled()
			})
		})

		it('should handle clipboard copy errors for logs', async () => {
			const { copyToClipboard } = await import('~/lib/utils')
			;(copyToClipboard as any).mockImplementationOnce(() => {
				throw new Error('Clipboard error')
			})

			render(() => <LogsAndReturn state={mockState} />)

			const logsTab = screen.getByLabelText('Show logs')
			fireEvent.click(logsTab)

			await waitFor(() => {
				const copyButtons = screen.getAllByLabelText('Copy to clipboard')
				fireEvent.click(copyButtons[0])
			})

			await waitFor(() => {
				expect(toast.error).toHaveBeenCalledWith('Failed to copy log to clipboard')
			})
		})
	})

	describe('Copy Functionality - Return Data', () => {
		it('should copy return data to clipboard on button click', async () => {
			const { copyToClipboard } = await import('~/lib/utils')
			render(() => <LogsAndReturn state={mockState} />)

			const copyButton = screen.getByLabelText('Copy to clipboard')
			fireEvent.click(copyButton)

			await waitFor(() => {
				expect(copyToClipboard).toHaveBeenCalledWith('0x48656c6c6f20576f726c64')
			})
		})

		it('should show success toast on return data copy', async () => {
			render(() => <LogsAndReturn state={mockState} />)

			const copyButton = screen.getByLabelText('Copy to clipboard')
			fireEvent.click(copyButton)

			await waitFor(() => {
				expect(toast.info).toHaveBeenCalledWith('Copied return data to clipboard')
			})
		})

		it('should handle clipboard copy errors for return data', async () => {
			const { copyToClipboard } = await import('~/lib/utils')
			;(copyToClipboard as any).mockImplementationOnce(() => {
				throw new Error('Clipboard error')
			})

			render(() => <LogsAndReturn state={mockState} />)

			const copyButton = screen.getByLabelText('Copy to clipboard')
			fireEvent.click(copyButton)

			await waitFor(() => {
				expect(toast.error).toHaveBeenCalledWith('Failed to copy return data to clipboard')
			})
		})
	})

	describe('Data Validation', () => {
		it('should filter out invalid logs', async () => {
			const invalidState = {
				...mockState,
				logs: ['0xvalid', null as any, undefined as any, '', '0xanother'],
			}

			render(() => <LogsAndReturn state={invalidState} />)

			// Should only count valid logs
			expect(screen.getByText(/Logs \(2\)/i)).toBeInTheDocument()
		})

		it('should handle non-array logs gracefully', async () => {
			const invalidState = {
				...mockState,
				logs: null as any,
			}

			render(() => <LogsAndReturn state={invalidState} />)

			expect(screen.getByText(/Logs \(0\)/i)).toBeInTheDocument()
		})

		it('should validate log data before copying', async () => {
			const invalidState = {
				...mockState,
				logs: [null as any],
			}

			render(() => <LogsAndReturn state={invalidState} />)

			const logsTab = screen.getByLabelText('Show logs')
			fireEvent.click(logsTab)

			// Should show empty state since invalid logs are filtered
			await waitFor(() => {
				expect(screen.getByText(/No logs emitted/i)).toBeInTheDocument()
			})
		})

		it('should validate return data before copying', async () => {
			const invalidState = {
				...mockState,
				returnData: null as any,
			}

			render(() => <LogsAndReturn state={invalidState} />)

			const copyButton = screen.getByLabelText('Copy to clipboard')
			fireEvent.click(copyButton)

			await waitFor(() => {
				expect(toast.error).toHaveBeenCalledWith('Invalid return data')
			})
		})
	})

	describe('Content Truncation', () => {
		it('should truncate very long return data', () => {
			const longData = '0x' + 'a'.repeat(15000)
			const longState = { ...mockState, returnData: longData }

			render(() => <LogsAndReturn state={longState} />)

			// Should show truncation indicator
			expect(screen.getByText(/truncated/i)).toBeInTheDocument()
		})

		it('should show full data indicator for truncated content', () => {
			const longData = '0x' + 'b'.repeat(15000)
			const longState = { ...mockState, returnData: longData }

			render(() => <LogsAndReturn state={longState} />)

			expect(screen.getByText(/Copy to see full data/i)).toBeInTheDocument()
		})

		it('should truncate very long logs', async () => {
			const longLog = '0x' + 'c'.repeat(15000)
			const longState = { ...mockState, logs: [longLog] }

			render(() => <LogsAndReturn state={longState} />)

			const logsTab = screen.getByLabelText('Show logs')
			fireEvent.click(logsTab)

			await waitFor(() => {
				expect(screen.getByText(/Content truncated/i)).toBeInTheDocument()
			})
		})

		it('should not truncate normal-sized content', () => {
			render(() => <LogsAndReturn state={mockState} />)

			expect(screen.queryByText(/truncated/i)).not.toBeInTheDocument()
		})

		it('should copy full data even when truncated on display', async () => {
			const { copyToClipboard } = await import('~/lib/utils')
			const longData = '0x' + 'd'.repeat(15000)
			const longState = { ...mockState, returnData: longData }

			render(() => <LogsAndReturn state={longState} />)

			const copyButton = screen.getByLabelText('Copy to clipboard')
			fireEvent.click(copyButton)

			await waitFor(() => {
				// Should copy the full data, not the truncated version
				expect(copyToClipboard).toHaveBeenCalledWith(longData)
			})
		})
	})

	describe('Edge Cases', () => {
		it('should handle single log', async () => {
			const singleLogState = { ...mockState, logs: ['0x123'] }

			render(() => <LogsAndReturn state={singleLogState} />)

			expect(screen.getByText(/Logs \(1\)/i)).toBeInTheDocument()
		})

		it('should handle many logs', async () => {
			const manyLogs = Array.from({ length: 100 }, (_, i) => `0x${i}`)
			const manyLogsState = { ...mockState, logs: manyLogs }

			render(() => <LogsAndReturn state={manyLogsState} />)

			expect(screen.getByText(/Logs \(100\)/i)).toBeInTheDocument()
		})

		it('should handle empty string return data', () => {
			const emptyState = { ...mockState, returnData: '' }

			render(() => <LogsAndReturn state={emptyState} />)

			expect(screen.getByText(/No return data/i)).toBeInTheDocument()
		})

		it('should handle logs with special characters', async () => {
			const specialLogs = ['0x\n\r\t', '0x"\'`']
			const specialState = { ...mockState, logs: specialLogs }

			render(() => <LogsAndReturn state={specialState} />)

			const logsTab = screen.getByLabelText('Show logs')
			fireEvent.click(logsTab)

			await waitFor(() => {
				expect(screen.getByText('0:')).toBeInTheDocument()
			})
		})
	})

	describe('Accessibility', () => {
		it('should have proper ARIA labels for tabs', () => {
			render(() => <LogsAndReturn state={mockState} />)

			expect(screen.getByLabelText('Show return data')).toBeInTheDocument()
			expect(screen.getByLabelText('Show logs')).toBeInTheDocument()
		})

		it('should have proper ARIA labels for copy buttons', async () => {
			render(() => <LogsAndReturn state={mockState} />)

			const copyButton = screen.getByLabelText('Copy to clipboard')
			expect(copyButton).toBeInTheDocument()

			const logsTab = screen.getByLabelText('Show logs')
			fireEvent.click(logsTab)

			await waitFor(() => {
				const copyButtons = screen.getAllByLabelText('Copy to clipboard')
				expect(copyButtons.length).toBe(2)
			})
		})
	})
})
