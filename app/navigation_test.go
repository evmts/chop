package app

import (
	"chop/types"
	"testing"
)

// TestNavigationStackPush tests pushing states onto the navigation stack
func TestNavigationStackPush(t *testing.T) {
	t.Parallel()

	stack := types.NavigationStack{}

	// Verify initial empty state
	if stack.Depth() != 0 {
		t.Errorf("Expected initial depth to be 0, got %d", stack.Depth())
	}

	// Push first state
	stack.Push(types.StateAccountsList, nil)
	if stack.Depth() != 1 {
		t.Errorf("Expected depth to be 1 after first push, got %d", stack.Depth())
	}

	// Push second state
	stack.Push(types.StateAccountDetail, "0x1234")
	if stack.Depth() != 2 {
		t.Errorf("Expected depth to be 2 after second push, got %d", stack.Depth())
	}

	// Push third state
	stack.Push(types.StateTransactionDetail, "tx-hash")
	if stack.Depth() != 3 {
		t.Errorf("Expected depth to be 3 after third push, got %d", stack.Depth())
	}
}

// TestNavigationStackPop tests popping states from the navigation stack
func TestNavigationStackPop(t *testing.T) {
	t.Parallel()

	stack := types.NavigationStack{}

	// Push states
	stack.Push(types.StateAccountsList, nil)
	stack.Push(types.StateAccountDetail, "0x1234")
	stack.Push(types.StateTransactionDetail, "tx-hash")

	// Pop first state
	state, data := stack.Pop()
	if state != types.StateTransactionDetail {
		t.Errorf("Expected to pop StateTransactionDetail, got %v", state)
	}
	if data != "tx-hash" {
		t.Errorf("Expected to pop data 'tx-hash', got %v", data)
	}
	if stack.Depth() != 2 {
		t.Errorf("Expected depth to be 2 after first pop, got %d", stack.Depth())
	}

	// Pop second state
	state, data = stack.Pop()
	if state != types.StateAccountDetail {
		t.Errorf("Expected to pop StateAccountDetail, got %v", state)
	}
	if data != "0x1234" {
		t.Errorf("Expected to pop data '0x1234', got %v", data)
	}
	if stack.Depth() != 1 {
		t.Errorf("Expected depth to be 1 after second pop, got %d", stack.Depth())
	}

	// Pop third state
	state, data = stack.Pop()
	if state != types.StateAccountsList {
		t.Errorf("Expected to pop StateAccountsList, got %v", state)
	}
	if data != nil {
		t.Errorf("Expected to pop nil data, got %v", data)
	}
	if stack.Depth() != 0 {
		t.Errorf("Expected depth to be 0 after third pop, got %d", stack.Depth())
	}
}

// TestNavigationStackPopEmpty tests popping from an empty stack
func TestNavigationStackPopEmpty(t *testing.T) {
	t.Parallel()

	stack := types.NavigationStack{}

	// Pop from empty stack should return StateDashboard and nil
	state, data := stack.Pop()
	if state != types.StateDashboard {
		t.Errorf("Expected to pop StateDashboard from empty stack, got %v", state)
	}
	if data != nil {
		t.Errorf("Expected to pop nil data from empty stack, got %v", data)
	}
	if stack.Depth() != 0 {
		t.Errorf("Expected depth to remain 0 after popping empty stack, got %d", stack.Depth())
	}
}

// TestNavigationStackPeek tests peeking at the top of the stack
func TestNavigationStackPeek(t *testing.T) {
	t.Parallel()

	stack := types.NavigationStack{}

	// Push states
	stack.Push(types.StateAccountsList, nil)
	stack.Push(types.StateAccountDetail, "0x1234")

	// Peek should return the top state without removing it
	state, data := stack.Peek()
	if state != types.StateAccountDetail {
		t.Errorf("Expected to peek StateAccountDetail, got %v", state)
	}
	if data != "0x1234" {
		t.Errorf("Expected to peek data '0x1234', got %v", data)
	}

	// Depth should remain unchanged
	if stack.Depth() != 2 {
		t.Errorf("Expected depth to remain 2 after peek, got %d", stack.Depth())
	}

	// Peek again should return the same values
	state2, data2 := stack.Peek()
	if state2 != state {
		t.Errorf("Expected peek to return same state, got %v and %v", state, state2)
	}
	if data2 != data {
		t.Errorf("Expected peek to return same data, got %v and %v", data, data2)
	}
}

// TestNavigationStackPeekEmpty tests peeking at an empty stack
func TestNavigationStackPeekEmpty(t *testing.T) {
	t.Parallel()

	stack := types.NavigationStack{}

	// Peek at empty stack should return StateDashboard and nil
	state, data := stack.Peek()
	if state != types.StateDashboard {
		t.Errorf("Expected to peek StateDashboard from empty stack, got %v", state)
	}
	if data != nil {
		t.Errorf("Expected to peek nil data from empty stack, got %v", data)
	}
}

