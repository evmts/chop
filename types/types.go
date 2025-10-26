package types

import (
	"math/big"
	"time"
)

// AppState represents the different states of the application
type AppState int

const (
	StateMainMenu AppState = iota
	StateCallParameterList
	StateCallParameterEdit
	StateCallTypeEdit
	StateCallExecuting
	StateCallResult
	StateCallHistory
	StateCallHistoryDetail
	StateLogDetail
	StateContracts
	StateContractDetail
	StateConfirmReset
	// New states for enhanced features
	StateDashboard
	StateAccountsList
	StateAccountDetail
	StateBlocksList
	StateBlockDetail
	StateTransactionsList
	StateTransactionDetail
	StateStateInspector
	StateSettings
)

// Tab represents the main navigation tabs
type Tab int

const (
	TabDashboard Tab = iota
	TabAccounts
	TabBlocks
	TabTransactions
	TabContracts
	TabStateInspector
	TabSettings
)

// TabToString converts Tab to display string
func TabToString(t Tab) string {
	switch t {
	case TabDashboard:
		return "Dashboard"
	case TabAccounts:
		return "Accounts"
	case TabBlocks:
		return "Blocks"
	case TabTransactions:
		return "Transactions"
	case TabContracts:
		return "Contracts"
	case TabStateInspector:
		return "State"
	case TabSettings:
		return "Settings"
	default:
		return "Dashboard"
	}
}

// TabToState converts Tab to initial AppState for that tab
func TabToState(t Tab) AppState {
	switch t {
	case TabDashboard:
		return StateDashboard
	case TabAccounts:
		return StateAccountsList
	case TabBlocks:
		return StateBlocksList
	case TabTransactions:
		return StateTransactionsList
	case TabContracts:
		return StateContracts
	case TabStateInspector:
		return StateStateInspector
	case TabSettings:
		return StateSettings
	default:
		return StateDashboard
	}
}

// CallType represents the type of EVM call
type CallType int

const (
	CallTypeCall CallType = iota
	CallTypeStaticCall
	CallTypeCreate
	CallTypeCreate2
	CallTypeDelegateCall
)

// CallTypeToString converts CallType to string
func CallTypeToString(ct CallType) string {
	switch ct {
	case CallTypeCall:
		return "CALL"
	case CallTypeStaticCall:
		return "STATICCALL"
	case CallTypeCreate:
		return "CREATE"
	case CallTypeCreate2:
		return "CREATE2"
	case CallTypeDelegateCall:
		return "DELEGATECALL"
	default:
		return "CALL"
	}
}

// StringToCallType converts string to CallType
func StringToCallType(s string) CallType {
	switch s {
	case "CALL":
		return CallTypeCall
	case "STATICCALL":
		return CallTypeStaticCall
	case "CREATE":
		return CallTypeCreate
	case "CREATE2":
		return CallTypeCreate2
	case "DELEGATECALL":
		return CallTypeDelegateCall
	default:
		return CallTypeCall
	}
}

// GetCallTypeOptions returns all available call type options
func GetCallTypeOptions() []string {
	return []string{
		"CALL",
		"STATICCALL",
		"CREATE",
		"CREATE2",
		"DELEGATECALL",
	}
}

// CallParametersStrings represents call parameters as strings for UI
type CallParametersStrings struct {
	CallType  string
	Caller    string
	Target    string
	Value     string
	InputData string
	GasLimit  string
	Salt      string
}

// CallParameter represents a single parameter with name and value
type CallParameter struct {
	Name  string
	Value string
}

// CallResult represents the result of an EVM call (stubbed for now)
type CallResult struct {
	Success      bool
	ReturnData   []byte
	GasLeft      uint64
	ErrorInfo    string
	Logs         []Log
	DeployedAddr string
}

// Log represents an EVM log event
type Log struct {
	Address string
	Topics  []string
	Data    []byte
}

// CallHistoryEntry represents a single call in the history
type CallHistoryEntry struct {
	ID         string
	Parameters CallParametersStrings
	Result     *CallResult
	Timestamp  time.Time
}

