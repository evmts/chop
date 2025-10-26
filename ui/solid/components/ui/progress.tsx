import type { PolymorphicProps } from '@kobalte/core/polymorphic'
import type { ProgressRootProps } from '@kobalte/core/progress'
import { Progress as ProgressPrimitive } from '@kobalte/core/progress'
import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'
import type { ParentProps, ValidComponent } from 'solid-js'
import { splitProps } from 'solid-js'
import { cn } from '~/lib/cn'

export const ProgressLabel = ProgressPrimitive.Label
export const ProgressValueLabel = ProgressPrimitive.ValueLabel

const progressTrackVariants = cva('overflow-hidden rounded-full bg-primary/20', {
	variants: {
		size: {
			sm: 'h-1',
			md: 'h-2',
			lg: 'h-3',
		},
	},
	defaultVariants: {
		size: 'md',
	},
})

const progressFillVariants = cva(
	'h-full w-[--kb-progress-fill-width] bg-primary transition-all duration-500 ease-linear data-[progress=complete]:bg-primary',
	{
		variants: {
			indeterminate: {
				true: 'animate-pulse',
			},
		},
	},
)

/**
 * Progress component props.
 */
export type ProgressProps<T extends ValidComponent = 'div'> = ParentProps<
	ProgressRootProps<T> &
		VariantProps<typeof progressTrackVariants> &
		VariantProps<typeof progressFillVariants> & {
			class?: string
			fillClass?: string
		}
>

/**
 * Progress - Displays an indicator showing the completion progress of a task.
 *
 * @example
 * ```tsx
 * <Progress value={60} size="md">
 *   <ProgressLabel>Loading...</ProgressLabel>
 *   <ProgressValueLabel />
 * </Progress>
 * ```
 *
 * @example Indeterminate progress
 * ```tsx
 * <Progress indeterminate>
 *   <ProgressLabel>Processing...</ProgressLabel>
 * </Progress>
 * ```
 */
export const Progress = <T extends ValidComponent = 'div'>(props: PolymorphicProps<T, ProgressProps<T>>) => {
	const [local, rest] = splitProps(props as ProgressProps, ['class', 'children', 'fillClass', 'size', 'indeterminate'])

	return (
		<ProgressPrimitive class={cn('flex w-full flex-col gap-2', local.class)} {...rest}>
			{local.children}
			<ProgressPrimitive.Track class={progressTrackVariants({ size: local.size })}>
				<ProgressPrimitive.Fill
					class={cn(progressFillVariants({ indeterminate: local.indeterminate }), local.fillClass)}
				/>
			</ProgressPrimitive.Track>
		</ProgressPrimitive>
	)
}
