import { render, screen } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { Skeleton } from './skeleton'

describe('Skeleton Component', () => {
	describe('Basic Rendering', () => {
		it('should render skeleton element', () => {
			const { container } = render(() => <Skeleton />)
			const skeleton = container.querySelector('div')
			expect(skeleton).toBeInTheDocument()
		})

		it('should render as div element', () => {
			const { container } = render(() => <Skeleton data-testid="skeleton" />)
			const skeleton = screen.getByTestId('skeleton')
			expect(skeleton.tagName).toBe('DIV')
		})

		it('should have default classes', () => {
			const { container } = render(() => <Skeleton />)
			const skeleton = container.querySelector('div')
			expect(skeleton).toHaveClass('rounded-sm')
			expect(skeleton).toHaveClass('bg-primary/10')
		})
	})

	describe('Animation Variants', () => {
		it('should render pulse animation (default)', () => {
			const { container } = render(() => <Skeleton animation="pulse" />)
			const skeleton = container.querySelector('.animate-pulse')
			expect(skeleton).toBeInTheDocument()
		})

		it('should render wave animation', () => {
			const { container } = render(() => <Skeleton animation="wave" />)
			const skeleton = container.querySelector('.animate-shimmer')
			expect(skeleton).toBeInTheDocument()
		})

		it('should render without animation', () => {
			const { container } = render(() => <Skeleton animation="none" />)
			const skeleton = container.querySelector('div')
			expect(skeleton).not.toHaveClass('animate-pulse')
			expect(skeleton).not.toHaveClass('animate-shimmer')
		})

		it('should default to pulse animation when not specified', () => {
			const { container } = render(() => <Skeleton />)
			const skeleton = container.querySelector('.animate-pulse')
			expect(skeleton).toBeInTheDocument()
		})
	})

	describe('Accessibility', () => {
		it('CRITICAL: should have aria-hidden attribute', () => {
			const { container } = render(() => <Skeleton />)
			const skeleton = container.querySelector('div')
			expect(skeleton).toHaveAttribute('aria-hidden', 'true')
		})

		it('should not be announced to screen readers', () => {
			render(() => <Skeleton data-testid="skeleton" />)
			const skeleton = screen.getByTestId('skeleton')
			expect(skeleton).toHaveAttribute('aria-hidden', 'true')
		})
	})

	describe('Custom Styling', () => {
		it('should accept custom className', () => {
			render(() => <Skeleton class="custom-skeleton" />)
			const skeleton = document.querySelector('.custom-skeleton')
			expect(skeleton).toBeInTheDocument()
		})

		it('should merge custom className with default classes', () => {
			render(() => <Skeleton class="h-12 w-full" />)
			const skeleton = document.querySelector('.h-12')
			expect(skeleton).toBeInTheDocument()
			expect(skeleton).toHaveClass('w-full')
			expect(skeleton).toHaveClass('rounded-sm')
		})

		it('should support custom dimensions', () => {
			render(() => <Skeleton class="h-4 w-32" data-testid="sized-skeleton" />)
			const skeleton = screen.getByTestId('sized-skeleton')
			expect(skeleton).toHaveClass('h-4')
			expect(skeleton).toHaveClass('w-32')
		})
	})

	describe('Use Cases', () => {
		it('should render single line skeleton', () => {
			render(() => <Skeleton class="h-4 w-full" data-testid="line" />)
			expect(screen.getByTestId('line')).toBeInTheDocument()
		})

		it('should render card skeleton with multiple elements', () => {
			render(() => (
				<div class="space-y-3">
					<Skeleton class="h-32 w-full" data-testid="card-image" />
					<Skeleton class="h-4 w-3/4" data-testid="card-title" />
					<Skeleton class="h-4 w-1/2" data-testid="card-subtitle" />
				</div>
			))

			expect(screen.getByTestId('card-image')).toBeInTheDocument()
			expect(screen.getByTestId('card-title')).toBeInTheDocument()
			expect(screen.getByTestId('card-subtitle')).toBeInTheDocument()
		})

		it('should render avatar skeleton', () => {
			render(() => <Skeleton class="h-12 w-12 rounded-full" data-testid="avatar" />)
			const avatar = screen.getByTestId('avatar')
			expect(avatar).toHaveClass('rounded-full')
		})
	})

	describe('HTML Attributes', () => {
		it('should accept data attributes', () => {
			render(() => <Skeleton data-testid="test-skeleton" data-loading="true" />)
			const skeleton = screen.getByTestId('test-skeleton')
			expect(skeleton).toHaveAttribute('data-loading', 'true')
		})

		it('should support style attribute', () => {
			render(() => <Skeleton style={{ width: '200px' }} data-testid="styled-skeleton" />)
			const skeleton = screen.getByTestId('styled-skeleton')
			expect(skeleton).toHaveStyle({ width: '200px' })
		})
	})

	describe('Type Safety', () => {
		it('should export SkeletonProps type', () => {
			const props: import('./skeleton').SkeletonProps = {
				class: 'test',
				animation: 'wave',
			}
			expect(props).toBeDefined()
		})
	})

	describe('Variants Integration', () => {
		it('should support all animation variants', () => {
			const animations: Array<'pulse' | 'wave' | 'none'> = ['pulse', 'wave', 'none']
			animations.forEach((animation) => {
				const { container } = render(() => <Skeleton animation={animation} />)
				const skeleton = container.querySelector('div')
				expect(skeleton).toBeInTheDocument()
			})
		})
	})

	describe('Background Gradient', () => {
		it('should have gradient for wave animation', () => {
			const { container } = render(() => <Skeleton animation="wave" />)
			const skeleton = container.querySelector('.bg-gradient-to-r')
			expect(skeleton).toBeInTheDocument()
		})

		it('should not have gradient for pulse animation', () => {
			const { container } = render(() => <Skeleton animation="pulse" />)
			const skeleton = container.querySelector('div')
			expect(skeleton).not.toHaveClass('bg-gradient-to-r')
		})
	})
})
