const std = @import("std");
const vaxis = @import("vaxis");
const vxfw = vaxis.vxfw;

const Tab = @import("state/tab.zig").Tab;
const styles = @import("styles.zig");

/// ChopApp is the root widget for the Chop TUI application.
/// It manages tab navigation and delegates rendering to child views.
pub const ChopApp = struct {
    allocator: std.mem.Allocator,
    current_tab: Tab = .dashboard,

    pub fn init(allocator: std.mem.Allocator) !*ChopApp {
        const self = try allocator.create(ChopApp);
        self.* = .{
            .allocator = allocator,
        };
        return self;
    }

    pub fn deinit(self: *ChopApp) void {
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
            },
            else => {},
        }
    }

    fn draw(self: *ChopApp, ctx: vxfw.DrawContext) !vxfw.Surface {
        const max_size = ctx.max.size();

        // Create surface
        var surface = try vxfw.Surface.init(ctx.arena, self.widget(), max_size);

        // Draw tab bar at the top
        var col: u16 = 1;
        for (Tab.all()) |tab| {
            const label = tab.label();
            const style = if (tab == self.current_tab) styles.styles.tab_active else styles.styles.tab_inactive;

            // Draw tab label
            for (label) |char| {
                if (col < max_size.width) {
                    surface.writeCell(col, 0, .{
                        .char = .{ .grapheme = &[_]u8{char}, .width = 1 },
                        .style = style,
                    });
                    col += 1;
                }
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

        // Draw separator line
        if (max_size.height > 1) {
            for (0..max_size.width) |x| {
                surface.writeCell(@intCast(x), 1, .{
                    .char = .{ .grapheme = "─", .width = 1 },
                    .style = styles.styles.muted,
                });
            }
        }

        // Draw current tab content
        if (max_size.height > 3) {
            const content_start_row: u16 = 3;
            const title = self.current_tab.shortLabel();
            const help = self.current_tab.helpText();

            // Draw tab title
            var title_col: u16 = 2;
            for (title) |char| {
                if (title_col < max_size.width - 1) {
                    surface.writeCell(title_col, content_start_row, .{
                        .char = .{ .grapheme = &[_]u8{char}, .width = 1 },
                        .style = styles.styles.title,
                    });
                    title_col += 1;
                }
            }

            // Draw help text
            var help_col: u16 = 2;
            for (help) |char| {
                if (help_col < max_size.width - 1) {
                    surface.writeCell(help_col, content_start_row + 2, .{
                        .char = .{ .grapheme = &[_]u8{char}, .width = 1 },
                        .style = styles.styles.muted,
                    });
                    help_col += 1;
                }
            }

            // Draw placeholder message
            const placeholder = "(Content coming soon)";
            var ph_col: u16 = 2;
            for (placeholder) |char| {
                if (ph_col < max_size.width - 1) {
                    surface.writeCell(ph_col, content_start_row + 4, .{
                        .char = .{ .grapheme = &[_]u8{char}, .width = 1 },
                        .style = styles.styles.muted,
                    });
                    ph_col += 1;
                }
            }
        }

        // Draw help bar at bottom
        if (max_size.height > 2) {
            const help_row = max_size.height - 1;
            const help_text = "q: Quit | 1-7: Switch tabs | j/k: Navigate | Enter: Select | Esc: Back";

            var help_col: u16 = 1;
            for (help_text) |char| {
                if (help_col < max_size.width - 1) {
                    surface.writeCell(help_col, help_row, .{
                        .char = .{ .grapheme = &[_]u8{char}, .width = 1 },
                        .style = styles.styles.muted,
                    });
                    help_col += 1;
                }
            }
        }

        return surface;
    }
};
