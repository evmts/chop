package history

import (
	"chop/types"
	"fmt"
	"sync"
)

// HistoryManager manages call history and contract state
type HistoryManager struct {
	calls     []types.CallHistoryEntry
	contracts map[string]*types.Contract
	maxSize   int
	mu        sync.RWMutex
	nextID    int
}

// NewHistoryManager creates a new history manager
func NewHistoryManager(maxSize int) *HistoryManager {
	return &HistoryManager{
		calls:     make([]types.CallHistoryEntry, 0),
		contracts: make(map[string]*types.Contract),
		maxSize:   maxSize,
		nextID:    1,
	}
}

// AddCall adds a new call to the history
func (hm *HistoryManager) AddCall(entry types.CallHistoryEntry) {
	hm.mu.Lock()
	defer hm.mu.Unlock()

	// Assign ID
	entry.ID = fmt.Sprintf("%d", hm.nextID)
	hm.nextID++

	hm.calls = append(hm.calls, entry)

	// Trim if exceeds max size
	if len(hm.calls) > hm.maxSize {
		hm.calls = hm.calls[1:]
	}

	// Track deployed contracts
	if entry.Result != nil && entry.Result.DeployedAddr != "" {
		hm.contracts[entry.Result.DeployedAddr] = &types.Contract{
			Address:   entry.Result.DeployedAddr,
			Bytecode:  entry.Result.ReturnData,
			Timestamp: entry.Timestamp,
		}
	}
}

// GetAllCalls returns all calls in history
func (hm *HistoryManager) GetAllCalls() []types.CallHistoryEntry {
	hm.mu.RLock()
	defer hm.mu.RUnlock()

	// Return a copy to avoid race conditions
	result := make([]types.CallHistoryEntry, len(hm.calls))
	copy(result, hm.calls)
	return result
}

// GetCall returns a specific call by ID
func (hm *HistoryManager) GetCall(id string) *types.CallHistoryEntry {
	hm.mu.RLock()
	defer hm.mu.RUnlock()

	for i := range hm.calls {
		if hm.calls[i].ID == id {
			return &hm.calls[i]
		}
	}
	return nil
}

// GetContracts returns all deployed contracts
func (hm *HistoryManager) GetContracts() []types.Contract {
	hm.mu.RLock()
	defer hm.mu.RUnlock()

	result := make([]types.Contract, 0, len(hm.contracts))
	for _, contract := range hm.contracts {
		result = append(result, *contract)
	}
	return result
}

// GetContract returns a specific contract by address
func (hm *HistoryManager) GetContract(address string) *types.Contract {
	hm.mu.RLock()
	defer hm.mu.RUnlock()

	return hm.contracts[address]
}

// Clear clears all history
func (hm *HistoryManager) Clear() {
	hm.mu.Lock()
	defer hm.mu.Unlock()

	hm.calls = make([]types.CallHistoryEntry, 0)
	hm.contracts = make(map[string]*types.Contract)
	hm.nextID = 1
}
