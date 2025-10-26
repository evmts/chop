import { type Component, createEffect, createMemo, createSignal } from 'solid-js'
import Code from '~/components/Code'
import { Badge } from '~/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Progress, ProgressLabel, ProgressValueLabel } from '~/components/ui/progress'
import { cn } from '~/lib/cn'
import type { EvmState } from '~/lib/types'

/**
 * GasUsage component displays real-time gas consumption metrics.
 *
 * @remarks
 * Shows gas usage with a progress bar, percentage, and breakdown of initial/used/remaining gas.
 * Includes dynamic efficiency tips based on actual usage patterns.
 *
 * @param props - Component props
 * @param props.state - Current EVM execution state containing gas information
 * @param props.initialGas - Optional initial gas limit (defaults to tracking from state)
 */
interface GasUsageProps {
	state: EvmState
	initialGas?: number
}

const GasUsage: Component<GasUsageProps> = (props) => {
	const [initialGas, setInitialGas] = createSignal(props.initialGas || 1000000)

	// CRITICAL FIX: Replace onMount with createEffect to handle race conditions
	// This ensures initialGas updates whenever state.gasLeft changes, not just on mount
	createEffect(() => {
		const currentGas = props.state.gasLeft
		if (currentGas > 0 && currentGas > initialGas()) {
			setInitialGas(currentGas)
		}
	})

	const gasUsed = createMemo(() => {
		const init = initialGas()
		const left = props.state.gasLeft
		return init > left ? init - left : 0
	})

	const gasPercentage = createMemo(() => {
		const init = initialGas()
		// Gas validation: prevent division by zero
		if (init === 0 || init < 0) return 0

		const used = init - props.state.gasLeft
		// Validation: ensure realistic values
		if (used < 0) return 0
		if (used > init) return 100

		return (used / init) * 100
	})

	const gasUsageColor = createMemo(() => {
		const percentage = gasPercentage()
		if (percentage < 50) return 'from-green-500 to-green-600'
		if (percentage < 75) return 'from-yellow-500 to-yellow-600'
		if (percentage < 90) return 'from-orange-500 to-orange-600'
		return 'from-red-500 to-red-600'
	})

	// Dynamic gas tips based on actual execution state
	const gasTips = createMemo(() => {
		const percentage = gasPercentage()
		const used = gasUsed()

		return [
			{
				text: 'Storage operations (SSTORE) cost 20,000 gas',
				variant: percentage < 50 || used < 20000 ? ('default' as const) : ('secondary' as const),
			},
			{
				text: 'Memory expansion costs increase quadratically',
				variant: percentage < 75 ? ('default' as const) : ('secondary' as const),
			},
			{
				text: 'External calls can consume significant gas',
				variant: percentage < 90 ? ('default' as const) : ('secondary' as const),
			},
		]
	})

	return (
		<Card class="overflow-hidden">
			<CardHeader class="border-b p-3">
				<div class="flex items-center justify-between">
					<CardTitle class="text-sm">Gas Usage</CardTitle>
					<div class="text-muted-foreground text-xs">
						{gasUsed().toLocaleString()} / {initialGas().toLocaleString()}
					</div>
				</div>
			</CardHeader>
			<CardContent class="p-4">
				<div class="mb-4">
					<Progress value={gasPercentage()} fillClass={cn('bg-gradient-to-r', gasUsageColor())}>
						<div class="mb-1 flex items-center justify-between">
							<ProgressLabel class="text-muted-foreground text-xs">Gas Usage</ProgressLabel>
							<ProgressValueLabel class="font-medium text-xs">{gasPercentage().toFixed(1)}%</ProgressValueLabel>
						</div>
					</Progress>
				</div>

				<div class="grid grid-cols-3 gap-4 text-center">
					<div>
						<div class="mb-1 text-muted-foreground text-xs uppercase tracking-wider">Initial</div>
						<Code class="font-semibold">{initialGas().toLocaleString()}</Code>
					</div>
					<div>
						<div class="mb-1 text-muted-foreground text-xs uppercase tracking-wider">Used</div>
						<Code class="font-semibold">{gasUsed().toLocaleString()}</Code>
					</div>
					<div>
						<div class="mb-1 text-muted-foreground text-xs uppercase tracking-wider">Remaining</div>
						<Code class="font-semibold">{props.state.gasLeft.toLocaleString()}</Code>
					</div>
				</div>

				<Card class="mt-4 bg-muted/50">
					<CardContent class="p-3">
						<div class="mb-2 font-medium text-xs uppercase tracking-wider">Gas Efficiency Tips</div>
						<div class="space-y-1 text-muted-foreground text-xs">
							{gasTips().map((tip, idx) => (
								<div class="flex items-start gap-2">
									<Badge
										variant={tip.variant}
										class="flex h-5 w-5 items-center justify-center rounded-full p-0"
									>
										{idx + 1}
									</Badge>
									<span>{tip.text}</span>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			</CardContent>
		</Card>
	)
}

export default GasUsage
