const std = @import("std");
const vaxis = @import("vaxis");
const vxfw = vaxis.vxfw;

const styles = @import("../styles.zig");
const types = @import("../types.zig");
const core = @import("../core/mod.zig");

/// State Inspector view for querying blockchain state
pub const InspectorView = struct {
    allocator: std.mem.Allocator,
    blockchain: ?*core.Blockchain = null,
    address_buffer: [64]u8 = [_]u8{0} ** 64,
    address_len: usize = 0,
    cursor_pos: usize = 0,
    result: ?types.AccountState = null,
    error_message: ?[]const u8 = null,
    is_loading: bool = false,
    storage_scroll: usize = 0,

    pub fn init(allocator: std.mem.Allocator) InspectorView {
        return .{
            .allocator = allocator,
        };
    }

    pub fn deinit(self: *InspectorView) void {
        _ = self;
        // No dynamic memory to free
    }

    pub fn widget(self: *InspectorView) vxfw.Widget {
        return .{
            .userdata = self,
            .eventHandler = typeErasedEventHandler,
            .drawFn = typeErasedDrawFn,
        };
    }

    fn typeErasedEventHandler(ptr: *anyopaque, ctx: *vxfw.EventContext, event: vxfw.Event) anyerror!void {
        const self: *InspectorView = @ptrCast(@alignCast(ptr));
        return self.handleEvent(ctx, event);
    }

    fn handleEvent(self: *InspectorView, ctx: *vxfw.EventContext, event: vxfw.Event) !void {
        switch (event) {
            .key_press => |key| {
                // Execute query with Enter
                if (key.matches(vaxis.Key.enter, .{})) {
                    if (self.address_len > 0) {
                        self.is_loading = true;
                        self.error_message = null;
                        self.queryAddress();
                        self.is_loading = false;
                    }
                    ctx.consumeAndRedraw();
                    return;
                }

                // Clear with Escape
                if (key.matches(vaxis.Key.escape, .{})) {
                    self.address_len = 0;
                    self.cursor_pos = 0;
                    self.result = null;
                    self.error_message = null;
                    ctx.consumeAndRedraw();
                    return;
                }

                // Backspace
                if (key.matches(vaxis.Key.backspace, .{})) {
                    if (self.cursor_pos > 0 and self.address_len > 0) {
                        // Shift characters left
                        var i = self.cursor_pos - 1;
                        while (i < self.address_len - 1) : (i += 1) {
                            self.address_buffer[i] = self.address_buffer[i + 1];
                        }
                        self.address_len -= 1;
                        self.cursor_pos -= 1;
                    }
                    ctx.consumeAndRedraw();
                    return;
                }

                // Delete
                if (key.matches(vaxis.Key.delete, .{})) {
                    if (self.cursor_pos < self.address_len) {
                        // Shift characters left
                        var i = self.cursor_pos;
                        while (i < self.address_len - 1) : (i += 1) {
                            self.address_buffer[i] = self.address_buffer[i + 1];
                        }
                        self.address_len -= 1;
                    }
                    ctx.consumeAndRedraw();
                    return;
                }

                // Cursor movement
                if (key.matches(vaxis.Key.left, .{})) {
                    if (self.cursor_pos > 0) {
                        self.cursor_pos -= 1;
                    }
                    ctx.consumeAndRedraw();
                    return;
                }
                if (key.matches(vaxis.Key.right, .{})) {
                    if (self.cursor_pos < self.address_len) {
                        self.cursor_pos += 1;
                    }
                    ctx.consumeAndRedraw();
                    return;
                }
                if (key.matches(vaxis.Key.home, .{})) {
                    self.cursor_pos = 0;
                    ctx.consumeAndRedraw();
                    return;
                }
                if (key.matches(vaxis.Key.end, .{})) {
                    self.cursor_pos = self.address_len;
                    ctx.consumeAndRedraw();
                    return;
                }

                // Scroll storage with j/k when result is shown
                if (self.result != null) {
                    if (key.matches('j', .{})) {
                        self.storage_scroll += 1;
                        ctx.consumeAndRedraw();
                        return;
                    }
                    if (key.matches('k', .{})) {
                        if (self.storage_scroll > 0) {
                            self.storage_scroll -= 1;
                        }
                        ctx.consumeAndRedraw();
                        return;
                    }
                }

                // Copy address with 'c'
                if (key.matches('c', .{})) {
                    if (self.result) |result| {
                        try ctx.copyToClipboard(result.address);
                    }
                    ctx.consumeAndRedraw();
                    return;
                }

                // Character input
                const cp = key.codepoint;
                if (cp >= 32 and cp < 127 and self.address_len < 63) {
                    // Shift characters right
                    var i = self.address_len;
                    while (i > self.cursor_pos) : (i -= 1) {
                        self.address_buffer[i] = self.address_buffer[i - 1];
                    }
                    self.address_buffer[self.cursor_pos] = @intCast(cp);
                    self.address_len += 1;
                    self.cursor_pos += 1;
                    ctx.consumeAndRedraw();
                    return;
                }
            },
            else => {},
        }
    }

    /// Query blockchain for account state at the entered address
    fn queryAddress(self: *InspectorView) void {
        const blockchain = self.blockchain orelse {
            self.error_message = "No blockchain connection";
            return;
        };

        // Get address string from buffer
        const address_str = self.address_buffer[0..self.address_len];

        // Search for matching account
        for (blockchain.getAccounts()) |account| {
            // Check if addresses match (simple string comparison)
            if (std.mem.eql(u8, account.address, address_str) or
                (address_str.len >= 2 and std.ascii.eqlIgnoreCase(account.address[2..], address_str[2..])))
            {
                // Found matching account - populate result
                self.result = types.AccountState{
                    .address = account.address,
                    .balance = account.balance,
                    .nonce = account.nonce,
                    .code = account.code,
                    .code_size = @intCast(account.code.len),
                    .storage_slots = std.StringHashMap([]const u8).init(self.allocator),
                    .is_contract = account.code.len > 0,
                };
                self.error_message = null;
                return;
            }
        }

        // No matching account found
        self.error_message = "Account not found";
        self.result = null;
    }

    fn typeErasedDrawFn(ptr: *anyopaque, ctx: vxfw.DrawContext) std.mem.Allocator.Error!vxfw.Surface {
        const self: *InspectorView = @ptrCast(@alignCast(ptr));
        return self.draw(ctx);
    }

    fn draw(self: *InspectorView, ctx: vxfw.DrawContext) !vxfw.Surface {
        const max_size = ctx.max.size();
        var surface = try vxfw.Surface.init(ctx.arena, self.widget(), max_size);

        var row: u16 = 0;

        // Header
        try writeString(&surface, ctx, 2, row, "State Inspector", styles.styles.title);
        row += 1;
        try writeString(&surface, ctx, 2, row, "Query Blockchain State", styles.styles.muted);
        row += 2;

        // Input field
        try writeString(&surface, ctx, 2, row, "Address:", styles.styles.muted);
        row += 1;

        // Draw input box
        try writeString(&surface, ctx, 2, row, "[", styles.styles.muted);

        // Input text
        if (self.address_len > 0) {
            var c: u16 = 3;
            for (self.address_buffer[0..self.address_len]) |char| {
                if (c >= max_size.width - 3) break;
                surface.writeCell(c, row, .{
                    .char = .{ .grapheme = &[_]u8{char}, .width = 1 },
                    .style = styles.styles.value,
                });
                c += 1;
            }
        } else {
            try writeString(&surface, ctx, 3, row, "0x...", styles.styles.muted);
        }

        // Cursor
        const cursor_col = 3 + @as(u16, @intCast(self.cursor_pos));
        if (cursor_col < max_size.width - 1) {
            surface.writeCell(cursor_col, row, .{
                .char = .{ .grapheme = "_", .width = 1 },
                .style = styles.styles.title,
            });
        }

        try writeString(&surface, ctx, @min(max_size.width - 1, 3 + @as(u16, @intCast(@max(self.address_len, 5))) + 1), row, "]", styles.styles.muted);
        row += 2;

        // Loading indicator
        if (self.is_loading) {
            try writeString(&surface, ctx, 2, row, "Loading...", styles.styles.muted);
            row += 2;
        }

        // Error message
        if (self.error_message) |err| {
            try writeString(&surface, ctx, 2, row, "Error: ", styles.styles.err);
            try writeString(&surface, ctx, 9, row, err, styles.styles.err);
            row += 2;
        }

        // Result
        if (self.result) |result| {
            try writeString(&surface, ctx, 2, row, "ACCOUNT STATE", styles.styles.title);
            row += 1;
            try drawLine(&surface, row, max_size.width, styles.styles.muted);
            row += 1;

            // Address
            try writeString(&surface, ctx, 2, row, "Address:", styles.styles.muted);
            row += 1;
            try writeString(&surface, ctx, 4, row, result.address, styles.styles.value);
            row += 2;

            // Type
            const type_str = if (result.is_contract) "Contract" else "EOA";
            try writeString(&surface, ctx, 2, row, "Type: ", styles.styles.muted);
            try writeString(&surface, ctx, 8, row, type_str, styles.styles.normal);
            row += 1;

            // Balance
            const balance_str = try std.fmt.allocPrint(ctx.arena, "Balance: {d} wei", .{@as(u64, @truncate(result.balance))});
            try writeString(&surface, ctx, 2, row, balance_str, styles.styles.normal);
            row += 1;

            // Nonce
            const nonce_str = try std.fmt.allocPrint(ctx.arena, "Nonce: {d}", .{result.nonce});
            try writeString(&surface, ctx, 2, row, nonce_str, styles.styles.normal);
            row += 2;

            // Code (if contract)
            if (result.is_contract) {
                const code_str = try std.fmt.allocPrint(ctx.arena, "Code Size: {d} bytes", .{result.code_size});
                try writeString(&surface, ctx, 2, row, code_str, styles.styles.normal);
                row += 2;

                // Storage slots
                try writeString(&surface, ctx, 2, row, "STORAGE", styles.styles.title);
                row += 1;
                try drawLine(&surface, row, max_size.width, styles.styles.muted);
                row += 1;

                var slot_iter = result.storage_slots.iterator();
                var slot_count: usize = 0;
                while (slot_iter.next()) |entry| {
                    if (slot_count < self.storage_scroll) {
                        slot_count += 1;
                        continue;
                    }
                    if (row >= max_size.height - 2) break;

                    try writeString(&surface, ctx, 2, row, entry.key_ptr.*, styles.styles.muted);
                    try writeString(&surface, ctx, 2 + @as(u16, @intCast(@min(entry.key_ptr.len, 40))), row, " = ", styles.styles.muted);
                    try writeString(&surface, ctx, 5 + @as(u16, @intCast(@min(entry.key_ptr.len, 40))), row, entry.value_ptr.*, styles.styles.value);
                    row += 1;
                    slot_count += 1;
                }

                if (slot_count == 0) {
                    try writeString(&surface, ctx, 2, row, "No storage slots", styles.styles.muted);
                }
            }
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
