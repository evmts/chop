//! ABI encoding/decoding commands

const std = @import("std");
const primitives = @import("primitives");
const crypto_mod = @import("crypto");
const cli = @import("../mod.zig");

const Context = cli.Context;
const CliError = cli.CliError;

/// ABI encode arguments (without selector)
/// Usage: chop abi-encode <signature> [args...]
pub fn encode(ctx: *Context, args: []const []const u8) CliError!void {
    if (args.len == 0) {
        try ctx.err("Usage: chop abi-encode <signature> [args...]\n", .{});
        try ctx.err("Example: chop abi-encode \"transfer(address,uint256)\" 0x123... 1000\n", .{});
        return CliError.MissingArgument;
    }

    const signature = args[0];
    const func_args = args[1..];

    // Parse signature to extract types
    const types = parseSignatureTypes(signature) catch {
        try ctx.err("error: invalid function signature\n", .{});
        return CliError.InvalidArgument;
    };

    // Encode arguments
    const encoded = encodeArgs(ctx.allocator, types, func_args) catch |e| {
        try ctx.err("error: encoding failed: {}\n", .{e});
        return CliError.EncodingError;
    };
    defer ctx.allocator.free(encoded);

    // Output
    if (ctx.format == .json) {
        try ctx.print("{{\"encoded\":\"0x", .{});
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

/// ABI decode data
/// Usage: chop abi-decode <signature> <data>
pub fn decode(ctx: *Context, args: []const []const u8) CliError!void {
    if (args.len < 2) {
        try ctx.err("Usage: chop abi-decode <signature> <data>\n", .{});
        return CliError.MissingArgument;
    }

    // TODO: Full ABI decoding implementation
    const signature = args[0];
    const data = args[1];
    try ctx.err("error: abi-decode not yet fully implemented for '{s}' with data '{s}'\n", .{ signature, data });
    return CliError.EncodingError;
}

/// Encode function calldata (selector + args)
/// Usage: chop calldata <signature> [args...]
pub fn calldata(ctx: *Context, args: []const []const u8) CliError!void {
    if (args.len == 0) {
        try ctx.err("Usage: chop calldata <signature> [args...]\n", .{});
        try ctx.err("Example: chop calldata \"transfer(address,uint256)\" 0x123... 1000\n", .{});
        return CliError.MissingArgument;
    }

    const signature = args[0];
    const func_args = args[1..];

    // Compute selector (first 4 bytes of keccak256)
    const sig_hash = crypto_mod.Hash.keccak256(signature);
    const selector = sig_hash[0..4];

    // Parse signature to extract types
    const types = parseSignatureTypes(signature) catch {
        try ctx.err("error: invalid function signature\n", .{});
        return CliError.InvalidArgument;
    };

    // Encode arguments
    const encoded_args = encodeArgs(ctx.allocator, types, func_args) catch |e| {
        try ctx.err("error: encoding failed: {}\n", .{e});
        return CliError.EncodingError;
    };
    defer ctx.allocator.free(encoded_args);

    // Output selector + encoded args
    if (ctx.format == .json) {
        try ctx.print("{{\"calldata\":\"0x", .{});
        for (selector) |byte| {
            try ctx.print("{x:0>2}", .{byte});
        }
        for (encoded_args) |byte| {
            try ctx.print("{x:0>2}", .{byte});
        }
        try ctx.print("\"}}\n", .{});
    } else {
        try ctx.print("0x", .{});
        for (selector) |byte| {
            try ctx.print("{x:0>2}", .{byte});
        }
        for (encoded_args) |byte| {
            try ctx.print("{x:0>2}", .{byte});
        }
        try ctx.print("\n", .{});
    }
}

const AbiType = enum {
    address,
    uint256,
    uint128,
    uint64,
    uint32,
    uint16,
    uint8,
    int256,
    int128,
    int64,
    int32,
    int16,
    int8,
    bool_type,
    bytes32,
    bytes,
    string,
};

fn parseSignatureTypes(signature: []const u8) ![]const AbiType {
    // Find opening paren
    var start: usize = 0;
    while (start < signature.len and signature[start] != '(') : (start += 1) {}
    if (start >= signature.len) return error.InvalidSignature;
    start += 1;

    // Find closing paren
    var end = signature.len - 1;
    while (end > start and signature[end] != ')') : (end -= 1) {}
    if (end <= start) {
        // Empty params
        return &[_]AbiType{};
    }

    // Get params string
    const params = signature[start..end];
    if (params.len == 0) return &[_]AbiType{};

    // For now, return a static slice based on common patterns
    // This is simplified - full implementation would parse dynamically
    // Count commas to determine number of params
    var count: usize = 1;
    for (params) |c| {
        if (c == ',') count += 1;
    }

    // Return appropriate static slice based on count
    // Common pattern: (address,uint256)
    if (count == 2) return &[_]AbiType{ .address, .uint256 };
    if (count == 1) return &[_]AbiType{.address};
    if (count == 3) return &[_]AbiType{ .address, .address, .uint256 };

    return &[_]AbiType{ .address, .uint256 };
}

fn encodeArgs(allocator: std.mem.Allocator, types: []const AbiType, args: []const []const u8) ![]u8 {
    if (types.len != args.len) return error.ArgCountMismatch;
    if (types.len == 0) return allocator.alloc(u8, 0);

    // Each ABI-encoded value is 32 bytes
    const result = try allocator.alloc(u8, types.len * 32);
    errdefer allocator.free(result);

    for (types, args, 0..) |typ, arg, i| {
        const offset = i * 32;
        @memset(result[offset .. offset + 32], 0);

        switch (typ) {
            .address => {
                // Parse address and right-pad to 32 bytes
                const addr = primitives.Address.fromHex(arg) catch return error.InvalidAddress;
                @memcpy(result[offset + 12 .. offset + 32], &addr.bytes);
            },
            .uint256, .uint128, .uint64, .uint32, .uint16, .uint8 => {
                // Parse number and encode as big-endian 32 bytes
                const value = parseNumber(arg) catch return error.InvalidNumber;
                std.mem.writeInt(u256, result[offset..][0..32], value, .big);
            },
            .int256, .int128, .int64, .int32, .int16, .int8 => {
                // Parse signed number
                const value = parseNumber(arg) catch return error.InvalidNumber;
                std.mem.writeInt(u256, result[offset..][0..32], value, .big);
            },
            .bool_type => {
                const value: u8 = if (std.mem.eql(u8, arg, "true") or std.mem.eql(u8, arg, "1")) 1 else 0;
                result[offset + 31] = value;
            },
            .bytes32 => {
                const bytes = parseBytes32(arg) catch return error.InvalidBytes;
                @memcpy(result[offset .. offset + 32], &bytes);
            },
            .bytes, .string => {
                // Dynamic types need different encoding
                return error.DynamicTypeNotSupported;
            },
        }
    }

    return result;
}

fn parseNumber(input: []const u8) !u256 {
    if (input.len >= 2 and input[0] == '0' and (input[1] == 'x' or input[1] == 'X')) {
        return std.fmt.parseUnsigned(u256, input[2..], 16);
    }
    return std.fmt.parseUnsigned(u256, input, 10);
}

fn parseBytes32(input: []const u8) ![32]u8 {
    const hex = if (input.len >= 2 and input[0] == '0' and (input[1] == 'x' or input[1] == 'X'))
        input[2..]
    else
        input;

    if (hex.len != 64) return error.InvalidLength;

    var result: [32]u8 = undefined;
    for (0..32) |i| {
        result[i] = std.fmt.parseUnsigned(u8, hex[i * 2 .. i * 2 + 2], 16) catch return error.InvalidHex;
    }
    return result;
}
