//! RLP encoding/decoding commands

const std = @import("std");
const primitives = @import("primitives");
const cli = @import("../mod.zig");

const Context = cli.Context;
const CliError = cli.CliError;
const Rlp = primitives.Rlp;

/// RLP encode data
/// Usage: chop to-rlp <data>
/// Data can be:
///   - A hex string (0x...)
///   - A JSON array of hex strings
pub fn toRlp(ctx: *Context, args: []const []const u8) CliError!void {
    if (args.len == 0) {
        try ctx.err("Usage: chop to-rlp <data>\n", .{});
        try ctx.err("  data: hex string or JSON array of hex strings\n", .{});
        return CliError.MissingArgument;
    }

    const input = args[0];

    // Check if it's a JSON array
    if (input.len > 0 and input[0] == '[') {
        // Parse JSON array and encode as list
        try ctx.err("error: JSON array encoding not yet implemented\n", .{});
        return CliError.EncodingError;
    }

    // Single hex value
    const hex = if (input.len >= 2 and input[0] == '0' and (input[1] == 'x' or input[1] == 'X'))
        input[2..]
    else
        input;

    if (hex.len % 2 != 0) {
        try ctx.err("error: invalid hex length\n", .{});
        return CliError.InvalidHex;
    }

    // Decode hex to bytes
    const data = ctx.allocator.alloc(u8, hex.len / 2) catch return CliError.OutOfMemory;
    defer ctx.allocator.free(data);

    for (0..hex.len / 2) |i| {
        data[i] = std.fmt.parseUnsigned(u8, hex[i * 2 .. i * 2 + 2], 16) catch {
            try ctx.err("error: invalid hex character\n", .{});
            return CliError.InvalidHex;
        };
    }

    // RLP encode
    const encoded = Rlp.encode(ctx.allocator, data) catch {
        try ctx.err("error: RLP encoding failed\n", .{});
        return CliError.EncodingError;
    };
    defer ctx.allocator.free(encoded);

    // Output
    if (ctx.format == .json) {
        try ctx.print("{{\"rlp\":\"0x", .{});
        for (encoded) |byte| {
            try ctx.print("{x:0>2}", .{byte});
        }
        try ctx.print("\"}}\n", .{});
    } else {
        try ctx.print("0x", .{});
        for (encoded) |byte| {
            try ctx.print("{x:0>2}", .{byte});
        }
        try ctx.print("\n", .{});
    }
}

/// RLP decode data
/// Usage: chop from-rlp <data>
pub fn fromRlp(ctx: *Context, args: []const []const u8) CliError!void {
    if (args.len == 0) {
        try ctx.err("Usage: chop from-rlp <rlp_encoded_data>\n", .{});
        return CliError.MissingArgument;
    }

    const input = args[0];
    const hex = if (input.len >= 2 and input[0] == '0' and (input[1] == 'x' or input[1] == 'X'))
        input[2..]
    else
        input;

    if (hex.len % 2 != 0) {
        try ctx.err("error: invalid hex length\n", .{});
        return CliError.InvalidHex;
    }

    // Decode hex to bytes
    const data = ctx.allocator.alloc(u8, hex.len / 2) catch return CliError.OutOfMemory;
    defer ctx.allocator.free(data);

    for (0..hex.len / 2) |i| {
        data[i] = std.fmt.parseUnsigned(u8, hex[i * 2 .. i * 2 + 2], 16) catch {
            try ctx.err("error: invalid hex character\n", .{});
            return CliError.InvalidHex;
        };
    }

    // RLP decode
    const decoded = Rlp.decode(ctx.allocator, data, false) catch {
        try ctx.err("error: RLP decoding failed\n", .{});
        return CliError.EncodingError;
    };
    defer decoded.data.deinit(ctx.allocator);

    // Output based on type
    try outputRlpValue(ctx, decoded);
}

fn outputRlpValue(ctx: *Context, decoded: Rlp.Decoded) !void {
    try outputRlpData(ctx, decoded.data);
}

fn outputRlpData(ctx: *Context, value: Rlp.Data) !void {
    switch (value) {
        .String => |s| {
            if (ctx.format == .json) {
                try ctx.print("{{\"type\":\"string\",\"value\":\"0x", .{});
                for (s) |byte| {
                    try ctx.print("{x:0>2}", .{byte});
                }
                try ctx.print("\"}}\n", .{});
            } else {
                try ctx.print("0x", .{});
                for (s) |byte| {
                    try ctx.print("{x:0>2}", .{byte});
                }
                try ctx.print("\n", .{});
            }
        },
        .List => |items| {
            if (ctx.format == .json) {
                try ctx.print("{{\"type\":\"list\",\"items\":[", .{});
                for (items, 0..) |item, i| {
                    if (i > 0) try ctx.print(",", .{});
                    switch (item) {
                        .String => |s| {
                            try ctx.print("\"0x", .{});
                            for (s) |byte| {
                                try ctx.print("{x:0>2}", .{byte});
                            }
                            try ctx.print("\"", .{});
                        },
                        .List => try ctx.print("\"<list>\"", .{}),
                    }
                }
                try ctx.print("]}}\n", .{});
            } else {
                try ctx.print("[", .{});
                for (items, 0..) |item, i| {
                    if (i > 0) try ctx.print(", ", .{});
                    switch (item) {
                        .String => |s| {
                            try ctx.print("0x", .{});
                            for (s) |byte| {
                                try ctx.print("{x:0>2}", .{byte});
                            }
                        },
                        .List => try ctx.print("<list>", .{}),
                    }
                }
                try ctx.print("]\n", .{});
            }
        },
    }
}
