/// Tab represents the main navigation tabs in Chop TUI
pub const Tab = enum(u3) {
    dashboard = 0, // Key 1
    call_history = 1, // Key 2
    contracts = 2, // Key 3
    accounts = 3, // Key 4
    blocks = 4, // Key 5
    transactions = 5, // Key 6
    settings = 6, // Key 7

    /// Convert a keyboard key to a Tab (keys 1-7)
    pub fn fromKey(key: u21) ?Tab {
        if (key >= '1' and key <= '7') {
            return @enumFromInt(@as(u3, @intCast(key - '1')));
        }
        return null;
    }

    /// Get the display label for this tab
    pub fn label(self: Tab) []const u8 {
        return switch (self) {
            .dashboard => "1:Dashboard",
            .call_history => "2:History",
            .contracts => "3:Contracts",
            .accounts => "4:Accounts",
            .blocks => "5:Blocks",
            .transactions => "6:Txns",
            .settings => "7:Settings",
        };
    }

    /// Get the short label for this tab (without number)
    pub fn shortLabel(self: Tab) []const u8 {
        return switch (self) {
            .dashboard => "Dashboard",
            .call_history => "History",
            .contracts => "Contracts",
            .accounts => "Accounts",
            .blocks => "Blocks",
            .transactions => "Txns",
            .settings => "Settings",
        };
    }

    /// Get the help text for this tab
    pub fn helpText(self: Tab) []const u8 {
        return switch (self) {
            .dashboard => "Blockchain stats and overview",
            .call_history => "EVM call history and execution",
            .contracts => "Deployed contracts and disassembly",
            .accounts => "Account balances and state",
            .blocks => "Block explorer",
            .transactions => "Transaction history",
            .settings => "Configuration options",
        };
    }

    /// Get all tabs as a slice
    pub fn all() []const Tab {
        return &[_]Tab{
            .dashboard,
            .call_history,
            .contracts,
            .accounts,
            .blocks,
            .transactions,
            .settings,
        };
    }
};
