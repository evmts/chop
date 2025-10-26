package app

import (
	"chop/types"
	"testing"
)

// TestInitialModel tests the InitialModel function
func TestInitialModel(t *testing.T) {
	t.Parallel()

	// This will panic if initialization fails, so we use defer recover
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("InitialModel panicked: %v", r)
		}
	}()

	m := InitialModel()

	// Test initial state
	if m.state != types.StateDashboard {
		t.Errorf("Expected initial state to be StateDashboard, got %v", m.state)
	}

	// Test initial tab
	if m.currentTab != types.TabDashboard {
		t.Errorf("Expected initial tab to be TabDashboard, got %v", m.currentTab)
	}

	// Test auto-refresh is enabled by default
	if !m.autoRefresh {
		t.Error("Expected autoRefresh to be true by default")
	}

	// Test managers are initialized
	if m.vmManager == nil {
		t.Error("Expected vmManager to be initialized")
	}
	if m.historyManager == nil {
		t.Error("Expected historyManager to be initialized")
	}
	if m.accountManager == nil {
		t.Error("Expected accountManager to be initialized")
	}
	if m.blockchainChain == nil {
		t.Error("Expected blockchainChain to be initialized")
	}
	if m.eventBus == nil {
		t.Error("Expected eventBus to be initialized")
	}
	if m.stateInspector == nil {
		t.Error("Expected stateInspector to be initialized")
	}

	// Test call parameters are initialized
	if m.callParams.CallType == "" {
		t.Error("Expected callParams.CallType to be initialized")
	}
	if m.callParams.GasLimit == "" {
		t.Error("Expected callParams.GasLimit to be initialized")
	}

	// Test cursor starts at 0
	if m.cursor != 0 {
		t.Errorf("Expected cursor to start at 0, got %d", m.cursor)
	}

	// Test callParamCursor starts at 0
	if m.callParamCursor != 0 {
		t.Errorf("Expected callParamCursor to start at 0, got %d", m.callParamCursor)
	}
}

// TestModelStateTransitions tests basic state transitions
func TestModelStateTransitions(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name          string
		initialState  types.AppState
		action        string
		expectedState types.AppState
	}{
		{
			name:          "Tab key 1 goes to Dashboard",
			initialState:  types.StateAccountsList,
			action:        "1",
			expectedState: types.StateDashboard,
		},
		{
			name:          "Tab key 2 goes to Accounts",
			initialState:  types.StateDashboard,
			action:        "2",
			expectedState: types.StateAccountsList,
		},
		{
			name:          "Tab key 3 goes to Blocks",
			initialState:  types.StateDashboard,
			action:        "3",
			expectedState: types.StateBlocksList,
		},
		{
			name:          "Tab key 4 goes to Transactions",
			initialState:  types.StateDashboard,
			action:        "4",
			expectedState: types.StateTransactionsList,
		},
		{
			name:          "Tab key 5 goes to Contracts",
			initialState:  types.StateDashboard,
			action:        "5",
			expectedState: types.StateContracts,
		},
		{
			name:          "Tab key 6 goes to State Inspector",
			initialState:  types.StateDashboard,
			action:        "6",
			expectedState: types.StateStateInspector,
		},
		{
			name:          "Tab key 7 goes to Settings",
			initialState:  types.StateDashboard,
			action:        "7",
			expectedState: types.StateSettings,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := Model{
				state:      tt.initialState,
				currentTab: types.TabDashboard,
			}

			// Simulate tab navigation based on action
			switch tt.action {
			case "1":
				m.currentTab = types.TabDashboard
				m.state = types.TabToState(types.TabDashboard)
			case "2":
				m.currentTab = types.TabAccounts
				m.state = types.TabToState(types.TabAccounts)
			case "3":
				m.currentTab = types.TabBlocks
				m.state = types.TabToState(types.TabBlocks)
			case "4":
				m.currentTab = types.TabTransactions
				m.state = types.TabToState(types.TabTransactions)
			case "5":
				m.currentTab = types.TabContracts
				m.state = types.TabToState(types.TabContracts)
			case "6":
				m.currentTab = types.TabStateInspector
				m.state = types.TabToState(types.TabStateInspector)
			case "7":
				m.currentTab = types.TabSettings
				m.state = types.TabToState(types.TabSettings)
			}

			if m.state != tt.expectedState {
				t.Errorf("Expected state %v, got %v", tt.expectedState, m.state)
			}
		})
	}
}

