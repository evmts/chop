import type { PolymorphicProps } from '@kobalte/core/polymorphic'
import type { SwitchControlProps as KobalteSwitchControlProps, SwitchThumbProps as KobalteSwitchThumbProps } from '@kobalte/core/switch'
import { Switch as SwitchPrimitive } from '@kobalte/core/switch'
import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'
import type { ParentProps, ValidComponent, VoidProps } from 'solid-js'
import { splitProps } from 'solid-js'
import { cn } from '~/lib/cn'

/**
 * Switch - Root component for toggle switches.
 *
 * @example
 * ```tsx
 * <Switch>
 *   <SwitchLabel>Enable notifications</SwitchLabel>
 *   <SwitchControl size="md">
 *     <SwitchThumb />
 *   </SwitchControl>
 * </Switch>
 * ```
 */
export const Switch = SwitchPrimitive
export const SwitchLabel = SwitchPrimitive.Label
export const SwitchErrorMessage = SwitchPrimitive.ErrorMessage
export const SwitchDescription = SwitchPrimitive.Description

const switchControlVariants = cva(
	'inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-input shadow-sm transition-[color,background-color,box-shadow] data-[disabled]:cursor-not-allowed data-[checked]:bg-primary data-[disabled]:opacity-50',
	{
		variants: {
			size: {
				sm: 'h-4 w-7',
				md: 'h-5 w-9',
				lg: 'h-6 w-11',
			},
		},
		defaultVariants: {
			size: 'md',
		},
	},
)

const switchThumbVariants = cva(
	'pointer-events-none block rounded-full bg-background shadow-lg ring-0 transition-transform data-[checked]:translate-x-full',
	{
		variants: {
			size: {
				sm: 'h-3 w-3 data-[checked]:translate-x-3',
				md: 'h-4 w-4 data-[checked]:translate-x-4',
				lg: 'h-5 w-5 data-[checked]:translate-x-5',
			},
		},
		defaultVariants: {
			size: 'md',
		},
	},
)

export type SwitchControlProps<T extends ValidComponent = 'input'> = ParentProps<
	KobalteSwitchControlProps<T> & VariantProps<typeof switchControlVariants> & { class?: string }
>

/**
 * SwitchControl - The interactive control element of the switch.
 */
export const SwitchControl = <T extends ValidComponent = 'input'>(
	props: PolymorphicProps<T, SwitchControlProps<T>>,
) => {
	const [local, rest] = splitProps(props as SwitchControlProps, ['class', 'children', 'size'])

	return (
		<>
			<SwitchPrimitive.Input class="[&:focus-visible+div]:outline-none [&:focus-visible+div]:ring-[1.5px] [&:focus-visible+div]:ring-ring [&:focus-visible+div]:ring-offset-2 [&:focus-visible+div]:ring-offset-background" />
			<SwitchPrimitive.Control
				class={cn(switchControlVariants({ size: local.size }), local.class)}
				{...rest}
			>
				{local.children}
			</SwitchPrimitive.Control>
		</>
	)
}

export type SwitchThumbProps<T extends ValidComponent = 'div'> = VoidProps<
	KobalteSwitchThumbProps<T> & VariantProps<typeof switchThumbVariants> & { class?: string }
>

/**
 * SwitchThumb - The thumb element that slides when the switch is toggled.
 */
export const SwitchThumb = <T extends ValidComponent = 'div'>(props: PolymorphicProps<T, SwitchThumbProps<T>>) => {
	const [local, rest] = splitProps(props as SwitchThumbProps, ['class', 'size'])

	return (
		<SwitchPrimitive.Thumb
			class={cn(switchThumbVariants({ size: local.size }), local.class)}
			{...rest}
		/>
	)
}
