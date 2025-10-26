import MoonIcon from 'lucide-solid/icons/moon'
import SettingsIcon from 'lucide-solid/icons/settings'
import SunIcon from 'lucide-solid/icons/sun'
import { type Accessor, type Component, type Setter, Show } from 'solid-js'
import { Button } from '~/components/ui/button'
import { ToggleButton } from '~/components/ui/toggle'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'
import MobileMenu from './MobileMenu'

/**
 * Props for the Header component.
 * Controls theme and panel view selection.
 */
interface HeaderProps {
	/** Reactive signal for dark mode state */
	isDarkMode: Accessor<boolean>
	/** Setter to toggle dark/light theme */
	setIsDarkMode: Setter<boolean>
	/** Currently active panel view ('all', 'stack', 'memory', etc.) */
	activePanel: string
	/** Setter to change the active panel view */
	setActivePanel: Setter<string>
}

const TOGGLE_BUTTON_CLASS =
	'whitespace-nowrap hover:bg-amber-100 data-[pressed]:bg-amber-100 dark:data-[pressed]:bg-amber-950 dark:hover:bg-amber-950'

const Header: Component<HeaderProps> = (props) => {
	return (
		<header class="sticky top-2 z-20 mx-auto w-full max-w-7xl px-3 sm:px-6">
			<div class="flex items-center justify-between gap-2 rounded-sm border border-border/30 bg-amber-50/50 px-4 py-2 backdrop-blur-md dark:bg-amber-950/30 sm:gap-8">
				<div class="flex items-center gap-3 sm:gap-12">
					<div class="flex items-center gap-3">
						<div class="flex h-7 w-7 items-center justify-center rounded-sm bg-gradient-to-br from-amber-200 to-amber-600 text-white shadow-md">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-4 w-4"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-label="EVM Debugger icon"
							>
								<title>EVM Debugger icon</title>
								<path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16" />
								<path d="M8 7h.01M12 7h.01M16 7h.01" />
							</svg>
						</div>
						<h1 class="whitespace-nowrap font-medium tracking-wide">svvy</h1>
						<MobileMenu activePanel={props.activePanel} setActivePanel={props.setActivePanel} />
					</div>

					<nav class="hidden gap-1 md:flex" aria-label="Panel view selection">
						<ToggleButton
							pressed={props.activePanel === 'all'}
							onChange={() => props.setActivePanel('all')}
							size="sm"
							class={TOGGLE_BUTTON_CLASS}
							aria-label="Show all panels"
						>
							All panels
						</ToggleButton>
						<ToggleButton
							pressed={props.activePanel === 'stack'}
							onChange={() => props.setActivePanel('stack')}
							size="sm"
							class={TOGGLE_BUTTON_CLASS}
							aria-label="Show stack panel only"
						>
							Stack
						</ToggleButton>
						<ToggleButton
							pressed={props.activePanel === 'memory'}
							onChange={() => props.setActivePanel('memory')}
							size="sm"
							class={TOGGLE_BUTTON_CLASS}
							aria-label="Show memory panel only"
						>
							Memory
						</ToggleButton>
						<ToggleButton
							pressed={props.activePanel === 'storage'}
							onChange={() => props.setActivePanel('storage')}
							size="sm"
							class={TOGGLE_BUTTON_CLASS}
							aria-label="Show storage panel only"
						>
							Storage
						</ToggleButton>
						<ToggleButton
							pressed={props.activePanel === 'logs'}
							onChange={() => props.setActivePanel('logs')}
							size="sm"
							class={TOGGLE_BUTTON_CLASS}
							aria-label="Show logs panel only"
						>
							Logs
						</ToggleButton>
						<ToggleButton
							pressed={props.activePanel === 'bytecode'}
							onChange={() => props.setActivePanel('bytecode')}
							size="sm"
							class={TOGGLE_BUTTON_CLASS}
							aria-label="Show bytecode panel only"
						>
							Bytecode
						</ToggleButton>
						<ToggleButton
							pressed={props.activePanel === 'gas'}
							onChange={() => props.setActivePanel('gas')}
							size="sm"
							class={TOGGLE_BUTTON_CLASS}
							aria-label="Show gas panel only"
						>
							Gas
						</ToggleButton>
					</nav>
				</div>
				<div class="flex items-center gap-2 border-border/50 border-l pl-3 sm:gap-3 sm:pl-4">
					<Button
						variant="ghost"
						size="icon"
						onClick={() => props.setIsDarkMode(!props.isDarkMode())}
						aria-label={props.isDarkMode() ? 'Switch to light mode' : 'Switch to dark mode'}
					>
						<Show when={props.isDarkMode} fallback={<MoonIcon class="h-4 w-4" aria-hidden="true" />}>
							<SunIcon class="h-4 w-4" aria-hidden="true" />
						</Show>
					</Button>
					<Tooltip openDelay={0}>
						<TooltipTrigger
							as={(props: any) => (
								<Button {...props} variant="ghost" size="icon" disabled aria-label="Settings">
									<SettingsIcon class="h-4 w-4" />
								</Button>
							)}
						/>
						<TooltipContent>Settings coming soon</TooltipContent>
					</Tooltip>
				</div>
			</div>
		</header>
	)
}

export default Header
