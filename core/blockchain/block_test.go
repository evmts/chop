package blockchain

import (
	"strings"
	"testing"
	"time"
	"unicode/utf8"

	"chop/types"
)

// TestCreateGenesisBlock verifies genesis block creation
func TestCreateGenesisBlock(t *testing.T) {
	t.Parallel()

	genesis := CreateGenesisBlock()

	if genesis == nil {
		t.Fatal("CreateGenesisBlock returned nil")
	}

	// Verify block number is 0
	if genesis.Number != 0 {
		t.Errorf("expected genesis block number 0, got %d", genesis.Number)
	}

	// Verify parent hash is zero hash
	expectedParentHash := "0x0000000000000000000000000000000000000000000000000000000000000000"
	if genesis.ParentHash != expectedParentHash {
		t.Errorf("expected parent hash %s, got %s", expectedParentHash, genesis.ParentHash)
	}

	// Verify miner is zero address
	expectedMiner := "0x0000000000000000000000000000000000000000"
	if genesis.Miner != expectedMiner {
		t.Errorf("expected miner %s, got %s", expectedMiner, genesis.Miner)
	}

	// Verify gas used is 0
	if genesis.GasUsed != 0 {
		t.Errorf("expected gas used 0, got %d", genesis.GasUsed)
	}

	// Verify gas limit
	if genesis.GasLimit != 30000000 {
		t.Errorf("expected gas limit 30000000, got %d", genesis.GasLimit)
	}

	// Verify no transactions
	if len(genesis.Transactions) != 0 {
		t.Errorf("expected 0 transactions, got %d", len(genesis.Transactions))
	}

	// Verify hash is calculated and not empty
	if genesis.Hash == "" {
		t.Error("genesis hash should not be empty")
	}

	// Verify hash starts with 0x
	if !strings.HasPrefix(genesis.Hash, "0x") {
		t.Error("genesis hash should start with 0x")
	}

	// Verify timestamp is recent
	if time.Since(genesis.Timestamp) > time.Second {
		t.Error("genesis timestamp should be recent")
	}

	// Verify state root is set
	expectedStateRoot := "0x0000000000000000000000000000000000000000000000000000000000000000"
	if genesis.StateRoot != expectedStateRoot {
		t.Errorf("expected state root %s, got %s", expectedStateRoot, genesis.StateRoot)
	}

	// Verify size is 0 (no transactions)
	if genesis.Size != 0 {
		t.Errorf("expected size 0, got %d", genesis.Size)
	}
}

// TestCreateBlock verifies block creation with various inputs
func TestCreateBlock(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name         string
		number       uint64
		parentHash   string
		transactions []string
		gasUsed      uint64
		gasLimit     uint64
		miner        string
	}{
		{
			name:         "basic block",
			number:       1,
			parentHash:   "0xparent123",
			transactions: []string{"tx1", "tx2"},
			gasUsed:      42000,
			gasLimit:     30000000,
			miner:        "0xminer123",
		},
		{
			name:         "block with no transactions",
			number:       2,
			parentHash:   "0xparent456",
			transactions: []string{},
			gasUsed:      0,
			gasLimit:     30000000,
			miner:        "0xminer456",
		},
		{
			name:         "block with many transactions",
			number:       3,
			parentHash:   "0xparent789",
			transactions: []string{"tx1", "tx2", "tx3", "tx4", "tx5"},
			gasUsed:      105000,
			gasLimit:     30000000,
			miner:        "0xminer789",
		},
		{
			name:         "block at max gas",
			number:       4,
			parentHash:   "0xparentabc",
			transactions: []string{"tx1"},
			gasUsed:      30000000,
			gasLimit:     30000000,
			miner:        "0xminerabc",
		},
		{
			name:         "block number zero",
			number:       0,
			parentHash:   "0x0000",
			transactions: []string{},
			gasUsed:      0,
			gasLimit:     15000000,
			miner:        "0x0000",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			block := CreateBlock(
				tt.number,
				tt.parentHash,
				tt.transactions,
				tt.gasUsed,
				tt.gasLimit,
				tt.miner,
			)

			if block == nil {
				t.Fatal("CreateBlock returned nil")
			}

			// Verify all fields are set correctly
			if block.Number != tt.number {
				t.Errorf("expected number %d, got %d", tt.number, block.Number)
			}

			if block.ParentHash != tt.parentHash {
				t.Errorf("expected parent hash %s, got %s", tt.parentHash, block.ParentHash)
			}

			if len(block.Transactions) != len(tt.transactions) {
				t.Errorf("expected %d transactions, got %d", len(tt.transactions), len(block.Transactions))
			}

			for i, txID := range tt.transactions {
				if block.Transactions[i] != txID {
					t.Errorf("transaction %d: expected %s, got %s", i, txID, block.Transactions[i])
				}
			}

			if block.GasUsed != tt.gasUsed {
				t.Errorf("expected gas used %d, got %d", tt.gasUsed, block.GasUsed)
			}

			if block.GasLimit != tt.gasLimit {
				t.Errorf("expected gas limit %d, got %d", tt.gasLimit, block.GasLimit)
			}

			if block.Miner != tt.miner {
				t.Errorf("expected miner %s, got %s", tt.miner, block.Miner)
			}

			// Verify hash is calculated
			if block.Hash == "" {
				t.Error("block hash should not be empty")
			}

			if !strings.HasPrefix(block.Hash, "0x") {
				t.Error("block hash should start with 0x")
			}

			// Verify timestamp is recent
			if time.Since(block.Timestamp) > time.Second {
				t.Error("block timestamp should be recent")
			}

			// Verify size calculation
			expectedSize := uint64(500) + uint64(len(tt.transactions))*200
			if block.Size != expectedSize {
				t.Errorf("expected size %d, got %d", expectedSize, block.Size)
			}
		})
	}
}

