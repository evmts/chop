// Package state provides blockchain state persistence and replay functionality.
// It handles saving and loading blockchain state to/from disk, enabling state recovery
// and replay of historical transactions.
package state

import (
	"chop/types"
	"encoding/json"
	"os"
	"path/filepath"
	"time"
)

// StateFile represents the persisted state stored on disk.
// It contains a list of all calls (transactions) that can be replayed to reconstruct state.
type StateFile struct {
	Calls []PersistedCall `json:"calls"`
}

// PersistedCall represents a single call (transaction) persisted in the state file.
// It contains all parameters needed to replay the call during state reconstruction.
type PersistedCall struct {
	CallType  string    `json:"callType"`
	Caller    string    `json:"caller"`
	Target    string    `json:"target"`
	Value     string    `json:"value"`
	InputData string    `json:"inputData"`
	GasLimit  string    `json:"gasLimit"`
	Salt      string    `json:"salt"`
	Timestamp time.Time `json:"timestamp"`
}

// GetStateFilePath returns the default path to the state file in the user's home directory.
// Returns ".chop_state.json" in the current directory if the home directory cannot be determined.
func GetStateFilePath() string {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return ".chop_state.json"
	}
	return filepath.Join(homeDir, ".chop_state.json")
}

// LoadStateFile loads the state file from the specified path.
// If the file does not exist, returns an empty StateFile with no error.
// Returns an error if the file exists but cannot be read or parsed.
func LoadStateFile(path string) (*StateFile, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return &StateFile{Calls: []PersistedCall{}}, nil
		}
		return nil, err
	}

	var state StateFile
	if err := json.Unmarshal(data, &state); err != nil {
		return nil, err
	}

	return &state, nil
}

// SaveStateFile saves the state file to the specified path with pretty-printed JSON.
// The file is written with permissions 0644 (readable by all, writable by owner).
// Returns an error if the file cannot be written.
func SaveStateFile(path string, state *StateFile) error {
	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(path, data, 0644)
}

// AppendCall appends a single call to the state file at the specified path.
// If the file does not exist or cannot be loaded, creates a new state file.
// This is useful for incrementally building state during execution.
func AppendCall(path string, call PersistedCall) error {
	state, err := LoadStateFile(path)
	if err != nil {
		state = &StateFile{Calls: []PersistedCall{}}
	}

	state.Calls = append(state.Calls, call)
	return SaveStateFile(path, state)
}

// ClearStateFile clears the state file by replacing it with an empty state.
// This effectively resets the persisted state to empty.
func ClearStateFile(path string) error {
	return SaveStateFile(path, &StateFile{Calls: []PersistedCall{}})
}

// ConvertFromCallParameters converts UI call parameters to the persisted format.
// Adds the provided timestamp to the call record.
// This is used when saving calls from the UI to the state file.
func ConvertFromCallParameters(params types.CallParametersStrings, timestamp time.Time) PersistedCall {
	return PersistedCall{
		CallType:  params.CallType,
		Caller:    params.Caller,
		Target:    params.Target,
		Value:     params.Value,
		InputData: params.InputData,
		GasLimit:  params.GasLimit,
		Salt:      params.Salt,
		Timestamp: timestamp,
	}
}

// ConvertToCallParameters converts a persisted call back to UI call parameters format.
// The timestamp is not included in the returned parameters.
// This is used when replaying calls from the state file.
func ConvertToCallParameters(call PersistedCall) types.CallParametersStrings {
	return types.CallParametersStrings{
		CallType:  call.CallType,
		Caller:    call.Caller,
		Target:    call.Target,
		Value:     call.Value,
		InputData: call.InputData,
		GasLimit:  call.GasLimit,
		Salt:      call.Salt,
	}
}

// StateReplayer handles replaying historical state from persisted calls.
// Note: This is currently a stub. Full implementation would require VM integration.
type StateReplayer struct {
	// TODO: Will need VM manager and history manager
}

// NewStateReplayer creates a new state replayer with the provided managers.
// Note: This is currently a stub that ignores the parameters.
// Full implementation would store references to VM and history managers.
func NewStateReplayer(vmManager interface{}, historyManager interface{}) *StateReplayer {
	return &StateReplayer{}
}

// ReplayState replays a list of persisted calls to reconstruct blockchain state.
// Note: This is currently a stub that does nothing.
// Full implementation would execute each call through the VM in sequence.
func (sr *StateReplayer) ReplayState(calls []PersistedCall) error {
	// TODO: Replay calls through VM
	return nil
}