// TestNavigationStackClear tests clearing the navigation stack
func TestNavigationStackClear(t *testing.T) {
	t.Parallel()

	stack := types.NavigationStack{}

	// Push some states
	stack.Push(types.StateAccountsList, nil)
	stack.Push(types.StateAccountDetail, "0x1234")
	stack.Push(types.StateTransactionDetail, "tx-hash")

	if stack.Depth() != 3 {
		t.Errorf("Expected depth to be 3 before clear, got %d", stack.Depth())
	}

	// Clear the stack
	stack.Clear()

	if stack.Depth() != 0 {
		t.Errorf("Expected depth to be 0 after clear, got %d", stack.Depth())
	}

	// Verify stack is empty by attempting to pop
	state, data := stack.Pop()
	if state != types.StateDashboard {
		t.Errorf("Expected to pop StateDashboard from cleared stack, got %v", state)
	}
	if data != nil {
		t.Errorf("Expected to pop nil data from cleared stack, got %v", data)
	}
}

// TestNavigationStackDepth tests the Depth function
func TestNavigationStackDepth(t *testing.T) {
	t.Parallel()

	stack := types.NavigationStack{}

	// Test empty stack
	if stack.Depth() != 0 {
		t.Errorf("Expected depth to be 0 for empty stack, got %d", stack.Depth())
	}

	// Test depth increases with pushes
	for i := 1; i <= 5; i++ {
		stack.Push(types.StateAccountsList, nil)
		if stack.Depth() != i {
			t.Errorf("Expected depth to be %d after %d pushes, got %d", i, i, stack.Depth())
		}
	}

	// Test depth decreases with pops
	for i := 4; i >= 0; i-- {
		stack.Pop()
		if stack.Depth() != i {
			t.Errorf("Expected depth to be %d after pop, got %d", i, stack.Depth())
		}
	}
}

// TestNavigationStackWithData tests stack operations with various data types
func TestNavigationStackWithData(t *testing.T) {
	t.Parallel()

	stack := types.NavigationStack{}

	// Push with nil data
	stack.Push(types.StateAccountsList, nil)

	// Push with string data
	stack.Push(types.StateAccountDetail, "0x1234567890abcdef")

	// Push with integer data
	stack.Push(types.StateBlockDetail, 42)

	// Pop and verify
	state, data := stack.Pop()
	if state != types.StateBlockDetail {
		t.Errorf("Expected StateBlockDetail, got %v", state)
	}
	if intData, ok := data.(int); !ok || intData != 42 {
		t.Errorf("Expected int data 42, got %v", data)
	}

	state, data = stack.Pop()
	if state != types.StateAccountDetail {
		t.Errorf("Expected StateAccountDetail, got %v", state)
	}
	if strData, ok := data.(string); !ok || strData != "0x1234567890abcdef" {
		t.Errorf("Expected string data '0x1234567890abcdef', got %v", data)
	}

	state, data = stack.Pop()
	if state != types.StateAccountsList {
		t.Errorf("Expected StateAccountsList, got %v", state)
	}
	if data != nil {
		t.Errorf("Expected nil data, got %v", data)
	}
}

// TestNavigationStackMultiplePushPop tests complex push/pop sequences
func TestNavigationStackMultiplePushPop(t *testing.T) {
	t.Parallel()

	stack := types.NavigationStack{}

	// Push 3, pop 2, push 2, pop 1, push 1
	stack.Push(types.StateAccountsList, "1")
	stack.Push(types.StateAccountDetail, "2")
	stack.Push(types.StateBlocksList, "3")

	if stack.Depth() != 3 {
		t.Errorf("Expected depth 3, got %d", stack.Depth())
	}

	stack.Pop()
	stack.Pop()

	if stack.Depth() != 1 {
		t.Errorf("Expected depth 1 after popping 2, got %d", stack.Depth())
	}

	stack.Push(types.StateTransactionsList, "4")
	stack.Push(types.StateContracts, "5")

	if stack.Depth() != 3 {
		t.Errorf("Expected depth 3 after pushing 2 more, got %d", stack.Depth())
	}

	state, data := stack.Pop()
	if state != types.StateContracts {
		t.Errorf("Expected StateContracts, got %v", state)
	}
	if data != "5" {
		t.Errorf("Expected data '5', got %v", data)
	}

	if stack.Depth() != 2 {
		t.Errorf("Expected depth 2, got %d", stack.Depth())
	}

	stack.Push(types.StateSettings, "6")

	if stack.Depth() != 3 {
		t.Errorf("Expected depth 3 after final push, got %d", stack.Depth())
	}
}

// TestNavigationStackClearAndReuse tests clearing and reusing the stack
func TestNavigationStackClearAndReuse(t *testing.T) {
	t.Parallel()

	stack := types.NavigationStack{}

	// Use the stack
	stack.Push(types.StateAccountsList, "a")
	stack.Push(types.StateAccountDetail, "b")
	stack.Clear()

	if stack.Depth() != 0 {
		t.Errorf("Expected depth 0 after clear, got %d", stack.Depth())
	}

	// Reuse the stack
	stack.Push(types.StateTransactionsList, "c")
	stack.Push(types.StateTransactionDetail, "d")

	if stack.Depth() != 2 {
		t.Errorf("Expected depth 2 after reuse, got %d", stack.Depth())
	}

	state, data := stack.Pop()
	if state != types.StateTransactionDetail {
		t.Errorf("Expected StateTransactionDetail, got %v", state)
	}
	if data != "d" {
		t.Errorf("Expected data 'd', got %v", data)
	}
}

