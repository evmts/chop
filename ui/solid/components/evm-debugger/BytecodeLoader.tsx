import UploadIcon from 'lucide-solid/icons/upload'
import { type Component, createSignal, type Setter, Show } from 'solid-js'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Combobox, ComboboxContent, ComboboxInput, ComboboxItem, ComboboxTrigger } from '~/components/ui/combobox'
import { TextArea } from '~/components/ui/textarea'
import { TextFieldRoot } from '~/components/ui/textfield'
import { type EvmState, sampleContracts } from '~/lib/types'
import { loadBytecode, resetEvm } from '~/lib/utils'

interface BytecodeLoaderProps {
	bytecode: string
	setBytecode: Setter<string>
	setError: Setter<string>
	setIsRunning: Setter<boolean>
	setState: Setter<EvmState>
}

// Default contract index with bounds checking
const DEFAULT_CONTRACT_INDEX = 7
const getDefaultContract = () => {
	if (DEFAULT_CONTRACT_INDEX < 0 || DEFAULT_CONTRACT_INDEX >= sampleContracts.length) {
		console.warn(
			`DEFAULT_CONTRACT_INDEX ${DEFAULT_CONTRACT_INDEX} is out of bounds. Using first contract.`,
		)
		return sampleContracts[0]
	}
	return sampleContracts[DEFAULT_CONTRACT_INDEX]
}

interface BytecodeValidationResult {
	isValid: boolean
	error?: string
}

/**
 * Validates EVM bytecode format and constraints
 */
const validateBytecode = (bytecode: string): BytecodeValidationResult => {
	// Check for empty input
	if (!bytecode || bytecode.trim().length === 0) {
		return { isValid: false, error: 'Bytecode cannot be empty' }
	}

	const trimmed = bytecode.trim()

	// Check for 0x prefix
	if (!trimmed.startsWith('0x')) {
		return { isValid: false, error: 'Bytecode must start with "0x" prefix' }
	}

	// Extract hex string without prefix
	const hexString = trimmed.slice(2)

	// Check if empty after prefix
	if (hexString.length === 0) {
		return { isValid: false, error: 'Bytecode must contain data after "0x" prefix' }
	}

	// Validate hex format (only 0-9, a-f, A-F allowed)
	const hexRegex = /^[0-9a-fA-F]*$/
	if (!hexRegex.test(hexString)) {
		return { isValid: false, error: 'Bytecode contains invalid characters. Only hexadecimal (0-9, a-f, A-F) allowed' }
	}

	// Check for even length (each byte needs 2 hex chars)
	if (hexString.length % 2 !== 0) {
		return { isValid: false, error: 'Bytecode must have even length (each byte requires 2 hex characters)' }
	}

	// Calculate byte length
	const byteLength = hexString.length / 2

	// Check minimum length (at least 1 byte)
	if (byteLength < 1) {
		return { isValid: false, error: 'Bytecode must be at least 1 byte long' }
	}

	// Check maximum length (50KB = 50000 bytes reasonable limit)
	const MAX_BYTECODE_LENGTH = 50000
	if (byteLength > MAX_BYTECODE_LENGTH) {
		return { isValid: false, error: `Bytecode exceeds maximum length of ${MAX_BYTECODE_LENGTH} bytes (current: ${byteLength} bytes)` }
	}

	return { isValid: true }
}

const BytecodeLoader: Component<BytecodeLoaderProps> = (props) => {
	const defaultContract = getDefaultContract()
	const [selectedContract, setSelectedContract] = createSignal(defaultContract.name)
	const [isLoading, setIsLoading] = createSignal(false)
	const [validationError, setValidationError] = createSignal('')

	const handleLoadBytecode = async () => {
		try {
			// Clear previous errors
			props.setError('')
			setValidationError('')

			// Validate bytecode before loading
			const validation = validateBytecode(props.bytecode)
			if (!validation.isValid) {
				setValidationError(validation.error || 'Invalid bytecode')
				props.setError(validation.error || 'Invalid bytecode')
				return
			}

			// Set loading state
			setIsLoading(true)

			// Load bytecode
			await loadBytecode(props.bytecode)
			props.setIsRunning(false)
			const state = await resetEvm()
			props.setState(state)

			// Success - clear validation error
			setValidationError('')
		} catch (err) {
			const errorMessage = `Failed to load bytecode: ${err}`
			props.setError(errorMessage)
			setValidationError(errorMessage)
		} finally {
			setIsLoading(false)
		}
	}

	return (
		<Card class="mx-auto mt-6 max-w-7xl rounded-sm border-none bg-transparent shadow-none">
			<CardHeader class="flex flex-col justify-between gap-2 px-3 pb-2 sm:flex-row sm:items-center sm:px-6">
				<div class="space-y-1">
					<CardTitle>Bytecode</CardTitle>
					<CardDescription>Enter EVM bytecode to debug or select a sample contract</CardDescription>
				</div>
				<Combobox
					options={sampleContracts}
					optionValue="name"
					optionTextValue="name"
					optionLabel="name"
					value={selectedContract()}
					onChange={(value) => {
						setSelectedContract(value || '')
						const contract = sampleContracts.find((c) => c.name === value)
						if (contract) {
							props.setBytecode(contract.bytecode)
						}
					}}
					placeholder="Select sample contract"
					itemComponent={(itemProps) => (
						<ComboboxItem item={itemProps.item}>
							<div class="flex flex-col items-start">
								<span class="font-medium">{itemProps.item.rawValue.name}</span>
								<span class="text-muted-foreground text-xs">
									{itemProps.item.rawValue.description}
								</span>
							</div>
						</ComboboxItem>
					)}
				>
					<ComboboxTrigger class="w-[250px]" aria-label="Select sample contract">
						<div class="flex items-center">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="mr-1.5 h-4 w-4"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<title>File icon</title>
								<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
								<polyline points="14 2 14 8 20 8" />
							</svg>
							<ComboboxInput placeholder="Select sample contract" />
						</div>
					</ComboboxTrigger>
					<ComboboxContent />
				</Combobox>
			</CardHeader>
			<CardContent class="flex flex-col gap-2 px-3 sm:px-6">
				<Show when={validationError()}>
					<div class="text-destructive text-sm" role="alert">
						{validationError()}
					</div>
				</Show>
				<TextFieldRoot>
					<TextArea
						id="bytecode"
						value={props.bytecode}
						onInput={(e) => {
							props.setBytecode(e.currentTarget.value)
							// Clear validation error when user starts typing
							if (validationError()) {
								setValidationError('')
							}
						}}
						class="h-24 font-mono"
						placeholder="0x608060405234801561001057600080fd5b50..."
						aria-label="EVM bytecode input"
						aria-invalid={!!validationError()}
						aria-describedby={validationError() ? 'bytecode-error' : undefined}
					/>
				</TextFieldRoot>
				<Button
					variant="secondary"
					size="sm"
					onClick={handleLoadBytecode}
					disabled={isLoading()}
					aria-label="Load bytecode"
					class="gap-2"
				>
					<Show when={!isLoading()} fallback={
						<div class="flex items-center gap-2">
							<div class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
							Loading...
						</div>
					}>
						<UploadIcon class="h-4 w-4" />
						Load Bytecode
					</Show>
				</Button>
			</CardContent>
		</Card>
	)
}

export default BytecodeLoader
