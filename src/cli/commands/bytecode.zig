//! Bytecode analysis commands

const std = @import("std");
const primitives = @import("primitives");
const crypto_mod = @import("crypto");
const cli = @import("../mod.zig");

const Context = cli.Context;
const CliError = cli.CliError;
const Opcode = primitives.Opcode;

/// Disassemble EVM bytecode
/// Usage: chop disassemble <bytecode>
pub fn disassemble(ctx: *Context, args: []const []const u8) CliError!void {
    if (args.len == 0) {
        try ctx.err("Usage: chop disassemble <bytecode>\n", .{});
        return CliError.MissingArgument;
    }

    const input = args[0];
    const hex = stripPrefix(input);

    if (hex.len % 2 != 0) {
        try ctx.err("error: invalid hex length\n", .{});
        return CliError.InvalidHex;
    }

    // Decode hex to bytes
    const bytecode = ctx.allocator.alloc(u8, hex.len / 2) catch return CliError.OutOfMemory;
    defer ctx.allocator.free(bytecode);

    for (0..hex.len / 2) |i| {
        bytecode[i] = std.fmt.parseUnsigned(u8, hex[i * 2 .. i * 2 + 2], 16) catch {
            try ctx.err("error: invalid hex character\n", .{});
            return CliError.InvalidHex;
        };
    }

    // Disassemble
    if (ctx.format == .json) {
        try ctx.print("{{\"instructions\":[", .{});
    }

    var pc: usize = 0;
    var first = true;
    while (pc < bytecode.len) {
        const op_byte = bytecode[pc];
        const op = Opcode.from(op_byte);
        const op_name = op.name();

        if (ctx.format == .json) {
            if (!first) try ctx.print(",", .{});
            first = false;
            try ctx.print("{{\"pc\":{d},\"opcode\":\"0x{x:0>2}\",\"name\":\"{s}\"", .{ pc, op_byte, op_name });
        } else {
            try ctx.print("{d:0>4}: {s}", .{ pc, op_name });
        }

        // Handle PUSH instructions
        if (op_byte >= 0x60 and op_byte <= 0x7f) {
            const push_size: usize = op_byte - 0x5f;
            if (pc + 1 + push_size <= bytecode.len) {
                const push_data = bytecode[pc + 1 .. pc + 1 + push_size];
                if (ctx.format == .json) {
                    try ctx.print(",\"value\":\"0x", .{});
                    for (push_data) |byte| {
                        try ctx.print("{x:0>2}", .{byte});
                    }
                    try ctx.print("\"", .{});
                } else {
                    try ctx.print(" 0x", .{});
                    for (push_data) |byte| {
                        try ctx.print("{x:0>2}", .{byte});
                    }
                }
                pc += push_size;
            }
        }

        if (ctx.format == .json) {
            try ctx.print("}}", .{});
        } else {
            try ctx.print("\n", .{});
        }

        pc += 1;
    }

    if (ctx.format == .json) {
        try ctx.print("]}}\n", .{});
    }
}

/// Extract function selectors from bytecode
/// Usage: chop selectors <bytecode>
pub fn selectors(ctx: *Context, args: []const []const u8) CliError!void {
    if (args.len == 0) {
        try ctx.err("Usage: chop selectors <bytecode>\n", .{});
        return CliError.MissingArgument;
    }

    const input = args[0];
    const hex = stripPrefix(input);

    if (hex.len % 2 != 0) {
        try ctx.err("error: invalid hex length\n", .{});
        return CliError.InvalidHex;
    }

    // Decode hex to bytes
    const bytecode = ctx.allocator.alloc(u8, hex.len / 2) catch return CliError.OutOfMemory;
    defer ctx.allocator.free(bytecode);

    for (0..hex.len / 2) |i| {
        bytecode[i] = std.fmt.parseUnsigned(u8, hex[i * 2 .. i * 2 + 2], 16) catch {
            try ctx.err("error: invalid hex character\n", .{});
            return CliError.InvalidHex;
        };
    }

    // Find PUSH4 instructions followed by comparison patterns
    // Typical pattern: PUSH4 <selector> DUP2 EQ PUSH2 <dest> JUMPI
    var found_selectors = std.ArrayList([4]u8).init(ctx.allocator);
    defer found_selectors.deinit();

    var pc: usize = 0;
    while (pc < bytecode.len) {
        const op = bytecode[pc];

        // Look for PUSH4 (0x63)
        if (op == 0x63 and pc + 5 <= bytecode.len) {
            var selector: [4]u8 = undefined;
            @memcpy(&selector, bytecode[pc + 1 .. pc + 5]);

            // Check if this looks like a function selector comparison
            // Usually followed by DUP2 (0x81) or similar
            const is_selector = if (pc + 6 < bytecode.len)
                bytecode[pc + 5] == 0x81 or // DUP2
                    bytecode[pc + 5] == 0x14 or // EQ
                    bytecode[pc + 5] == 0x63 // Another PUSH4
            else
                true;

            if (is_selector) {
                // Check if not already in list
                var exists = false;
                for (found_selectors.items) |s| {
                    if (std.mem.eql(u8, &s, &selector)) {
                        exists = true;
                        break;
                    }
                }
                if (!exists) {
                    found_selectors.append(selector) catch return CliError.OutOfMemory;
                }
            }
            pc += 4;
        }

        pc += 1;
    }

    // Output
    if (ctx.format == .json) {
        try ctx.print("{{\"selectors\":[", .{});
        for (found_selectors.items, 0..) |selector, i| {
            if (i > 0) try ctx.print(",", .{});
            try ctx.print("\"0x{x:0>2}{x:0>2}{x:0>2}{x:0>2}\"", .{ selector[0], selector[1], selector[2], selector[3] });
        }
        try ctx.print("]}}\n", .{});
    } else {
        for (found_selectors.items) |selector| {
            try ctx.print("0x{x:0>2}{x:0>2}{x:0>2}{x:0>2}\n", .{ selector[0], selector[1], selector[2], selector[3] });
        }
    }
}

fn stripPrefix(input: []const u8) []const u8 {
    if (input.len >= 2 and input[0] == '0' and (input[1] == 'x' or input[1] == 'X')) {
        return input[2..];
    }
    return input;
}
