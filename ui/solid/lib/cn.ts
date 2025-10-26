import type { ClassValue } from 'clsx'
import clsx from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Combines multiple class names using clsx and tailwind-merge.
 * This utility merges Tailwind CSS classes intelligently, handling conflicts
 * by keeping the last conflicting class.
 *
 * @example
 * ```tsx
 * cn('px-2 py-1', 'px-4') // Returns: 'py-1 px-4'
 * cn('text-red-500', isActive && 'text-blue-500') // Returns: 'text-blue-500' if isActive
 * ```
 *
 * @param classLists - Variable number of class values to merge (strings, objects, arrays, etc.)
 * @returns A single merged class string with Tailwind conflicts resolved
 */
export const cn = (...classLists: ClassValue[]) => twMerge(clsx(...classLists))
