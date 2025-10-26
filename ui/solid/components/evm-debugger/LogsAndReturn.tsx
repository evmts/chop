import { isMobile } from '@solid-primitives/platform'
import CopyIcon from 'lucide-solid/icons/copy'
import RectangleEllipsisIcon from 'lucide-solid/icons/rectangle-ellipsis'
import { type Component, createMemo, createSignal, For, Show } from 'solid-js'
import { toast } from 'solid-sonner'
import Code from '~/components/Code'
import InfoTooltip from '~/components/InfoTooltip'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { ToggleButton } from '~/components/ui/toggle'
import { cn } from '~/lib/cn'
import type { EvmState } from '~/lib/types'
import { copyToClipboard } from '~/lib/utils'

/**
 * LogsAndReturn component displays event logs and return data from EVM execution.
 *
 * @remarks
 * Shows logs and return data in separate tabs with copy functionality.
 * Includes content length handling for large data and proper error handling.
 *
 * @param props - Component props
 * @param props.state - Current EVM execution state containing logs and return data
 */
interface LogsAndReturnProps {
	state: EvmState
}

const LogsAndReturn: Component<LogsAndReturnProps> = ({ state }) => {
	const [activeTab, setActiveTab] = createSignal('returnData')

	// Maximum content length before truncation (for performance)
	const MAX_DISPLAY_LENGTH = 10000

	// Validate and truncate content if needed
	const truncateContent = (content: string): { truncated: string; isTruncated: boolean } => {
		if (!content || typeof content !== 'string') {
			return { truncated: '', isTruncated: false }
		}
		if (content.length > MAX_DISPLAY_LENGTH) {
			return {
				truncated: content.slice(0, MAX_DISPLAY_LENGTH) + '...',
				isTruncated: true,
			}
		}
		return { truncated: content, isTruncated: false }
	}

	const handleCopyLog = (log: string, index: number) => {
		try {
			// Validate log data
			if (!log || typeof log !== 'string') {
				toast.error('Invalid log data')
				return
			}
			copyToClipboard(log)
			toast.info(
				<>
					Copied log at index <Code>{index}</Code> to clipboard
				</>,
			)
		} catch (error) {
			toast.error('Failed to copy log to clipboard')
			console.error('Clipboard copy failed:', error)
		}
	}

	const handleCopyReturnData = () => {
		try {
			// Validate return data
			if (!state.returnData || typeof state.returnData !== 'string') {
				toast.error('Invalid return data')
				return
			}
			copyToClipboard(state.returnData)
			toast.info('Copied return data to clipboard')
		} catch (error) {
			toast.error('Failed to copy return data to clipboard')
			console.error('Clipboard copy failed:', error)
		}
	}

	// Process return data with truncation
	const processedReturnData = createMemo(() => truncateContent(state.returnData))

	// Process logs with validation
	const validLogs = createMemo(() => {
		if (!Array.isArray(state.logs)) return []
		return state.logs.filter((log) => log && typeof log === 'string')
	})

	return (
		<Card class="overflow-hidden">
			<CardHeader class="border-b p-0 pr-3">
				<div class="flex items-center justify-between">
					<CardTitle class="text-sm">
						<div class="flex">
							<ToggleButton
								pressed={activeTab() === 'returnData'}
								onChange={() => setActiveTab('returnData')}
								variant="default"
								class="whitespace-nowrap rounded-none border-0 border-transparent border-b-2 px-4 py-2 data-[pressed]:border-primary"
								aria-label="Show return data"
							>
								Return data
								{processedReturnData().isTruncated && (
									<span class="ml-1 text-[10px] text-muted-foreground">(truncated)</span>
								)}
							</ToggleButton>
							<ToggleButton
								pressed={activeTab() === 'logs'}
								onChange={() => setActiveTab('logs')}
								variant="default"
								class="whitespace-nowrap rounded-none border-0 border-transparent border-b-2 px-4 py-2 data-[pressed]:border-primary"
								aria-label="Show logs"
							>
								Logs ({validLogs().length})
							</ToggleButton>
						</div>
					</CardTitle>
					<InfoTooltip>Function return data and event logs</InfoTooltip>
				</div>
			</CardHeader>
			<div class="border-b"></div>
			<CardContent class="max-h-[250px] overflow-y-auto p-0">
				<Show when={activeTab() === 'logs'}>
					<Show
						when={validLogs().length > 0}
						fallback={
							<div class="flex items-center justify-center gap-2 p-8 text-muted-foreground text-sm italic">
								<RectangleEllipsisIcon class="h-5 w-5" />
								No logs emitted
							</div>
						}
					>
						<div class="divide-y">
							<For each={validLogs()}>
								{(item, index) => {
									const { truncated, isTruncated } = truncateContent(item)
									return (
										<div class="group flex justify-between gap-2 px-4 py-1.5 transition-colors hover:bg-muted/50">
											<div class="flex flex-col">
												<div class="flex items-center">
													<span class="w-16 font-medium text-muted-foreground text-xs">{index()}:</span>
													<Code class="break-all text-sm">{truncated}</Code>
												</div>
												{isTruncated && (
													<span class="ml-16 text-[10px] text-yellow-600 dark:text-yellow-400">
														Content truncated (too large to display)
													</span>
												)}
											</div>
											<Button
												variant="ghost"
												size="icon"
												onClick={() => handleCopyLog(item, index())}
												class={cn(
													'h-7 w-7 flex-shrink-0',
													!isMobile && 'opacity-0 transition-opacity group-hover:opacity-100',
												)}
												aria-label="Copy to clipboard"
											>
												<CopyIcon class="h-4 w-4" />
											</Button>
										</div>
									)
								}}
							</For>
						</div>
					</Show>
				</Show>
				<Show when={activeTab() === 'returnData'}>
					<Show
						when={state.returnData !== '0x' && state.returnData.length > 2}
						fallback={
							<div class="flex items-center justify-center gap-2 p-8 text-muted-foreground text-sm italic">
								<RectangleEllipsisIcon class="h-5 w-5" />
								No return data
							</div>
						}
					>
						<div class="group px-4 py-2.5 transition-colors hover:bg-muted/50">
							<div class="flex flex-col gap-2">
								<div class="flex items-center justify-between gap-2">
									<Code class="break-all text-sm">{processedReturnData().truncated}</Code>
									<Button
										variant="ghost"
										size="icon"
										onClick={handleCopyReturnData}
										class={cn(
											'h-7 w-7 flex-shrink-0',
											!isMobile && 'opacity-0 transition-opacity group-hover:opacity-100',
										)}
										aria-label="Copy to clipboard"
									>
										<CopyIcon class="h-4 w-4" />
									</Button>
								</div>
								{processedReturnData().isTruncated && (
									<span class="text-[10px] text-yellow-600 dark:text-yellow-400">
										Content truncated (too large to display). Copy to see full data.
									</span>
								)}
							</div>
						</div>
					</Show>
				</Show>
			</CardContent>
		</Card>
	)
}

export default LogsAndReturn
