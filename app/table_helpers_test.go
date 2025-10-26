package app

import (
	"chop/core/accounts"
	"chop/core/blockchain"
	"chop/core/history"
	"chop/tui"
	"chop/types"
	"fmt"
	"math/big"
	"testing"
	"time"
)

// TestUpdateHistoryTableEmpty tests updating history table with no entries
func TestUpdateHistoryTableEmpty(t *testing.T) {
	t.Parallel()

	historyMgr := history.NewHistoryManager(100)
	m := Model{
		historyManager: historyMgr,
		historyTable:   tui.CreateHistoryTable(),
	}

	// Update table with empty history
	m.updateHistoryTable()

	// Table should have no rows
	rows := m.historyTable.Rows()
	if len(rows) != 0 {
		t.Errorf("Expected 0 rows for empty history, got %d", len(rows))
	}
}

// TestUpdateHistoryTableSingleEntry tests updating history table with one entry
func TestUpdateHistoryTableSingleEntry(t *testing.T) {
	t.Parallel()

	historyMgr := history.NewHistoryManager(100)
	m := Model{
		historyManager: historyMgr,
		historyTable:   tui.CreateHistoryTable(),
	}

	// Add a history entry
	entry := types.CallHistoryEntry{
		Parameters: types.CallParametersStrings{
			CallType: "CALL",
			Caller:   "0x1234567890123456",
			Target:   "0xabcdefabcdefabcd",
			GasLimit: "1000000",
		},
		Result: &types.CallResult{
			Success: true,
			GasLeft: 500000,
		},
		Timestamp: time.Now(),
	}
	historyMgr.AddCall(entry)

	// Update table
	m.updateHistoryTable()

	// Table should have 1 row
	rows := m.historyTable.Rows()
	if len(rows) != 1 {
		t.Fatalf("Expected 1 row, got %d", len(rows))
	}

	// Verify row content
	row := rows[0]
	if len(row) != 6 {
		t.Fatalf("Expected 6 columns, got %d", len(row))
	}

	// Check call type
	if row[1] != "CALL" {
		t.Errorf("Expected call type 'CALL', got %s", row[1])
	}

	// Check status (should be success)
	if row[4] != "✓" {
		t.Errorf("Expected status '✓', got %s", row[4])
	}

	// Verify cursor is at 0
	if m.historyTable.Cursor() != 0 {
		t.Errorf("Expected cursor at 0, got %d", m.historyTable.Cursor())
	}
}

// TestUpdateHistoryTableMultipleEntries tests updating history table with multiple entries
func TestUpdateHistoryTableMultipleEntries(t *testing.T) {
	t.Parallel()

	historyMgr := history.NewHistoryManager(100)
	m := Model{
		historyManager: historyMgr,
		historyTable:   tui.CreateHistoryTable(),
	}

	// Add multiple history entries
	for i := 0; i < 5; i++ {
		entry := types.CallHistoryEntry{
			Parameters: types.CallParametersStrings{
				CallType: "CALL",
				Caller:   "0x1234567890123456",
				Target:   "0xabcdefabcdefabcd",
				GasLimit: "1000000",
			},
			Result: &types.CallResult{
				Success: i%2 == 0, // Alternate success/failure
				GasLeft: 500000,
			},
			Timestamp: time.Now(),
		}
		historyMgr.AddCall(entry)
	}

	// Update table
	m.updateHistoryTable()

	// Table should have 5 rows
	rows := m.historyTable.Rows()
	if len(rows) != 5 {
		t.Fatalf("Expected 5 rows, got %d", len(rows))
	}

	// Verify alternating success/failure
	for i, row := range rows {
		expectedStatus := "✓"
		if i%2 != 0 {
			expectedStatus = "✗"
		}
		if row[4] != expectedStatus {
			t.Errorf("Row %d: expected status '%s', got '%s'", i, expectedStatus, row[4])
		}
	}
}

