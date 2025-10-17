package state

import (
	"chop/internal/types"
	"encoding/json"
	"os"
	"path/filepath"
	"time"
)

// StateFile represents the persisted state
type StateFile struct {
	Calls []PersistedCall `json:"calls"`
}

// PersistedCall represents a call in the state file
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

// GetStateFilePath returns the path to the state file
func GetStateFilePath() string {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return ".chop_state.json"
	}
	return filepath.Join(homeDir, ".chop_state.json")
}

// LoadStateFile loads the state from disk
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

// SaveStateFile saves the state to disk
func SaveStateFile(path string, state *StateFile) error {
	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(path, data, 0644)
}

// AppendCall appends a single call to the state file
func AppendCall(path string, call PersistedCall) error {
	state, err := LoadStateFile(path)
	if err != nil {
		state = &StateFile{Calls: []PersistedCall{}}
	}

	state.Calls = append(state.Calls, call)
	return SaveStateFile(path, state)
}

// ClearStateFile clears the state file
func ClearStateFile(path string) error {
	return SaveStateFile(path, &StateFile{Calls: []PersistedCall{}})
}

// ConvertFromCallParameters converts UI call parameters to persisted format
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

// ConvertToCallParameters converts persisted format to UI call parameters
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

// StateReplayer replays state from disk (stubbed for now)
type StateReplayer struct {
	// TODO: Will need VM manager and history manager
}

// NewStateReplayer creates a new state replayer
func NewStateReplayer(vmManager interface{}, historyManager interface{}) *StateReplayer {
	return &StateReplayer{}
}

// ReplayState replays calls from state file
func (sr *StateReplayer) ReplayState(calls []PersistedCall) error {
	// TODO: Replay calls through VM
	return nil
}
