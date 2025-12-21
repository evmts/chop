const std = @import("std");
const types = @import("../types.zig");

/// EVM opcode names
const opcode_names = [256][]const u8{
    // 0x00 - 0x0F
    "STOP", "ADD", "MUL", "SUB", "DIV", "SDIV", "MOD", "SMOD",
    "ADDMOD", "MULMOD", "EXP", "SIGNEXTEND", "INVALID", "INVALID", "INVALID", "INVALID",
    // 0x10 - 0x1F
    "LT", "GT", "SLT", "SGT", "EQ", "ISZERO", "AND", "OR",
    "XOR", "NOT", "BYTE", "SHL", "SHR", "SAR", "INVALID", "INVALID",
    // 0x20 - 0x2F
    "KECCAK256", "INVALID", "INVALID", "INVALID", "INVALID", "INVALID", "INVALID", "INVALID",
    "INVALID", "INVALID", "INVALID", "INVALID", "INVALID", "INVALID", "INVALID", "INVALID",
    // 0x30 - 0x3F
    "ADDRESS", "BALANCE", "ORIGIN", "CALLER", "CALLVALUE", "CALLDATALOAD", "CALLDATASIZE", "CALLDATACOPY",
    "CODESIZE", "CODECOPY", "GASPRICE", "EXTCODESIZE", "EXTCODECOPY", "RETURNDATASIZE", "RETURNDATACOPY", "EXTCODEHASH",
    // 0x40 - 0x4F
    "BLOCKHASH", "COINBASE", "TIMESTAMP", "NUMBER", "PREVRANDAO", "GASLIMIT", "CHAINID", "SELFBALANCE",
    "BASEFEE", "BLOBHASH", "BLOBBASEFEE", "INVALID", "INVALID", "INVALID", "INVALID", "INVALID",
    // 0x50 - 0x5F
    "POP", "MLOAD", "MSTORE", "MSTORE8", "SLOAD", "SSTORE", "JUMP", "JUMPI",
    "PC", "MSIZE", "GAS", "JUMPDEST", "TLOAD", "TSTORE", "MCOPY", "PUSH0",
    // 0x60 - 0x6F (PUSH1-PUSH16)
    "PUSH1", "PUSH2", "PUSH3", "PUSH4", "PUSH5", "PUSH6", "PUSH7", "PUSH8",
    "PUSH9", "PUSH10", "PUSH11", "PUSH12", "PUSH13", "PUSH14", "PUSH15", "PUSH16",
    // 0x70 - 0x7F (PUSH17-PUSH32)
    "PUSH17", "PUSH18", "PUSH19", "PUSH20", "PUSH21", "PUSH22", "PUSH23", "PUSH24",
    "PUSH25", "PUSH26", "PUSH27", "PUSH28", "PUSH29", "PUSH30", "PUSH31", "PUSH32",
    // 0x80 - 0x8F (DUP1-DUP16)
    "DUP1", "DUP2", "DUP3", "DUP4", "DUP5", "DUP6", "DUP7", "DUP8",
    "DUP9", "DUP10", "DUP11", "DUP12", "DUP13", "DUP14", "DUP15", "DUP16",
    // 0x90 - 0x9F (SWAP1-SWAP16)
    "SWAP1", "SWAP2", "SWAP3", "SWAP4", "SWAP5", "SWAP6", "SWAP7", "SWAP8",
    "SWAP9", "SWAP10", "SWAP11", "SWAP12", "SWAP13", "SWAP14", "SWAP15", "SWAP16",
    // 0xA0 - 0xAF (LOG0-LOG4, then INVALID)
    "LOG0", "LOG1", "LOG2", "LOG3", "LOG4", "INVALID", "INVALID", "INVALID",
    "INVALID", "INVALID", "INVALID", "INVALID", "INVALID", "INVALID", "INVALID", "INVALID",
    // 0xB0 - 0xBF
    "INVALID", "INVALID", "INVALID", "INVALID", "INVALID", "INVALID", "INVALID", "INVALID",
    "INVALID", "INVALID", "INVALID", "INVALID", "INVALID", "INVALID", "INVALID", "INVALID",
    // 0xC0 - 0xCF
    "INVALID", "INVALID", "INVALID", "INVALID", "INVALID", "INVALID", "INVALID", "INVALID",
    "INVALID", "INVALID", "INVALID", "INVALID", "INVALID", "INVALID", "INVALID", "INVALID",
    // 0xD0 - 0xDF
    "INVALID", "INVALID", "INVALID", "INVALID", "INVALID", "INVALID", "INVALID", "INVALID",
    "INVALID", "INVALID", "INVALID", "INVALID", "INVALID", "INVALID", "INVALID", "INVALID",
    // 0xE0 - 0xEF
    "INVALID", "INVALID", "INVALID", "INVALID", "INVALID", "INVALID", "INVALID", "INVALID",
    "INVALID", "INVALID", "INVALID", "INVALID", "INVALID", "INVALID", "INVALID", "INVALID",
    // 0xF0 - 0xFF
    "CREATE", "CALL", "CALLCODE", "RETURN", "DELEGATECALL", "CREATE2", "INVALID", "INVALID",
    "INVALID", "INVALID", "STATICCALL", "INVALID", "INVALID", "REVERT", "INVALID", "SELFDESTRUCT",
};

