const std = @import("std");

/// CallType represents the type of EVM call
pub const CallType = enum {
    call,
    static_call,
    create,
    create2,
    delegate_call,

    pub fn toString(self: CallType) []const u8 {
        return switch (self) {
            .call => "CALL",
            .static_call => "STATICCALL",
            .create => "CREATE",
            .create2 => "CREATE2",
            .delegate_call => "DELEGATECALL",
        };
    }

    pub fn all() []const CallType {
        return &[_]CallType{
            .call,
            .static_call,
            .create,
            .create2,
            .delegate_call,
        };
    }
};

/// Call parameters as strings for UI editing
pub const CallParams = struct {
    call_type: CallType = .call,
    caller: []const u8 = "",
    target: []const u8 = "",
    value: []const u8 = "0",
    input_data: []const u8 = "",
    gas_limit: []const u8 = "1000000",
    salt: []const u8 = "",
};

/// EVM log event
pub const Log = struct {
    address: []const u8,
    topics: []const []const u8,
    data: []const u8,
};

/// Result of an EVM call
pub const CallResult = struct {
    success: bool,
    return_data: []const u8,
    gas_left: u64,
    error_info: ?[]const u8,
    logs: []const Log,
    deployed_addr: ?[]const u8,
};

/// Account information
pub const Account = struct {
    address: []const u8,
    balance: u256,
    nonce: u64,
    code: []const u8,
    code_hash: []const u8,
    private_key: ?[]const u8, // Only for test accounts
    index: u8, // Account index (1-10 for pre-funded accounts)

    pub fn formatBalance(self: Account, allocator: std.mem.Allocator) ![]const u8 {
        // Format as ETH (divide by 10^18)
        const eth_value = self.balance / 1_000_000_000_000_000_000;
        return std.fmt.allocPrint(allocator, "{d} ETH", .{eth_value});
    }
};

/// Block information
pub const Block = struct {
    number: u64,
    hash: []const u8,
    parent_hash: []const u8,
    timestamp: i64,
    gas_used: u64,
    gas_limit: u64,
    transactions: []const []const u8, // Transaction hashes
    miner: []const u8,
    state_root: []const u8,
    size: u64,
};

/// Transaction information
pub const Transaction = struct {
    id: []const u8,
    hash: []const u8,
    block_number: u64,
    block_hash: []const u8,
    from: []const u8,
    to: ?[]const u8,
    value: u256,
    gas_limit: u64,
    gas_used: u64,
    gas_price: u256,
    input_data: []const u8,
    nonce: u64,
    call_type: CallType,
    status: bool, // true = success
    return_data: []const u8,
    logs: []const Log,
    error_info: ?[]const u8,
    timestamp: i64,
    deployed_addr: ?[]const u8, // For CREATE/CREATE2
};

/// Blockchain statistics for dashboard
pub const BlockchainStats = struct {
    block_height: u64 = 0,
    total_blocks: u64 = 0,
    total_transactions: u64 = 0,
    successful_txs: u64 = 0,
    failed_txs: u64 = 0,
    total_gas_used: u64 = 0,
    total_accounts: u32 = 0,
    total_contracts: u32 = 0,
    total_balance: u256 = 0,
    last_block_time: i64 = 0,
};

/// Call history entry
pub const CallHistoryEntry = struct {
    id: []const u8,
    params: CallParams,
    result: ?CallResult,
    timestamp: i64,
};

/// Contract information
pub const Contract = struct {
    address: []const u8,
    bytecode: []const u8,
    timestamp: i64,
};

/// Disassembled instruction
pub const Instruction = struct {
    pc: u32,
    opcode: u8,
    opcode_name: []const u8,
    operand: ?[]const u8,
    size: u8,
};

/// Basic block in disassembly
pub const BasicBlock = struct {
    start_pc: u32,
    end_pc: u32,
    instructions: []const Instruction,
};

/// Result of bytecode disassembly
pub const DisassemblyResult = struct {
    blocks: []const BasicBlock,
    total_instructions: u32,
    bytecode_size: u32,
};

/// Account state for inspector
pub const AccountState = struct {
    address: []const u8,
    balance: u256,
    nonce: u64,
    code: []const u8,
    code_size: u32,
    storage_slots: std.StringHashMap([]const u8),
    is_contract: bool,
};

/// Navigation state for stack-based navigation
pub const NavState = struct {
    stack: std.ArrayList(AppState),
    allocator: std.mem.Allocator,

    pub fn init(allocator: std.mem.Allocator) NavState {
        return .{
            .stack = std.ArrayList(AppState).init(allocator),
            .allocator = allocator,
        };
    }

    pub fn deinit(self: *NavState) void {
        self.stack.deinit();
    }

    pub fn push(self: *NavState, state: AppState) !void {
        try self.stack.append(state);
    }

    pub fn pop(self: *NavState) ?AppState {
        return self.stack.popOrNull();
    }

    pub fn peek(self: *NavState) ?AppState {
        if (self.stack.items.len == 0) return null;
        return self.stack.items[self.stack.items.len - 1];
    }

    pub fn clear(self: *NavState) void {
        self.stack.clearRetainingCapacity();
    }

    pub fn depth(self: *NavState) usize {
        return self.stack.items.len;
    }
};

/// Application state enum for navigation
pub const AppState = enum {
    // Main views
    dashboard,
    call_history,
    call_history_detail,
    contracts,
    contract_detail,
    accounts,
    account_detail,
    blocks,
    block_detail,
    transactions,
    transaction_detail,
    settings,
    state_inspector,

    // Modal states
    call_param_list,
    call_param_edit,
    call_type_edit,
    call_executing,
    call_result,
    log_detail,
    fixtures_list,
    confirm_reset,
    goto_pc,
};

/// Settings options
pub const SettingsOption = enum(u8) {
    server_status = 0,
    reset_state = 1,
    regenerate_accounts = 2,
    export_state = 3,

    pub fn label(self: SettingsOption) []const u8 {
        return switch (self) {
            .server_status => "Server Status",
            .reset_state => "Reset Blockchain State",
            .regenerate_accounts => "Regenerate Test Accounts",
            .export_state => "Export State",
        };
    }

    pub fn description(self: SettingsOption) []const u8 {
        return switch (self) {
            .server_status => "View RPC server status",
            .reset_state => "Clear all blocks, transactions, and contracts",
            .regenerate_accounts => "Generate new test account keys",
            .export_state => "Export current state to JSON",
        };
    }

    pub fn all() []const SettingsOption {
        return &[_]SettingsOption{
            .server_status,
            .reset_state,
            .regenerate_accounts,
            .export_state,
        };
    }
};
