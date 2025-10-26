import type { VariantProps } from 'class-variance-authority'
import { type ComponentProps, splitProps } from 'solid-js'
import { cn } from '~/lib/cn'
import { badgeVariants } from './ui/badge'

/**
 * Code component for displaying inline code snippets.
 * Uses semantic HTML `<code>` element with badge styling.
 *
 * @example
 * ```tsx
 * <Code>const x = 42</Code>
 * <Code variant="default">0x1234</Code>
 * ```
 */
export type CodeProps = ComponentProps<'code'> & VariantProps<typeof badgeVariants>

const Code = (props: CodeProps) => {
	const [local, rest] = splitProps(props, ['class', 'variant', 'size'])

	return (
		<code
			class={cn(
				badgeVariants({
					variant: local.variant ?? 'secondary',
					size: local.size,
				}),
				'px-1 font-medium font-mono',
				local.class,
			)}
			{...rest}
		/>
	)
}

export default Code
