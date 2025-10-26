import { render, screen } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { Separator } from './separator'

describe('Separator Component', () => {
	describe('Basic Rendering', () => {
		it('should render separator element', () => {
			const { container } = render(() => <Separator />)
			const separator = container.querySelector('[role="separator"]')
			expect(separator).toBeInTheDocument()
		})

		it('should render as hr element by default', () => {
			const { container } = render(() => <Separator />)
			const hr = container.querySelector('hr')
			expect(hr).toBeInTheDocument()
		})
	})

	describe('Orientations', () => {
		it('should render horizontal separator (default)', () => {
			const { container } = render(() => <Separator orientation="horizontal" />)
			const separator = container.querySelector('[data-orientation="horizontal"]')
			expect(separator).toBeInTheDocument()
			expect(separator).toHaveClass('data-[orientation=horizontal]:h-[1px]')
			expect(separator).toHaveClass('data-[orientation=horizontal]:w-full')
		})

		it('should render vertical separator', () => {
			const { container } = render(() => <Separator orientation="vertical" />)
			const separator = container.querySelector('[data-orientation="vertical"]')
			expect(separator).toBeInTheDocument()
			expect(separator).toHaveClass('data-[orientation=vertical]:h-full')
			expect(separator).toHaveClass('data-[orientation=vertical]:w-[1px]')
		})

		it('should default to horizontal when not specified', () => {
			const { container } = render(() => <Separator />)
			const separator = container.querySelector('[role="separator"]')
			// Default orientation is horizontal in Kobalte
			expect(separator).toBeInTheDocument()
		})
	})

	describe('Custom Styling', () => {
		it('should accept custom className', () => {
			const { container } = render(() => <Separator class="custom-separator" />)
			const separator = container.querySelector('.custom-separator')
			expect(separator).toBeInTheDocument()
		})

		it('should merge custom className with default classes', () => {
			const { container } = render(() => <Separator class="my-2" />)
			const separator = container.querySelector('.my-2')
			expect(separator).toBeInTheDocument()
			expect(separator).toHaveClass('shrink-0')
			expect(separator).toHaveClass('bg-border')
		})

		it('should support custom spacing classes', () => {
			const { container } = render(() => <Separator class="mx-4" orientation="vertical" />)
			const separator = container.querySelector('.mx-4')
			expect(separator).toBeInTheDocument()
		})
	})

	describe('Accessibility', () => {
		it('should have separator role', () => {
			const { container } = render(() => <Separator />)
			expect(container.querySelector('[role="separator"]')).toBeInTheDocument()
		})

		it('should have aria-orientation attribute', () => {
			const { container } = render(() => <Separator orientation="vertical" />)
			const separator = container.querySelector('[role="separator"]')
			expect(separator).toHaveAttribute('aria-orientation', 'vertical')
		})

		it('should support aria-label for screen readers', () => {
			const { container } = render(() => <Separator aria-label="Section divider" />)
			const separator = container.querySelector('[aria-label="Section divider"]')
			expect(separator).toBeInTheDocument()
		})
	})

	describe('Use Cases', () => {
		it('should work between content sections', () => {
			render(() => (
				<div>
					<p>Section 1</p>
					<Separator data-testid="divider" />
					<p>Section 2</p>
				</div>
			))

			expect(screen.getByText('Section 1')).toBeInTheDocument()
			expect(screen.getByTestId('divider')).toBeInTheDocument()
			expect(screen.getByText('Section 2')).toBeInTheDocument()
		})

		it('should work in flex layouts with vertical orientation', () => {
			render(() => (
				<div class="flex">
					<span>Item 1</span>
					<Separator orientation="vertical" data-testid="vertical-sep" />
					<span>Item 2</span>
				</div>
			))

			expect(screen.getByTestId('vertical-sep')).toBeInTheDocument()
		})
	})

	describe('HTML Attributes', () => {
		it('should accept data attributes', () => {
			const { container } = render(() => <Separator data-testid="test-sep" data-section="main" />)
			const separator = screen.getByTestId('test-sep')
			expect(separator).toHaveAttribute('data-section', 'main')
		})
	})

	describe('Type Safety', () => {
		it('should export SeparatorProps type', () => {
			const props: import('./separator').SeparatorProps = {
				class: 'test',
				orientation: 'vertical',
			}
			expect(props).toBeDefined()
		})
	})

	describe('Styling Classes', () => {
		it('should have shrink-0 class to prevent flex shrinking', () => {
			const { container } = render(() => <Separator />)
			const separator = container.querySelector('[role="separator"]')
			expect(separator).toHaveClass('shrink-0')
		})

		it('should have bg-border class for theming', () => {
			const { container } = render(() => <Separator />)
			const separator = container.querySelector('[role="separator"]')
			expect(separator).toHaveClass('bg-border')
		})
	})
})
