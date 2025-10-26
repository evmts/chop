import type { PolymorphicProps } from '@kobalte/core/polymorphic'
import type {
	TextFieldDescriptionProps,
	TextFieldErrorMessageProps,
	TextFieldInputProps,
	TextFieldLabelProps,
	TextFieldRootProps,
} from '@kobalte/core/text-field'
import { TextField as TextFieldPrimitive } from '@kobalte/core/text-field'
import { cva } from 'class-variance-authority'
import type { ValidComponent, VoidProps } from 'solid-js'
import { splitProps } from 'solid-js'
import { cn } from '~/lib/cn'

export type TextFieldRootProps<T extends ValidComponent = 'div'> = import('@kobalte/core/text-field').TextFieldRootProps<T> & {
	class?: string
}

/**
 * TextFieldRoot - Root container for the text field component.
 *
 * @example
 * ```tsx
 * <TextFieldRoot>
 *   <TextFieldLabel>Email</TextFieldLabel>
 *   <TextFieldInput type="email" placeholder="Enter email..." />
 *   <TextFieldDescription>We'll never share your email.</TextFieldDescription>
 * </TextFieldRoot>
 * ```
 */
export const TextFieldRoot = <T extends ValidComponent = 'div'>(props: PolymorphicProps<T, TextFieldRootProps<T>>) => {
	const [local, rest] = splitProps(props as TextFieldRootProps, ['class'])

	return <TextFieldPrimitive class={cn('space-y-1', local.class)} {...rest} />
}

export const textfieldLabel = cva('text-sm data-[disabled]:cursor-not-allowed data-[disabled]:opacity-70 font-medium', {
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

export type TextFieldLabelProps<T extends ValidComponent = 'label'> = import('@kobalte/core/text-field').TextFieldLabelProps<T> & {
	class?: string
}

/**
 * TextFieldLabel - Label for the text field.
 */
export const TextFieldLabel = <T extends ValidComponent = 'label'>(
	props: PolymorphicProps<T, TextFieldLabelProps<T>>,
) => {
	const [local, rest] = splitProps(props as TextFieldLabelProps, ['class'])

	return <TextFieldPrimitive.Label class={cn(textfieldLabel(), local.class)} {...rest} />
}

export type TextFieldErrorMessageProps<T extends ValidComponent = 'div'> = import('@kobalte/core/text-field').TextFieldErrorMessageProps<T> & {
	class?: string
}

/**
 * TextFieldErrorMessage - Error message for the text field.
 */
export const TextFieldErrorMessage = <T extends ValidComponent = 'div'>(
	props: PolymorphicProps<T, TextFieldErrorMessageProps<T>>,
) => {
	const [local, rest] = splitProps(props as TextFieldErrorMessageProps, ['class'])

	return <TextFieldPrimitive.ErrorMessage class={cn(textfieldLabel({ error: true }), local.class)} {...rest} />
}

export type TextFieldDescriptionProps<T extends ValidComponent = 'div'> = import('@kobalte/core/text-field').TextFieldDescriptionProps<T> & {
	class?: string
}

/**
 * TextFieldDescription - Helper text for the text field.
 */
export const TextFieldDescription = <T extends ValidComponent = 'div'>(
	props: PolymorphicProps<T, TextFieldDescriptionProps<T>>,
) => {
	const [local, rest] = splitProps(props as TextFieldDescriptionProps, ['class'])

	return (
		<TextFieldPrimitive.Description
			class={cn(textfieldLabel({ description: true, label: false }), local.class)}
			{...rest}
		/>
	)
}

export type TextFieldInputProps<T extends ValidComponent = 'input'> = VoidProps<
	import('@kobalte/core/text-field').TextFieldInputProps<T> & {
		class?: string
	}
>

/**
 * TextFieldInput - The actual text input element.
 *
 * @example Basic usage
 * ```tsx
 * <TextFieldRoot>
 *   <TextFieldLabel>Username</TextFieldLabel>
 *   <TextFieldInput placeholder="Enter username..." />
 * </TextFieldRoot>
 * ```
 *
 * @example With icons (use wrapper div)
 * ```tsx
 * <TextFieldRoot>
 *   <TextFieldLabel>Search</TextFieldLabel>
 *   <div class="relative">
 *     <SearchIcon class="absolute left-3 top-1/2 -translate-y-1/2" />
 *     <TextFieldInput class="pl-10" placeholder="Search..." />
 *   </div>
 * </TextFieldRoot>
 * ```
 */
export const TextFieldInput = <T extends ValidComponent = 'input'>(props: PolymorphicProps<T, TextFieldInputProps<T>>) => {
	const [local, rest] = splitProps(props as TextFieldInputProps, ['class'])

	return (
		<TextFieldPrimitive.Input
			class={cn(
				'flex h-9 w-full rounded-sm border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-shadow file:border-0 file:bg-transparent file:font-medium file:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
				local.class,
			)}
			{...rest}
		/>
	)
}

/**
 * @deprecated Use TextFieldInput instead. This will be removed in a future version.
 */
export const TextField = TextFieldInput
