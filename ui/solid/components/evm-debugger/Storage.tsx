import { isMobile } from '@solid-primitives/platform'
import ArrowRightIcon from 'lucide-solid/icons/arrow-right'
import CopyIcon from 'lucide-solid/icons/copy'
import RectangleEllipsisIcon from 'lucide-solid/icons/rectangle-ellipsis'
import { type Component, For, Show } from 'solid-js'
import { toast } from 'solid-sonner'
import Code from '~/components/Code'
import InfoTooltip from '~/components/InfoTooltip'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { cn } from '~/lib/cn'
import { type EvmState, formatHex } from '~/lib/types'
import { copyToClipboard } from '~/lib/utils'

/**
 * Storage component displays the EVM storage as key-value pairs.
 *
 * @remarks
 * Shows persistent storage slots with their keys and values.
 * Supports copying both keys and values individually.
 *
 * @param props - Component props
 * @param props.state - Current EVM execution state containing the storage
 */
interface StorageProps {
	state: EvmState
}

const Storage: Component<StorageProps> = ({ state }) => {
	const handleCopy = (value: string, type: 'key' | 'value') => {
		try {
			copyToClipboard(value)
			toast.info(
				<>
					Copied {type} <Code>{formatHex(value)}</Code> to clipboard
				</>,
			)
		} catch (error) {
			toast.error('Failed to copy to clipboard')
			console.error('Clipboard copy failed:', error)
		}
	}

	return (
		<Card class="overflow-hidden">
			<CardHeader class="border-b p-3">
				<div class="flex items-center justify-between">
					{/* CRITICAL FIX: storage is an array, not an object - use .length */}
					<CardTitle class="text-sm">Storage ({state.storage.length})</CardTitle>
					<InfoTooltip>Key-value pairs</InfoTooltip>
				</div>
			</CardHeader>
			<CardContent class="max-h-[300px] overflow-y-auto p-0">
				<Show
					when={state.storage.length > 0}
					fallback={
						<div class="flex items-center justify-center gap-2 p-8 text-muted-foreground text-sm italic">
							<RectangleEllipsisIcon class="h-5 w-5" />
							Storage is empty
						</div>
					}
				>
					<div class="divide-y">
						<For each={state.storage}>
							{(item, index) => (
								<div class="group px-4 py-1.5 transition-colors hover:bg-muted/50">
									<div class="flex items-center justify-between">
										<div class="flex items-center gap-2">
											<span class="w-8 font-medium text-muted-foreground text-xs">{index()}:</span>
											<Code class="break-all text-sm">{formatHex(item.key)}</Code>
											<ArrowRightIcon class="h-4 w-4" />
											<Code class="break-all text-sm">{formatHex(item.value)}</Code>
										</div>
										<div class="flex items-center gap-1">
											<Button
												variant="ghost"
												size="sm"
												onClick={() => handleCopy(item.key, 'key')}
												class={cn(
													'flex h-7 items-center gap-1',
													!isMobile && 'opacity-0 transition-opacity group-hover:opacity-100',
												)}
												aria-label="Copy key to clipboard"
											>
												<CopyIcon class="h-4 w-4" />
												<span class="text-muted-foreground text-xs">key</span>
											</Button>
											<Button
												variant="ghost"
												size="sm"
												onClick={() => handleCopy(item.value, 'value')}
												class={cn(
													'flex h-7 items-center gap-1',
													!isMobile && 'opacity-0 transition-opacity group-hover:opacity-100',
												)}
												aria-label="Copy value to clipboard"
											>
												<CopyIcon class="h-4 w-4" />
												<span class="text-muted-foreground text-xs">value</span>
											</Button>
										</div>
									</div>
								</div>
							)}
						</For>
					</div>
				</Show>
			</CardContent>
		</Card>
	)
}

export default Storage
