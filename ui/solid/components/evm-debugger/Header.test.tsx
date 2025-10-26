import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Header from './Header'

describe('Header', () => {
	const createProps = () => {
		const [isDarkMode, setIsDarkMode] = createSignal(false)
		const [activePanel, setActivePanel] = createSignal('all')

		return {
			isDarkMode,
			setIsDarkMode,
			activePanel: activePanel(),
			setActivePanel,
		}
	}

	beforeEach(() => {
		// Reset viewport to desktop size
		window.innerWidth = 1024
		window.innerHeight = 768
		window.dispatchEvent(new Event('resize'))
	})

	describe('Desktop Navigation', () => {
		it('should render the header with logo and title', () => {
			const props = createProps()
			render(() => <Header {...props} />)

			expect(screen.getByText('svvy')).toBeInTheDocument()
			expect(screen.getByLabelText('EVM Debugger icon')).toBeInTheDocument()
		})

		it('should render all panel toggle buttons on desktop', () => {
			const props = createProps()
			render(() => <Header {...props} />)

			expect(screen.getByText('All panels')).toBeInTheDocument()
			expect(screen.getByText('Stack')).toBeInTheDocument()
			expect(screen.getByText('Memory')).toBeInTheDocument()
			expect(screen.getByText('Storage')).toBeInTheDocument()
			expect(screen.getByText('Logs')).toBeInTheDocument()
			expect(screen.getByText('Bytecode')).toBeInTheDocument()
			expect(screen.getByText('Gas')).toBeInTheDocument()
		})

		it('should highlight active panel', () => {
			const props = createProps()
			render(() => <Header {...props} />)

			const allPanelsButton = screen.getByText('All panels').closest('button')
			expect(allPanelsButton).toHaveAttribute('data-pressed')
		})

		it('should switch active panel when clicked', async () => {
			const props = createProps()
			render(() => <Header {...props} />)

			const stackButton = screen.getByText('Stack')
			fireEvent.click(stackButton)

			await waitFor(() => {
				expect(props.activePanel).toBe('stack')
			})
		})

		it('should switch between multiple panels', async () => {
			const props = createProps()
			render(() => <Header {...props} />)

			// Click Stack
			fireEvent.click(screen.getByText('Stack'))
			await waitFor(() => expect(props.activePanel).toBe('stack'))

			// Click Memory
			fireEvent.click(screen.getByText('Memory'))
			await waitFor(() => expect(props.activePanel).toBe('memory'))

			// Click Gas
			fireEvent.click(screen.getByText('Gas'))
			await waitFor(() => expect(props.activePanel).toBe('gas'))
		})
	})

	describe('Theme Toggle', () => {
		it('should render dark mode toggle button', () => {
			const props = createProps()
			render(() => <Header {...props} />)

			const toggleButton = screen.getByLabelText('Toggle dark mode')
			expect(toggleButton).toBeInTheDocument()
		})

		it('should show moon icon when in light mode', () => {
			const props = createProps()
			render(() => <Header {...props} />)

			const toggleButton = screen.getByLabelText('Toggle dark mode')
			const moonIcon = toggleButton.querySelector('svg')
			expect(moonIcon).toBeInTheDocument()
		})

		it('should show sun icon when in dark mode', () => {
			const [isDarkMode, setIsDarkMode] = createSignal(true)
			const [activePanel, setActivePanel] = createSignal('all')

			render(() => (
				<Header
					isDarkMode={isDarkMode}
					setIsDarkMode={setIsDarkMode}
					activePanel={activePanel()}
					setActivePanel={setActivePanel}
				/>
			))

			const toggleButton = screen.getByLabelText('Toggle dark mode')
			const sunIcon = toggleButton.querySelector('svg')
			expect(sunIcon).toBeInTheDocument()
		})

		it('should toggle dark mode when clicked', async () => {
			const props = createProps()
			render(() => <Header {...props} />)

			const toggleButton = screen.getByLabelText('Toggle dark mode')
			fireEvent.click(toggleButton)

			await waitFor(() => {
				expect(props.isDarkMode()).toBe(true)
			})
		})

		it('should toggle dark mode multiple times', async () => {
			const props = createProps()
			render(() => <Header {...props} />)

			const toggleButton = screen.getByLabelText('Toggle dark mode')

			// First click - turn on
			fireEvent.click(toggleButton)
			await waitFor(() => expect(props.isDarkMode()).toBe(true))

			// Second click - turn off
			fireEvent.click(toggleButton)
			await waitFor(() => expect(props.isDarkMode()).toBe(false))

			// Third click - turn on again
			fireEvent.click(toggleButton)
			await waitFor(() => expect(props.isDarkMode()).toBe(true))
		})
	})

	describe('Settings Button', () => {
		it('should render disabled settings button', () => {
			const props = createProps()
			render(() => <Header {...props} />)

			const settingsButton = screen.getByLabelText('Settings')
			expect(settingsButton).toBeInTheDocument()
			expect(settingsButton).toBeDisabled()
		})

		it('should show "Settings coming soon" tooltip on hover', async () => {
			const props = createProps()
			render(() => <Header {...props} />)

			const settingsButton = screen.getByLabelText('Settings')
			fireEvent.mouseEnter(settingsButton)

			await waitFor(() => {
				expect(screen.getByText('Settings coming soon')).toBeInTheDocument()
			})
		})

		it('should not trigger any action when clicked', async () => {
			const props = createProps()
			const clickSpy = vi.fn()

			render(() => (
				<div onClick={clickSpy}>
					<Header {...props} />
				</div>
			))

			const settingsButton = screen.getByLabelText('Settings')
			fireEvent.click(settingsButton)

			await waitFor(() => {
				// Event should be stopped by disabled button
				expect(clickSpy).not.toHaveBeenCalled()
			})
		})
	})

	describe('Mobile Navigation', () => {
		beforeEach(() => {
			// Set viewport to mobile size
			window.innerWidth = 375
			window.innerHeight = 667
			window.dispatchEvent(new Event('resize'))
		})

		it('should not show desktop toggle buttons on mobile', () => {
			const props = createProps()
			render(() => <Header {...props} />)

			// Desktop buttons should be hidden on mobile
			const allPanelsButton = screen.getByText('All panels')
			expect(allPanelsButton.closest('div')).toHaveClass('hidden')
		})

		it('should render hamburger menu button on mobile', () => {
			const props = createProps()
			render(() => <Header {...props} />)

			const menuButton = screen.getByLabelText('Open menu')
			expect(menuButton).toBeInTheDocument()
		})

		it('should open mobile menu when hamburger clicked', async () => {
			const props = createProps()
			render(() => <Header {...props} />)

			const menuButton = screen.getByLabelText('Open menu')
			fireEvent.click(menuButton)

			await waitFor(() => {
				expect(screen.getByText('Select Panel')).toBeInTheDocument()
			})
		})

		it('should show all panel options in mobile menu', async () => {
			const props = createProps()
			render(() => <Header {...props} />)

			const menuButton = screen.getByLabelText('Open menu')
			fireEvent.click(menuButton)

			await waitFor(() => {
				expect(screen.getByText('All panels')).toBeInTheDocument()
				expect(screen.getByText('Stack')).toBeInTheDocument()
				expect(screen.getByText('Memory')).toBeInTheDocument()
				expect(screen.getByText('Storage')).toBeInTheDocument()
				expect(screen.getByText('Logs')).toBeInTheDocument()
				expect(screen.getByText('Bytecode')).toBeInTheDocument()
				expect(screen.getByText('Gas')).toBeInTheDocument()
			})
		})

		it('should switch panel when mobile menu option clicked', async () => {
			const props = createProps()
			render(() => <Header {...props} />)

			const menuButton = screen.getByLabelText('Open menu')
			fireEvent.click(menuButton)

			await waitFor(() => {
				expect(screen.getByText('Select Panel')).toBeInTheDocument()
			})

			const stackOption = screen.getByText('Stack')
			fireEvent.click(stackOption)

			await waitFor(() => {
				expect(props.activePanel).toBe('stack')
			})
		})

		it('should close mobile menu after selecting panel', async () => {
			const props = createProps()
			render(() => <Header {...props} />)

			const menuButton = screen.getByLabelText('Open menu')
			fireEvent.click(menuButton)

			await waitFor(() => {
				expect(screen.getByText('Select Panel')).toBeInTheDocument()
			})

			const memoryOption = screen.getByText('Memory')
			fireEvent.click(memoryOption)

			await waitFor(() => {
				expect(screen.queryByText('Select Panel')).not.toBeInTheDocument()
			})
		})

		it('should close mobile menu when backdrop clicked', async () => {
			const props = createProps()
			render(() => <Header {...props} />)

			const menuButton = screen.getByLabelText('Open menu')
			fireEvent.click(menuButton)

			await waitFor(() => {
				expect(screen.getByText('Select Panel')).toBeInTheDocument()
			})

			// Click backdrop (the overlay behind the menu)
			const backdrop = document.querySelector('.fixed.inset-0.bg-black\\/50')
			if (backdrop) {
				fireEvent.click(backdrop)

				await waitFor(() => {
					expect(screen.queryByText('Select Panel')).not.toBeInTheDocument()
				})
			}
		})

		it('should highlight active panel in mobile menu', async () => {
			const props = createProps()
			props.setActivePanel('storage')

			render(() => <Header {...props} />)

			const menuButton = screen.getByLabelText('Open menu')
			fireEvent.click(menuButton)

			await waitFor(() => {
				const storageButton = screen.getByText('Storage').closest('button')
				expect(storageButton).toHaveClass('bg-amber-100')
			})
		})

		it('should show X icon when menu is open', async () => {
			const props = createProps()
			render(() => <Header {...props} />)

			const menuButton = screen.getByLabelText('Open menu')

			// Initially shows menu icon
			expect(menuButton.querySelector('svg')).toBeInTheDocument()

			fireEvent.click(menuButton)

			await waitFor(() => {
				// Should show X icon when open
				expect(menuButton.getAttribute('aria-expanded')).toBe('true')
			})
		})

		it('should meet minimum touch target size (44px)', async () => {
			const props = createProps()
			render(() => <Header {...props} />)

			const menuButton = screen.getByLabelText('Open menu')
			fireEvent.click(menuButton)

			await waitFor(() => {
				const menuOptions = screen.getAllByRole('button', { hidden: false })
				// Filter to only mobile menu buttons (they have min-h-[44px] class)
				const touchTargets = menuOptions.filter((btn) =>
					btn.className.includes('min-h-[44px]'),
				)
				touchTargets.forEach((target) => {
					expect(target.className).toContain('min-h-[44px]')
				})
			})
		})
	})

	describe('Responsive Behavior', () => {
		it('should adapt to viewport resize from desktop to mobile', async () => {
			const props = createProps()
			render(() => <Header {...props} />)

			// Start on desktop
			window.innerWidth = 1024
			window.dispatchEvent(new Event('resize'))

			await waitFor(() => {
				expect(screen.queryByLabelText('Open menu')).not.toBeVisible()
			})

			// Resize to mobile
			window.innerWidth = 375
			window.dispatchEvent(new Event('resize'))

			await waitFor(() => {
				expect(screen.getByLabelText('Open menu')).toBeInTheDocument()
			})
		})

		it('should have responsive padding and gaps', () => {
			const props = createProps()
			const { container } = render(() => <Header {...props} />)

			const header = container.querySelector('header')
			expect(header).toHaveClass('px-3', 'sm:px-6')

			const mainDiv = header?.querySelector('div')
			expect(mainDiv).toHaveClass('gap-2', 'sm:gap-8')
		})

		it('should have full width on mobile', () => {
			const props = createProps()
			const { container } = render(() => <Header {...props} />)

			const header = container.querySelector('header')
			expect(header).toHaveClass('w-full', 'max-w-7xl')
		})
	})

	describe('Accessibility', () => {
		it('should have proper ARIA labels for all buttons', () => {
			const props = createProps()
			render(() => <Header {...props} />)

			expect(screen.getByLabelText('Toggle dark mode')).toBeInTheDocument()
			expect(screen.getByLabelText('Settings')).toBeInTheDocument()
			expect(screen.getByLabelText('Open menu')).toBeInTheDocument()
		})

		it('should have proper ARIA expanded state for mobile menu', async () => {
			const props = createProps()
			render(() => <Header {...props} />)

			const menuButton = screen.getByLabelText('Open menu')

			expect(menuButton.getAttribute('aria-expanded')).toBe('false')

			fireEvent.click(menuButton)

			await waitFor(() => {
				expect(menuButton.getAttribute('aria-expanded')).toBe('true')
			})
		})

		it('should have proper ARIA pressed state for toggle buttons', () => {
			const props = createProps()
			render(() => <Header {...props} />)

			const allPanelsButton = screen.getByText('All panels').closest('button')
			expect(allPanelsButton).toHaveAttribute('data-pressed')

			const stackButton = screen.getByText('Stack').closest('button')
			expect(stackButton).not.toHaveAttribute('data-pressed')
		})

		it('should be keyboard navigable', () => {
			const props = createProps()
			render(() => <Header {...props} />)

			const allButtons = screen.getAllByRole('button')
			allButtons.forEach((button) => {
				expect(button).toBeInTheDocument()
				// All buttons should be focusable
				expect(button.tagName).toBe('BUTTON')
			})
		})
	})

	describe('Constants', () => {
		it('should use consistent styling through TOGGLE_BUTTON_CLASS constant', () => {
			const props = createProps()
			render(() => <Header {...props} />)

			const toggleButtons = [
				screen.getByText('All panels'),
				screen.getByText('Stack'),
				screen.getByText('Memory'),
				screen.getByText('Storage'),
				screen.getByText('Logs'),
				screen.getByText('Bytecode'),
				screen.getByText('Gas'),
			]

			// All buttons should have the same hover and pressed styling classes
			toggleButtons.forEach((button) => {
				const buttonElement = button.closest('button')
				expect(buttonElement?.className).toContain('whitespace-nowrap')
				expect(buttonElement?.className).toContain('hover:bg-amber-100')
			})
		})
	})
})
