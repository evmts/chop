import { createEffect, createSignal, onCleanup, onMount } from 'solid-js'
import { createStore } from 'solid-js/store'
import ErrorBoundary from '~/components/ErrorBoundary'
import EvmDebugger from '~/components/evm-debugger/EvmDebugger'
import { Toaster } from '~/components/ui/sonner'
import { type EvmState, sampleContracts } from '~/lib/types'
import { loadBytecode, resetEvm, stepEvm } from '~/lib/utils'

declare global {
	interface Window {
		hello_world: (name: string) => Promise<string>
		load_bytecode: (bytecode: string) => Promise<string>
		reset_evm: () => Promise<string>
		step_evm: () => Promise<string>
		get_evm_state: () => Promise<string>
		handleRunPause: () => void
		handleStep: () => void
		handleReset: () => void
		on_web_ui_ready: () => void
	}
}

function App() {
	const [isDarkMode, setIsDarkMode] = createSignal(false)
	const [isRunning, setIsRunning] = createSignal(false)
	const [error, setError] = createSignal<string>('')
	const [bytecode, setBytecode] = createSignal(sampleContracts[7].bytecode)
	const [executionSpeed, setExecutionSpeed] = createSignal(200)
	const [state, setState] = createStore<EvmState>({
		gasLeft: 0,
		depth: 0,
		stack: [],
		memory: '0x',
		storage: [],
		logs: [],
		returnData: '0x',
		completed: false,
		currentInstructionIndex: 0,
		currentBlockStartIndex: 0,
		blocks: [],
	})

	const handleRunPause = () => {
		setIsRunning(!isRunning())
	}

	const handleStep = async () => {
		try {
			setError('')
			const newState = await stepEvm()
			setState(newState)
		} catch (err) {
			setError(`${err}`)
		}
	}

	const handleReset = async () => {
		try {
			setError('')
			setIsRunning(false)
			const newState = await resetEvm()
			setState(newState)
		} catch (err) {
			setError(`${err}`)
		}
	}

	// Fix race condition: Initialize window functions BEFORE onMount
	// This ensures they're available if the backend calls them early
	let isReady = false
	const pendingReadyCall: (() => void)[] = []

	const initializeEvm = async () => {
		try {
			await loadBytecode(bytecode())
			const initialState = await resetEvm()
			setState(initialState)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Unknown error')
		}
	}

	// Set up window functions before mount to avoid race condition
	window.handleRunPause = handleRunPause
	window.handleStep = handleStep
	window.handleReset = handleReset
	window.on_web_ui_ready = async () => {
		if (isReady) {
			await initializeEvm()
		} else {
			// Queue the callback if we're not ready yet
			pendingReadyCall.push(initializeEvm)
		}
	}

	onMount(async () => {
		// Load execution speed from localStorage
		const savedSpeed = localStorage.getItem('executionSpeed')
		if (savedSpeed) {
			const speed = Number.parseInt(savedSpeed, 10)
			if (!Number.isNaN(speed) && speed >= 10 && speed <= 5000) {
				setExecutionSpeed(speed)
			}
		}

		// Mark as ready and process any pending calls
		isReady = true
		while (pendingReadyCall.length > 0) {
			const callback = pendingReadyCall.shift()
			if (callback) await callback()
		}

		const handleKeyDown = (event: KeyboardEvent) => {
			// Check if user is typing in an input/textarea
			const target = event.target as HTMLElement
			if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
				return
			}

			if (event.code === 'Space' || event.key === ' ') {
				event.preventDefault()
				handleRunPause()
			} else if (event.key === 'r' || event.key === 'R') {
				event.preventDefault()
				handleReset()
			} else if (event.key === 's' || event.key === 'S') {
				event.preventDefault()
				if (!isRunning()) {
					handleStep()
				}
			}
		}
		window.addEventListener('keydown', handleKeyDown)

		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
		setIsDarkMode(mediaQuery.matches)
		const listener = (event: MediaQueryListEvent) => {
			setIsDarkMode(event.matches)
		}
		mediaQuery.addEventListener('change', listener)
		onCleanup(() => {
			window.removeEventListener('keydown', handleKeyDown)
			mediaQuery.removeEventListener('change', listener)
			// Fix memory leak: Clean up window functions to prevent memory leaks
			delete window.handleRunPause
			delete window.handleStep
			delete window.handleReset
			delete window.on_web_ui_ready
		})
	})

	createEffect(() => {
		if (isRunning() && bytecode()) {
			// Use executionSpeed with validation
			const speed = Math.max(10, Math.min(5000, executionSpeed()))
			const intervalId = setInterval(async () => {
				try {
					const newState = await stepEvm()
					if (newState.completed) {
						setIsRunning(false)
					}
					setState(newState)
				} catch (err) {
					setError(`${err}`)
					setIsRunning(false)
				}
			}, speed)
			onCleanup(() => {
				clearInterval(intervalId)
			})
		}
	})

	createEffect(() => {
		if (isDarkMode()) {
			document.documentElement.classList.add('dark')
		} else {
			document.documentElement.classList.remove('dark')
		}
	})

	return (
		<ErrorBoundary>
			<EvmDebugger
				isDarkMode={isDarkMode}
				setIsDarkMode={setIsDarkMode}
				isRunning={isRunning}
				setIsRunning={setIsRunning}
				error={error}
				setError={setError}
				state={state}
				setState={setState}
				bytecode={bytecode}
				setBytecode={setBytecode}
				executionSpeed={executionSpeed}
				setExecutionSpeed={setExecutionSpeed}
				handleRunPause={handleRunPause}
				handleStep={handleStep}
				handleReset={handleReset}
			/>
			<Toaster />
		</ErrorBoundary>
	)
}

export default App
