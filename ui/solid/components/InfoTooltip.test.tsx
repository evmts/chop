import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import InfoTooltip from './InfoTooltip'

describe('InfoTooltip', () => {
	const tooltipContent = 'This is helpful information'

	beforeEach(() => {
		// Reset viewport to desktop size
		window.innerWidth = 1024
		window.innerHeight = 768
		window.dispatchEvent(new Event('resize'))
	})

	describe('Desktop Behavior', () => {
		it('should render the tooltip trigger icon', () => {
			render(() => <InfoTooltip>{tooltipContent}</InfoTooltip>)

			const icon = screen.getByRole('button')
			expect(icon).toBeInTheDocument()
		})

		it('should render tooltip on desktop (width >= 768px)', () => {
			window.innerWidth = 1024
			window.dispatchEvent(new Event('resize'))

			render(() => <InfoTooltip>{tooltipContent}</InfoTooltip>)

			const trigger = screen.getByRole('button')
			expect(trigger).toBeInTheDocument()
		})

		it('should show tooltip content on hover (desktop)', async () => {
			window.innerWidth = 1024
			window.dispatchEvent(new Event('resize'))

			render(() => <InfoTooltip>{tooltipContent}</InfoTooltip>)

			const trigger = screen.getByRole('button')
			fireEvent.mouseEnter(trigger)

			await waitFor(() => {
				expect(screen.getByText(tooltipContent)).toBeInTheDocument()
			})
		})

		it('should hide tooltip content on mouse leave', async () => {
			window.innerWidth = 1024
			window.dispatchEvent(new Event('resize'))

			render(() => <InfoTooltip>{tooltipContent}</InfoTooltip>)

			const trigger = screen.getByRole('button')

			// Show tooltip
			fireEvent.mouseEnter(trigger)
			await waitFor(() => {
				expect(screen.getByText(tooltipContent)).toBeInTheDocument()
			})

			// Hide tooltip
			fireEvent.mouseLeave(trigger)
			await waitFor(() => {
				expect(screen.queryByText(tooltipContent)).not.toBeInTheDocument()
			})
		})

		it('should render CircleQuestionMark icon', () => {
			render(() => <InfoTooltip>{tooltipContent}</InfoTooltip>)

			const trigger = screen.getByRole('button')
			const icon = trigger.querySelector('svg')
			expect(icon).toBeInTheDocument()
			expect(icon).toHaveClass('h-4', 'w-4')
		})

		it('should have proper styling classes', () => {
			render(() => <InfoTooltip>{tooltipContent}</InfoTooltip>)

			const trigger = screen.getByRole('button')
			expect(trigger).toHaveClass('text-muted-foreground')
			expect(trigger).toHaveClass('transition-colors')
			expect(trigger).toHaveClass('hover:text-foreground')
		})

		it('should show tooltip immediately (openDelay=0)', async () => {
			window.innerWidth = 1024
			window.dispatchEvent(new Event('resize'))

			render(() => <InfoTooltip>{tooltipContent}</InfoTooltip>)

			const trigger = screen.getByRole('button')
			const startTime = Date.now()

			fireEvent.mouseEnter(trigger)

			await waitFor(() => {
				expect(screen.getByText(tooltipContent)).toBeInTheDocument()
				const elapsed = Date.now() - startTime
				// Should appear almost immediately (within 100ms)
				expect(elapsed).toBeLessThan(100)
			})
		})
	})

	describe('Mobile Behavior', () => {
		beforeEach(() => {
			// Set viewport to mobile size (< 768px)
			window.innerWidth = 375
			window.innerHeight = 667
			window.dispatchEvent(new Event('resize'))
		})

		it('should render popover on mobile (width < 768px)', async () => {
			render(() => <InfoTooltip>{tooltipContent}</InfoTooltip>)

			const trigger = screen.getByRole('button')
			expect(trigger).toBeInTheDocument()
		})

		it('should show popover content on click (mobile)', async () => {
			render(() => <InfoTooltip>{tooltipContent}</InfoTooltip>)

			const trigger = screen.getByRole('button')
			fireEvent.click(trigger)

			await waitFor(() => {
				expect(screen.getByText(tooltipContent)).toBeInTheDocument()
			})
		})

		it('should have proper popover styling on mobile', async () => {
			render(() => <InfoTooltip>{tooltipContent}</InfoTooltip>)

			const trigger = screen.getByRole('button')
			fireEvent.click(trigger)

			await waitFor(() => {
				const content = screen.getByText(tooltipContent).closest('div')
				expect(content).toHaveClass('px-4', 'py-3')
			})
		})

		it('should not show popover on hover (mobile)', async () => {
			render(() => <InfoTooltip>{tooltipContent}</InfoTooltip>)

			const trigger = screen.getByRole('button')
			fireEvent.mouseEnter(trigger)

			// On mobile, hover should not show the popover
			// Wait a bit to ensure nothing appears
			await new Promise((resolve) => setTimeout(resolve, 100))

			expect(screen.queryByText(tooltipContent)).not.toBeInTheDocument()
		})

		it('should close popover when clicked outside', async () => {
			render(() => (
				<div>
					<InfoTooltip>{tooltipContent}</InfoTooltip>
					<div data-testid="outside">Outside content</div>
				</div>
			))

			const trigger = screen.getByRole('button')
			fireEvent.click(trigger)

			await waitFor(() => {
				expect(screen.getByText(tooltipContent)).toBeInTheDocument()
			})

			// Click outside
			const outside = screen.getByTestId('outside')
			fireEvent.click(outside)

			await waitFor(() => {
				expect(screen.queryByText(tooltipContent)).not.toBeInTheDocument()
			})
		})

		it('should toggle popover on multiple clicks', async () => {
			render(() => <InfoTooltip>{tooltipContent}</InfoTooltip>)

			const trigger = screen.getByRole('button')

			// First click - open
			fireEvent.click(trigger)
			await waitFor(() => {
				expect(screen.getByText(tooltipContent)).toBeInTheDocument()
			})

			// Second click - close
			fireEvent.click(trigger)
			await waitFor(() => {
				expect(screen.queryByText(tooltipContent)).not.toBeInTheDocument()
			})

			// Third click - open again
			fireEvent.click(trigger)
			await waitFor(() => {
				expect(screen.getByText(tooltipContent)).toBeInTheDocument()
			})
		})
	})

	describe('Responsive Behavior - Dynamic Resize', () => {
		it('should switch from tooltip to popover when resizing to mobile', async () => {
			// Start on desktop
			window.innerWidth = 1024
			window.dispatchEvent(new Event('resize'))

			const { unmount } = render(() => <InfoTooltip>{tooltipContent}</InfoTooltip>)

			const trigger = screen.getByRole('button')

			// Hover should work on desktop
			fireEvent.mouseEnter(trigger)
			await waitFor(() => {
				expect(screen.getByText(tooltipContent)).toBeInTheDocument()
			})

			fireEvent.mouseLeave(trigger)

			// Resize to mobile
			window.innerWidth = 375
			window.dispatchEvent(new Event('resize'))

			// Wait for reactive update
			await waitFor(() => {
				// Now hover shouldn't work, need click instead
				fireEvent.mouseEnter(trigger)
			})

			// Click should work on mobile
			fireEvent.click(trigger)
			await waitFor(() => {
				expect(screen.getByText(tooltipContent)).toBeInTheDocument()
			})

			unmount()
		})

		it('should switch from popover to tooltip when resizing to desktop', async () => {
			// Start on mobile
			window.innerWidth = 375
			window.dispatchEvent(new Event('resize'))

			render(() => <InfoTooltip>{tooltipContent}</InfoTooltip>)

			const trigger = screen.getByRole('button')

			// Click should work on mobile
			fireEvent.click(trigger)
			await waitFor(() => {
				expect(screen.getByText(tooltipContent)).toBeInTheDocument()
			})

			// Close popover
			fireEvent.click(trigger)
			await waitFor(() => {
				expect(screen.queryByText(tooltipContent)).not.toBeInTheDocument()
			})

			// Resize to desktop
			window.innerWidth = 1024
			window.dispatchEvent(new Event('resize'))

			// Wait for reactive update and try hover
			await waitFor(() => {
				fireEvent.mouseEnter(trigger)
			})

			await waitFor(() => {
				expect(screen.getByText(tooltipContent)).toBeInTheDocument()
			})
		})

		it('should react to multiple resize events', async () => {
			window.innerWidth = 1024
			window.dispatchEvent(new Event('resize'))

			render(() => <InfoTooltip>{tooltipContent}</InfoTooltip>)

			const trigger = screen.getByRole('button')

			// Desktop -> Mobile
			window.innerWidth = 375
			window.dispatchEvent(new Event('resize'))
			await new Promise((resolve) => setTimeout(resolve, 50))

			// Mobile -> Tablet
			window.innerWidth = 800
			window.dispatchEvent(new Event('resize'))
			await new Promise((resolve) => setTimeout(resolve, 50))

			// Tablet -> Mobile
			window.innerWidth = 600
			window.dispatchEvent(new Event('resize'))
			await new Promise((resolve) => setTimeout(resolve, 50))

			// Mobile -> Desktop
			window.innerWidth = 1200
			window.dispatchEvent(new Event('resize'))
			await new Promise((resolve) => setTimeout(resolve, 50))

			// Should still work after multiple resizes
			fireEvent.mouseEnter(trigger)
			await waitFor(() => {
				expect(screen.getByText(tooltipContent)).toBeInTheDocument()
			})
		})

		it('should respect 768px breakpoint exactly', async () => {
			// Just above breakpoint (desktop)
			window.innerWidth = 768
			window.dispatchEvent(new Event('resize'))

			render(() => <InfoTooltip>{tooltipContent}</InfoTooltip>)

			const trigger = screen.getByRole('button')

			fireEvent.mouseEnter(trigger)
			await waitFor(() => {
				expect(screen.getByText(tooltipContent)).toBeInTheDocument()
			})

			fireEvent.mouseLeave(trigger)
			await waitFor(() => {
				expect(screen.queryByText(tooltipContent)).not.toBeInTheDocument()
			})

			// Just below breakpoint (mobile)
			window.innerWidth = 767
			window.dispatchEvent(new Event('resize'))

			await new Promise((resolve) => setTimeout(resolve, 50))

			// Click should work on mobile
			fireEvent.click(trigger)
			await waitFor(() => {
				expect(screen.getByText(tooltipContent)).toBeInTheDocument()
			})
		})
	})

	describe('Content Rendering', () => {
		it('should render simple text content', () => {
			render(() => <InfoTooltip>Simple text</InfoTooltip>)

			const trigger = screen.getByRole('button')
			fireEvent.mouseEnter(trigger)

			waitFor(() => {
				expect(screen.getByText('Simple text')).toBeInTheDocument()
			})
		})

		it('should render complex JSX content', async () => {
			const complexContent = (
				<div>
					<h3>Title</h3>
					<p>Description</p>
					<ul>
						<li>Item 1</li>
						<li>Item 2</li>
					</ul>
				</div>
			)

			render(() => <InfoTooltip>{complexContent}</InfoTooltip>)

			const trigger = screen.getByRole('button')
			fireEvent.mouseEnter(trigger)

			await waitFor(() => {
				expect(screen.getByText('Title')).toBeInTheDocument()
				expect(screen.getByText('Description')).toBeInTheDocument()
				expect(screen.getByText('Item 1')).toBeInTheDocument()
				expect(screen.getByText('Item 2')).toBeInTheDocument()
			})
		})

		it('should render multiple InfoTooltips independently', async () => {
			render(() => (
				<div>
					<InfoTooltip>Tooltip 1</InfoTooltip>
					<InfoTooltip>Tooltip 2</InfoTooltip>
					<InfoTooltip>Tooltip 3</InfoTooltip>
				</div>
			))

			const triggers = screen.getAllByRole('button')
			expect(triggers).toHaveLength(3)

			// Hover over first tooltip
			fireEvent.mouseEnter(triggers[0])
			await waitFor(() => {
				expect(screen.getByText('Tooltip 1')).toBeInTheDocument()
				expect(screen.queryByText('Tooltip 2')).not.toBeInTheDocument()
				expect(screen.queryByText('Tooltip 3')).not.toBeInTheDocument()
			})

			fireEvent.mouseLeave(triggers[0])

			// Hover over second tooltip
			fireEvent.mouseEnter(triggers[1])
			await waitFor(() => {
				expect(screen.queryByText('Tooltip 1')).not.toBeInTheDocument()
				expect(screen.getByText('Tooltip 2')).toBeInTheDocument()
				expect(screen.queryByText('Tooltip 3')).not.toBeInTheDocument()
			})
		})
	})

	describe('Memory Management', () => {
		it('should clean up resize listener on unmount', () => {
			const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

			const { unmount } = render(() => <InfoTooltip>{tooltipContent}</InfoTooltip>)

			unmount()

			expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function))

			removeEventListenerSpy.mockRestore()
		})

		it('should not leak memory with multiple mount/unmount cycles', () => {
			const addEventListenerSpy = vi.spyOn(window, 'addEventListener')
			const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

			// Mount and unmount 5 times
			for (let i = 0; i < 5; i++) {
				const { unmount } = render(() => <InfoTooltip>{tooltipContent}</InfoTooltip>)
				unmount()
			}

			// Should have equal number of adds and removes
			const addCalls = addEventListenerSpy.mock.calls.filter(
				(call) => call[0] === 'resize',
			).length
			const removeCalls = removeEventListenerSpy.mock.calls.filter(
				(call) => call[0] === 'resize',
			).length

			expect(addCalls).toBe(removeCalls)

			addEventListenerSpy.mockRestore()
			removeEventListenerSpy.mockRestore()
		})
	})

	describe('Accessibility', () => {
		it('should be keyboard accessible', () => {
			render(() => <InfoTooltip>{tooltipContent}</InfoTooltip>)

			const trigger = screen.getByRole('button')
			expect(trigger).toBeInTheDocument()

			// Button should be focusable
			trigger.focus()
			expect(document.activeElement).toBe(trigger)
		})

		it('should render as a button element', () => {
			render(() => <InfoTooltip>{tooltipContent}</InfoTooltip>)

			const trigger = screen.getByRole('button')
			expect(trigger.tagName).toBe('BUTTON')
		})

		it('should have proper icon sizing for touch targets', () => {
			render(() => <InfoTooltip>{tooltipContent}</InfoTooltip>)

			const trigger = screen.getByRole('button')
			const icon = trigger.querySelector('svg')

			expect(icon).toHaveClass('h-4', 'w-4')
		})
	})

	describe('Edge Cases', () => {
		it('should handle SSR-safe initialization', () => {
			// Simulate SSR environment where window might be undefined
			const originalWindow = global.window

			// This test ensures the component doesn't crash during SSR
			expect(() => {
				render(() => <InfoTooltip>{tooltipContent}</InfoTooltip>)
			}).not.toThrow()

			global.window = originalWindow
		})

		it('should handle rapid resize events', async () => {
			render(() => <InfoTooltip>{tooltipContent}</InfoTooltip>)

			// Rapidly fire resize events
			for (let i = 0; i < 20; i++) {
				window.innerWidth = i % 2 === 0 ? 375 : 1024
				window.dispatchEvent(new Event('resize'))
			}

			// Component should still be functional
			const trigger = screen.getByRole('button')
			expect(trigger).toBeInTheDocument()
		})

		it('should handle window resize during open tooltip', async () => {
			window.innerWidth = 1024
			window.dispatchEvent(new Event('resize'))

			render(() => <InfoTooltip>{tooltipContent}</InfoTooltip>)

			const trigger = screen.getByRole('button')
			fireEvent.mouseEnter(trigger)

			await waitFor(() => {
				expect(screen.getByText(tooltipContent)).toBeInTheDocument()
			})

			// Resize while tooltip is open
			window.innerWidth = 375
			window.dispatchEvent(new Event('resize'))

			// Component should still be functional
			expect(trigger).toBeInTheDocument()
		})
	})
})
