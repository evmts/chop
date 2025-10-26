package state

import (
	"fmt"
	"math/big"

	"chop/core/accounts"
	"chop/types"
)

// Inspector provides methods for inspecting blockchain state
type Inspector struct {
	accountManager *accounts.Manager
	// In a full implementation, this would also have access to:
	// - Storage trie
	// - Contract storage
	// - EVM state
}

// NewInspector creates a new state inspector
func NewInspector(accountManager *accounts.Manager) *Inspector {
	return &Inspector{
		accountManager: accountManager,
	}
}

// InspectAddress inspects the full state of an address
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
		StorageSlots: make(map[string]string),
		IsContract:   len(account.Code) > 0,
	}

	// TODO: In a full implementation, fetch storage slots from state trie
	// For now, return empty storage
	// This would typically involve:
	// 1. Fetching storage root from account
	// 2. Traversing storage trie
	// 3. Collecting non-zero storage slots

	return state, nil
}

// GetBalance returns the balance of an address
func (i *Inspector) GetBalance(address string) (*big.Int, error) {
	account, err := i.accountManager.GetAccount(address)
	if err != nil {
		return nil, err
	}

	return new(big.Int).Set(account.Balance), nil
}

// GetNonce returns the nonce of an address
func (i *Inspector) GetNonce(address string) (uint64, error) {
	account, err := i.accountManager.GetAccount(address)
	if err != nil {
		return 0, err
	}

	return account.Nonce, nil
}

// GetCode returns the bytecode at an address
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

// IsContract checks if an address is a contract
func (i *Inspector) IsContract(address string) (bool, error) {
	account, err := i.accountManager.GetAccount(address)
	if err != nil {
		return false, err
	}

	return len(account.Code) > 0, nil
}

// GetStorageAt returns the value at a specific storage slot (stubbed)
func (i *Inspector) GetStorageAt(address string, slot string) (string, error) {
	// TODO: Implement storage slot lookup
	// This would involve:
	// 1. Getting account storage root
	// 2. Looking up slot in storage trie
	// 3. Returning value

	// For now, return zero value
	return "0x0000000000000000000000000000000000000000000000000000000000000000", nil
}

// GetAllStorageSlots returns all non-zero storage slots for an address (stubbed)
func (i *Inspector) GetAllStorageSlots(address string) (map[string]string, error) {
	// TODO: Implement full storage enumeration
	// This would involve traversing the entire storage trie for the account

	// For now, return empty map
	return make(map[string]string), nil
}

// FormatBalance formats a balance in wei to ETH with proper formatting
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

// FormatBalanceShort formats a balance in a compact form
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
