//! Chop CLI - Cast-compatible command line interface
//!
//! Provides 100+ subcommands for Ethereum operations including:
//! - Data encoding/decoding (ABI, RLP, hex)
//! - Address utilities (checksum, create2, compute-address)
//! - Cryptographic operations (keccak, hash-message, sig)
//! - Unit conversions (to-wei, from-wei)
//! - And more...

const std = @import("std");
const primitives = @import("primitives");
const crypto = @import("crypto");

pub const commands = @import("commands/mod.zig");

pub const CliError = anyerror;

/// Output format for CLI results
pub const OutputFormat = enum {
    text,
    json,
};

/// CLI context passed to all commands
pub const Context = struct {
    allocator: std.mem.Allocator,
    stdout: std.fs.File,
    stderr: std.fs.File,
    format: OutputFormat,

    pub fn print(self: *Context, comptime fmt: []const u8, args: anytype) !void {
        var buf: [4096]u8 = undefined;
        const msg = std.fmt.bufPrint(&buf, fmt, args) catch return error.OutputError;
        try self.stdout.writeAll(msg);
    }

    pub fn err(self: *Context, comptime fmt: []const u8, args: anytype) !void {
        var buf: [4096]u8 = undefined;
        const msg = std.fmt.bufPrint(&buf, fmt, args) catch return error.OutputError;
        try self.stderr.writeAll(msg);
    }
};

/// Run the CLI with the given arguments
pub fn run(allocator: std.mem.Allocator) !u8 {
    const stdout = std.fs.File.stdout();
    const stderr = std.fs.File.stderr();

    // Parse arguments manually
    var args_iter = std.process.args();
    _ = args_iter.skip(); // Skip program name

    var args_list = std.ArrayList([]const u8){};
    defer args_list.deinit(allocator);

    var json_output = false;

    while (args_iter.next()) |arg| {
        if (std.mem.eql(u8, arg, "-h") or std.mem.eql(u8, arg, "--help")) {
            printHelp(stdout) catch return 1;
            return 0;
        }
        if (std.mem.eql(u8, arg, "-V") or std.mem.eql(u8, arg, "--version")) {
            stdout.writeAll("chop 0.1.0\n") catch return 1;
            return 0;
        }
        if (std.mem.eql(u8, arg, "-j") or std.mem.eql(u8, arg, "--json")) {
            json_output = true;
            continue;
        }
        try args_list.append(allocator, arg);
    }

    // No command - return to launch TUI
    if (args_list.items.len == 0) {
        return 255; // Special code meaning "launch TUI"
    }

    const format: OutputFormat = if (json_output) .json else .text;
    var ctx = Context{
        .allocator = allocator,
        .stdout = stdout,
        .stderr = stderr,
        .format = format,
    };

    // Dispatch to command
    const cmd = args_list.items[0];
    const cmd_args = args_list.items[1..];

    return dispatchCommand(&ctx, cmd, cmd_args);
}

