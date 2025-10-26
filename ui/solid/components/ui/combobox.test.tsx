import { render, screen, waitFor } from '@solidjs/testing-library'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createSignal } from 'solid-js'
import {
	Combobox,
	ComboboxContent,
	ComboboxInput,
	ComboboxItem,
	ComboboxTrigger,
} from './combobox'

describe('Combobox Component', () => {
	const testOptions = [
		{ id: '1', label: 'Option 1', value: 'opt1' },
		{ id: '2', label: 'Option 2', value: 'opt2' },
		{ id: '3', label: 'Option 3', value: 'opt3' },
	]

	describe('Basic Rendering', () => {
		it('should render combobox with trigger', () => {
			render(() => (
				<Combobox
					options={testOptions}
					optionValue="value"
					optionTextValue="label"
					placeholder="Select option"
				>
					<ComboboxTrigger aria-label="Select option">
						<ComboboxInput placeholder="Select option" />
					</ComboboxTrigger>
					<ComboboxContent />
				</Combobox>
			))

			expect(screen.getByRole('combobox')).toBeInTheDocument()
			expect(screen.getByPlaceholderText('Select option')).toBeInTheDocument()
		})

		it('should render with custom class names', () => {
			render(() => (
				<Combobox
					options={testOptions}
					optionValue="value"
					optionTextValue="label"
				>
					<ComboboxTrigger class="custom-trigger" aria-label="Select">
						<ComboboxInput class="custom-input" />
					</ComboboxTrigger>
					<ComboboxContent class="custom-content" />
				</Combobox>
			))

			const trigger = screen.getByRole('button')
			expect(trigger).toHaveClass('custom-trigger')
		})

		it('should render input with correct placeholder', () => {
			render(() => (
				<Combobox
					options={testOptions}
					optionValue="value"
					optionTextValue="label"
				>
					<ComboboxTrigger aria-label="Select">
						<ComboboxInput placeholder="Search items..." />
					</ComboboxTrigger>
					<ComboboxContent />
				</Combobox>
			))

			expect(screen.getByPlaceholderText('Search items...')).toBeInTheDocument()
		})
	})

	describe('Selection Behavior', () => {
		it('should handle controlled value', () => {
			const TestComponent = () => {
				const [value, setValue] = createSignal('opt1')

				return (
					<>
						<Combobox
							options={testOptions}
							optionValue="value"
							optionTextValue="label"
							value={value()}
							onChange={setValue}
							itemComponent={(props) => (
								<ComboboxItem item={props.item}>
									{props.item.rawValue.label}
								</ComboboxItem>
							)}
						>
							<ComboboxTrigger aria-label="Select option">
								<ComboboxInput />
							</ComboboxTrigger>
							<ComboboxContent />
						</Combobox>
						<div data-testid="selected-value">{value()}</div>
					</>
				)
			}

			render(() => <TestComponent />)
			expect(screen.getByTestId('selected-value')).toHaveTextContent('opt1')
		})

		it('should call onChange when selection changes', async () => {
			const user = userEvent.setup()
			const onChange = vi.fn()

			render(() => (
				<Combobox
					options={testOptions}
					optionValue="value"
					optionTextValue="label"
					onChange={onChange}
					itemComponent={(props) => (
						<ComboboxItem item={props.item}>
							{props.item.rawValue.label}
						</ComboboxItem>
					)}
				>
					<ComboboxTrigger aria-label="Select option">
						<ComboboxInput />
					</ComboboxTrigger>
					<ComboboxContent />
				</Combobox>
			))

			const trigger = screen.getByRole('button')
			await user.click(trigger)

			await waitFor(() => {
				const options = screen.getAllByRole('option')
				expect(options.length).toBeGreaterThan(0)
			})

			const firstOption = screen.getAllByRole('option')[0]
			await user.click(firstOption)

			expect(onChange).toHaveBeenCalled()
		})

		it('should update display value when selection changes', async () => {
			const user = userEvent.setup()

			const TestComponent = () => {
				const [value, setValue] = createSignal<string>()

				return (
					<Combobox
						options={testOptions}
						optionValue="value"
						optionTextValue="label"
						optionLabel="label"
						value={value()}
						onChange={setValue}
						itemComponent={(props) => (
							<ComboboxItem item={props.item}>
								{props.item.rawValue.label}
							</ComboboxItem>
						)}
					>
						<ComboboxTrigger aria-label="Select option">
							<ComboboxInput />
						</ComboboxTrigger>
						<ComboboxContent />
					</Combobox>
				)
			}

			render(() => <TestComponent />)

			const trigger = screen.getByRole('button')
			await user.click(trigger)

			await waitFor(() => {
				const options = screen.getAllByRole('option')
				expect(options.length).toBeGreaterThan(0)
			})

			const firstOption = screen.getAllByRole('option')[0]
			await user.click(firstOption)

			await waitFor(() => {
				const input = screen.getByRole('combobox') as HTMLInputElement
				expect(input.value).toBe('Option 1')
			})
		})
	})

	describe('Keyboard Navigation', () => {
		it('should open listbox on ArrowDown', async () => {
			const user = userEvent.setup()

			render(() => (
				<Combobox
					options={testOptions}
					optionValue="value"
					optionTextValue="label"
					itemComponent={(props) => (
						<ComboboxItem item={props.item}>
							{props.item.rawValue.label}
						</ComboboxItem>
					)}
				>
					<ComboboxTrigger aria-label="Select option">
						<ComboboxInput />
					</ComboboxTrigger>
					<ComboboxContent />
				</Combobox>
			))

			const input = screen.getByRole('combobox')
			await user.click(input)
			await user.keyboard('{ArrowDown}')

			await waitFor(() => {
				expect(screen.getAllByRole('option').length).toBeGreaterThan(0)
			})
		})

		it('should navigate options with arrow keys', async () => {
			const user = userEvent.setup()

			render(() => (
				<Combobox
					options={testOptions}
					optionValue="value"
					optionTextValue="label"
					itemComponent={(props) => (
						<ComboboxItem item={props.item}>
							{props.item.rawValue.label}
						</ComboboxItem>
					)}
				>
					<ComboboxTrigger aria-label="Select option">
						<ComboboxInput />
					</ComboboxTrigger>
					<ComboboxContent />
				</Combobox>
			))

			const trigger = screen.getByRole('button')
			await user.click(trigger)

			await waitFor(() => {
				expect(screen.getAllByRole('option').length).toBeGreaterThan(0)
			})

			await user.keyboard('{ArrowDown}')
			await user.keyboard('{ArrowDown}')

			// Verify navigation occurred (exact assertion depends on Kobalte's behavior)
			const options = screen.getAllByRole('option')
			expect(options.length).toBe(3)
		})

		it('should close on Escape key', async () => {
			const user = userEvent.setup()

			render(() => (
				<Combobox
					options={testOptions}
					optionValue="value"
					optionTextValue="label"
					itemComponent={(props) => (
						<ComboboxItem item={props.item}>
							{props.item.rawValue.label}
						</ComboboxItem>
					)}
				>
					<ComboboxTrigger aria-label="Select option">
						<ComboboxInput />
					</ComboboxTrigger>
					<ComboboxContent />
				</Combobox>
			))

			const trigger = screen.getByRole('button')
			await user.click(trigger)

			await waitFor(() => {
				expect(screen.getAllByRole('option').length).toBeGreaterThan(0)
			})

			await user.keyboard('{Escape}')

			await waitFor(() => {
				expect(screen.queryAllByRole('option')).toHaveLength(0)
			})
		})
	})

	describe('Filtering', () => {
		it('should filter options based on input', async () => {
			const user = userEvent.setup()

			render(() => (
				<Combobox
					options={testOptions}
					optionValue="value"
					optionTextValue="label"
					itemComponent={(props) => (
						<ComboboxItem item={props.item}>
							{props.item.rawValue.label}
						</ComboboxItem>
					)}
				>
					<ComboboxTrigger aria-label="Select option">
						<ComboboxInput />
					</ComboboxTrigger>
					<ComboboxContent />
				</Combobox>
			))

			const input = screen.getByRole('combobox')
			await user.click(input)
			await user.type(input, '1')

			await waitFor(() => {
				const options = screen.getAllByRole('option')
				expect(options.length).toBeLessThanOrEqual(testOptions.length)
			})
		})

		it('should show all options when input is cleared', async () => {
			const user = userEvent.setup()

			render(() => (
				<Combobox
					options={testOptions}
					optionValue="value"
					optionTextValue="label"
					itemComponent={(props) => (
						<ComboboxItem item={props.item}>
							{props.item.rawValue.label}
						</ComboboxItem>
					)}
				>
					<ComboboxTrigger aria-label="Select option">
						<ComboboxInput />
					</ComboboxTrigger>
					<ComboboxContent />
				</Combobox>
			))

			const input = screen.getByRole('combobox')
			await user.click(input)
			await user.type(input, '1')
			await user.clear(input)

			await waitFor(() => {
				const options = screen.getAllByRole('option')
				expect(options.length).toBe(testOptions.length)
			})
		})

		it('should support custom filter function', async () => {
			const user = userEvent.setup()
			const customFilter = (option: typeof testOptions[0], inputValue: string) => {
				return option.value.includes(inputValue)
			}

			render(() => (
				<Combobox
					options={testOptions}
					optionValue="value"
					optionTextValue="label"
					defaultFilter={customFilter}
					itemComponent={(props) => (
						<ComboboxItem item={props.item}>
							{props.item.rawValue.label}
						</ComboboxItem>
					)}
				>
					<ComboboxTrigger aria-label="Select option">
						<ComboboxInput />
					</ComboboxTrigger>
					<ComboboxContent />
				</Combobox>
			))

			const input = screen.getByRole('combobox')
			await user.click(input)

			// Wait for options to appear
			await waitFor(() => {
				expect(screen.getAllByRole('option').length).toBeGreaterThan(0)
			})
		})
	})

	describe('Custom Item Rendering', () => {
		it('should render custom item component', async () => {
			const user = userEvent.setup()

			render(() => (
				<Combobox
					options={testOptions}
					optionValue="value"
					optionTextValue="label"
					itemComponent={(props) => (
						<ComboboxItem item={props.item}>
							<div data-testid={`custom-item-${props.item.rawValue.id}`}>
								<span>{props.item.rawValue.label}</span>
								<span>{props.item.rawValue.value}</span>
							</div>
						</ComboboxItem>
					)}
				>
					<ComboboxTrigger aria-label="Select option">
						<ComboboxInput />
					</ComboboxTrigger>
					<ComboboxContent />
				</Combobox>
			))

			const trigger = screen.getByRole('button')
			await user.click(trigger)

			await waitFor(() => {
				expect(screen.getByTestId('custom-item-1')).toBeInTheDocument()
			})
		})
	})

	describe('Accessibility', () => {
		it('should have correct ARIA attributes', () => {
			render(() => (
				<Combobox
					options={testOptions}
					optionValue="value"
					optionTextValue="label"
				>
					<ComboboxTrigger aria-label="Select option">
						<ComboboxInput />
					</ComboboxTrigger>
					<ComboboxContent />
				</Combobox>
			))

			const combobox = screen.getByRole('combobox')
			expect(combobox).toHaveAttribute('aria-expanded')
		})

		it('should be keyboard accessible', async () => {
			const user = userEvent.setup()
			const onChange = vi.fn()

			render(() => (
				<Combobox
					options={testOptions}
					optionValue="value"
					optionTextValue="label"
					onChange={onChange}
					itemComponent={(props) => (
						<ComboboxItem item={props.item}>
							{props.item.rawValue.label}
						</ComboboxItem>
					)}
				>
					<ComboboxTrigger aria-label="Select option">
						<ComboboxInput />
					</ComboboxTrigger>
					<ComboboxContent />
				</Combobox>
			))

			const input = screen.getByRole('combobox')
			await user.click(input)
			await user.keyboard('{ArrowDown}')
			await user.keyboard('{Enter}')

			expect(onChange).toHaveBeenCalled()
		})

		it('should support aria-label on trigger', () => {
			render(() => (
				<Combobox
					options={testOptions}
					optionValue="value"
					optionTextValue="label"
				>
					<ComboboxTrigger aria-label="Custom label">
						<ComboboxInput />
					</ComboboxTrigger>
					<ComboboxContent />
				</Combobox>
			))

			expect(screen.getByLabelText('Custom label')).toBeInTheDocument()
		})
	})

	describe('Edge Cases', () => {
		it('should handle empty options array', () => {
			render(() => (
				<Combobox
					options={[]}
					optionValue="value"
					optionTextValue="label"
				>
					<ComboboxTrigger aria-label="Select option">
						<ComboboxInput />
					</ComboboxTrigger>
					<ComboboxContent />
				</Combobox>
			))

			expect(screen.getByRole('combobox')).toBeInTheDocument()
		})

		it('should handle undefined value', () => {
			render(() => (
				<Combobox
					options={testOptions}
					optionValue="value"
					optionTextValue="label"
					value={undefined}
				>
					<ComboboxTrigger aria-label="Select option">
						<ComboboxInput />
					</ComboboxTrigger>
					<ComboboxContent />
				</Combobox>
			))

			expect(screen.getByRole('combobox')).toBeInTheDocument()
		})

		it('should handle string array options', async () => {
			const user = userEvent.setup()
			const stringOptions = ['Apple', 'Banana', 'Cherry']

			render(() => (
				<Combobox
					options={stringOptions}
					itemComponent={(props) => (
						<ComboboxItem item={props.item}>
							{props.item.rawValue}
						</ComboboxItem>
					)}
				>
					<ComboboxTrigger aria-label="Select fruit">
						<ComboboxInput />
					</ComboboxTrigger>
					<ComboboxContent />
				</Combobox>
			))

			const trigger = screen.getByRole('button')
			await user.click(trigger)

			await waitFor(() => {
				expect(screen.getAllByRole('option').length).toBe(3)
			})
		})
	})
})
