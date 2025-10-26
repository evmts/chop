import { render, screen } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow } from './table'

describe('Table Component', () => {
	describe('Basic Rendering', () => {
		it('should render table wrapper with overflow handling', () => {
			render(() => (
				<Table>
					<TableBody>
						<TableRow>
							<TableCell>Cell</TableCell>
						</TableRow>
					</TableBody>
				</Table>
			))
			const cell = screen.getByText('Cell')
			expect(cell).toBeInTheDocument()
		})

		it('should render complete table structure', () => {
			render(() => (
				<Table data-testid="test-table">
					<TableCaption>Test Caption</TableCaption>
					<TableHeader>
						<TableRow>
							<TableHead>Header</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						<TableRow>
							<TableCell>Body Cell</TableCell>
						</TableRow>
					</TableBody>
					<TableFooter>
						<TableRow>
							<TableCell>Footer Cell</TableCell>
						</TableRow>
					</TableFooter>
				</Table>
			))

			expect(screen.getByText('Test Caption')).toBeInTheDocument()
			expect(screen.getByText('Header')).toBeInTheDocument()
			expect(screen.getByText('Body Cell')).toBeInTheDocument()
			expect(screen.getByText('Footer Cell')).toBeInTheDocument()
		})
	})

	describe('Table Semantics', () => {
		it('should render table element', () => {
			const { container } = render(() => (
				<Table>
					<TableBody>
						<TableRow>
							<TableCell>Test</TableCell>
						</TableRow>
					</TableBody>
				</Table>
			))
			expect(container.querySelector('table')).toBeInTheDocument()
		})

		it('should render thead element', () => {
			const { container } = render(() => (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Header</TableHead>
						</TableRow>
					</TableHeader>
				</Table>
			))
			expect(container.querySelector('thead')).toBeInTheDocument()
		})

		it('should render tbody element', () => {
			const { container } = render(() => (
				<Table>
					<TableBody>
						<TableRow>
							<TableCell>Body</TableCell>
						</TableRow>
					</TableBody>
				</Table>
			))
			expect(container.querySelector('tbody')).toBeInTheDocument()
		})

		it('CRITICAL: should render tfoot element (not tbody)', () => {
			const { container } = render(() => (
				<Table>
					<TableFooter>
						<TableRow>
							<TableCell>Footer</TableCell>
						</TableRow>
					</TableFooter>
				</Table>
			))
			// This is the critical bug fix - TableFooter must render <tfoot>, not <tbody>
			expect(container.querySelector('tfoot')).toBeInTheDocument()
			expect(container.querySelectorAll('tbody')).toHaveLength(0)
		})

		it('should render th element for header cells', () => {
			const { container } = render(() => <TableHead>Header</TableHead>)
			expect(container.querySelector('th')).toBeInTheDocument()
		})

		it('should render td element for data cells', () => {
			const { container } = render(() => <TableCell>Data</TableCell>)
			expect(container.querySelector('td')).toBeInTheDocument()
		})

		it('should render caption element', () => {
			const { container } = render(() => <TableCaption>Caption</TableCaption>)
			expect(container.querySelector('caption')).toBeInTheDocument()
		})
	})

	describe('Styling', () => {
		it('should apply custom class to table', () => {
			const { container } = render(() => (
				<Table class="custom-table">
					<TableBody>
						<TableRow>
							<TableCell>Test</TableCell>
						</TableRow>
					</TableBody>
				</Table>
			))
			expect(container.querySelector('table')).toHaveClass('custom-table')
		})

		it('should support selection state on rows', () => {
			render(() => (
				<TableRow data-state="selected">
					<TableCell>Selected Row</TableCell>
				</TableRow>
			))
			const cell = screen.getByText('Selected Row')
			const row = cell.closest('tr')
			expect(row).toHaveAttribute('data-state', 'selected')
		})
	})

	describe('Accessibility', () => {
		it('should support aria-sort on header cells', () => {
			render(() => <TableHead aria-sort="ascending">Sortable</TableHead>)
			const header = screen.getByText('Sortable')
			expect(header).toHaveAttribute('aria-sort', 'ascending')
		})

		it('should support checkboxes with proper role', () => {
			render(() => (
				<TableHead>
					<input type="checkbox" role="checkbox" />
				</TableHead>
			))
			const checkbox = screen.getByRole('checkbox')
			expect(checkbox).toBeInTheDocument()
		})

		it('should have proper caption for accessibility', () => {
			render(() => (
				<Table>
					<TableCaption>User data table</TableCaption>
					<TableBody>
						<TableRow>
							<TableCell>Data</TableCell>
						</TableRow>
					</TableBody>
				</Table>
			))
			expect(screen.getByText('User data table')).toBeInTheDocument()
		})
	})

	describe('Custom Attributes', () => {
		it('should accept data attributes', () => {
			render(() => (
				<TableRow data-testid="custom-row" data-index="1">
					<TableCell>Test</TableCell>
				</TableRow>
			))
			const row = screen.getByTestId('custom-row')
			expect(row).toHaveAttribute('data-index', '1')
		})
	})
})
