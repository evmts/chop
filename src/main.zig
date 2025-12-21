const std = @import("std");
const vaxis = @import("vaxis");
const vxfw = vaxis.vxfw;

const ChopApp = @import("root.zig").ChopApp;
const cli = @import("cli/mod.zig");

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    // Try CLI first
    const cli_result = cli.run(allocator) catch |e| {
        std.debug.print("CLI error: {}\n", .{e});
        std.process.exit(1);
    };

    // If CLI returns 255, launch TUI (default behavior)
    if (cli_result != 255) {
        std.process.exit(cli_result);
    }

    // Initialize the TUI application
    var app = try vxfw.App.init(allocator);
    defer app.deinit();

    // Create the root widget
    const chop = try ChopApp.init(allocator);
    defer chop.deinit();

    // Run the TUI application
    try app.run(chop.widget(), .{});
}
