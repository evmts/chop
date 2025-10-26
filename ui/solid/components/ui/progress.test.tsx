import { render, screen } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { Progress, ProgressLabel, ProgressValueLabel } from './progress'

describe('Progress Component', () => {
	describe('Basic Rendering', () => {
		it('should render progress with value', () => {
			render(() => <Progress value={50} />)
			// Progress component from Kobalte should be in document
			expect(document.querySelector('[role="progressbar"]')).toBeInTheDocument()
		})

		it('should render with label', () => {
			render(() => (
				<Progress value={60}>
					<ProgressLabel>Loading...</ProgressLabel>
				</Progress>
			))
			expect(screen.getByText('Loading...')).toBeInTheDocument()
		})

		it('should render with value label', () => {
			render(() => (
				<Progress value={75}>
					<ProgressValueLabel />
				</Progress>
			))
			expect(document.querySelector('[role="progressbar"]')).toBeInTheDocument()
		})
	})

	describe('Size Variants', () => {
		it('should render small size', () => {
			const { container } = render(() => <Progress value={50} size="sm" />)
			const track = container.querySelector('.h-1')
			expect(track).toBeInTheDocument()
		})

		it('should render medium size (default)', () => {
			const { container } = render(() => <Progress value={50} size="md" />)
			const track = container.querySelector('.h-2')
			expect(track).toBeInTheDocument()
		})

		it('should render large size', () => {
			const { container } = render(() => <Progress value={50} size="lg" />)
			const track = container.querySelector('.h-3')
			expect(track).toBeInTheDocument()
		})

		it('should use medium as default size', () => {
			const { container } = render(() => <Progress value={50} />)
			const track = container.querySelector('.h-2')
			expect(track).toBeInTheDocument()
		})
	})

	describe('Indeterminate State', () => {
		it('should render indeterminate progress with animation', () => {
			const { container } = render(() => <Progress indeterminate value={0} />)
			const fill = container.querySelector('.animate-pulse')
			expect(fill).toBeInTheDocument()
		})

		it('should not animate when indeterminate is false', () => {
			const { container } = render(() => <Progress indeterminate={false} value={50} />)
			const fill = container.querySelector('.animate-pulse')
			expect(fill).not.toBeInTheDocument()
		})
	})

	describe('Custom Styling', () => {
		it('should accept custom className', () => {
			const { container } = render(() => <Progress value={50} class="custom-progress" />)
			const progress = container.querySelector('.custom-progress')
			expect(progress).toBeInTheDocument()
		})

		it('should accept custom fill className', () => {
			const { container } = render(() => <Progress value={50} fillClass="custom-fill" />)
			const fill = container.querySelector('.custom-fill')
			expect(fill).toBeInTheDocument()
		})
	})

	describe('Progress Values', () => {
		it('should handle 0% progress', () => {
			render(() => <Progress value={0} />)
			expect(document.querySelector('[role="progressbar"]')).toBeInTheDocument()
		})

		it('should handle 100% progress', () => {
			render(() => <Progress value={100} />)
			expect(document.querySelector('[role="progressbar"]')).toBeInTheDocument()
		})

		it('should handle partial progress', () => {
			render(() => <Progress value={42} />)
			expect(document.querySelector('[role="progressbar"]')).toBeInTheDocument()
		})
	})

	describe('Accessibility', () => {
		it('should have proper role', () => {
			render(() => <Progress value={50} />)
			expect(document.querySelector('[role="progressbar"]')).toBeInTheDocument()
		})

		it('should support aria-label', () => {
			render(() => <Progress value={50} aria-label="Upload progress" />)
			const progress = document.querySelector('[role="progressbar"]')
			expect(progress).toHaveAttribute('aria-label', 'Upload progress')
		})
	})

	describe('Type Safety', () => {
		it('should export ProgressProps type', () => {
			// Type-only test - if this compiles, it passes
			const props: import('./progress').ProgressProps = {
				value: 50,
				size: 'md',
				indeterminate: false,
			}
			expect(props).toBeDefined()
		})
	})
})
