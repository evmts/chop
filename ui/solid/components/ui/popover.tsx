import type { PolymorphicProps } from '@kobalte/core/polymorphic'
import type { PopoverContentProps, PopoverRootProps } from '@kobalte/core/popover'
import { Popover as PopoverPrimitive } from '@kobalte/core/popover'
import { Show, type ParentProps, type ValidComponent } from 'solid-js'
import { mergeProps, splitProps } from 'solid-js'
import { cn } from '~/lib/cn'

/**
 * Popover primitive components from Kobalte.
 */
export const PopoverTrigger = PopoverPrimitive.Trigger
export const PopoverTitle = PopoverPrimitive.Title
export const PopoverDescription = PopoverPrimitive.Description
export const PopoverArrow = PopoverPrimitive.Arrow

/**
 * Popover root component with default positioning.
 *
 * @example
 * ```tsx
 * <Popover>
 *   <PopoverTrigger>Open</PopoverTrigger>
 *   <PopoverContent>
 *     <PopoverTitle>Title</PopoverTitle>
 *     <PopoverDescription>Description</PopoverDescription>
 *   </PopoverContent>
 * </Popover>
 * ```
 */
export const Popover = (props: PopoverRootProps) => {
	const merge = mergeProps<PopoverRootProps[]>(
		{
			gutter: 4,
			flip: false,
		},
		props,
	)

	return <PopoverPrimitive {...merge} />
}

/**
 * PopoverContent component with optional close button.
 *
 * @example
 * ```tsx
 * <PopoverContent>Content here</PopoverContent>
 * <PopoverContent showCloseButton={false}>No close button</PopoverContent>
 * ```
 */
export type PopoverContentProps<T extends ValidComponent = 'div'> = ParentProps<
	PopoverContentProps<T> & {
		class?: string
		/** Whether to show the close button. Defaults to true. */
		showCloseButton?: boolean
	}
>

export const PopoverContent = <T extends ValidComponent = 'div'>(
	props: PolymorphicProps<T, PopoverContentProps<T>>,
) => {
	const merged = mergeProps({ showCloseButton: true }, props)
	const [local, rest] = splitProps(merged as PopoverContentProps, ['class', 'children', 'showCloseButton'])

	return (
		<PopoverPrimitive.Portal>
			<PopoverPrimitive.Content
				class={cn(
					'data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95 z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[closed]:animate-out data-[expanded]:animate-in',
					local.class,
				)}
				{...rest}
			>
				{local.children}
				<Show when={local.showCloseButton}>
					<PopoverPrimitive.CloseButton class="absolute top-4 right-4 rounded-sm opacity-70 ring-offset-background transition-[opacity,box-shadow] hover:opacity-100 focus:outline-none focus:ring-[1.5px] focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="h-4 w-4">
							<title>Close</title>
							<path
								fill="none"
								stroke="currentColor"
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M18 6L6 18M6 6l12 12"
							/>
						</svg>
					</PopoverPrimitive.CloseButton>
				</Show>
			</PopoverPrimitive.Content>
		</PopoverPrimitive.Portal>
	)
}
