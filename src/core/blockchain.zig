const std = @import("std");
const evm = @import("evm");
const primitives = @import("primitives");
const crypto = @import("crypto");

const types = @import("../types.zig");

const Address = primitives.Address.Address;

/// Blockchain simulation for local EVM development
pub const Blockchain = struct {
    allocator: std.mem.Allocator,

    // EVM database for state
    db: evm.Database,

    // State tracking
    blocks: std.ArrayListUnmanaged(types.Block),
    transactions: std.ArrayListUnmanaged(types.Transaction),
    accounts: std.ArrayListUnmanaged(types.Account),
    contracts: std.ArrayListUnmanaged(types.Contract),
    call_history: std.ArrayListUnmanaged(types.CallHistoryEntry),

    // Stats
    stats: types.BlockchainStats,

    // Current block number
    current_block: u64 = 0,

    // Chain ID (1 for mainnet simulation)
    chain_id: u64 = 1,

    // Gas price
    gas_price: u256 = 20_000_000_000, // 20 gwei

    pub fn init(allocator: std.mem.Allocator) !*Blockchain {
        const self = try allocator.create(Blockchain);
        errdefer allocator.destroy(self);

        self.* = .{
            .allocator = allocator,
            .db = evm.Database.init(allocator),
            .blocks = .{},
            .transactions = .{},
            .accounts = .{},
            .contracts = .{},
            .call_history = .{},
            .stats = .{},
        };

        // Create genesis block
        try self.createGenesisBlock();

        // Create pre-funded test accounts
        try self.createTestAccounts();

        return self;
    }

    pub fn deinit(self: *Blockchain) void {
        self.db.deinit();
        self.blocks.deinit(self.allocator);
        self.transactions.deinit(self.allocator);
        self.accounts.deinit(self.allocator);
        self.contracts.deinit(self.allocator);
        self.call_history.deinit(self.allocator);
        self.allocator.destroy(self);
    }

    fn createGenesisBlock(self: *Blockchain) !void {
        const genesis = types.Block{
            .number = 0,
            .hash = "0x0000000000000000000000000000000000000000000000000000000000000000",
            .parent_hash = "0x0000000000000000000000000000000000000000000000000000000000000000",
            .timestamp = std.time.timestamp(),
            .gas_used = 0,
            .gas_limit = 30_000_000,
            .transactions = &.{},
            .miner = "0x0000000000000000000000000000000000000000",
            .state_root = "0x0000000000000000000000000000000000000000000000000000000000000000",
            .size = 0,
        };
        try self.blocks.append(self.allocator, genesis);
        self.stats.total_blocks = 1;
    }

    fn createTestAccounts(self: *Blockchain) !void {
        // Pre-funded test accounts (like Hardhat/Anvil)
        const test_accounts = [_]struct { addr: []const u8, pk: []const u8 }{
            .{ .addr = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", .pk = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" },
            .{ .addr = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", .pk = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" },
            .{ .addr = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", .pk = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" },
            .{ .addr = "0x90F79bf6EB2c4f870365E785982E1f101E93b906", .pk = "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6" },
            .{ .addr = "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65", .pk = "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a" },
            .{ .addr = "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc", .pk = "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba" },
            .{ .addr = "0x976EA74026E726554dB657fA54763abd0C3a0aa9", .pk = "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e" },
            .{ .addr = "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955", .pk = "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356" },
            .{ .addr = "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f", .pk = "0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97" },
            .{ .addr = "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720", .pk = "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6" },
        };

        const initial_balance: u256 = 10000 * 1_000_000_000_000_000_000; // 10000 ETH

        for (test_accounts, 0..) |acc, i| {
            // Parse address from hex string
            const addr = try parseAddress(acc.addr);

            // Create account in EVM database
            const evm_account = evm.Account{
                .balance = initial_balance,
                .nonce = 0,
                .code_hash = [_]u8{0} ** 32,
                .storage_root = [_]u8{0} ** 32,
            };
            try self.db.set_account(addr.bytes, evm_account);

            // Track in our accounts list
            const account = types.Account{
                .address = acc.addr,
                .balance = initial_balance,
                .nonce = 0,
                .code = "",
                .code_hash = "0x0000000000000000000000000000000000000000000000000000000000000000",
                .private_key = acc.pk,
                .index = @intCast(i + 1),
            };
            try self.accounts.append(self.allocator, account);
        }
        self.stats.total_accounts = @intCast(test_accounts.len);
    }

    /// Parse hex address string to Address
    fn parseAddress(hex: []const u8) !Address {
        // Skip "0x" prefix if present
        const clean = if (hex.len >= 2 and hex[0] == '0' and (hex[1] == 'x' or hex[1] == 'X'))
            hex[2..]
        else
            hex;

        if (clean.len != 40) return error.InvalidAddressLength;

        var bytes: [20]u8 = undefined;
        for (0..20) |i| {
            bytes[i] = std.fmt.parseUnsigned(u8, clean[i * 2 .. i * 2 + 2], 16) catch return error.InvalidHex;
        }
        return Address{ .bytes = bytes };
    }

    /// Parse hex string to bytes
    fn parseHexBytes(allocator: std.mem.Allocator, hex: []const u8) ![]u8 {
        // Skip "0x" prefix if present
        const clean = if (hex.len >= 2 and hex[0] == '0' and (hex[1] == 'x' or hex[1] == 'X'))
            hex[2..]
        else
            hex;

        if (clean.len % 2 != 0) return error.InvalidHexLength;

        const len = clean.len / 2;
        const bytes = try allocator.alloc(u8, len);
        errdefer allocator.free(bytes);

        for (0..len) |i| {
            bytes[i] = std.fmt.parseUnsigned(u8, clean[i * 2 .. i * 2 + 2], 16) catch return error.InvalidHex;
        }
        return bytes;
    }

    /// Parse decimal or hex string to u256
    fn parseValue(str: []const u8) !u256 {
        if (str.len == 0) return 0;

        // Check for hex prefix
        if (str.len >= 2 and str[0] == '0' and (str[1] == 'x' or str[1] == 'X')) {
            return std.fmt.parseUnsigned(u256, str[2..], 16) catch return error.InvalidValue;
        }

        return std.fmt.parseUnsigned(u256, str, 10) catch return error.InvalidValue;
    }

    /// Parse decimal or hex string to u64
    fn parseGas(str: []const u8) !u64 {
        if (str.len == 0) return 1_000_000;

        if (str.len >= 2 and str[0] == '0' and (str[1] == 'x' or str[1] == 'X')) {
            return std.fmt.parseUnsigned(u64, str[2..], 16) catch return error.InvalidGas;
        }

        return std.fmt.parseUnsigned(u64, str, 10) catch return error.InvalidGas;
    }

    /// Execute an EVM call
    pub fn executeCall(self: *Blockchain, params: types.CallParams) !types.CallResult {
        // Parse call parameters
        const caller = try parseAddress(params.caller);
        const value = try parseValue(params.value);
        const gas = try parseGas(params.gas_limit);

        // Parse input data
        const input_data = if (params.input_data.len > 0)
            try parseHexBytes(self.allocator, params.input_data)
        else
            &[_]u8{};
        defer if (params.input_data.len > 0) self.allocator.free(input_data);

        // Create block info
        const block_info = evm.BlockInfo{
            .chain_id = self.chain_id,
            .number = self.current_block,
            .timestamp = @intCast(@max(0, std.time.timestamp())),
            .difficulty = 0, // Post-merge
            .gas_limit = 30_000_000,
            .coinbase = Address{ .bytes = [_]u8{0} ** 20 },
            .base_fee = 0,
            .prev_randao = [_]u8{0} ** 32,
            .blob_base_fee = 0,
            .blob_versioned_hashes = &.{},
        };

        // Create transaction context
        const tx_context = evm.TransactionContext{
            .gas_limit = gas,
            .coinbase = Address{ .bytes = [_]u8{0} ** 20 },
            .chain_id = @intCast(self.chain_id),
        };

        // Initialize EVM
        var vm = try evm.MainnetEvm.init(
            self.allocator,
            &self.db,
            block_info,
            tx_context,
            self.gas_price,
            caller,
        );
        defer vm.deinit();

        // Build call params based on call type
        const evm_params: evm.CallParams = switch (params.call_type) {
            .call => .{
                .call = .{
                    .caller = caller,
                    .to = try parseAddress(params.target),
                    .value = value,
                    .input = input_data,
                    .gas = gas,
                },
            },
            .static_call => .{
                .staticcall = .{
                    .caller = caller,
                    .to = try parseAddress(params.target),
                    .input = input_data,
                    .gas = gas,
                },
            },
            .delegate_call => .{
                .delegatecall = .{
                    .caller = caller,
                    .to = try parseAddress(params.target),
                    .input = input_data,
                    .gas = gas,
                },
            },
            .create => .{
                .create = .{
                    .caller = caller,
                    .value = value,
                    .init_code = input_data,
                    .gas = gas,
                },
            },
            .create2 => blk: {
                const salt = try parseValue(params.salt);
                break :blk .{
                    .create2 = .{
                        .caller = caller,
                        .value = value,
                        .init_code = input_data,
                        .salt = salt,
                        .gas = gas,
                    },
                };
            },
        };

        // Execute the call
        var result = vm.call(evm_params);
        defer result.deinit(self.allocator);

        // Convert created address to hex string if present
        var deployed_addr: ?[]const u8 = null;
        if (result.created_address) |addr| {
            deployed_addr = try formatAddressHex(self.allocator, addr);
        }

        // Convert logs from EVM format to display format
        const converted_logs = try self.convertLogs(result.logs);

        // Return result in our format
        return types.CallResult{
            .success = result.success,
            .return_data = if (result.output.len > 0)
                try formatBytesHex(self.allocator, result.output)
            else
                "",
            .gas_left = result.gas_left,
            .error_info = if (!result.success) "Execution reverted" else null,
            .logs = converted_logs,
            .deployed_addr = deployed_addr,
        };
    }

    /// Convert EVM logs to display format
    fn convertLogs(self: *Blockchain, evm_logs: anytype) ![]const types.Log {
        if (evm_logs.len == 0) return &.{};

        var logs = try self.allocator.alloc(types.Log, evm_logs.len);
        errdefer self.allocator.free(logs);

        for (evm_logs, 0..) |evm_log, i| {
            // Format address as hex
            const addr_hex = try formatAddressHex(self.allocator, evm_log.address);

            // Format topics as hex strings
            var topics = try self.allocator.alloc([]const u8, evm_log.topics.len);
            for (evm_log.topics, 0..) |topic, j| {
                topics[j] = try formatU256Hex(self.allocator, topic);
            }

            // Format data as hex
            const data_hex = if (evm_log.data.len > 0)
                try formatBytesHex(self.allocator, evm_log.data)
            else
                "";

            logs[i] = types.Log{
                .address = addr_hex,
                .topics = topics,
                .data = data_hex,
            };
        }

        return logs;
    }

    /// Format u256 as hex string (32 bytes)
    fn formatU256Hex(allocator: std.mem.Allocator, value: u256) ![]const u8 {
        var bytes: [32]u8 = undefined;
        std.mem.writeInt(u256, &bytes, value, .big);
        return std.fmt.allocPrint(allocator, "0x{x}", .{bytes});
    }

    /// Format address as hex string
    fn formatAddressHex(allocator: std.mem.Allocator, addr: Address) ![]const u8 {
        return std.fmt.allocPrint(allocator, "0x{x}", .{addr.bytes});
    }

    /// Format bytes as hex string
    fn formatBytesHex(allocator: std.mem.Allocator, bytes: []const u8) ![]const u8 {
        return std.fmt.allocPrint(allocator, "0x{x}", .{bytes});
    }

    /// Reset blockchain to initial state
    pub fn reset(self: *Blockchain) !void {
        // Clear transactions (keep genesis block)
        self.transactions.clearRetainingCapacity();

        // Clear contracts
        self.contracts.clearRetainingCapacity();

        // Clear call history
        self.call_history.clearRetainingCapacity();

        // Reset blocks to just genesis
        if (self.blocks.items.len > 1) {
            self.blocks.shrinkRetainingCapacity(1);
        }

        // Reset stats
        self.stats = .{
            .block_height = 0,
            .total_blocks = 1,
            .total_transactions = 0,
            .successful_txs = 0,
            .failed_txs = 0,
            .total_gas_used = 0,
            .total_accounts = 10,
            .total_contracts = 0,
            .total_balance = 100000, // 10 accounts * 10000 ETH
            .last_block_time = std.time.timestamp(),
        };

        // Reset account balances
        for (self.accounts.items) |*account| {
            account.balance = 10_000_000_000_000_000_000_000; // 10,000 ETH
            account.nonce = 0;
        }

        // Reset EVM database (create new one)
        self.db.deinit();
        self.db = evm.Database.init(self.allocator);

        // Re-add test accounts to EVM state
        try self.createTestAccounts();
    }

    /// Regenerate all test accounts with new random private keys
    pub fn regenerateAccounts(self: *Blockchain) !void {
        // Clear existing accounts
        self.accounts.clearRetainingCapacity();

        // Reset EVM database
        self.db.deinit();
        self.db = evm.Database.init(self.allocator);

        // Generate 10 new accounts with random keys
        var i: usize = 0;
        while (i < 10) : (i += 1) {
            // Generate random 32-byte private key
            var private_key: [32]u8 = undefined;
            std.crypto.random.bytes(&private_key);

            // Ensure private key is valid (non-zero and less than curve order)
            // For simplicity, just regenerate if zero
            var is_zero = true;
            for (private_key) |b| {
                if (b != 0) {
                    is_zero = false;
                    break;
                }
            }
            if (is_zero) {
                i -= 1;
                continue;
            }

            // Convert to u256 for scalar multiplication
            const priv_key_u256 = std.mem.readInt(u256, &private_key, .big);

            // Derive public key: G * privateKey
            const generator = crypto.secp256k1.AffinePoint.generator();
            const pub_point = generator.scalarMul(priv_key_u256);

            // Serialize public key (uncompressed, 64 bytes)
            var pub_key_bytes: [64]u8 = undefined;
            std.mem.writeInt(u256, pub_key_bytes[0..32], pub_point.x, .big);
            std.mem.writeInt(u256, pub_key_bytes[32..64], pub_point.y, .big);

            // Hash with Keccak256
            var hasher = std.crypto.hash.sha3.Keccak256.init(.{});
            hasher.update(&pub_key_bytes);
            var hash: [32]u8 = undefined;
            hasher.final(&hash);

            // Address is last 20 bytes of hash
            var addr_bytes: [20]u8 = undefined;
            @memcpy(&addr_bytes, hash[12..32]);

            // Format address as hex string
            const addr_hex = try std.fmt.allocPrint(self.allocator, "0x{x}", .{addr_bytes});

            // Format private key as hex string
            const priv_hex = try std.fmt.allocPrint(self.allocator, "0x{x}", .{private_key});

            // Create account
            const account = types.Account{
                .address = addr_hex,
                .balance = 10_000_000_000_000_000_000_000, // 10,000 ETH
                .nonce = 0,
                .code = "",
                .private_key = priv_hex,
            };

            try self.accounts.append(self.allocator, account);

            // Add to EVM database
            const evm_addr = Address{ .bytes = addr_bytes };
            try self.db.put_account(evm_addr, .{
                .balance = 10_000_000_000_000_000_000_000,
                .nonce = 0,
                .code_hash = [_]u8{0} ** 32,
            });
        }

        // Update stats
        self.stats.total_accounts = 10;
    }

    /// Get blockchain stats
    pub fn getStats(self: *Blockchain) types.BlockchainStats {
        return self.stats;
    }

    /// Get all accounts
    pub fn getAccounts(self: *Blockchain) []const types.Account {
        return self.accounts.items;
    }

    /// Get all blocks
    pub fn getBlocks(self: *Blockchain) []const types.Block {
        return self.blocks.items;
    }

    /// Get all transactions
    pub fn getTransactions(self: *Blockchain) []const types.Transaction {
        return self.transactions.items;
    }

    /// Get all contracts
    pub fn getContracts(self: *Blockchain) []const types.Contract {
        return self.contracts.items;
    }

    /// Get call history
    pub fn getCallHistory(self: *Blockchain) []const types.CallHistoryEntry {
        return self.call_history.items;
    }

    /// Get recent blocks
    pub fn getRecentBlocks(self: *Blockchain, count: usize) []const types.Block {
        const len = self.blocks.items.len;
        if (len == 0) return &.{};
        const start = if (len > count) len - count else 0;
        return self.blocks.items[start..];
    }

    /// Get recent transactions
    pub fn getRecentTransactions(self: *Blockchain, count: usize) []const types.Transaction {
        const len = self.transactions.items.len;
        if (len == 0) return &.{};
        const start = if (len > count) len - count else 0;
        return self.transactions.items[start..];
    }
};
