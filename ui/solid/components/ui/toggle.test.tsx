import { render, screen } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { Toggle, ToggleButton, ToggleDescription, ToggleErrorMessage, ToggleLabel } from './toggle'

describe('Toggle Component', () => {
	describe('Basic Rendering', () => {
		it('should render toggle button', () => {
			render(() => <ToggleButton>Toggle me</ToggleButton>)
			expect(screen.getByText('Toggle me')).toBeInTheDocument()
		})

		it('should render as button element', () => {
			render(() => <ToggleButton>Button</ToggleButton>)
			const button = screen.getByText('Button')
			expect(button.tagName).toBe('BUTTON')
		})

		it('should support pressed state', () => {
			const { container } = render(() => <ToggleButton pressed>Pressed</ToggleButton>)
			const button = container.querySelector('[data-pressed]')
			expect(button).toBeInTheDocument()
		})
	})

	describe('Variants', () => {
		it('should render default variant', () => {
			render(() => <ToggleButton variant="default">Default</ToggleButton>)
			const button = screen.getByText('Default')
			expect(button).toHaveClass('bg-transparent')
		})

		it('should render outline variant', () => {
			render(() => <ToggleButton variant="outline">Outline</ToggleButton>)
			const button = screen.getByText('Outline')
			expect(button).toHaveClass('border')
			expect(button).toHaveClass('border-input')
		})
	})

	describe('Sizes', () => {
		it('should render small size', () => {
			render(() => <ToggleButton size="sm">Small</ToggleButton>)
			const button = screen.getByText('Small')
			expect(button).toHaveClass('h-8')
			expect(button).toHaveClass('px-2')
		})

		it('should render default size', () => {
			render(() => <ToggleButton size="default">Default</ToggleButton>)
			const button = screen.getByText('Default')
			expect(button).toHaveClass('h-9')
			expect(button).toHaveClass('px-3')
		})

		it('should render large size', () => {
			render(() => <ToggleButton size="lg">Large</ToggleButton>)
			const button = screen.getByText('Large')
			expect(button).toHaveClass('h-10')
			expect(button).toHaveClass('px-3')
		})

		it('should use default size when not specified', () => {
			render(() => <ToggleButton>No Size</ToggleButton>)
			const button = screen.getByText('No Size')
			expect(button).toHaveClass('h-9')
		})
	})

	describe('Exported Subcomponents', () => {
		it('should export Toggle namespace', () => {
			expect(Toggle).toBeDefined()
			expect(Toggle.Label).toBeDefined()
			expect(Toggle.ErrorMessage).toBeDefined()
			expect(Toggle.Description).toBeDefined()
		})

		it('should export ToggleLabel', () => {
			render(() => <ToggleLabel>Label text</ToggleLabel>)
			expect(screen.getByText('Label text')).toBeInTheDocument()
		})

		it('should export ToggleErrorMessage', () => {
			expect(ToggleErrorMessage).toBeDefined()
		})

		it('should export ToggleDescription', () => {
			expect(ToggleDescription).toBeDefined()
		})

		it('Toggle namespace should work with dot notation', () => {
			render(() => (
				<div>
					<Toggle.Label>Toggle Label</Toggle.Label>
					<ToggleButton>Toggle</ToggleButton>
				</div>
			))
			expect(screen.getByText('Toggle Label')).toBeInTheDocument()
		})
	})

	describe('Custom Styling', () => {
		it('should accept custom className', () => {
			render(() => <ToggleButton class="custom-class">Custom</ToggleButton>)
			const button = screen.getByText('Custom')
			expect(button).toHaveClass('custom-class')
		})

		it('should merge custom className with variant classes', () => {
			render(() => (
				<ToggleButton class="my-class" variant="outline">
					Merged
				</ToggleButton>
			))
			const button = screen.getByText('Merged')
			expect(button).toHaveClass('my-class')
			expect(button).toHaveClass('border')
		})
	})

	describe('States', () => {
		it('should support disabled state', () => {
			render(() => <ToggleButton disabled>Disabled</ToggleButton>)
			const button = screen.getByText('Disabled')
			expect(button).toBeDisabled()
		})

		it('should have pressed styling when pressed', () => {
			render(() => <ToggleButton pressed>Pressed</ToggleButton>)
			const button = screen.getByText('Pressed')
			expect(button).toHaveClass('data-[pressed]:bg-accent')
		})
	})

	describe('Accessibility', () => {
		it('should have focus-visible styles', () => {
			render(() => <ToggleButton>Focus Test</ToggleButton>)
			const button = screen.getByText('Focus Test')
			expect(button).toHaveClass('focus-visible:outline-none')
			expect(button).toHaveClass('focus-visible:ring-[1.5px]')
		})

		it('should support aria-label', () => {
			render(() => <ToggleButton aria-label="Toggle bold">B</ToggleButton>)
			const button = screen.getByLabelText('Toggle bold')
			expect(button).toBeInTheDocument()
		})

		it('should have proper aria-pressed attribute', () => {
			const { container } = render(() => <ToggleButton pressed>Toggle</ToggleButton>)
			const button = container.querySelector('[aria-pressed]')
			expect(button).toBeInTheDocument()
		})
	})

	describe('HTML Attributes', () => {
		it('should accept data attributes', () => {
			render(() => (
				<ToggleButton data-testid="custom-toggle" data-value="test">
					Toggle
				</ToggleButton>
			))
			const button = screen.getByTestId('custom-toggle')
			expect(button).toHaveAttribute('data-value', 'test')
		})

		it('should support title attribute', () => {
			render(() => <ToggleButton title="Toggle option">T</ToggleButton>)
			const button = screen.getByText('T')
			expect(button).toHaveAttribute('title', 'Toggle option')
		})
	})

	describe('Type Safety', () => {
		it('should export ToggleButtonProps type', () => {
			const props: import('./toggle').ToggleButtonProps = {
				class: 'test',
				variant: 'outline',
				size: 'lg',
			}
			expect(props).toBeDefined()
		})
	})

	describe('CVA Integration', () => {
		it('should export toggleVariants helper', () => {
			const { toggleVariants } = require('./toggle')
			const classes = toggleVariants({ variant: 'outline', size: 'sm' })
			expect(classes).toContain('border')
			expect(classes).toContain('h-8')
		})
	})
})
