import CircleQuestionMarkIcon from 'lucide-solid/icons/circle-question-mark'
import { createSignal, onMount, onCleanup, Show, type JSX } from 'solid-js'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

interface InfoTooltipProps {
	children: JSX.Element
}

const MOBILE_BREAKPOINT = 768

const InfoTooltip = (props: InfoTooltipProps) => {
	const [isMobile, setIsMobile] = createSignal(
		typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false,
	)

	onMount(() => {
		const handleResize = () => {
			setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
		}

		window.addEventListener('resize', handleResize)

		onCleanup(() => {
			window.removeEventListener('resize', handleResize)
		})
	})

	return (
		<Show
			when={isMobile()}
			fallback={
				<Tooltip openDelay={0}>
					<TooltipTrigger class="text-muted-foreground transition-colors hover:text-foreground">
						<CircleQuestionMarkIcon class="h-4 w-4" />
					</TooltipTrigger>
					<TooltipContent>{props.children}</TooltipContent>
				</Tooltip>
			}
		>
			<Popover>
				<PopoverTrigger class="text-muted-foreground transition-colors hover:text-foreground">
					<CircleQuestionMarkIcon class="h-4 w-4" />
				</PopoverTrigger>
				<PopoverContent class="px-4 py-3">{props.children}</PopoverContent>
			</Popover>
		</Show>
	)
}

export default InfoTooltip
