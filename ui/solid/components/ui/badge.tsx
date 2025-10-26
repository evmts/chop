import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'
import { type ComponentProps, splitProps } from 'solid-js'
import { cn } from '~/lib/cn'

export const badgeVariants = cva(
	'inline-flex items-center rounded-sm border font-semibold transition-shadow focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring',
	{
		variants: {
			variant: {
				default: 'border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80',
				secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
				destructive: 'border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80',
				outline: 'text-foreground',
			},
			size: {
				sm: 'px-2 py-0.5 text-xs',
				md: 'px-2.5 py-0.5 text-xs',
				lg: 'px-3 py-1 text-sm',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'md',
		},
	},
)

/**
 * Badge component for displaying small pieces of information like tags or statuses.
 *
 * @example
 * ```tsx
 * <Badge>Default</Badge>
 * <Badge variant="secondary">Secondary</Badge>
 * <Badge variant="destructive" size="lg">Error</Badge>
 * ```
 */
export type BadgeProps = VariantProps<typeof badgeVariants> & ComponentProps<'span'>

export const Badge = (props: BadgeProps) => {
	const [local, rest] = splitProps(props, ['class', 'variant', 'size'])

	return (
		<span
			class={cn(
				badgeVariants({
					variant: local.variant,
					size: local.size,
				}),
				local.class,
			)}
			{...rest}
		/>
	)
}
