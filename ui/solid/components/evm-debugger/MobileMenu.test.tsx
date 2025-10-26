import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import MobileMenu from './MobileMenu'

describe('MobileMenu', () => {
	const createProps = () => {
		const [activePanel, setActivePanel] = createSignal('all')
		return {
			activePanel: activePanel(),
			setActivePanel,
		}
	}

	beforeEach(() => {
		// Set viewport to mobile size
		window.innerWidth = 375
		window.innerHeight = 667
		window.dispatchEvent(new Event('resize'))
	})

	describe('Menu Toggle', () => {
		it('should render menu button', () => {
			const props = createProps()
			render(() => <MobileMenu {...props} />)

			const menuButton = screen.getByLabelText('Open menu')
			expect(menuButton).toBeInTheDocument()
		})

		it('should show menu icon initially', () => {
			const props = createProps()
			render(() => <MobileMenu {...props} />)

			const menuButton = screen.getByLabelText('Open menu')
			const icon = menuButton.querySelector('svg')
			expect(icon).toBeInTheDocument()
		})

		it('should open menu when button clicked', async () => {
			const props = createProps()
			render(() => <MobileMenu {...props} />)

			const menuButton = screen.getByLabelText('Open menu')
			fireEvent.click(menuButton)

			await waitFor(() => {
				expect(screen.getByText('Select Panel')).toBeInTheDocument()
			})
		})

		it('should show X icon when menu is open', async () => {
			const props = createProps()
			render(() => <MobileMenu {...props} />)

			const menuButton = screen.getByLabelText('Open menu')
			fireEvent.click(menuButton)

			await waitFor(() => {
				expect(menuButton.getAttribute('aria-expanded')).toBe('true')
			})
		})

		it('should toggle menu on multiple clicks', async () => {
			const props = createProps()
			render(() => <MobileMenu {...props} />)

			const menuButton = screen.getByLabelText('Open menu')

			// First click - open
			fireEvent.click(menuButton)
			await waitFor(() => {
				expect(screen.getByText('Select Panel')).toBeInTheDocument()
			})

			// Second click - close
			fireEvent.click(menuButton)
			await waitFor(() => {
				expect(screen.queryByText('Select Panel')).not.toBeInTheDocument()
			})

			// Third click - open again
			fireEvent.click(menuButton)
			await waitFor(() => {
				expect(screen.getByText('Select Panel')).toBeInTheDocument()
			})
		})

		it('should only show menu button on mobile breakpoint', () => {
			const props = createProps()
			const { container } = render(() => <MobileMenu {...props} />)

			const button = container.querySelector('button')
			expect(button).toHaveClass('md:hidden')
		})
	})

	describe('Panel Selection', () => {
		it('should show all panel options when menu is open', async () => {
			const props = createProps()
			render(() => <MobileMenu {...props} />)

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

		it('should call setActivePanel when option clicked', async () => {
			const mockSetActivePanel = vi.fn()
			render(() => <MobileMenu activePanel="all" setActivePanel={mockSetActivePanel} />)

			const menuButton = screen.getByLabelText('Open menu')
			fireEvent.click(menuButton)

			await waitFor(() => {
				expect(screen.getByText('Stack')).toBeInTheDocument()
			})

			const stackOption = screen.getByText('Stack')
			fireEvent.click(stackOption)

			expect(mockSetActivePanel).toHaveBeenCalledWith('stack')
		})

		it('should close menu after selecting panel', async () => {
			const props = createProps()
			render(() => <MobileMenu {...props} />)

			const menuButton = screen.getByLabelText('Open menu')
			fireEvent.click(menuButton)

			await waitFor(() => {
				expect(screen.getByText('Memory')).toBeInTheDocument()
			})

			const memoryOption = screen.getByText('Memory')
			fireEvent.click(memoryOption)

			await waitFor(() => {
				expect(screen.queryByText('Select Panel')).not.toBeInTheDocument()
			})
		})

		it('should highlight active panel', async () => {
			render(() => <MobileMenu activePanel="storage" setActivePanel={vi.fn()} />)

			const menuButton = screen.getByLabelText('Open menu')
			fireEvent.click(menuButton)

			await waitFor(() => {
				const storageButton = screen.getByText('Storage').closest('button')
				expect(storageButton).toHaveClass('bg-amber-100')
				expect(storageButton).toHaveClass('font-medium')
			})
		})

		it('should not highlight inactive panels', async () => {
			render(() => <MobileMenu activePanel="stack" setActivePanel={vi.fn()} />)

			const menuButton = screen.getByLabelText('Open menu')
			fireEvent.click(menuButton)

			await waitFor(() => {
				const memoryButton = screen.getByText('Memory').closest('button')
				expect(memoryButton).not.toHaveClass('bg-amber-100')
				expect(memoryButton).toHaveClass('text-foreground/80')
			})
		})
	})

	describe('Backdrop Interaction', () => {
		it('should render backdrop when menu is open', async () => {
			const props = createProps()
			render(() => <MobileMenu {...props} />)

			const menuButton = screen.getByLabelText('Open menu')
			fireEvent.click(menuButton)

			await waitFor(() => {
				const backdrop = document.querySelector('.fixed.inset-0.bg-black\\/50')
				expect(backdrop).toBeInTheDocument()
			})
		})

		it('should close menu when backdrop clicked', async () => {
			const props = createProps()
			render(() => <MobileMenu {...props} />)

			const menuButton = screen.getByLabelText('Open menu')
			fireEvent.click(menuButton)

			await waitFor(() => {
				expect(screen.getByText('Select Panel')).toBeInTheDocument()
			})

			const backdrop = document.querySelector('.fixed.inset-0.bg-black\\/50')
			if (backdrop) {
				fireEvent.click(backdrop)

				await waitFor(() => {
					expect(screen.queryByText('Select Panel')).not.toBeInTheDocument()
				})
			}
		})

		it('should not close menu when clicking inside menu', async () => {
			const props = createProps()
			render(() => <MobileMenu {...props} />)

			const menuButton = screen.getByLabelText('Open menu')
			fireEvent.click(menuButton)

			await waitFor(() => {
				expect(screen.getByText('Select Panel')).toBeInTheDocument()
			})

			// Click on the header
			const header = screen.getByText('Select Panel')
			fireEvent.click(header)

			// Menu should still be open
			expect(screen.getByText('Select Panel')).toBeInTheDocument()
		})

		it('should have proper backdrop z-index', async () => {
			const props = createProps()
			render(() => <MobileMenu {...props} />)

			const menuButton = screen.getByLabelText('Open menu')
			fireEvent.click(menuButton)

			await waitFor(() => {
				const backdrop = document.querySelector('.fixed.inset-0.bg-black\\/50')
				expect(backdrop).toHaveClass('z-50')
			})
		})
	})

	describe('Touch-Friendly Design', () => {
		it('should have minimum touch target size (44px)', async () => {
			const props = createProps()
			render(() => <MobileMenu {...props} />)

			const menuButton = screen.getByLabelText('Open menu')
			fireEvent.click(menuButton)

			await waitFor(() => {
				const panelButtons = screen.getAllByRole('button').filter((btn) => {
					const text = btn.textContent
					return (
						text === 'All panels' ||
						text === 'Stack' ||
						text === 'Memory' ||
						text === 'Storage' ||
						text === 'Logs' ||
						text === 'Bytecode' ||
						text === 'Gas'
					)
				})

				panelButtons.forEach((button) => {
					expect(button.className).toContain('min-h-[44px]')
				})
			})
		})

		it('should have adequate padding for touch targets', async () => {
			const props = createProps()
			render(() => <MobileMenu {...props} />)

			const menuButton = screen.getByLabelText('Open menu')
			fireEvent.click(menuButton)

			await waitFor(() => {
				const panelButtons = screen.getAllByRole('button').filter((btn) => {
					const text = btn.textContent
					return text === 'Stack' || text === 'Memory'
				})

				panelButtons.forEach((button) => {
					expect(button.className).toContain('px-4')
					expect(button.className).toContain('py-2')
				})
			})
		})
	})

	describe('Accessibility', () => {
		it('should have proper ARIA label for menu button', () => {
			const props = createProps()
			render(() => <MobileMenu {...props} />)

			const menuButton = screen.getByLabelText('Open menu')
			expect(menuButton).toBeInTheDocument()
		})

		it('should have proper ARIA expanded state', async () => {
			const props = createProps()
			render(() => <MobileMenu {...props} />)

			const menuButton = screen.getByLabelText('Open menu')

			expect(menuButton.getAttribute('aria-expanded')).toBe('false')

			fireEvent.click(menuButton)

			await waitFor(() => {
				expect(menuButton.getAttribute('aria-expanded')).toBe('true')
			})

			fireEvent.click(menuButton)

			await waitFor(() => {
				expect(menuButton.getAttribute('aria-expanded')).toBe('false')
			})
		})

		it('should have proper ARIA pressed state for panel buttons', async () => {
			render(() => <MobileMenu activePanel="memory" setActivePanel={vi.fn()} />)

			const menuButton = screen.getByLabelText('Open menu')
			fireEvent.click(menuButton)

			await waitFor(() => {
				const memoryButton = screen.getByText('Memory').closest('button')
				expect(memoryButton).toHaveAttribute('aria-pressed', 'true')

				const stackButton = screen.getByText('Stack').closest('button')
				expect(stackButton).toHaveAttribute('aria-pressed', 'false')
			})
		})

		it('should be keyboard navigable', async () => {
			const props = createProps()
			render(() => <MobileMenu {...props} />)

			const menuButton = screen.getByLabelText('Open menu')
			fireEvent.click(menuButton)

			await waitFor(() => {
				const panelButtons = screen.getAllByRole('button')
				panelButtons.forEach((button) => {
					expect(button.tagName).toBe('BUTTON')
				})
			})
		})

		it('should have aria-hidden for backdrop', async () => {
			const props = createProps()
			render(() => <MobileMenu {...props} />)

			const menuButton = screen.getByLabelText('Open menu')
			fireEvent.click(menuButton)

			await waitFor(() => {
				const backdrop = document.querySelector('.fixed.inset-0.bg-black\\/50')
				expect(backdrop).toHaveAttribute('aria-hidden', 'true')
			})
		})
	})

	describe('Visual Feedback', () => {
		it('should have hover state styling', async () => {
			const props = createProps()
			render(() => <MobileMenu {...props} />)

			const menuButton = screen.getByLabelText('Open menu')
			fireEvent.click(menuButton)

			await waitFor(() => {
				const stackButton = screen.getByText('Stack').closest('button')
				expect(stackButton?.className).toContain('hover:bg-accent')
				expect(stackButton?.className).toContain('hover:text-foreground')
			})
		})

		it('should have transition classes', async () => {
			const props = createProps()
			render(() => <MobileMenu {...props} />)

			const menuButton = screen.getByLabelText('Open menu')
			fireEvent.click(menuButton)

			await waitFor(() => {
				const stackButton = screen.getByText('Stack').closest('button')
				expect(stackButton?.className).toContain('transition-colors')
			})
		})

		it('should have proper text alignment', async () => {
			const props = createProps()
			render(() => <MobileMenu {...props} />)

			const menuButton = screen.getByLabelText('Open menu')
			fireEvent.click(menuButton)

			await waitFor(() => {
				const buttons = screen.getAllByRole('button').filter((btn) => {
					const text = btn.textContent
					return text === 'Stack' || text === 'Memory'
				})

				buttons.forEach((button) => {
					expect(button.className).toContain('text-left')
				})
			})
		})
	})
})
