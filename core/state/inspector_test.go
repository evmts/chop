package state

import (
	"math/big"
	"testing"

	"chop/core/accounts"
	"chop/types"
)

// setupTestInspector creates a test inspector with pre-configured accounts
func setupTestInspector(t *testing.T) (*Inspector, *accounts.Manager) {
	t.Helper()

	// Create account manager with deterministic seed for testing
	manager, err := accounts.NewManagerWithSeed("0000000000000000000000000000000000000000000000000000000000000001")
	if err != nil {
		t.Fatalf("Failed to create account manager: %v", err)
	}

	// Deploy a test contract (account with code)
	contractAddr := "0x1234567890123456789012345678901234567890"
	contractCode := []byte{0x60, 0x60, 0x60, 0x40} // Simple EVM bytecode
	if err := manager.SetCode(contractAddr, contractCode); err != nil {
		t.Fatalf("Failed to set contract code: %v", err)
	}

	inspector := NewInspector(manager)
	return inspector, manager
}

func TestNewInspector(t *testing.T) {
	t.Parallel()

	manager, err := accounts.NewManager()
	if err != nil {
		t.Fatalf("Failed to create account manager: %v", err)
	}

	inspector := NewInspector(manager)

	if inspector == nil {
		t.Fatal("NewInspector returned nil")
	}

	if inspector.accountManager == nil {
		t.Error("Inspector accountManager is nil")
	}
}

func TestInspectAddress(t *testing.T) {
	t.Parallel()

	inspector, manager := setupTestInspector(t)
	accounts := manager.GetAllAccounts()

	if len(accounts) == 0 {
		t.Fatal("No accounts available for testing")
	}

	// Find a regular account (one without code)
	var regularAccount *types.Account
	for _, acc := range accounts {
		if len(acc.Code) == 0 {
			regularAccount = acc
			break
		}
	}
	if regularAccount == nil {
		t.Fatal("No regular account found for testing")
	}

	testCases := []struct {
		name        string
		address     string
		wantErr     bool
		checkFields func(t *testing.T, state *types.AccountState)
	}{
		{
			name:    "valid regular account",
			address: regularAccount.Address,
			wantErr: false,
			checkFields: func(t *testing.T, state *types.AccountState) {
				if state.Address != regularAccount.Address {
					t.Errorf("Address mismatch: got %s, want %s", state.Address, regularAccount.Address)
				}
				if state.Balance == nil {
					t.Error("Balance is nil")
				}
				if state.Balance.Cmp(regularAccount.Balance) != 0 {
					t.Errorf("Balance mismatch: got %s, want %s", state.Balance.String(), regularAccount.Balance.String())
				}
				if state.Nonce != regularAccount.Nonce {
					t.Errorf("Nonce mismatch: got %d, want %d", state.Nonce, regularAccount.Nonce)
				}
				if state.IsContract {
					t.Error("Regular account incorrectly marked as contract")
				}
				if state.CodeSize != 0 {
					t.Errorf("Regular account has non-zero code size: %d", state.CodeSize)
				}
				if state.StorageSlots == nil {
					t.Error("StorageSlots map is nil")
				}
			},
		},
		{
			name:    "contract account with code",
			address: "0x1234567890123456789012345678901234567890",
			wantErr: false,
			checkFields: func(t *testing.T, state *types.AccountState) {
				if !state.IsContract {
					t.Error("Contract account not marked as contract")
				}
				if state.CodeSize != 4 {
					t.Errorf("CodeSize mismatch: got %d, want 4", state.CodeSize)
				}
				if len(state.Code) != 4 {
					t.Errorf("Code length mismatch: got %d, want 4", len(state.Code))
				}
			},
		},
		{
			name:    "new account (zero balance)",
			address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
			wantErr: false,
			checkFields: func(t *testing.T, state *types.AccountState) {
				if state.Balance.Cmp(big.NewInt(0)) != 0 {
					t.Errorf("New account balance should be 0, got %s", state.Balance.String())
				}
				if state.Nonce != 0 {
					t.Errorf("New account nonce should be 0, got %d", state.Nonce)
				}
				if state.IsContract {
					t.Error("New account incorrectly marked as contract")
				}
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			state, err := inspector.InspectAddress(tc.address)

			if tc.wantErr {
				if err == nil {
					t.Error("Expected error, got nil")
				}
				return
			}

			if err != nil {
				t.Errorf("Unexpected error: %v", err)
				return
			}

			if state == nil {
				t.Fatal("InspectAddress returned nil state")
			}

			tc.checkFields(t, state)
		})
	}
}

