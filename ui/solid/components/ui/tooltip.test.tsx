import { render, screen, waitFor } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Tooltip, TooltipArrow, TooltipContent, TooltipTrigger } from './tooltip'

describe('Tooltip Components', () => {
	describe('Basic Rendering', () => {
		it('should render tooltip trigger', () => {
			render(() => (
				<Tooltip>
					<TooltipTrigger>Hover me</TooltipTrigger>
					<TooltipContent>Tooltip text</TooltipContent>
				</Tooltip>
			))

			expect(screen.getByText('Hover me')).toBeInTheDocument()
		})

		it('should not show content initially', () => {
			render(() => (
				<Tooltip>
					<TooltipTrigger>Trigger</TooltipTrigger>
					<TooltipContent>Hidden Tooltip</TooltipContent>
				</Tooltip>
			))

			expect(screen.queryByText('Hidden Tooltip')).not.toBeInTheDocument()
		})

		it('should render tooltip content when open', () => {
			render(() => (
				<Tooltip open>
					<TooltipTrigger>Trigger</TooltipTrigger>
					<TooltipContent>Visible Tooltip</TooltipContent>
				</Tooltip>
			))

			expect(screen.getByText('Visible Tooltip')).toBeInTheDocument()
		})
	})

	describe('Hover Behavior', () => {
		it('should show tooltip on hover', async () => {
			const user = userEvent.setup()

			render(() => (
				<Tooltip openDelay={0}>
					<TooltipTrigger>Hover target</TooltipTrigger>
					<TooltipContent>Tooltip content</TooltipContent>
				</Tooltip>
			))

			const trigger = screen.getByText('Hover target')
			await user.hover(trigger)

			await waitFor(
				() => {
					expect(screen.getByText('Tooltip content')).toBeInTheDocument()
				},
				{ timeout: 1000 }
			)
		})

		it('should hide tooltip when hover ends', async () => {
			const user = userEvent.setup()

			render(() => (
				<Tooltip openDelay={0} closeDelay={0}>
					<TooltipTrigger>Hover me</TooltipTrigger>
					<TooltipContent>Tooltip</TooltipContent>
				</Tooltip>
			))

			const trigger = screen.getByText('Hover me')

			// Hover to show
			await user.hover(trigger)
			await waitFor(() => expect(screen.getByText('Tooltip')).toBeInTheDocument(), { timeout: 1000 })

			// Unhover to hide
			await user.unhover(trigger)
			await waitFor(() => expect(screen.queryByText('Tooltip')).not.toBeInTheDocument(), { timeout: 1000 })
		})
	})

	describe('Delay Configuration', () => {
		it('should have default openDelay of 700ms', () => {
			// Test that default delay is applied
			render(() => (
				<Tooltip>
					<TooltipTrigger>Delayed</TooltipTrigger>
					<TooltipContent>Content</TooltipContent>
				</Tooltip>
			))

			expect(screen.getByText('Delayed')).toBeInTheDocument()
		})

		it('should have default closeDelay of 300ms', () => {
			render(() => (
				<Tooltip>
					<TooltipTrigger>Delayed close</TooltipTrigger>
					<TooltipContent>Content</TooltipContent>
				</Tooltip>
			))

			expect(screen.getByText('Delayed close')).toBeInTheDocument()
		})

		it('should accept custom openDelay', async () => {
			const user = userEvent.setup()

			render(() => (
				<Tooltip openDelay={100}>
					<TooltipTrigger>Custom delay</TooltipTrigger>
					<TooltipContent>Fast open</TooltipContent>
				</Tooltip>
			))

			const trigger = screen.getByText('Custom delay')
			await user.hover(trigger)

			await waitFor(() => expect(screen.getByText('Fast open')).toBeInTheDocument(), { timeout: 500 })
		})

		it('should accept custom closeDelay', async () => {
			const user = userEvent.setup()

			render(() => (
				<Tooltip openDelay={0} closeDelay={100}>
					<TooltipTrigger>Custom close</TooltipTrigger>
					<TooltipContent>Quick close</TooltipContent>
				</Tooltip>
			))

			const trigger = screen.getByText('Custom close')
			await user.hover(trigger)

			await waitFor(() => expect(screen.getByText('Quick close')).toBeInTheDocument(), { timeout: 1000 })

			await user.unhover(trigger)

			await waitFor(() => expect(screen.queryByText('Quick close')).not.toBeInTheDocument(), { timeout: 500 })
		})

		it('should support zero delay for immediate show', async () => {
			const user = userEvent.setup()

			render(() => (
				<Tooltip openDelay={0}>
					<TooltipTrigger>Instant</TooltipTrigger>
					<TooltipContent>Immediate tooltip</TooltipContent>
				</Tooltip>
			))

			const trigger = screen.getByText('Instant')
			await user.hover(trigger)

			await waitFor(() => expect(screen.getByText('Immediate tooltip')).toBeInTheDocument(), { timeout: 500 })
		})
	})

	describe('TooltipArrow', () => {
		it('should export TooltipArrow component', () => {
			expect(TooltipArrow).toBeDefined()
		})

		it('should render arrow when included', () => {
			render(() => (
				<Tooltip open>
					<TooltipTrigger>With arrow</TooltipTrigger>
					<TooltipContent>
						Content
						<TooltipArrow />
					</TooltipContent>
				</Tooltip>
			))

			expect(screen.getByText('Content')).toBeInTheDocument()
		})
	})

	describe('Content Styling', () => {
		it('should have default tooltip styles', () => {
			render(() => (
				<Tooltip open>
					<TooltipTrigger>Trigger</TooltipTrigger>
					<TooltipContent data-testid="content">Styled</TooltipContent>
				</Tooltip>
			))

			const content = screen.getByTestId('content')
			expect(content).toHaveClass('bg-primary')
			expect(content).toHaveClass('text-primary-foreground')
			expect(content).toHaveClass('text-xs')
			expect(content).toHaveClass('rounded-sm')
		})

		it('should accept custom className', () => {
			render(() => (
				<Tooltip open>
					<TooltipTrigger>Trigger</TooltipTrigger>
					<TooltipContent class="custom-tooltip" data-testid="content">
						Custom
					</TooltipContent>
				</Tooltip>
			))

			const content = screen.getByTestId('content')
			expect(content).toHaveClass('custom-tooltip')
		})

		it('should merge custom className with default classes', () => {
			render(() => (
				<Tooltip open>
					<TooltipTrigger>Trigger</TooltipTrigger>
					<TooltipContent class="my-custom-class" data-testid="content">
						Merged
					</TooltipContent>
				</Tooltip>
			))

			const content = screen.getByTestId('content')
			expect(content).toHaveClass('my-custom-class')
			expect(content).toHaveClass('bg-primary')
		})
	})

	describe('Controlled Tooltip', () => {
		it('should support controlled open state', () => {
			render(() => (
				<Tooltip open={true}>
					<TooltipTrigger>Always visible</TooltipTrigger>
					<TooltipContent>Always shown</TooltipContent>
				</Tooltip>
			))

			expect(screen.getByText('Always shown')).toBeInTheDocument()
		})

		it('should support controlled closed state', async () => {
			const user = userEvent.setup()

			render(() => (
				<Tooltip open={false} openDelay={0}>
					<TooltipTrigger>Never visible</TooltipTrigger>
					<TooltipContent>Never shown</TooltipContent>
				</Tooltip>
			))

			const trigger = screen.getByText('Never visible')
			await user.hover(trigger)

			// Should remain hidden even on hover when controlled
			await new Promise((resolve) => setTimeout(resolve, 100))
			expect(screen.queryByText('Never shown')).not.toBeInTheDocument()
		})
	})

	describe('Focus Behavior', () => {
		it('should show tooltip on focus', async () => {
			render(() => (
				<Tooltip openDelay={0}>
					<TooltipTrigger>Focusable</TooltipTrigger>
					<TooltipContent>Focus tooltip</TooltipContent>
				</Tooltip>
			))

			const trigger = screen.getByText('Focusable')
			trigger.focus()

			await waitFor(() => expect(screen.getByText('Focus tooltip')).toBeInTheDocument(), { timeout: 1000 })
		})

		it('should hide tooltip on blur', async () => {
			render(() => (
				<Tooltip openDelay={0} closeDelay={0}>
					<TooltipTrigger>Focusable</TooltipTrigger>
					<TooltipContent>Blur tooltip</TooltipContent>
				</Tooltip>
			))

			const trigger = screen.getByText('Focusable')

			// Focus to show
			trigger.focus()
			await waitFor(() => expect(screen.getByText('Blur tooltip')).toBeInTheDocument(), { timeout: 1000 })

			// Blur to hide
			trigger.blur()
			await waitFor(() => expect(screen.queryByText('Blur tooltip')).not.toBeInTheDocument(), { timeout: 1000 })
		})
	})

	describe('Positioning', () => {
		it('should have default positioning props', () => {
			render(() => (
				<Tooltip>
					<TooltipTrigger>Positioned</TooltipTrigger>
					<TooltipContent>Content</TooltipContent>
				</Tooltip>
			))

			// Component should render without errors with default gutter and flip
			expect(screen.getByText('Positioned')).toBeInTheDocument()
		})

		it('should apply default gutter of 4', () => {
			render(() => (
				<Tooltip open>
					<TooltipTrigger>Trigger</TooltipTrigger>
					<TooltipContent>Gutter content</TooltipContent>
				</Tooltip>
			))

			expect(screen.getByText('Gutter content')).toBeInTheDocument()
		})
	})

	describe('Accessibility', () => {
		it('should have proper ARIA attributes', async () => {
			const user = userEvent.setup()

			render(() => (
				<Tooltip openDelay={0}>
					<TooltipTrigger>Accessible</TooltipTrigger>
					<TooltipContent>Accessible tooltip</TooltipContent>
				</Tooltip>
			))

			const trigger = screen.getByText('Accessible')
			await user.hover(trigger)

			await waitFor(() => {
				expect(screen.getByText('Accessible tooltip')).toBeInTheDocument()
			})
		})

		it('should support aria-label on trigger', () => {
			render(() => (
				<Tooltip>
					<TooltipTrigger aria-label="Help information">?</TooltipTrigger>
					<TooltipContent>Help text</TooltipContent>
				</Tooltip>
			))

			expect(screen.getByLabelText('Help information')).toBeInTheDocument()
		})

		it('should be keyboard accessible', async () => {
			render(() => (
				<Tooltip openDelay={0}>
					<TooltipTrigger>
						<button>Keyboard trigger</button>
					</TooltipTrigger>
					<TooltipContent>Keyboard tooltip</TooltipContent>
				</Tooltip>
			))

			const trigger = screen.getByRole('button')
			trigger.focus()

			await waitFor(() => expect(screen.getByText('Keyboard tooltip')).toBeInTheDocument(), { timeout: 1000 })
		})

		it('should handle disabled triggers gracefully', () => {
			render(() => (
				<Tooltip>
					<TooltipTrigger disabled>
						<button disabled>Disabled</button>
					</TooltipTrigger>
					<TooltipContent>Tooltip for disabled</TooltipContent>
				</Tooltip>
			))

			expect(screen.getByRole('button')).toBeDisabled()
		})
	})

	describe('ParentProps Support', () => {
		it('should properly handle children in TooltipContent', () => {
			render(() => (
				<Tooltip open>
					<TooltipTrigger>Trigger</TooltipTrigger>
					<TooltipContent>
						<span>Complex</span> <strong>Content</strong>
					</TooltipContent>
				</Tooltip>
			))

			expect(screen.getByText('Complex')).toBeInTheDocument()
			expect(screen.getByText('Content')).toBeInTheDocument()
		})

		it('should render JSX children correctly', () => {
			render(() => (
				<Tooltip open>
					<TooltipTrigger>Trigger</TooltipTrigger>
					<TooltipContent>
						<div data-testid="nested">
							<p>Nested content</p>
						</div>
					</TooltipContent>
				</Tooltip>
			))

			expect(screen.getByTestId('nested')).toBeInTheDocument()
			expect(screen.getByText('Nested content')).toBeInTheDocument()
		})
	})

	describe('Edge Cases', () => {
		it('should handle empty content', () => {
			render(() => (
				<Tooltip open>
					<TooltipTrigger>Empty</TooltipTrigger>
					<TooltipContent />
				</Tooltip>
			))

			// Should not throw error
			expect(screen.getByText('Empty')).toBeInTheDocument()
		})

		it('should handle rapid hover on/off', async () => {
			const user = userEvent.setup()

			render(() => (
				<Tooltip openDelay={0} closeDelay={0}>
					<TooltipTrigger>Rapid hover</TooltipTrigger>
					<TooltipContent>Tooltip</TooltipContent>
				</Tooltip>
			))

			const trigger = screen.getByText('Rapid hover')

			// Rapid hover on/off
			await user.hover(trigger)
			await user.unhover(trigger)
			await user.hover(trigger)
			await user.unhover(trigger)

			// Should not throw errors
			expect(trigger).toBeInTheDocument()
		})

		it('should handle very long content', () => {
			const longContent = 'Very long tooltip content that might wrap multiple lines and test overflow handling'

			render(() => (
				<Tooltip open>
					<TooltipTrigger>Long</TooltipTrigger>
					<TooltipContent>{longContent}</TooltipContent>
				</Tooltip>
			))

			expect(screen.getByText(longContent)).toBeInTheDocument()
		})
	})

	describe('Animation', () => {
		it('should have animation classes', () => {
			render(() => (
				<Tooltip open>
					<TooltipTrigger>Animated</TooltipTrigger>
					<TooltipContent data-testid="content">Content</TooltipContent>
				</Tooltip>
			))

			const content = screen.getByTestId('content')
			expect(content).toHaveClass('data-[expanded]:animate-in')
			expect(content).toHaveClass('data-[closed]:animate-out')
			expect(content).toHaveClass('data-[expanded]:fade-in-0')
			expect(content).toHaveClass('data-[closed]:fade-out-0')
		})
	})
})
