const std = @import("std");
const vaxis = @import("vaxis");
const vxfw = vaxis.vxfw;

const styles = @import("../styles.zig");
const types = @import("../types.zig");

/// Transactions list and detail view
pub const TransactionsView = struct {
    allocator: std.mem.Allocator,
    transactions: []const types.Transaction,
    selected_index: usize = 0,
    scroll_offset: usize = 0,
    show_detail: bool = false,
    selected_tx: ?types.Transaction = null,
    log_selected_index: usize = 0,
    show_log_detail: bool = false,

    pub fn init(allocator: std.mem.Allocator) TransactionsView {
        return .{
            .allocator = allocator,
            .transactions = &.{},
        };
    }

    pub fn widget(self: *TransactionsView) vxfw.Widget {
        return .{
            .userdata = self,
            .eventHandler = typeErasedEventHandler,
            .drawFn = typeErasedDrawFn,
        };
    }

    fn typeErasedEventHandler(ptr: *anyopaque, ctx: *vxfw.EventContext, event: vxfw.Event) anyerror!void {
        const self: *TransactionsView = @ptrCast(@alignCast(ptr));
        return self.handleEvent(ctx, event);
    }

    fn handleEvent(self: *TransactionsView, ctx: *vxfw.EventContext, event: vxfw.Event) !void {
        switch (event) {
            .key_press => |key| {
                if (self.show_log_detail) {
                    // Log detail view
                    if (key.matches(vaxis.Key.escape, .{})) {
                        self.show_log_detail = false;
                        ctx.consumeAndRedraw();
                        return;
                    }
                } else if (self.show_detail) {
                    // Transaction detail view
                    if (key.matches(vaxis.Key.escape, .{})) {
                        self.show_detail = false;
                        self.selected_tx = null;
                        self.log_selected_index = 0;
                        ctx.consumeAndRedraw();
                        return;
                    }
                    // Navigate logs
                    if (key.matches('j', .{}) or key.matches(vaxis.Key.down, .{})) {
                        if (self.selected_tx) |tx| {
                            if (tx.logs.len > 0 and self.log_selected_index < tx.logs.len - 1) {
                                self.log_selected_index += 1;
                            }
                        }
                        ctx.consumeAndRedraw();
                        return;
                    }
                    if (key.matches('k', .{}) or key.matches(vaxis.Key.up, .{})) {
                        if (self.log_selected_index > 0) {
                            self.log_selected_index -= 1;
                        }
                        ctx.consumeAndRedraw();
                        return;
                    }
                    // Enter log detail
                    if (key.matches(vaxis.Key.enter, .{})) {
                        if (self.selected_tx) |tx| {
                            if (tx.logs.len > 0) {
                                self.show_log_detail = true;
                            }
                        }
                        ctx.consumeAndRedraw();
                        return;
                    }
                    // Copy tx hash
                    if (key.matches('c', .{})) {
                        if (self.selected_tx) |tx| {
                            try ctx.copyToClipboard(tx.hash);
                        }
                        ctx.consumeAndRedraw();
                        return;
                    }
                } else {
                    // List view navigation
                    if (key.matches('j', .{}) or key.matches(vaxis.Key.down, .{})) {
                        if (self.transactions.len > 0 and self.selected_index < self.transactions.len - 1) {
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
                        if (self.transactions.len > 0 and self.selected_index < self.transactions.len) {
                            self.selected_tx = self.transactions[self.selected_index];
                            self.show_detail = true;
                            self.log_selected_index = 0;
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
        const self: *TransactionsView = @ptrCast(@alignCast(ptr));
        return self.draw(ctx);
    }

    fn draw(self: *TransactionsView, ctx: vxfw.DrawContext) !vxfw.Surface {
        const max_size = ctx.max.size();
        var surface = try vxfw.Surface.init(ctx.arena, self.widget(), max_size);

        if (self.show_log_detail) {
            return self.drawLogDetail(ctx, &surface, max_size);
        }
        if (self.show_detail) {
            return self.drawDetail(ctx, &surface, max_size);
        }
        return self.drawList(ctx, &surface, max_size);
    }

    fn drawList(self: *TransactionsView, ctx: vxfw.DrawContext, surface: *vxfw.Surface, max_size: vxfw.Size) !vxfw.Surface {
        var row: u16 = 0;

        // Header
        try writeString(surface, 2, row, "Transactions", styles.styles.title);
        row += 1;
        try writeString(surface, 2, row, "Transaction History", styles.styles.muted);
        row += 2;

        // Column headers
        try writeString(surface, 2, row, "Status", styles.styles.muted);
        try writeString(surface, 10, row, "Hash", styles.styles.muted);
        try writeString(surface, 30, row, "From", styles.styles.muted);
        try writeString(surface, 50, row, "To", styles.styles.muted);
        try writeString(surface, 70, row, "Gas", styles.styles.muted);
        row += 1;
        try drawLine(surface, row, max_size.width, styles.styles.muted);
        row += 1;

        // Transaction list
        if (self.transactions.len == 0) {
            try writeString(surface, 2, row, "No transactions yet", styles.styles.muted);
        } else {
            for (self.transactions, 0..) |tx, i| {
                if (row >= max_size.height - 3) break;

                const is_selected = i == self.selected_index;
                const row_style = if (is_selected) styles.styles.selected else styles.styles.normal;

                // Selection indicator
                if (is_selected) {
                    try writeString(surface, 0, row, ">", styles.styles.value);
                }

                // Status
                const status = if (tx.status) "[OK]" else "[FAIL]";
                const status_style = if (tx.status) styles.styles.success else styles.styles.err;
                try writeString(surface, 2, row, status, status_style);

                // Hash (shortened)
                const short_hash = if (tx.hash.len > 16) tx.hash[0..16] else tx.hash;
                try writeString(surface, 10, row, short_hash, row_style);

                // From (shortened)
                const short_from = if (tx.from.len > 16) tx.from[0..16] else tx.from;
                try writeString(surface, 30, row, short_from, row_style);

                // To
                const to_str = if (tx.to) |to| (if (to.len > 16) to[0..16] else to) else "CREATE";
                try writeString(surface, 50, row, to_str, row_style);

                // Gas
                const gas_str = try std.fmt.allocPrint(ctx.arena, "{d}", .{tx.gas_used});
                try writeString(surface, 70, row, gas_str, styles.styles.muted);

                row += 1;
            }
        }

        return surface.*;
    }

    fn drawDetail(self: *TransactionsView, ctx: vxfw.DrawContext, surface: *vxfw.Surface, max_size: vxfw.Size) !vxfw.Surface {
        const tx = self.selected_tx orelse {
            try writeString(surface, 2, 0, "Transaction not found", styles.styles.err);
            return surface.*;
        };

        var row: u16 = 0;

        // Header
        try writeString(surface, 2, row, "Transaction Detail", styles.styles.title);
        row += 2;

        // Status
        const status_str = if (tx.status) "SUCCESS" else "FAILED";
        const status_style = if (tx.status) styles.styles.success else styles.styles.err;
        try writeString(surface, 2, row, "Status: ", styles.styles.muted);
        try writeString(surface, 10, row, status_str, status_style);
        row += 2;

        // Hash
        try writeString(surface, 2, row, "Hash:", styles.styles.muted);
        row += 1;
        try writeString(surface, 4, row, tx.hash, styles.styles.value);
        row += 2;

        // Block
        const block_str = try std.fmt.allocPrint(ctx.arena, "Block: #{d}", .{tx.block_number});
        try writeString(surface, 2, row, block_str, styles.styles.normal);
        row += 1;

        // From
        try writeString(surface, 2, row, "From:", styles.styles.muted);
        row += 1;
        try writeString(surface, 4, row, tx.from, styles.styles.normal);
        row += 1;

        // To
        try writeString(surface, 2, row, "To:", styles.styles.muted);
        row += 1;
        const to_str = tx.to orelse "(Contract Creation)";
        try writeString(surface, 4, row, to_str, styles.styles.normal);
        row += 2;

        // Value & Gas
        const value_str = try std.fmt.allocPrint(ctx.arena, "Value: {d} wei", .{@as(u64, @truncate(tx.value))});
        try writeString(surface, 2, row, value_str, styles.styles.value);
        row += 1;

        const gas_str = try std.fmt.allocPrint(ctx.arena, "Gas: {d} / {d}", .{ tx.gas_used, tx.gas_limit });
        try writeString(surface, 2, row, gas_str, styles.styles.normal);
        row += 2;

        // Call type
        try writeString(surface, 2, row, "Type: ", styles.styles.muted);
        try writeString(surface, 8, row, tx.call_type.toString(), styles.styles.normal);
        row += 2;

        // Error info if failed
        if (!tx.status) {
            if (tx.error_info) |err| {
                try writeString(surface, 2, row, "Error:", styles.styles.err);
                row += 1;
                try writeString(surface, 4, row, err, styles.styles.err);
                row += 2;
            }
        }

        // Deployed address if CREATE
        if (tx.deployed_addr) |addr| {
            try writeString(surface, 2, row, "Deployed:", styles.styles.muted);
            row += 1;
            try writeString(surface, 4, row, addr, styles.styles.success);
            row += 2;
        }

        // Logs section
        const logs_title = try std.fmt.allocPrint(ctx.arena, "LOGS ({d})", .{tx.logs.len});
        try writeString(surface, 2, row, logs_title, styles.styles.title);
        row += 1;
        try drawLine(surface, row, max_size.width, styles.styles.muted);
        row += 1;

        if (tx.logs.len == 0) {
            try writeString(surface, 2, row, "No logs emitted", styles.styles.muted);
        } else {
            for (tx.logs, 0..) |log, i| {
                if (row >= max_size.height - 2) break;

                const is_selected = i == self.log_selected_index;
                const log_style = if (is_selected) styles.styles.selected else styles.styles.normal;

                if (is_selected) {
                    try writeString(surface, 0, row, ">", styles.styles.value);
                }

                const log_str = try std.fmt.allocPrint(ctx.arena, "Log {d}: {s}", .{ i, log.address });
                try writeString(surface, 2, row, log_str, log_style);
                row += 1;
            }
        }

        return surface.*;
    }

    fn drawLogDetail(self: *TransactionsView, ctx: vxfw.DrawContext, surface: *vxfw.Surface, max_size: vxfw.Size) !vxfw.Surface {
        _ = max_size;

        const tx = self.selected_tx orelse {
            try writeString(surface, 2, 0, "Transaction not found", styles.styles.err);
            return surface.*;
        };

        if (self.log_selected_index >= tx.logs.len) {
            try writeString(surface, 2, 0, "Log not found", styles.styles.err);
            return surface.*;
        }

        const log = tx.logs[self.log_selected_index];
        var row: u16 = 0;

        // Header
        const title = try std.fmt.allocPrint(ctx.arena, "Log #{d}", .{self.log_selected_index});
        try writeString(surface, 2, row, title, styles.styles.title);
        row += 2;

        // Address
        try writeString(surface, 2, row, "Contract:", styles.styles.muted);
        row += 1;
        try writeString(surface, 4, row, log.address, styles.styles.value);
        row += 2;

        // Topics
        const topics_title = try std.fmt.allocPrint(ctx.arena, "Topics ({d}):", .{log.topics.len});
        try writeString(surface, 2, row, topics_title, styles.styles.muted);
        row += 1;

        for (log.topics, 0..) |topic, i| {
            const topic_label = try std.fmt.allocPrint(ctx.arena, "  [{d}] ", .{i});
            try writeString(surface, 2, row, topic_label, styles.styles.muted);
            try writeString(surface, 8, row, topic, styles.styles.normal);
            row += 1;
        }
        row += 1;

        // Data
        try writeString(surface, 2, row, "Data:", styles.styles.muted);
        row += 1;
        if (log.data.len > 0) {
            try writeString(surface, 4, row, log.data, styles.styles.normal);
        } else {
            try writeString(surface, 4, row, "(empty)", styles.styles.muted);
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