fn dispatchCommand(ctx: *Context, cmd: []const u8, args: []const []const u8) u8 {
    // Conversion commands
    if (std.mem.eql(u8, cmd, "keccak") or std.mem.eql(u8, cmd, "keccak256") or std.mem.eql(u8, cmd, "k")) {
        commands.crypto.keccak(ctx, args) catch |e| return handleError(ctx, e);
        return 0;
    }
    if (std.mem.eql(u8, cmd, "to-hex") or std.mem.eql(u8, cmd, "th") or std.mem.eql(u8, cmd, "2h")) {
        commands.convert.toHex(ctx, args) catch |e| return handleError(ctx, e);
        return 0;
    }
    if (std.mem.eql(u8, cmd, "to-dec") or std.mem.eql(u8, cmd, "td") or std.mem.eql(u8, cmd, "2d")) {
        commands.convert.toDec(ctx, args) catch |e| return handleError(ctx, e);
        return 0;
    }
    if (std.mem.eql(u8, cmd, "to-wei") or std.mem.eql(u8, cmd, "tw") or std.mem.eql(u8, cmd, "2w")) {
        commands.convert.toWei(ctx, args) catch |e| return handleError(ctx, e);
        return 0;
    }
    if (std.mem.eql(u8, cmd, "from-wei") or std.mem.eql(u8, cmd, "fw")) {
        commands.convert.fromWei(ctx, args) catch |e| return handleError(ctx, e);
        return 0;
    }

    // Address commands
    if (std.mem.eql(u8, cmd, "to-check-sum-address") or std.mem.eql(u8, cmd, "to-checksum") or std.mem.eql(u8, cmd, "ta") or std.mem.eql(u8, cmd, "2a")) {
        commands.address.toChecksum(ctx, args) catch |e| return handleError(ctx, e);
        return 0;
    }
    if (std.mem.eql(u8, cmd, "compute-address") or std.mem.eql(u8, cmd, "ca")) {
        commands.address.computeAddress(ctx, args) catch |e| return handleError(ctx, e);
        return 0;
    }
    if (std.mem.eql(u8, cmd, "create2") or std.mem.eql(u8, cmd, "c2")) {
        commands.address.create2(ctx, args) catch |e| return handleError(ctx, e);
        return 0;
    }
    if (std.mem.eql(u8, cmd, "address-zero") or std.mem.eql(u8, cmd, "az")) {
        commands.util.addressZero(ctx, args) catch |e| return handleError(ctx, e);
        return 0;
    }

    // Encoding commands
    if (std.mem.eql(u8, cmd, "to-rlp")) {
        commands.rlp.toRlp(ctx, args) catch |e| return handleError(ctx, e);
        return 0;
    }
    if (std.mem.eql(u8, cmd, "from-rlp")) {
        commands.rlp.fromRlp(ctx, args) catch |e| return handleError(ctx, e);
        return 0;
    }
    if (std.mem.eql(u8, cmd, "abi-encode") or std.mem.eql(u8, cmd, "ae")) {
        commands.abi.encode(ctx, args) catch |e| return handleError(ctx, e);
        return 0;
    }
    if (std.mem.eql(u8, cmd, "abi-decode") or std.mem.eql(u8, cmd, "ad")) {
        commands.abi.decode(ctx, args) catch |e| return handleError(ctx, e);
        return 0;
    }
    if (std.mem.eql(u8, cmd, "calldata") or std.mem.eql(u8, cmd, "cd")) {
        commands.abi.calldata(ctx, args) catch |e| return handleError(ctx, e);
        return 0;
    }

    // Hex commands
    if (std.mem.eql(u8, cmd, "concat-hex") or std.mem.eql(u8, cmd, "ch")) {
        commands.hex.concatHex(ctx, args) catch |e| return handleError(ctx, e);
        return 0;
    }
    if (std.mem.eql(u8, cmd, "to-utf8") or std.mem.eql(u8, cmd, "tu8") or std.mem.eql(u8, cmd, "2u8")) {
        commands.hex.toUtf8(ctx, args) catch |e| return handleError(ctx, e);
        return 0;
    }
    if (std.mem.eql(u8, cmd, "from-utf8") or std.mem.eql(u8, cmd, "fu") or std.mem.eql(u8, cmd, "fa")) {
        commands.hex.fromUtf8(ctx, args) catch |e| return handleError(ctx, e);
        return 0;
    }

    // Signature commands
    if (std.mem.eql(u8, cmd, "sig") or std.mem.eql(u8, cmd, "si")) {
        commands.selector.sig(ctx, args) catch |e| return handleError(ctx, e);
        return 0;
    }
    if (std.mem.eql(u8, cmd, "sig-event") or std.mem.eql(u8, cmd, "se")) {
        commands.selector.sigEvent(ctx, args) catch |e| return handleError(ctx, e);
        return 0;
    }

    // Utility commands
    if (std.mem.eql(u8, cmd, "hash-zero") or std.mem.eql(u8, cmd, "hz")) {
        commands.util.hashZero(ctx, args) catch |e| return handleError(ctx, e);
        return 0;
    }
    if (std.mem.eql(u8, cmd, "max-uint") or std.mem.eql(u8, cmd, "maxu")) {
        commands.util.maxUint(ctx, args) catch |e| return handleError(ctx, e);
        return 0;
    }
    if (std.mem.eql(u8, cmd, "max-int") or std.mem.eql(u8, cmd, "maxi")) {
        commands.util.maxInt(ctx, args) catch |e| return handleError(ctx, e);
        return 0;
    }
    if (std.mem.eql(u8, cmd, "min-int") or std.mem.eql(u8, cmd, "mini")) {
        commands.util.minInt(ctx, args) catch |e| return handleError(ctx, e);
        return 0;
    }

    // ENS commands
    if (std.mem.eql(u8, cmd, "namehash") or std.mem.eql(u8, cmd, "na") or std.mem.eql(u8, cmd, "nh")) {
        commands.ens.namehash(ctx, args) catch |e| return handleError(ctx, e);
        return 0;
    }

    // Bytecode commands
    if (std.mem.eql(u8, cmd, "disassemble") or std.mem.eql(u8, cmd, "da")) {
        commands.bytecode.disassemble(ctx, args) catch |e| return handleError(ctx, e);
        return 0;
    }
    if (std.mem.eql(u8, cmd, "selectors") or std.mem.eql(u8, cmd, "sel")) {
        commands.bytecode.selectors(ctx, args) catch |e| return handleError(ctx, e);
        return 0;
    }

    // TUI command
    if (std.mem.eql(u8, cmd, "tui")) {
        return 255; // Launch TUI
    }

    // Unknown command
    ctx.err("error: unknown command '{s}'\n", .{cmd}) catch {};
    ctx.err("Run 'chop --help' for usage\n", .{}) catch {};
    return 1;
}

