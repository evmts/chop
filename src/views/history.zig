const std = @import("std");
const vaxis = @import("vaxis");
const vxfw = vaxis.vxfw;

const styles = @import("../styles.zig");
const types = @import("../types.zig");
const core = @import("../core/mod.zig");

/// Call history view showing EVM execution history
pub const HistoryView = struct {
    allocator: std.mem.Allocator,
    blockchain: ?*core.Blockchain = null,
    entries: []const types.CallHistoryEntry,
    selected_index: usize = 0,
    scroll_offset: usize = 0,
    show_detail: bool = false,
    selected_entry: ?types.CallHistoryEntry = null,
    log_selected_index: usize = 0,
    show_log_detail: bool = false,

    // Call parameter editing state
    show_params: bool = false,
    param_cursor: usize = 0,
    editing_param: bool = false,
    call_params: types.CallParams = .{},
    validation_error: ?[]const u8 = null,

    // Text input buffers for editing (fixed size for simplicity)
    edit_buffer: [256]u8 = [_]u8{0} ** 256,
    edit_buffer_len: usize = 0,
    edit_cursor: usize = 0,

    pub fn init(allocator: std.mem.Allocator) HistoryView {
        return .{
            .allocator = allocator,
            .entries = &.{},
        };
    }

    pub fn widget(self: *HistoryView) vxfw.Widget {
        return .{
            .userdata = self,
            .eventHandler = typeErasedEventHandler,
            .drawFn = typeErasedDrawFn,
        };
    }

    fn typeErasedEventHandler(ptr: *anyopaque, ctx: *vxfw.EventContext, event: vxfw.Event) anyerror!void {
        const self: *HistoryView = @ptrCast(@alignCast(ptr));
        return self.handleEvent(ctx, event);
    }

    fn handleEvent(self: *HistoryView, ctx: *vxfw.EventContext, event: vxfw.Event) !void {
        switch (event) {
            .key_press => |key| {
                if (self.show_log_detail) {
                    // Log detail
                    if (key.matches(vaxis.Key.escape, .{})) {
                        self.show_log_detail = false;
                        ctx.consumeAndRedraw();
                        return;
                    }
                } else if (self.editing_param) {
                    // Parameter editing mode - handle text input
                    if (key.matches(vaxis.Key.escape, .{})) {
                        // Cancel editing without saving
                        self.editing_param = false;
                        ctx.consumeAndRedraw();
                        return;
                    }
                    if (key.matches(vaxis.Key.enter, .{})) {
                        // Confirm edit - save buffer to call_params
                        self.applyEditBuffer();
                        self.editing_param = false;
                        ctx.consumeAndRedraw();
                        return;
                    }
                    // Handle backspace
                    if (key.matches(vaxis.Key.backspace, .{})) {
                        if (self.edit_cursor > 0 and self.edit_buffer_len > 0) {
                            // Shift characters left
                            var i = self.edit_cursor - 1;
                            while (i < self.edit_buffer_len - 1) : (i += 1) {
                                self.edit_buffer[i] = self.edit_buffer[i + 1];
                            }
                            self.edit_buffer_len -= 1;
                            self.edit_cursor -= 1;
                        }
                        ctx.consumeAndRedraw();
                        return;
                    }
                    // Handle delete
                    if (key.matches(vaxis.Key.delete, .{})) {
                        if (self.edit_cursor < self.edit_buffer_len) {
                            var i = self.edit_cursor;
                            while (i < self.edit_buffer_len - 1) : (i += 1) {
                                self.edit_buffer[i] = self.edit_buffer[i + 1];
                            }
                            self.edit_buffer_len -= 1;
                        }
                        ctx.consumeAndRedraw();
                        return;
                    }
                    // Cursor movement
                    if (key.matches(vaxis.Key.left, .{})) {
                        if (self.edit_cursor > 0) {
                            self.edit_cursor -= 1;
                        }
                        ctx.consumeAndRedraw();
                        return;
                    }
                    if (key.matches(vaxis.Key.right, .{})) {
                        if (self.edit_cursor < self.edit_buffer_len) {
                            self.edit_cursor += 1;
                        }
                        ctx.consumeAndRedraw();
                        return;
                    }
                    if (key.matches(vaxis.Key.home, .{})) {
                        self.edit_cursor = 0;
                        ctx.consumeAndRedraw();
                        return;
                    }
                    if (key.matches(vaxis.Key.end, .{})) {
                        self.edit_cursor = self.edit_buffer_len;
                        ctx.consumeAndRedraw();
                        return;
                    }
                    // Character input - check for printable ASCII
                    const cp = key.codepoint;
                    if (cp >= 32 and cp < 127 and self.edit_buffer_len < self.edit_buffer.len - 1) {
                        // Shift characters right to make room
                        var i = self.edit_buffer_len;
                        while (i > self.edit_cursor) : (i -= 1) {
                            self.edit_buffer[i] = self.edit_buffer[i - 1];
                        }
                        self.edit_buffer[self.edit_cursor] = @intCast(cp);
                        self.edit_buffer_len += 1;
                        self.edit_cursor += 1;
                        ctx.consumeAndRedraw();
                        return;
                    }
                } else if (self.show_params) {
                    // Parameter list
                    if (key.matches(vaxis.Key.escape, .{})) {
                        self.show_params = false;
                        ctx.consumeAndRedraw();
                        return;
                    }
                    if (key.matches('j', .{}) or key.matches(vaxis.Key.down, .{})) {
                        if (self.param_cursor < 6) { // 7 parameters
                            self.param_cursor += 1;
                        }
                        ctx.consumeAndRedraw();
                        return;
                    }
                    if (key.matches('k', .{}) or key.matches(vaxis.Key.up, .{})) {
                        if (self.param_cursor > 0) {
                            self.param_cursor -= 1;
                        }
                        ctx.consumeAndRedraw();
                        return;
                    }
                    if (key.matches(vaxis.Key.enter, .{})) {
                        // Enter edit mode - copy current value to edit buffer
                        self.editing_param = true;
                        const current_value = self.getCurrentParamValue();
                        const copy_len = @min(current_value.len, self.edit_buffer.len - 1);
                        @memcpy(self.edit_buffer[0..copy_len], current_value[0..copy_len]);
                        self.edit_buffer_len = copy_len;
                        self.edit_cursor = copy_len;
                        ctx.consumeAndRedraw();
                        return;
                    }
                    // Execute with 'e'
                    if (key.matches('e', .{})) {
                        self.executeCall();
                        ctx.consumeAndRedraw();
                        return;
                    }
                    // Reset parameter with 'r'
                    if (key.matches('r', .{})) {
                        self.resetCurrentParam();
                        ctx.consumeAndRedraw();
                        return;
                    }
                    // Reset all with 'R'
                    if (key.matches('R', .{})) {
                        self.call_params = .{};
                        ctx.consumeAndRedraw();
                        return;
                    }
                } else if (self.show_detail) {
                    // Detail view
                    if (key.matches(vaxis.Key.escape, .{})) {
                        self.show_detail = false;
                        self.selected_entry = null;
                        self.log_selected_index = 0;
                        ctx.consumeAndRedraw();
                        return;
                    }
                    // Navigate logs
                    if (key.matches('j', .{}) or key.matches(vaxis.Key.down, .{})) {
                        if (self.selected_entry) |entry| {
                            if (entry.result) |result| {
                                if (result.logs.len > 0 and self.log_selected_index < result.logs.len - 1) {
                                    self.log_selected_index += 1;
                                }
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
                    // View log detail
                    if (key.matches(vaxis.Key.enter, .{})) {
                        if (self.selected_entry) |entry| {
                            if (entry.result) |result| {
                                if (result.logs.len > 0) {
                                    self.show_log_detail = true;
                                }
                            }
                        }
                        ctx.consumeAndRedraw();
                        return;
                    }
                    // Replay call with 'e'
                    if (key.matches('e', .{})) {
                        if (self.selected_entry) |entry| {
                            self.call_params = entry.params;
                            self.show_params = true;
                        }
                        ctx.consumeAndRedraw();
                        return;
                    }
                    // Save as fixture with 'f'
                    if (key.matches('f', .{})) {
                        if (self.selected_entry) |entry| {
                            _ = self.saveFixture(entry);
                        }
                        ctx.consumeAndRedraw();
                        return;
                    }
                } else {
                    // List view
                    if (key.matches('j', .{}) or key.matches(vaxis.Key.down, .{})) {
                        if (self.entries.len > 0 and self.selected_index < self.entries.len - 1) {
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
                        if (self.entries.len > 0 and self.selected_index < self.entries.len) {
                            self.selected_entry = self.entries[self.selected_index];
                            self.show_detail = true;
                            self.log_selected_index = 0;
                        }
                        ctx.consumeAndRedraw();
                        return;
                    }
                    // New call with 'n'
                    if (key.matches('n', .{})) {
                        self.call_params = .{};
                        self.show_params = true;
                        self.param_cursor = 0;
                        ctx.consumeAndRedraw();
                        return;
                    }
                }
            },
            else => {},
        }
    }

    fn typeErasedDrawFn(ptr: *anyopaque, ctx: vxfw.DrawContext) std.mem.Allocator.Error!vxfw.Surface {
        const self: *HistoryView = @ptrCast(@alignCast(ptr));
        return self.draw(ctx);
    }

    fn draw(self: *HistoryView, ctx: vxfw.DrawContext) !vxfw.Surface {
        const max_size = ctx.max.size();
        var surface = try vxfw.Surface.init(ctx.arena, self.widget(), max_size);

        if (self.show_log_detail) {
            return self.drawLogDetail(ctx, &surface, max_size);
        }
        if (self.editing_param) {
            return self.drawParamEdit(ctx, &surface, max_size);
        }
        if (self.show_params) {
            return self.drawParams(ctx, &surface, max_size);
        }
        if (self.show_detail) {
            return self.drawDetail(ctx, &surface, max_size);
        }
        return self.drawList(ctx, &surface, max_size);
    }

    fn drawList(self: *HistoryView, ctx: vxfw.DrawContext, surface: *vxfw.Surface, max_size: vxfw.Size) !vxfw.Surface {
        var row: u16 = 0;

        // Header
        try writeString(surface, 2, row, "Call History", styles.styles.title);
        row += 1;
        try writeString(surface, 2, row, "EVM Execution History", styles.styles.muted);
        row += 2;

        // Column headers
        try writeString(surface, 2, row, "Status", styles.styles.muted);
        try writeString(surface, 10, row, "Type", styles.styles.muted);
        try writeString(surface, 24, row, "Target", styles.styles.muted);
        try writeString(surface, 50, row, "Gas", styles.styles.muted);
        try writeString(surface, 64, row, "Time", styles.styles.muted);
        row += 1;
        try drawLine(surface, row, max_size.width, styles.styles.muted);
        row += 1;

        // Entry list
        if (self.entries.len == 0) {
            try writeString(surface, 2, row, "No calls yet. Press 'n' to create a new call.", styles.styles.muted);
        } else {
            for (self.entries, 0..) |entry, i| {
                if (row >= max_size.height - 3) break;

                const is_selected = i == self.selected_index;
                const row_style = if (is_selected) styles.styles.selected else styles.styles.normal;

                if (is_selected) {
                    try writeString(surface, 0, row, ">", styles.styles.value);
                }

                // Status
                const has_result = entry.result != null;
                const success = if (entry.result) |r| r.success else false;
                const status = if (!has_result) "[---]" else if (success) "[OK]" else "[FAIL]";
                const status_style = if (!has_result) styles.styles.muted else if (success) styles.styles.success else styles.styles.err;
                try writeString(surface, 2, row, status, status_style);

                // Call type
                try writeString(surface, 10, row, entry.params.call_type.toString(), row_style);

                // Target
                const target = if (entry.params.target.len > 20) entry.params.target[0..20] else entry.params.target;
                try writeString(surface, 24, row, target, row_style);

                // Gas
                if (entry.result) |result| {
                    const gas_str = try std.fmt.allocPrint(ctx.arena, "{d}", .{result.gas_left});
                    try writeString(surface, 50, row, gas_str, styles.styles.muted);
                }

                // Timestamp
                const ts_str = try std.fmt.allocPrint(ctx.arena, "{d}", .{entry.timestamp});
                try writeString(surface, 64, row, ts_str, styles.styles.muted);

                row += 1;
            }
        }

        return surface.*;
    }

    fn drawDetail(self: *HistoryView, ctx: vxfw.DrawContext, surface: *vxfw.Surface, max_size: vxfw.Size) !vxfw.Surface {
        const entry = self.selected_entry orelse {
            try writeString(surface, 2, 0, "Entry not found", styles.styles.err);
            return surface.*;
        };

        var row: u16 = 0;

        // Header
        try writeString(surface, 2, row, "Call Detail", styles.styles.title);
        row += 2;

        // Status
        if (entry.result) |result| {
            const status_str = if (result.success) "SUCCESS" else "FAILED";
            const status_style = if (result.success) styles.styles.success else styles.styles.err;
            try writeString(surface, 2, row, "Status: ", styles.styles.muted);
            try writeString(surface, 10, row, status_str, status_style);
            row += 2;
        }

        // Parameters
        try writeString(surface, 2, row, "PARAMETERS", styles.styles.title);
        row += 1;
        try drawLine(surface, row, max_size.width, styles.styles.muted);
        row += 1;

        try writeString(surface, 2, row, "Type: ", styles.styles.muted);
        try writeString(surface, 10, row, entry.params.call_type.toString(), styles.styles.normal);
        row += 1;

        try writeString(surface, 2, row, "Caller: ", styles.styles.muted);
        try writeString(surface, 10, row, entry.params.caller, styles.styles.normal);
        row += 1;

        try writeString(surface, 2, row, "Target: ", styles.styles.muted);
        try writeString(surface, 10, row, entry.params.target, styles.styles.value);
        row += 1;

        try writeString(surface, 2, row, "Value: ", styles.styles.muted);
        try writeString(surface, 10, row, entry.params.value, styles.styles.normal);
        row += 1;

        try writeString(surface, 2, row, "Gas: ", styles.styles.muted);
        try writeString(surface, 10, row, entry.params.gas_limit, styles.styles.normal);
        row += 2;

        // Result
        if (entry.result) |result| {
            try writeString(surface, 2, row, "RESULT", styles.styles.title);
            row += 1;
            try drawLine(surface, row, max_size.width, styles.styles.muted);
            row += 1;

            const gas_left_str = try std.fmt.allocPrint(ctx.arena, "Gas Left: {d}", .{result.gas_left});
            try writeString(surface, 2, row, gas_left_str, styles.styles.normal);
            row += 1;

            if (result.return_data.len > 0) {
                try writeString(surface, 2, row, "Return Data:", styles.styles.muted);
                row += 1;
                const preview = if (result.return_data.len > 64) result.return_data[0..64] else result.return_data;
                try writeString(surface, 4, row, preview, styles.styles.normal);
                row += 2;
            }

            if (!result.success) {
                if (result.error_info) |err| {
                    try writeString(surface, 2, row, "Error:", styles.styles.err);
                    row += 1;
                    try writeString(surface, 4, row, err, styles.styles.err);
                    row += 2;
                }
            }

            if (result.deployed_addr) |addr| {
                try writeString(surface, 2, row, "Deployed:", styles.styles.muted);
                row += 1;
                try writeString(surface, 4, row, addr, styles.styles.success);
                row += 2;
            }

            // Logs
            const logs_title = try std.fmt.allocPrint(ctx.arena, "LOGS ({d})", .{result.logs.len});
            try writeString(surface, 2, row, logs_title, styles.styles.title);
            row += 1;
            try drawLine(surface, row, max_size.width, styles.styles.muted);
            row += 1;

            if (result.logs.len == 0) {
                try writeString(surface, 2, row, "No logs emitted", styles.styles.muted);
            } else {
                for (result.logs, 0..) |log, i| {
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
        }

        return surface.*;
    }

    fn drawParams(self: *HistoryView, ctx: vxfw.DrawContext, surface: *vxfw.Surface, max_size: vxfw.Size) !vxfw.Surface {
        _ = ctx;
        _ = max_size;

        var row: u16 = 0;

        // Header
        try writeString(surface, 2, row, "Call Parameters", styles.styles.title);
        row += 1;
        try writeString(surface, 2, row, "Configure EVM call", styles.styles.muted);
        row += 2;

        // Parameters list
        const params = [_]struct { name: []const u8, value: []const u8 }{
            .{ .name = "Call Type", .value = self.call_params.call_type.toString() },
            .{ .name = "Caller", .value = self.call_params.caller },
            .{ .name = "Target", .value = self.call_params.target },
            .{ .name = "Value", .value = self.call_params.value },
            .{ .name = "Input Data", .value = self.call_params.input_data },
            .{ .name = "Gas Limit", .value = self.call_params.gas_limit },
            .{ .name = "Salt", .value = self.call_params.salt },
        };

        for (params, 0..) |param, i| {
            const is_selected = i == self.param_cursor;
            const label_style = if (is_selected) styles.styles.selected else styles.styles.muted;
            const value_style = if (is_selected) styles.styles.value else styles.styles.normal;

            if (is_selected) {
                try writeString(surface, 0, row, ">", styles.styles.value);
            }

            try writeString(surface, 2, row, param.name, label_style);
            try writeString(surface, 16, row, ": ", styles.styles.muted);

            if (param.value.len > 0) {
                try writeString(surface, 18, row, param.value, value_style);
            } else {
                try writeString(surface, 18, row, "(empty)", styles.styles.muted);
            }

            row += 1;
        }

        // Validation error
        if (self.validation_error) |err| {
            row += 1;
            try writeString(surface, 2, row, "Error: ", styles.styles.err);
            try writeString(surface, 9, row, err, styles.styles.err);
        }

        return surface.*;
    }

    fn drawParamEdit(self: *HistoryView, ctx: vxfw.DrawContext, surface: *vxfw.Surface, max_size: vxfw.Size) !vxfw.Surface {
        _ = ctx;

        var row: u16 = 0;

        // Header
        try writeString(surface, 2, row, "Edit Parameter", styles.styles.title);
        row += 2;

        const param_names = [_][]const u8{
            "Call Type",
            "Caller",
            "Target",
            "Value",
            "Input Data",
            "Gas Limit",
            "Salt",
        };

        const name = if (self.param_cursor < param_names.len) param_names[self.param_cursor] else "Unknown";
        try writeString(surface, 2, row, name, styles.styles.muted);
        row += 1;

        // Draw input box
        try writeString(surface, 2, row, "[", styles.styles.muted);

        // Draw current buffer content
        const display_len = @min(self.edit_buffer_len, @as(usize, @intCast(max_size.width)) -| 6);
        if (display_len > 0) {
            var c: u16 = 3;
            for (self.edit_buffer[0..display_len]) |char| {
                surface.writeCell(c, row, .{
                    .char = .{ .grapheme = &[_]u8{char}, .width = 1 },
                    .style = styles.styles.value,
                });
                c += 1;
            }
        }

        // Draw cursor
        const cursor_col: u16 = 3 + @as(u16, @intCast(@min(self.edit_cursor, display_len)));
        if (cursor_col < max_size.width - 1) {
            surface.writeCell(cursor_col, row, .{
                .char = .{ .grapheme = "|", .width = 1 },
                .style = styles.styles.title,
            });
        }

        // Closing bracket
        const bracket_pos: u16 = 3 + @as(u16, @intCast(@max(display_len, 1))) + 1;
        if (bracket_pos < max_size.width) {
            try writeString(surface, bracket_pos, row, "]", styles.styles.muted);
        }
        row += 2;

        try writeString(surface, 2, row, "esc: cancel | enter: confirm | arrows: move cursor", styles.styles.muted);

        return surface.*;
    }

    // Helper to get current parameter value as slice
    fn getCurrentParamValue(self: *HistoryView) []const u8 {
        return switch (self.param_cursor) {
            0 => self.call_params.call_type.toString(),
            1 => self.call_params.caller,
            2 => self.call_params.target,
            3 => self.call_params.value,
            4 => self.call_params.input_data,
            5 => self.call_params.gas_limit,
            6 => self.call_params.salt,
            else => "",
        };
    }

    /// Save a call history entry as a fixture file
    fn saveFixture(self: *HistoryView, entry: types.CallHistoryEntry) bool {
        _ = self;

        // Create ~/.chop/fixtures directory
        const home = std.posix.getenv("HOME") orelse return false;

        var dir_buf: [256]u8 = undefined;
        const fixtures_dir = std.fmt.bufPrint(&dir_buf, "{s}/.chop/fixtures", .{home}) catch return false;

        // Create directories if needed
        std.fs.cwd().makePath(fixtures_dir) catch |err| {
            if (err != error.PathAlreadyExists) return false;
        };

        // Generate filename with timestamp
        const timestamp = std.time.timestamp();
        var path_buf: [300]u8 = undefined;
        const file_path = std.fmt.bufPrint(&path_buf, "{s}/fixture_{d}.json", .{ fixtures_dir, timestamp }) catch return false;

        // Create file
        const file = std.fs.cwd().createFile(file_path, .{}) catch return false;
        defer file.close();

        // Write JSON
        file.writeAll("{\n") catch return false;

        // Write params
        file.writeAll("  \"params\": {\n") catch return false;

        var type_buf: [64]u8 = undefined;
        const type_json = std.fmt.bufPrint(&type_buf, "    \"call_type\": \"{s}\",\n", .{entry.params.call_type.toString()}) catch return false;
        file.writeAll(type_json) catch return false;

        var caller_buf: [128]u8 = undefined;
        const caller_json = std.fmt.bufPrint(&caller_buf, "    \"caller\": \"{s}\",\n", .{entry.params.caller}) catch return false;
        file.writeAll(caller_json) catch return false;

        var target_buf: [128]u8 = undefined;
        const target_json = std.fmt.bufPrint(&target_buf, "    \"target\": \"{s}\",\n", .{entry.params.target}) catch return false;
        file.writeAll(target_json) catch return false;

        var value_buf: [64]u8 = undefined;
        const value_json = std.fmt.bufPrint(&value_buf, "    \"value\": \"{s}\",\n", .{entry.params.value}) catch return false;
        file.writeAll(value_json) catch return false;

        var gas_buf: [64]u8 = undefined;
        const gas_json = std.fmt.bufPrint(&gas_buf, "    \"gas_limit\": \"{s}\"\n", .{entry.params.gas_limit}) catch return false;
        file.writeAll(gas_json) catch return false;

        file.writeAll("  },\n") catch return false;

        // Write result if present
        if (entry.result) |result| {
            file.writeAll("  \"expected_result\": {\n") catch return false;

            var success_buf: [32]u8 = undefined;
            const success_json = std.fmt.bufPrint(&success_buf, "    \"success\": {s},\n", .{if (result.success) "true" else "false"}) catch return false;
            file.writeAll(success_json) catch return false;

            var gas_left_buf: [64]u8 = undefined;
            const gas_left_json = std.fmt.bufPrint(&gas_left_buf, "    \"gas_left\": {d}\n", .{result.gas_left}) catch return false;
            file.writeAll(gas_left_json) catch return false;

            file.writeAll("  },\n") catch return false;
        }

        var ts_buf: [64]u8 = undefined;
        const ts_json = std.fmt.bufPrint(&ts_buf, "  \"timestamp\": {d}\n", .{entry.timestamp}) catch return false;
        file.writeAll(ts_json) catch return false;

        file.writeAll("}\n") catch return false;

        return true;
    }

    // Execute the current call parameters via the blockchain
    fn executeCall(self: *HistoryView) void {
        // Validate we have a blockchain connection
        const blockchain = self.blockchain orelse {
            self.validation_error = "No blockchain connection";
            return;
        };

        // Validate required parameters
        if (self.call_params.caller.len == 0) {
            self.validation_error = "Caller address required";
            return;
        }

        // For non-CREATE calls, target is required
        if (self.call_params.call_type != .create and self.call_params.call_type != .create2) {
            if (self.call_params.target.len == 0) {
                self.validation_error = "Target address required";
                return;
            }
        }

        // Execute the call
        const result = blockchain.executeCall(self.call_params) catch |err| {
            self.validation_error = switch (err) {
                error.InvalidAddressLength => "Invalid address length",
                error.InvalidHex => "Invalid hex format",
                error.InvalidValue => "Invalid value format",
                error.InvalidGas => "Invalid gas format",
                else => "Execution failed",
            };
            return;
        };

        // Create call history entry
        const entry = types.CallHistoryEntry{
            .id = "call", // Simple ID for now
            .params = self.call_params,
            .result = result,
            .timestamp = std.time.timestamp(),
        };

        // Store in blockchain call history (would need mutable access)
        // For now, just store locally and show result
        self.selected_entry = entry;
        self.show_detail = true;
        self.show_params = false;
        self.validation_error = null;

        // Refresh entries from blockchain
        self.entries = blockchain.getCallHistory();
    }

    // Reset current parameter to default value
    fn resetCurrentParam(self: *HistoryView) void {
        switch (self.param_cursor) {
            0 => self.call_params.call_type = .call,
            1 => self.call_params.caller = "",
            2 => self.call_params.target = "",
            3 => self.call_params.value = "0",
            4 => self.call_params.input_data = "",
            5 => self.call_params.gas_limit = "1000000",
            6 => self.call_params.salt = "",
            else => {},
        }
    }

    // Apply edit buffer to the appropriate call_params field
    fn applyEditBuffer(self: *HistoryView) void {
        // For call_type (index 0), cycle through types instead of text edit
        if (self.param_cursor == 0) {
            // Cycle through call types
            self.call_params.call_type = switch (self.call_params.call_type) {
                .call => .static_call,
                .static_call => .delegate_call,
                .delegate_call => .create,
                .create => .create2,
                .create2 => .call,
            };
            return;
        }

        // For other fields, we need to allocate a copy since slices are immutable
        // Using arena-style allocation with allocator
        const new_value = self.allocator.dupe(u8, self.edit_buffer[0..self.edit_buffer_len]) catch return;

        switch (self.param_cursor) {
            1 => self.call_params.caller = new_value,
            2 => self.call_params.target = new_value,
            3 => self.call_params.value = new_value,
            4 => self.call_params.input_data = new_value,
            5 => self.call_params.gas_limit = new_value,
            6 => self.call_params.salt = new_value,
            else => {},
        }
    }

    fn drawLogDetail(self: *HistoryView, ctx: vxfw.DrawContext, surface: *vxfw.Surface, max_size: vxfw.Size) !vxfw.Surface {
        _ = max_size;

        const entry = self.selected_entry orelse {
            try writeString(surface, 2, 0, "Entry not found", styles.styles.err);
            return surface.*;
        };

        const result = entry.result orelse {
            try writeString(surface, 2, 0, "No result", styles.styles.err);
            return surface.*;
        };

        if (self.log_selected_index >= result.logs.len) {
            try writeString(surface, 2, 0, "Log not found", styles.styles.err);
            return surface.*;
        }

        const log = result.logs[self.log_selected_index];
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
