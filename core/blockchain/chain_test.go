package blockchain

import (
	"fmt"
	"math/big"
	"sync"
	"testing"
	"time"

	"chop/types"
)

// TestNewChain verifies that a new chain is created with only the genesis block
func TestNewChain(t *testing.T) {
	t.Parallel()

	chain := NewChain()

	if chain == nil {
		t.Fatal("NewChain returned nil")
	}

	blocks := chain.GetAllBlocks()
	if len(blocks) != 1 {
		t.Errorf("expected 1 block (genesis), got %d", len(blocks))
	}

	genesis := blocks[0]
	if genesis.Number != 0 {
		t.Errorf("expected genesis block number 0, got %d", genesis.Number)
	}

	if genesis.ParentHash != "0x0000000000000000000000000000000000000000000000000000000000000000" {
		t.Errorf("expected genesis parent hash to be zero hash, got %s", genesis.ParentHash)
	}

	if chain.GetGasLimit() != 30000000 {
		t.Errorf("expected gas limit 30000000, got %d", chain.GetGasLimit())
	}
}

// TestAddBlock verifies that blocks are added correctly with proper incrementation
func TestAddBlock(t *testing.T) {
	t.Parallel()

	chain := NewChain()
	initialHeight := chain.GetBlockHeight()

	// Add a block with some transactions
	txIDs := []string{"tx1", "tx2", "tx3"}
	block, err := chain.AddBlock(txIDs, 5000000, "0xminer123")

	if err != nil {
		t.Fatalf("AddBlock failed: %v", err)
	}

	if block == nil {
		t.Fatal("AddBlock returned nil block")
	}

	// Verify block number incremented
	if block.Number != initialHeight+1 {
		t.Errorf("expected block number %d, got %d", initialHeight+1, block.Number)
	}

	// Verify transactions are stored in block
	if len(block.Transactions) != 3 {
		t.Errorf("expected 3 transactions, got %d", len(block.Transactions))
	}

	// Verify gas used
	if block.GasUsed != 5000000 {
		t.Errorf("expected gas used 5000000, got %d", block.GasUsed)
	}

	// Verify miner
	if block.Miner != "0xminer123" {
		t.Errorf("expected miner 0xminer123, got %s", block.Miner)
	}

	// Verify parent hash points to genesis
	genesis, _ := chain.GetBlockByNumber(0)
	if block.ParentHash != genesis.Hash {
		t.Errorf("expected parent hash %s, got %s", genesis.Hash, block.ParentHash)
	}

	// Verify chain height increased
	if chain.GetBlockHeight() != initialHeight+1 {
		t.Errorf("expected chain height %d, got %d", initialHeight+1, chain.GetBlockHeight())
	}

	// Add another block
	block2, err := chain.AddBlock([]string{"tx4"}, 1000000, "0xminer456")
	if err != nil {
		t.Fatalf("AddBlock failed on second call: %v", err)
	}

	if block2.Number != initialHeight+2 {
		t.Errorf("expected second block number %d, got %d", initialHeight+2, block2.Number)
	}

	if block2.ParentHash != block.Hash {
		t.Errorf("expected parent hash of second block to match first block hash")
	}
}

