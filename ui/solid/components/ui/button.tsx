import type { ButtonRootProps } from '@kobalte/core/button'
import { Button as ButtonPrimitive } from '@kobalte/core/button'
import type { PolymorphicProps } from '@kobalte/core/polymorphic'
import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'
import { Loader2 } from 'lucide-solid'
import { Show, type ValidComponent } from 'solid-js'
import { splitProps } from 'solid-js'
import { cn } from '~/lib/cn'

export const buttonVariants = cva(
	'inline-flex items-center justify-center rounded-sm text-sm font-medium transition-[color,background-color,box-shadow] focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
	{
		variants: {
			variant: {
				default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
				destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
				outline: 'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
				secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
				ghost: 'hover:bg-accent hover:text-accent-foreground',
				link: 'text-primary underline-offset-4 hover:underline',
			},
			size: {
				default: 'h-9 px-4 py-2',
				sm: 'h-8 rounded-sm px-3 text-xs',
				lg: 'h-10 rounded-sm px-8',
				icon: 'h-9 w-9',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	},
)

/**
 * Button component with Kobalte integration for accessibility.
 *
 * @example
 * ```tsx
 * <Button>Click me</Button>
 * <Button variant="destructive" size="lg">Delete</Button>
 * <Button loading>Loading...</Button>
 * ```
 */
export type ButtonProps<T extends ValidComponent = 'button'> = ButtonRootProps<T> &
	VariantProps<typeof buttonVariants> & {
		class?: string
		/** Shows a loading spinner and disables the button */
		loading?: boolean
	}

export const Button = <T extends ValidComponent = 'button'>(props: PolymorphicProps<T, ButtonProps<T>>) => {
	const [local, rest] = splitProps(props as ButtonProps, ['class', 'variant', 'size', 'loading', 'children'])

	return (
		<ButtonPrimitive
			class={cn(
				buttonVariants({
					size: local.size,
					variant: local.variant,
				}),
				local.class,
			)}
			disabled={local.loading || rest.disabled}
			{...rest}
		>
			<Show when={local.loading}>
				<Loader2 class="mr-2 h-4 w-4 animate-spin" />
			</Show>
			{local.children}
		</ButtonPrimitive>
	)
}
