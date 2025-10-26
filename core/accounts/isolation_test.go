package accounts

import (
	"math/big"
	"testing"
)

// TestGetAccountReturnsDeepCopy verifies that GetAccount returns a deep copy
// and modifications to the returned account don't affect internal state
func TestGetAccountReturnsDeepCopy(t *testing.T) {
	t.Parallel()

	m, err := NewManager()
	if err != nil {
		t.Fatalf("NewManager() failed: %v", err)
	}

	accounts := m.GetAllAccounts()
	addr := accounts[0].Address

	// Get the original account data
	account1, _ := m.GetAccount(addr)
	originalBalance := new(big.Int).Set(account1.Balance)
	originalNonce := account1.Nonce
	originalIndex := account1.Index

	// Modify all mutable fields in the returned account
	account1.Balance.SetInt64(99999)
	account1.Nonce = 123456
	account1.Index = 999
	account1.PrivateKey = "modified"
	account1.Address = "0xmodified"
	account1.CodeHash = "modified"
	account1.StorageRoot = "modified"

	// Get the account again and verify internal state wasn't modified
	account2, _ := m.GetAccount(addr)

	if account2.Balance.Cmp(originalBalance) != 0 {
		t.Errorf("Balance was modified in internal state: expected %s, got %s",
			originalBalance.String(), account2.Balance.String())
	}

	if account2.Nonce != originalNonce {
		t.Errorf("Nonce was modified in internal state: expected %d, got %d",
			originalNonce, account2.Nonce)
	}

	if account2.Index != originalIndex {
		t.Errorf("Index was modified in internal state: expected %d, got %d",
			originalIndex, account2.Index)
	}

	if account2.Address != addr {
		t.Errorf("Address was modified in internal state: expected %s, got %s",
			addr, account2.Address)
	}
}

// TestGetAccountCodeIsolation verifies that the Code byte slice is properly isolated
func TestGetAccountCodeIsolation(t *testing.T) {
	t.Parallel()

	m, err := NewManager()
	if err != nil {
		t.Fatalf("NewManager() failed: %v", err)
	}

	// Create a contract account with code
	contractAddr := "0xabcdef1234567890abcdef1234567890abcdef12"
	originalCode := []byte{0x60, 0x80, 0x60, 0x40, 0x52, 0x60, 0x00}
	err = m.SetCode(contractAddr, originalCode)
	if err != nil {
		t.Fatalf("SetCode() failed: %v", err)
	}

	// Get the account and modify the Code slice
	account, _ := m.GetAccount(contractAddr)
	if len(account.Code) != len(originalCode) {
		t.Fatalf("Code length mismatch: expected %d, got %d",
			len(originalCode), len(account.Code))
	}

	// Modify the returned code bytes
	for i := range account.Code {
		account.Code[i] = 0xFF
	}

	// Get the account again and verify the code wasn't modified
	account2, _ := m.GetAccount(contractAddr)
	for i, b := range originalCode {
		if account2.Code[i] != b {
			t.Errorf("Code byte %d was modified in internal state: expected %x, got %x",
				i, b, account2.Code[i])
		}
	}
}

// TestGetAllAccountsReturnsDeepCopies verifies that GetAllAccounts returns deep copies
func TestGetAllAccountsReturnsDeepCopies(t *testing.T) {
	t.Parallel()

	m, err := NewManager()
	if err != nil {
		t.Fatalf("NewManager() failed: %v", err)
	}

	// Get all accounts
	accounts := m.GetAllAccounts()
	if len(accounts) == 0 {
		t.Fatal("No accounts returned")
	}

	// Store original values
	originalBalances := make([]*big.Int, len(accounts))
	for i, acc := range accounts {
		originalBalances[i] = new(big.Int).Set(acc.Balance)
	}

	// Modify all returned accounts
	for _, acc := range accounts {
		acc.Balance.SetInt64(88888)
		acc.Nonce = 77777
		acc.Index = 66666
	}

	// Get all accounts again and verify nothing was modified
	accounts2 := m.GetAllAccounts()
	for i, acc := range accounts2 {
		if acc.Balance.Cmp(originalBalances[i]) != 0 {
			t.Errorf("Account %d balance was modified: expected %s, got %s",
				i, originalBalances[i].String(), acc.Balance.String())
		}
		if acc.Nonce != 0 {
			t.Errorf("Account %d nonce was modified: expected 0, got %d", i, acc.Nonce)
		}
		expectedIndex := i + 1
		if acc.Index != expectedIndex {
			t.Errorf("Account %d index was modified: expected %d, got %d",
				i, expectedIndex, acc.Index)
		}
	}
}

// TestGetAllAccountsCodeIsolation verifies that Code slices are isolated in GetAllAccounts
func TestGetAllAccountsCodeIsolation(t *testing.T) {
	t.Parallel()

	m, err := NewManager()
	if err != nil {
		t.Fatalf("NewManager() failed: %v", err)
	}

	// Create multiple contract accounts with different code
	contractAddr1 := "0x1111111111111111111111111111111111111111"
	contractAddr2 := "0x2222222222222222222222222222222222222222"
	code1 := []byte{0x60, 0x80}
	code2 := []byte{0x60, 0x40, 0x52}

	err = m.SetCode(contractAddr1, code1)
	if err != nil {
		t.Fatalf("SetCode() failed: %v", err)
	}

	err = m.SetCode(contractAddr2, code2)
	if err != nil {
		t.Fatalf("SetCode() failed: %v", err)
	}

	// Get all accounts
	accounts := m.GetAllAccounts()

	// Find and modify the contract accounts
	for _, acc := range accounts {
		if acc.Address == contractAddr1 && len(acc.Code) > 0 {
			// Modify the code
			for i := range acc.Code {
				acc.Code[i] = 0xFF
			}
		}
		if acc.Address == contractAddr2 && len(acc.Code) > 0 {
			// Modify the code
			for i := range acc.Code {
				acc.Code[i] = 0xEE
			}
		}
	}

	// Get the accounts again and verify code wasn't modified
	account1, _ := m.GetAccount(contractAddr1)
	account2, _ := m.GetAccount(contractAddr2)

	for i, b := range code1 {
		if account1.Code[i] != b {
			t.Errorf("Contract 1 code byte %d was modified: expected %x, got %x",
				i, b, account1.Code[i])
		}
	}

	for i, b := range code2 {
		if account2.Code[i] != b {
			t.Errorf("Contract 2 code byte %d was modified: expected %x, got %x",
				i, b, account2.Code[i])
		}
	}
}

// TestMultipleGetAccountCallsReturnIndependentCopies verifies that each call
// to GetAccount returns a new independent copy
func TestMultipleGetAccountCallsReturnIndependentCopies(t *testing.T) {
	t.Parallel()

	m, err := NewManager()
	if err != nil {
		t.Fatalf("NewManager() failed: %v", err)
	}

	accounts := m.GetAllAccounts()
	addr := accounts[0].Address

	// Get the same account twice
	account1, _ := m.GetAccount(addr)
	account2, _ := m.GetAccount(addr)

	// Modify account1
	account1.Balance.SetInt64(11111)
	account1.Nonce = 999

	// Verify account2 was not affected
	if account2.Balance.Int64() == 11111 {
		t.Error("Modifying one returned account affected another returned account - they share memory")
	}

	if account2.Nonce == 999 {
		t.Error("Modifying one returned account's nonce affected another returned account")
	}
}