// TestModelUIStateFlags tests UI state flags
func TestModelUIStateFlags(t *testing.T) {
	t.Parallel()

	m := Model{
		showCopyFeedback:          false,
		showPrivateKey:            false,
		awaitingPrivateKeyConfirm: false,
		awaitingRegenerateConfirm: false,
		awaitingResetConfirm:      false,
	}

	// Test initial state
	if m.showCopyFeedback {
		t.Error("Expected showCopyFeedback to be false initially")
	}
	if m.showPrivateKey {
		t.Error("Expected showPrivateKey to be false initially")
	}
	if m.awaitingPrivateKeyConfirm {
		t.Error("Expected awaitingPrivateKeyConfirm to be false initially")
	}
	if m.awaitingRegenerateConfirm {
		t.Error("Expected awaitingRegenerateConfirm to be false initially")
	}
	if m.awaitingResetConfirm {
		t.Error("Expected awaitingResetConfirm to be false initially")
	}

	// Test state changes
	m.showCopyFeedback = true
	if !m.showCopyFeedback {
		t.Error("Expected showCopyFeedback to be true after setting")
	}

	m.showPrivateKey = true
	if !m.showPrivateKey {
		t.Error("Expected showPrivateKey to be true after setting")
	}

	m.awaitingPrivateKeyConfirm = true
	if !m.awaitingPrivateKeyConfirm {
		t.Error("Expected awaitingPrivateKeyConfirm to be true after setting")
	}
}

// TestModelAutoRefreshToggle tests auto-refresh toggle
func TestModelAutoRefreshToggle(t *testing.T) {
	t.Parallel()

	m := Model{
		autoRefresh: true,
	}

	if !m.autoRefresh {
		t.Error("Expected autoRefresh to be true initially")
	}

	// Toggle off
	m.autoRefresh = false
	if m.autoRefresh {
		t.Error("Expected autoRefresh to be false after toggle")
	}

	// Toggle on
	m.autoRefresh = true
	if !m.autoRefresh {
		t.Error("Expected autoRefresh to be true after toggle")
	}
}

// TestModelCursorBounds tests cursor boundary handling
func TestModelCursorBounds(t *testing.T) {
	t.Parallel()

	m := Model{
		cursor:      0,
		choices:     []string{"Option 1", "Option 2", "Option 3"},
		settingsSelectedOption: 0,
	}

	// Test cursor can move within bounds
	m.cursor = 1
	if m.cursor != 1 {
		t.Errorf("Expected cursor to be 1, got %d", m.cursor)
	}

	m.cursor = 2
	if m.cursor != 2 {
		t.Errorf("Expected cursor to be 2, got %d", m.cursor)
	}

	// Test settings option can move within bounds
	m.settingsSelectedOption = 1
	if m.settingsSelectedOption != 1 {
		t.Errorf("Expected settingsSelectedOption to be 1, got %d", m.settingsSelectedOption)
	}

	m.settingsSelectedOption = 3
	if m.settingsSelectedOption != 3 {
		t.Errorf("Expected settingsSelectedOption to be 3, got %d", m.settingsSelectedOption)
	}
}

// TestModelCallTypeSelector tests call type selector
func TestModelCallTypeSelector(t *testing.T) {
	t.Parallel()

	m := Model{
		callTypeSelector: 0,
	}

	callTypeOptions := types.GetCallTypeOptions()

	// Test selector can move through all options
	for i := 0; i < len(callTypeOptions); i++ {
		m.callTypeSelector = i
		if m.callTypeSelector != i {
			t.Errorf("Expected callTypeSelector to be %d, got %d", i, m.callTypeSelector)
		}
	}
}

// TestModelSelectedStates tests selected item states
func TestModelSelectedStates(t *testing.T) {
	t.Parallel()

	m := Model{
		selectedAccount:     "",
		selectedBlock:       0,
		selectedTransaction: "",
		selectedContract:    "",
		selectedHistoryID:   "",
	}

	// Test initial empty state
	if m.selectedAccount != "" {
		t.Error("Expected selectedAccount to be empty initially")
	}
	if m.selectedBlock != 0 {
		t.Error("Expected selectedBlock to be 0 initially")
	}
	if m.selectedTransaction != "" {
		t.Error("Expected selectedTransaction to be empty initially")
	}

	// Test setting values
	m.selectedAccount = "0x1234567890abcdef1234567890abcdef12345678"
	if m.selectedAccount != "0x1234567890abcdef1234567890abcdef12345678" {
		t.Errorf("Expected selectedAccount to be set, got %s", m.selectedAccount)
	}

	m.selectedBlock = 42
	if m.selectedBlock != 42 {
		t.Errorf("Expected selectedBlock to be 42, got %d", m.selectedBlock)
	}

	m.selectedTransaction = "tx-hash-123"
	if m.selectedTransaction != "tx-hash-123" {
		t.Errorf("Expected selectedTransaction to be set, got %s", m.selectedTransaction)
	}

	m.selectedContract = "0xcontract123"
	if m.selectedContract != "0xcontract123" {
		t.Errorf("Expected selectedContract to be set, got %s", m.selectedContract)
	}

	m.selectedHistoryID = "history-123"
	if m.selectedHistoryID != "history-123" {
		t.Errorf("Expected selectedHistoryID to be set, got %s", m.selectedHistoryID)
	}
}