// TestGetBlockByNumber tests retrieving blocks by their number
func TestGetBlockByNumber(t *testing.T) {
	t.Parallel()

	chain := NewChain()

	// Test getting genesis block (0)
	genesis, err := chain.GetBlockByNumber(0)
	if err != nil {
		t.Fatalf("GetBlockByNumber(0) failed: %v", err)
	}
	if genesis.Number != 0 {
		t.Errorf("expected block number 0, got %d", genesis.Number)
	}

	// Add some blocks
	chain.AddBlock([]string{"tx1"}, 1000, "0xminer")
	chain.AddBlock([]string{"tx2"}, 2000, "0xminer")

	// Test getting added blocks
	block1, err := chain.GetBlockByNumber(1)
	if err != nil {
		t.Fatalf("GetBlockByNumber(1) failed: %v", err)
	}
	if block1.Number != 1 {
		t.Errorf("expected block number 1, got %d", block1.Number)
	}

	block2, err := chain.GetBlockByNumber(2)
	if err != nil {
		t.Fatalf("GetBlockByNumber(2) failed: %v", err)
	}
	if block2.Number != 2 {
		t.Errorf("expected block number 2, got %d", block2.Number)
	}

	// Test out of range
	_, err = chain.GetBlockByNumber(100)
	if err == nil {
		t.Error("expected error for out of range block number, got nil")
	}

	// Test boundary: current max block number
	maxBlock := chain.GetBlockHeight()
	_, err = chain.GetBlockByNumber(maxBlock)
	if err != nil {
		t.Errorf("GetBlockByNumber(%d) should succeed: %v", maxBlock, err)
	}

	// Test boundary: one past max
	_, err = chain.GetBlockByNumber(maxBlock + 1)
	if err == nil {
		t.Error("expected error for block number beyond chain height")
	}
}

// TestGetBlockByHash tests retrieving blocks by their hash
func TestGetBlockByHash(t *testing.T) {
	t.Parallel()

	chain := NewChain()

	// Get genesis block hash
	genesis, _ := chain.GetBlockByNumber(0)
	genesisHash := genesis.Hash

	// Test getting genesis by hash
	block, err := chain.GetBlockByHash(genesisHash)
	if err != nil {
		t.Fatalf("GetBlockByHash failed for genesis: %v", err)
	}
	if block.Number != 0 {
		t.Errorf("expected block number 0, got %d", block.Number)
	}

	// Add a block and test retrieval by hash
	chain.AddBlock([]string{"tx1"}, 1000, "0xminer")
	block1, _ := chain.GetBlockByNumber(1)

	foundBlock, err := chain.GetBlockByHash(block1.Hash)
	if err != nil {
		t.Fatalf("GetBlockByHash failed: %v", err)
	}
	if foundBlock.Number != 1 {
		t.Errorf("expected block number 1, got %d", foundBlock.Number)
	}

	// Test with invalid hash
	_, err = chain.GetBlockByHash("0xinvalidhash")
	if err == nil {
		t.Error("expected error for invalid hash, got nil")
	}

	// Test with empty hash
	_, err = chain.GetBlockByHash("")
	if err == nil {
		t.Error("expected error for empty hash, got nil")
	}
}

// TestGetTransactionsByBlock tests the transaction-to-block mapping
func TestGetTransactionsByBlock(t *testing.T) {
	t.Parallel()

	chain := NewChain()

	// Add transactions to the chain
	tx1 := &types.Transaction{
		ID:        "tx1",
		From:      "0xfrom",
		To:        "0xto",
		Value:     big.NewInt(100),
		GasUsed:   21000,
		Status:    true,
		Timestamp: time.Now(),
	}
	tx2 := &types.Transaction{
		ID:        "tx2",
		From:      "0xfrom",
		To:        "0xto",
		Value:     big.NewInt(200),
		GasUsed:   21000,
		Status:    true,
		Timestamp: time.Now(),
	}
	tx3 := &types.Transaction{
		ID:        "tx3",
		From:      "0xfrom",
		To:        "0xto",
		Value:     big.NewInt(300),
		GasUsed:   21000,
		Status:    false,
		Timestamp: time.Now(),
	}

	chain.AddTransaction(tx1)
	chain.AddTransaction(tx2)
	chain.AddTransaction(tx3)

	// Add blocks with transactions
	chain.AddBlock([]string{"tx1", "tx2"}, 42000, "0xminer")
	chain.AddBlock([]string{"tx3"}, 21000, "0xminer")

	// Test getting transactions from block 1
	txsBlock1 := chain.GetTransactionsByBlock(1)
	if len(txsBlock1) != 2 {
		t.Errorf("expected 2 transactions in block 1, got %d", len(txsBlock1))
	}

	// Verify correct transactions are mapped
	foundIDs := make(map[string]bool)
	for _, tx := range txsBlock1 {
		foundIDs[tx.ID] = true
	}
	if !foundIDs["tx1"] || !foundIDs["tx2"] {
		t.Error("block 1 should contain tx1 and tx2")
	}

	// Test getting transactions from block 2
	txsBlock2 := chain.GetTransactionsByBlock(2)
	if len(txsBlock2) != 1 {
		t.Errorf("expected 1 transaction in block 2, got %d", len(txsBlock2))
	}
	if txsBlock2[0].ID != "tx3" {
		t.Errorf("expected tx3 in block 2, got %s", txsBlock2[0].ID)
	}

	// Test block with no transactions (genesis)
	txsGenesis := chain.GetTransactionsByBlock(0)
	if len(txsGenesis) != 0 {
		t.Errorf("expected 0 transactions in genesis block, got %d", len(txsGenesis))
	}

	// Test non-existent block
	txsNonExistent := chain.GetTransactionsByBlock(999)
	if len(txsNonExistent) != 0 {
		t.Errorf("expected 0 transactions for non-existent block, got %d", len(txsNonExistent))
	}
}