fn handleError(ctx: *Context, err: anyerror) u8 {
    ctx.err("error: {}\n", .{err}) catch {};
    return 1;
}

fn printHelp(file: std.fs.File) !void {
    try file.writeAll(
        \\Chop - A Swiss Army knife for Ethereum (cast-compatible)
        \\
        \\Usage: chop [OPTIONS] <COMMAND>
        \\
        \\Commands:
        \\  Conversion:
        \\    keccak, k              Hash data with Keccak-256
        \\    to-hex, th, 2h         Convert to hexadecimal
        \\    to-dec, td, 2d         Convert to decimal
        \\    to-wei, tw, 2w         Convert to wei
        \\    from-wei, fw           Convert from wei
        \\
        \\  Address:
        \\    to-checksum, ta, 2a    Convert to checksummed address
        \\    compute-address, ca    Compute contract address (CREATE)
        \\    create2, c2            Compute CREATE2 address
        \\    address-zero, az       Print zero address
        \\
        \\  Encoding:
        \\    to-rlp                 RLP encode data
        \\    from-rlp               RLP decode data
        \\    abi-encode, ae         ABI encode arguments
        \\    abi-decode, ad         ABI decode data
        \\    calldata, cd           Encode function calldata
        \\
        \\  Hex:
        \\    concat-hex, ch         Concatenate hex strings
        \\    to-utf8, tu8, 2u8      Convert hex to UTF-8
        \\    from-utf8, fu, fa      Convert UTF-8 to hex
        \\
        \\  Selectors:
        \\    sig, si                Get function selector
        \\    sig-event, se          Get event topic
        \\
        \\  Utility:
        \\    hash-zero, hz          Print zero hash
        \\    max-uint, maxu         Print max uint value
        \\    max-int, maxi          Print max int value
        \\    min-int, mini          Print min int value
        \\
        \\  ENS:
        \\    namehash, na, nh       Calculate ENS namehash
        \\
        \\  Bytecode:
        \\    disassemble, da        Disassemble EVM bytecode
        \\    selectors, sel         Extract function selectors
        \\
        \\  TUI:
        \\    tui                    Launch interactive TUI (default)
        \\
        \\Options:
        \\    -h, --help             Display this help
        \\    -j, --json             Output as JSON
        \\    -V, --version          Print version
        \\
        \\Examples:
        \\    chop keccak "hello"
        \\    chop to-checksum 0xd8da6bf26964af9d7eed9e03e53415d37aa96045
        \\    chop to-wei 1.5 ether
        \\    chop sig "transfer(address,uint256)"
        \\    chop                   # Launch TUI
        \\
    );
}