// TestCalculateBlockHash verifies deterministic hash calculation
func TestCalculateBlockHash(t *testing.T) {
	t.Parallel()

	// Create a block with fixed timestamp for deterministic testing
	fixedTime := time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC)

	block := &types.Block{
		Number:       1,
		ParentHash:   "0xparent",
		StateRoot:    "0xstate",
		Timestamp:    fixedTime,
		GasUsed:      21000,
		GasLimit:     30000000,
		Transactions: []string{"tx1", "tx2"},
		Miner:        "0xminer",
	}

	// Calculate hash multiple times
	hash1 := CalculateBlockHash(block)
	hash2 := CalculateBlockHash(block)

	// Verify deterministic (same input = same hash)
	if hash1 != hash2 {
		t.Error("CalculateBlockHash should be deterministic")
	}

	// Verify hash format
	if !strings.HasPrefix(hash1, "0x") {
		t.Error("hash should start with 0x")
	}

	// Verify hash length (0x + 64 hex characters)
	if len(hash1) != 66 {
		t.Errorf("expected hash length 66, got %d", len(hash1))
	}

	// Verify changing any field changes the hash
	modifiedBlock := *block
	modifiedBlock.Number = 2
	hash3 := CalculateBlockHash(&modifiedBlock)
	if hash3 == hash1 {
		t.Error("changing block number should change hash")
	}

	modifiedBlock = *block
	modifiedBlock.ParentHash = "0xdifferent"
	hash4 := CalculateBlockHash(&modifiedBlock)
	if hash4 == hash1 {
		t.Error("changing parent hash should change hash")
	}

	modifiedBlock = *block
	modifiedBlock.Transactions = []string{"tx3"}
	hash5 := CalculateBlockHash(&modifiedBlock)
	if hash5 == hash1 {
		t.Error("changing transactions should change hash")
	}

	modifiedBlock = *block
	modifiedBlock.Timestamp = fixedTime.Add(time.Second)
	hash6 := CalculateBlockHash(&modifiedBlock)
	if hash6 == hash1 {
		t.Error("changing timestamp should change hash")
	}

	modifiedBlock = *block
	modifiedBlock.GasUsed = 42000
	hash7 := CalculateBlockHash(&modifiedBlock)
	if hash7 == hash1 {
		t.Error("changing gas used should change hash")
	}

	// Verify empty transaction list
	emptyBlock := &types.Block{
		Number:       1,
		ParentHash:   "0xparent",
		StateRoot:    "0xstate",
		Timestamp:    fixedTime,
		GasUsed:      0,
		GasLimit:     30000000,
		Transactions: []string{},
		Miner:        "0xminer",
	}
	emptyHash := CalculateBlockHash(emptyBlock)
	if !strings.HasPrefix(emptyHash, "0x") || len(emptyHash) != 66 {
		t.Error("hash for block with no transactions should still be valid")
	}
}

