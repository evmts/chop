import { type JSX, type ParentProps, createSignal } from 'solid-js'
import { ErrorBoundary as SolidErrorBoundary } from 'solid-js'

interface ErrorBoundaryProps extends ParentProps {
	fallback?: (error: Error, reset: () => void) => JSX.Element
	onError?: (error: Error) => void
}

function DefaultFallback(props: { error: Error; reset: () => void }) {
	return (
		<div class="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
			<div class="max-w-md rounded-lg border border-red-300 bg-red-50 p-6 shadow-lg dark:border-red-800 dark:bg-red-950">
				<div class="flex items-start gap-4">
					<div class="flex-shrink-0">
						<svg
							class="h-6 w-6 text-red-600 dark:text-red-400"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
							/>
						</svg>
					</div>
					<div class="flex-1">
						<h3 class="text-lg font-semibold text-red-900 dark:text-red-100">
							Something went wrong
						</h3>
						<p class="mt-2 text-sm text-red-800 dark:text-red-200">
							{props.error.message || 'An unexpected error occurred'}
						</p>
						{props.error.stack && (
							<details class="mt-3">
								<summary class="cursor-pointer text-sm font-medium text-red-700 hover:text-red-900 dark:text-red-300 dark:hover:text-red-100">
									View details
								</summary>
								<pre class="mt-2 max-h-40 overflow-auto rounded bg-red-100 p-2 text-xs text-red-900 dark:bg-red-900 dark:text-red-100">
									{props.error.stack}
								</pre>
							</details>
						)}
						<div class="mt-4 flex gap-3">
							<button
								type="button"
								onClick={() => props.reset()}
								class="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:bg-red-700 dark:hover:bg-red-600"
							>
								Try again
							</button>
							<button
								type="button"
								onClick={() => window.location.reload()}
								class="rounded border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:border-red-700 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900"
							>
								Reload page
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

export default function ErrorBoundary(props: ErrorBoundaryProps) {
	const [error, setError] = createSignal<Error | null>(null)

	const handleError = (err: Error) => {
		setError(err)
		// Log to console for debugging
		console.error('ErrorBoundary caught an error:', err)
		// Call custom error handler if provided
		props.onError?.(err)
	}

	const reset = () => {
		setError(null)
	}

	return (
		<SolidErrorBoundary
			fallback={(err) => {
				const errorObj = err instanceof Error ? err : new Error(String(err))
				handleError(errorObj)
				return props.fallback ? (
					props.fallback(errorObj, reset)
				) : (
					<DefaultFallback error={errorObj} reset={reset} />
				)
			}}
		>
			{props.children}
		</SolidErrorBoundary>
	)
}
