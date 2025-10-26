package accounts

import (
	"crypto/sha256"
	"fmt"
	"math/big"
	"sync"

	"chop/types"
)

// Manager handles account creation and management
type Manager struct {
	seed     *Seed
	accounts map[string]*types.Account // address -> account
	mu       sync.RWMutex
}

// NewManager creates a new account manager with a generated seed
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

// NewManagerWithSeed creates a new account manager with a specific seed
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

// GetAccount returns an account by address
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

	return account, nil
}

// GetAllAccounts returns all accounts sorted by index
func (m *Manager) GetAllAccounts() []*types.Account {
	m.mu.RLock()
	defer m.mu.RUnlock()

	accounts := make([]*types.Account, 0, len(m.accounts))
	for _, account := range m.accounts {
		accounts = append(accounts, account)
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

// UpdateBalance updates an account's balance
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

// IncrementNonce increments an account's nonce
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

// SetCode sets the code for an account (when deploying a contract)
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

// GetSeedHex returns the seed as a hex string
func (m *Manager) GetSeedHex() string {
	return m.seed.Hex
}

// GetTotalBalance returns the total balance across all accounts
func (m *Manager) GetTotalBalance() *big.Int {
	m.mu.RLock()
	defer m.mu.RUnlock()

	total := big.NewInt(0)
	for _, account := range m.accounts {
		total.Add(total, account.Balance)
	}

	return total
}

// GetAccountCount returns the number of accounts
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

// Transfer transfers value from one account to another
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