// TestFormatBlockHash tests hash formatting and truncation
func TestFormatBlockHash(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		hash     string
		expected string
	}{
		{
			name:     "full hash",
			hash:     "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
			expected: "0x1234...cdef",
		},
		{
			name:     "short hash",
			hash:     "0x123",
			expected: "0x123",
		},
		{
			name:     "exactly 10 characters",
			hash:     "0x12345678",
			expected: "0x1234...5678",
		},
		{
			name:     "empty hash",
			hash:     "",
			expected: "",
		},
		{
			name:     "hash without 0x",
			hash:     "1234567890abcdef",
			expected: "123456...cdef",
		},
		{
			name:     "minimum truncatable length",
			hash:     "0x12345678901",
			expected: "0x1234...8901",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := FormatBlockHash(tt.hash)
			if result != tt.expected {
				t.Errorf("expected %s, got %s", tt.expected, result)
			}
		})
	}

	// Verify format always includes beginning and end
	longHash := "0x" + strings.Repeat("a", 64)
	formatted := FormatBlockHash(longHash)
	if !strings.HasPrefix(formatted, "0xaaaa") {
		t.Error("formatted hash should start with first characters")
	}
	if !strings.HasSuffix(formatted, "aaaa") {
		t.Error("formatted hash should end with last characters")
	}
	if !strings.Contains(formatted, "...") {
		t.Error("formatted hash should contain ellipsis")
	}
}

// TestFormatTimestamp tests relative timestamp formatting
func TestFormatTimestamp(t *testing.T) {
	t.Parallel()

	now := time.Now()

	tests := []struct {
		name      string
		timestamp time.Time
		contains  string
	}{
		{
			name:      "just now",
			timestamp: now.Add(-5 * time.Second),
			contains:  "s ago",
		},
		{
			name:      "30 seconds ago",
			timestamp: now.Add(-30 * time.Second),
			contains:  "s ago",
		},
		{
			name:      "1 minute ago",
			timestamp: now.Add(-1 * time.Minute),
			contains:  "m ago",
		},
		{
			name:      "30 minutes ago",
			timestamp: now.Add(-30 * time.Minute),
			contains:  "m ago",
		},
		{
			name:      "1 hour ago",
			timestamp: now.Add(-1 * time.Hour),
			contains:  "h ago",
		},
		{
			name:      "12 hours ago",
			timestamp: now.Add(-12 * time.Hour),
			contains:  "h ago",
		},
		{
			name:      "1 day ago",
			timestamp: now.Add(-24 * time.Hour),
			contains:  "2", // Should show date format
		},
		{
			name:      "1 week ago",
			timestamp: now.Add(-7 * 24 * time.Hour),
			contains:  "-", // Date format contains dashes
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := FormatTimestamp(tt.timestamp)
			if !strings.Contains(result, tt.contains) {
				t.Errorf("expected result to contain %s, got %s", tt.contains, result)
			}
		})
	}

	// Test specific formatting for each range
	t.Run("seconds format", func(t *testing.T) {
		ts := now.Add(-45 * time.Second)
		result := FormatTimestamp(ts)
		if !strings.HasSuffix(result, "s ago") {
			t.Errorf("expected 's ago' suffix, got %s", result)
		}
	})

	t.Run("minutes format", func(t *testing.T) {
		ts := now.Add(-45 * time.Minute)
		result := FormatTimestamp(ts)
		if !strings.HasSuffix(result, "m ago") {
			t.Errorf("expected 'm ago' suffix, got %s", result)
		}
	})

	t.Run("hours format", func(t *testing.T) {
		ts := now.Add(-12 * time.Hour)
		result := FormatTimestamp(ts)
		if !strings.HasSuffix(result, "h ago") {
			t.Errorf("expected 'h ago' suffix, got %s", result)
		}
	})

	t.Run("date format", func(t *testing.T) {
		ts := time.Date(2024, 6, 15, 10, 30, 0, 0, time.UTC)
		result := FormatTimestamp(ts)
		// Should be in format "2006-01-02 15:04:05"
		if !strings.Contains(result, "2024-06-15") {
			t.Errorf("expected date format with '2024-06-15', got %s", result)
		}
		if !strings.Contains(result, "10:30") {
			t.Errorf("expected time format with '10:30', got %s", result)
		}
	})

	// Edge case: exact boundaries
	t.Run("exactly 60 seconds", func(t *testing.T) {
		ts := now.Add(-60 * time.Second)
		result := FormatTimestamp(ts)
		if !strings.HasSuffix(result, "m ago") {
			t.Errorf("60 seconds should be formatted as minutes, got %s", result)
		}
	})

	t.Run("exactly 60 minutes", func(t *testing.T) {
		ts := now.Add(-60 * time.Minute)
		result := FormatTimestamp(ts)
		if !strings.HasSuffix(result, "h ago") {
			t.Errorf("60 minutes should be formatted as hours, got %s", result)
		}
	})

	t.Run("exactly 24 hours", func(t *testing.T) {
		ts := now.Add(-24 * time.Hour)
		result := FormatTimestamp(ts)
		// Should switch to date format
		if strings.HasSuffix(result, "h ago") {
			t.Errorf("24 hours should be formatted as date, got %s", result)
		}
	})
}

