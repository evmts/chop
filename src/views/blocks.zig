const std = @import("std");
const vaxis = @import("vaxis");
const vxfw = vaxis.vxfw;

const styles = @import("../styles.zig");
const types = @import("../types.zig");

/// Blocks list and detail view
pub const BlocksView = struct {
    allocator: std.mem.Allocator,
    blocks: []const types.Block,
    selected_index: usize = 0,
    scroll_offset: usize = 0,
    show_detail: bool = false,
    selected_block: ?types.Block = null,
    block_transactions: []const types.Transaction = &.{},

    pub fn init(allocator: std.mem.Allocator) BlocksView {
        return .{
            .allocator = allocator,
            .blocks = &.{},
        };
    }

    pub fn widget(self: *BlocksView) vxfw.Widget {
        return .{
            .userdata = self,
            .eventHandler = typeErasedEventHandler,
            .drawFn = typeErasedDrawFn,
        };
    }

    fn typeErasedEventHandler(ptr: *anyopaque, ctx: *vxfw.EventContext, event: vxfw.Event) anyerror!void {
        const self: *BlocksView = @ptrCast(@alignCast(ptr));
        return self.handleEvent(ctx, event);
    }

    fn handleEvent(self: *BlocksView, ctx: *vxfw.EventContext, event: vxfw.Event) !void {
        switch (event) {
            .key_press => |key| {
                if (self.show_detail) {
                    // Detail view - Escape to go back
                    if (key.matches(vaxis.Key.escape, .{})) {
                        self.show_detail = false;
                        self.selected_block = null;
                        ctx.consumeAndRedraw();
                        return;
                    }
                    // Copy block hash
                    if (key.matches('c', .{})) {
                        if (self.selected_block) |block| {
                            try ctx.copyToClipboard(block.hash);
                        }
                        ctx.consumeAndRedraw();
                        return;
                    }
                } else {
                    // List view navigation
                    if (key.matches('j', .{}) or key.matches(vaxis.Key.down, .{})) {
                        if (self.blocks.len > 0 and self.selected_index < self.blocks.len - 1) {
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
                        if (self.blocks.len > 0 and self.selected_index < self.blocks.len) {
                            self.selected_block = self.blocks[self.selected_index];
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
        const self: *BlocksView = @ptrCast(@alignCast(ptr));
        return self.draw(ctx);
    }

    fn draw(self: *BlocksView, ctx: vxfw.DrawContext) !vxfw.Surface {
        const max_size = ctx.max.size();
        var surface = try vxfw.Surface.init(ctx.arena, self.widget(), max_size);

        if (self.show_detail) {
            return self.drawDetail(ctx, &surface, max_size);
        }
        return self.drawList(ctx, &surface, max_size);
    }

    fn drawList(self: *BlocksView, ctx: vxfw.DrawContext, surface: *vxfw.Surface, max_size: vxfw.Size) !vxfw.Surface {
        var row: u16 = 0;

        // Header
        try writeString(surface, 2, row, "Blocks", styles.styles.title);
        row += 1;
        try writeString(surface, 2, row, "Block Explorer", styles.styles.muted);
        row += 2;

        // Column headers
        try writeString(surface, 2, row, "Block", styles.styles.muted);
        try writeString(surface, 12, row, "Hash", styles.styles.muted);
        try writeString(surface, 36, row, "Txs", styles.styles.muted);
        try writeString(surface, 44, row, "Gas Used", styles.styles.muted);
        try writeString(surface, 60, row, "Timestamp", styles.styles.muted);
        row += 1;
        try drawLine(surface, row, max_size.width, styles.styles.muted);
        row += 1;

        // Block list
        if (self.blocks.len == 0) {
            try writeString(surface, 2, row, "No blocks yet", styles.styles.muted);
        } else {
            for (self.blocks, 0..) |block, i| {
                if (row >= max_size.height - 3) break;

                const is_selected = i == self.selected_index;
                const row_style = if (is_selected) styles.styles.selected else styles.styles.normal;

                // Selection indicator
                if (is_selected) {
                    try writeString(surface, 0, row, ">", styles.styles.value);
                }

                // Block number
                const num_str = try std.fmt.allocPrint(ctx.arena, "#{d}", .{block.number});
                try writeString(surface, 2, row, num_str, row_style);

                // Hash (shortened)
                const short_hash = if (block.hash.len > 18) block.hash[0..18] else block.hash;
                try writeString(surface, 12, row, short_hash, row_style);

                // Transaction count
                const tx_count = try std.fmt.allocPrint(ctx.arena, "{d}", .{block.transactions.len});
                try writeString(surface, 36, row, tx_count, row_style);

                // Gas used
                const gas_str = try std.fmt.allocPrint(ctx.arena, "{d}", .{block.gas_used});
                try writeString(surface, 44, row, gas_str, row_style);

                // Timestamp
                const ts_str = try formatTimestamp(ctx.arena, block.timestamp);
                try writeString(surface, 60, row, ts_str, styles.styles.muted);

                row += 1;
            }
        }

        return surface.*;
    }

    fn drawDetail(self: *BlocksView, ctx: vxfw.DrawContext, surface: *vxfw.Surface, max_size: vxfw.Size) !vxfw.Surface {
        const block = self.selected_block orelse {
            try writeString(surface, 2, 0, "Block not found", styles.styles.err);
            return surface.*;
        };

        var row: u16 = 0;

        // Header
        const title = try std.fmt.allocPrint(ctx.arena, "Block #{d}", .{block.number});
        try writeString(surface, 2, row, title, styles.styles.title);
        row += 2;

        // Block details
        try writeString(surface, 2, row, "Hash:", styles.styles.muted);
        row += 1;
        try writeString(surface, 4, row, block.hash, styles.styles.value);
        row += 2;

        try writeString(surface, 2, row, "Parent Hash:", styles.styles.muted);
        row += 1;
        try writeString(surface, 4, row, block.parent_hash, styles.styles.normal);
        row += 2;

        try writeString(surface, 2, row, "Miner:", styles.styles.muted);
        row += 1;
        try writeString(surface, 4, row, block.miner, styles.styles.normal);
        row += 2;

        // Stats row
        const gas_str = try std.fmt.allocPrint(ctx.arena, "Gas Used: {d} / {d}", .{ block.gas_used, block.gas_limit });
        try writeString(surface, 2, row, gas_str, styles.styles.normal);
        row += 1;

        const size_str = try std.fmt.allocPrint(ctx.arena, "Size: {d} bytes", .{block.size});
        try writeString(surface, 2, row, size_str, styles.styles.normal);
        row += 2;

        try writeString(surface, 2, row, "Timestamp:", styles.styles.muted);
        row += 1;
        const ts_str = try formatTimestamp(ctx.arena, block.timestamp);
        try writeString(surface, 4, row, ts_str, styles.styles.normal);
        row += 2;

        // Transactions section
        const tx_title = try std.fmt.allocPrint(ctx.arena, "TRANSACTIONS ({d})", .{block.transactions.len});
        try writeString(surface, 2, row, tx_title, styles.styles.title);
        row += 1;
        try drawLine(surface, row, max_size.width, styles.styles.muted);
        row += 1;

        if (block.transactions.len == 0) {
            try writeString(surface, 2, row, "No transactions in this block", styles.styles.muted);
        } else {
            for (block.transactions) |tx_hash| {
                if (row >= max_size.height - 2) break;
                try writeString(surface, 2, row, tx_hash, styles.styles.normal);
                row += 1;
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

fn formatTimestamp(arena: std.mem.Allocator, timestamp: i64) ![]const u8 {
    // Simple formatting - just show the timestamp for now
    // In production, would convert to human-readable format
    return std.fmt.allocPrint(arena, "{d}", .{timestamp});
}
