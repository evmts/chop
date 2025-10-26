// Package accounts provides Ethereum account management with deterministic key derivation from a seed.
// It supports creating and managing test accounts similar to Ganache, with pre-funded balances
// and automatic address generation.
package accounts

import (
	"crypto/sha256"
	"fmt"
	"math/big"
	"sync"

	"chop/types"
)

// Manager manages a collection of Ethereum accounts with deterministic key derivation.
// It maintains account state including balances, nonces, and contract code.
// Manager is safe for concurrent use.
type Manager struct {
	seed     *Seed
	accounts map[string]*types.Account // address -> account
	mu       sync.RWMutex
}

// NewManager creates a new account manager with a randomly generated seed.
// It automatically generates 10 pre-funded test accounts with 100 ETH each.
// Returns an error if seed generation or account creation fails.
func NewManager() (*Manager, error) {
	seed, err := GenerateSeed()
	if err != nil {
		return nil, err
	}

	m := &Manager{
		seed:     seed,
		accounts: make(map[string]*types.Account),
	}

	// Generate 10 pre-funded test accounts (like Ganache)
	if err := m.generateTestAccounts(10); err != nil {
		return nil, err
	}

	return m, nil
}

// NewManagerWithSeed creates a new account manager with a specific seed provided as a hex string.
// The seed must be a valid 32-byte hex string (with or without 0x prefix).
// It automatically generates 10 pre-funded test accounts from the seed.
// Returns an error if the seed is invalid or account creation fails.
func NewManagerWithSeed(seedHex string) (*Manager, error) {
	seed, err := SeedFromHex(seedHex)
	if err != nil {
		return nil, err
	}

	m := &Manager{
		seed:     seed,
		accounts: make(map[string]*types.Account),
	}

	// Generate 10 pre-funded test accounts
	if err := m.generateTestAccounts(10); err != nil {
		return nil, err
	}

	return m, nil
}

// generateTestAccounts creates pre-funded test accounts
func (m *Manager) generateTestAccounts(count int) error {
	// Default balance: 100 ETH in wei (100 * 10^18)
	defaultBalance := new(big.Int)
	defaultBalance.SetString("100000000000000000000", 10) // 100 ETH

	for i := 0; i < count; i++ {
		privateKey := m.seed.DerivePrivateKey(i)
		address := DeriveAddress(privateKey)

		account := &types.Account{
			Address:     address,
			Balance:     new(big.Int).Set(defaultBalance),
			Nonce:       0,
			Code:        nil,
			CodeHash:    "0x0000000000000000000000000000000000000000000000000000000000000000",
			StorageRoot: "0x0000000000000000000000000000000000000000000000000000000000000000",
			PrivateKey:  FormatPrivateKey(privateKey),
			Index:       i + 1, // 1-indexed for display
		}

		m.accounts[address] = account
	}

	return nil
}

// GetAccount returns a copy of the account with the given address.
// If the account does not exist, it returns a new empty account with zero balance.
// The returned account is a deep copy and safe to modify without affecting internal state.
func (m *Manager) GetAccount(address string) (*types.Account, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	account, exists := m.accounts[address]
	if !exists {
		// Create a new empty account
		return &types.Account{
			Address:     address,
			Balance:     big.NewInt(0),
			Nonce:       0,
			Code:        nil,
			CodeHash:    "0x0000000000000000000000000000000000000000000000000000000000000000",
			StorageRoot: "0x0000000000000000000000000000000000000000000000000000000000000000",
			PrivateKey:  "",
			Index:       0,
		}, nil
	}

	// Return a deep copy to prevent external modification of internal state
	accountCopy := &types.Account{
		Index:       account.Index,
		Address:     account.Address,
		PrivateKey:  account.PrivateKey,
		Balance:     new(big.Int).Set(account.Balance),
		Nonce:       account.Nonce,
		CodeHash:    account.CodeHash,
		StorageRoot: account.StorageRoot,
	}

	// Deep copy the Code byte slice if it exists
	if len(account.Code) > 0 {
		accountCopy.Code = make([]byte, len(account.Code))
		copy(accountCopy.Code, account.Code)
	}

	return accountCopy, nil
}

// GetAllAccounts returns deep copies of all accounts sorted by their index.
// Pre-funded test accounts (with index > 0) are returned first, sorted by index.
// Returns a slice of account pointers in ascending index order.
// Each account is a deep copy and safe to modify without affecting internal state.
func (m *Manager) GetAllAccounts() []*types.Account {
	m.mu.RLock()
	defer m.mu.RUnlock()

	accounts := make([]*types.Account, 0, len(m.accounts))
	for _, account := range m.accounts {
		// Create a deep copy to prevent external modification of internal state
		accountCopy := &types.Account{
			Index:       account.Index,
			Address:     account.Address,
			PrivateKey:  account.PrivateKey,
			Balance:     new(big.Int).Set(account.Balance),
			Nonce:       account.Nonce,
			CodeHash:    account.CodeHash,
			StorageRoot: account.StorageRoot,
		}

		// Deep copy the Code byte slice if it exists
		if len(account.Code) > 0 {
			accountCopy.Code = make([]byte, len(account.Code))
			copy(accountCopy.Code, account.Code)
		}

		accounts = append(accounts, accountCopy)
	}

	// Sort by index (pre-funded accounts first)
	for i := 0; i < len(accounts); i++ {
		for j := i + 1; j < len(accounts); j++ {
			if accounts[i].Index > accounts[j].Index {
				accounts[i], accounts[j] = accounts[j], accounts[i]
			}
		}
	}

	return accounts
}

