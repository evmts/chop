import type { PolymorphicProps } from '@kobalte/core/polymorphic'
import type {
	TextFieldDescriptionProps,
	TextFieldErrorMessageProps,
	TextFieldLabelProps,
	TextFieldRootProps,
	TextFieldTextAreaProps,
} from '@kobalte/core/text-field'
import { TextField as TextFieldPrimitive } from '@kobalte/core/text-field'
import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'
import type { ValidComponent, VoidProps } from 'solid-js'
import { splitProps } from 'solid-js'
import { cn } from '~/lib/cn'

const textAreaVariants = cva(
	'flex min-h-[60px] w-full rounded-sm border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-shadow placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
	{
		variants: {
			resize: {
				none: 'resize-none',
				vertical: 'resize-y',
				horizontal: 'resize-x',
				both: 'resize',
			},
		},
		defaultVariants: {
			resize: 'vertical',
		},
	},
)

const textAreaLabelVariants = cva('text-sm data-[disabled]:cursor-not-allowed data-[disabled]:opacity-70 font-medium', {
	variants: {
		label: {
			true: 'data-[invalid]:text-destructive',
		},
		error: {
			true: 'text-destructive text-xs',
		},
		description: {
			true: 'font-normal text-muted-foreground',
		},
	},
	defaultVariants: {
		label: true,
	},
})

export type TextAreaRootProps<T extends ValidComponent = 'div'> = TextFieldRootProps<T> & {
	class?: string
}

/**
 * TextAreaRoot - Root container for the textarea component.
 */
export const TextAreaRoot = <T extends ValidComponent = 'div'>(props: PolymorphicProps<T, TextAreaRootProps<T>>) => {
	const [local, rest] = splitProps(props as TextAreaRootProps, ['class'])

	return <TextFieldPrimitive class={cn('space-y-1', local.class)} {...rest} />
}

export type TextAreaLabelProps<T extends ValidComponent = 'label'> = TextFieldLabelProps<T> & {
	class?: string
}

/**
 * TextAreaLabel - Label for the textarea field.
 */
export const TextAreaLabel = <T extends ValidComponent = 'label'>(
	props: PolymorphicProps<T, TextAreaLabelProps<T>>,
) => {
	const [local, rest] = splitProps(props as TextAreaLabelProps, ['class'])

	return <TextFieldPrimitive.Label class={cn(textAreaLabelVariants(), local.class)} {...rest} />
}

export type TextAreaTextAreaProps<T extends ValidComponent = 'textarea'> = VoidProps<
	TextFieldTextAreaProps<T> & VariantProps<typeof textAreaVariants> & { class?: string }
>

/**
 * TextAreaTextArea - The actual textarea input element.
 *
 * @example
 * ```tsx
 * <TextAreaRoot>
 *   <TextAreaLabel>Description</TextAreaLabel>
 *   <TextAreaTextArea placeholder="Enter description..." resize="vertical" />
 * </TextAreaRoot>
 * ```
 *
 * @example With error handling
 * ```tsx
 * <TextAreaRoot validationState="invalid">
 *   <TextAreaLabel>Bio</TextAreaLabel>
 *   <TextAreaTextArea placeholder="Tell us about yourself..." />
 *   <TextAreaErrorMessage>Bio is required</TextAreaErrorMessage>
 * </TextAreaRoot>
 * ```
 */
export const TextAreaTextArea = <T extends ValidComponent = 'textarea'>(
	props: PolymorphicProps<T, TextAreaTextAreaProps<T>>,
) => {
	const [local, rest] = splitProps(props as TextAreaTextAreaProps, ['class', 'resize'])

	return <TextFieldPrimitive.TextArea class={cn(textAreaVariants({ resize: local.resize }), local.class)} {...rest} />
}

export type TextAreaDescriptionProps<T extends ValidComponent = 'div'> = TextFieldDescriptionProps<T> & {
	class?: string
}

/**
 * TextAreaDescription - Helper text for the textarea field.
 */
export const TextAreaDescription = <T extends ValidComponent = 'div'>(
	props: PolymorphicProps<T, TextAreaDescriptionProps<T>>,
) => {
	const [local, rest] = splitProps(props as TextAreaDescriptionProps, ['class'])

	return (
		<TextFieldPrimitive.Description
			class={cn(textAreaLabelVariants({ description: true, label: false }), local.class)}
			{...rest}
		/>
	)
}

export type TextAreaErrorMessageProps<T extends ValidComponent = 'div'> = TextFieldErrorMessageProps<T> & {
	class?: string
}

/**
 * TextAreaErrorMessage - Error message for the textarea field.
 */
export const TextAreaErrorMessage = <T extends ValidComponent = 'div'>(
	props: PolymorphicProps<T, TextAreaErrorMessageProps<T>>,
) => {
	const [local, rest] = splitProps(props as TextAreaErrorMessageProps, ['class'])

	return (
		<TextFieldPrimitive.ErrorMessage class={cn(textAreaLabelVariants({ error: true }), local.class)} {...rest} />
	)
}

/**
 * @deprecated Use TextAreaTextArea instead. This will be removed in a future version.
 */
export const TextArea = TextAreaTextArea
