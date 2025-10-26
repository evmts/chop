package state

import (
	"fmt"
	"math/big"

	"chop/core/accounts"
	"chop/types"
)

// Inspector provides methods for inspecting blockchain state.
//
// Storage Limitations:
// Currently, this inspector does not track contract storage slots. The Account type
// has a StorageRoot field (representing the root hash of a storage trie), but the
// actual storage data is not maintained. Storage-related methods (GetStorageAt,
// GetAllStorageSlots) return empty/zero values as placeholders.
//
// To implement storage tracking, the following would be needed:
//   - Add a Storage map[string]string field to the Account type in types/types.go
//   - Implement storage trie or simple key-value storage in the account manager
//   - Integrate with EVM SLOAD/SSTORE operations to persist storage changes
//   - Update the Inspector methods to read from actual storage data
type Inspector struct {
	accountManager *accounts.Manager
}

// NewInspector creates a new state inspector that uses the provided account manager.
// The inspector provides read-only access to account state and storage.
func NewInspector(accountManager *accounts.Manager) *Inspector {
	return &Inspector{
		accountManager: accountManager,
	}
}

// InspectAddress inspects the full state of an address.
//
// Note: Storage slots are not currently tracked. The StorageSlots field will
// always be empty. See the Inspector type documentation for details on the
// storage limitation and what would be required to implement it.
func (i *Inspector) InspectAddress(address string) (*types.AccountState, error) {
	// Get account from manager
	account, err := i.accountManager.GetAccount(address)
	if err != nil {
		return nil, fmt.Errorf("failed to get account: %w", err)
	}

	// Create account state view
	state := &types.AccountState{
		Address:      account.Address,
		Balance:      new(big.Int).Set(account.Balance),
		Nonce:        account.Nonce,
		Code:         account.Code,
		CodeSize:     len(account.Code),
		StorageSlots: make(map[string]string), // Empty - storage not tracked
		IsContract:   len(account.Code) > 0,
	}

	return state, nil
}

// GetBalance returns the balance of an address in wei.
// Returns a new big.Int instance that is safe to modify.
// Returns an error if the account cannot be retrieved.
func (i *Inspector) GetBalance(address string) (*big.Int, error) {
	account, err := i.accountManager.GetAccount(address)
	if err != nil {
		return nil, err
	}

	return new(big.Int).Set(account.Balance), nil
}

// GetNonce returns the transaction nonce of an address.
// The nonce represents the number of transactions sent from this address.
// Returns an error if the account cannot be retrieved.
func (i *Inspector) GetNonce(address string) (uint64, error) {
	account, err := i.accountManager.GetAccount(address)
	if err != nil {
		return 0, err
	}

	return account.Nonce, nil
}

// GetCode returns the contract bytecode at an address.
// Returns nil for externally owned accounts (EOAs) with no code.
// Returns a copy of the code to prevent external modification.
func (i *Inspector) GetCode(address string) ([]byte, error) {
	account, err := i.accountManager.GetAccount(address)
	if err != nil {
		return nil, err
	}

	if len(account.Code) == 0 {
		return nil, nil
	}

	// Return copy to prevent modification
	code := make([]byte, len(account.Code))
	copy(code, account.Code)

	return code, nil
}

// IsContract checks if an address is a contract by examining if it has code.
// Returns true if the address has associated bytecode, false otherwise.
// An account is considered a contract if it has non-empty code.
func (i *Inspector) IsContract(address string) (bool, error) {
	account, err := i.accountManager.GetAccount(address)
	if err != nil {
		return false, err
	}

	return len(account.Code) > 0, nil
}

// GetStorageAt returns the value at a specific storage slot for an address.
//
// Storage Limitation: This method currently returns a zero value for all slots
// because storage is not tracked. Contract storage changes from SSTORE operations
// are not persisted. To implement this, storage would need to be tracked in the
// Account type and updated during EVM execution.
//
// Parameters:
//   - address: The contract address to query
//   - slot: The storage slot key (32-byte hex string)
//
// Returns: Always returns the zero value (32 zero bytes as hex string)
func (i *Inspector) GetStorageAt(address string, slot string) (string, error) {
	// Verify account exists (for consistency with other methods)
	_, err := i.accountManager.GetAccount(address)
	if err != nil {
		return "", fmt.Errorf("failed to get account: %w", err)
	}

	// Storage not tracked - return zero value for all slots
	return "0x0000000000000000000000000000000000000000000000000000000000000000", nil
}

// GetAllStorageSlots returns all non-zero storage slots for an address.
//
// Storage Limitation: This method currently returns an empty map because storage
// is not tracked. In a full implementation, this would traverse the storage trie
// or iterate over stored key-value pairs to return all non-zero storage slots
// for the given contract address.
//
// Parameters:
//   - address: The contract address to query
//
// Returns: Always returns an empty map since storage is not tracked
func (i *Inspector) GetAllStorageSlots(address string) (map[string]string, error) {
	// Verify account exists (for consistency with other methods)
	_, err := i.accountManager.GetAccount(address)
	if err != nil {
		return nil, fmt.Errorf("failed to get account: %w", err)
	}

	// Storage not tracked - return empty map
	return make(map[string]string), nil
}

// FormatBalance formats a balance in wei to ETH with decimal precision.
// Shows up to 2 decimal places if there's a fractional component.
// Returns "0 ETH" for nil input.
func FormatBalance(balance *big.Int) string {
	if balance == nil {
		return "0 ETH"
	}

	// Convert wei to ETH (divide by 10^18)
	divisor := new(big.Int)
	divisor.SetString("1000000000000000000", 10) // 10^18

	eth := new(big.Int).Div(balance, divisor)
	remainder := new(big.Int).Mod(balance, divisor)

	// Format with decimals if there's a remainder
	if remainder.Cmp(big.NewInt(0)) == 0 {
		return fmt.Sprintf("%s ETH", eth.String())
	}

	// Show up to 4 decimal places
	divisorDecimals := new(big.Int)
	divisorDecimals.SetString("10000000000000000", 10) // 10^16 (for 2 decimals)

	decimals := new(big.Int).Div(remainder, divisorDecimals)

	return fmt.Sprintf("%s.%02d ETH", eth.String(), decimals.Int64())
}

// FormatBalanceShort formats a balance in compact form without the "ETH" suffix.
// Shows up to 1 decimal place for fractional ETH amounts.
// Returns "0" for nil input. Useful for space-constrained displays.
func FormatBalanceShort(balance *big.Int) string {
	if balance == nil {
		return "0"
	}

	// Convert wei to ETH
	divisor := new(big.Int)
	divisor.SetString("1000000000000000000", 10)

	eth := new(big.Int).Div(balance, divisor)
	remainder := new(big.Int).Mod(balance, divisor)

	if remainder.Cmp(big.NewInt(0)) == 0 {
		return eth.String()
	}

	// Show 1 decimal place
	divisorDecimals := new(big.Int)
	divisorDecimals.SetString("100000000000000000", 10) // 10^17 (for 1 decimal)

	decimal := new(big.Int).Div(remainder, divisorDecimals)

	return fmt.Sprintf("%s.%d", eth.String(), decimal.Int64())
}
