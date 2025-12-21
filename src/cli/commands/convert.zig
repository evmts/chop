//! Conversion commands: to-hex, to-dec, to-wei, from-wei, etc.

const std = @import("std");
const primitives = @import("primitives");
const cli = @import("../mod.zig");

const Context = cli.Context;
const CliError = cli.CliError;

/// Convert a number to hexadecimal
/// Usage: chop to-hex <value>
pub fn toHex(ctx: *Context, args: []const []const u8) CliError!void {
    if (args.len == 0) {
        try ctx.err("Usage: chop to-hex <value>\n", .{});
        return CliError.MissingArgument;
    }

    const input = args[0];

    // Parse as decimal or hex
    const value = parseNumber(input) catch {
        try ctx.err("error: invalid number '{s}'\n", .{input});
        return CliError.InvalidArgument;
    };

    if (ctx.format == .json) {
        try ctx.print("{{\"hex\":\"0x{x}\"}}\n", .{value});
    } else {
        try ctx.print("0x{x}\n", .{value});
    }
}

/// Convert a number to decimal
/// Usage: chop to-dec <value>
pub fn toDec(ctx: *Context, args: []const []const u8) CliError!void {
    if (args.len == 0) {
        try ctx.err("Usage: chop to-dec <value>\n", .{});
        return CliError.MissingArgument;
    }

    const input = args[0];

    // Parse as decimal or hex
    const value = parseNumber(input) catch {
        try ctx.err("error: invalid number '{s}'\n", .{input});
        return CliError.InvalidArgument;
    };

    if (ctx.format == .json) {
        try ctx.print("{{\"decimal\":\"{d}\"}}\n", .{value});
    } else {
        try ctx.print("{d}\n", .{value});
    }
}

/// Convert ETH amount to wei
/// Usage: chop to-wei <amount> [unit]
/// Units: wei, gwei, ether (default: ether)
pub fn toWei(ctx: *Context, args: []const []const u8) CliError!void {
    if (args.len == 0) {
        try ctx.err("Usage: chop to-wei <amount> [unit]\n", .{});
        try ctx.err("Units: wei, gwei, ether (default: ether)\n", .{});
        return CliError.MissingArgument;
    }

    const amount_str = args[0];
    const unit = if (args.len > 1) args[1] else "ether";

    // Parse the amount (support decimals)
    const multiplier: u256 = getUnitMultiplier(unit) catch {
        try ctx.err("error: unknown unit '{s}'\n", .{unit});
        return CliError.InvalidArgument;
    };

    // Handle decimal amounts
    const wei = parseEthAmount(amount_str, multiplier) catch {
        try ctx.err("error: invalid amount '{s}'\n", .{amount_str});
        return CliError.InvalidArgument;
    };

    if (ctx.format == .json) {
        try ctx.print("{{\"wei\":\"{d}\"}}\n", .{wei});
    } else {
        try ctx.print("{d}\n", .{wei});
    }
}

/// Convert wei to ETH amount
/// Usage: chop from-wei <wei> [unit]
/// Units: wei, gwei, ether (default: ether)
pub fn fromWei(ctx: *Context, args: []const []const u8) CliError!void {
    if (args.len == 0) {
        try ctx.err("Usage: chop from-wei <wei> [unit]\n", .{});
        try ctx.err("Units: wei, gwei, ether (default: ether)\n", .{});
        return CliError.MissingArgument;
    }

    const wei_str = args[0];
    const unit = if (args.len > 1) args[1] else "ether";

    const wei = parseNumber(wei_str) catch {
        try ctx.err("error: invalid wei amount '{s}'\n", .{wei_str});
        return CliError.InvalidArgument;
    };

    const divisor: u256 = getUnitMultiplier(unit) catch {
        try ctx.err("error: unknown unit '{s}'\n", .{unit});
        return CliError.InvalidArgument;
    };

    // Integer division and remainder
    const whole = wei / divisor;
    const remainder = wei % divisor;

    if (ctx.format == .json) {
        if (remainder == 0) {
            try ctx.print("{{\"value\":\"{d}\"}}\n", .{whole});
        } else {
            // Format with decimals
            const decimals = getDecimals(unit);
            try ctx.print("{{\"value\":\"{d}.", .{whole});
            try printFractional(ctx, remainder, divisor, decimals);
            try ctx.print("\"}}\n", .{});
        }
    } else {
        if (remainder == 0) {
            try ctx.print("{d}\n", .{whole});
        } else {
            const decimals = getDecimals(unit);
            try ctx.print("{d}.", .{whole});
            try printFractional(ctx, remainder, divisor, decimals);
            try ctx.print("\n", .{});
        }
    }
}