// UpdateBalance updates an account's balance to the specified value.
// If the account does not exist, it creates a new account with the given balance.
// The balance parameter is copied to prevent external modification.
// This method is safe for concurrent use.
func (m *Manager) UpdateBalance(address string, balance *big.Int) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	account, exists := m.accounts[address]
	if !exists {
		// Create new account if it doesn't exist
		account = &types.Account{
			Address:     address,
			Balance:     new(big.Int).Set(balance),
			Nonce:       0,
			Code:        nil,
			CodeHash:    "0x0000000000000000000000000000000000000000000000000000000000000000",
			StorageRoot: "0x0000000000000000000000000000000000000000000000000000000000000000",
			PrivateKey:  "",
			Index:       0,
		}
		m.accounts[address] = account
		return nil
	}

	account.Balance = new(big.Int).Set(balance)
	return nil
}

// IncrementNonce increments an account's nonce by one.
// The nonce represents the number of transactions sent from the account.
// Returns an error if the account does not exist.
// This method is safe for concurrent use.
func (m *Manager) IncrementNonce(address string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	account, exists := m.accounts[address]
	if !exists {
		return fmt.Errorf("account not found: %s", address)
	}

	account.Nonce++
	return nil
}

// SetCode sets the bytecode for an account, converting it into a contract account.
// If the account does not exist, it creates a new contract account with nonce 1.
// The code hash is automatically calculated and stored.
// This method is typically called during contract deployment.
// This method is safe for concurrent use.
func (m *Manager) SetCode(address string, code []byte) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	account, exists := m.accounts[address]
	if !exists {
		// Create new contract account
		account = &types.Account{
			Address:     address,
			Balance:     big.NewInt(0),
			Nonce:       1, // Contract accounts start with nonce 1
			Code:        code,
			CodeHash:    "0x" + fmt.Sprintf("%x", hashData(code)),
			StorageRoot: "0x0000000000000000000000000000000000000000000000000000000000000000",
			PrivateKey:  "",
			Index:       0,
		}
		m.accounts[address] = account
		return nil
	}

	account.Code = code
	account.CodeHash = "0x" + fmt.Sprintf("%x", hashData(code))
	return nil
}

// GetSeedHex returns the manager's seed as a hex string.
// This seed can be used to recreate the same set of accounts deterministically.
// The returned string does not include a "0x" prefix.
func (m *Manager) GetSeedHex() string {
	return m.seed.Hex
}

// GetTotalBalance returns the sum of balances across all accounts.
// This is useful for tracking total value in the system.
// The returned value is a new big.Int instance.
// This method is safe for concurrent use.
func (m *Manager) GetTotalBalance() *big.Int {
	m.mu.RLock()
	defer m.mu.RUnlock()

	total := big.NewInt(0)
	for _, account := range m.accounts {
		total.Add(total, account.Balance)
	}

	return total
}

// GetAccountCount returns the total number of accounts managed by this Manager.
// This includes both pre-funded test accounts and any accounts created during execution.
// This method is safe for concurrent use.
func (m *Manager) GetAccountCount() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.accounts)
}

// hashData is a helper function for computing sha256 hashes
func hashData(data []byte) []byte {
	h := sha256.New()
	h.Write(data)
	return h.Sum(nil)
}

// Transfer transfers value from one account to another.
// It checks that the sender has sufficient balance before executing the transfer.
// If the recipient account does not exist, it is automatically created.
// Returns an error if the sender account is not found or has insufficient balance.
// This method is safe for concurrent use.
func (m *Manager) Transfer(from, to string, value *big.Int) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	fromAccount, exists := m.accounts[from]
	if !exists {
		return fmt.Errorf("sender account not found: %s", from)
	}

	// Check sufficient balance
	if fromAccount.Balance.Cmp(value) < 0 {
		return fmt.Errorf("insufficient balance")
	}

	// Get or create recipient account
	toAccount, exists := m.accounts[to]
	if !exists {
		toAccount = &types.Account{
			Address:     to,
			Balance:     big.NewInt(0),
			Nonce:       0,
			Code:        nil,
			CodeHash:    "0x0000000000000000000000000000000000000000000000000000000000000000",
			StorageRoot: "0x0000000000000000000000000000000000000000000000000000000000000000",
			PrivateKey:  "",
			Index:       0,
		}
		m.accounts[to] = toAccount
	}

	// Perform transfer
	fromAccount.Balance = new(big.Int).Sub(fromAccount.Balance, value)
	toAccount.Balance = new(big.Int).Add(toAccount.Balance, value)

	return nil
}
