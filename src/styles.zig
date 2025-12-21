const vaxis = @import("vaxis");

/// Chop TUI color palette (Dracula-inspired)
pub const colors = struct {
    /// Cyan - Primary headings and highlights
    pub const primary = vaxis.Cell.Color{ .rgb = .{ 0x00, 0xD9, 0xFF } };
    /// Purple - Secondary elements
    pub const secondary = vaxis.Cell.Color{ .rgb = .{ 0x7D, 0x56, 0xF4 } };
    /// Orange/Amber - Values and data
    pub const amber = vaxis.Cell.Color{ .rgb = .{ 0xFF, 0xB8, 0x6C } };
    /// Green - Success states
    pub const success = vaxis.Cell.Color{ .rgb = .{ 0x50, 0xFA, 0x7B } };
    /// Red - Error states
    pub const err = vaxis.Cell.Color{ .rgb = .{ 0xFF, 0x55, 0x55 } };
    /// Gray - Muted/help text
    pub const muted = vaxis.Cell.Color{ .rgb = .{ 0x62, 0x72, 0xA4 } };
    /// Light - Default text
    pub const text = vaxis.Cell.Color{ .rgb = .{ 0xF8, 0xF8, 0xF2 } };
    /// Dark background
    pub const bg = vaxis.Cell.Color{ .rgb = .{ 0x28, 0x2A, 0x36 } };
    /// Slightly lighter background for selection
    pub const bg_highlight = vaxis.Cell.Color{ .rgb = .{ 0x44, 0x47, 0x5A } };
};

/// Pre-defined styles for common UI elements
pub const styles = struct {
    /// Title/heading style
    pub const title = vaxis.Style{
        .fg = colors.primary,
        .bold = true,
    };

    /// Selected item style
    pub const selected = vaxis.Style{
        .fg = colors.text,
        .bg = colors.bg_highlight,
        .bold = true,
    };

    /// Normal text style
    pub const normal = vaxis.Style{
        .fg = colors.text,
    };

    /// Muted/help text style
    pub const muted = vaxis.Style{
        .fg = colors.muted,
    };

    /// Success style
    pub const success = vaxis.Style{
        .fg = colors.success,
    };

    /// Error style
    pub const err = vaxis.Style{
        .fg = colors.err,
    };

    /// Value/data style
    pub const value = vaxis.Style{
        .fg = colors.amber,
    };

    /// Tab active style
    pub const tab_active = vaxis.Style{
        .fg = colors.text,
        .bg = colors.primary,
        .bold = true,
    };

    /// Tab inactive style
    pub const tab_inactive = vaxis.Style{
        .fg = colors.muted,
    };
};