fn printFractional(ctx: *Context, remainder: u256, divisor: u256, decimals: u8) !void {
    var r = remainder;
    const d = divisor;
    var buf: [32]u8 = undefined;
    var idx: usize = 0;

    // Generate decimal digits
    while (idx < decimals and r > 0) {
        r *= 10;
        const digit = r / d;
        buf[idx] = @intCast('0' + digit);
        r = r % d;
        idx += 1;
    }

    // Trim trailing zeros
    while (idx > 1 and buf[idx - 1] == '0') {
        idx -= 1;
    }

    try ctx.print("{s}", .{buf[0..idx]});
}

fn parseNumber(input: []const u8) !u256 {
    if (input.len >= 2 and input[0] == '0' and (input[1] == 'x' or input[1] == 'X')) {
        return std.fmt.parseUnsigned(u256, input[2..], 16);
    }
    return std.fmt.parseUnsigned(u256, input, 10);
}

fn getUnitMultiplier(unit: []const u8) !u256 {
    if (std.mem.eql(u8, unit, "wei")) return 1;
    if (std.mem.eql(u8, unit, "kwei") or std.mem.eql(u8, unit, "babbage")) return 1_000;
    if (std.mem.eql(u8, unit, "mwei") or std.mem.eql(u8, unit, "lovelace")) return 1_000_000;
    if (std.mem.eql(u8, unit, "gwei") or std.mem.eql(u8, unit, "shannon")) return 1_000_000_000;
    if (std.mem.eql(u8, unit, "szabo") or std.mem.eql(u8, unit, "microether")) return 1_000_000_000_000;
    if (std.mem.eql(u8, unit, "finney") or std.mem.eql(u8, unit, "milliether")) return 1_000_000_000_000_000;
    if (std.mem.eql(u8, unit, "ether") or std.mem.eql(u8, unit, "eth")) return 1_000_000_000_000_000_000;
    return error.UnknownUnit;
}

fn getDecimals(unit: []const u8) u8 {
    if (std.mem.eql(u8, unit, "wei")) return 0;
    if (std.mem.eql(u8, unit, "kwei") or std.mem.eql(u8, unit, "babbage")) return 3;
    if (std.mem.eql(u8, unit, "mwei") or std.mem.eql(u8, unit, "lovelace")) return 6;
    if (std.mem.eql(u8, unit, "gwei") or std.mem.eql(u8, unit, "shannon")) return 9;
    if (std.mem.eql(u8, unit, "szabo") or std.mem.eql(u8, unit, "microether")) return 12;
    if (std.mem.eql(u8, unit, "finney") or std.mem.eql(u8, unit, "milliether")) return 15;
    return 18; // ether
}

fn parseEthAmount(amount: []const u8, multiplier: u256) !u256 {
    // Find decimal point
    var dot_pos: ?usize = null;
    for (amount, 0..) |c, i| {
        if (c == '.') {
            dot_pos = i;
            break;
        }
    }

    if (dot_pos) |pos| {
        // Has decimal
        const whole_str = amount[0..pos];
        const frac_str = amount[pos + 1 ..];

        const whole: u256 = if (whole_str.len > 0)
            try std.fmt.parseUnsigned(u256, whole_str, 10)
        else
            0;

        // Calculate fractional part
        var frac: u256 = 0;
        var frac_mult = multiplier;
        for (frac_str) |c| {
            if (c < '0' or c > '9') return error.InvalidNumber;
            frac_mult /= 10;
            frac += @as(u256, c - '0') * frac_mult;
        }

        return whole * multiplier + frac;
    } else {
        // No decimal
        const whole = try std.fmt.parseUnsigned(u256, amount, 10);
        return whole * multiplier;
    }
}
