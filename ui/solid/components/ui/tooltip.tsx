import type { PolymorphicProps } from '@kobalte/core/polymorphic'
import type { TooltipContentProps, TooltipRootProps } from '@kobalte/core/tooltip'
import { Tooltip as TooltipPrimitive } from '@kobalte/core/tooltip'
import { mergeProps, splitProps, type ParentProps, type ValidComponent } from 'solid-js'
import { cn } from '~/lib/cn'

/**
 * Tooltip primitive components from Kobalte.
 */
export const TooltipTrigger = TooltipPrimitive.Trigger
export const TooltipArrow = TooltipPrimitive.Arrow

/**
 * Tooltip root component with configurable delays.
 *
 * @example
 * ```tsx
 * <Tooltip>
 *   <TooltipTrigger>Hover me</TooltipTrigger>
 *   <TooltipContent>
 *     Helpful information
 *     <TooltipArrow />
 *   </TooltipContent>
 * </Tooltip>
 *
 * <Tooltip openDelay={500} closeDelay={200}>
 *   <TooltipTrigger>Custom delays</TooltipTrigger>
 *   <TooltipContent>Slower open, faster close</TooltipContent>
 * </Tooltip>
 * ```
 */
export const Tooltip = (props: TooltipRootProps) => {
	const merge = mergeProps<TooltipRootProps[]>(
		{
			gutter: 4,
			flip: false,
			openDelay: 700,
			closeDelay: 300,
		},
		props,
	)

	return <TooltipPrimitive {...merge} />
}

/**
 * TooltipContent component for the tooltip popup.
 */
export type TooltipContentProps<T extends ValidComponent = 'div'> = ParentProps<
	TooltipContentProps<T> & {
		class?: string
	}
>

export const TooltipContent = <T extends ValidComponent = 'div'>(
	props: PolymorphicProps<T, TooltipContentProps<T>>,
) => {
	const [local, rest] = splitProps(props as TooltipContentProps, ['class', 'children'])

	return (
		<TooltipPrimitive.Portal>
			<TooltipPrimitive.Content
				class={cn(
					'data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95 z-50 overflow-hidden rounded-sm bg-primary px-3 py-1.5 text-primary-foreground text-xs data-[closed]:animate-out data-[expanded]:animate-in',
					local.class,
				)}
				{...rest}
			>
				{local.children}
			</TooltipPrimitive.Content>
		</TooltipPrimitive.Portal>
	)
}