// TestGetStats verifies blockchain statistics calculation
func TestGetStats(t *testing.T) {
	t.Parallel()

	chain := NewChain()

	// Initial stats (only genesis block)
	stats := chain.GetStats()
	if stats.BlockHeight != 0 {
		t.Errorf("expected initial block height 0, got %d", stats.BlockHeight)
	}
	if stats.TotalBlocks != 1 {
		t.Errorf("expected 1 total block (genesis), got %d", stats.TotalBlocks)
	}
	if stats.TotalTransactions != 0 {
		t.Errorf("expected 0 transactions, got %d", stats.TotalTransactions)
	}

	// Add successful and failed transactions
	tx1 := &types.Transaction{
		ID:        "tx1",
		Status:    true,
		GasUsed:   21000,
		Timestamp: time.Now(),
	}
	tx2 := &types.Transaction{
		ID:        "tx2",
		Status:    true,
		GasUsed:   50000,
		Timestamp: time.Now(),
	}
	tx3 := &types.Transaction{
		ID:        "tx3",
		Status:    false,
		GasUsed:   10000,
		Timestamp: time.Now(),
	}

	chain.AddTransaction(tx1)
	chain.AddTransaction(tx2)
	chain.AddTransaction(tx3)

	// Add blocks
	chain.AddBlock([]string{"tx1", "tx2"}, 71000, "0xminer")
	chain.AddBlock([]string{"tx3"}, 10000, "0xminer")

	// Get updated stats
	stats = chain.GetStats()

	// Verify block counts
	if stats.BlockHeight != 2 {
		t.Errorf("expected block height 2, got %d", stats.BlockHeight)
	}
	if stats.TotalBlocks != 3 {
		t.Errorf("expected 3 total blocks, got %d", stats.TotalBlocks)
	}

	// Verify transaction counts
	if stats.TotalTransactions != 3 {
		t.Errorf("expected 3 total transactions, got %d", stats.TotalTransactions)
	}
	if stats.SuccessfulTxs != 2 {
		t.Errorf("expected 2 successful transactions, got %d", stats.SuccessfulTxs)
	}
	if stats.FailedTxs != 1 {
		t.Errorf("expected 1 failed transaction, got %d", stats.FailedTxs)
	}

	// Verify gas totals
	expectedGas := uint64(81000) // 21000 + 50000 + 10000
	if stats.TotalGasUsed != expectedGas {
		t.Errorf("expected total gas used %d, got %d", expectedGas, stats.TotalGasUsed)
	}

	// Verify last block time is recent
	if time.Since(stats.LastBlockTime) > time.Second {
		t.Error("last block time should be recent")
	}
}

