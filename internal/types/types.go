package types

import (
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
)

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
