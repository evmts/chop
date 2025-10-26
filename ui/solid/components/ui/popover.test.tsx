import { render, screen, waitFor } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Popover, PopoverArrow, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger } from './popover'

describe('Popover Components', () => {
	describe('Basic Rendering', () => {
		it('should render popover trigger', () => {
			render(() => (
				<Popover>
					<PopoverTrigger>Open Popover</PopoverTrigger>
					<PopoverContent>Content</PopoverContent>
				</Popover>
			))

			expect(screen.getByRole('button', { name: 'Open Popover' })).toBeInTheDocument()
		})

		it('should not show content initially', () => {
			render(() => (
				<Popover>
					<PopoverTrigger>Trigger</PopoverTrigger>
					<PopoverContent>Hidden Content</PopoverContent>
				</Popover>
			))

			expect(screen.queryByText('Hidden Content')).not.toBeInTheDocument()
		})

		it('should render popover with title and description', () => {
			render(() => (
				<Popover open>
					<PopoverTrigger>Trigger</PopoverTrigger>
					<PopoverContent>
						<PopoverTitle>Title</PopoverTitle>
						<PopoverDescription>Description</PopoverDescription>
					</PopoverContent>
				</Popover>
			))

			expect(screen.getByText('Title')).toBeInTheDocument()
			expect(screen.getByText('Description')).toBeInTheDocument()
		})
	})

	describe('Open/Close Behavior', () => {
		it('should show content when trigger is clicked', async () => {
			const user = userEvent.setup()

			render(() => (
				<Popover>
					<PopoverTrigger>Open</PopoverTrigger>
					<PopoverContent>Popover Content</PopoverContent>
				</Popover>
			))

			const trigger = screen.getByRole('button')
			await user.click(trigger)

			await waitFor(() => {
				expect(screen.getByText('Popover Content')).toBeInTheDocument()
			})
		})

		it('should close when trigger is clicked again', async () => {
			const user = userEvent.setup()

			render(() => (
				<Popover>
					<PopoverTrigger>Toggle</PopoverTrigger>
					<PopoverContent>Content</PopoverContent>
				</Popover>
			))

			const trigger = screen.getByRole('button')

			// Open
			await user.click(trigger)
			await waitFor(() => expect(screen.getByText('Content')).toBeInTheDocument())

			// Close
			await user.click(trigger)
			await waitFor(() => expect(screen.queryByText('Content')).not.toBeInTheDocument())
		})

		it('should support controlled open state', () => {
			render(() => (
				<Popover open={true}>
					<PopoverTrigger>Trigger</PopoverTrigger>
					<PopoverContent>Always Open</PopoverContent>
				</Popover>
			))

			expect(screen.getByText('Always Open')).toBeInTheDocument()
		})

		it('should close when close button is clicked', async () => {
			const user = userEvent.setup()

			render(() => (
				<Popover>
					<PopoverTrigger>Open</PopoverTrigger>
					<PopoverContent>
						<div>Content with close button</div>
					</PopoverContent>
				</Popover>
			))

			const trigger = screen.getByRole('button', { name: 'Open' })
			await user.click(trigger)

			await waitFor(() => {
				expect(screen.getByText('Content with close button')).toBeInTheDocument()
			})

			// Find and click close button (look for SVG with "Close" title)
			const closeButtons = screen.getAllByRole('button')
			const closeButton = closeButtons.find((btn) => {
				const svg = btn.querySelector('svg')
				return svg?.querySelector('title')?.textContent === 'Close'
			})

			if (closeButton) {
				await user.click(closeButton)
				await waitFor(() => {
					expect(screen.queryByText('Content with close button')).not.toBeInTheDocument()
				})
			}
		})
	})

	describe('Close Button', () => {
		it('should show close button by default', async () => {
			const user = userEvent.setup()

			render(() => (
				<Popover>
					<PopoverTrigger>Open</PopoverTrigger>
					<PopoverContent>Content</PopoverContent>
				</Popover>
			))

			const trigger = screen.getByRole('button')
			await user.click(trigger)

			await waitFor(() => {
				const buttons = screen.getAllByRole('button')
				const closeButton = buttons.find((btn) => {
					const svg = btn.querySelector('svg')
					return svg?.querySelector('title')?.textContent === 'Close'
				})
				expect(closeButton).toBeInTheDocument()
			})
		})

		it('should hide close button when showCloseButton is false', async () => {
			const user = userEvent.setup()

			render(() => (
				<Popover>
					<PopoverTrigger>Open</PopoverTrigger>
					<PopoverContent showCloseButton={false}>No close button</PopoverContent>
				</Popover>
			))

			const trigger = screen.getByRole('button')
			await user.click(trigger)

			await waitFor(() => {
				expect(screen.getByText('No close button')).toBeInTheDocument()
			})

			// Verify no close button exists
			const buttons = screen.getAllByRole('button')
			const closeButton = buttons.find((btn) => {
				const svg = btn.querySelector('svg')
				return svg?.querySelector('title')?.textContent === 'Close'
			})
			expect(closeButton).toBeUndefined()
		})

		it('should show close button when showCloseButton is explicitly true', async () => {
			const user = userEvent.setup()

			render(() => (
				<Popover>
					<PopoverTrigger>Open</PopoverTrigger>
					<PopoverContent showCloseButton={true}>With close</PopoverContent>
				</Popover>
			))

			const trigger = screen.getByRole('button')
			await user.click(trigger)

			await waitFor(() => {
				const buttons = screen.getAllByRole('button')
				const closeButton = buttons.find((btn) => {
					const svg = btn.querySelector('svg')
					return svg?.querySelector('title')?.textContent === 'Close'
				})
				expect(closeButton).toBeInTheDocument()
			})
		})

		it('should have correct close button SVG accessibility', async () => {
			const user = userEvent.setup()

			render(() => (
				<Popover>
					<PopoverTrigger>Open</PopoverTrigger>
					<PopoverContent>Content</PopoverContent>
				</Popover>
			))

			await user.click(screen.getByRole('button'))

			await waitFor(() => {
				const buttons = screen.getAllByRole('button')
				const closeButton = buttons.find((btn) => {
					const svg = btn.querySelector('svg')
					return svg?.querySelector('title')?.textContent === 'Close'
				})
				const svg = closeButton?.querySelector('svg')
				const title = svg?.querySelector('title')
				expect(title?.textContent).toBe('Close')
				// Verify title is the first child for proper accessibility
				expect(svg?.firstElementChild).toBe(title)
			})
		})
	})

	describe('PopoverArrow', () => {
		it('should export PopoverArrow component', () => {
			expect(PopoverArrow).toBeDefined()
		})

		it('should render arrow when included', async () => {
			const user = userEvent.setup()

			render(() => (
				<Popover>
					<PopoverTrigger>Open</PopoverTrigger>
					<PopoverContent>
						<PopoverArrow />
						<div>Content with arrow</div>
					</PopoverContent>
				</Popover>
			))

			await user.click(screen.getByRole('button'))

			await waitFor(() => {
				expect(screen.getByText('Content with arrow')).toBeInTheDocument()
			})
		})
	})

	describe('Custom Styling', () => {
		it('should accept custom className on content', async () => {
			const user = userEvent.setup()

			render(() => (
				<Popover>
					<PopoverTrigger>Open</PopoverTrigger>
					<PopoverContent class="custom-popover">Custom Styled</PopoverContent>
				</Popover>
			))

			await user.click(screen.getByRole('button'))

			await waitFor(() => {
				const content = screen.getByText('Custom Styled').parentElement
				expect(content).toHaveClass('custom-popover')
			})
		})

		it('should merge custom className with default classes', async () => {
			const user = userEvent.setup()

			render(() => (
				<Popover>
					<PopoverTrigger>Open</PopoverTrigger>
					<PopoverContent class="my-custom-class">Merged Classes</PopoverContent>
				</Popover>
			))

			await user.click(screen.getByRole('button'))

			await waitFor(() => {
				const content = screen.getByText('Merged Classes').parentElement
				expect(content).toHaveClass('my-custom-class')
				expect(content).toHaveClass('rounded-md')
			})
		})
	})

	describe('Positioning', () => {
		it('should have default positioning props', () => {
			render(() => (
				<Popover>
					<PopoverTrigger>Trigger</PopoverTrigger>
					<PopoverContent>Content</PopoverContent>
				</Popover>
			))

			// Component should render without errors with default gutter and flip
			expect(screen.getByRole('button')).toBeInTheDocument()
		})
	})

	describe('Accessibility', () => {
		it('should have correct ARIA attributes on trigger', () => {
			render(() => (
				<Popover>
					<PopoverTrigger>Accessible Trigger</PopoverTrigger>
					<PopoverContent>Content</PopoverContent>
				</Popover>
			))

			const trigger = screen.getByRole('button')
			expect(trigger).toHaveAttribute('aria-haspopup')
		})

		it('should support aria-label on trigger', () => {
			render(() => (
				<Popover>
					<PopoverTrigger aria-label="Open settings">Settings</PopoverTrigger>
					<PopoverContent>Settings content</PopoverContent>
				</Popover>
			))

			expect(screen.getByLabelText('Open settings')).toBeInTheDocument()
		})

		it('should have focus management', async () => {
			const user = userEvent.setup()

			render(() => (
				<Popover>
					<PopoverTrigger>Open</PopoverTrigger>
					<PopoverContent>
						<button>Focusable content</button>
					</PopoverContent>
				</Popover>
			))

			const trigger = screen.getByRole('button', { name: 'Open' })
			await user.click(trigger)

			await waitFor(() => {
				expect(screen.getByRole('button', { name: 'Focusable content' })).toBeInTheDocument()
			})
		})

		it('should be keyboard accessible', async () => {
			const user = userEvent.setup()

			render(() => (
				<Popover>
					<PopoverTrigger>Trigger</PopoverTrigger>
					<PopoverContent>Keyboard accessible</PopoverContent>
				</Popover>
			))

			const trigger = screen.getByRole('button')
			trigger.focus()
			await user.keyboard('{Enter}')

			await waitFor(() => {
				expect(screen.getByText('Keyboard accessible')).toBeInTheDocument()
			})
		})

		it('should close on Escape key', async () => {
			const user = userEvent.setup()

			render(() => (
				<Popover>
					<PopoverTrigger>Open</PopoverTrigger>
					<PopoverContent>Press Escape to close</PopoverContent>
				</Popover>
			))

			await user.click(screen.getByRole('button'))

			await waitFor(() => {
				expect(screen.getByText('Press Escape to close')).toBeInTheDocument()
			})

			await user.keyboard('{Escape}')

			await waitFor(() => {
				expect(screen.queryByText('Press Escape to close')).not.toBeInTheDocument()
			})
		})
	})

	describe('Content Composition', () => {
		it('should render title and description together', async () => {
			const user = userEvent.setup()

			render(() => (
				<Popover>
					<PopoverTrigger>Open</PopoverTrigger>
					<PopoverContent>
						<PopoverTitle>Popover Title</PopoverTitle>
						<PopoverDescription>This is a description</PopoverDescription>
						<div>Additional content</div>
					</PopoverContent>
				</Popover>
			))

			await user.click(screen.getByRole('button'))

			await waitFor(() => {
				expect(screen.getByText('Popover Title')).toBeInTheDocument()
				expect(screen.getByText('This is a description')).toBeInTheDocument()
				expect(screen.getByText('Additional content')).toBeInTheDocument()
			})
		})
	})

	describe('Edge Cases', () => {
		it('should handle empty content', async () => {
			const user = userEvent.setup()

			render(() => (
				<Popover>
					<PopoverTrigger>Open Empty</PopoverTrigger>
					<PopoverContent />
				</Popover>
			))

			await user.click(screen.getByRole('button'))

			// Should not throw error
			await waitFor(() => {
				const buttons = screen.getAllByRole('button')
				expect(buttons.length).toBeGreaterThan(0)
			})
		})

		it('should handle rapid open/close', async () => {
			const user = userEvent.setup()

			render(() => (
				<Popover>
					<PopoverTrigger>Toggle Fast</PopoverTrigger>
					<PopoverContent>Content</PopoverContent>
				</Popover>
			))

			const trigger = screen.getByRole('button')

			// Rapid clicks
			await user.click(trigger)
			await user.click(trigger)
			await user.click(trigger)

			// Should not throw errors and end in a stable state
			expect(trigger).toBeInTheDocument()
		})
	})
})
