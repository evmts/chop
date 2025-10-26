import { render, screen } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { Badge, badgeVariants } from './badge'

describe('Badge Component', () => {
	describe('Basic Rendering', () => {
		it('should render badge with default variant', () => {
			render(() => <Badge>Default Badge</Badge>)
			const badge = screen.getByText('Default Badge')
			expect(badge).toBeInTheDocument()
			expect(badge.tagName).toBe('SPAN')
		})

		it('should render badge with custom text', () => {
			render(() => <Badge>Custom Text</Badge>)
			expect(screen.getByText('Custom Text')).toBeInTheDocument()
		})

		it('should render badge as span element instead of div', () => {
			render(() => <Badge>Span Element</Badge>)
			const badge = screen.getByText('Span Element')
			expect(badge.tagName).toBe('SPAN')
		})
	})

	describe('Variants', () => {
		it('should render default variant', () => {
			render(() => <Badge variant="default">Default</Badge>)
			const badge = screen.getByText('Default')
			expect(badge).toHaveClass('bg-primary')
			expect(badge).toHaveClass('text-primary-foreground')
		})

		it('should render secondary variant', () => {
			render(() => <Badge variant="secondary">Secondary</Badge>)
			const badge = screen.getByText('Secondary')
			expect(badge).toHaveClass('bg-secondary')
			expect(badge).toHaveClass('text-secondary-foreground')
		})

		it('should render destructive variant', () => {
			render(() => <Badge variant="destructive">Destructive</Badge>)
			const badge = screen.getByText('Destructive')
			expect(badge).toHaveClass('bg-destructive')
			expect(badge).toHaveClass('text-destructive-foreground')
		})

		it('should render outline variant', () => {
			render(() => <Badge variant="outline">Outline</Badge>)
			const badge = screen.getByText('Outline')
			expect(badge).toHaveClass('text-foreground')
		})
	})

	describe('Sizes', () => {
		it('should render small size', () => {
			render(() => <Badge size="sm">Small</Badge>)
			const badge = screen.getByText('Small')
			expect(badge).toHaveClass('px-2')
			expect(badge).toHaveClass('text-xs')
		})

		it('should render medium size (default)', () => {
			render(() => <Badge size="md">Medium</Badge>)
			const badge = screen.getByText('Medium')
			expect(badge).toHaveClass('px-2.5')
			expect(badge).toHaveClass('text-xs')
		})

		it('should render large size', () => {
			render(() => <Badge size="lg">Large</Badge>)
			const badge = screen.getByText('Large')
			expect(badge).toHaveClass('px-3')
			expect(badge).toHaveClass('text-sm')
		})

		it('should use medium size as default when size not specified', () => {
			render(() => <Badge>Default Size</Badge>)
			const badge = screen.getByText('Default Size')
			expect(badge).toHaveClass('px-2.5')
		})
	})

	describe('Custom Styling', () => {
		it('should accept custom className', () => {
			render(() => <Badge class="custom-class">Custom</Badge>)
			const badge = screen.getByText('Custom')
			expect(badge).toHaveClass('custom-class')
		})

		it('should merge custom className with default classes', () => {
			render(() => <Badge class="my-custom-class">Merged</Badge>)
			const badge = screen.getByText('Merged')
			expect(badge).toHaveClass('my-custom-class')
			expect(badge).toHaveClass('inline-flex')
		})
	})

	describe('HTML Attributes', () => {
		it('should accept and apply HTML attributes', () => {
			render(() => (
				<Badge data-testid="test-badge" title="Test Title">
					Attributes
				</Badge>
			))
			const badge = screen.getByTestId('test-badge')
			expect(badge).toHaveAttribute('title', 'Test Title')
		})

		it('should support aria attributes', () => {
			render(() => <Badge aria-label="Status badge">Status</Badge>)
			const badge = screen.getByLabelText('Status badge')
			expect(badge).toBeInTheDocument()
		})

		it('should support data attributes', () => {
			render(() => <Badge data-status="active">Active</Badge>)
			const badge = screen.getByText('Active')
			expect(badge).toHaveAttribute('data-status', 'active')
		})
	})

	describe('Badge Variants Helper', () => {
		it('should generate correct classes for default variant and size', () => {
			const classes = badgeVariants({ variant: 'default', size: 'md' })
			expect(classes).toContain('bg-primary')
			expect(classes).toContain('px-2.5')
		})

		it('should generate correct classes for different combinations', () => {
			const classes = badgeVariants({ variant: 'destructive', size: 'lg' })
			expect(classes).toContain('bg-destructive')
			expect(classes).toContain('px-3')
			expect(classes).toContain('text-sm')
		})
	})

	describe('Accessibility', () => {
		it('should have focus-visible styles', () => {
			render(() => <Badge>Focus Test</Badge>)
			const badge = screen.getByText('Focus Test')
			expect(badge).toHaveClass('focus-visible:outline-none')
			expect(badge).toHaveClass('focus-visible:ring-[1.5px]')
		})

		it('should be keyboard accessible with tabIndex', () => {
			render(() => <Badge tabIndex={0}>Keyboard</Badge>)
			const badge = screen.getByText('Keyboard')
			expect(badge).toHaveAttribute('tabIndex', '0')
		})
	})
})
