package blockchain

import (
	"fmt"
	"math/big"
	"sync"

	"chop/types"
)

// Chain manages the blockchain state
type Chain struct {
	blocks       []*types.Block
	transactions map[string]*types.Transaction // txID -> transaction
	txToBlock    map[string]uint64             // txID -> block number
	gasLimit     uint64
	mu           sync.RWMutex
}

// NewChain creates a new blockchain with genesis block
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

// GetLatestBlock returns the most recent block
func (c *Chain) GetLatestBlock() *types.Block {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if len(c.blocks) == 0 {
		return nil
	}

	return c.blocks[len(c.blocks)-1]
}

// GetBlockByNumber returns a block by its number
func (c *Chain) GetBlockByNumber(number uint64) (*types.Block, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if number >= uint64(len(c.blocks)) {
		return nil, fmt.Errorf("block %d not found", number)
	}

	return c.blocks[number], nil
}

// GetBlockByHash returns a block by its hash
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

// GetAllBlocks returns all blocks in order
func (c *Chain) GetAllBlocks() []*types.Block {
	c.mu.RLock()
	defer c.mu.RUnlock()

	// Return a copy to prevent external modification
	blocks := make([]*types.Block, len(c.blocks))
	copy(blocks, c.blocks)

	return blocks
}

// GetRecentBlocks returns the last N blocks
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

// AddBlock adds a new block to the chain
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

// AddTransaction adds a transaction to the chain
func (c *Chain) AddTransaction(tx *types.Transaction) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.transactions[tx.ID] = tx

	return nil
}

// GetTransaction returns a transaction by ID
func (c *Chain) GetTransaction(txID string) (*types.Transaction, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	tx, exists := c.transactions[txID]
	if !exists {
		return nil, fmt.Errorf("transaction %s not found", txID)
	}

	return tx, nil
}

// GetAllTransactions returns all transactions
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

// GetRecentTransactions returns the last N transactions
func (c *Chain) GetRecentTransactions(count int) []*types.Transaction {
	allTxs := c.GetAllTransactions()

	if count > len(allTxs) {
		count = len(allTxs)
	}

	return allTxs[:count]
}

// GetTransactionsByBlock returns all transactions in a block
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

// GetStats returns blockchain statistics
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

// GetBlockHeight returns the current block height
func (c *Chain) GetBlockHeight() uint64 {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if len(c.blocks) == 0 {
		return 0
	}

	return c.blocks[len(c.blocks)-1].Number
}

// GetTransactionCount returns the total number of transactions
func (c *Chain) GetTransactionCount() int {
	c.mu.RLock()
	defer c.mu.RUnlock()

	return len(c.transactions)
}

// GetGasLimit returns the gas limit for new blocks
func (c *Chain) GetGasLimit() uint64 {
	c.mu.RLock()
	defer c.mu.RUnlock()

	return c.gasLimit
}

// SetGasLimit sets the gas limit for new blocks
func (c *Chain) SetGasLimit(gasLimit uint64) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.gasLimit = gasLimit
}

// Reset resets the blockchain to genesis state
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
