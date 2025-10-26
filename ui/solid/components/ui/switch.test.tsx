import { render, screen } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { Switch, SwitchControl, SwitchDescription, SwitchErrorMessage, SwitchLabel, SwitchThumb } from './switch'

describe('Switch Component', () => {
	describe('Basic Rendering', () => {
		it('should render switch with label', () => {
			render(() => (
				<Switch>
					<SwitchLabel>Enable notifications</SwitchLabel>
					<SwitchControl>
						<SwitchThumb />
					</SwitchControl>
				</Switch>
			))

			expect(screen.getByText('Enable notifications')).toBeInTheDocument()
		})

		it('should render switch control and thumb', () => {
			const { container } = render(() => (
				<Switch>
					<SwitchControl>
						<SwitchThumb />
					</SwitchControl>
				</Switch>
			))

			expect(container.querySelector('input[type="checkbox"]')).toBeInTheDocument()
		})

		it('should render with description', () => {
			render(() => (
				<Switch>
					<SwitchLabel>Dark mode</SwitchLabel>
					<SwitchControl>
						<SwitchThumb />
					</SwitchControl>
					<SwitchDescription>Enable dark theme</SwitchDescription>
				</Switch>
			))

			expect(screen.getByText('Enable dark theme')).toBeInTheDocument()
		})

		it('should render with error message', () => {
			render(() => (
				<Switch validationState="invalid">
					<SwitchLabel>Agree to terms</SwitchLabel>
					<SwitchControl>
						<SwitchThumb />
					</SwitchControl>
					<SwitchErrorMessage>You must agree to continue</SwitchErrorMessage>
				</Switch>
			))

			expect(screen.getByText('You must agree to continue')).toBeInTheDocument()
		})
	})

	describe('Size Variants', () => {
		it('should render small size', () => {
			const { container } = render(() => (
				<Switch>
					<SwitchControl size="sm">
						<SwitchThumb size="sm" />
					</SwitchControl>
				</Switch>
			))

			const control = container.querySelector('.h-4.w-7')
			expect(control).toBeInTheDocument()
		})

		it('should render medium size (default)', () => {
			const { container } = render(() => (
				<Switch>
					<SwitchControl size="md">
						<SwitchThumb size="md" />
					</SwitchControl>
				</Switch>
			))

			const control = container.querySelector('.h-5.w-9')
			expect(control).toBeInTheDocument()
		})

		it('should render large size', () => {
			const { container } = render(() => (
				<Switch>
					<SwitchControl size="lg">
						<SwitchThumb size="lg" />
					</SwitchControl>
				</Switch>
			))

			const control = container.querySelector('.h-6')
			expect(control).toBeInTheDocument()
		})

		it('should default to medium size when not specified', () => {
			const { container } = render(() => (
				<Switch>
					<SwitchControl>
						<SwitchThumb />
					</SwitchControl>
				</Switch>
			))

			const control = container.querySelector('.h-5.w-9')
			expect(control).toBeInTheDocument()
		})
	})

	describe('States', () => {
		it('should support checked state', () => {
			const { container } = render(() => (
				<Switch checked>
					<SwitchControl>
						<SwitchThumb />
					</SwitchControl>
				</Switch>
			))

			const input = container.querySelector('input[type="checkbox"]')
			expect(input).toBeChecked()
		})

		it('should support disabled state', () => {
			const { container } = render(() => (
				<Switch disabled>
					<SwitchControl>
						<SwitchThumb />
					</SwitchControl>
				</Switch>
			))

			const input = container.querySelector('input[type="checkbox"]')
			expect(input).toBeDisabled()
		})
	})

	describe('Custom Styling', () => {
		it('should accept custom class on control', () => {
			const { container } = render(() => (
				<Switch>
					<SwitchControl class="custom-control">
						<SwitchThumb />
					</SwitchControl>
				</Switch>
			))

			const control = container.querySelector('.custom-control')
			expect(control).toBeInTheDocument()
		})

		it('should accept custom class on thumb', () => {
			const { container } = render(() => (
				<Switch>
					<SwitchControl>
						<SwitchThumb class="custom-thumb" />
					</SwitchControl>
				</Switch>
			))

			const thumb = container.querySelector('.custom-thumb')
			expect(thumb).toBeInTheDocument()
		})
	})

	describe('Accessibility', () => {
		it('should have proper role', () => {
			const { container } = render(() => (
				<Switch>
					<SwitchControl>
						<SwitchThumb />
					</SwitchControl>
				</Switch>
			))

			const switchElement = container.querySelector('[role="switch"]')
			expect(switchElement).toBeInTheDocument()
		})

		it('should have focus-visible styles', () => {
			const { container } = render(() => (
				<Switch>
					<SwitchControl>
						<SwitchThumb />
					</SwitchControl>
				</Switch>
			))

			const input = container.querySelector('input')
			expect(input).toHaveClass('[&:focus-visible+div]:ring-[1.5px]')
		})

		it('should support aria-label', () => {
			const { container } = render(() => (
				<Switch aria-label="Toggle feature">
					<SwitchControl>
						<SwitchThumb />
					</SwitchControl>
				</Switch>
			))

			const switchElement = container.querySelector('[role="switch"]')
			expect(switchElement).toHaveAttribute('aria-label', 'Toggle feature')
		})
	})

	describe('Type Safety', () => {
		it('should export SwitchControlProps type', () => {
			const props: import('./switch').SwitchControlProps = {
				class: 'test',
				size: 'md',
			}
			expect(props).toBeDefined()
		})

		it('should export SwitchThumbProps type', () => {
			const props: import('./switch').SwitchThumbProps = {
				class: 'test',
				size: 'lg',
			}
			expect(props).toBeDefined()
		})
	})

	describe('CVA Integration', () => {
		it('should use class-variance-authority for variants', () => {
			const { container } = render(() => (
				<Switch>
					<SwitchControl size="lg">
						<SwitchThumb size="lg" />
					</SwitchControl>
				</Switch>
			))

			// CVA should apply size-specific classes
			const control = container.querySelector('.h-6')
			expect(control).toBeInTheDocument()
		})
	})
})
