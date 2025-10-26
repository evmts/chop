package blockchain

import (
	"fmt"
	"math/big"
	"sync"

	"chop/types"
)

// Chain manages the blockchain state including blocks, transactions, and their relationships.
// It provides thread-safe access to blockchain data and maintains indices for efficient lookups.
// Chain is safe for concurrent use.
type Chain struct {
	blocks       []*types.Block
	transactions map[string]*types.Transaction // txID -> transaction
	txToBlock    map[string]uint64             // txID -> block number
	gasLimit     uint64
	mu           sync.RWMutex
}

// NewChain creates a new blockchain initialized with a genesis block.
// The genesis block is automatically added as block 0.
// Default gas limit is set to 30M (similar to Ganache).
func NewChain() *Chain {
	c := &Chain{
		blocks:       []*types.Block{},
		transactions: make(map[string]*types.Transaction),
		txToBlock:    make(map[string]uint64),
		gasLimit:     30000000, // 30M gas limit (like Ganache)
	}

	// Create and add genesis block
	genesis := CreateGenesisBlock()
	c.blocks = append(c.blocks, genesis)

	return c
}

// GetLatestBlock returns the most recently added block in the chain.
// Returns nil if the chain is empty (though this should never happen after initialization).
// This method is safe for concurrent use.
func (c *Chain) GetLatestBlock() *types.Block {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if len(c.blocks) == 0 {
		return nil
	}

	return c.blocks[len(c.blocks)-1]
}

// GetBlockByNumber returns a block by its block number.
// Block numbers start at 0 (genesis block) and increment sequentially.
// Returns an error if the block number does not exist in the chain.
// This method is safe for concurrent use.
func (c *Chain) GetBlockByNumber(number uint64) (*types.Block, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if number >= uint64(len(c.blocks)) {
		return nil, fmt.Errorf("block %d not found", number)
	}

	return c.blocks[number], nil
}

// GetBlockByHash returns a block by its hash value.
// The hash lookup requires scanning all blocks, so GetBlockByNumber is more efficient when possible.
// Returns an error if no block with the specified hash is found.
// This method is safe for concurrent use.
func (c *Chain) GetBlockByHash(hash string) (*types.Block, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	for _, block := range c.blocks {
		if block.Hash == hash {
			return block, nil
		}
	}

	return nil, fmt.Errorf("block with hash %s not found", hash)
}

// GetAllBlocks returns a copy of all blocks in the chain in chronological order.
// The returned slice is a copy and safe to modify without affecting the chain.
// This method is safe for concurrent use.
func (c *Chain) GetAllBlocks() []*types.Block {
	c.mu.RLock()
	defer c.mu.RUnlock()

	// Return a copy to prevent external modification
	blocks := make([]*types.Block, len(c.blocks))
	copy(blocks, c.blocks)

	return blocks
}

// GetRecentBlocks returns the most recent N blocks in reverse chronological order (newest first).
// If count exceeds the total number of blocks, all blocks are returned.
// This is useful for displaying recent blockchain activity.
// This method is safe for concurrent use.
func (c *Chain) GetRecentBlocks(count int) []*types.Block {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if count > len(c.blocks) {
		count = len(c.blocks)
	}

	start := len(c.blocks) - count
	blocks := make([]*types.Block, count)
	copy(blocks, c.blocks[start:])

	// Reverse to show newest first
	for i := 0; i < len(blocks)/2; i++ {
		blocks[i], blocks[len(blocks)-1-i] = blocks[len(blocks)-1-i], blocks[i]
	}

	return blocks
}

// AddBlock creates and adds a new block to the chain with the specified transactions.
// The block is automatically linked to the previous block via parent hash.
// Block number is auto-incremented and the block hash is calculated automatically.
// Transaction-to-block mappings are updated for efficient transaction lookups.
// This method is safe for concurrent use.
func (c *Chain) AddBlock(transactions []string, gasUsed uint64, miner string) (*types.Block, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	latest := c.blocks[len(c.blocks)-1]

	// Create new block
	newBlock := CreateBlock(
		latest.Number+1,
		latest.Hash,
		transactions,
		gasUsed,
		c.gasLimit,
		miner,
	)

	// Add block to chain
	c.blocks = append(c.blocks, newBlock)

	// Update transaction -> block mapping
	for _, txID := range transactions {
		c.txToBlock[txID] = newBlock.Number
	}

	return newBlock, nil
}

// AddTransaction adds a transaction to the chain's transaction store.
// Transactions are stored separately from blocks for efficient lookup by transaction ID.
// This method is safe for concurrent use.
func (c *Chain) AddTransaction(tx *types.Transaction) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.transactions[tx.ID] = tx

	return nil
}