// TestFormatGasUsage tests gas usage percentage and progress bar
func TestFormatGasUsage(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name               string
		gasUsed            uint64
		gasLimit           uint64
		expectedPercentage float64
		expectedFilled     int
	}{
		{
			name:               "0% usage",
			gasUsed:            0,
			gasLimit:           30000000,
			expectedPercentage: 0,
			expectedFilled:     0,
		},
		{
			name:               "25% usage",
			gasUsed:            7500000,
			gasLimit:           30000000,
			expectedPercentage: 25,
			expectedFilled:     2, // 25/10 = 2.5, rounds to 2
		},
		{
			name:               "50% usage",
			gasUsed:            15000000,
			gasLimit:           30000000,
			expectedPercentage: 50,
			expectedFilled:     5,
		},
		{
			name:               "75% usage",
			gasUsed:            22500000,
			gasLimit:           30000000,
			expectedPercentage: 75,
			expectedFilled:     7,
		},
		{
			name:               "100% usage",
			gasUsed:            30000000,
			gasLimit:           30000000,
			expectedPercentage: 100,
			expectedFilled:     10,
		},
		{
			name:               "over 100% usage",
			gasUsed:            35000000,
			gasLimit:           30000000,
			expectedPercentage: 116.67,
			expectedFilled:     10, // Capped at 10
		},
		{
			name:               "zero gas limit",
			gasUsed:            10000,
			gasLimit:           0,
			expectedPercentage: 0,
			expectedFilled:     0,
		},
		{
			name:               "1% usage",
			gasUsed:            300000,
			gasLimit:           30000000,
			expectedPercentage: 1,
			expectedFilled:     0, // 1/10 = 0.1, rounds to 0
		},
		{
			name:               "99% usage",
			gasUsed:            29700000,
			gasLimit:           30000000,
			expectedPercentage: 99,
			expectedFilled:     9, // 99/10 = 9.9, rounds to 9
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			percentage, bar := FormatGasUsage(tt.gasUsed, tt.gasLimit)

			// Verify percentage (allow small floating point difference)
			if percentage < tt.expectedPercentage-0.1 || percentage > tt.expectedPercentage+0.1 {
				t.Errorf("expected percentage ~%.2f, got %.2f", tt.expectedPercentage, percentage)
			}

			// Verify bar is 10 characters (count runes, not bytes)
			if utf8.RuneCountInString(bar) != 10 {
				t.Errorf("expected bar length 10, got %d", utf8.RuneCountInString(bar))
			}

			// Count filled blocks (▓)
			filledCount := strings.Count(bar, "▓")
			if filledCount != tt.expectedFilled {
				t.Errorf("expected %d filled blocks, got %d (bar: %s)", tt.expectedFilled, filledCount, bar)
			}

			// Count empty blocks (░)
			emptyCount := strings.Count(bar, "░")
			expectedEmpty := 10 - tt.expectedFilled
			if emptyCount != expectedEmpty {
				t.Errorf("expected %d empty blocks, got %d (bar: %s)", expectedEmpty, emptyCount, bar)
			}

			// Verify total is exactly 10
			if filledCount+emptyCount != 10 {
				t.Errorf("total blocks should be 10, got %d (bar: %s)", filledCount+emptyCount, bar)
			}

			// Verify filled blocks come before empty blocks
			if filledCount > 0 && emptyCount > 0 {
				firstEmpty := strings.Index(bar, "░")
				lastFilled := strings.LastIndex(bar, "▓")
				if lastFilled > firstEmpty {
					t.Error("filled blocks should come before empty blocks")
				}
			}
		})
	}

	// Test specific bar patterns
	t.Run("empty bar pattern", func(t *testing.T) {
		_, bar := FormatGasUsage(0, 30000000)
		expected := "░░░░░░░░░░"
		if bar != expected {
			t.Errorf("expected %s, got %s", expected, bar)
		}
	})

	t.Run("full bar pattern", func(t *testing.T) {
		_, bar := FormatGasUsage(30000000, 30000000)
		expected := "▓▓▓▓▓▓▓▓▓▓"
		if bar != expected {
			t.Errorf("expected %s, got %s", expected, bar)
		}
	})

	t.Run("half bar pattern", func(t *testing.T) {
		_, bar := FormatGasUsage(15000000, 30000000)
		expected := "▓▓▓▓▓░░░░░"
		if bar != expected {
			t.Errorf("expected %s, got %s", expected, bar)
		}
	})
}

