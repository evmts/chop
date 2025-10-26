import type { Component, ComponentProps, ParentComponent, ValidComponent } from 'solid-js'
import { splitProps } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { cn } from '~/lib/cn'

/**
 * Card component for grouping related content.
 *
 * @example
 * ```tsx
 * <Card>
 *   <CardHeader>
 *     <CardTitle>Title</CardTitle>
 *     <CardDescription>Description</CardDescription>
 *   </CardHeader>
 *   <CardContent>Content here</CardContent>
 *   <CardFooter>Footer actions</CardFooter>
 * </Card>
 * ```
 */
export const Card: ParentComponent<ComponentProps<'div'>> = (props) => {
	const [local, rest] = splitProps(props, ['class'])

	return <div class={cn('rounded-sm border bg-card text-card-foreground shadow-sm', local.class)} {...rest} />
}

/**
 * CardHeader component for the top section of a card.
 */
export const CardHeader: ParentComponent<ComponentProps<'div'>> = (props) => {
	const [local, rest] = splitProps(props, ['class'])

	return <div class={cn('flex flex-col space-y-1.5 p-6', local.class)} {...rest} />
}

/**
 * CardTitle component for the card heading.
 * Defaults to h3 for proper semantic structure, but can be customized with the 'as' prop.
 *
 * @example
 * ```tsx
 * <CardTitle>Default h3 heading</CardTitle>
 * <CardTitle as="h2">Custom h2 heading</CardTitle>
 * ```
 */
export type CardTitleProps<T extends ValidComponent = 'h3'> = ComponentProps<T> & {
	as?: T
}

export const CardTitle = <T extends ValidComponent = 'h3'>(props: CardTitleProps<T>) => {
	const [local, rest] = splitProps(props, ['class', 'as'])

	return (
		<Dynamic
			component={local.as || 'h3'}
			class={cn('font-semibold leading-none tracking-tight', local.class)}
			{...rest}
		/>
	)
}

/**
 * CardDescription component for additional context below the title.
 */
export const CardDescription: ParentComponent<ComponentProps<'p'>> = (props) => {
	const [local, rest] = splitProps(props, ['class'])

	return <p class={cn('text-muted-foreground text-sm', local.class)} {...rest} />
}

/**
 * CardContent component for the main content area.
 */
export const CardContent: ParentComponent<ComponentProps<'div'>> = (props) => {
	const [local, rest] = splitProps(props, ['class'])

	return <div class={cn('p-6 pt-0', local.class)} {...rest} />
}

/**
 * CardFooter component for actions at the bottom of the card.
 */
export const CardFooter: ParentComponent<ComponentProps<'div'>> = (props) => {
	const [local, rest] = splitProps(props, ['class'])

	return <div class={cn('flex items-center p-6 pt-0', local.class)} {...rest} />
}