// TestUpdateHistoryTableFailedCall tests history table with failed call
func TestUpdateHistoryTableFailedCall(t *testing.T) {
	t.Parallel()

	historyMgr := history.NewHistoryManager(100)
	m := Model{
		historyManager: historyMgr,
		historyTable:   tui.CreateHistoryTable(),
	}

	// Add a failed call
	entry := types.CallHistoryEntry{
		Parameters: types.CallParametersStrings{
			CallType: "CALL",
			Caller:   "0x1234567890123456",
			Target:   "0xabcdefabcdefabcd",
			GasLimit: "1000000",
		},
		Result: &types.CallResult{
			Success: false,
			GasLeft: 500000,
		},
		Timestamp: time.Now(),
	}
	historyMgr.AddCall(entry)

	// Update table
	m.updateHistoryTable()

	// Verify failed status
	rows := m.historyTable.Rows()
	if len(rows) != 1 {
		t.Fatalf("Expected 1 row, got %d", len(rows))
	}

	if rows[0][4] != "✗" {
		t.Errorf("Expected failed status '✗', got %s", rows[0][4])
	}
}

// TestUpdateContractsTableEmpty tests updating contracts table with no entries
func TestUpdateContractsTableEmpty(t *testing.T) {
	t.Parallel()

	historyMgr := history.NewHistoryManager(100)
	m := Model{
		historyManager: historyMgr,
		contractsTable: tui.CreateContractsTable(),
	}

	// Update table with no contracts
	m.updateContractsTable()

	// Table should have no rows
	rows := m.contractsTable.Rows()
	if len(rows) != 0 {
		t.Errorf("Expected 0 rows for no contracts, got %d", len(rows))
	}
}

// TestUpdateContractsTableSingleContract tests updating contracts table with one contract
func TestUpdateContractsTableSingleContract(t *testing.T) {
	t.Parallel()

	historyMgr := history.NewHistoryManager(100)
	m := Model{
		historyManager: historyMgr,
		contractsTable: tui.CreateContractsTable(),
	}

	// Add a contract via AddCall with a deployment result
	entry := types.CallHistoryEntry{
		Parameters: types.CallParametersStrings{
			CallType: "CREATE",
			Caller:   "0x1234567890123456",
			GasLimit: "1000000",
		},
		Result: &types.CallResult{
			Success:      true,
			GasLeft:      500000,
			DeployedAddr: "0x1234567890abcdef1234567890abcdef12345678",
			ReturnData:   []byte{0x60, 0x80, 0x60, 0x40},
		},
		Timestamp: time.Now(),
	}
	historyMgr.AddCall(entry)

	// Update table
	m.updateContractsTable()

	// Table should have 1 row
	rows := m.contractsTable.Rows()
	if len(rows) != 1 {
		t.Fatalf("Expected 1 row, got %d", len(rows))
	}

	// Verify row content
	row := rows[0]
	if len(row) != 2 {
		t.Fatalf("Expected 2 columns, got %d", len(row))
	}

	// Check address
	if row[0] != entry.Result.DeployedAddr {
		t.Errorf("Expected address '%s', got '%s'", entry.Result.DeployedAddr, row[0])
	}

	// Verify cursor is at 0
	if m.contractsTable.Cursor() != 0 {
		t.Errorf("Expected cursor at 0, got %d", m.contractsTable.Cursor())
	}
}

// TestUpdateTransactionsTableEmpty tests updating transactions table with no entries
func TestUpdateTransactionsTableEmpty(t *testing.T) {
	t.Parallel()

	chain := blockchain.NewChain()
	m := Model{
		blockchainChain:   chain,
		transactionsTable: tui.CreateTransactionsTable(),
	}

	// Update table with no transactions
	m.updateTransactionsTable()

	// Table should have no rows
	rows := m.transactionsTable.Rows()
	if len(rows) != 0 {
		t.Errorf("Expected 0 rows for no transactions, got %d", len(rows))
	}
}

