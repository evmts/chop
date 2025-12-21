//! Utility commands: address-zero, hash-zero, max-uint, etc.

const std = @import("std");
const cli = @import("../mod.zig");

const Context = cli.Context;
const CliError = cli.CliError;

/// Print zero address
/// Usage: chop address-zero
pub fn addressZero(ctx: *Context, args: []const []const u8) CliError!void {
    _ = args;

    const zero = "0x0000000000000000000000000000000000000000";

    if (ctx.format == .json) {
        try ctx.print("{{\"address\":\"{s}\"}}\n", .{zero});
    } else {
        try ctx.print("{s}\n", .{zero});
    }
}

/// Print zero hash (32 bytes)
/// Usage: chop hash-zero
pub fn hashZero(ctx: *Context, args: []const []const u8) CliError!void {
    _ = args;

    const zero = "0x0000000000000000000000000000000000000000000000000000000000000000";

    if (ctx.format == .json) {
        try ctx.print("{{\"hash\":\"{s}\"}}\n", .{zero});
    } else {
        try ctx.print("{s}\n", .{zero});
    }
}

/// Print max unsigned integer value
/// Usage: chop max-uint [bits]
pub fn maxUint(ctx: *Context, args: []const []const u8) CliError!void {
    const bits: u16 = if (args.len > 0) blk: {
        break :blk std.fmt.parseUnsigned(u16, args[0], 10) catch {
            try ctx.err("error: invalid bits '{s}'\n", .{args[0]});
            return CliError.InvalidArgument;
        };
    } else 256;

    if (bits == 0 or bits > 256) {
        try ctx.err("error: bits must be 1-256\n", .{});
        return CliError.InvalidArgument;
    }

    // Calculate max value: (2^bits) - 1
    const max: u256 = if (bits == 256)
        std.math.maxInt(u256)
    else
        (@as(u256, 1) << @intCast(bits)) - 1;

    if (ctx.format == .json) {
        try ctx.print("{{\"value\":\"{d}\",\"hex\":\"0x{x}\"}}\n", .{ max, max });
    } else {
        try ctx.print("{d}\n", .{max});
    }
}

/// Print max signed integer value
/// Usage: chop max-int [bits]
pub fn maxInt(ctx: *Context, args: []const []const u8) CliError!void {
    const bits: u16 = if (args.len > 0) blk: {
        break :blk std.fmt.parseUnsigned(u16, args[0], 10) catch {
            try ctx.err("error: invalid bits '{s}'\n", .{args[0]});
            return CliError.InvalidArgument;
        };
    } else 256;

    if (bits == 0 or bits > 256) {
        try ctx.err("error: bits must be 1-256\n", .{});
        return CliError.InvalidArgument;
    }

    // Calculate max signed value: (2^(bits-1)) - 1
    const max: u256 = (@as(u256, 1) << @intCast(bits - 1)) - 1;

    if (ctx.format == .json) {
        try ctx.print("{{\"value\":\"{d}\",\"hex\":\"0x{x}\"}}\n", .{ max, max });
    } else {
        try ctx.print("{d}\n", .{max});
    }
}

/// Print min signed integer value
/// Usage: chop min-int [bits]
pub fn minInt(ctx: *Context, args: []const []const u8) CliError!void {
    const bits: u16 = if (args.len > 0) blk: {
        break :blk std.fmt.parseUnsigned(u16, args[0], 10) catch {
            try ctx.err("error: invalid bits '{s}'\n", .{args[0]});
            return CliError.InvalidArgument;
        };
    } else 256;

    if (bits == 0 or bits > 256) {
        try ctx.err("error: bits must be 1-256\n", .{});
        return CliError.InvalidArgument;
    }

    // Min signed value: -(2^(bits-1))
    // As unsigned representation: 2^bits - 2^(bits-1) = 2^(bits-1)
    // In two's complement, this is 0x80...00
    const min_unsigned: u256 = @as(u256, 1) << @intCast(bits - 1);

    if (ctx.format == .json) {
        try ctx.print("{{\"value\":\"-{d}\",\"hex\":\"0x{x}\"}}\n", .{ min_unsigned, min_unsigned });
    } else {
        try ctx.print("-{d}\n", .{min_unsigned});
    }
}