// TestReset verifies the chain can be reset to genesis state
func TestReset(t *testing.T) {
	t.Parallel()

	chain := NewChain()

	// Add data to the chain
	tx := &types.Transaction{
		ID:        "tx1",
		Status:    true,
		Timestamp: time.Now(),
	}
	chain.AddTransaction(tx)
	chain.AddBlock([]string{"tx1"}, 21000, "0xminer")
	chain.AddBlock([]string{}, 0, "0xminer")

	// Verify chain has data
	if len(chain.GetAllBlocks()) != 3 {
		t.Error("chain should have 3 blocks before reset")
	}
	if chain.GetTransactionCount() != 1 {
		t.Error("chain should have 1 transaction before reset")
	}

	// Reset the chain
	chain.Reset()

	// Verify chain is back to genesis only
	blocks := chain.GetAllBlocks()
	if len(blocks) != 1 {
		t.Errorf("expected 1 block after reset, got %d", len(blocks))
	}

	genesis := blocks[0]
	if genesis.Number != 0 {
		t.Errorf("expected genesis block number 0 after reset, got %d", genesis.Number)
	}

	// Verify transactions are cleared
	if chain.GetTransactionCount() != 0 {
		t.Errorf("expected 0 transactions after reset, got %d", chain.GetTransactionCount())
	}

	// Verify transaction mappings are cleared
	txsInBlock := chain.GetTransactionsByBlock(1)
	if len(txsInBlock) != 0 {
		t.Error("transaction mappings should be cleared after reset")
	}

	// Verify we can add blocks after reset
	_, err := chain.AddBlock([]string{}, 0, "0xminer")
	if err != nil {
		t.Errorf("should be able to add blocks after reset: %v", err)
	}
}

// TestGetLatestBlock verifies retrieval of the most recent block
func TestGetLatestBlock(t *testing.T) {
	t.Parallel()

	chain := NewChain()

	// Initially should return genesis
	latest := chain.GetLatestBlock()
	if latest.Number != 0 {
		t.Errorf("expected genesis block (0), got block %d", latest.Number)
	}

	// Add blocks and verify latest updates
	chain.AddBlock([]string{"tx1"}, 1000, "0xminer")
	latest = chain.GetLatestBlock()
	if latest.Number != 1 {
		t.Errorf("expected block 1, got block %d", latest.Number)
	}

	chain.AddBlock([]string{"tx2"}, 2000, "0xminer")
	latest = chain.GetLatestBlock()
	if latest.Number != 2 {
		t.Errorf("expected block 2, got block %d", latest.Number)
	}

	chain.AddBlock([]string{"tx3"}, 3000, "0xminer")
	latest = chain.GetLatestBlock()
	if latest.Number != 3 {
		t.Errorf("expected block 3, got block %d", latest.Number)
	}
}

// TestGetAllBlocks verifies retrieval of all blocks in order
func TestGetAllBlocks(t *testing.T) {
	t.Parallel()

	chain := NewChain()

	// Initially should have only genesis
	blocks := chain.GetAllBlocks()
	if len(blocks) != 1 {
		t.Errorf("expected 1 block initially, got %d", len(blocks))
	}

	// Add multiple blocks
	chain.AddBlock([]string{"tx1"}, 1000, "0xminer")
	chain.AddBlock([]string{"tx2"}, 2000, "0xminer")
	chain.AddBlock([]string{"tx3"}, 3000, "0xminer")

	blocks = chain.GetAllBlocks()
	if len(blocks) != 4 {
		t.Errorf("expected 4 blocks, got %d", len(blocks))
	}

	// Verify blocks are in order
	for i, block := range blocks {
		if block.Number != uint64(i) {
			t.Errorf("expected block %d at index %d, got block %d", i, i, block.Number)
		}
	}

	// Verify returned slice is a copy (modification doesn't affect chain)
	originalLen := len(chain.GetAllBlocks())
	blocks[0] = nil
	if len(chain.GetAllBlocks()) != originalLen {
		t.Error("modifying returned blocks should not affect chain")
	}
}

