const std = @import("std");
const vaxis = @import("vaxis");
const vxfw = vaxis.vxfw;

const styles = @import("../styles.zig");
const types = @import("../types.zig");
const core = @import("../core/mod.zig");

/// Contracts list and bytecode disassembly view
pub const ContractsView = struct {
    allocator: std.mem.Allocator,
    contracts: []const types.Contract,
    selected_index: usize = 0,
    scroll_offset: usize = 0,
    show_detail: bool = false,
    selected_contract: ?types.Contract = null,

    // Disassembly state
    disassembly: ?types.DisassemblyResult = null,
    disassembly_error: ?[]const u8 = null,
    current_block_index: usize = 0,
    instruction_index: usize = 0,

    // Goto PC modal
    show_goto_pc: bool = false,
    goto_pc_buffer: [16]u8 = [_]u8{0} ** 16,
    goto_pc_len: usize = 0,

    pub fn init(allocator: std.mem.Allocator) ContractsView {
        return .{
            .allocator = allocator,
            .contracts = &.{},
        };
    }

    pub fn widget(self: *ContractsView) vxfw.Widget {
        return .{
            .userdata = self,
            .eventHandler = typeErasedEventHandler,
            .drawFn = typeErasedDrawFn,
        };
    }

    fn typeErasedEventHandler(ptr: *anyopaque, ctx: *vxfw.EventContext, event: vxfw.Event) anyerror!void {
        const self: *ContractsView = @ptrCast(@alignCast(ptr));
        return self.handleEvent(ctx, event);
    }

    fn handleEvent(self: *ContractsView, ctx: *vxfw.EventContext, event: vxfw.Event) !void {
        switch (event) {
            .key_press => |key| {
                if (self.show_goto_pc) {
                    // Goto PC modal - handle text input
                    if (key.matches(vaxis.Key.escape, .{})) {
                        self.show_goto_pc = false;
                        self.goto_pc_len = 0;
                        ctx.consumeAndRedraw();
                        return;
                    }
                    if (key.matches(vaxis.Key.enter, .{})) {
                        // Parse hex input and jump to PC
                        if (self.goto_pc_len > 0) {
                            self.jumpToPC();
                        }
                        self.show_goto_pc = false;
                        self.goto_pc_len = 0;
                        ctx.consumeAndRedraw();
                        return;
                    }
                    if (key.matches(vaxis.Key.backspace, .{})) {
                        if (self.goto_pc_len > 0) {
                            self.goto_pc_len -= 1;
                        }
                        ctx.consumeAndRedraw();
                        return;
                    }
                    // Handle hex character input
                    const cp = key.codepoint;
                    if ((cp >= '0' and cp <= '9') or
                        (cp >= 'a' and cp <= 'f') or
                        (cp >= 'A' and cp <= 'F') or
                        cp == 'x' or cp == 'X')
                    {
                        if (self.goto_pc_len < self.goto_pc_buffer.len - 1) {
                            self.goto_pc_buffer[self.goto_pc_len] = @intCast(cp);
                            self.goto_pc_len += 1;
                        }
                    }
                    ctx.consumeAndRedraw();
                    return;
                }

                if (self.show_detail) {
                    // Detail view with disassembly
                    if (key.matches(vaxis.Key.escape, .{})) {
                        self.show_detail = false;
                        self.selected_contract = null;
                        self.disassembly = null;
                        self.disassembly_error = null;
                        self.current_block_index = 0;
                        self.instruction_index = 0;
                        ctx.consumeAndRedraw();
                        return;
                    }

                    // Navigate instructions with j/k
                    if (key.matches('j', .{}) or key.matches(vaxis.Key.down, .{})) {
                        if (self.disassembly) |dis| {
                            if (self.current_block_index < dis.blocks.len) {
                                const block = dis.blocks[self.current_block_index];
                                if (self.instruction_index < block.instructions.len - 1) {
                                    self.instruction_index += 1;
                                }
                            }
                        }
                        ctx.consumeAndRedraw();
                        return;
                    }
                    if (key.matches('k', .{}) or key.matches(vaxis.Key.up, .{})) {
                        if (self.instruction_index > 0) {
                            self.instruction_index -= 1;
                        }
                        ctx.consumeAndRedraw();
                        return;
                    }

                    // Navigate blocks with h/l
                    if (key.matches('l', .{}) or key.matches(vaxis.Key.right, .{})) {
                        if (self.disassembly) |dis| {
                            if (self.current_block_index < dis.blocks.len - 1) {
                                self.current_block_index += 1;
                                self.instruction_index = 0;
                            }
                        }
                        ctx.consumeAndRedraw();
                        return;
                    }
                    if (key.matches('h', .{}) or key.matches(vaxis.Key.left, .{})) {
                        if (self.current_block_index > 0) {
                            self.current_block_index -= 1;
                            self.instruction_index = 0;
                        }
                        ctx.consumeAndRedraw();
                        return;
                    }

                    // Jump to destination with 'g'
                    if (key.matches('g', .{})) {
                        self.jumpToJumpTarget();
                        ctx.consumeAndRedraw();
                        return;
                    }

                    // Open goto PC modal with 'G'
                    if (key.matches('G', .{})) {
                        self.show_goto_pc = true;
                        ctx.consumeAndRedraw();
                        return;
                    }

                    // Copy address
                    if (key.matches('c', .{})) {
                        if (self.selected_contract) |contract| {
                            try ctx.copyToClipboard(contract.address);
                        }
                        ctx.consumeAndRedraw();
                        return;
                    }
                } else {
                    // List view navigation
                    if (key.matches('j', .{}) or key.matches(vaxis.Key.down, .{})) {
                        if (self.contracts.len > 0 and self.selected_index < self.contracts.len - 1) {
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
                        if (self.contracts.len > 0 and self.selected_index < self.contracts.len) {
                            self.selected_contract = self.contracts[self.selected_index];
                            self.show_detail = true;
                            self.triggerDisassembly();
                        }
                        ctx.consumeAndRedraw();
                        return;
                    }
                }
            },
            else => {},
        }
    }

    /// Jump to a specific program counter in the disassembly
    fn jumpToPC(self: *ContractsView) void {
        const dis = self.disassembly orelse return;

        // Parse hex input (skip "0x" prefix if present)
        var input = self.goto_pc_buffer[0..self.goto_pc_len];
        if (input.len >= 2 and input[0] == '0' and (input[1] == 'x' or input[1] == 'X')) {
            input = input[2..];
        }

        // Parse hex value
        const target_pc = std.fmt.parseInt(u32, input, 16) catch return;

        // Find block and instruction containing this PC
        self.navigateToPC(dis, target_pc);
    }

    /// Jump to the target of a JUMP/JUMPI instruction
    fn jumpToJumpTarget(self: *ContractsView) void {
        const dis = self.disassembly orelse return;
        if (self.current_block_index >= dis.blocks.len) return;

        const block = dis.blocks[self.current_block_index];
        if (self.instruction_index >= block.instructions.len) return;

        const current_instr = block.instructions[self.instruction_index];

        // Check if current instruction is JUMP (0x56) or JUMPI (0x57)
        if (current_instr.opcode != 0x56 and current_instr.opcode != 0x57) return;

        // Look for preceding PUSH instruction with operand
        if (self.instruction_index > 0) {
            const prev_instr = block.instructions[self.instruction_index - 1];
            // PUSH opcodes are 0x60-0x7F
            if (prev_instr.opcode >= 0x60 and prev_instr.opcode <= 0x7F) {
                if (prev_instr.operand) |operand| {
                    // Parse operand as target PC (skip "0x" prefix)
                    var op_str = operand;
                    if (op_str.len >= 2 and op_str[0] == '0' and (op_str[1] == 'x' or op_str[1] == 'X')) {
                        op_str = op_str[2..];
                    }
                    const target_pc = std.fmt.parseInt(u32, op_str, 16) catch return;
                    self.navigateToPC(dis, target_pc);
                }
            }
        }
    }

    /// Navigate to a specific PC in the disassembly
    fn navigateToPC(self: *ContractsView, dis: types.DisassemblyResult, target_pc: u32) void {
        for (dis.blocks, 0..) |block, block_idx| {
            for (block.instructions, 0..) |instr, instr_idx| {
                if (instr.pc == target_pc) {
                    self.current_block_index = block_idx;
                    self.instruction_index = instr_idx;
                    return;
                }
            }
        }
    }

    fn typeErasedDrawFn(ptr: *anyopaque, ctx: vxfw.DrawContext) std.mem.Allocator.Error!vxfw.Surface {
        const self: *ContractsView = @ptrCast(@alignCast(ptr));
        return self.draw(ctx);
    }

    fn draw(self: *ContractsView, ctx: vxfw.DrawContext) !vxfw.Surface {
        const max_size = ctx.max.size();
        var surface = try vxfw.Surface.init(ctx.arena, self.widget(), max_size);

        if (self.show_goto_pc) {
            return self.drawGotoPCModal(ctx, &surface, max_size);
        }
        if (self.show_detail) {
            return self.drawDetail(ctx, &surface, max_size);
        }
        return self.drawList(ctx, &surface, max_size);
    }

    fn triggerDisassembly(self: *ContractsView) void {
        // Clear previous state
        self.disassembly = null;
        self.disassembly_error = null;
        self.current_block_index = 0;
        self.instruction_index = 0;

        const contract = self.selected_contract orelse {
            self.disassembly_error = "No contract selected";
            return;
        };

        if (contract.bytecode.len == 0) {
            self.disassembly_error = "Contract has no bytecode";
            return;
        }

        // Perform disassembly
        const result = core.disassembler.disassemble(self.allocator, contract.bytecode) catch |err| {
            self.disassembly_error = switch (err) {
                error.InvalidHexLength => "Invalid bytecode: odd hex length",
                error.InvalidHexChar => "Invalid bytecode: invalid hex character",
                error.OutOfMemory => "Out of memory during disassembly",
            };
            return;
        };

        self.disassembly = result;
    }

    fn drawList(self: *ContractsView, ctx: vxfw.DrawContext, surface: *vxfw.Surface, max_size: vxfw.Size) !vxfw.Surface {
        var row: u16 = 0;

        // Header
        try writeString(surface, 2, row, "Contracts", styles.styles.title);
        row += 1;
        try writeString(surface, 2, row, "Deployed Contracts", styles.styles.muted);
        row += 2;

        // Column headers
        try writeString(surface, 2, row, "Address", styles.styles.muted);
        try writeString(surface, 46, row, "Size", styles.styles.muted);
        try writeString(surface, 60, row, "Deployed", styles.styles.muted);
        row += 1;
        try drawLine(surface, row, max_size.width, styles.styles.muted);
        row += 1;

        // Contract list
        if (self.contracts.len == 0) {
            try writeString(surface, 2, row, "No contracts deployed yet", styles.styles.muted);
        } else {
            for (self.contracts, 0..) |contract, i| {
                if (row >= max_size.height - 3) break;

                const is_selected = i == self.selected_index;
                const row_style = if (is_selected) styles.styles.selected else styles.styles.normal;

                if (is_selected) {
                    try writeString(surface, 0, row, ">", styles.styles.value);
                }

                // Address
                try writeString(surface, 2, row, contract.address, row_style);

                // Bytecode size
                const size_str = try std.fmt.allocPrint(ctx.arena, "{d} bytes", .{contract.bytecode.len});
                try writeString(surface, 46, row, size_str, row_style);

                // Timestamp
                const ts_str = try std.fmt.allocPrint(ctx.arena, "{d}", .{contract.timestamp});
                try writeString(surface, 60, row, ts_str, styles.styles.muted);

                row += 1;
            }
        }

        return surface.*;
    }

    fn drawDetail(self: *ContractsView, ctx: vxfw.DrawContext, surface: *vxfw.Surface, max_size: vxfw.Size) !vxfw.Surface {
        const contract = self.selected_contract orelse {
            try writeString(surface, 2, 0, "Contract not found", styles.styles.err);
            return surface.*;
        };

        var row: u16 = 0;

        // Split view: left side contract info, right side disassembly
        const left_width = max_size.width * 40 / 100;

        // Left panel - Contract details
        try writeString(surface, 2, row, "Contract Detail", styles.styles.title);
        row += 2;

        try writeString(surface, 2, row, "Address:", styles.styles.muted);
        row += 1;
        try writeString(surface, 4, row, contract.address, styles.styles.value);
        row += 2;

        const size_str = try std.fmt.allocPrint(ctx.arena, "Size: {d} bytes", .{contract.bytecode.len});
        try writeString(surface, 2, row, size_str, styles.styles.normal);
        row += 2;

        // Bytecode preview (first 64 chars)
        try writeString(surface, 2, row, "Bytecode:", styles.styles.muted);
        row += 1;
        const preview_len = @min(contract.bytecode.len, 64);
        if (preview_len > 0) {
            try writeString(surface, 4, row, contract.bytecode[0..preview_len], styles.styles.normal);
            if (contract.bytecode.len > 64) {
                try writeString(surface, 4 + preview_len, row, "...", styles.styles.muted);
            }
        }
        row += 2;

        // Vertical separator
        for (0..max_size.height) |y| {
            surface.writeCell(left_width, @intCast(y), .{
                .char = .{ .grapheme = "│", .width = 1 },
                .style = styles.styles.muted,
            });
        }

        // Right panel - Disassembly
        const right_start = left_width + 2;
        var right_row: u16 = 0;

        try writeStringAt(surface, right_start, right_row, "Disassembly", styles.styles.title);
        right_row += 1;

        if (self.disassembly_error) |err| {
            try writeStringAt(surface, right_start, right_row, "Error: ", styles.styles.err);
            try writeStringAt(surface, right_start + 7, right_row, err, styles.styles.err);
        } else if (self.disassembly) |dis| {
            // Block navigation info
            const block_info = try std.fmt.allocPrint(ctx.arena, "Block {d}/{d}", .{ self.current_block_index + 1, dis.blocks.len });
            try writeStringAt(surface, right_start, right_row, block_info, styles.styles.muted);
            right_row += 1;
            try drawLineAt(surface, right_row, right_start, max_size.width - right_start, styles.styles.muted);
            right_row += 1;

            // Column headers
            try writeStringAt(surface, right_start, right_row, "PC", styles.styles.muted);
            try writeStringAt(surface, right_start + 8, right_row, "OP", styles.styles.muted);
            try writeStringAt(surface, right_start + 14, right_row, "Name", styles.styles.muted);
            try writeStringAt(surface, right_start + 30, right_row, "Operand", styles.styles.muted);
            right_row += 1;

            if (self.current_block_index < dis.blocks.len) {
                const block = dis.blocks[self.current_block_index];
                for (block.instructions, 0..) |instr, i| {
                    if (right_row >= max_size.height - 2) break;

                    const is_selected = i == self.instruction_index;
                    const instr_style = if (is_selected) styles.styles.selected else styles.styles.normal;

                    if (is_selected) {
                        surface.writeCell(right_start - 1, right_row, .{
                            .char = .{ .grapheme = ">", .width = 1 },
                            .style = styles.styles.value,
                        });
                    }

                    // PC
                    const pc_str = try std.fmt.allocPrint(ctx.arena, "{x:0>4}", .{instr.pc});
                    try writeStringAt(surface, right_start, right_row, pc_str, styles.styles.muted);

                    // Opcode hex
                    const op_str = try std.fmt.allocPrint(ctx.arena, "{x:0>2}", .{instr.opcode});
                    try writeStringAt(surface, right_start + 8, right_row, op_str, styles.styles.value);

                    // Opcode name
                    try writeStringAt(surface, right_start + 14, right_row, instr.opcode_name, instr_style);

                    // Operand
                    if (instr.operand) |operand| {
                        try writeStringAt(surface, right_start + 30, right_row, operand, instr_style);
                    }

                    right_row += 1;
                }
            }
        } else {
            try writeStringAt(surface, right_start, right_row, "Loading disassembly...", styles.styles.muted);
        }

        return surface.*;
    }

    fn drawGotoPCModal(self: *ContractsView, ctx: vxfw.DrawContext, surface: *vxfw.Surface, max_size: vxfw.Size) !vxfw.Surface {
        _ = ctx;

        // Draw a simple modal overlay
        const modal_width: u16 = 40;
        const modal_height: u16 = 6;
        const start_x = (max_size.width - modal_width) / 2;
        const start_y = (max_size.height - modal_height) / 2;

        // Border
        for (0..modal_width) |x| {
            surface.writeCell(start_x + @as(u16, @intCast(x)), start_y, .{
                .char = .{ .grapheme = "─", .width = 1 },
                .style = styles.styles.title,
            });
            surface.writeCell(start_x + @as(u16, @intCast(x)), start_y + modal_height - 1, .{
                .char = .{ .grapheme = "─", .width = 1 },
                .style = styles.styles.title,
            });
        }

        try writeStringAt(surface, start_x + 2, start_y + 1, "Go to PC", styles.styles.title);
        try writeStringAt(surface, start_x + 2, start_y + 2, "Enter PC (hex):", styles.styles.muted);

        // Draw input box with current value
        try writeStringAt(surface, start_x + 18, start_y + 2, "[", styles.styles.muted);
        if (self.goto_pc_len > 0) {
            var c: u16 = start_x + 19;
            for (self.goto_pc_buffer[0..self.goto_pc_len]) |char| {
                surface.writeCell(c, start_y + 2, .{
                    .char = .{ .grapheme = &[_]u8{char}, .width = 1 },
                    .style = styles.styles.value,
                });
                c += 1;
            }
        }
        try writeStringAt(surface, start_x + 19 + @as(u16, @intCast(self.goto_pc_len)), start_y + 2, "_]", styles.styles.muted);

        try writeStringAt(surface, start_x + 2, start_y + 4, "esc: cancel | enter: jump", styles.styles.muted);

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

fn writeStringAt(surface: *vxfw.Surface, col: u16, row: u16, text: []const u8, style: vaxis.Style) !void {
    try writeString(surface, col, row, text, style);
}

fn drawLine(surface: *vxfw.Surface, row: u16, width: u16, style: vaxis.Style) !void {
    for (0..width) |x| {
        surface.writeCell(@intCast(x), row, .{
            .char = .{ .grapheme = "─", .width = 1 },
            .style = style,
        });
    }
}

fn drawLineAt(surface: *vxfw.Surface, row: u16, start_col: u16, width: u16, style: vaxis.Style) !void {
    for (0..width) |x| {
        surface.writeCell(start_col + @as(u16, @intCast(x)), row, .{
            .char = .{ .grapheme = "─", .width = 1 },
            .style = style,
        });
    }
}
