const std = @import("std");
const vaxis = @import("vaxis");
const vxfw = vaxis.vxfw;
const styles = @import("../styles.zig");

/// Write a string to a surface using proper UTF-8 grapheme iteration
pub fn writeString(surface: *vxfw.Surface, ctx: vxfw.DrawContext, col: u16, row: u16, text: []const u8, style: vaxis.Style) !void {
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

/// Draw a horizontal line
pub fn drawLine(surface: *vxfw.Surface, row: u16, width: u16, style: vaxis.Style) !void {
    for (0..width) |x| {
        surface.writeCell(@intCast(x), row, .{
            .char = .{ .grapheme = "-", .width = 1 },
            .style = style,
        });
    }
}

/// Draw a stat row (label: value)
pub fn drawStatRow(surface: *vxfw.Surface, ctx: vxfw.DrawContext, row: u16, col: u16, label: []const u8, value: u64) !void {
    try writeString(surface, ctx, col, row, label, styles.styles.muted);
    const value_str = try std.fmt.allocPrint(ctx.arena, ": {d}", .{value});
    const label_width: u16 = @intCast(ctx.stringWidth(label));
    try writeString(surface, ctx, col + label_width, row, value_str, styles.styles.value);
}