// TestGetRecentBlocks tests retrieval of the last N blocks
func TestGetRecentBlocks(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name          string
		totalBlocks   int
		requestCount  int
		expectedCount int
		newestFirst   bool
	}{
		{"zero count", 3, 0, 0, true},
		{"one block", 3, 1, 1, true},
		{"partial blocks", 5, 3, 3, true},
		{"all blocks", 3, 3, 3, true},
		{"more than available", 3, 10, 3, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			chain := NewChain()

			// Add blocks (minus genesis which already exists)
			for i := 1; i < tt.totalBlocks; i++ {
				chain.AddBlock([]string{}, 0, "0xminer")
			}

			recent := chain.GetRecentBlocks(tt.requestCount)

			if len(recent) != tt.expectedCount {
				t.Errorf("expected %d blocks, got %d", tt.expectedCount, len(recent))
			}

			// Verify blocks are newest first
			if len(recent) > 1 {
				if recent[0].Number <= recent[1].Number {
					t.Error("blocks should be ordered newest first")
				}
			}

			// Verify we got the most recent blocks
			if len(recent) > 0 {
				latestBlock := chain.GetLatestBlock()
				if recent[0].Number != latestBlock.Number {
					t.Errorf("first block should be latest, expected %d, got %d",
						latestBlock.Number, recent[0].Number)
				}
			}
		})
	}
}

// TestAddTransaction verifies transactions are stored correctly
func TestAddTransaction(t *testing.T) {
	t.Parallel()

	chain := NewChain()

	tx := &types.Transaction{
		ID:        "tx123",
		From:      "0xfrom",
		To:        "0xto",
		Value:     big.NewInt(1000),
		GasUsed:   21000,
		Status:    true,
		Timestamp: time.Now(),
	}

	err := chain.AddTransaction(tx)
	if err != nil {
		t.Fatalf("AddTransaction failed: %v", err)
	}

	// Verify transaction can be retrieved
	retrieved, err := chain.GetTransaction("tx123")
	if err != nil {
		t.Fatalf("GetTransaction failed: %v", err)
	}

	if retrieved.ID != tx.ID {
		t.Errorf("expected ID %s, got %s", tx.ID, retrieved.ID)
	}

	// Verify transaction count
	if chain.GetTransactionCount() != 1 {
		t.Errorf("expected 1 transaction, got %d", chain.GetTransactionCount())
	}

	// Add more transactions
	tx2 := &types.Transaction{ID: "tx456", Status: true, Timestamp: time.Now()}
	chain.AddTransaction(tx2)

	if chain.GetTransactionCount() != 2 {
		t.Errorf("expected 2 transactions, got %d", chain.GetTransactionCount())
	}
}

// TestGetTransaction tests transaction retrieval
func TestGetTransaction(t *testing.T) {
	t.Parallel()

	chain := NewChain()

	// Add a transaction
	tx := &types.Transaction{
		ID:        "tx999",
		From:      "0xfrom",
		To:        "0xto",
		Status:    true,
		Timestamp: time.Now(),
	}
	chain.AddTransaction(tx)

	// Test successful retrieval
	retrieved, err := chain.GetTransaction("tx999")
	if err != nil {
		t.Fatalf("GetTransaction failed: %v", err)
	}
	if retrieved.ID != "tx999" {
		t.Errorf("expected ID tx999, got %s", retrieved.ID)
	}

	// Test missing transaction
	_, err = chain.GetTransaction("nonexistent")
	if err == nil {
		t.Error("expected error for missing transaction, got nil")
	}

	// Test empty ID
	_, err = chain.GetTransaction("")
	if err == nil {
		t.Error("expected error for empty transaction ID, got nil")
	}
}

