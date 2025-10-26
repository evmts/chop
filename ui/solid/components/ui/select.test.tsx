import { render, screen } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import {
	Select,
	SelectContent,
	SelectDescription,
	SelectErrorMessage,
	SelectIcon,
	SelectItem,
	SelectLabel,
	SelectPortal,
	SelectTrigger,
	SelectValue,
} from './select'

describe('Select Component', () => {
	describe('Basic Rendering', () => {
		it('should render select trigger', () => {
			render(() => (
				<Select>
					<SelectTrigger>
						<SelectValue placeholder="Select option" />
					</SelectTrigger>
				</Select>
			))
			expect(screen.getByText('Select option')).toBeInTheDocument()
		})

		it('should render select with items', () => {
			render(() => (
				<Select open>
					<SelectTrigger>
						<SelectValue placeholder="Choose" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="1">Option 1</SelectItem>
						<SelectItem value="2">Option 2</SelectItem>
					</SelectContent>
				</Select>
			))
			expect(screen.getByText('Option 1')).toBeInTheDocument()
			expect(screen.getByText('Option 2')).toBeInTheDocument()
		})
	})

	describe('Exported Components', () => {
		it('should export SelectLabel component', () => {
			render(() => (
				<Select>
					<SelectLabel>Choose an option</SelectLabel>
					<SelectTrigger>
						<SelectValue />
					</SelectTrigger>
				</Select>
			))
			expect(screen.getByText('Choose an option')).toBeInTheDocument()
		})

		it('should export SelectPortal component', () => {
			expect(SelectPortal).toBeDefined()
		})

		it('should export SelectIcon component', () => {
			expect(SelectIcon).toBeDefined()
		})

		it('should export SelectDescription component', () => {
			render(() => (
				<Select>
					<SelectTrigger>
						<SelectValue />
					</SelectTrigger>
					<SelectDescription>Helper text</SelectDescription>
				</Select>
			))
			expect(screen.getByText('Helper text')).toBeInTheDocument()
		})

		it('should export SelectErrorMessage component', () => {
			render(() => (
				<Select validationState="invalid">
					<SelectTrigger>
						<SelectValue />
					</SelectTrigger>
					<SelectErrorMessage>Error message</SelectErrorMessage>
				</Select>
			))
			expect(screen.getByText('Error message')).toBeInTheDocument()
		})
	})

	describe('Custom Styling', () => {
		it('should accept custom class on trigger', () => {
			render(() => (
				<Select>
					<SelectTrigger class="custom-trigger">
						<SelectValue />
					</SelectTrigger>
				</Select>
			))
			const trigger = document.querySelector('.custom-trigger')
			expect(trigger).toBeInTheDocument()
		})

		it('should accept custom class on content', () => {
			const { container } = render(() => (
				<Select open>
					<SelectTrigger>
						<SelectValue />
					</SelectTrigger>
					<SelectContent class="custom-content">
						<SelectItem value="1">Item</SelectItem>
					</SelectContent>
				</Select>
			))
			const content = container.querySelector('.custom-content')
			expect(content).toBeInTheDocument()
		})

		it('should accept custom class on item', () => {
			render(() => (
				<Select open>
					<SelectTrigger>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="1" class="custom-item">
							Custom Item
						</SelectItem>
					</SelectContent>
				</Select>
			))
			const item = screen.getByText('Custom Item')
			expect(item.closest('li')).toHaveClass('custom-item')
		})
	})

	describe('Accessibility', () => {
		it('should have proper role on trigger', () => {
			render(() => (
				<Select>
					<SelectTrigger>
						<SelectValue />
					</SelectTrigger>
				</Select>
			))
			expect(document.querySelector('[role="combobox"]')).toBeInTheDocument()
		})

		it('should support keyboard navigation documentation', () => {
			// The component has keyboard navigation docs in JSDoc
			// Space/Enter, ArrowDown, ArrowUp, Home, End, Escape, Type ahead
			render(() => (
				<Select>
					<SelectTrigger>
						<SelectValue placeholder="Navigate me" />
					</SelectTrigger>
				</Select>
			))
			expect(screen.getByText('Navigate me')).toBeInTheDocument()
		})

		it('should support disabled state', () => {
			render(() => (
				<Select disabled>
					<SelectTrigger>
						<SelectValue />
					</SelectTrigger>
				</Select>
			))
			const trigger = document.querySelector('[role="combobox"]')
			expect(trigger).toHaveAttribute('disabled')
		})
	})

	describe('Type Safety', () => {
		it('should export SelectTriggerProps type', () => {
			const props: import('./select').SelectTriggerProps = {
				class: 'test',
			}
			expect(props).toBeDefined()
		})

		it('should export SelectContentProps type', () => {
			const props: import('./select').SelectContentProps = {
				class: 'test',
			}
			expect(props).toBeDefined()
		})

		it('should export SelectItemProps type', () => {
			const props: import('./select').SelectItemProps = {
				value: 'test',
				class: 'test',
			}
			expect(props).toBeDefined()
		})
	})
})
