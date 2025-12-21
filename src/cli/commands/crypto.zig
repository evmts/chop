//! Cryptographic commands: keccak, hash-message, etc.

const std = @import("std");
const primitives = @import("primitives");
const crypto_mod = @import("crypto");
const cli = @import("../mod.zig");

const Context = cli.Context;
const CliError = cli.CliError;

/// Hash data with Keccak-256
/// Usage: chop keccak <data>
pub fn keccak(ctx: *Context, args: []const []const u8) CliError!void {
    if (args.len == 0) {
        try ctx.err("Usage: chop keccak <data>\n", .{});
        return CliError.MissingArgument;
    }

    const input = args[0];

    // Check if input is hex (starts with 0x)
    const data: []const u8 = if (input.len >= 2 and input[0] == '0' and (input[1] == 'x' or input[1] == 'X')) blk: {
        // Decode hex
        const hex_data = input[2..];
        if (hex_data.len % 2 != 0) {
            try ctx.err("error: invalid hex length\n", .{});
            return CliError.InvalidHex;
        }
        const decoded = ctx.allocator.alloc(u8, hex_data.len / 2) catch return CliError.OutOfMemory;
        for (0..hex_data.len / 2) |i| {
            decoded[i] = std.fmt.parseUnsigned(u8, hex_data[i * 2 .. i * 2 + 2], 16) catch {
                ctx.allocator.free(decoded);
                try ctx.err("error: invalid hex character\n", .{});
                return CliError.InvalidHex;
            };
        }
        break :blk decoded;
    } else blk: {
        // Use raw string bytes
        break :blk input;
    };
    defer if (input.len >= 2 and input[0] == '0' and (input[1] == 'x' or input[1] == 'X')) {
        ctx.allocator.free(data);
    };

    // Compute keccak256
    const hash = crypto_mod.Hash.keccak256(data);

    // Output
    if (ctx.format == .json) {
        try ctx.print("{{\"hash\":\"0x", .{});
        for (hash) |byte| {
            try ctx.print("{x:0>2}", .{byte});
        }
        try ctx.print("\"}}\n", .{});
    } else {
        try ctx.print("0x", .{});
        for (hash) |byte| {
            try ctx.print("{x:0>2}", .{byte});
        }
        try ctx.print("\n", .{});
    }
}