// TestCalculateBlockSize tests block size estimation
func TestCalculateBlockSize(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name         string
		transactions []string
		expectedSize uint64
	}{
		{
			name:         "no transactions",
			transactions: []string{},
			expectedSize: 500, // Base size only
		},
		{
			name:         "one transaction",
			transactions: []string{"tx1"},
			expectedSize: 700, // 500 + 1*200
		},
		{
			name:         "five transactions",
			transactions: []string{"tx1", "tx2", "tx3", "tx4", "tx5"},
			expectedSize: 1500, // 500 + 5*200
		},
		{
			name:         "ten transactions",
			transactions: []string{"tx1", "tx2", "tx3", "tx4", "tx5", "tx6", "tx7", "tx8", "tx9", "tx10"},
			expectedSize: 2500, // 500 + 10*200
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Use CreateBlock to test the size calculation indirectly
			block := CreateBlock(1, "0xparent", tt.transactions, 0, 30000000, "0xminer")
			if block.Size != tt.expectedSize {
				t.Errorf("expected size %d, got %d", tt.expectedSize, block.Size)
			}
		})
	}
}

// TestMultipleGenesisBlocks verifies each genesis is independent
func TestMultipleGenesisBlocks(t *testing.T) {
	t.Parallel()

	// Create multiple genesis blocks
	genesis1 := CreateGenesisBlock()
	time.Sleep(time.Millisecond) // Ensure different timestamps
	genesis2 := CreateGenesisBlock()

	// They should have different timestamps
	if genesis1.Timestamp.Equal(genesis2.Timestamp) {
		t.Error("different genesis blocks should have different timestamps")
	}

	// They should have different hashes (due to timestamp)
	if genesis1.Hash == genesis2.Hash {
		t.Error("different genesis blocks should have different hashes")
	}

	// But same structure otherwise
	if genesis1.Number != genesis2.Number {
		t.Error("genesis blocks should have same number")
	}
	if genesis1.ParentHash != genesis2.ParentHash {
		t.Error("genesis blocks should have same parent hash")
	}
}

// TestBlockIntegrity verifies block chain integrity
func TestBlockIntegrity(t *testing.T) {
	t.Parallel()

	// Create a small blockchain manually
	genesis := CreateGenesisBlock()

	block1 := CreateBlock(1, genesis.Hash, []string{"tx1"}, 21000, 30000000, "0xminer1")
	block2 := CreateBlock(2, block1.Hash, []string{"tx2"}, 42000, 30000000, "0xminer2")
	block3 := CreateBlock(3, block2.Hash, []string{"tx3"}, 63000, 30000000, "0xminer3")

	// Verify chain integrity
	blocks := []*types.Block{genesis, block1, block2, block3}

	for i := 1; i < len(blocks); i++ {
		if blocks[i].ParentHash != blocks[i-1].Hash {
			t.Errorf("block %d parent hash doesn't match previous block hash", i)
		}
		if blocks[i].Number != blocks[i-1].Number+1 {
			t.Errorf("block %d number not properly incremented", i)
		}
	}
}
