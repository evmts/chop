// Package fork provides state forking support for Chop.
// Forking allows connecting to a remote Ethereum node (mainnet, testnet, etc.)
// and creating a local overlay state that can be modified while falling back
// to the remote node for missing data.
//
// NOTE: This is currently a placeholder implementation. Full forking support
// requires updates to guillotine and guillotine-mini. See:
// - guillotine-mini PR for forking support
// - This package will be completed once the underlying EVM supports forking
package fork

import (
	"errors"
	"math/big"
	"sync"
)

var (
	// ErrForkingNotSupported is returned when forking operations are attempted
	// but the underlying EVM does not yet support state forking
	ErrForkingNotSupported = errors.New("forking is not yet supported: guillotine and guillotine-mini need to implement forking first")

	// ErrInvalidForkURL is returned when an invalid RPC URL is provided
	ErrInvalidForkURL = errors.New("invalid fork URL")

	// ErrForkConnectionFailed is returned when connection to the fork URL fails
	ErrForkConnectionFailed = errors.New("failed to connect to fork URL")
)

// Config represents the configuration for state forking
type Config struct {
	// URL is the RPC endpoint to fork from (e.g., https://eth-mainnet.g.alchemy.com/v2/...)
	URL string

	// BlockNumber is the specific block number to fork from
	// If 0, forks from the latest block
	BlockNumber uint64

	// CacheSize is the maximum number of cached state entries
	CacheSize int
}

// Forker manages state forking and provides an overlay state system
type Forker struct {
	config Config
	mu     sync.RWMutex

	// TODO: Add cache for fetched state
	// cache map[string]interface{}

	// TODO: Add RPC client
	// client *rpc.Client
}

// NewForker creates a new Forker instance
//
// NOTE: Currently returns an error indicating forking is not yet supported.
// This function signature is provided for future implementation.
func NewForker(config Config) (*Forker, error) {
	// Validate config
	if config.URL == "" {
		return nil, ErrInvalidForkURL
	}

	// TODO: Validate URL format
	// TODO: Connect to RPC endpoint
	// TODO: Fetch fork block data

	return nil, ErrForkingNotSupported
}

// GetBalance retrieves the balance of an account, falling back to the fork if not found locally
//
// TODO: Implement once EVM forking support is available
func (f *Forker) GetBalance(address string) (*big.Int, error) {
	return nil, ErrForkingNotSupported
}

// GetCode retrieves the code at an address, falling back to the fork if not found locally
//
// TODO: Implement once EVM forking support is available
func (f *Forker) GetCode(address string) ([]byte, error) {
	return nil, ErrForkingNotSupported
}

// GetStorageAt retrieves storage at a specific slot, falling back to the fork if not found locally
//
// TODO: Implement once EVM forking support is available
func (f *Forker) GetStorageAt(address string, slot *big.Int) (*big.Int, error) {
	return nil, ErrForkingNotSupported
}

// GetNonce retrieves the nonce of an account, falling back to the fork if not found locally
//
// TODO: Implement once EVM forking support is available
func (f *Forker) GetNonce(address string) (uint64, error) {
	return 0, ErrForkingNotSupported
}

// GetBlock retrieves block data from the fork
//
// TODO: Implement once EVM forking support is available
func (f *Forker) GetBlock(blockNumber uint64) (interface{}, error) {
	return nil, ErrForkingNotSupported
}

// GetForkInfo returns information about the current fork
func (f *Forker) GetForkInfo() *ForkInfo {
	if f == nil {
		return nil
	}

	f.mu.RLock()
	defer f.mu.RUnlock()

	return &ForkInfo{
		URL:         f.config.URL,
		BlockNumber: f.config.BlockNumber,
		CacheSize:   f.config.CacheSize,
		// TODO: Add cache stats
		CacheHits:   0,
		CacheMisses: 0,
	}
}

// ClearCache clears the forked state cache
//
// TODO: Implement once caching is added
func (f *Forker) ClearCache() error {
	return ErrForkingNotSupported
}

// ForkInfo contains information about the active fork
type ForkInfo struct {
	URL         string
	BlockNumber uint64
	CacheSize   int
	CacheHits   uint64
	CacheMisses uint64
}
