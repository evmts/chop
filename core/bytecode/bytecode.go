package bytecode

import (
    "fmt"
)

// DisassemblyResult represents disassembled bytecode with basic analysis.
type DisassemblyResult struct {
    Instructions []Instruction
    Analysis     Analysis
}

// Instruction represents a single EVM instruction enriched for UI.
type Instruction struct {
    PC               int
    OpcodeHex        byte
    OpcodeName       string
    Operand          []byte
    // Optional metadata where known
    GasCost          *uint64
    StackInputs      *uint8
    StackOutputs     *uint8
    PushValue        *string
    PushValueDecimal *uint64
}

// Analysis represents bytecode analysis results
type Analysis struct {
    BasicBlocks []BasicBlock
    JumpDests   map[int]bool // PC -> isJumpDest
}

// BasicBlock represents a basic block in the bytecode
type BasicBlock struct {
    Start int
    End   int // inclusive
}

// AnalyzeBytecodeFromBytes performs a simple disassembly and block analysis sufficient for the TUI.
func AnalyzeBytecodeFromBytes(bc []byte) (*DisassemblyResult, error) {
    if len(bc) == 0 {
        return nil, fmt.Errorf("empty bytecode")
    }

    insts := make([]Instruction, 0, len(bc))
    jumpDests := make(map[int]bool)
    // Naive block detection: start at 0, start new block at each JUMPDEST
    blocks := make([]BasicBlock, 0, 8)
    currentBlockStart := 0

    for pc := 0; pc < len(bc); {
        opcode := bc[pc]
        name := opcodeName(opcode)

        inst := Instruction{PC: pc, OpcodeHex: opcode, OpcodeName: name}

        // Push N handling (PUSH0-PUSH32)
        if opcode >= 0x5f && opcode <= 0x7f {
            pushLen := int(opcode - 0x5f)
            if opcode == 0x5f { // PUSH0
                pushLen = 0
            }
            // Extract operand bytes
            if pushLen > 0 {
                end := pc + 1 + pushLen
                if end > len(bc) {
                    end = len(bc)
                }
                if pc+1 < len(bc) {
                    inst.Operand = append([]byte{}, bc[pc+1:end]...)
                    // Derive hex/decimal convenience values for small pushes
                    val := uint64(0)
                    for _, by := range inst.Operand {
                        val = (val << 8) | uint64(by)
                    }
                    hexStr := fmt.Sprintf("0x%x", val)
                    inst.PushValue = &hexStr
                    if val <= 0xFFFF {
                        v := val
                        inst.PushValueDecimal = &v
                    }
                }
            } else {
                // PUSH0
                zeroHex := "0x0"
                inst.PushValue = &zeroHex
                zero := uint64(0)
                inst.PushValueDecimal = &zero
            }
        }

        // JUMPDEST tagging
        if opcode == 0x5b { // JUMPDEST
            jumpDests[pc] = true
            // Start a new block at this JUMPDEST (end previous at pc-1)
            if pc != currentBlockStart {
                blocks = append(blocks, BasicBlock{Start: currentBlockStart, End: pc - 1})
                currentBlockStart = pc
            }
        }

        // Minimal metadata for common opcodes (gas/stack effects)
        if g, in, out, ok := opcodeMeta(opcode); ok {
            if g > 0 { gc := g; inst.GasCost = &gc }
            if in > 0 { ii := in; inst.StackInputs = &ii }
            if out > 0 { oo := out; inst.StackOutputs = &oo }
        }

        insts = append(insts, inst)

        // Advance PC
        size := 1
        if opcode >= 0x60 && opcode <= 0x7f { // PUSH1-PUSH32
            size = 1 + int(opcode-0x5f)
        } else if opcode == 0x5f { // PUSH0
            size = 1
        }
        pc += size
    }

    // Close last block
    if currentBlockStart < len(bc) {
        blocks = append(blocks, BasicBlock{Start: currentBlockStart, End: len(bc) - 1})
    }

    return &DisassemblyResult{
        Instructions: insts,
        Analysis: Analysis{
            BasicBlocks: blocks,
            JumpDests:   jumpDests,
        },
    }, nil
}