// GetTransaction returns a transaction by its unique transaction ID.
// Returns an error if the transaction is not found in the chain.
// This method is safe for concurrent use.
func (c *Chain) GetTransaction(txID string) (*types.Transaction, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	tx, exists := c.transactions[txID]
	if !exists {
		return nil, fmt.Errorf("transaction %s not found", txID)
	}

	return tx, nil
}

// GetAllTransactions returns all transactions in the chain sorted by timestamp (newest first).
// The returned slice contains pointers to transaction objects.
// This method is safe for concurrent use.
func (c *Chain) GetAllTransactions() []*types.Transaction {
	c.mu.RLock()
	defer c.mu.RUnlock()

	txs := make([]*types.Transaction, 0, len(c.transactions))
	for _, tx := range c.transactions {
		txs = append(txs, tx)
	}

	// Sort by timestamp (newest first)
	for i := 0; i < len(txs); i++ {
		for j := i + 1; j < len(txs); j++ {
			if txs[i].Timestamp.Before(txs[j].Timestamp) {
				txs[i], txs[j] = txs[j], txs[i]
			}
		}
	}

	return txs
}

// GetRecentTransactions returns the most recent N transactions sorted by timestamp.
// If count exceeds the total number of transactions, all transactions are returned.
// This method is safe for concurrent use.
func (c *Chain) GetRecentTransactions(count int) []*types.Transaction {
	allTxs := c.GetAllTransactions()

	if count > len(allTxs) {
		count = len(allTxs)
	}

	return allTxs[:count]
}

// GetTransactionsByBlock returns all transactions included in a specific block.
// Returns an empty slice if the block has no transactions or doesn't exist.
// This method is safe for concurrent use.
func (c *Chain) GetTransactionsByBlock(blockNumber uint64) []*types.Transaction {
	c.mu.RLock()
	defer c.mu.RUnlock()

	txs := []*types.Transaction{}

	for txID, blkNum := range c.txToBlock {
		if blkNum == blockNumber {
			if tx, exists := c.transactions[txID]; exists {
				txs = append(txs, tx)
			}
		}
	}

	return txs
}

// GetStats returns comprehensive blockchain statistics including block and transaction counts,
// gas usage, and success/failure rates. This is useful for dashboard displays and monitoring.
// This method is safe for concurrent use.
func (c *Chain) GetStats() *types.BlockchainStats {
	c.mu.RLock()
	defer c.mu.RUnlock()

	stats := &types.BlockchainStats{
		BlockHeight:       uint64(len(c.blocks) - 1), // Exclude genesis
		TotalBlocks:       uint64(len(c.blocks)),
		TotalTransactions: uint64(len(c.transactions)),
		SuccessfulTxs:     0,
		FailedTxs:         0,
		TotalGasUsed:      0,
		TotalBalance:      big.NewInt(0),
	}

	// Count successful/failed transactions and total gas
	for _, tx := range c.transactions {
		if tx.Status {
			stats.SuccessfulTxs++
		} else {
			stats.FailedTxs++
		}
		stats.TotalGasUsed += tx.GasUsed
	}

	// Get last block time
	if len(c.blocks) > 0 {
		stats.LastBlockTime = c.blocks[len(c.blocks)-1].Timestamp
	}

	return stats
}

// GetBlockHeight returns the current block height (the block number of the latest block).
// The block height starts at 0 for the genesis block.
// This method is safe for concurrent use.
func (c *Chain) GetBlockHeight() uint64 {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if len(c.blocks) == 0 {
		return 0
	}

	return c.blocks[len(c.blocks)-1].Number
}

// GetTransactionCount returns the total number of transactions in the chain.
// This includes both successful and failed transactions.
// This method is safe for concurrent use.
func (c *Chain) GetTransactionCount() int {
	c.mu.RLock()
	defer c.mu.RUnlock()

	return len(c.transactions)
}

// GetGasLimit returns the gas limit used for new blocks.
// This represents the maximum gas that can be consumed by all transactions in a single block.
// This method is safe for concurrent use.
func (c *Chain) GetGasLimit() uint64 {
	c.mu.RLock()
	defer c.mu.RUnlock()

	return c.gasLimit
}

// SetGasLimit sets the gas limit for new blocks.
// This affects all blocks created after this call.
// This method is safe for concurrent use.
func (c *Chain) SetGasLimit(gasLimit uint64) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.gasLimit = gasLimit
}

// Reset resets the blockchain to its initial state with only the genesis block.
// All blocks except genesis and all transactions are removed.
// This is useful for testing or starting fresh without creating a new Chain instance.
// This method is safe for concurrent use.
func (c *Chain) Reset() {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Clear everything
	c.blocks = []*types.Block{}
	c.transactions = make(map[string]*types.Transaction)
	c.txToBlock = make(map[string]uint64)

	// Add genesis block
	genesis := CreateGenesisBlock()
	c.blocks = append(c.blocks, genesis)
}
