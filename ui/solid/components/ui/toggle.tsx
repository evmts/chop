import type { PolymorphicProps } from '@kobalte/core/polymorphic'
import type { ToggleButtonRootProps } from '@kobalte/core/toggle-button'
import { ToggleButton as ToggleButtonPrimitive } from '@kobalte/core/toggle-button'
import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'
import type { ValidComponent } from 'solid-js'
import { splitProps } from 'solid-js'
import { cn } from '~/lib/cn'

export const toggleVariants = cva(
	'inline-flex items-center justify-center rounded-sm text-sm font-medium transition-[box-shadow,color,background-color] hover:bg-muted focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[pressed]:bg-accent data-[pressed]:text-accent-foreground',
	{
		variants: {
			variant: {
				default: 'bg-transparent',
				outline: 'border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground',
			},
			size: {
				default: 'h-9 px-3',
				sm: 'h-8 px-2',
				lg: 'h-10 px-3',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	},
)

export type ToggleButtonProps<T extends ValidComponent = 'button'> = ToggleButtonRootProps<T> &
	VariantProps<typeof toggleVariants> & {
		class?: string
	}

/**
 * ToggleButton - A two-state button that can be toggled on or off.
 *
 * @example
 * ```tsx
 * <ToggleButton pressed={isPressed()} onChange={setIsPressed}>
 *   <BoldIcon />
 * </ToggleButton>
 * ```
 *
 * @example With variants
 * ```tsx
 * <ToggleButton variant="outline" size="sm">
 *   Toggle me
 * </ToggleButton>
 * ```
 */
export const ToggleButton = <T extends ValidComponent = 'button'>(props: PolymorphicProps<T, ToggleButtonProps<T>>) => {
	const [local, rest] = splitProps(props as ToggleButtonProps, ['class', 'variant', 'size'])

	return (
		<ToggleButtonPrimitive
			class={cn(toggleVariants({ variant: local.variant, size: local.size }), local.class)}
			{...rest}
		/>
	)
}

/**
 * Toggle namespace for related components.
 */
export const Toggle = Object.assign(ToggleButton, {
	Label: ToggleButtonPrimitive.Label,
	ErrorMessage: ToggleButtonPrimitive.ErrorMessage,
	Description: ToggleButtonPrimitive.Description,
})

export const ToggleLabel = ToggleButtonPrimitive.Label
export const ToggleErrorMessage = ToggleButtonPrimitive.ErrorMessage
export const ToggleDescription = ToggleButtonPrimitive.Description