/// Check if an opcode is a basic block terminator
fn isBlockTerminator(opcode: u8) bool {
    return switch (opcode) {
        0x00 => true, // STOP
        0x56 => true, // JUMP
        0x57 => true, // JUMPI
        0xF3 => true, // RETURN
        0xFD => true, // REVERT
        0xFE => true, // INVALID
        0xFF => true, // SELFDESTRUCT
        else => false,
    };
}

/// Check if an opcode is a JUMPDEST (starts a new block)
fn isJumpDest(opcode: u8) bool {
    return opcode == 0x5B;
}

/// Get the number of operand bytes for PUSH opcodes
fn getPushSize(opcode: u8) u8 {
    if (opcode >= 0x60 and opcode <= 0x7F) {
        return opcode - 0x60 + 1; // PUSH1=1 byte, PUSH32=32 bytes
    }
    return 0;
}

/// Get opcode name
pub fn getOpcodeName(opcode: u8) []const u8 {
    return opcode_names[opcode];
}

/// Disassemble EVM bytecode into instructions and basic blocks
pub fn disassemble(allocator: std.mem.Allocator, bytecode: []const u8) !types.DisassemblyResult {
    // Parse bytecode - handle hex string format
    const raw_bytes = try parseHexBytecode(allocator, bytecode);
    defer allocator.free(raw_bytes);

    if (raw_bytes.len == 0) {
        return types.DisassemblyResult{
            .blocks = &.{},
            .total_instructions = 0,
            .bytecode_size = 0,
        };
    }

    // First pass: parse all instructions
    var instructions: std.ArrayListUnmanaged(types.Instruction) = .{};
    defer instructions.deinit(allocator);

    var pc: u32 = 0;
    while (pc < raw_bytes.len) {
        const opcode = raw_bytes[pc];
        const push_size = getPushSize(opcode);
        const instr_size: u8 = 1 + push_size;

        // Extract operand for PUSH instructions
        var operand: ?[]const u8 = null;
        if (push_size > 0) {
            const operand_start = pc + 1;
            const operand_end = @min(operand_start + push_size, @as(u32, @intCast(raw_bytes.len)));
            if (operand_start < raw_bytes.len) {
                const operand_bytes = raw_bytes[operand_start..operand_end];
                // Format as hex string
                operand = try std.fmt.allocPrint(allocator, "0x{x}", .{operand_bytes});
            }
        }

        try instructions.append(allocator, .{
            .pc = pc,
            .opcode = opcode,
            .opcode_name = getOpcodeName(opcode),
            .operand = operand,
            .size = instr_size,
        });

        pc += instr_size;
    }

    // Second pass: group instructions into basic blocks
    var blocks: std.ArrayListUnmanaged(types.BasicBlock) = .{};
    defer blocks.deinit(allocator);

    var block_instructions: std.ArrayListUnmanaged(types.Instruction) = .{};
    defer block_instructions.deinit(allocator);

    var block_start_pc: u32 = 0;

    for (instructions.items) |instr| {
        // Start new block at JUMPDEST (unless this is the first instruction of current block)
        if (isJumpDest(instr.opcode) and block_instructions.items.len > 0) {
            // End current block
            const block_instrs = try allocator.dupe(types.Instruction, block_instructions.items);
            try blocks.append(allocator, .{
                .start_pc = block_start_pc,
                .end_pc = instr.pc - 1,
                .instructions = block_instrs,
            });
            block_instructions.clearRetainingCapacity();
            block_start_pc = instr.pc;
        }

        try block_instructions.append(allocator, instr);

        // End block after terminator
        if (isBlockTerminator(instr.opcode)) {
            const block_instrs = try allocator.dupe(types.Instruction, block_instructions.items);
            try blocks.append(allocator, .{
                .start_pc = block_start_pc,
                .end_pc = instr.pc + instr.size - 1,
                .instructions = block_instrs,
            });
            block_instructions.clearRetainingCapacity();
            block_start_pc = instr.pc + instr.size;
        }
    }

    // Add remaining instructions as final block
    if (block_instructions.items.len > 0) {
        const block_instrs = try allocator.dupe(types.Instruction, block_instructions.items);
        const last_instr = block_instructions.items[block_instructions.items.len - 1];
        try blocks.append(allocator, .{
            .start_pc = block_start_pc,
            .end_pc = last_instr.pc + last_instr.size - 1,
            .instructions = block_instrs,
        });
    }

    // Ensure at least one block exists (even for empty bytecode handled above)
    if (blocks.items.len == 0 and instructions.items.len > 0) {
        const block_instrs = try allocator.dupe(types.Instruction, instructions.items);
        try blocks.append(allocator, .{
            .start_pc = 0,
            .end_pc = @intCast(raw_bytes.len - 1),
            .instructions = block_instrs,
        });
    }

    return types.DisassemblyResult{
        .blocks = try allocator.dupe(types.BasicBlock, blocks.items),
        .total_instructions = @intCast(instructions.items.len),
        .bytecode_size = @intCast(raw_bytes.len),
    };
}

