import { render, screen } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './card'

describe('Card Components', () => {
	describe('Card', () => {
		it('should render card with content', () => {
			render(() => <Card>Card Content</Card>)
			expect(screen.getByText('Card Content')).toBeInTheDocument()
		})

		it('should render as div element', () => {
			render(() => <Card data-testid="card">Content</Card>)
			const card = screen.getByTestId('card')
			expect(card.tagName).toBe('DIV')
		})

		it('should have default card styles', () => {
			render(() => <Card data-testid="card">Content</Card>)
			const card = screen.getByTestId('card')
			expect(card).toHaveClass('rounded-sm')
			expect(card).toHaveClass('border')
			expect(card).toHaveClass('bg-card')
			expect(card).toHaveClass('shadow-sm')
		})

		it('should accept custom className', () => {
			render(() => <Card class="custom-card">Content</Card>)
			const card = screen.getByText('Content')
			expect(card).toHaveClass('custom-card')
		})
	})

	describe('CardHeader', () => {
		it('should render card header', () => {
			render(() => <CardHeader>Header Content</CardHeader>)
			expect(screen.getByText('Header Content')).toBeInTheDocument()
		})

		it('should have header styles', () => {
			render(() => <CardHeader data-testid="header">Header</CardHeader>)
			const header = screen.getByTestId('header')
			expect(header).toHaveClass('flex')
			expect(header).toHaveClass('flex-col')
			expect(header).toHaveClass('space-y-1.5')
			expect(header).toHaveClass('p-6')
		})

		it('should accept custom className', () => {
			render(() => <CardHeader class="custom-header">Header</CardHeader>)
			const header = screen.getByText('Header')
			expect(header).toHaveClass('custom-header')
		})
	})

	describe('CardTitle', () => {
		it('should render card title', () => {
			render(() => <CardTitle>Title Text</CardTitle>)
			expect(screen.getByText('Title Text')).toBeInTheDocument()
		})

		it('should render as h3 by default for proper semantic structure', () => {
			render(() => <CardTitle data-testid="title">Title</CardTitle>)
			const title = screen.getByTestId('title')
			expect(title.tagName).toBe('H3')
		})

		it('should have title styles', () => {
			render(() => <CardTitle data-testid="title">Title</CardTitle>)
			const title = screen.getByTestId('title')
			expect(title).toHaveClass('font-semibold')
			expect(title).toHaveClass('leading-none')
			expect(title).toHaveClass('tracking-tight')
		})

		it('should support custom element with as prop', () => {
			render(() => (
				<CardTitle as="h2" data-testid="title">
					Custom H2
				</CardTitle>
			))
			const title = screen.getByTestId('title')
			expect(title.tagName).toBe('H2')
		})

		it('should support h1 with as prop when needed', () => {
			render(() => (
				<CardTitle as="h1" data-testid="title">
					Main Title
				</CardTitle>
			))
			const title = screen.getByTestId('title')
			expect(title.tagName).toBe('H1')
		})

		it('should support h4 with as prop', () => {
			render(() => (
				<CardTitle as="h4" data-testid="title">
					Subtitle
				</CardTitle>
			))
			const title = screen.getByTestId('title')
			expect(title.tagName).toBe('H4')
		})

		it('should accept custom className', () => {
			render(() => <CardTitle class="custom-title">Title</CardTitle>)
			const title = screen.getByText('Title')
			expect(title).toHaveClass('custom-title')
		})
	})

	describe('CardDescription', () => {
		it('should render card description', () => {
			render(() => <CardDescription>Description text</CardDescription>)
			expect(screen.getByText('Description text')).toBeInTheDocument()
		})

		it('should render as paragraph element', () => {
			render(() => <CardDescription data-testid="desc">Description</CardDescription>)
			const desc = screen.getByTestId('desc')
			expect(desc.tagName).toBe('P')
		})

		it('should have description styles', () => {
			render(() => <CardDescription data-testid="desc">Description</CardDescription>)
			const desc = screen.getByTestId('desc')
			expect(desc).toHaveClass('text-muted-foreground')
			expect(desc).toHaveClass('text-sm')
		})

		it('should accept custom className', () => {
			render(() => <CardDescription class="custom-desc">Description</CardDescription>)
			const desc = screen.getByText('Description')
			expect(desc).toHaveClass('custom-desc')
		})
	})

	describe('CardContent', () => {
		it('should render card content', () => {
			render(() => <CardContent>Content text</CardContent>)
			expect(screen.getByText('Content text')).toBeInTheDocument()
		})

		it('should have content styles', () => {
			render(() => <CardContent data-testid="content">Content</CardContent>)
			const content = screen.getByTestId('content')
			expect(content).toHaveClass('p-6')
			expect(content).toHaveClass('pt-0')
		})

		it('should accept custom className', () => {
			render(() => <CardContent class="custom-content">Content</CardContent>)
			const content = screen.getByText('Content')
			expect(content).toHaveClass('custom-content')
		})
	})

	describe('CardFooter', () => {
		it('should render card footer', () => {
			render(() => <CardFooter>Footer content</CardFooter>)
			expect(screen.getByText('Footer content')).toBeInTheDocument()
		})

		it('should have footer styles', () => {
			render(() => <CardFooter data-testid="footer">Footer</CardFooter>)
			const footer = screen.getByTestId('footer')
			expect(footer).toHaveClass('flex')
			expect(footer).toHaveClass('items-center')
			expect(footer).toHaveClass('p-6')
			expect(footer).toHaveClass('pt-0')
		})

		it('should accept custom className', () => {
			render(() => <CardFooter class="custom-footer">Footer</CardFooter>)
			const footer = screen.getByText('Footer')
			expect(footer).toHaveClass('custom-footer')
		})
	})

	describe('Complete Card Composition', () => {
		it('should render complete card with all components', () => {
			render(() => (
				<Card>
					<CardHeader>
						<CardTitle>Card Title</CardTitle>
						<CardDescription>Card Description</CardDescription>
					</CardHeader>
					<CardContent>Main content here</CardContent>
					<CardFooter>Footer actions</CardFooter>
				</Card>
			))

			expect(screen.getByText('Card Title')).toBeInTheDocument()
			expect(screen.getByText('Card Description')).toBeInTheDocument()
			expect(screen.getByText('Main content here')).toBeInTheDocument()
			expect(screen.getByText('Footer actions')).toBeInTheDocument()
		})

		it('should maintain proper structure hierarchy', () => {
			render(() => (
				<Card data-testid="card">
					<CardHeader data-testid="header">
						<CardTitle data-testid="title">Title</CardTitle>
					</CardHeader>
					<CardContent data-testid="content">Content</CardContent>
				</Card>
			))

			const card = screen.getByTestId('card')
			const header = screen.getByTestId('header')
			const title = screen.getByTestId('title')

			expect(card).toContainElement(header)
			expect(header).toContainElement(title)
		})
	})

	describe('Accessibility', () => {
		it('should use proper heading hierarchy with h3 by default', () => {
			render(() => (
				<>
					<h1>Page Title</h1>
					<h2>Section Title</h2>
					<Card>
						<CardHeader>
							<CardTitle>Card Title (h3)</CardTitle>
						</CardHeader>
					</Card>
				</>
			))

			const cardTitle = screen.getByText('Card Title (h3)')
			expect(cardTitle.tagName).toBe('H3')
		})

		it('should allow custom heading levels for flexible hierarchy', () => {
			render(() => (
				<Card>
					<CardHeader>
						<CardTitle as="h2">Higher Level Title</CardTitle>
					</CardHeader>
				</Card>
			))

			const title = screen.getByText('Higher Level Title')
			expect(title.tagName).toBe('H2')
		})

		it('should support ARIA attributes', () => {
			render(() => (
				<Card role="article" aria-labelledby="card-title">
					<CardHeader>
						<CardTitle id="card-title">Accessible Card</CardTitle>
					</CardHeader>
				</Card>
			))

			const card = screen.getByRole('article')
			expect(card).toHaveAttribute('aria-labelledby', 'card-title')
		})

		it('should support data attributes for testing', () => {
			render(() => (
				<Card data-testid="test-card">
					<CardHeader data-testid="test-header">
						<CardTitle data-testid="test-title">Test</CardTitle>
					</CardHeader>
				</Card>
			))

			expect(screen.getByTestId('test-card')).toBeInTheDocument()
			expect(screen.getByTestId('test-header')).toBeInTheDocument()
			expect(screen.getByTestId('test-title')).toBeInTheDocument()
		})
	})

	describe('Edge Cases', () => {
		it('should render empty card', () => {
			render(() => <Card data-testid="empty-card" />)
			expect(screen.getByTestId('empty-card')).toBeInTheDocument()
		})

		it('should render card with only title', () => {
			render(() => (
				<Card>
					<CardTitle>Only Title</CardTitle>
				</Card>
			))
			expect(screen.getByText('Only Title')).toBeInTheDocument()
		})

		it('should render card with only content', () => {
			render(() => (
				<Card>
					<CardContent>Only Content</CardContent>
				</Card>
			))
			expect(screen.getByText('Only Content')).toBeInTheDocument()
		})
	})
})