// TestNavigationStackBreadcrumbs tests navigation stack for breadcrumb navigation
func TestNavigationStackBreadcrumbs(t *testing.T) {
	t.Parallel()

	stack := types.NavigationStack{}

	// Simulate navigation: Dashboard -> Accounts -> Account Detail -> Transaction Detail
	stack.Push(types.StateDashboard, nil)
	stack.Push(types.StateAccountsList, nil)
	stack.Push(types.StateAccountDetail, "0xAccount123")
	stack.Push(types.StateTransactionDetail, "tx-456")

	// Navigate back: should go to Account Detail
	state, data := stack.Pop()
	if state != types.StateTransactionDetail {
		t.Errorf("Expected current state to be StateTransactionDetail, got %v", state)
	}

	// Now we're at Account Detail
	state, data = stack.Peek()
	if state != types.StateAccountDetail {
		t.Errorf("Expected to be at StateAccountDetail, got %v", state)
	}
	if data != "0xAccount123" {
		t.Errorf("Expected account data '0xAccount123', got %v", data)
	}

	// Navigate back again: should go to Accounts List
	stack.Pop()
	state, _ = stack.Peek()
	if state != types.StateAccountsList {
		t.Errorf("Expected to be at StateAccountsList, got %v", state)
	}

	// Navigate back again: should go to Dashboard
	stack.Pop()
	state, _ = stack.Peek()
	if state != types.StateDashboard {
		t.Errorf("Expected to be at StateDashboard, got %v", state)
	}
}

// TestNavigationStackTabSwitchClear tests that tab switches clear the stack
func TestNavigationStackTabSwitchClear(t *testing.T) {
	t.Parallel()

	m := Model{
		navStack: types.NavigationStack{},
		state:    types.StateDashboard,
	}

	// Navigate through some states
	m.navStack.Push(types.StateAccountsList, nil)
	m.navStack.Push(types.StateAccountDetail, "0x123")

	if m.navStack.Depth() != 2 {
		t.Errorf("Expected stack depth 2, got %d", m.navStack.Depth())
	}

	// Simulate tab switch (like pressing "1" for Dashboard)
	m.navStack.Clear()
	m.state = types.StateDashboard

	if m.navStack.Depth() != 0 {
		t.Errorf("Expected stack to be cleared after tab switch, got depth %d", m.navStack.Depth())
	}
}

// TestNavigationStackStateTransitions tests realistic state transitions
func TestNavigationStackStateTransitions(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name          string
		operations    []func(*types.NavigationStack)
		expectedDepth int
		expectedTop   types.AppState
	}{
		{
			name: "Simple forward navigation",
			operations: []func(*types.NavigationStack){
				func(s *types.NavigationStack) { s.Push(types.StateAccountsList, nil) },
				func(s *types.NavigationStack) { s.Push(types.StateAccountDetail, "0x123") },
			},
			expectedDepth: 2,
			expectedTop:   types.StateAccountDetail,
		},
		{
			name: "Forward then back",
			operations: []func(*types.NavigationStack){
				func(s *types.NavigationStack) { s.Push(types.StateAccountsList, nil) },
				func(s *types.NavigationStack) { s.Push(types.StateAccountDetail, "0x123") },
				func(s *types.NavigationStack) { s.Pop() },
			},
			expectedDepth: 1,
			expectedTop:   types.StateAccountsList,
		},
		{
			name: "Multiple forwards and backs",
			operations: []func(*types.NavigationStack){
				func(s *types.NavigationStack) { s.Push(types.StateAccountsList, nil) },
				func(s *types.NavigationStack) { s.Push(types.StateAccountDetail, "0x123") },
				func(s *types.NavigationStack) { s.Pop() },
				func(s *types.NavigationStack) { s.Push(types.StateBlocksList, nil) },
				func(s *types.NavigationStack) { s.Push(types.StateBlockDetail, 42) },
			},
			expectedDepth: 3,
			expectedTop:   types.StateBlockDetail,
		},
		{
			name: "Clear operation",
			operations: []func(*types.NavigationStack){
				func(s *types.NavigationStack) { s.Push(types.StateAccountsList, nil) },
				func(s *types.NavigationStack) { s.Push(types.StateAccountDetail, "0x123") },
				func(s *types.NavigationStack) { s.Clear() },
			},
			expectedDepth: 0,
			expectedTop:   types.StateDashboard, // Default when stack is empty
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			stack := types.NavigationStack{}

			// Execute operations
			for _, op := range tt.operations {
				op(&stack)
			}

			// Check depth
			if stack.Depth() != tt.expectedDepth {
				t.Errorf("Expected depth %d, got %d", tt.expectedDepth, stack.Depth())
			}

			// Check top state
			state, _ := stack.Peek()
			if state != tt.expectedTop {
				t.Errorf("Expected top state %v, got %v", tt.expectedTop, state)
			}
		})
	}
}