/// Parse hex-encoded bytecode string to raw bytes
fn parseHexBytecode(allocator: std.mem.Allocator, bytecode: []const u8) ![]u8 {
    var input = bytecode;

    // Skip "0x" prefix if present
    if (input.len >= 2 and input[0] == '0' and (input[1] == 'x' or input[1] == 'X')) {
        input = input[2..];
    }

    if (input.len == 0) {
        return allocator.alloc(u8, 0);
    }

    // Hex string should have even length
    if (input.len % 2 != 0) {
        return error.InvalidHexLength;
    }

    const byte_len = input.len / 2;
    const bytes = try allocator.alloc(u8, byte_len);
    errdefer allocator.free(bytes);

    var i: usize = 0;
    while (i < byte_len) : (i += 1) {
        const high = hexCharToNibble(input[i * 2]) orelse return error.InvalidHexChar;
        const low = hexCharToNibble(input[i * 2 + 1]) orelse return error.InvalidHexChar;
        bytes[i] = (@as(u8, high) << 4) | @as(u8, low);
    }

    return bytes;
}

fn hexCharToNibble(c: u8) ?u4 {
    return switch (c) {
        '0'...'9' => @intCast(c - '0'),
        'a'...'f' => @intCast(c - 'a' + 10),
        'A'...'F' => @intCast(c - 'A' + 10),
        else => null,
    };
}

test "disassemble simple bytecode" {
    const allocator = std.testing.allocator;

    // PUSH1 0x60 PUSH1 0x40 MSTORE STOP
    const bytecode = "6060604052600080fd";
    const result = try disassemble(allocator, bytecode);
    defer {
        for (result.blocks) |block| {
            for (block.instructions) |instr| {
                if (instr.operand) |op| allocator.free(op);
            }
            allocator.free(block.instructions);
        }
        allocator.free(result.blocks);
    }

    try std.testing.expect(result.total_instructions > 0);
    try std.testing.expect(result.blocks.len > 0);
}

test "disassemble with 0x prefix" {
    const allocator = std.testing.allocator;

    const bytecode = "0x6060604052";
    const result = try disassemble(allocator, bytecode);
    defer {
        for (result.blocks) |block| {
            for (block.instructions) |instr| {
                if (instr.operand) |op| allocator.free(op);
            }
            allocator.free(block.instructions);
        }
        allocator.free(result.blocks);
    }

    try std.testing.expect(result.total_instructions > 0);
}

test "opcode names" {
    try std.testing.expectEqualStrings("STOP", getOpcodeName(0x00));
    try std.testing.expectEqualStrings("ADD", getOpcodeName(0x01));
    try std.testing.expectEqualStrings("PUSH1", getOpcodeName(0x60));
    try std.testing.expectEqualStrings("PUSH32", getOpcodeName(0x7F));
    try std.testing.expectEqualStrings("JUMP", getOpcodeName(0x56));
    try std.testing.expectEqualStrings("JUMPI", getOpcodeName(0x57));
    try std.testing.expectEqualStrings("RETURN", getOpcodeName(0xF3));
    try std.testing.expectEqualStrings("REVERT", getOpcodeName(0xFD));
}