// TestUpdateTransactionsTableSingleTransaction tests updating transactions table with one transaction
func TestUpdateTransactionsTableSingleTransaction(t *testing.T) {
	t.Parallel()

	// Create account manager and chain
	accountMgr, err := accounts.NewManager()
	if err != nil {
		t.Fatalf("Failed to create account manager: %v", err)
	}

	chain := blockchain.NewChain()
	m := Model{
		accountManager:    accountMgr,
		blockchainChain:   chain,
		transactionsTable: tui.CreateTransactionsTable(),
	}

	// Get first account
	accts := accountMgr.GetAllAccounts()
	if len(accts) < 2 {
		t.Fatal("Need at least 2 accounts")
	}

	// Add a transaction
	tx := &types.Transaction{
		ID:          "tx-1",
		Hash:        "0xhash123",
		BlockNumber: 1,
		From:        accts[0].Address,
		To:          accts[1].Address,
		Value:       big.NewInt(1000),
		GasLimit:    1000000,
		GasUsed:     21000,
		CallType:    types.CallTypeCall,
		Status:      true,
		Timestamp:   time.Now(),
	}

	// Add transaction to chain
	chain.AddTransaction(tx)

	// Add a block
	chain.AddBlock([]string{tx.ID}, 21000, accts[0].Address)

	// Update table
	m.updateTransactionsTable()

	// Table should have 1 row
	rows := m.transactionsTable.Rows()
	if len(rows) != 1 {
		t.Fatalf("Expected 1 row, got %d", len(rows))
	}

	// Verify row content
	row := rows[0]
	if len(row) != 6 {
		t.Fatalf("Expected 6 columns, got %d", len(row))
	}

	// Check call type
	if row[0] != "CALL" {
		t.Errorf("Expected call type 'CALL', got %s", row[0])
	}

	// Check status (should be success)
	if row[5] != "✓" {
		t.Errorf("Expected status '✓', got %s", row[5])
	}

	// Verify cursor is at 0
	if m.transactionsTable.Cursor() != 0 {
		t.Errorf("Expected cursor at 0, got %d", m.transactionsTable.Cursor())
	}
}

// TestUpdateTransactionsTableMultipleTransactions tests updating transactions table with multiple transactions
func TestUpdateTransactionsTableMultipleTransactions(t *testing.T) {
	t.Parallel()

	// Create account manager and chain
	accountMgr, err := accounts.NewManager()
	if err != nil {
		t.Fatalf("Failed to create account manager: %v", err)
	}

	chain := blockchain.NewChain()
	m := Model{
		accountManager:    accountMgr,
		blockchainChain:   chain,
		transactionsTable: tui.CreateTransactionsTable(),
	}

	// Get first account
	accts := accountMgr.GetAllAccounts()
	if len(accts) < 2 {
		t.Fatal("Need at least 2 accounts")
	}

	// Add multiple transactions
	txIDs := []string{}
	for i := 0; i < 3; i++ {
		tx := &types.Transaction{
			ID:          fmt.Sprintf("tx-%d", i),
			Hash:        fmt.Sprintf("0xhash-%d", i),
			BlockNumber: 1,
			From:        accts[0].Address,
			To:          accts[1].Address,
			Value:       big.NewInt(int64(1000 * (i + 1))),
			GasLimit:    1000000,
			GasUsed:     21000,
			CallType:    types.CallTypeCall,
			Status:      i%2 == 0, // Alternate success/failure
			Timestamp:   time.Now(),
		}
		chain.AddTransaction(tx)
		txIDs = append(txIDs, tx.ID)
	}

	// Add block
	chain.AddBlock(txIDs, 63000, accts[0].Address)

	// Update table
	m.updateTransactionsTable()

	// Table should have 3 rows
	rows := m.transactionsTable.Rows()
	if len(rows) != 3 {
		t.Fatalf("Expected 3 rows, got %d", len(rows))
	}

	// Verify alternating success/failure
	for i, row := range rows {
		expectedStatus := "✓"
		if i%2 != 0 {
			expectedStatus = "✗"
		}
		if row[5] != expectedStatus {
			t.Errorf("Row %d: expected status '%s', got '%s'", i, expectedStatus, row[5])
		}
	}
}

// TestUpdateTransactionsTableCreateType tests CREATE transaction display
func TestUpdateTransactionsTableCreateType(t *testing.T) {
	t.Parallel()

	// Create account manager and chain
	accountMgr, err := accounts.NewManager()
	if err != nil {
		t.Fatalf("Failed to create account manager: %v", err)
	}

	chain := blockchain.NewChain()
	m := Model{
		accountManager:    accountMgr,
		blockchainChain:   chain,
		transactionsTable: tui.CreateTransactionsTable(),
	}

	// Get first account
	accts := accountMgr.GetAllAccounts()
	if len(accts) == 0 {
		t.Fatal("No accounts available")
	}

	// Add a CREATE transaction
	tx := &types.Transaction{
		ID:           "tx-create",
		Hash:         "0xhash123",
		BlockNumber:  1,
		From:         accts[0].Address,
		To:           "", // Empty for CREATE
		Value:        big.NewInt(0),
		GasLimit:     1000000,
		GasUsed:      100000,
		CallType:     types.CallTypeCreate,
		Status:       true,
		Timestamp:    time.Now(),
		DeployedAddr: "0xnewcontract123",
	}

	// Add transaction and block
	chain.AddTransaction(tx)
	chain.AddBlock([]string{tx.ID}, 100000, accts[0].Address)

	// Update table
	m.updateTransactionsTable()

	// Table should have 1 row
	rows := m.transactionsTable.Rows()
	if len(rows) != 1 {
		t.Fatalf("Expected 1 row, got %d", len(rows))
	}

	row := rows[0]

	// Check call type
	if row[0] != "CREATE" {
		t.Errorf("Expected call type 'CREATE', got %s", row[0])
	}

	// Check To field (should be "CONTRACT")
	if row[2] != "CONTRACT" {
		t.Errorf("Expected To field 'CONTRACT', got %s", row[2])
	}
}

