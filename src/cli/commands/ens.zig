//! ENS-related commands

const std = @import("std");
const primitives = @import("primitives");
const crypto_mod = @import("crypto");
const cli = @import("../mod.zig");

const Context = cli.Context;
const CliError = cli.CliError;

/// Calculate ENS namehash
/// Usage: chop namehash <name>
pub fn namehash(ctx: *Context, args: []const []const u8) CliError!void {
    if (args.len == 0) {
        try ctx.err("Usage: chop namehash <name>\n", .{});
        try ctx.err("Example: chop namehash vitalik.eth\n", .{});
        return CliError.MissingArgument;
    }

    const name = args[0];

    // Compute namehash using the ENS algorithm:
    // namehash('') = 0x0000000000000000000000000000000000000000000000000000000000000000
    // namehash(name) = keccak256(namehash(parent) + keccak256(label))
    var node: [32]u8 = [_]u8{0} ** 32;

    // Split name by dots and process in reverse
    var labels: std.ArrayList([]const u8) = .{};
    defer labels.deinit(ctx.allocator);

    var iter = std.mem.splitScalar(u8, name, '.');
    while (iter.next()) |label| {
        if (label.len > 0) {
            labels.append(ctx.allocator, label) catch return CliError.OutOfMemory;
        }
    }

    // Process labels in reverse order
    var i: usize = labels.items.len;
    while (i > 0) {
        i -= 1;
        const label = labels.items[i];

        // keccak256(label)
        const label_hash = crypto_mod.Hash.keccak256(label);

        // Concatenate node + label_hash and hash again
        var concat: [64]u8 = undefined;
        @memcpy(concat[0..32], &node);
        @memcpy(concat[32..64], &label_hash);

        node = crypto_mod.Hash.keccak256(&concat);
    }

    // Output
    if (ctx.format == .json) {
        try ctx.print("{{\"namehash\":\"0x", .{});
        for (node) |byte| {
            try ctx.print("{x:0>2}", .{byte});
        }
        try ctx.print("\"}}\n", .{});
    } else {
        try ctx.print("0x", .{});
        for (node) |byte| {
            try ctx.print("{x:0>2}", .{byte});
        }
        try ctx.print("\n", .{});
    }
}
