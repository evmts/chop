import type { CheckboxControlProps } from '@kobalte/core/checkbox'
import { Checkbox as CheckboxPrimitive } from '@kobalte/core/checkbox'
import type { PolymorphicProps } from '@kobalte/core/polymorphic'
import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'
import { Show, type ValidComponent, type VoidProps } from 'solid-js'
import { splitProps } from 'solid-js'
import { cn } from '~/lib/cn'

/**
 * Checkbox primitive components from Kobalte.
 * Use these for building custom checkbox layouts.
 */
export const CheckboxLabel = CheckboxPrimitive.Label
export const Checkbox = CheckboxPrimitive
export const CheckboxErrorMessage = CheckboxPrimitive.ErrorMessage
export const CheckboxDescription = CheckboxPrimitive.Description

export const checkboxVariants = cva(
	'shrink-0 rounded-sm border border-primary shadow transition-shadow focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring data-[disabled]:cursor-not-allowed data-[checked]:bg-primary data-[checked]:text-primary-foreground data-[indeterminate]:bg-primary data-[indeterminate]:text-primary-foreground data-[disabled]:opacity-50',
	{
		variants: {
			size: {
				sm: 'h-3 w-3',
				md: 'h-4 w-4',
				lg: 'h-5 w-5',
			},
		},
		defaultVariants: {
			size: 'md',
		},
	},
)

/**
 * CheckboxControl component with size variants and indeterminate state support.
 *
 * @example
 * ```tsx
 * <Checkbox>
 *   <CheckboxControl />
 *   <CheckboxLabel>Accept terms</CheckboxLabel>
 * </Checkbox>
 *
 * <Checkbox indeterminate>
 *   <CheckboxControl size="lg" />
 *   <CheckboxLabel>Select all</CheckboxLabel>
 * </Checkbox>
 * ```
 */
export type CheckboxControlProps<T extends ValidComponent = 'div'> = VoidProps<
	CheckboxControlProps<T> & VariantProps<typeof checkboxVariants> & { class?: string }
>

export const CheckboxControl = <T extends ValidComponent = 'div'>(
	props: PolymorphicProps<T, CheckboxControlProps<T>>,
) => {
	const [local, rest] = splitProps(props as CheckboxControlProps, ['class', 'children', 'size'])

	const iconSize = () => {
		switch (local.size) {
			case 'sm':
				return 'h-3 w-3'
			case 'lg':
				return 'h-5 w-5'
			default:
				return 'h-4 w-4'
		}
	}

	return (
		<>
			<CheckboxPrimitive.Input class="[&:focus-visible+div]:outline-none [&:focus-visible+div]:ring-[1.5px] [&:focus-visible+div]:ring-ring [&:focus-visible+div]:ring-offset-2 [&:focus-visible+div]:ring-offset-background" />
			<CheckboxPrimitive.Control
				class={cn(
					checkboxVariants({
						size: local.size,
					}),
					local.class,
				)}
				{...rest}
			>
				<CheckboxPrimitive.Indicator class="flex items-center justify-center text-current">
					{/* Show checkmark when checked */}
					<Show when={!rest.indeterminate}>
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class={iconSize()}>
							<path
								fill="none"
								stroke="currentColor"
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="m5 12l5 5L20 7"
							/>
							<title>Checkbox checked</title>
						</svg>
					</Show>
					{/* Show minus icon when indeterminate */}
					<Show when={rest.indeterminate}>
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class={iconSize()}>
							<path
								fill="none"
								stroke="currentColor"
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M5 12h14"
							/>
							<title>Checkbox indeterminate</title>
						</svg>
					</Show>
				</CheckboxPrimitive.Indicator>
			</CheckboxPrimitive.Control>
		</>
	)
}
