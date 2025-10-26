// https://christopher.engineering/en/blog/lucide-icons-with-vite-dev-server/
/**
 * Type definitions for Lucide icon imports in Vite dev server.
 * Allows importing individual icon components from lucide-solid/icons/*.
 *
 * @example
 * ```tsx
 * import PlayIcon from 'lucide-solid/icons/play'
 * <PlayIcon class="h-4 w-4" />
 * ```
 */
declare module 'lucide-solid/icons/*' {
	import type { LucideProps } from 'lucide-solid/dist/types/types'
	import type { Component } from 'solid-js'
	const cmp: Component<LucideProps>

	export default cmp
}
