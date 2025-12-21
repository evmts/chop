const std = @import("std");
const vaxis = @import("vaxis");
const vxfw = vaxis.vxfw;

const styles = @import("../styles.zig");
const types = @import("../types.zig");

/// Accounts list view
pub const AccountsView = struct {
    allocator: std.mem.Allocator,
    accounts: []const types.Account,
    selected_index: usize = 0,
    scroll_offset: usize = 0,
    show_detail: bool = false,
    show_private_key: bool = false,
    confirming_reveal: bool = false,

    pub fn init(allocator: std.mem.Allocator) AccountsView {
        return .{
            .allocator = allocator,
            .accounts = &.{},
        };
    }

    pub fn widget(self: *AccountsView) vxfw.Widget {
        return .{
            .userdata = self,
            .eventHandler = typeErasedEventHandler,
            .drawFn = typeErasedDrawFn,
        };
    }

    fn typeErasedEventHandler(ptr: *anyopaque, ctx: *vxfw.EventContext, event: vxfw.Event) anyerror!void {
        const self: *AccountsView = @ptrCast(@alignCast(ptr));
        return self.handleEvent(ctx, event);
    }

    fn handleEvent(self: *AccountsView, ctx: *vxfw.EventContext, event: vxfw.Event) !void {
        switch (event) {
            .key_press => |key| {
                if (self.show_detail) {
                    // Detail view navigation
                    if (key.matches(vaxis.Key.escape, .{})) {
                        self.show_detail = false;
                        self.show_private_key = false;
                        self.confirming_reveal = false;
                        ctx.consumeAndRedraw();
                        return;
                    }
                    // Toggle private key reveal
                    if (key.matches('p', .{})) {
                        if (self.confirming_reveal) {
                            self.show_private_key = !self.show_private_key;
                            self.confirming_reveal = false;
                        } else {
                            self.confirming_reveal = true;
                        }
                        ctx.consumeAndRedraw();
                        return;
                    }
                    // Copy address with 'c'
                    if (key.matches('c', .{})) {
                        if (self.selected_index < self.accounts.len) {
                            try ctx.copyToClipboard(self.accounts[self.selected_index].address);
                        }
                        ctx.consumeAndRedraw();
                        return;
                    }
                } else {
                    // List view navigation
                    if (key.matches('j', .{}) or key.matches(vaxis.Key.down, .{})) {
                        if (self.accounts.len > 0 and self.selected_index < self.accounts.len - 1) {
                            self.selected_index += 1;
                        }
                        ctx.consumeAndRedraw();
                        return;
                    }
                    if (key.matches('k', .{}) or key.matches(vaxis.Key.up, .{})) {
                        if (self.selected_index > 0) {
                            self.selected_index -= 1;
                        }
                        ctx.consumeAndRedraw();
                        return;
                    }
                    if (key.matches(vaxis.Key.enter, .{})) {
                        if (self.accounts.len > 0) {
                            self.show_detail = true;
                        }
                        ctx.consumeAndRedraw();
                        return;
                    }
                }
            },
            else => {},
        }
    }

    fn typeErasedDrawFn(ptr: *anyopaque, ctx: vxfw.DrawContext) std.mem.Allocator.Error!vxfw.Surface {
        const self: *AccountsView = @ptrCast(@alignCast(ptr));
        return self.draw(ctx);
    }

    fn draw(self: *AccountsView, ctx: vxfw.DrawContext) !vxfw.Surface {
        const max_size = ctx.max.size();
        var surface = try vxfw.Surface.init(ctx.arena, self.widget(), max_size);

        if (self.show_detail) {
            return self.drawDetail(ctx, &surface, max_size);
        }
        return self.drawList(ctx, &surface, max_size);
    }

    fn drawList(self: *AccountsView, ctx: vxfw.DrawContext, surface: *vxfw.Surface, max_size: vxfw.Size) !vxfw.Surface {
        var row: u16 = 0;

        // Header
        try writeString(surface, 2, row, "Accounts", styles.styles.title);
        row += 1;
        try writeString(surface, 2, row, "Pre-funded Test Accounts", styles.styles.muted);
        row += 2;

        // Column headers
        try writeString(surface, 2, row, "#", styles.styles.muted);
        try writeString(surface, 6, row, "Address", styles.styles.muted);
        try writeString(surface, 50, row, "Balance", styles.styles.muted);
        row += 1;
        try drawLine(surface, row, max_size.width, styles.styles.muted);
        row += 1;

        // Account list
        if (self.accounts.len == 0) {
            try writeString(surface, 2, row, "No accounts available", styles.styles.muted);
        } else {
            for (self.accounts, 0..) |account, i| {
                if (row >= max_size.height - 3) break;

                const is_selected = i == self.selected_index;
                const row_style = if (is_selected) styles.styles.selected else styles.styles.normal;

                // Draw selection indicator
                if (is_selected) {
                    try writeString(surface, 0, row, ">", styles.styles.value);
                }

                // Account index
                const index_str = try std.fmt.allocPrint(ctx.arena, "{d}", .{account.index});
                try writeString(surface, 2, row, index_str, row_style);

                // Address
                try writeString(surface, 6, row, account.address, row_style);

                // Balance (simplified - just show raw value)
                const balance_str = try std.fmt.allocPrint(ctx.arena, "{d} wei", .{@as(u64, @truncate(account.balance))});
                try writeString(surface, 50, row, balance_str, styles.styles.value);

                row += 1;
            }
        }

        return surface.*;
    }

    fn drawDetail(self: *AccountsView, ctx: vxfw.DrawContext, surface: *vxfw.Surface, max_size: vxfw.Size) !vxfw.Surface {
        _ = max_size;

        if (self.selected_index >= self.accounts.len) {
            try writeString(surface, 2, 0, "Account not found", styles.styles.err);
            return surface.*;
        }

        const account = self.accounts[self.selected_index];
        var row: u16 = 0;

        // Header
        try writeString(surface, 2, row, "Account Detail", styles.styles.title);
        row += 2;

        // Address
        try writeString(surface, 2, row, "Address:", styles.styles.muted);
        row += 1;
        try writeString(surface, 4, row, account.address, styles.styles.value);
        row += 2;

        // Balance
        try writeString(surface, 2, row, "Balance:", styles.styles.muted);
        row += 1;
        const balance_str = try std.fmt.allocPrint(ctx.arena, "{d} wei", .{@as(u64, @truncate(account.balance))});
        try writeString(surface, 4, row, balance_str, styles.styles.value);
        row += 2;

        // Nonce
        try writeString(surface, 2, row, "Nonce:", styles.styles.muted);
        row += 1;
        const nonce_str = try std.fmt.allocPrint(ctx.arena, "{d}", .{account.nonce});
        try writeString(surface, 4, row, nonce_str, styles.styles.value);
        row += 2;

        // Code hash
        try writeString(surface, 2, row, "Code Hash:", styles.styles.muted);
        row += 1;
        try writeString(surface, 4, row, account.code_hash, styles.styles.normal);
        row += 2;

        // Private key (if available and revealed)
        if (account.private_key) |pk| {
            try writeString(surface, 2, row, "Private Key:", styles.styles.muted);
            row += 1;

            if (self.confirming_reveal) {
                try writeString(surface, 4, row, "Press 'p' again to reveal (security risk!)", styles.styles.err);
            } else if (self.show_private_key) {
                try writeString(surface, 4, row, pk, styles.styles.err);
            } else {
                try writeString(surface, 4, row, "******* (press 'p' to reveal)", styles.styles.muted);
            }
        }

        return surface.*;
    }
};

// Helper functions

fn writeString(surface: *vxfw.Surface, col: u16, row: u16, text: []const u8, style: vaxis.Style) !void {
    var c = col;
    for (text) |char| {
        if (c >= surface.size.width) break;
        surface.writeCell(c, row, .{
            .char = .{ .grapheme = &[_]u8{char}, .width = 1 },
            .style = style,
        });
        c += 1;
    }
}

fn drawLine(surface: *vxfw.Surface, row: u16, width: u16, style: vaxis.Style) !void {
    for (0..width) |x| {
        surface.writeCell(@intCast(x), row, .{
            .char = .{ .grapheme = "─", .width = 1 },
            .style = style,
        });
    }
}