func TestGetBalance(t *testing.T) {
	t.Parallel()

	inspector, manager := setupTestInspector(t)
	accounts := manager.GetAllAccounts()

	t.Run("existing account", func(t *testing.T) {
		balance, err := inspector.GetBalance(accounts[0].Address)
		if err != nil {
			t.Errorf("Unexpected error: %v", err)
		}
		if balance == nil {
			t.Fatal("Balance is nil")
		}

		// Check that balance is copied (not same reference)
		if balance == accounts[0].Balance {
			t.Error("Balance should be a copy, not the same reference")
		}

		if balance.Cmp(accounts[0].Balance) != 0 {
			t.Errorf("Balance mismatch: got %s, want %s", balance.String(), accounts[0].Balance.String())
		}
	})

	t.Run("new account", func(t *testing.T) {
		balance, err := inspector.GetBalance("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")
		if err != nil {
			t.Errorf("Unexpected error: %v", err)
		}
		if balance == nil {
			t.Fatal("Balance is nil")
		}
		if balance.Cmp(big.NewInt(0)) != 0 {
			t.Errorf("New account balance should be 0, got %s", balance.String())
		}
	})
}

func TestGetNonce(t *testing.T) {
	t.Parallel()

	inspector, manager := setupTestInspector(t)
	accounts := manager.GetAllAccounts()

	t.Run("existing account", func(t *testing.T) {
		nonce, err := inspector.GetNonce(accounts[0].Address)
		if err != nil {
			t.Errorf("Unexpected error: %v", err)
		}
		if nonce != accounts[0].Nonce {
			t.Errorf("Nonce mismatch: got %d, want %d", nonce, accounts[0].Nonce)
		}
	})

	t.Run("new account", func(t *testing.T) {
		nonce, err := inspector.GetNonce("0xcccccccccccccccccccccccccccccccccccccccc")
		if err != nil {
			t.Errorf("Unexpected error: %v", err)
		}
		if nonce != 0 {
			t.Errorf("New account nonce should be 0, got %d", nonce)
		}
	})

	t.Run("contract account", func(t *testing.T) {
		nonce, err := inspector.GetNonce("0x1234567890123456789012345678901234567890")
		if err != nil {
			t.Errorf("Unexpected error: %v", err)
		}
		// Contract accounts start with nonce 1
		if nonce != 1 {
			t.Errorf("Contract account nonce should be 1, got %d", nonce)
		}
	})
}

func TestGetCode(t *testing.T) {
	t.Parallel()

	inspector, _ := setupTestInspector(t)

	t.Run("account with code", func(t *testing.T) {
		code, err := inspector.GetCode("0x1234567890123456789012345678901234567890")
		if err != nil {
			t.Errorf("Unexpected error: %v", err)
		}
		if code == nil {
			t.Fatal("Code is nil")
		}
		if len(code) != 4 {
			t.Errorf("Code length mismatch: got %d, want 4", len(code))
		}
		expectedCode := []byte{0x60, 0x60, 0x60, 0x40}
		for i, b := range code {
			if b != expectedCode[i] {
				t.Errorf("Code byte %d mismatch: got 0x%02x, want 0x%02x", i, b, expectedCode[i])
			}
		}

		// Verify code is copied (not shared reference)
		code[0] = 0xFF
		codeAgain, _ := inspector.GetCode("0x1234567890123456789012345678901234567890")
		if codeAgain[0] == 0xFF {
			t.Error("Code modification affected stored code - not properly copied")
		}
	})

	t.Run("account without code", func(t *testing.T) {
		manager, _ := accounts.NewManager()
		inspector := NewInspector(manager)
		accts := manager.GetAllAccounts()

		code, err := inspector.GetCode(accts[0].Address)
		if err != nil {
			t.Errorf("Unexpected error: %v", err)
		}
		if code != nil {
			t.Errorf("Regular account should have nil code, got %v", code)
		}
	})

	t.Run("new account", func(t *testing.T) {
		code, err := inspector.GetCode("0xdddddddddddddddddddddddddddddddddddddddd")
		if err != nil {
			t.Errorf("Unexpected error: %v", err)
		}
		if code != nil {
			t.Errorf("New account should have nil code, got %v", code)
		}
	})
}

func TestIsContract(t *testing.T) {
	t.Parallel()

	inspector, manager := setupTestInspector(t)
	accounts := manager.GetAllAccounts()

	// Find a regular account (one without code)
	var regularAccount *types.Account
	for _, acc := range accounts {
		if len(acc.Code) == 0 {
			regularAccount = acc
			break
		}
	}
	if regularAccount == nil {
		t.Fatal("No regular account found for testing")
	}

	testCases := []struct {
		name       string
		address    string
		wantErr    bool
		isContract bool
	}{
		{
			name:       "regular account",
			address:    regularAccount.Address,
			wantErr:    false,
			isContract: false,
		},
		{
			name:       "contract account",
			address:    "0x1234567890123456789012345678901234567890",
			wantErr:    false,
			isContract: true,
		},
		{
			name:       "new account",
			address:    "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
			wantErr:    false,
			isContract: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			isContract, err := inspector.IsContract(tc.address)

			if tc.wantErr {
				if err == nil {
					t.Error("Expected error, got nil")
				}
				return
			}

			if err != nil {
				t.Errorf("Unexpected error: %v", err)
				return
			}

			if isContract != tc.isContract {
				t.Errorf("IsContract mismatch: got %v, want %v", isContract, tc.isContract)
			}
		})
	}
}

