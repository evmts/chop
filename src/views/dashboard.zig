const std = @import("std");
const vaxis = @import("vaxis");
const vxfw = vaxis.vxfw;

const styles = @import("../styles.zig");
const types = @import("../types.zig");
const core = @import("../core/mod.zig");

/// Dashboard view showing blockchain statistics and recent activity
pub const DashboardView = struct {
    allocator: std.mem.Allocator,
    blockchain: ?*core.Blockchain = null,
    stats: types.BlockchainStats,
    recent_blocks: []const types.Block,
    recent_txs: []const types.Transaction,
    auto_refresh: bool = true,

    pub fn init(allocator: std.mem.Allocator) DashboardView {
        return .{
            .allocator = allocator,
            .stats = .{},
            .recent_blocks = &.{},
            .recent_txs = &.{},
        };
    }

    pub fn widget(self: *DashboardView) vxfw.Widget {
        return .{
            .userdata = self,
            .eventHandler = typeErasedEventHandler,
            .drawFn = typeErasedDrawFn,
        };
    }

    fn typeErasedEventHandler(ptr: *anyopaque, ctx: *vxfw.EventContext, event: vxfw.Event) anyerror!void {
        const self: *DashboardView = @ptrCast(@alignCast(ptr));
        return self.handleEvent(ctx, event);
    }

    fn handleEvent(self: *DashboardView, ctx: *vxfw.EventContext, event: vxfw.Event) !void {
        switch (event) {
            .key_press => |key| {
                // Toggle auto-refresh with 'a'
                if (key.matches('a', .{})) {
                    self.auto_refresh = !self.auto_refresh;
                    ctx.consumeAndRedraw();
                    return;
                }
                // Manual refresh with 'r'
                if (key.matches('r', .{})) {
                    self.refresh();
                    ctx.consumeAndRedraw();
                    return;
                }
            },
            else => {},
        }
    }

    /// Refresh dashboard data from blockchain
    fn refresh(self: *DashboardView) void {
        if (self.blockchain) |blockchain| {
            self.stats = blockchain.getStats();
            self.recent_blocks = blockchain.getRecentBlocks(5);
            self.recent_txs = blockchain.getRecentTransactions(5);
        }
    }

    fn typeErasedDrawFn(ptr: *anyopaque, ctx: vxfw.DrawContext) std.mem.Allocator.Error!vxfw.Surface {
        const self: *DashboardView = @ptrCast(@alignCast(ptr));
        return self.draw(ctx);
    }

    fn draw(self: *DashboardView, ctx: vxfw.DrawContext) !vxfw.Surface {
        const max_size = ctx.max.size();
        var surface = try vxfw.Surface.init(ctx.arena, self.widget(), max_size);

        var row: u16 = 0;

        // Title
        const title = "Chop Dashboard";
        try writeString(&surface, 2, row, title, styles.styles.title);
        row += 1;

        const subtitle = "Local EVM Development Environment";
        try writeString(&surface, 2, row, subtitle, styles.styles.muted);
        row += 2;

        // Auto-refresh indicator
        const refresh_label = if (self.auto_refresh) "Auto-refresh: Enabled" else "Auto-refresh: Disabled";
        const refresh_style = if (self.auto_refresh) styles.styles.success else styles.styles.muted;
        try writeString(&surface, 2, row, refresh_label, refresh_style);
        row += 2;

        // Statistics section
        try writeString(&surface, 2, row, "BLOCKCHAIN STATS", styles.styles.title);
        row += 1;
        try drawLine(&surface, row, max_size.width, styles.styles.muted);
        row += 1;

        // Stats grid
        try drawStatRow(&surface, ctx.arena, row, 2, "Block Height", self.stats.block_height);
        try drawStatRow(&surface, ctx.arena, row, 30, "Total Blocks", self.stats.total_blocks);
        row += 1;

        try drawStatRow(&surface, ctx.arena, row, 2, "Transactions", self.stats.total_transactions);
        try drawStatRow(&surface, ctx.arena, row, 30, "Successful", self.stats.successful_txs);
        row += 1;

        try drawStatRow(&surface, ctx.arena, row, 2, "Failed Txs", self.stats.failed_txs);
        try drawStatRow(&surface, ctx.arena, row, 30, "Gas Used", self.stats.total_gas_used);
        row += 1;

        try drawStatRow(&surface, ctx.arena, row, 2, "Accounts", @as(u64, self.stats.total_accounts));
        try drawStatRow(&surface, ctx.arena, row, 30, "Contracts", @as(u64, self.stats.total_contracts));
        row += 2;

        // Recent blocks section
        try writeString(&surface, 2, row, "RECENT BLOCKS", styles.styles.title);
        row += 1;
        try drawLine(&surface, row, max_size.width, styles.styles.muted);
        row += 1;

        if (self.recent_blocks.len == 0) {
            try writeString(&surface, 2, row, "No blocks yet", styles.styles.muted);
            row += 1;
        } else {
            for (self.recent_blocks) |block| {
                const block_str = try std.fmt.allocPrint(ctx.arena, "Block #{d} - {d} txs - Gas: {d}", .{ block.number, block.transactions.len, block.gas_used });
                try writeString(&surface, 2, row, block_str, styles.styles.normal);
                row += 1;
                if (row >= max_size.height - 8) break;
            }
        }
        row += 1;

        // Recent transactions section
        try writeString(&surface, 2, row, "RECENT TRANSACTIONS", styles.styles.title);
        row += 1;
        try drawLine(&surface, row, max_size.width, styles.styles.muted);
        row += 1;

        if (self.recent_txs.len == 0) {
            try writeString(&surface, 2, row, "No transactions yet", styles.styles.muted);
        } else {
            for (self.recent_txs) |tx| {
                const status_char: []const u8 = if (tx.status) "[OK]" else "[FAIL]";
                const tx_str = try std.fmt.allocPrint(ctx.arena, "{s} {s} -> {s}", .{
                    status_char,
                    shortenAddress(tx.from),
                    if (tx.to) |to| shortenAddress(to) else "CREATE",
                });
                const tx_style = if (tx.status) styles.styles.normal else styles.styles.err;
                try writeString(&surface, 2, row, tx_str, tx_style);
                row += 1;
                if (row >= max_size.height - 4) break;
            }
        }

        return surface;
    }
};

// Helper functions for drawing

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

fn drawStatRow(surface: *vxfw.Surface, arena: std.mem.Allocator, row: u16, col: u16, label: []const u8, value: u64) !void {
    try writeString(surface, col, row, label, styles.styles.muted);
    const value_str = try std.fmt.allocPrint(arena, ": {d}", .{value});
    try writeString(surface, col + @as(u16, @intCast(label.len)), row, value_str, styles.styles.value);
}

fn shortenAddress(addr: []const u8) []const u8 {
    if (addr.len <= 10) return addr;
    // Return first 6 and last 4 characters
    // This is a simplified version - in real code we'd format properly
    return addr[0..10];
}
