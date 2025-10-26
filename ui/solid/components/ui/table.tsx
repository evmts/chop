import { type ComponentProps, splitProps } from 'solid-js'
import { cn } from '~/lib/cn'

/**
 * Table component - Wrapper for data tables with responsive overflow handling.
 *
 * @example
 * ```tsx
 * <Table>
 *   <TableHeader>
 *     <TableRow>
 *       <TableHead>Name</TableHead>
 *     </TableRow>
 *   </TableHeader>
 *   <TableBody>
 *     <TableRow>
 *       <TableCell>John Doe</TableCell>
 *     </TableRow>
 *   </TableBody>
 * </Table>
 * ```
 */
export const Table = (props: ComponentProps<'table'>) => {
	const [local, rest] = splitProps(props, ['class'])

	return (
		<div class="w-full overflow-auto">
			<table class={cn('w-full caption-bottom text-sm', local.class)} {...rest} />
		</div>
	)
}

/**
 * TableHeader - Contains the header rows of the table.
 */
export const TableHeader = (props: ComponentProps<'thead'>) => {
	const [local, rest] = splitProps(props, ['class'])

	return <thead class={cn('[&_tr]:border-b', local.class)} {...rest} />
}

/**
 * TableBody - Contains the data rows of the table.
 */
export const TableBody = (props: ComponentProps<'tbody'>) => {
	const [local, rest] = splitProps(props, ['class'])

	return <tbody class={cn('[&_tr:last-child]:border-0', local.class)} {...rest} />
}

/**
 * TableFooter - Contains the footer rows of the table. Fixed from rendering <tbody> to <tfoot>.
 */
export const TableFooter = (props: ComponentProps<'tfoot'>) => {
	const [local, rest] = splitProps(props, ['class'])

	return <tfoot class={cn('bg-primary font-medium text-primary-foreground', local.class)} {...rest} />
}

/**
 * TableRow - Represents a single row in the table.
 * Supports selection state via data-state="selected".
 */
export const TableRow = (props: ComponentProps<'tr'>) => {
	const [local, rest] = splitProps(props, ['class'])

	return (
		<tr
			class={cn('border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted', local.class)}
			{...rest}
		/>
	)
}

/**
 * TableHead - Header cell component with proper semantics for column headers.
 * Supports sorting via aria-sort attribute and checkboxes for selection.
 */
export const TableHead = (props: ComponentProps<'th'>) => {
	const [local, rest] = splitProps(props, ['class'])

	return (
		<th
			class={cn(
				'h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
				local.class,
			)}
			{...rest}
		/>
	)
}

/**
 * TableCell - Data cell component for table content.
 * Supports checkboxes for selection with proper alignment.
 */
export const TableCell = (props: ComponentProps<'td'>) => {
	const [local, rest] = splitProps(props, ['class'])

	return (
		<td
			class={cn('p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]', local.class)}
			{...rest}
		/>
	)
}

/**
 * TableCaption - Provides a caption/description for the table.
 * Should describe the purpose of the table for accessibility.
 */
export const TableCaption = (props: ComponentProps<'caption'>) => {
	const [local, rest] = splitProps(props, ['class'])

	return <caption class={cn('mt-4 text-muted-foreground text-sm', local.class)} {...rest} />
}
