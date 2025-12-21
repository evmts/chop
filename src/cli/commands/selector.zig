//! Function selector commands

const std = @import("std");
const crypto_mod = @import("crypto");
const cli = @import("../mod.zig");

const Context = cli.Context;
const CliError = cli.CliError;

/// Get function selector (first 4 bytes of keccak256)
/// Usage: chop sig <signature>
pub fn sig(ctx: *Context, args: []const []const u8) CliError!void {
    if (args.len == 0) {
        try ctx.err("Usage: chop sig <signature>\n", .{});
        try ctx.err("Example: chop sig \"transfer(address,uint256)\"\n", .{});
        return CliError.MissingArgument;
    }

    const signature = args[0];

    // Compute keccak256 of signature
    const hash = crypto_mod.Hash.keccak256(signature);

    // Take first 4 bytes
    if (ctx.format == .json) {
        try ctx.print("{{\"selector\":\"0x{x:0>2}{x:0>2}{x:0>2}{x:0>2}\"}}\n", .{ hash[0], hash[1], hash[2], hash[3] });
    } else {
        try ctx.print("0x{x:0>2}{x:0>2}{x:0>2}{x:0>2}\n", .{ hash[0], hash[1], hash[2], hash[3] });
    }
}

/// Get event topic (full keccak256 hash)
/// Usage: chop sig-event <signature>
pub fn sigEvent(ctx: *Context, args: []const []const u8) CliError!void {
    if (args.len == 0) {
        try ctx.err("Usage: chop sig-event <signature>\n", .{});
        try ctx.err("Example: chop sig-event \"Transfer(address,address,uint256)\"\n", .{});
        return CliError.MissingArgument;
    }

    const signature = args[0];

    // Compute keccak256 of signature
    const hash = crypto_mod.Hash.keccak256(signature);

    // Output full hash
    if (ctx.format == .json) {
        try ctx.print("{{\"topic\":\"0x", .{});
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
