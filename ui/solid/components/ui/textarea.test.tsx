import { render, screen } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import {
	TextArea,
	TextAreaDescription,
	TextAreaErrorMessage,
	TextAreaLabel,
	TextAreaRoot,
	TextAreaTextArea,
} from './textarea'

describe('TextArea Component', () => {
	describe('Component Family', () => {
		it('should render complete component family', () => {
			render(() => (
				<TextAreaRoot>
					<TextAreaLabel>Description</TextAreaLabel>
					<TextAreaTextArea placeholder="Enter text..." />
					<TextAreaDescription>Helper text</TextAreaDescription>
				</TextAreaRoot>
			))

			expect(screen.getByText('Description')).toBeInTheDocument()
			expect(screen.getByPlaceholderText('Enter text...')).toBeInTheDocument()
			expect(screen.getByText('Helper text')).toBeInTheDocument()
		})

		it('should render with error message', () => {
			render(() => (
				<TextAreaRoot validationState="invalid">
					<TextAreaLabel>Bio</TextAreaLabel>
					<TextAreaTextArea />
					<TextAreaErrorMessage>Bio is required</TextAreaErrorMessage>
				</TextAreaRoot>
			))

			expect(screen.getByText('Bio is required')).toBeInTheDocument()
		})
	})

	describe('Resize Variants', () => {
		it('should support no resize', () => {
			render(() => <TextAreaTextArea resize="none" />)
			const textarea = document.querySelector('textarea')
			expect(textarea).toHaveClass('resize-none')
		})

		it('should support vertical resize (default)', () => {
			render(() => <TextAreaTextArea resize="vertical" />)
			const textarea = document.querySelector('textarea')
			expect(textarea).toHaveClass('resize-y')
		})

		it('should support horizontal resize', () => {
			render(() => <TextAreaTextArea resize="horizontal" />)
			const textarea = document.querySelector('textarea')
			expect(textarea).toHaveClass('resize-x')
		})

		it('should support both directions resize', () => {
			render(() => <TextAreaTextArea resize="both" />)
			const textarea = document.querySelector('textarea')
			expect(textarea).toHaveClass('resize')
		})

		it('should default to vertical resize', () => {
			render(() => <TextAreaTextArea />)
			const textarea = document.querySelector('textarea')
			expect(textarea).toHaveClass('resize-y')
		})
	})

	describe('Basic Functionality', () => {
		it('should render textarea element', () => {
			render(() => <TextAreaTextArea />)
			expect(document.querySelector('textarea')).toBeInTheDocument()
		})

		it('should accept placeholder', () => {
			render(() => <TextAreaTextArea placeholder="Type here..." />)
			expect(screen.getByPlaceholderText('Type here...')).toBeInTheDocument()
		})

		it('should support rows attribute', () => {
			render(() => <TextAreaTextArea rows={5} />)
			const textarea = document.querySelector('textarea')
			expect(textarea).toHaveAttribute('rows', '5')
		})

		it('should support disabled state', () => {
			render(() => (
				<TextAreaRoot disabled>
					<TextAreaTextArea />
				</TextAreaRoot>
			))
			const textarea = document.querySelector('textarea')
			expect(textarea).toBeDisabled()
		})
	})

	describe('Custom Styling', () => {
		it('should accept custom class on root', () => {
			render(() => <TextAreaRoot class="custom-root">Content</TextAreaRoot>)
			const root = screen.getByText('Content')
			expect(root).toHaveClass('custom-root')
		})

		it('should accept custom class on textarea', () => {
			render(() => <TextAreaTextArea class="custom-textarea" />)
			const textarea = document.querySelector('textarea')
			expect(textarea).toHaveClass('custom-textarea')
		})

		it('should accept custom class on label', () => {
			render(() => <TextAreaLabel class="custom-label">Label</TextAreaLabel>)
			const label = screen.getByText('Label')
			expect(label).toHaveClass('custom-label')
		})
	})

	describe('Accessibility', () => {
		it('should associate label with textarea', () => {
			render(() => (
				<TextAreaRoot>
					<TextAreaLabel>Comments</TextAreaLabel>
					<TextAreaTextArea />
				</TextAreaRoot>
			))
			const label = screen.getByText('Comments')
			const textarea = document.querySelector('textarea')
			expect(label.tagName).toBe('LABEL')
			expect(textarea).toBeInTheDocument()
		})

		it('should support aria-label', () => {
			render(() => <TextAreaTextArea aria-label="Comment field" />)
			const textarea = screen.getByLabelText('Comment field')
			expect(textarea).toBeInTheDocument()
		})

		it('should show error state with invalid validation', () => {
			render(() => (
				<TextAreaRoot validationState="invalid">
					<TextAreaTextArea />
					<TextAreaErrorMessage>Error</TextAreaErrorMessage>
				</TextAreaRoot>
			))
			expect(screen.getByText('Error')).toBeInTheDocument()
		})
	})

	describe('Backward Compatibility', () => {
		it('should support deprecated TextArea export', () => {
			render(() => <TextArea placeholder="Legacy" />)
			expect(screen.getByPlaceholderText('Legacy')).toBeInTheDocument()
		})

		it('TextArea should be same as TextAreaTextArea', () => {
			expect(TextArea).toBe(TextAreaTextArea)
		})
	})

	describe('Type Safety', () => {
		it('should export all Props types', () => {
			const rootProps: import('./textarea').TextAreaRootProps = { class: 'test' }
			const labelProps: import('./textarea').TextAreaLabelProps = { class: 'test' }
			const textareaProps: import('./textarea').TextAreaTextAreaProps = { class: 'test', resize: 'none' }
			const descProps: import('./textarea').TextAreaDescriptionProps = { class: 'test' }
			const errorProps: import('./textarea').TextAreaErrorMessageProps = { class: 'test' }

			expect(rootProps).toBeDefined()
			expect(labelProps).toBeDefined()
			expect(textareaProps).toBeDefined()
			expect(descProps).toBeDefined()
			expect(errorProps).toBeDefined()
		})
	})
})
