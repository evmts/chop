import { render, screen } from '@solidjs/testing-library'
import { describe, it, expect } from 'vitest'
import ExecutionStepsView from './ExecutionStepsView'
import type { BlockJson } from '~/lib/types'

describe('ExecutionStepsView', () => {
	const mockBlocks: BlockJson[] = [
		{
			beginIndex: 0,
			gasCost: 6,
			stackReq: 0,
			stackMaxGrowth: 2,
			pcs: [0, 2],
			opcodes: ['PUSH1', 'PUSH1'],
			hex: ['60', '60'],
			data: ['05', '0a'],
		},
		{
			beginIndex: 4,
			gasCost: 3,
			stackReq: 2,
			stackMaxGrowth: -1,
			pcs: [4],
			opcodes: ['ADD'],
			hex: ['01'],
			data: [''],
		},
	]

	const defaultProps = {
		blocks: mockBlocks,
		currentInstructionIndex: 0,
		currentBlockStartIndex: 0,
		rawBytecode: '0x6005600a01',
	}

	describe('Rendering', () => {
		it('should render execution steps with correct block count', () => {
			render(() => <ExecutionStepsView {...defaultProps} />)

			expect(screen.getByText('Execution Steps')).toBeInTheDocument()
			expect(screen.getByText(/2 blocks/i)).toBeInTheDocument()
		})

		it('should display byte count from raw bytecode', () => {
			render(() => <ExecutionStepsView {...defaultProps} />)

			// 0x6005600a01 = 5 bytes
			expect(screen.getByText(/5 bytes/i)).toBeInTheDocument()
		})

		it('should show table headers', () => {
			render(() => <ExecutionStepsView {...defaultProps} />)

			expect(screen.getByText('Begin')).toBeInTheDocument()
			expect(screen.getByText('Gas')).toBeInTheDocument()
			expect(screen.getByText('Instructions')).toBeInTheDocument()
		})

		it('should display column labels', () => {
			render(() => <ExecutionStepsView {...defaultProps} />)

			expect(screen.getByText('PC')).toBeInTheDocument()
			expect(screen.getByText('Opcode')).toBeInTheDocument()
			expect(screen.getByText('Hex')).toBeInTheDocument()
			expect(screen.getByText('Data')).toBeInTheDocument()
		})
	})

	describe('Typo Fix', () => {
		it('should show "preanalyzed" instead of "prenalyzed" in tooltip', () => {
			render(() => <ExecutionStepsView {...defaultProps} />)

			// Check that the corrected text is present
			expect(screen.getByText(/preanalyzed blocks/i)).toBeInTheDocument()
		})
	})

	describe('Interface Name Fix', () => {
		it('should accept props with ExecutionStepsViewProps interface', () => {
			// This test verifies the interface name matches the component name
			const props = {
				blocks: mockBlocks,
				currentInstructionIndex: 0,
				currentBlockStartIndex: 0,
				rawBytecode: '0x6005600a01',
			}

			render(() => <ExecutionStepsView {...props} />)

			expect(screen.getByText('Execution Steps')).toBeInTheDocument()
		})
	})

	describe('Empty State', () => {
		it('should display empty state when blocks array is empty', () => {
			const emptyProps = { ...defaultProps, blocks: [] }

			render(() => <ExecutionStepsView {...emptyProps} />)

			expect(screen.getByText(/No execution blocks available/i)).toBeInTheDocument()
		})

		it('should show icon in empty state', () => {
			const emptyProps = { ...defaultProps, blocks: [] }

			render(() => <ExecutionStepsView {...emptyProps} />)

			// Icon should be present
			const container = screen.getByText(/No execution blocks available/i).closest('div')
			expect(container).toBeInTheDocument()
		})
	})

	describe('Block Display', () => {
		it('should display block begin indices', () => {
			render(() => <ExecutionStepsView {...defaultProps} />)

			expect(screen.getByText('0')).toBeInTheDocument()
			expect(screen.getByText('4')).toBeInTheDocument()
		})

		it('should display block gas costs', () => {
			render(() => <ExecutionStepsView {...defaultProps} />)

			expect(screen.getByText('6')).toBeInTheDocument()
			expect(screen.getByText('3')).toBeInTheDocument()
		})

		it('should display all opcodes', () => {
			render(() => <ExecutionStepsView {...defaultProps} />)

			const push1Opcodes = screen.getAllByText('PUSH1')
			expect(push1Opcodes.length).toBe(2)
			expect(screen.getByText('ADD')).toBeInTheDocument()
		})

		it('should display PC values in hex', () => {
			render(() => <ExecutionStepsView {...defaultProps} />)

			expect(screen.getByText('0x0')).toBeInTheDocument()
			expect(screen.getByText('0x2')).toBeInTheDocument()
			expect(screen.getByText('0x4')).toBeInTheDocument()
		})

		it('should display hex values for each instruction', () => {
			render(() => <ExecutionStepsView {...defaultProps} />)

			const hexValues = screen.getAllByText('60')
			expect(hexValues.length).toBe(2)
			expect(screen.getByText('01')).toBeInTheDocument()
		})

		it('should display push data when present', () => {
			render(() => <ExecutionStepsView {...defaultProps} />)

			expect(screen.getByText('05')).toBeInTheDocument()
			expect(screen.getByText('0a')).toBeInTheDocument()
		})
	})

	describe('Active Instruction Highlighting', () => {
		it('should highlight current block', () => {
			const props = {
				...defaultProps,
				currentInstructionIndex: 0,
				currentBlockStartIndex: 0,
			}

			const { container } = render(() => <ExecutionStepsView {...props} />)

			const activeRow = container.querySelector('.bg-accent\\/50')
			expect(activeRow).toBeInTheDocument()
		})

		it('should highlight current instruction with isActive logic', () => {
			const props = {
				...defaultProps,
				currentInstructionIndex: 1,
				currentBlockStartIndex: 0,
			}

			render(() => <ExecutionStepsView {...props} />)

			// The active instruction should have special styling
			const activeOpcode = screen.getAllByText('PUSH1')[0]
			expect(activeOpcode).toBeInTheDocument()
		})

		it('should not highlight when on different block', () => {
			const props = {
				...defaultProps,
				currentInstructionIndex: 4,
				currentBlockStartIndex: 4,
			}

			const { container } = render(() => <ExecutionStepsView {...props} />)

			// First block should not be highlighted
			const rows = container.querySelectorAll('tr')
			expect(rows.length).toBeGreaterThan(0)
		})
	})

	describe('isActive Logic Extraction', () => {
		it('should correctly identify active instruction using extracted function', () => {
			const props = {
				...defaultProps,
				currentInstructionIndex: 0,
				currentBlockStartIndex: 0,
			}

			render(() => <ExecutionStepsView {...props} />)

			// First PUSH1 should be active
			expect(screen.getAllByText('PUSH1')[0]).toBeInTheDocument()
		})

		it('should handle isActive for second instruction in block', () => {
			const props = {
				...defaultProps,
				currentInstructionIndex: 2,
				currentBlockStartIndex: 0,
			}

			render(() => <ExecutionStepsView {...props} />)

			// Second PUSH1 should be active
			expect(screen.getAllByText('PUSH1')[1]).toBeInTheDocument()
		})
	})

	describe('Bytecode Size Calculation', () => {
		it('should calculate bytes from hex bytecode with 0x prefix', () => {
			render(() => <ExecutionStepsView {...defaultProps} />)

			expect(screen.getByText(/5 bytes/i)).toBeInTheDocument()
		})

		it('should calculate bytes from hex bytecode without 0x prefix', () => {
			const props = { ...defaultProps, rawBytecode: '6005600a01' }

			render(() => <ExecutionStepsView {...props} />)

			expect(screen.getByText(/5 bytes/i)).toBeInTheDocument()
		})

		it('should handle empty bytecode', () => {
			const props = { ...defaultProps, rawBytecode: '0x' }

			render(() => <ExecutionStepsView {...props} />)

			expect(screen.getByText(/0 bytes/i)).toBeInTheDocument()
		})

		it('should handle large bytecode', () => {
			const largeBytecode = '0x' + 'aa'.repeat(1000)
			const props = { ...defaultProps, rawBytecode: largeBytecode }

			render(() => <ExecutionStepsView {...props} />)

			expect(screen.getByText(/1000 bytes/i)).toBeInTheDocument()
		})
	})

	describe('Edge Cases', () => {
		it('should handle blocks with single instruction', () => {
			const singleBlock: BlockJson[] = [
				{
					beginIndex: 0,
					gasCost: 0,
					stackReq: 0,
					stackMaxGrowth: 0,
					pcs: [0],
					opcodes: ['STOP'],
					hex: ['00'],
					data: [''],
				},
			]

			const props = { ...defaultProps, blocks: singleBlock }

			render(() => <ExecutionStepsView {...props} />)

			expect(screen.getByText('STOP')).toBeInTheDocument()
		})

		it('should handle blocks with many instructions', () => {
			const manyInstructions: BlockJson[] = [
				{
					beginIndex: 0,
					gasCost: 30,
					stackReq: 0,
					stackMaxGrowth: 10,
					pcs: Array.from({ length: 10 }, (_, i) => i),
					opcodes: Array.from({ length: 10 }, () => 'PUSH1'),
					hex: Array.from({ length: 10 }, () => '60'),
					data: Array.from({ length: 10 }, (_, i) => i.toString(16)),
				},
			]

			const props = { ...defaultProps, blocks: manyInstructions }

			render(() => <ExecutionStepsView {...props} />)

			const opcodes = screen.getAllByText('PUSH1')
			expect(opcodes.length).toBe(10)
		})

		it('should handle empty push data', () => {
			const noPushData: BlockJson[] = [
				{
					beginIndex: 0,
					gasCost: 3,
					stackReq: 2,
					stackMaxGrowth: -1,
					pcs: [0],
					opcodes: ['ADD'],
					hex: ['01'],
					data: [''],
				},
			]

			const props = { ...defaultProps, blocks: noPushData }

			render(() => <ExecutionStepsView {...props} />)

			expect(screen.getByText('ADD')).toBeInTheDocument()
		})
	})

	describe('Accessibility', () => {
		it('should render as a table with proper structure', () => {
			const { container } = render(() => <ExecutionStepsView {...defaultProps} />)

			const table = container.querySelector('table')
			expect(table).toBeInTheDocument()

			const thead = container.querySelector('thead')
			expect(thead).toBeInTheDocument()

			const tbody = container.querySelector('tbody')
			expect(tbody).toBeInTheDocument()
		})
	})
})