// GetInstructionsForBlock returns instructions for a specific block
func GetInstructionsForBlock(result *DisassemblyResult, blockIndex int) ([]Instruction, *BasicBlock, error) {
    if result == nil || blockIndex < 0 || blockIndex >= len(result.Analysis.BasicBlocks) {
        return nil, nil, fmt.Errorf("invalid block index")
    }

    block := &result.Analysis.BasicBlocks[blockIndex]
    instructions := []Instruction{}

    for _, inst := range result.Instructions {
        if inst.PC >= block.Start && inst.PC <= block.End {
            instructions = append(instructions, inst)
        }
    }

    return instructions, block, nil
}

// GetJumpDestination returns the destination of a jump instruction when immediately preceded by a PUSH
func GetJumpDestination(instructions []Instruction, index int) *int {
    if index < 0 || index >= len(instructions) {
        return nil
    }
    name := instructions[index].OpcodeName
    if name != "JUMP" && name != "JUMPI" {
        return nil
    }
    // Look back one (or two for JUMPI common pattern) for a PUSH with decimal
    check := func(i int) *int {
        if i >= 0 && i < len(instructions) {
            prev := instructions[i]
            if prev.PushValueDecimal != nil {
                // Destination is a PC value
                v := int(*prev.PushValueDecimal)
                return &v
            }
        }
        return nil
    }
    if name == "JUMP" {
        if d := check(index - 1); d != nil { return d }
    } else {
        if d := check(index - 2); d != nil { return d }
        if d := check(index - 1); d != nil { return d }
    }
    return nil
}

// FindBlockContainingPC finds the block that contains a given PC
func FindBlockContainingPC(analysis Analysis, pc int) int {
    for i, block := range analysis.BasicBlocks {
        if pc >= block.Start && pc <= block.End {
            return i
        }
    }
    return -1
}

// FindInstructionIndexByPC finds the instruction index by PC
func FindInstructionIndexByPC(instructions []Instruction, pc int) int {
    for i, inst := range instructions {
        if inst.PC == pc {
            return i
        }
    }
    return -1
}

// opcodeName returns a human-readable EVM opcode name.
func opcodeName(op byte) string {
    switch op {
    case 0x00:
        return "STOP"
    case 0x01:
        return "ADD"
    case 0x02:
        return "MUL"
    case 0x03:
        return "SUB"
    case 0x56:
        return "JUMP"
    case 0x57:
        return "JUMPI"
    case 0x5b:
        return "JUMPDEST"
    case 0xf3:
        return "RETURN"
    case 0xfd:
        return "REVERT"
    case 0xfe:
        return "INVALID"
    case 0xff:
        return "SELFDESTRUCT"
    }
    // PUSH0-32
    if op == 0x5f { return "PUSH0" }
    if op >= 0x60 && op <= 0x7f { return fmt.Sprintf("PUSH%d", int(op-0x5f)) }
    return fmt.Sprintf("0x%02x", op)
}

// opcodeMeta returns rough gas/stack metadata for common opcodes
func opcodeMeta(op byte) (gas uint64, in, out uint8, ok bool) {
    switch op {
    case 0x00: // STOP
        return 0, 0, 0, true
    case 0x01: // ADD
        return 3, 2, 1, true
    case 0x03: // SUB
        return 3, 2, 1, true
    case 0x56: // JUMP
        return 8, 1, 0, true
    case 0x57: // JUMPI
        return 10, 2, 0, true
    case 0x5b: // JUMPDEST
        return 1, 0, 0, true
    case 0xf3: // RETURN
        return 0, 2, 0, true
    case 0xfd: // REVERT
        return 0, 2, 0, true
    }
    if op >= 0x60 && op <= 0x7f { // PUSH
        return 3, 0, 1, true
    }
    return 0, 0, 0, false
}

// CalculateBlockGas sums up all gas costs in a block
func CalculateBlockGas(instructions []Instruction) uint64 {
    totalGas := uint64(0)
    for _, inst := range instructions {
        if inst.GasCost != nil {
            totalGas += *inst.GasCost
        }
    }
    return totalGas
}
