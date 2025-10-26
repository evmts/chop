import { render, screen, waitFor } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button, buttonVariants } from './button'

describe('Button Component', () => {
	describe('Basic Rendering', () => {
		it('should render button with text', () => {
			render(() => <Button>Click me</Button>)
			expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
		})

		it('should render as button element by default', () => {
			render(() => <Button>Button</Button>)
			const button = screen.getByRole('button')
			expect(button.tagName).toBe('BUTTON')
		})

		it('should render children correctly', () => {
			render(() => (
				<Button>
					<span>Icon</span>
					<span>Text</span>
				</Button>
			))
			expect(screen.getByText('Icon')).toBeInTheDocument()
			expect(screen.getByText('Text')).toBeInTheDocument()
		})
	})

	describe('Variants', () => {
		it('should render default variant', () => {
			render(() => <Button variant="default">Default</Button>)
			const button = screen.getByRole('button')
			expect(button).toHaveClass('bg-primary')
			expect(button).toHaveClass('text-primary-foreground')
		})

		it('should render destructive variant', () => {
			render(() => <Button variant="destructive">Destructive</Button>)
			const button = screen.getByRole('button')
			expect(button).toHaveClass('bg-destructive')
			expect(button).toHaveClass('text-destructive-foreground')
		})

		it('should render outline variant', () => {
			render(() => <Button variant="outline">Outline</Button>)
			const button = screen.getByRole('button')
			expect(button).toHaveClass('border')
			expect(button).toHaveClass('bg-background')
		})

		it('should render secondary variant', () => {
			render(() => <Button variant="secondary">Secondary</Button>)
			const button = screen.getByRole('button')
			expect(button).toHaveClass('bg-secondary')
		})

		it('should render ghost variant', () => {
			render(() => <Button variant="ghost">Ghost</Button>)
			const button = screen.getByRole('button')
			expect(button).toHaveClass('hover:bg-accent')
		})

		it('should render link variant', () => {
			render(() => <Button variant="link">Link</Button>)
			const button = screen.getByRole('button')
			expect(button).toHaveClass('text-primary')
			expect(button).toHaveClass('underline-offset-4')
		})
	})

	describe('Sizes', () => {
		it('should render default size', () => {
			render(() => <Button size="default">Default</Button>)
			const button = screen.getByRole('button')
			expect(button).toHaveClass('h-9')
			expect(button).toHaveClass('px-4')
		})

		it('should render small size', () => {
			render(() => <Button size="sm">Small</Button>)
			const button = screen.getByRole('button')
			expect(button).toHaveClass('h-8')
			expect(button).toHaveClass('text-xs')
		})

		it('should render large size', () => {
			render(() => <Button size="lg">Large</Button>)
			const button = screen.getByRole('button')
			expect(button).toHaveClass('h-10')
			expect(button).toHaveClass('px-8')
		})

		it('should render icon size', () => {
			render(() => <Button size="icon">Icon</Button>)
			const button = screen.getByRole('button')
			expect(button).toHaveClass('h-9')
			expect(button).toHaveClass('w-9')
		})
	})

	describe('Loading State', () => {
		it('should show loading spinner when loading prop is true', () => {
			render(() => <Button loading>Loading</Button>)
			const button = screen.getByRole('button')
			// Look for the Loader2 icon (animated spinner)
			const spinner = button.querySelector('.animate-spin')
			expect(spinner).toBeInTheDocument()
		})

		it('should disable button when loading', () => {
			render(() => <Button loading>Loading</Button>)
			const button = screen.getByRole('button')
			expect(button).toBeDisabled()
		})

		it('should not show spinner when loading is false', () => {
			render(() => <Button loading={false}>Not Loading</Button>)
			const button = screen.getByRole('button')
			const spinner = button.querySelector('.animate-spin')
			expect(spinner).not.toBeInTheDocument()
		})

		it('should show both spinner and text when loading', () => {
			render(() => <Button loading>Processing...</Button>)
			expect(screen.getByText('Processing...')).toBeInTheDocument()
			const button = screen.getByRole('button')
			const spinner = button.querySelector('.animate-spin')
			expect(spinner).toBeInTheDocument()
		})
	})

	describe('Disabled State', () => {
		it('should disable button with disabled prop', () => {
			render(() => <Button disabled>Disabled</Button>)
			const button = screen.getByRole('button')
			expect(button).toBeDisabled()
		})

		it('should have disabled styles', () => {
			render(() => <Button disabled>Disabled</Button>)
			const button = screen.getByRole('button')
			expect(button).toHaveClass('disabled:pointer-events-none')
			expect(button).toHaveClass('disabled:opacity-50')
		})

		it('should be disabled when both loading and disabled are true', () => {
			render(() => (
				<Button loading disabled>
					Both
				</Button>
			))
			const button = screen.getByRole('button')
			expect(button).toBeDisabled()
		})
	})

	describe('Click Events', () => {
		it('should call onClick handler when clicked', async () => {
			const user = userEvent.setup()
			const onClick = vi.fn()
			render(() => <Button onClick={onClick}>Click me</Button>)

			const button = screen.getByRole('button')
			await user.click(button)

			expect(onClick).toHaveBeenCalledTimes(1)
		})

		it('should not call onClick when disabled', async () => {
			const user = userEvent.setup()
			const onClick = vi.fn()
			render(() => (
				<Button onClick={onClick} disabled>
					Disabled
				</Button>
			))

			const button = screen.getByRole('button')
			await user.click(button)

			expect(onClick).not.toHaveBeenCalled()
		})

		it('should not call onClick when loading', async () => {
			const user = userEvent.setup()
			const onClick = vi.fn()
			render(() => (
				<Button onClick={onClick} loading>
					Loading
				</Button>
			))

			const button = screen.getByRole('button')
			await user.click(button)

			expect(onClick).not.toHaveBeenCalled()
		})
	})

	describe('Custom Styling', () => {
		it('should accept custom className', () => {
			render(() => <Button class="custom-class">Custom</Button>)
			const button = screen.getByRole('button')
			expect(button).toHaveClass('custom-class')
		})

		it('should merge custom className with variant classes', () => {
			render(() => <Button class="my-custom-class">Merged</Button>)
			const button = screen.getByRole('button')
			expect(button).toHaveClass('my-custom-class')
			expect(button).toHaveClass('inline-flex')
		})
	})

	describe('Accessibility', () => {
		it('should have correct ARIA attributes', () => {
			render(() => <Button aria-label="Submit form">Submit</Button>)
			expect(screen.getByLabelText('Submit form')).toBeInTheDocument()
		})

		it('should support aria-disabled', () => {
			render(() => (
				<Button disabled aria-disabled="true">
					Disabled
				</Button>
			))
			const button = screen.getByRole('button')
			expect(button).toHaveAttribute('aria-disabled')
		})

		it('should have focus-visible styles', () => {
			render(() => <Button>Focus</Button>)
			const button = screen.getByRole('button')
			expect(button).toHaveClass('focus-visible:outline-none')
			expect(button).toHaveClass('focus-visible:ring-[1.5px]')
		})

		it('should be keyboard accessible', async () => {
			const user = userEvent.setup()
			const onClick = vi.fn()
			render(() => <Button onClick={onClick}>Keyboard</Button>)

			const button = screen.getByRole('button')
			button.focus()
			await user.keyboard('{Enter}')

			expect(onClick).toHaveBeenCalled()
		})
	})

	describe('Button Variants Helper', () => {
		it('should generate correct classes for default variant and size', () => {
			const classes = buttonVariants({ variant: 'default', size: 'default' })
			expect(classes).toContain('bg-primary')
			expect(classes).toContain('h-9')
		})

		it('should generate correct classes for different combinations', () => {
			const classes = buttonVariants({ variant: 'destructive', size: 'lg' })
			expect(classes).toContain('bg-destructive')
			expect(classes).toContain('h-10')
		})
	})

	describe('Polymorphic Behavior', () => {
		it('should accept HTML button attributes', () => {
			render(() => (
				<Button type="submit" name="submit-btn">
					Submit
				</Button>
			))
			const button = screen.getByRole('button')
			expect(button).toHaveAttribute('type', 'submit')
			expect(button).toHaveAttribute('name', 'submit-btn')
		})

		it('should support data attributes', () => {
			render(() => <Button data-testid="test-button">Test</Button>)
			expect(screen.getByTestId('test-button')).toBeInTheDocument()
		})
	})
})
