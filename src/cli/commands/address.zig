//! Address commands: to-checksum, compute-address, create2

const std = @import("std");
const primitives = @import("primitives");
const crypto_mod = @import("crypto");
const cli = @import("../mod.zig");

const Context = cli.Context;
const CliError = cli.CliError;
const Address = primitives.Address;

/// Convert address to checksummed format (EIP-55)
/// Usage: chop to-checksum <address>
pub fn toChecksum(ctx: *Context, args: []const []const u8) CliError!void {
    if (args.len == 0) {
        try ctx.err("Usage: chop to-checksum <address>\n", .{});
        return CliError.MissingArgument;
    }

    const input = args[0];

    // Parse address
    const addr = Address.fromHex(input) catch {
        try ctx.err("error: invalid address '{s}'\n", .{input});
        return CliError.InvalidAddress;
    };

    // Get checksummed version
    const checksummed = addr.toChecksummed();

    if (ctx.format == .json) {
        try ctx.print("{{\"address\":\"{s}\"}}\n", .{&checksummed});
    } else {
        try ctx.print("{s}\n", .{&checksummed});
    }
}

/// Compute contract address from deployer and nonce (CREATE)
/// Usage: chop compute-address <deployer> <nonce>
pub fn computeAddress(ctx: *Context, args: []const []const u8) CliError!void {
    if (args.len < 2) {
        try ctx.err("Usage: chop compute-address <deployer> <nonce>\n", .{});
        return CliError.MissingArgument;
    }

    const deployer_str = args[0];
    const nonce_str = args[1];

    // Parse deployer address
    const deployer = Address.fromHex(deployer_str) catch {
        try ctx.err("error: invalid deployer address '{s}'\n", .{deployer_str});
        return CliError.InvalidAddress;
    };

    // Parse nonce
    const nonce = std.fmt.parseUnsigned(u64, nonce_str, 10) catch {
        try ctx.err("error: invalid nonce '{s}'\n", .{nonce_str});
        return CliError.InvalidArgument;
    };

    // Compute contract address
    const contract_addr = Address.getContractAddress(ctx.allocator, deployer, nonce) catch {
        try ctx.err("error: failed to compute contract address\n", .{});
        return CliError.EncodingError;
    };
    const checksummed = contract_addr.toChecksummed();

    if (ctx.format == .json) {
        try ctx.print("{{\"address\":\"{s}\"}}\n", .{&checksummed});
    } else {
        try ctx.print("{s}\n", .{&checksummed});
    }
}

/// Compute CREATE2 address
/// Usage: chop create2 <deployer> <salt> <init_code_hash>
pub fn create2(ctx: *Context, args: []const []const u8) CliError!void {
    if (args.len < 3) {
        try ctx.err("Usage: chop create2 <deployer> <salt> <init_code_hash>\n", .{});
        return CliError.MissingArgument;
    }

    const deployer_str = args[0];
    const salt_str = args[1];
    const init_code_hash_str = args[2];

    // Parse deployer address
    const deployer = Address.fromHex(deployer_str) catch {
        try ctx.err("error: invalid deployer address '{s}'\n", .{deployer_str});
        return CliError.InvalidAddress;
    };

    // Parse salt (32 bytes)
    const salt = parseBytes32(salt_str) catch {
        try ctx.err("error: invalid salt '{s}'\n", .{salt_str});
        return CliError.InvalidHex;
    };

    // Parse init code hash (32 bytes)
    const init_code_hash = parseBytes32(init_code_hash_str) catch {
        try ctx.err("error: invalid init code hash '{s}'\n", .{init_code_hash_str});
        return CliError.InvalidHex;
    };

    // Compute CREATE2 address
    const contract_addr = Address.getCreate2Address(deployer, salt, init_code_hash);
    const checksummed = contract_addr.toChecksummed();

    if (ctx.format == .json) {
        try ctx.print("{{\"address\":\"{s}\"}}\n", .{&checksummed});
    } else {
        try ctx.print("{s}\n", .{&checksummed});
    }
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