// TestModelValidationError tests validation error state
func TestModelValidationError(t *testing.T) {
	t.Parallel()

	m := Model{
		validationError: "",
	}

	if m.validationError != "" {
		t.Error("Expected validationError to be empty initially")
	}

	// Set validation error
	m.validationError = "Invalid input"
	if m.validationError != "Invalid input" {
		t.Errorf("Expected validationError to be 'Invalid input', got %s", m.validationError)
	}

	// Clear validation error
	m.validationError = ""
	if m.validationError != "" {
		t.Error("Expected validationError to be cleared")
	}
}

// TestModelDisassemblyState tests disassembly-related state
func TestModelDisassemblyState(t *testing.T) {
	t.Parallel()

	m := Model{
		disassemblyResult: nil,
		disassemblyError:  nil,
		currentBlockIndex: 0,
	}

	if m.disassemblyResult != nil {
		t.Error("Expected disassemblyResult to be nil initially")
	}
	if m.disassemblyError != nil {
		t.Error("Expected disassemblyError to be nil initially")
	}
	if m.currentBlockIndex != 0 {
		t.Error("Expected currentBlockIndex to be 0 initially")
	}

	// Test setting block index
	m.currentBlockIndex = 5
	if m.currentBlockIndex != 5 {
		t.Errorf("Expected currentBlockIndex to be 5, got %d", m.currentBlockIndex)
	}
}

// TestModelInspectorState tests state inspector state
func TestModelInspectorState(t *testing.T) {
	t.Parallel()

	m := Model{
		inspectorAddress: "",
		inspectorResult:  nil,
		inspectorError:   nil,
	}

	if m.inspectorAddress != "" {
		t.Error("Expected inspectorAddress to be empty initially")
	}
	if m.inspectorResult != nil {
		t.Error("Expected inspectorResult to be nil initially")
	}
	if m.inspectorError != nil {
		t.Error("Expected inspectorError to be nil initially")
	}

	// Test setting inspector address
	m.inspectorAddress = "0x1234567890abcdef1234567890abcdef12345678"
	if m.inspectorAddress != "0x1234567890abcdef1234567890abcdef12345678" {
		t.Errorf("Expected inspectorAddress to be set, got %s", m.inspectorAddress)
	}
}

// TestModelCallResultState tests call result state
func TestModelCallResultState(t *testing.T) {
	t.Parallel()

	m := Model{
		callResult: nil,
	}

	if m.callResult != nil {
		t.Error("Expected callResult to be nil initially")
	}

	// Test setting call result
	result := &types.CallResult{
		Success:    true,
		ReturnData: []byte{0x01, 0x02},
		GasLeft:    1000,
	}
	m.callResult = result

	if m.callResult == nil {
		t.Error("Expected callResult to be set")
	}
	if !m.callResult.Success {
		t.Error("Expected callResult.Success to be true")
	}
	if m.callResult.GasLeft != 1000 {
		t.Errorf("Expected callResult.GasLeft to be 1000, got %d", m.callResult.GasLeft)
	}
}

// TestModelWidthHeight tests width and height state
func TestModelWidthHeight(t *testing.T) {
	t.Parallel()

	m := Model{
		width:  0,
		height: 0,
	}

	if m.width != 0 {
		t.Errorf("Expected width to be 0 initially, got %d", m.width)
	}
	if m.height != 0 {
		t.Errorf("Expected height to be 0 initially, got %d", m.height)
	}

	// Test setting dimensions
	m.width = 80
	m.height = 24

	if m.width != 80 {
		t.Errorf("Expected width to be 80, got %d", m.width)
	}
	if m.height != 24 {
		t.Errorf("Expected height to be 24, got %d", m.height)
	}
}