// TestUpdateTransactionsTableAddressTruncation tests that long addresses are truncated
func TestUpdateTransactionsTableAddressTruncation(t *testing.T) {
	t.Parallel()

	chain := blockchain.NewChain()
	m := Model{
		blockchainChain:   chain,
		transactionsTable: tui.CreateTransactionsTable(),
	}

	// Add a transaction with long addresses
	tx := &types.Transaction{
		ID:          "tx-1",
		Hash:        "0xhash123",
		BlockNumber: 1,
		From:        "0x1234567890abcdef1234567890abcdef12345678", // 42 chars
		To:          "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd", // 42 chars
		Value:       big.NewInt(1000),
		GasLimit:    1000000,
		GasUsed:     21000,
		CallType:    types.CallTypeCall,
		Status:      true,
		Timestamp:   time.Now(),
	}

	// Add transaction and block
	chain.AddTransaction(tx)
	chain.AddBlock([]string{tx.ID}, 21000, "0xminer123")

	// Update table
	m.updateTransactionsTable()

	// Verify address truncation
	rows := m.transactionsTable.Rows()
	if len(rows) != 1 {
		t.Fatalf("Expected 1 row, got %d", len(rows))
	}

	row := rows[0]

	// From field should be truncated (10 chars + "...")
	if len(row[1]) > 13 { // "0x12345678..." = 13 chars
		t.Errorf("From address not truncated properly: %s (len=%d)", row[1], len(row[1]))
	}

	// To field should be truncated (10 chars + "...")
	if len(row[2]) > 13 {
		t.Errorf("To address not truncated properly: %s (len=%d)", row[2], len(row[2]))
	}
}

// TestTableUpdateDoesNotPanic tests that table updates don't panic with nil data
func TestTableUpdateDoesNotPanic(t *testing.T) {
	t.Parallel()

	defer func() {
		if r := recover(); r != nil {
			t.Errorf("Table update panicked: %v", r)
		}
	}()

	// Test with minimal model
	m := Model{
		historyManager:    history.NewHistoryManager(100),
		blockchainChain:   blockchain.NewChain(),
		historyTable:      tui.CreateHistoryTable(),
		contractsTable:    tui.CreateContractsTable(),
		transactionsTable: tui.CreateTransactionsTable(),
	}

	// These should not panic
	m.updateHistoryTable()
	m.updateContractsTable()
	m.updateTransactionsTable()
}

// TestTableCursorReset tests that cursor is reset when table is updated
func TestTableCursorReset(t *testing.T) {
	t.Parallel()

	historyMgr := history.NewHistoryManager(100)
	m := Model{
		historyManager: historyMgr,
		historyTable:   tui.CreateHistoryTable(),
	}

	// Add entries
	for i := 0; i < 5; i++ {
		entry := types.CallHistoryEntry{
			Parameters: types.CallParametersStrings{
				CallType: "CALL",
				Caller:   "0x1234567890123456",
				Target:   "0xabcdefabcdefabcd",
				GasLimit: "1000000",
			},
			Result: &types.CallResult{
				Success: true,
				GasLeft: 500000,
			},
			Timestamp: time.Now(),
		}
		historyMgr.AddCall(entry)
	}

	// Update table (cursor should be reset to 0)
	m.updateHistoryTable()

	if m.historyTable.Cursor() != 0 {
		t.Errorf("Expected cursor to be reset to 0, got %d", m.historyTable.Cursor())
	}
}