// Contract represents a deployed contract
type Contract struct {
	Address   string
	Bytecode  []byte
	Timestamp time.Time
}

// InputParamError represents a user input error
type InputParamError struct {
	Field   string
	Message string
	Details string
}

func (e InputParamError) Error() string {
	if e.Details != "" {
		return e.Message + ": " + e.Details
	}
	return e.Message
}

// UIError returns a user-friendly error message
func (e InputParamError) UIError() string {
	return e.Message
}

// Account represents an Ethereum account in the blockchain state
type Account struct {
	Address    string
	Balance    *big.Int
	Nonce      uint64
	Code       []byte
	CodeHash   string
	StorageRoot string
	PrivateKey string // Only for test accounts
	Index      int    // Account index (1-10 for pre-funded accounts)
}

// Block represents a block in the blockchain
type Block struct {
	Number       uint64
	Hash         string
	ParentHash   string
	Timestamp    time.Time
	GasUsed      uint64
	GasLimit     uint64
	Transactions []string // Transaction IDs
	Miner        string   // Address that mined the block
	StateRoot    string
	Size         uint64
}

// Transaction represents a transaction (enhanced from CallHistoryEntry)
type Transaction struct {
	ID           string
	Hash         string
	BlockNumber  uint64
	BlockHash    string
	From         string
	To           string
	Value        *big.Int
	GasLimit     uint64
	GasUsed      uint64
	GasPrice     *big.Int
	InputData    []byte
	Nonce        uint64
	CallType     CallType
	Status       bool // true = success, false = failure
	ReturnData   []byte
	Logs         []Log
	Error        string
	Timestamp    time.Time
	DeployedAddr string // For CREATE/CREATE2
}

// BlockchainStats represents current blockchain statistics
type BlockchainStats struct {
	BlockHeight      uint64
	TotalBlocks      uint64
	TotalTransactions uint64
	SuccessfulTxs    uint64
	FailedTxs        uint64
	TotalGasUsed     uint64
	TotalAccounts    int
	TotalContracts   int
	TotalBalance     *big.Int
	LastBlockTime    time.Time
}

// NavigationStack represents a stack for breadcrumb navigation
type NavigationStack struct {
	States []AppState
	Data   []interface{} // Additional data for each state (e.g., selected ID)
}

// Push adds a new state to the navigation stack
func (n *NavigationStack) Push(state AppState, data interface{}) {
	n.States = append(n.States, state)
	n.Data = append(n.Data, data)
}

// Pop removes and returns the top state from the stack
func (n *NavigationStack) Pop() (AppState, interface{}) {
	if len(n.States) == 0 {
		return StateDashboard, nil
	}

	state := n.States[len(n.States)-1]
	data := n.Data[len(n.Data)-1]

	n.States = n.States[:len(n.States)-1]
	n.Data = n.Data[:len(n.Data)-1]

	return state, data
}

// Peek returns the top state without removing it
func (n *NavigationStack) Peek() (AppState, interface{}) {
	if len(n.States) == 0 {
		return StateDashboard, nil
	}
	return n.States[len(n.States)-1], n.Data[len(n.Data)-1]
}

// Clear empties the navigation stack
func (n *NavigationStack) Clear() {
	n.States = []AppState{}
	n.Data = []interface{}{}
}

// Depth returns the number of items in the stack
func (n *NavigationStack) Depth() int {
	return len(n.States)
}

// EventType represents different types of blockchain events
type EventType int

const (
	EventNewBlock EventType = iota
	EventNewTransaction
	EventAccountUpdated
	EventContractDeployed
	EventStateChanged
)

// BlockchainEvent represents an event in the blockchain
type BlockchainEvent struct {
	Type      EventType
	Timestamp time.Time
	Data      interface{}
}

// AccountState represents the full state of an account for inspection
type AccountState struct {
	Address     string
	Balance     *big.Int
	Nonce       uint64
	Code        []byte
	CodeSize    int
	StorageSlots map[string]string // Key -> Value mapping for storage
	IsContract  bool
}
