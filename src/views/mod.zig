// Views module - exports all view widgets

pub const DashboardView = @import("dashboard.zig").DashboardView;
pub const AccountsView = @import("accounts.zig").AccountsView;
pub const BlocksView = @import("blocks.zig").BlocksView;
pub const TransactionsView = @import("transactions.zig").TransactionsView;
pub const ContractsView = @import("contracts.zig").ContractsView;
pub const HistoryView = @import("history.zig").HistoryView;
pub const SettingsView = @import("settings.zig").SettingsView;
pub const InspectorView = @import("inspector.zig").InspectorView;
