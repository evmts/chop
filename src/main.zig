const std = @import("std");
const vaxis = @import("vaxis");
const vxfw = vaxis.vxfw;

const ChopApp = @import("root.zig").ChopApp;

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    // Initialize the application
    var app = try vxfw.App.init(allocator);
    defer app.deinit();

    // Create the root widget
    const chop = try ChopApp.init(allocator);
    defer chop.deinit();

    // Run the application
    try app.run(chop.widget(), .{});
}
