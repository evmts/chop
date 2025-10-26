import MenuIcon from 'lucide-solid/icons/menu'
import XIcon from 'lucide-solid/icons/x'
import { type Component, createSignal, For, Show, type Setter } from 'solid-js'
import { Portal } from 'solid-js/web'
import { Button } from '~/components/ui/button'

interface MobileMenuProps {
	activePanel: string
	setActivePanel: Setter<string>
}

const panels = [
	{ id: 'all', label: 'All panels' },
	{ id: 'stack', label: 'Stack' },
	{ id: 'memory', label: 'Memory' },
	{ id: 'storage', label: 'Storage' },
	{ id: 'logs', label: 'Logs' },
	{ id: 'bytecode', label: 'Bytecode' },
	{ id: 'gas', label: 'Gas' },
]

const MobileMenu: Component<MobileMenuProps> = (props) => {
	const [isOpen, setIsOpen] = createSignal(false)

	const handlePanelSelect = (panelId: string) => {
		props.setActivePanel(panelId)
		setIsOpen(false)
	}

	return (
		<>
			<Button
				variant="ghost"
				size="icon"
				onClick={() => setIsOpen(!isOpen())}
				class="md:hidden"
				aria-label="Open menu"
				aria-expanded={isOpen()}
			>
				<Show when={isOpen()} fallback={<MenuIcon class="h-5 w-5" />}>
					<XIcon class="h-5 w-5" />
				</Show>
			</Button>

			<Show when={isOpen()}>
				<Portal>
					<div
						class="fixed inset-0 z-50 bg-black/50 md:hidden"
						onClick={() => setIsOpen(false)}
						aria-hidden="true"
					/>
					<div class="fixed inset-x-0 top-[4.5rem] z-50 mx-2 rounded-lg border border-border bg-background shadow-lg md:hidden">
						<div class="flex flex-col p-4">
							<h2 class="mb-4 text-sm font-medium text-muted-foreground">Select Panel</h2>
							<div class="flex flex-col gap-2">
								<For each={panels}>
									{(panel) => (
										<button
											type="button"
											onClick={() => handlePanelSelect(panel.id)}
											class={`min-h-[44px] rounded-md px-4 py-2 text-left transition-colors ${
												props.activePanel === panel.id
													? 'bg-amber-100 font-medium text-foreground dark:bg-amber-950'
													: 'text-foreground/80 hover:bg-accent hover:text-foreground'
											}`}
											aria-pressed={props.activePanel === panel.id}
										>
											{panel.label}
										</button>
									)}
								</For>
							</div>
						</div>
					</div>
				</Portal>
			</Show>
		</>
	)
}

export default MobileMenu
