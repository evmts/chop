import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'
import { type ComponentProps, splitProps } from 'solid-js'
import { cn } from '~/lib/cn'

const skeletonVariants = cva('rounded-sm bg-primary/10', {
	variants: {
		animation: {
			pulse: 'animate-pulse',
			wave: 'animate-shimmer bg-gradient-to-r from-primary/10 via-primary/20 to-primary/10 bg-[length:200%_100%]',
			none: '',
		},
	},
	defaultVariants: {
		animation: 'pulse',
	},
})

export type SkeletonProps = ComponentProps<'div'> & VariantProps<typeof skeletonVariants>

/**
 * Skeleton - A placeholder for loading content.
 *
 * @example Basic skeleton
 * ```tsx
 * <Skeleton class="h-12 w-full" />
 * ```
 *
 * @example Skeleton with different animations
 * ```tsx
 * <Skeleton animation="wave" class="h-4 w-32" />
 * <Skeleton animation="pulse" class="h-4 w-24" />
 * <Skeleton animation="none" class="h-4 w-16" />
 * ```
 *
 * @example Card skeleton
 * ```tsx
 * <div class="space-y-3">
 *   <Skeleton class="h-32 w-full" />
 *   <Skeleton class="h-4 w-3/4" />
 *   <Skeleton class="h-4 w-1/2" />
 * </div>
 * ```
 */
export const Skeleton = (props: SkeletonProps) => {
	const [local, rest] = splitProps(props, ['class', 'animation'])

	return (
		<div
			aria-hidden="true"
			class={cn(skeletonVariants({ animation: local.animation }), local.class)}
			{...rest}
		/>
	)
}
