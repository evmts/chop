// Package blockchain provides core blockchain functionality including block creation and management.
// It handles block hashing, genesis block creation, and utility functions for block display.
package blockchain

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"chop/types"
)

// CreateGenesisBlock creates the initial block (block 0) of the blockchain.
// The genesis block has no parent hash and serves as the foundation for all subsequent blocks.
// It is initialized with a zero hash parent, 30M gas limit, and no transactions.
func CreateGenesisBlock() *types.Block {
	now := time.Now()

	genesisBlock := &types.Block{
		Number:       0,
		Hash:         "",
		ParentHash:   "0x0000000000000000000000000000000000000000000000000000000000000000",
		Timestamp:    now,
		GasUsed:      0,
		GasLimit:     30000000, // 30M gas limit like Ganache
		Transactions: []string{},
		Miner:        "0x0000000000000000000000000000000000000000",
		StateRoot:    "0x0000000000000000000000000000000000000000000000000000000000000000",
		Size:         0,
	}

	// Calculate genesis block hash
	genesisBlock.Hash = CalculateBlockHash(genesisBlock)

	return genesisBlock
}

// CreateBlock creates a new block with the specified parameters.
// The block hash is automatically calculated from the block's contents.
// The block size is estimated based on the number of transactions.
func CreateBlock(number uint64, parentHash string, transactions []string, gasUsed, gasLimit uint64, miner string) *types.Block {
	block := &types.Block{
		Number:       number,
		Hash:         "",
		ParentHash:   parentHash,
		Timestamp:    time.Now(),
		GasUsed:      gasUsed,
		GasLimit:     gasLimit,
		Transactions: transactions,
		Miner:        miner,
		StateRoot:    "0x0000000000000000000000000000000000000000000000000000000000000000",
		Size:         calculateBlockSize(transactions),
	}

	// Calculate block hash
	block.Hash = CalculateBlockHash(block)

	return block
}

// CalculateBlockHash calculates the SHA256 hash of a block.
// The hash is computed from the block number, parent hash, state root, timestamp, gas parameters,
// and all transaction IDs. Returns the hash as a hex string with "0x" prefix.
func CalculateBlockHash(block *types.Block) string {
	// Create a string representation of the block for hashing
	data := fmt.Sprintf(
		"%d%s%s%d%d%d",
		block.Number,
		block.ParentHash,
		block.StateRoot,
		block.Timestamp.Unix(),
		block.GasUsed,
		block.GasLimit,
	)

	// Add transaction IDs to the hash
	for _, txID := range block.Transactions {
		data += txID
	}

	// Calculate SHA256 hash
	hash := sha256.Sum256([]byte(data))
	return "0x" + hex.EncodeToString(hash[:])
}

// calculateBlockSize estimates the size of a block in bytes
func calculateBlockSize(transactions []string) uint64 {
	// Simplified size calculation
	// Block header ~= 500 bytes + transactions
	baseSize := uint64(500)
	txSize := uint64(len(transactions)) * 200 // Assume ~200 bytes per tx reference

	return baseSize + txSize
}

// FormatBlockHash formats a block hash for compact display by showing only the first and last characters.
// Returns the hash in format "0xABCD...WXYZ" for easier reading in UI.
// If the hash is shorter than 10 characters, it is returned unchanged.
func FormatBlockHash(hash string) string {
	if len(hash) < 10 {
		return hash
	}
	return hash[:6] + "..." + hash[len(hash)-4:]
}

// FormatTimestamp formats a timestamp as a relative time string ("5s ago", "3m ago", etc.).
// For times more than 24 hours ago, returns an absolute timestamp.
// This is useful for displaying block times in a user-friendly way.
func FormatTimestamp(t time.Time) string {
	duration := time.Since(t)

	if duration.Seconds() < 60 {
		return fmt.Sprintf("%.0fs ago", duration.Seconds())
	} else if duration.Minutes() < 60 {
		return fmt.Sprintf("%.0fm ago", duration.Minutes())
	} else if duration.Hours() < 24 {
		return fmt.Sprintf("%.0fh ago", duration.Hours())
	}

	return t.Format("2006-01-02 15:04:05")
}

// FormatGasUsage formats gas usage as a percentage and a 10-character visual progress bar.
// Returns both the percentage value and a string representation using block characters.
// The progress bar uses "▓" for filled portions and "░" for empty portions.
func FormatGasUsage(gasUsed, gasLimit uint64) (percentage float64, bar string) {
	if gasLimit == 0 {
		return 0, "░░░░░░░░░░"
	}

	percentage = float64(gasUsed) / float64(gasLimit) * 100

	// Create a 10-character progress bar
	filled := int(percentage / 10)
	if filled > 10 {
		filled = 10
	}

	bar = ""
	for i := 0; i < filled; i++ {
		bar += "▓"
	}
	for i := filled; i < 10; i++ {
		bar += "░"
	}

	return percentage, bar
}
