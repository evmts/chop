//! Hex manipulation commands

const std = @import("std");
const cli = @import("../mod.zig");

const Context = cli.Context;
const CliError = cli.CliError;

/// Concatenate hex strings
/// Usage: chop concat-hex <hex1> <hex2> [hex3...]
pub fn concatHex(ctx: *Context, args: []const []const u8) CliError!void {
    if (args.len < 2) {
        try ctx.err("Usage: chop concat-hex <hex1> <hex2> [hex3...]\n", .{});
        return CliError.MissingArgument;
    }

    // Calculate total length
    var total_len: usize = 0;
    for (args) |arg| {
        const hex = stripPrefix(arg);
        if (hex.len % 2 != 0) {
            try ctx.err("error: invalid hex length in '{s}'\n", .{arg});
            return CliError.InvalidHex;
        }
        total_len += hex.len;
    }

    // Allocate result
    const result = ctx.allocator.alloc(u8, total_len) catch return CliError.OutOfMemory;
    defer ctx.allocator.free(result);

    // Concatenate
    var offset: usize = 0;
    for (args) |arg| {
        const hex = stripPrefix(arg);
        @memcpy(result[offset .. offset + hex.len], hex);
        offset += hex.len;
    }

    // Output
    if (ctx.format == .json) {
        try ctx.print("{{\"hex\":\"0x{s}\"}}\n", .{result});
    } else {
        try ctx.print("0x{s}\n", .{result});
    }
}

/// Convert hex to UTF-8 string
/// Usage: chop to-utf8 <hex>
pub fn toUtf8(ctx: *Context, args: []const []const u8) CliError!void {
    if (args.len == 0) {
        try ctx.err("Usage: chop to-utf8 <hex>\n", .{});
        return CliError.MissingArgument;
    }

    const hex = stripPrefix(args[0]);
    if (hex.len % 2 != 0) {
        try ctx.err("error: invalid hex length\n", .{});
        return CliError.InvalidHex;
    }

    // Decode hex to bytes
    const bytes = ctx.allocator.alloc(u8, hex.len / 2) catch return CliError.OutOfMemory;
    defer ctx.allocator.free(bytes);

    for (0..hex.len / 2) |i| {
        bytes[i] = std.fmt.parseUnsigned(u8, hex[i * 2 .. i * 2 + 2], 16) catch {
            try ctx.err("error: invalid hex character\n", .{});
            return CliError.InvalidHex;
        };
    }

    // Output as string
    if (ctx.format == .json) {
        try ctx.print("{{\"string\":\"", .{});
        // Escape special characters for JSON
        for (bytes) |byte| {
            if (byte == '"') {
                try ctx.print("\\\"", .{});
            } else if (byte == '\\') {
                try ctx.print("\\\\", .{});
            } else if (byte == '\n') {
                try ctx.print("\\n", .{});
            } else if (byte == '\r') {
                try ctx.print("\\r", .{});
            } else if (byte == '\t') {
                try ctx.print("\\t", .{});
            } else if (byte >= 0x20 and byte < 0x7f) {
                try ctx.print("{c}", .{byte});
            } else {
                try ctx.print("\\u{x:0>4}", .{byte});
            }
        }
        try ctx.print("\"}}\n", .{});
    } else {
        try ctx.print("{s}\n", .{bytes});
    }
}

/// Convert UTF-8 string to hex
/// Usage: chop from-utf8 <string>
pub fn fromUtf8(ctx: *Context, args: []const []const u8) CliError!void {
    if (args.len == 0) {
        try ctx.err("Usage: chop from-utf8 <string>\n", .{});
        return CliError.MissingArgument;
    }

    const input = args[0];

    // Output as hex
    if (ctx.format == .json) {
        try ctx.print("{{\"hex\":\"0x", .{});
        for (input) |byte| {
            try ctx.print("{x:0>2}", .{byte});
        }
        try ctx.print("\"}}\n", .{});
    } else {
        try ctx.print("0x", .{});
        for (input) |byte| {
            try ctx.print("{x:0>2}", .{byte});
        }
        try ctx.print("\n", .{});
    }
}

fn stripPrefix(input: []const u8) []const u8 {
    if (input.len >= 2 and input[0] == '0' and (input[1] == 'x' or input[1] == 'X')) {
        return input[2..];
    }
    return input;
}
