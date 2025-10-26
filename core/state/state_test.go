package state

import (
	"chop/types"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestGetStateFilePath(t *testing.T) {
	t.Parallel()

	path := GetStateFilePath()

	if path == "" {
		t.Error("GetStateFilePath returned empty string")
	}

	// Should end with .chop_state.json
	expectedSuffix := ".chop_state.json"
	if len(path) < len(expectedSuffix) {
		t.Errorf("Path too short: %s", path)
	} else {
		suffix := path[len(path)-len(expectedSuffix):]
		if suffix != expectedSuffix {
			t.Errorf("Path does not end with %s: %s", expectedSuffix, path)
		}
	}
}

func TestLoadStateFile(t *testing.T) {
	t.Parallel()

	t.Run("missing file returns empty state", func(t *testing.T) {
		tempDir := t.TempDir()
		path := filepath.Join(tempDir, "missing.json")

		state, err := LoadStateFile(path)

		if err != nil {
			t.Errorf("Expected no error for missing file, got: %v", err)
		}

		if state == nil {
			t.Fatal("LoadStateFile returned nil state")
		}

		if state.Calls == nil {
			t.Error("State.Calls is nil")
		}

		if len(state.Calls) != 0 {
			t.Errorf("Expected empty calls, got %d calls", len(state.Calls))
		}
	})

	t.Run("valid JSON file loads correctly", func(t *testing.T) {
		tempDir := t.TempDir()
		path := filepath.Join(tempDir, "state.json")

		// Create a valid state file
		timestamp := time.Now()
		expectedState := StateFile{
			Calls: []PersistedCall{
				{
					CallType:  "CALL",
					Caller:    "0x1111111111111111111111111111111111111111",
					Target:    "0x2222222222222222222222222222222222222222",
					Value:     "1000000000000000000",
					InputData: "0x12345678",
					GasLimit:  "100000",
					Salt:      "",
					Timestamp: timestamp,
				},
			},
		}

		data, err := json.MarshalIndent(expectedState, "", "  ")
		if err != nil {
			t.Fatalf("Failed to marshal test data: %v", err)
		}

		if err := os.WriteFile(path, data, 0644); err != nil {
			t.Fatalf("Failed to write test file: %v", err)
		}

		// Load the file
		state, err := LoadStateFile(path)

		if err != nil {
			t.Errorf("Unexpected error: %v", err)
		}

		if state == nil {
			t.Fatal("LoadStateFile returned nil state")
		}

		if len(state.Calls) != 1 {
			t.Fatalf("Expected 1 call, got %d", len(state.Calls))
		}

		call := state.Calls[0]
		if call.CallType != "CALL" {
			t.Errorf("CallType mismatch: got %s, want CALL", call.CallType)
		}
		if call.Caller != "0x1111111111111111111111111111111111111111" {
			t.Errorf("Caller mismatch: got %s", call.Caller)
		}
		if call.Target != "0x2222222222222222222222222222222222222222" {
			t.Errorf("Target mismatch: got %s", call.Target)
		}
		if call.Value != "1000000000000000000" {
			t.Errorf("Value mismatch: got %s", call.Value)
		}
		if call.InputData != "0x12345678" {
			t.Errorf("InputData mismatch: got %s", call.InputData)
		}
		if call.GasLimit != "100000" {
			t.Errorf("GasLimit mismatch: got %s", call.GasLimit)
		}
	})

	t.Run("invalid JSON returns error", func(t *testing.T) {
		tempDir := t.TempDir()
		path := filepath.Join(tempDir, "invalid.json")

		// Write invalid JSON
		invalidJSON := []byte("{invalid json content")
		if err := os.WriteFile(path, invalidJSON, 0644); err != nil {
			t.Fatalf("Failed to write test file: %v", err)
		}

		state, err := LoadStateFile(path)

		if err == nil {
			t.Error("Expected error for invalid JSON, got nil")
		}

		if state != nil {
			t.Error("Expected nil state for invalid JSON")
		}
	})

	t.Run("empty file loads as valid empty state", func(t *testing.T) {
		tempDir := t.TempDir()
		path := filepath.Join(tempDir, "empty.json")

		// Write empty JSON object
		emptyState := StateFile{Calls: []PersistedCall{}}
		data, _ := json.Marshal(emptyState)
		if err := os.WriteFile(path, data, 0644); err != nil {
			t.Fatalf("Failed to write test file: %v", err)
		}

		state, err := LoadStateFile(path)

		if err != nil {
			t.Errorf("Unexpected error: %v", err)
		}

		if state == nil {
			t.Fatal("LoadStateFile returned nil state")
		}

		if len(state.Calls) != 0 {
			t.Errorf("Expected empty calls, got %d calls", len(state.Calls))
		}
	})
}

func TestSaveStateFile(t *testing.T) {
	t.Parallel()

	t.Run("creates new file with correct structure", func(t *testing.T) {
		tempDir := t.TempDir()
		path := filepath.Join(tempDir, "state.json")

		timestamp := time.Now()
		state := &StateFile{
			Calls: []PersistedCall{
				{
					CallType:  "CREATE",
					Caller:    "0x3333333333333333333333333333333333333333",
					Target:    "",
					Value:     "0",
					InputData: "0x608060405234801561001057600080fd5b50",
					GasLimit:  "500000",
					Salt:      "",
					Timestamp: timestamp,
				},
			},
		}

		err := SaveStateFile(path, state)

		if err != nil {
			t.Errorf("Unexpected error: %v", err)
		}

		// Verify file was created
		if _, err := os.Stat(path); os.IsNotExist(err) {
			t.Error("File was not created")
		}

		// Verify content
		data, err := os.ReadFile(path)
		if err != nil {
			t.Fatalf("Failed to read saved file: %v", err)
		}

		var loadedState StateFile
		if err := json.Unmarshal(data, &loadedState); err != nil {
			t.Fatalf("Failed to unmarshal saved file: %v", err)
		}

		if len(loadedState.Calls) != 1 {
			t.Fatalf("Expected 1 call, got %d", len(loadedState.Calls))
		}

		if loadedState.Calls[0].CallType != "CREATE" {
			t.Errorf("CallType mismatch: got %s, want CREATE", loadedState.Calls[0].CallType)
		}
	})

	t.Run("overwrites existing file", func(t *testing.T) {
		tempDir := t.TempDir()
		path := filepath.Join(tempDir, "state.json")

		// Write initial state
		initialState := &StateFile{
			Calls: []PersistedCall{
				{
					CallType:  "CALL",
					Caller:    "0x1111111111111111111111111111111111111111",
					Target:    "0x2222222222222222222222222222222222222222",
					Value:     "1000",
					InputData: "0x",
					GasLimit:  "100000",
					Salt:      "",
					Timestamp: time.Now(),
				},
			},
		}

		if err := SaveStateFile(path, initialState); err != nil {
			t.Fatalf("Failed to save initial state: %v", err)
		}

		// Overwrite with new state
		newState := &StateFile{
			Calls: []PersistedCall{
				{
					CallType:  "STATICCALL",
					Caller:    "0x4444444444444444444444444444444444444444",
					Target:    "0x5555555555555555555555555555555555555555",
					Value:     "0",
					InputData: "0xabcdef",
					GasLimit:  "50000",
					Salt:      "",
					Timestamp: time.Now(),
				},
			},
		}

		if err := SaveStateFile(path, newState); err != nil {
			t.Errorf("Failed to overwrite state: %v", err)
		}

		// Verify new content
		loadedState, err := LoadStateFile(path)
		if err != nil {
			t.Fatalf("Failed to load overwritten state: %v", err)
		}

		if len(loadedState.Calls) != 1 {
			t.Fatalf("Expected 1 call, got %d", len(loadedState.Calls))
		}

		if loadedState.Calls[0].CallType != "STATICCALL" {
			t.Errorf("CallType mismatch: got %s, want STATICCALL", loadedState.Calls[0].CallType)
		}
	})

	t.Run("creates properly formatted JSON", func(t *testing.T) {
		tempDir := t.TempDir()
		path := filepath.Join(tempDir, "state.json")

		state := &StateFile{
			Calls: []PersistedCall{},
		}

		if err := SaveStateFile(path, state); err != nil {
			t.Errorf("Unexpected error: %v", err)
		}

		// Read raw content
		data, err := os.ReadFile(path)
		if err != nil {
			t.Fatalf("Failed to read file: %v", err)
		}

		// Verify it's indented (not minified)
		content := string(data)
		if len(content) < 10 {
			t.Error("File content seems too short")
		}

		// Should contain newlines (indented JSON)
		if !contains(content, "\n") {
			t.Error("JSON appears to be minified, expected indented format")
		}
	})
}

func TestAppendCall(t *testing.T) {
	t.Parallel()

	t.Run("creates file if missing", func(t *testing.T) {
		tempDir := t.TempDir()
		path := filepath.Join(tempDir, "state.json")

		timestamp := time.Now()
		call := PersistedCall{
			CallType:  "CALL",
			Caller:    "0x1111111111111111111111111111111111111111",
			Target:    "0x2222222222222222222222222222222222222222",
			Value:     "1000",
			InputData: "0x",
			GasLimit:  "100000",
			Salt:      "",
			Timestamp: timestamp,
		}

		err := AppendCall(path, call)

		if err != nil {
			t.Errorf("Unexpected error: %v", err)
		}

		// Verify file was created
		state, err := LoadStateFile(path)
		if err != nil {
			t.Fatalf("Failed to load state: %v", err)
		}

		if len(state.Calls) != 1 {
			t.Fatalf("Expected 1 call, got %d", len(state.Calls))
		}

		if state.Calls[0].CallType != "CALL" {
			t.Errorf("CallType mismatch: got %s, want CALL", state.Calls[0].CallType)
		}
	})

	t.Run("appends to existing file", func(t *testing.T) {
		tempDir := t.TempDir()
		path := filepath.Join(tempDir, "state.json")

		// Create initial state with one call
		initialState := &StateFile{
			Calls: []PersistedCall{
				{
					CallType:  "CALL",
					Caller:    "0x1111111111111111111111111111111111111111",
					Target:    "0x2222222222222222222222222222222222222222",
					Value:     "1000",
					InputData: "0x",
					GasLimit:  "100000",
					Salt:      "",
					Timestamp: time.Now(),
				},
			},
		}

		if err := SaveStateFile(path, initialState); err != nil {
			t.Fatalf("Failed to save initial state: %v", err)
		}

		// Append a new call
		newCall := PersistedCall{
			CallType:  "CREATE",
			Caller:    "0x3333333333333333333333333333333333333333",
			Target:    "",
			Value:     "0",
			InputData: "0x608060405234801561001057600080fd5b50",
			GasLimit:  "500000",
			Salt:      "",
			Timestamp: time.Now(),
		}

		if err := AppendCall(path, newCall); err != nil {
			t.Errorf("Failed to append call: %v", err)
		}

		// Verify both calls exist
		state, err := LoadStateFile(path)
		if err != nil {
			t.Fatalf("Failed to load state: %v", err)
		}

		if len(state.Calls) != 2 {
			t.Fatalf("Expected 2 calls, got %d", len(state.Calls))
		}

		if state.Calls[0].CallType != "CALL" {
			t.Errorf("First call type mismatch: got %s, want CALL", state.Calls[0].CallType)
		}

		if state.Calls[1].CallType != "CREATE" {
			t.Errorf("Second call type mismatch: got %s, want CREATE", state.Calls[1].CallType)
		}
	})

	t.Run("preserves existing calls", func(t *testing.T) {
		tempDir := t.TempDir()
		path := filepath.Join(tempDir, "state.json")

		// Create state with multiple calls
		initialState := &StateFile{
			Calls: []PersistedCall{
				{
					CallType:  "CALL",
					Caller:    "0x1111111111111111111111111111111111111111",
					Target:    "0x2222222222222222222222222222222222222222",
					Value:     "1000",
					InputData: "0xaabbccdd",
					GasLimit:  "100000",
					Salt:      "",
					Timestamp: time.Now(),
				},
				{
					CallType:  "STATICCALL",
					Caller:    "0x4444444444444444444444444444444444444444",
					Target:    "0x5555555555555555555555555555555555555555",
					Value:     "0",
					InputData: "0xeeff",
					GasLimit:  "50000",
					Salt:      "",
					Timestamp: time.Now(),
				},
			},
		}

		if err := SaveStateFile(path, initialState); err != nil {
			t.Fatalf("Failed to save initial state: %v", err)
		}

		// Append a new call
		newCall := PersistedCall{
			CallType:  "CREATE2",
			Caller:    "0x6666666666666666666666666666666666666666",
			Target:    "",
			Value:     "0",
			InputData: "0x6080",
			GasLimit:  "600000",
			Salt:      "0x0000000000000000000000000000000000000000000000000000000000000001",
			Timestamp: time.Now(),
		}

		if err := AppendCall(path, newCall); err != nil {
			t.Errorf("Failed to append call: %v", err)
		}

		// Verify all three calls exist with correct data
		state, err := LoadStateFile(path)
		if err != nil {
			t.Fatalf("Failed to load state: %v", err)
		}

		if len(state.Calls) != 3 {
			t.Fatalf("Expected 3 calls, got %d", len(state.Calls))
		}

		// Check first call preserved
		if state.Calls[0].InputData != "0xaabbccdd" {
			t.Errorf("First call InputData not preserved: got %s", state.Calls[0].InputData)
		}

		// Check second call preserved
		if state.Calls[1].InputData != "0xeeff" {
			t.Errorf("Second call InputData not preserved: got %s", state.Calls[1].InputData)
		}

		// Check new call added
		if state.Calls[2].CallType != "CREATE2" {
			t.Errorf("Third call type mismatch: got %s, want CREATE2", state.Calls[2].CallType)
		}
	})
}

func TestClearStateFile(t *testing.T) {
	t.Parallel()

	t.Run("creates empty state file", func(t *testing.T) {
		tempDir := t.TempDir()
		path := filepath.Join(tempDir, "state.json")

		err := ClearStateFile(path)

		if err != nil {
			t.Errorf("Unexpected error: %v", err)
		}

		// Verify file exists
		if _, err := os.Stat(path); os.IsNotExist(err) {
			t.Error("File was not created")
		}

		// Verify it's empty
		state, err := LoadStateFile(path)
		if err != nil {
			t.Fatalf("Failed to load cleared state: %v", err)
		}

		if len(state.Calls) != 0 {
			t.Errorf("Expected 0 calls, got %d", len(state.Calls))
		}
	})

	t.Run("overwrites existing file", func(t *testing.T) {
		tempDir := t.TempDir()
		path := filepath.Join(tempDir, "state.json")

		// Create state with calls
		initialState := &StateFile{
			Calls: []PersistedCall{
				{
					CallType:  "CALL",
					Caller:    "0x1111111111111111111111111111111111111111",
					Target:    "0x2222222222222222222222222222222222222222",
					Value:     "1000",
					InputData: "0x",
					GasLimit:  "100000",
					Salt:      "",
					Timestamp: time.Now(),
				},
				{
					CallType:  "CREATE",
					Caller:    "0x3333333333333333333333333333333333333333",
					Target:    "",
					Value:     "0",
					InputData: "0x6080",
					GasLimit:  "500000",
					Salt:      "",
					Timestamp: time.Now(),
				},
			},
		}

		if err := SaveStateFile(path, initialState); err != nil {
			t.Fatalf("Failed to save initial state: %v", err)
		}

		// Clear the state
		if err := ClearStateFile(path); err != nil {
			t.Errorf("Failed to clear state: %v", err)
		}

		// Verify it's now empty
		state, err := LoadStateFile(path)
		if err != nil {
			t.Fatalf("Failed to load cleared state: %v", err)
		}

		if len(state.Calls) != 0 {
			t.Errorf("Expected 0 calls after clear, got %d", len(state.Calls))
		}
	})
}

func TestConvertFromCallParameters(t *testing.T) {
	t.Parallel()

	timestamp := time.Date(2025, 10, 26, 12, 0, 0, 0, time.UTC)

	params := types.CallParametersStrings{
		CallType:  "CALL",
		Caller:    "0x1111111111111111111111111111111111111111",
		Target:    "0x2222222222222222222222222222222222222222",
		Value:     "1000000000000000000",
		InputData: "0x12345678",
		GasLimit:  "100000",
		Salt:      "",
	}

	result := ConvertFromCallParameters(params, timestamp)

	if result.CallType != params.CallType {
		t.Errorf("CallType mismatch: got %s, want %s", result.CallType, params.CallType)
	}

	if result.Caller != params.Caller {
		t.Errorf("Caller mismatch: got %s, want %s", result.Caller, params.Caller)
	}

	if result.Target != params.Target {
		t.Errorf("Target mismatch: got %s, want %s", result.Target, params.Target)
	}

	if result.Value != params.Value {
		t.Errorf("Value mismatch: got %s, want %s", result.Value, params.Value)
	}

	if result.InputData != params.InputData {
		t.Errorf("InputData mismatch: got %s, want %s", result.InputData, params.InputData)
	}

	if result.GasLimit != params.GasLimit {
		t.Errorf("GasLimit mismatch: got %s, want %s", result.GasLimit, params.GasLimit)
	}

	if result.Salt != params.Salt {
		t.Errorf("Salt mismatch: got %s, want %s", result.Salt, params.Salt)
	}

	if !result.Timestamp.Equal(timestamp) {
		t.Errorf("Timestamp mismatch: got %s, want %s", result.Timestamp, timestamp)
	}
}

func TestConvertToCallParameters(t *testing.T) {
	t.Parallel()

	timestamp := time.Date(2025, 10, 26, 12, 0, 0, 0, time.UTC)

	call := PersistedCall{
		CallType:  "CREATE2",
		Caller:    "0x3333333333333333333333333333333333333333",
		Target:    "",
		Value:     "0",
		InputData: "0x608060405234801561001057600080fd5b50",
		GasLimit:  "500000",
		Salt:      "0x0000000000000000000000000000000000000000000000000000000000000001",
		Timestamp: timestamp,
	}

	result := ConvertToCallParameters(call)

	if result.CallType != call.CallType {
		t.Errorf("CallType mismatch: got %s, want %s", result.CallType, call.CallType)
	}

	if result.Caller != call.Caller {
		t.Errorf("Caller mismatch: got %s, want %s", result.Caller, call.Caller)
	}

	if result.Target != call.Target {
		t.Errorf("Target mismatch: got %s, want %s", result.Target, call.Target)
	}

	if result.Value != call.Value {
		t.Errorf("Value mismatch: got %s, want %s", result.Value, call.Value)
	}

	if result.InputData != call.InputData {
		t.Errorf("InputData mismatch: got %s, want %s", result.InputData, call.InputData)
	}

	if result.GasLimit != call.GasLimit {
		t.Errorf("GasLimit mismatch: got %s, want %s", result.GasLimit, call.GasLimit)
	}

	if result.Salt != call.Salt {
		t.Errorf("Salt mismatch: got %s, want %s", result.Salt, call.Salt)
	}
}

func TestRoundTripConversion(t *testing.T) {
	t.Parallel()

	// Test that converting back and forth preserves data
	timestamp := time.Now()

	originalParams := types.CallParametersStrings{
		CallType:  "DELEGATECALL",
		Caller:    "0x4444444444444444444444444444444444444444",
		Target:    "0x5555555555555555555555555555555555555555",
		Value:     "5000000000000000000",
		InputData: "0xabcdef0123456789",
		GasLimit:  "200000",
		Salt:      "",
	}

	// Convert to persisted format
	persisted := ConvertFromCallParameters(originalParams, timestamp)

	// Convert back to call parameters
	converted := ConvertToCallParameters(persisted)

	// Verify all fields match
	if converted.CallType != originalParams.CallType {
		t.Errorf("CallType round-trip failed: got %s, want %s", converted.CallType, originalParams.CallType)
	}

	if converted.Caller != originalParams.Caller {
		t.Errorf("Caller round-trip failed: got %s, want %s", converted.Caller, originalParams.Caller)
	}

	if converted.Target != originalParams.Target {
		t.Errorf("Target round-trip failed: got %s, want %s", converted.Target, originalParams.Target)
	}

	if converted.Value != originalParams.Value {
		t.Errorf("Value round-trip failed: got %s, want %s", converted.Value, originalParams.Value)
	}

	if converted.InputData != originalParams.InputData {
		t.Errorf("InputData round-trip failed: got %s, want %s", converted.InputData, originalParams.InputData)
	}

	if converted.GasLimit != originalParams.GasLimit {
		t.Errorf("GasLimit round-trip failed: got %s, want %s", converted.GasLimit, originalParams.GasLimit)
	}

	if converted.Salt != originalParams.Salt {
		t.Errorf("Salt round-trip failed: got %s, want %s", converted.Salt, originalParams.Salt)
	}
}

// Helper function to check if a string contains a substring
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > len(substr) && containsHelper(s, substr))
}

func containsHelper(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
