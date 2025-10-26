import { render, screen } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import {
	TextField,
	TextFieldDescription,
	TextFieldErrorMessage,
	TextFieldInput,
	TextFieldLabel,
	TextFieldRoot,
} from './textfield'

describe('TextField Component', () => {
	describe('Component Family', () => {
		it('should render complete component family', () => {
			render(() => (
				<TextFieldRoot>
					<TextFieldLabel>Email</TextFieldLabel>
					<TextFieldInput type="email" placeholder="Enter email..." />
					<TextFieldDescription>We'll never share your email.</TextFieldDescription>
				</TextFieldRoot>
			))

			expect(screen.getByText('Email')).toBeInTheDocument()
			expect(screen.getByPlaceholderText('Enter email...')).toBeInTheDocument()
			expect(screen.getByText("We'll never share your email.")).toBeInTheDocument()
		})

		it('should render with error message', () => {
			render(() => (
				<TextFieldRoot validationState="invalid">
					<TextFieldLabel>Username</TextFieldLabel>
					<TextFieldInput />
					<TextFieldErrorMessage>Username is required</TextFieldErrorMessage>
				</TextFieldRoot>
			))

			expect(screen.getByText('Username is required')).toBeInTheDocument()
		})
	})

	describe('TextFieldInput', () => {
		it('should render input element', () => {
			render(() => <TextFieldInput />)
			expect(document.querySelector('input')).toBeInTheDocument()
		})

		it('should accept placeholder', () => {
			render(() => <TextFieldInput placeholder="Type here..." />)
			expect(screen.getByPlaceholderText('Type here...')).toBeInTheDocument()
		})

		it('should support different input types', () => {
			render(() => <TextFieldInput type="password" />)
			const input = document.querySelector('input')
			expect(input).toHaveAttribute('type', 'password')
		})

		it('should support disabled state', () => {
			render(() => (
				<TextFieldRoot disabled>
					<TextFieldInput />
				</TextFieldRoot>
			))
			const input = document.querySelector('input')
			expect(input).toBeDisabled()
		})

		it('should support file input styling', () => {
			render(() => <TextFieldInput type="file" />)
			const input = document.querySelector('input')
			expect(input).toHaveClass('file:border-0')
			expect(input).toHaveClass('file:bg-transparent')
		})
	})

	describe('Icon Support', () => {
		it('should work with prefix icon wrapper', () => {
			render(() => (
				<TextFieldRoot>
					<TextFieldLabel>Search</TextFieldLabel>
					<div class="relative">
						<span class="absolute left-3 top-1/2 -translate-y-1/2" data-testid="icon">
							🔍
						</span>
						<TextFieldInput class="pl-10" placeholder="Search..." />
					</div>
				</TextFieldRoot>
			))

			expect(screen.getByTestId('icon')).toBeInTheDocument()
			expect(screen.getByPlaceholderText('Search...')).toHaveClass('pl-10')
		})
	})

	describe('Custom Styling', () => {
		it('should accept custom class on root', () => {
			render(() => <TextFieldRoot class="custom-root">Content</TextFieldRoot>)
			const root = screen.getByText('Content')
			expect(root).toHaveClass('custom-root')
		})

		it('should accept custom class on input', () => {
			render(() => <TextFieldInput class="custom-input" />)
			const input = document.querySelector('input')
			expect(input).toHaveClass('custom-input')
		})

		it('should accept custom class on label', () => {
			render(() => <TextFieldLabel class="custom-label">Label</TextFieldLabel>)
			const label = screen.getByText('Label')
			expect(label).toHaveClass('custom-label')
		})

		it('should merge custom classes with defaults', () => {
			render(() => <TextFieldInput class="my-custom-class" />)
			const input = document.querySelector('input')
			expect(input).toHaveClass('my-custom-class')
			expect(input).toHaveClass('w-full')
		})
	})

	describe('Accessibility', () => {
		it('should associate label with input', () => {
			render(() => (
				<TextFieldRoot>
					<TextFieldLabel>Name</TextFieldLabel>
					<TextFieldInput />
				</TextFieldRoot>
			))
			const label = screen.getByText('Name')
			const input = document.querySelector('input')
			expect(label.tagName).toBe('LABEL')
			expect(input).toBeInTheDocument()
		})

		it('should support aria-label', () => {
			render(() => <TextFieldInput aria-label="Search field" />)
			const input = screen.getByLabelText('Search field')
			expect(input).toBeInTheDocument()
		})

		it('should show error state with invalid validation', () => {
			render(() => (
				<TextFieldRoot validationState="invalid">
					<TextFieldInput />
					<TextFieldErrorMessage>Error</TextFieldErrorMessage>
				</TextFieldRoot>
			))
			expect(screen.getByText('Error')).toBeInTheDocument()
		})

		it('should have focus-visible styles', () => {
			render(() => <TextFieldInput />)
			const input = document.querySelector('input')
			expect(input).toHaveClass('focus-visible:outline-none')
			expect(input).toHaveClass('focus-visible:ring-[1.5px]')
		})
	})

	describe('Backward Compatibility', () => {
		it('should support deprecated TextField export', () => {
			render(() => <TextField placeholder="Legacy" />)
			expect(screen.getByPlaceholderText('Legacy')).toBeInTheDocument()
		})

		it('TextField should be same as TextFieldInput', () => {
			expect(TextField).toBe(TextFieldInput)
		})
	})

	describe('HTML Attributes', () => {
		it('should accept data attributes', () => {
			render(() => <TextFieldInput data-testid="custom-input" data-field="username" />)
			const input = screen.getByTestId('custom-input')
			expect(input).toHaveAttribute('data-field', 'username')
		})

		it('should support required attribute', () => {
			render(() => (
				<TextFieldRoot required>
					<TextFieldInput />
				</TextFieldRoot>
			))
			const input = document.querySelector('input')
			expect(input).toBeRequired()
		})

		it('should support readonly attribute', () => {
			render(() => (
				<TextFieldRoot readOnly>
					<TextFieldInput />
				</TextFieldRoot>
			))
			const input = document.querySelector('input')
			expect(input).toHaveAttribute('readonly')
		})
	})

	describe('Type Safety', () => {
		it('should export all Props types', () => {
			const rootProps: import('./textfield').TextFieldRootProps = { class: 'test' }
			const labelProps: import('./textfield').TextFieldLabelProps = { class: 'test' }
			const inputProps: import('./textfield').TextFieldInputProps = { class: 'test' }
			const descProps: import('./textfield').TextFieldDescriptionProps = { class: 'test' }
			const errorProps: import('./textfield').TextFieldErrorMessageProps = { class: 'test' }

			expect(rootProps).toBeDefined()
			expect(labelProps).toBeDefined()
			expect(inputProps).toBeDefined()
			expect(descProps).toBeDefined()
			expect(errorProps).toBeDefined()
		})
	})
})