func TestGetStorageAt(t *testing.T) {
	t.Parallel()

	inspector, _ := setupTestInspector(t)

	// Test stubbed functionality - currently returns hardcoded zero value
	t.Run("stubbed storage lookup", func(t *testing.T) {
		value, err := inspector.GetStorageAt("0x1234567890123456789012345678901234567890", "0x0")
		if err != nil {
			t.Errorf("Unexpected error: %v", err)
		}
		expectedValue := "0x0000000000000000000000000000000000000000000000000000000000000000"
		if value != expectedValue {
			t.Errorf("GetStorageAt mismatch: got %s, want %s", value, expectedValue)
		}
	})
}

func TestGetAllStorageSlots(t *testing.T) {
	t.Parallel()

	inspector, _ := setupTestInspector(t)

	// Test stubbed functionality - currently returns empty map
	t.Run("stubbed storage enumeration", func(t *testing.T) {
		slots, err := inspector.GetAllStorageSlots("0x1234567890123456789012345678901234567890")
		if err != nil {
			t.Errorf("Unexpected error: %v", err)
		}
		if slots == nil {
			t.Fatal("GetAllStorageSlots returned nil")
		}
		if len(slots) != 0 {
			t.Errorf("Expected empty storage slots, got %d slots", len(slots))
		}
	})
}

func TestFormatBalance(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name     string
		balance  *big.Int
		expected string
	}{
		{
			name:     "nil balance",
			balance:  nil,
			expected: "0 ETH",
		},
		{
			name:     "zero balance",
			balance:  big.NewInt(0),
			expected: "0 ETH",
		},
		{
			name:     "1 wei",
			balance:  big.NewInt(1),
			expected: "0.00 ETH",
		},
		{
			name: "1 ETH exact",
			balance: func() *big.Int {
				b := new(big.Int)
				b.SetString("1000000000000000000", 10) // 10^18
				return b
			}(),
			expected: "1 ETH",
		},
		{
			name: "100 ETH exact",
			balance: func() *big.Int {
				b := new(big.Int)
				b.SetString("100000000000000000000", 10) // 100 * 10^18
				return b
			}(),
			expected: "100 ETH",
		},
		{
			name: "1.5 ETH",
			balance: func() *big.Int {
				b := new(big.Int)
				b.SetString("1500000000000000000", 10) // 1.5 * 10^18
				return b
			}(),
			expected: "1.50 ETH",
		},
		{
			name: "0.01 ETH",
			balance: func() *big.Int {
				b := new(big.Int)
				b.SetString("10000000000000000", 10) // 0.01 * 10^18
				return b
			}(),
			expected: "0.01 ETH",
		},
		{
			name: "large balance",
			balance: func() *big.Int {
				b := new(big.Int)
				b.SetString("1234567890000000000000000000", 10) // Very large
				return b
			}(),
			expected: "1234567890 ETH",
		},
		{
			name: "balance with small remainder",
			balance: func() *big.Int {
				b := new(big.Int)
				b.SetString("1234000000000000000", 10) // 1.234 ETH
				return b
			}(),
			expected: "1.23 ETH",
		},
		{
			name: "balance with very small remainder",
			balance: func() *big.Int {
				b := new(big.Int)
				b.SetString("1001000000000000000", 10) // 1.001 ETH
				return b
			}(),
			expected: "1.00 ETH",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := FormatBalance(tc.balance)
			if result != tc.expected {
				t.Errorf("FormatBalance mismatch: got %s, want %s", result, tc.expected)
			}
		})
	}
}

func TestFormatBalanceShort(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name     string
		balance  *big.Int
		expected string
	}{
		{
			name:     "nil balance",
			balance:  nil,
			expected: "0",
		},
		{
			name:     "zero balance",
			balance:  big.NewInt(0),
			expected: "0",
		},
		{
			name: "1 ETH exact",
			balance: func() *big.Int {
				b := new(big.Int)
				b.SetString("1000000000000000000", 10)
				return b
			}(),
			expected: "1",
		},
		{
			name: "100 ETH exact",
			balance: func() *big.Int {
				b := new(big.Int)
				b.SetString("100000000000000000000", 10)
				return b
			}(),
			expected: "100",
		},
		{
			name: "1.5 ETH",
			balance: func() *big.Int {
				b := new(big.Int)
				b.SetString("1500000000000000000", 10)
				return b
			}(),
			expected: "1.5",
		},
		{
			name: "1.1 ETH",
			balance: func() *big.Int {
				b := new(big.Int)
				b.SetString("1100000000000000000", 10)
				return b
			}(),
			expected: "1.1",
		},
		{
			name: "1.01 ETH (rounds to 1.0)",
			balance: func() *big.Int {
				b := new(big.Int)
				b.SetString("1010000000000000000", 10)
				return b
			}(),
			expected: "1.0",
		},
		{
			name: "large balance",
			balance: func() *big.Int {
				b := new(big.Int)
				b.SetString("9999999999000000000000000000", 10)
				return b
			}(),
			expected: "9999999999",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := FormatBalanceShort(tc.balance)
			if result != tc.expected {
				t.Errorf("FormatBalanceShort mismatch: got %s, want %s", result, tc.expected)
			}
		})
	}
}
