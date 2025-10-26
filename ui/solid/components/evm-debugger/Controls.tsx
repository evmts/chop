import { isMobile } from '@solid-primitives/platform'
import GaugeIcon from 'lucide-solid/icons/gauge'
import PauseIcon from 'lucide-solid/icons/pause'
import PlayIcon from 'lucide-solid/icons/play'
import RotateCcwIcon from 'lucide-solid/icons/rotate-ccw'
import StepForwardIcon from 'lucide-solid/icons/step-forward'
import { type Component, createSignal, type Setter, Show } from 'solid-js'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'

/**
 * Props for the Controls component.
 * Manages EVM execution controls (reset, step, run/pause, speed).
 */
interface ControlsProps {
	/** Whether EVM is currently in running (continuous execution) mode */
	isRunning: boolean
	/** Execution speed in milliseconds between steps */
	executionSpeed: number
	/** Setter to change execution speed */
	setExecutionSpeed: Setter<number>
	/** Handler for run/pause button click */
	handleRunPause: () => void
	/** Handler for step button click */
	handleStep: () => void
	/** Handler for reset button click */
	handleReset: () => void
	/** Current loaded bytecode */
	bytecode: string
}

const Controls: Component<ControlsProps> = (props) => {
	const [showSpeedMenu, setShowSpeedMenu] = createSignal(false)

	const onReset = () => props.handleReset()
	const onStep = () => props.handleStep()
	const onRunPause = () => props.handleRunPause()

	const speedOptions = [
		{ label: 'Very Fast', value: 10 },
		{ label: 'Fast', value: 50 },
		{ label: 'Normal', value: 200 },
		{ label: 'Slow', value: 1000 },
	]

	const currentSpeedLabel = () => {
		const option = speedOptions.find(opt => opt.value === props.executionSpeed)
		return option ? option.label : 'Custom'
	}

	const handleSpeedChange = (value: number) => {
		const clampedSpeed = Math.max(10, Math.min(5000, value))
		props.setExecutionSpeed(clampedSpeed)
		localStorage.setItem('executionSpeed', clampedSpeed.toString())
		setShowSpeedMenu(false)
	}

	return (
		<div class="sticky top-18 z-50 flex w-full justify-center px-4">
			<div class="grid grid-cols-2 xs:grid-cols-4 gap-x-4 gap-y-2 rounded-sm border border-border/30 bg-amber-50/50 p-2 backdrop-blur-md dark:bg-amber-950/30">
				<Button
					variant="outline"
					size="sm"
					onClick={onReset}
					disabled={!props.bytecode}
					aria-label="Reset EVM (R)"
					class="flex items-center gap-2"
				>
					<RotateCcwIcon class="h-4 w-4" />
					Reset
					{!isMobile && (
						<Badge variant="outline" class="px-1.5 py-0.5 font-mono font-normal text-muted-foreground text-xs">
							R
						</Badge>
					)}
				</Button>
				<Button
					variant="outline"
					size="sm"
					onClick={onStep}
					disabled={props.isRunning || !props.bytecode}
					aria-label="Step EVM (S)"
					class="flex items-center gap-2"
				>
					<StepForwardIcon class="h-4 w-4" />
					Step
					{!isMobile && (
						<Badge variant="outline" class="px-1.5 py-0.5 font-mono font-normal text-muted-foreground text-xs">
							S
						</Badge>
					)}
				</Button>
				<Button
					variant={props.isRunning ? 'secondary' : 'outline'}
					size="sm"
					onClick={onRunPause}
					disabled={!props.bytecode}
					aria-label={props.isRunning ? 'Pause EVM (Space)' : 'Run EVM (Space)'}
					class="flex items-center gap-2"
				>
					<Show when={props.isRunning} fallback={<PlayIcon class="h-4 w-4" />}>
						<PauseIcon class="h-4 w-4" />
					</Show>
					{props.isRunning ? 'Pause' : 'Run'}
					{!isMobile && (
						<Badge variant="outline" class="px-1.5 py-0.5 font-mono font-normal text-muted-foreground text-xs">
							Space
						</Badge>
					)}
				</Button>
				<div class="relative">
					<Button
						variant="outline"
						size="sm"
						disabled={!props.bytecode}
						onClick={() => setShowSpeedMenu(!showSpeedMenu())}
						aria-label="Speed Control"
						class="flex items-center gap-2"
					>
						<GaugeIcon class="h-4 w-4" />
						<span class="hidden sm:inline">{currentSpeedLabel()}</span>
						<span class="sm:hidden">Speed</span>
					</Button>
					<Show when={showSpeedMenu()}>
						<div class="absolute right-0 top-full z-50 mt-2 w-40 rounded-md border border-border bg-background shadow-lg">
							{speedOptions.map((option) => (
								<button
									type="button"
									class="w-full px-4 py-2 text-left text-sm hover:bg-accent"
									classList={{ 'bg-accent': props.executionSpeed === option.value }}
									onClick={() => handleSpeedChange(option.value)}
								>
									{option.label} ({option.value}ms)
								</button>
							))}
						</div>
					</Show>
				</div>
			</div>
		</div>
	)
}

export default Controls
