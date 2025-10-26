import { type Component, createMemo, For, Show } from 'solid-js'
import RectangleEllipsisIcon from 'lucide-solid/icons/rectangle-ellipsis'
import Code from '~/components/Code'
import InfoTooltip from '~/components/InfoTooltip'
import { Badge } from '~/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table'
import { cn } from '~/lib/cn'
import type { BlockJson } from '~/lib/types'

/**
 * ExecutionStepsView component displays preanalyzed execution blocks and fused instructions.
 *
 * @remarks
 * Shows blocks with their instructions in a table format, including PC, opcode, hex, and push data.
 * Highlights the currently executing instruction.
 *
 * @param props - Component props
 * @param props.blocks - Array of preanalyzed execution blocks
 * @param props.currentInstructionIndex - Index of the currently executing instruction
 * @param props.currentBlockStartIndex - Start index of the current block
 * @param props.rawBytecode - Raw bytecode string for size calculation
 */
interface ExecutionStepsViewProps {
	blocks: BlockJson[]
	currentInstructionIndex: number
	currentBlockStartIndex: number
	rawBytecode: string
}

const ExecutionStepsView: Component<ExecutionStepsViewProps> = (props) => {
	const byteLen = createMemo(
		() =>
			(props.rawBytecode?.startsWith('0x') ? (props.rawBytecode.length - 2) / 2 : props.rawBytecode.length / 2) || 0,
	)

	// Extract isActive logic into a named function for clarity
	const isInstructionActive = (block: BlockJson, instructionIndex: number): boolean => {
		return (
			block.beginIndex === props.currentBlockStartIndex &&
			instructionIndex === Math.max(0, props.currentInstructionIndex - block.beginIndex - 1)
		)
	}

	return (
		<Card class="overflow-hidden">
			<CardHeader class="border-b p-3">
				<div class="flex items-center justify-between">
					<CardTitle class="text-sm">Execution Steps</CardTitle>
					<div class="flex items-center gap-2">
						<div class="text-muted-foreground text-xs">
							{props.blocks.length} blocks • {byteLen()} bytes
						</div>
						<InfoTooltip>
							{/* TYPO FIX: "prenalyzed" → "preanalyzed" */}
							Shows preanalyzed blocks and fused instructions. Columns: PC, opcode, hex, and any push data. The
							highlighted row is the current instruction.
						</InfoTooltip>
					</div>
				</div>
			</CardHeader>
			<CardContent class="max-h-[400px] overflow-y-auto p-0">
				<Show
					when={props.blocks.length > 0}
					fallback={
						<div class="flex items-center justify-center gap-2 p-8 text-muted-foreground text-sm italic">
							<RectangleEllipsisIcon class="h-5 w-5" />
							No execution blocks available
						</div>
					}
				>
					<Table class="relative">
						<TableHeader class="sticky top-0 z-10 bg-background">
							<TableRow>
								<TableHead class="text-xs uppercase">Begin</TableHead>
								<TableHead class="text-xs uppercase">Gas</TableHead>
								<TableHead class="text-xs uppercase">
									<div class="grid grid-cols-[100px_100px_140px_100px_auto] gap-3">
										<span class="leading-tight">Instructions</span>
										<span class="text-[10px] text-muted-foreground">PC</span>
										<span class="text-[10px] text-muted-foreground">Opcode</span>
										<span class="text-[10px] text-muted-foreground">Hex</span>
										<span class="text-[10px] text-muted-foreground">Data</span>
									</div>
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							<For each={props.blocks}>
								{(blk) => (
									<TableRow class={blk.beginIndex === props.currentBlockStartIndex ? 'bg-accent/50' : ''}>
										<TableCell class="align-top font-mono text-xs">
											<span class="inline-block py-2">{blk.beginIndex}</span>
										</TableCell>
										<TableCell class="align-top font-mono text-xs">
											<span class="inline-block py-2">{blk.gasCost}</span>
										</TableCell>
										<TableCell class="py-2" colSpan={1}>
											<div class="flex flex-col gap-1">
												<For each={blk.pcs}>
													{(pc, idx) => {
														// Use extracted isActive function for cleaner code
														const isActive = isInstructionActive(blk, idx())
														return (
															<div
																class={cn(
																	'grid grid-cols-[100px_100px_140px_100px_auto] gap-3 py-1',
																	idx() !== blk.pcs.length - 1 && 'border-border/40 border-b',
																)}
															>
																<span />
																<Code class="inline-block w-fit text-xs">0x{pc.toString(16)}</Code>
																<Badge
																	variant={isActive ? 'default' : 'secondary'}
																	class={`inline-flex w-fit font-mono text-xs transition-colors duration-150 ${
																		isActive
																			? 'bg-amber-500 text-black hover:bg-amber-400'
																			: 'bg-amber-500/15 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300 dark:hover:bg-amber-400/20'
																	}`}
																>
																	{blk.opcodes[idx()]}
																</Badge>
																<Code class="inline-block w-fit text-xs">{blk.hex[idx()]}</Code>
																{blk.data[idx()] ? (
																	<Code class="inline-block w-fit text-xs">{blk.data[idx()]}</Code>
																) : null}
															</div>
														)
													}}
												</For>
											</div>
										</TableCell>
									</TableRow>
								)}
							</For>
						</TableBody>
					</Table>
				</Show>
			</CardContent>
		</Card>
	)
}

export default ExecutionStepsView