// TestGetAllTransactions verifies all transactions are returned sorted
func TestGetAllTransactions(t *testing.T) {
	t.Parallel()

	chain := NewChain()

	// Create transactions with different timestamps
	now := time.Now()
	tx1 := &types.Transaction{ID: "tx1", Timestamp: now.Add(-2 * time.Hour), Status: true}
	tx2 := &types.Transaction{ID: "tx2", Timestamp: now.Add(-1 * time.Hour), Status: true}
	tx3 := &types.Transaction{ID: "tx3", Timestamp: now, Status: true}

	// Add in non-sorted order
	chain.AddTransaction(tx1)
	chain.AddTransaction(tx3)
	chain.AddTransaction(tx2)

	allTxs := chain.GetAllTransactions()

	if len(allTxs) != 3 {
		t.Errorf("expected 3 transactions, got %d", len(allTxs))
	}

	// Verify sorted newest first
	if allTxs[0].ID != "tx3" {
		t.Errorf("expected tx3 first (newest), got %s", allTxs[0].ID)
	}
	if allTxs[1].ID != "tx2" {
		t.Errorf("expected tx2 second, got %s", allTxs[1].ID)
	}
	if allTxs[2].ID != "tx1" {
		t.Errorf("expected tx1 third (oldest), got %s", allTxs[2].ID)
	}

	// Test with empty chain
	emptyChain := NewChain()
	emptyTxs := emptyChain.GetAllTransactions()
	if len(emptyTxs) != 0 {
		t.Errorf("expected 0 transactions in empty chain, got %d", len(emptyTxs))
	}
}

// TestGetRecentTransactions tests retrieval of last N transactions
func TestGetRecentTransactions(t *testing.T) {
	t.Parallel()

	chain := NewChain()

	// Add transactions
	now := time.Now()
	for i := 0; i < 5; i++ {
		tx := &types.Transaction{
			ID:        fmt.Sprintf("tx%d", i),
			Timestamp: now.Add(time.Duration(i) * time.Second),
			Status:    true,
		}
		chain.AddTransaction(tx)
	}

	tests := []struct {
		name          string
		count         int
		expectedCount int
	}{
		{"zero count", 0, 0},
		{"one transaction", 1, 1},
		{"partial transactions", 3, 3},
		{"all transactions", 5, 5},
		{"more than available", 10, 5},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recent := chain.GetRecentTransactions(tt.count)
			if len(recent) != tt.expectedCount {
				t.Errorf("expected %d transactions, got %d", tt.expectedCount, len(recent))
			}
		})
	}

	// Verify most recent transactions come first
	recent := chain.GetRecentTransactions(3)
	if len(recent) > 0 && recent[0].ID != "tx4" {
		t.Errorf("expected most recent tx (tx4), got %s", recent[0].ID)
	}
}

// TestGetGasLimit tests gas limit getter
func TestGetGasLimit(t *testing.T) {
	t.Parallel()

	chain := NewChain()

	gasLimit := chain.GetGasLimit()
	if gasLimit != 30000000 {
		t.Errorf("expected default gas limit 30000000, got %d", gasLimit)
	}
}

// TestSetGasLimit tests gas limit setter
func TestSetGasLimit(t *testing.T) {
	t.Parallel()

	chain := NewChain()

	// Set new gas limit
	newLimit := uint64(15000000)
	chain.SetGasLimit(newLimit)

	gasLimit := chain.GetGasLimit()
	if gasLimit != newLimit {
		t.Errorf("expected gas limit %d, got %d", newLimit, gasLimit)
	}

	// Verify new blocks use the new limit
	block, _ := chain.AddBlock([]string{}, 0, "0xminer")
	if block.GasLimit != newLimit {
		t.Errorf("expected new block to have gas limit %d, got %d", newLimit, block.GasLimit)
	}

	// Test setting to zero (edge case)
	chain.SetGasLimit(0)
	if chain.GetGasLimit() != 0 {
		t.Error("should be able to set gas limit to 0")
	}

	// Test setting to max uint64 (edge case)
	maxGas := uint64(18446744073709551615)
	chain.SetGasLimit(maxGas)
	if chain.GetGasLimit() != maxGas {
		t.Error("should be able to set gas limit to max uint64")
	}
}

