const std = @import("std");
const vaxis = @import("vaxis");
const vxfw = vaxis.vxfw;

const styles = @import("../styles.zig");
const types = @import("../types.zig");
const core = @import("../core/mod.zig");

/// Settings view with configuration options
pub const SettingsView = struct {
    allocator: std.mem.Allocator,
    blockchain: ?*core.Blockchain = null,
    selected_option: usize = 0,
    confirming_action: bool = false,
    server_running: bool = false,
    server_port: u16 = 8545,
    feedback_message: ?[]const u8 = null,

    pub fn init(allocator: std.mem.Allocator) SettingsView {
        return .{
            .allocator = allocator,
        };
    }

    pub fn widget(self: *SettingsView) vxfw.Widget {
        return .{
            .userdata = self,
            .eventHandler = typeErasedEventHandler,
            .drawFn = typeErasedDrawFn,
        };
    }

    fn typeErasedEventHandler(ptr: *anyopaque, ctx: *vxfw.EventContext, event: vxfw.Event) anyerror!void {
        const self: *SettingsView = @ptrCast(@alignCast(ptr));
        return self.handleEvent(ctx, event);
    }

    fn handleEvent(self: *SettingsView, ctx: *vxfw.EventContext, event: vxfw.Event) !void {
        switch (event) {
            .key_press => |key| {
                if (self.confirming_action) {
                    // Confirmation dialog
                    if (key.matches('y', .{}) or key.matches('Y', .{})) {
                        // Execute confirmed action
                        const option = types.SettingsOption.all()[self.selected_option];
                        switch (option) {
                            .reset_state => {
                                if (self.blockchain) |blockchain| {
                                    blockchain.reset() catch {
                                        self.feedback_message = "Reset failed";
                                    };
                                    self.feedback_message = "Blockchain state reset";
                                } else {
                                    self.feedback_message = "No blockchain connection";
                                }
                            },
                            .regenerate_accounts => {
                                if (self.blockchain) |blockchain| {
                                    blockchain.regenerateAccounts() catch {
                                        self.feedback_message = "Account regeneration failed";
                                    };
                                    self.feedback_message = "Accounts regenerated with new keys";
                                } else {
                                    self.feedback_message = "No blockchain connection";
                                }
                            },
                            else => {},
                        }
                        self.confirming_action = false;
                        ctx.consumeAndRedraw();
                        return;
                    }
                    if (key.matches('n', .{}) or key.matches('N', .{}) or key.matches(vaxis.Key.escape, .{})) {
                        self.confirming_action = false;
                        ctx.consumeAndRedraw();
                        return;
                    }
                    return;
                }

                // Navigation
                if (key.matches('j', .{}) or key.matches(vaxis.Key.down, .{})) {
                    const options = types.SettingsOption.all();
                    if (self.selected_option < options.len - 1) {
                        self.selected_option += 1;
                        self.feedback_message = null;
                    }
                    ctx.consumeAndRedraw();
                    return;
                }
                if (key.matches('k', .{}) or key.matches(vaxis.Key.up, .{})) {
                    if (self.selected_option > 0) {
                        self.selected_option -= 1;
                        self.feedback_message = null;
                    }
                    ctx.consumeAndRedraw();
                    return;
                }

                // Select/execute option
                if (key.matches(vaxis.Key.enter, .{})) {
                    const option = types.SettingsOption.all()[self.selected_option];
                    switch (option) {
                        .server_status => {
                            // Toggle server
                            self.server_running = !self.server_running;
                            self.feedback_message = if (self.server_running) "Server started" else "Server stopped";
                        },
                        .reset_state, .regenerate_accounts => {
                            // Require confirmation
                            self.confirming_action = true;
                        },
                        .export_state => {
                            if (self.blockchain) |blockchain| {
                                const success = self.exportState(blockchain);
                                if (success) {
                                    self.feedback_message = "State exported to ~/.chop/export.json";
                                } else {
                                    self.feedback_message = "Export failed - check permissions";
                                }
                            } else {
                                self.feedback_message = "No blockchain connection";
                            }
                        },
                    }
                    ctx.consumeAndRedraw();
                    return;
                }
            },
            else => {},
        }
    }

    /// Export blockchain state to JSON file
    fn exportState(self: *SettingsView, blockchain: *core.Blockchain) bool {
        _ = self;

        // Create ~/.chop directory if needed
        const home = std.posix.getenv("HOME") orelse return false;

        var path_buf: [256]u8 = undefined;
        const dir_path = std.fmt.bufPrint(&path_buf, "{s}/.chop", .{home}) catch return false;

        // Try to create directory (ignore if exists)
        std.fs.cwd().makeDir(dir_path) catch |err| {
            if (err != error.PathAlreadyExists) return false;
        };

        // Build export file path
        var file_path_buf: [280]u8 = undefined;
        const file_path = std.fmt.bufPrint(&file_path_buf, "{s}/.chop/export.json", .{home}) catch return false;

        // Create/open the file
        const file = std.fs.cwd().createFile(file_path, .{}) catch return false;
        defer file.close();

        // Write JSON header
        file.writeAll("{\n") catch return false;
        file.writeAll("  \"version\": \"1.0\",\n") catch return false;

        // Write stats
        const stats = blockchain.getStats();
        var stats_buf: [512]u8 = undefined;
        const stats_json = std.fmt.bufPrint(&stats_buf,
            \\  "stats": {{
            \\    "block_height": {d},
            \\    "total_transactions": {d},
            \\    "total_accounts": {d},
            \\    "total_contracts": {d}
            \\  }},
            \\
        , .{ stats.block_height, stats.total_transactions, stats.total_accounts, stats.total_contracts }) catch return false;
        file.writeAll(stats_json) catch return false;

        // Write accounts array
        file.writeAll("  \"accounts\": [\n") catch return false;
        const accounts = blockchain.getAccounts();
        for (accounts, 0..) |account, i| {
            var acc_buf: [256]u8 = undefined;
            const acc_json = std.fmt.bufPrint(&acc_buf,
                \\    {{ "address": "{s}", "nonce": {d} }}
            , .{ account.address, account.nonce }) catch continue;
            file.writeAll(acc_json) catch return false;
            if (i < accounts.len - 1) {
                file.writeAll(",\n") catch return false;
            } else {
                file.writeAll("\n") catch return false;
            }
        }
        file.writeAll("  ]\n") catch return false;

        file.writeAll("}\n") catch return false;

        return true;
    }

    fn typeErasedDrawFn(ptr: *anyopaque, ctx: vxfw.DrawContext) std.mem.Allocator.Error!vxfw.Surface {
        const self: *SettingsView = @ptrCast(@alignCast(ptr));
        return self.draw(ctx);
    }

    fn draw(self: *SettingsView, ctx: vxfw.DrawContext) !vxfw.Surface {
        const max_size = ctx.max.size();
        var surface = try vxfw.Surface.init(ctx.arena, self.widget(), max_size);

        var row: u16 = 0;

        // Header
        try writeString(&surface, ctx, 2, row, "Settings", styles.styles.title);
        row += 1;
        try writeString(&surface, ctx, 2, row, "Configuration & Options", styles.styles.muted);
        row += 2;

        // Server status
        try writeString(&surface, ctx, 2, row, "RPC SERVER", styles.styles.title);
        row += 1;
        try drawLine(&surface, row, max_size.width, styles.styles.muted);
        row += 1;

        const status = if (self.server_running) "Running" else "Stopped";
        const status_style = if (self.server_running) styles.styles.success else styles.styles.muted;
        try writeString(&surface, ctx, 2, row, "Status: ", styles.styles.muted);
        try writeString(&surface, ctx, 10, row, status, status_style);
        row += 1;

        if (self.server_running) {
            const port_str = try std.fmt.allocPrint(ctx.arena, "Port: {d}", .{self.server_port});
            try writeString(&surface, ctx, 2, row, port_str, styles.styles.normal);
            row += 1;

            const url = try std.fmt.allocPrint(ctx.arena, "URL: http://localhost:{d}", .{self.server_port});
            try writeString(&surface, ctx, 2, row, url, styles.styles.value);
        }
        row += 2;

        // Options
        try writeString(&surface, ctx, 2, row, "OPTIONS", styles.styles.title);
        row += 1;
        try drawLine(&surface, row, max_size.width, styles.styles.muted);
        row += 1;

        const options = types.SettingsOption.all();
        for (options, 0..) |option, i| {
            const is_selected = i == self.selected_option;
            const label_style = if (is_selected) styles.styles.selected else styles.styles.normal;

            if (is_selected) {
                try writeString(&surface, ctx, 0, row, ">", styles.styles.value);
            }

            try writeString(&surface, ctx, 2, row, option.label(), label_style);
            row += 1;

            try writeString(&surface, ctx, 4, row, option.description(), styles.styles.muted);
            row += 2;
        }

        // Confirmation dialog
        if (self.confirming_action) {
            row += 1;
            try writeString(&surface, ctx, 2, row, "Are you sure? (y/n)", styles.styles.err);
        }

        // Feedback message
        if (self.feedback_message) |msg| {
            row += 1;
            try writeString(&surface, ctx, 2, row, msg, styles.styles.success);
        }

        return surface;
    }
};

// Helper functions

fn writeString(surface: *vxfw.Surface, ctx: vxfw.DrawContext, col: u16, row: u16, text: []const u8, style: vaxis.Style) !void {
    var c = col;
    var iter = ctx.graphemeIterator(text);
    while (iter.next()) |grapheme_result| {
        if (c >= surface.size.width) break;
        const grapheme = grapheme_result.bytes(text);
        const width: u8 = @intCast(ctx.stringWidth(grapheme));
        surface.writeCell(c, row, .{
            .char = .{ .grapheme = grapheme, .width = width },
            .style = style,
        });
        c += width;
    }
}

fn drawLine(surface: *vxfw.Surface, row: u16, width: u16, style: vaxis.Style) !void {
    for (0..width) |x| {
        surface.writeCell(@intCast(x), row, .{
            .char = .{ .grapheme = "-", .width = 1 },
            .style = style,
        });
    }
}
