import type { PolymorphicProps } from '@kobalte/core/polymorphic'
import type { SeparatorRootProps } from '@kobalte/core/separator'
import { Separator as SeparatorPrimitive } from '@kobalte/core/separator'
import type { ValidComponent } from 'solid-js'
import { splitProps } from 'solid-js'
import { cn } from '~/lib/cn'

export type SeparatorProps<T extends ValidComponent = 'hr'> = SeparatorRootProps<T> & {
	class?: string
}

/**
 * Separator - A visual divider between content sections.
 *
 * @example Horizontal separator
 * ```tsx
 * <div>
 *   <p>Section 1</p>
 *   <Separator orientation="horizontal" />
 *   <p>Section 2</p>
 * </div>
 * ```
 *
 * @example Vertical separator
 * ```tsx
 * <div class="flex">
 *   <span>Item 1</span>
 *   <Separator orientation="vertical" class="mx-2" />
 *   <span>Item 2</span>
 * </div>
 * ```
 */
export const Separator = <T extends ValidComponent = 'hr'>(props: PolymorphicProps<T, SeparatorProps<T>>) => {
	const [local, rest] = splitProps(props as SeparatorProps, ['class'])

	return (
		<SeparatorPrimitive
			class={cn(
				'shrink-0 bg-border data-[orientation=horizontal]:h-[1px] data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-[1px]',
				local.class,
			)}
			{...rest}
		/>
	)
}
