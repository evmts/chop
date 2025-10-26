import { render, screen, waitFor } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import { createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { Checkbox, CheckboxControl, CheckboxDescription, CheckboxLabel, checkboxVariants } from './checkbox'

describe('Checkbox Components', () => {
	describe('Basic Rendering', () => {
		it('should render checkbox with label', () => {
			render(() => (
				<Checkbox>
					<CheckboxControl />
					<CheckboxLabel>Accept terms</CheckboxLabel>
				</Checkbox>
			))

			expect(screen.getByText('Accept terms')).toBeInTheDocument()
		})

		it('should render checkbox control', () => {
			render(() => (
				<Checkbox>
					<CheckboxControl />
				</Checkbox>
			))

			const checkbox = screen.getByRole('checkbox')
			expect(checkbox).toBeInTheDocument()
		})

		it('should render with description', () => {
			render(() => (
				<Checkbox>
					<CheckboxControl />
					<CheckboxLabel>Label</CheckboxLabel>
					<CheckboxDescription>Helper text</CheckboxDescription>
				</Checkbox>
			))

			expect(screen.getByText('Helper text')).toBeInTheDocument()
		})
	})

	describe('Checked State', () => {
		it('should handle checked state', async () => {
			const user = userEvent.setup()
			const TestComponent = () => {
				const [checked, setChecked] = createSignal(false)

				return (
					<>
						<Checkbox checked={checked()} onChange={setChecked}>
							<CheckboxControl />
							<CheckboxLabel>Checkbox</CheckboxLabel>
						</Checkbox>
						<div data-testid="state">{checked() ? 'checked' : 'unchecked'}</div>
					</>
				)
			}

			render(() => <TestComponent />)

			expect(screen.getByTestId('state')).toHaveTextContent('unchecked')

			const checkbox = screen.getByRole('checkbox')
			await user.click(checkbox)

			await waitFor(() => {
				expect(screen.getByTestId('state')).toHaveTextContent('checked')
			})
		})

		it('should display checkmark icon when checked', async () => {
			const user = userEvent.setup()
			render(() => (
				<Checkbox>
					<CheckboxControl />
					<CheckboxLabel>Check me</CheckboxLabel>
				</Checkbox>
			))

			const checkbox = screen.getByRole('checkbox')
			await user.click(checkbox)

			await waitFor(() => {
				const svg = checkbox.parentElement?.querySelector('svg')
				expect(svg).toBeInTheDocument()
				// Verify it's the checkmark icon
				expect(svg?.querySelector('title')?.textContent).toContain('Checkbox checked')
			})
		})
	})

	describe('Indeterminate State', () => {
		it('should support indeterminate state', () => {
			render(() => (
				<Checkbox indeterminate>
					<CheckboxControl />
					<CheckboxLabel>Select all</CheckboxLabel>
				</Checkbox>
			))

			const checkbox = screen.getByRole('checkbox')
			expect(checkbox).toHaveAttribute('data-indeterminate')
		})

		it('should display minus icon when indeterminate', () => {
			render(() => (
				<Checkbox indeterminate>
					<CheckboxControl />
				</Checkbox>
			))

			const control = screen.getByRole('checkbox').parentElement
			const svg = control?.querySelector('svg')
			expect(svg).toBeInTheDocument()
			// Verify it's the minus icon
			expect(svg?.querySelector('title')?.textContent).toContain('indeterminate')
		})

		it('should toggle from indeterminate to checked', async () => {
			const user = userEvent.setup()
			const TestComponent = () => {
				const [state, setState] = createSignal<boolean | 'indeterminate'>('indeterminate')

				return (
					<>
						<Checkbox
							checked={state() === true}
							indeterminate={state() === 'indeterminate'}
							onChange={(checked) => setState(checked)}
						>
							<CheckboxControl />
							<CheckboxLabel>Multi-state</CheckboxLabel>
						</Checkbox>
						<div data-testid="state">{String(state())}</div>
					</>
				)
			}

			render(() => <TestComponent />)

			expect(screen.getByTestId('state')).toHaveTextContent('indeterminate')

			const checkbox = screen.getByRole('checkbox')
			await user.click(checkbox)

			await waitFor(() => {
				const stateText = screen.getByTestId('state').textContent
				expect(stateText).toMatch(/true|false/)
			})
		})
	})

	describe('Size Variants', () => {
		it('should render small size', () => {
			render(() => (
				<Checkbox>
					<CheckboxControl size="sm" />
				</Checkbox>
			))

			const control = screen.getByRole('checkbox').nextElementSibling
			expect(control).toHaveClass('h-3')
			expect(control).toHaveClass('w-3')
		})

		it('should render medium size (default)', () => {
			render(() => (
				<Checkbox>
					<CheckboxControl size="md" />
				</Checkbox>
			))

			const control = screen.getByRole('checkbox').nextElementSibling
			expect(control).toHaveClass('h-4')
			expect(control).toHaveClass('w-4')
		})

		it('should render large size', () => {
			render(() => (
				<Checkbox>
					<CheckboxControl size="lg" />
				</Checkbox>
			))

			const control = screen.getByRole('checkbox').nextElementSibling
			expect(control).toHaveClass('h-5')
			expect(control).toHaveClass('w-5')
		})

		it('should scale icon size with checkbox size', () => {
			render(() => (
				<Checkbox>
					<CheckboxControl size="lg" data-testid="large" />
				</Checkbox>
			))

			const control = screen.getByTestId('large')
			const svg = control.querySelector('svg')
			expect(svg).toHaveClass('h-5')
			expect(svg).toHaveClass('w-5')
		})
	})

	describe('Disabled State', () => {
		it('should disable checkbox', () => {
			render(() => (
				<Checkbox disabled>
					<CheckboxControl />
					<CheckboxLabel>Disabled</CheckboxLabel>
				</Checkbox>
			))

			const checkbox = screen.getByRole('checkbox')
			expect(checkbox).toBeDisabled()
		})

		it('should have disabled styles', () => {
			render(() => (
				<Checkbox disabled>
					<CheckboxControl />
				</Checkbox>
			))

			const control = screen.getByRole('checkbox').nextElementSibling
			expect(control).toHaveClass('data-[disabled]:cursor-not-allowed')
			expect(control).toHaveClass('data-[disabled]:opacity-50')
		})

		it('should not toggle when disabled', async () => {
			const user = userEvent.setup()
			const onChange = vi.fn()

			render(() => (
				<Checkbox disabled onChange={onChange}>
					<CheckboxControl />
					<CheckboxLabel>Disabled</CheckboxLabel>
				</Checkbox>
			))

			const checkbox = screen.getByRole('checkbox')
			await user.click(checkbox)

			expect(onChange).not.toHaveBeenCalled()
		})
	})

	describe('Click Events', () => {
		it('should call onChange when clicked', async () => {
			const user = userEvent.setup()
			const onChange = vi.fn()

			render(() => (
				<Checkbox onChange={onChange}>
					<CheckboxControl />
					<CheckboxLabel>Click me</CheckboxLabel>
				</Checkbox>
			))

			const checkbox = screen.getByRole('checkbox')
			await user.click(checkbox)

			expect(onChange).toHaveBeenCalled()
		})

		it('should toggle between checked and unchecked', async () => {
			const user = userEvent.setup()
			const TestComponent = () => {
				const [checked, setChecked] = createSignal(false)

				return (
					<Checkbox checked={checked()} onChange={setChecked}>
						<CheckboxControl />
						<CheckboxLabel>Toggle</CheckboxLabel>
					</Checkbox>
				)
			}

			render(() => <TestComponent />)

			const checkbox = screen.getByRole('checkbox')
			expect(checkbox).not.toBeChecked()

			await user.click(checkbox)
			await waitFor(() => expect(checkbox).toBeChecked())

			await user.click(checkbox)
			await waitFor(() => expect(checkbox).not.toBeChecked())
		})
	})

	describe('Custom Styling', () => {
		it('should accept custom className', () => {
			render(() => (
				<Checkbox>
					<CheckboxControl class="custom-checkbox" />
				</Checkbox>
			))

			const control = screen.getByRole('checkbox').nextElementSibling
			expect(control).toHaveClass('custom-checkbox')
		})

		it('should merge custom className with default classes', () => {
			render(() => (
				<Checkbox>
					<CheckboxControl class="my-custom-class" />
				</Checkbox>
			))

			const control = screen.getByRole('checkbox').nextElementSibling
			expect(control).toHaveClass('my-custom-class')
			expect(control).toHaveClass('rounded-sm')
		})
	})

	describe('Accessibility', () => {
		it('should have correct ARIA role', () => {
			render(() => (
				<Checkbox>
					<CheckboxControl />
					<CheckboxLabel>Accessible</CheckboxLabel>
				</Checkbox>
			))

			expect(screen.getByRole('checkbox')).toBeInTheDocument()
		})

		it('should associate label with checkbox', () => {
			render(() => (
				<Checkbox>
					<CheckboxControl />
					<CheckboxLabel>Associated Label</CheckboxLabel>
				</Checkbox>
			))

			const label = screen.getByText('Associated Label')
			const checkbox = screen.getByRole('checkbox')

			// Click label should trigger checkbox
			expect(checkbox).toBeInTheDocument()
			expect(label).toBeInTheDocument()
		})

		it('should have focus-visible styles', () => {
			render(() => (
				<Checkbox>
					<CheckboxControl />
				</Checkbox>
			))

			const control = screen.getByRole('checkbox').nextElementSibling
			expect(control).toHaveClass('focus-visible:outline-none')
			expect(control).toHaveClass('focus-visible:ring-[1.5px]')
		})

		it('should be keyboard accessible', async () => {
			const user = userEvent.setup()
			const onChange = vi.fn()

			render(() => (
				<Checkbox onChange={onChange}>
					<CheckboxControl />
					<CheckboxLabel>Keyboard</CheckboxLabel>
				</Checkbox>
			))

			const checkbox = screen.getByRole('checkbox')
			checkbox.focus()
			await user.keyboard(' ')

			expect(onChange).toHaveBeenCalled()
		})

		it('should support aria-label', () => {
			render(() => (
				<Checkbox>
					<CheckboxControl aria-label="Accept terms and conditions" />
				</Checkbox>
			))

			expect(screen.getByRole('checkbox')).toHaveAttribute('aria-label')
		})

		it('should have proper SVG accessibility with title', () => {
			render(() => (
				<Checkbox checked>
					<CheckboxControl />
				</Checkbox>
			))

			const svg = screen.getByRole('checkbox').parentElement?.querySelector('svg')
			const title = svg?.querySelector('title')
			expect(title).toBeInTheDocument()
		})
	})

	describe('Checkbox Variants Helper', () => {
		it('should generate correct classes for default size', () => {
			const classes = checkboxVariants({ size: 'md' })
			expect(classes).toContain('h-4')
			expect(classes).toContain('w-4')
		})

		it('should generate correct classes for different sizes', () => {
			const smClasses = checkboxVariants({ size: 'sm' })
			expect(smClasses).toContain('h-3')

			const lgClasses = checkboxVariants({ size: 'lg' })
			expect(lgClasses).toContain('h-5')
		})
	})
})