// TestConcurrentAccess tests basic goroutine safety
func TestConcurrentAccess(t *testing.T) {
	t.Parallel()

	chain := NewChain()

	// Add initial data
	for i := 0; i < 5; i++ {
		tx := &types.Transaction{
			ID:        fmt.Sprintf("tx%d", i),
			Status:    true,
			Timestamp: time.Now(),
		}
		chain.AddTransaction(tx)
	}

	chain.AddBlock([]string{"tx0", "tx1"}, 42000, "0xminer")

	var wg sync.WaitGroup
	errors := make(chan error, 100)

	// Concurrent readers
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 10; j++ {
				_ = chain.GetLatestBlock()
				_ = chain.GetAllBlocks()
				_ = chain.GetAllTransactions()
				_, _ = chain.GetBlockByNumber(0)
				_ = chain.GetGasLimit()
				_ = chain.GetBlockHeight()
			}
		}()
	}

	// Concurrent writers
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			tx := &types.Transaction{
				ID:        fmt.Sprintf("concurrent_tx%d", id),
				Status:    true,
				Timestamp: time.Now(),
			}
			if err := chain.AddTransaction(tx); err != nil {
				errors <- err
			}

			_, err := chain.AddBlock([]string{}, 0, "0xminer")
			if err != nil {
				errors <- err
			}
		}(i)
	}

	// Wait for all goroutines
	wg.Wait()
	close(errors)

	// Check for errors
	for err := range errors {
		t.Errorf("concurrent operation failed: %v", err)
	}

	// Verify chain is in valid state
	blocks := chain.GetAllBlocks()
	if len(blocks) == 0 {
		t.Error("chain should have blocks after concurrent operations")
	}

	// Verify blocks are properly ordered
	for i := 0; i < len(blocks)-1; i++ {
		if blocks[i].Number >= blocks[i+1].Number {
			t.Error("blocks should be in ascending order by number")
		}
	}
}

// TestGetBlockHeight tests block height retrieval
func TestGetBlockHeight(t *testing.T) {
	t.Parallel()

	chain := NewChain()

	// Genesis block (height 0)
	if chain.GetBlockHeight() != 0 {
		t.Errorf("expected initial height 0, got %d", chain.GetBlockHeight())
	}

	// Add blocks and verify height increments
	chain.AddBlock([]string{}, 0, "0xminer")
	if chain.GetBlockHeight() != 1 {
		t.Errorf("expected height 1, got %d", chain.GetBlockHeight())
	}

	chain.AddBlock([]string{}, 0, "0xminer")
	if chain.GetBlockHeight() != 2 {
		t.Errorf("expected height 2, got %d", chain.GetBlockHeight())
	}

	chain.AddBlock([]string{}, 0, "0xminer")
	if chain.GetBlockHeight() != 3 {
		t.Errorf("expected height 3, got %d", chain.GetBlockHeight())
	}
}

// TestGetTransactionCount tests transaction count retrieval
func TestGetTransactionCount(t *testing.T) {
	t.Parallel()

	chain := NewChain()

	// Initial count should be 0
	if chain.GetTransactionCount() != 0 {
		t.Errorf("expected initial count 0, got %d", chain.GetTransactionCount())
	}

	// Add transactions and verify count
	for i := 1; i <= 5; i++ {
		tx := &types.Transaction{
			ID:        fmt.Sprintf("tx%d", i),
			Status:    true,
			Timestamp: time.Now(),
		}
		chain.AddTransaction(tx)

		if chain.GetTransactionCount() != i {
			t.Errorf("expected count %d, got %d", i, chain.GetTransactionCount())
		}
	}
}
