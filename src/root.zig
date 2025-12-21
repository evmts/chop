const std = @import("std");
const vaxis = @import("vaxis");
const vxfw = vaxis.vxfw;

const Tab = @import("state/tab.zig").Tab;
const styles = @import("styles.zig");
const views = @import("views/mod.zig");
const types = @import("types.zig");
const core = @import("core/mod.zig");

/// ChopApp is the root widget for the Chop TUI application.
/// It manages tab navigation and delegates rendering to child views.
pub const ChopApp = struct {
    allocator: std.mem.Allocator,
    current_tab: Tab = .dashboard,

    // Blockchain simulation
    blockchain: *core.Blockchain,

    // View instances
    dashboard_view: views.DashboardView,
    accounts_view: views.AccountsView,
    blocks_view: views.BlocksView,
    transactions_view: views.TransactionsView,
    contracts_view: views.ContractsView,
    history_view: views.HistoryView,
    settings_view: views.SettingsView,
    inspector_view: views.InspectorView,

    pub fn init(allocator: std.mem.Allocator) !*ChopApp {
        const self = try allocator.create(ChopApp);
        errdefer allocator.destroy(self);

        // Initialize blockchain simulation
        const blockchain = try core.Blockchain.init(allocator);
        errdefer blockchain.deinit();

        self.* = .{
            .allocator = allocator,
            .blockchain = blockchain,
            .dashboard_view = views.DashboardView.init(allocator),
            .accounts_view = views.AccountsView.init(allocator),
            .blocks_view = views.BlocksView.init(allocator),
            .transactions_view = views.TransactionsView.init(allocator),
            .contracts_view = views.ContractsView.init(allocator),
            .history_view = views.HistoryView.init(allocator),
            .settings_view = views.SettingsView.init(allocator),
            .inspector_view = views.InspectorView.init(allocator),
        };

        // Connect views to blockchain data
        self.dashboard_view.blockchain = blockchain;
        self.dashboard_view.stats = blockchain.getStats();
        self.dashboard_view.recent_blocks = blockchain.getRecentBlocks(5);
        self.dashboard_view.recent_txs = blockchain.getRecentTransactions(5);
        self.accounts_view.accounts = blockchain.getAccounts();
        self.blocks_view.blocks = blockchain.getBlocks();
        self.transactions_view.transactions = blockchain.getTransactions();
        self.contracts_view.contracts = blockchain.getContracts();
        self.history_view.entries = blockchain.getCallHistory();
        self.history_view.blockchain = blockchain;
        self.settings_view.blockchain = blockchain;
        self.inspector_view.blockchain = blockchain;

        return self;
    }

    pub fn deinit(self: *ChopApp) void {
        self.inspector_view.deinit();
        self.blockchain.deinit();
        self.allocator.destroy(self);
    }

    pub fn widget(self: *ChopApp) vxfw.Widget {
        return .{
            .userdata = self,
            .eventHandler = typeErasedEventHandler,
            .drawFn = typeErasedDrawFn,
        };
    }

    fn typeErasedEventHandler(ptr: *anyopaque, ctx: *vxfw.EventContext, event: vxfw.Event) anyerror!void {
        const self: *ChopApp = @ptrCast(@alignCast(ptr));
        return self.handleEvent(ctx, event);
    }

    fn typeErasedDrawFn(ptr: *anyopaque, ctx: vxfw.DrawContext) std.mem.Allocator.Error!vxfw.Surface {
        const self: *ChopApp = @ptrCast(@alignCast(ptr));
        return self.draw(ctx);
    }

    fn handleEvent(self: *ChopApp, ctx: *vxfw.EventContext, event: vxfw.Event) !void {
        switch (event) {
            .key_press => |key| {
                // Global quit: q or Ctrl+C
                if (key.matches('q', .{}) or key.matches('c', .{ .ctrl = true })) {
                    ctx.quit = true;
                    return;
                }

                // Tab navigation: keys 1-7
                if (Tab.fromKey(key.codepoint)) |tab| {
                    self.current_tab = tab;
                    ctx.consumeAndRedraw();
                    return;
                }

                // Delegate to current view
                try self.getCurrentView().handleEvent(ctx, event);
            },
            else => {
                // Delegate other events to current view
                try self.getCurrentView().handleEvent(ctx, event);
            },
        }
    }

    fn getCurrentView(self: *ChopApp) vxfw.Widget {
        return switch (self.current_tab) {
            .dashboard => self.dashboard_view.widget(),
            .call_history => self.history_view.widget(),
            .contracts => self.contracts_view.widget(),
            .accounts => self.accounts_view.widget(),
            .blocks => self.blocks_view.widget(),
            .transactions => self.transactions_view.widget(),
            .settings => self.settings_view.widget(),
        };
    }

    fn draw(self: *ChopApp, ctx: vxfw.DrawContext) !vxfw.Surface {
        const max_size = ctx.max.size();

        // Create main surface
        var surface = try vxfw.Surface.init(ctx.arena, self.widget(), max_size);

        // Draw tab bar at the top (row 0)
        var col: u16 = 1;
        for (Tab.all()) |tab| {
            const label = tab.label();
            const style = if (tab == self.current_tab) styles.styles.tab_active else styles.styles.tab_inactive;

            // Draw tab label using proper grapheme iteration
            var iter = ctx.graphemeIterator(label);
            while (iter.next()) |grapheme_result| {
                if (col >= max_size.width) break;
                const grapheme = grapheme_result.bytes(label);
                const width: u8 = @intCast(ctx.stringWidth(grapheme));
                surface.writeCell(col, 0, .{
                    .char = .{ .grapheme = grapheme, .width = width },
                    .style = style,
                });
                col += width;
            }

            // Add separator
            if (col < max_size.width) {
                surface.writeCell(col, 0, .{
                    .char = .{ .grapheme = " ", .width = 1 },
                    .style = styles.styles.muted,
                });
                col += 1;
            }
        }

        // Draw separator line (row 1)
        for (0..max_size.width) |x| {
            surface.writeCell(@intCast(x), 1, .{
                .char = .{ .grapheme = "-", .width = 1 },
                .style = styles.styles.muted,
            });
        }

        // Draw current view as a child surface (starting at row 2)
        if (max_size.height > 4) {
            const content_height = max_size.height - 3; // Leave room for tab bar and help bar
            const content_ctx = ctx.withConstraints(
                .{ .width = max_size.width, .height = 0 },
                .{ .width = max_size.width, .height = content_height },
            );

            const view_surface = try self.getCurrentView().draw(content_ctx);

            // Add as child surface
            const children = try ctx.arena.alloc(vxfw.SubSurface, 1);
            children[0] = .{
                .origin = .{ .row = 2, .col = 0 },
                .surface = view_surface,
            };
            surface.children = children;
        }

        // Draw help bar at bottom
        if (max_size.height > 2) {
            const help_row = max_size.height - 1;
            const help_text = getHelpText(self.current_tab);

            var help_col: u16 = 1;
            var help_iter = ctx.graphemeIterator(help_text);
            while (help_iter.next()) |grapheme_result| {
                if (help_col >= max_size.width - 1) break;
                const grapheme = grapheme_result.bytes(help_text);
                const width: u8 = @intCast(ctx.stringWidth(grapheme));
                surface.writeCell(help_col, help_row, .{
                    .char = .{ .grapheme = grapheme, .width = width },
                    .style = styles.styles.muted,
                });
                help_col += width;
            }
        }

        return surface;
    }
};

fn getHelpText(tab: Tab) []const u8 {
    return switch (tab) {
        .dashboard => "q: Quit | 1-7: Switch tabs | a: Toggle auto-refresh | r: Refresh",
        .call_history => "q: Quit | 1-7: Tabs | j/k: Navigate | Enter: Detail | n: New call | e: Execute",
        .contracts => "q: Quit | 1-7: Tabs | j/k: Navigate | Enter: Detail | h/l: Blocks | g: Jump | G: Goto PC",
        .accounts => "q: Quit | 1-7: Tabs | j/k: Navigate | Enter: Detail | c: Copy | p: Private key",
        .blocks => "q: Quit | 1-7: Tabs | j/k: Navigate | Enter: Detail | c: Copy hash",
        .transactions => "q: Quit | 1-7: Tabs | j/k: Navigate | Enter: Detail | c: Copy hash",
        .settings => "q: Quit | 1-7: Tabs | j/k: Navigate | Enter: Select",
    };
}
