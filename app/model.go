package app

import (
	"chop/core/bytecode"
	"chop/core/evm"
	"chop/core/history"
	"chop/types"

	"github.com/charmbracelet/bubbles/table"
	"github.com/charmbracelet/bubbles/textinput"

	"chop/core/accounts"
	"chop/core/blockchain"
	"chop/core/events"
	"chop/core/state"
)

type Model struct {
	greeting string
	cursor   int
	choices  []string
	quitting bool
	width    int
	height   int

	// Navigation
	currentTab types.Tab
	navStack   types.NavigationStack

	// Call-related state
	state            types.AppState
	callParams       types.CallParametersStrings
	callParamCursor  int
	editingParam     string
	textInput        textinput.Model
	validationError  string
	callResult       *types.CallResult
	callTypeSelector int

	// Core managers (enhanced)
	vmManager        *evm.VMManager
	historyManager   *history.HistoryManager
	accountManager   *accounts.Manager
	blockchainChain  *blockchain.Chain
	eventBus         *events.Bus
	stateInspector   *state.Inspector

	// View states (existing)
	historyTable      table.Model
	contractsTable    table.Model
	logsTable         table.Model
	selectedHistoryID string
	selectedContract  string
	selectedLogIndex  int

	// New view states
	accountsTable       table.Model
	blocksTable         table.Model
	transactionsTable   table.Model
	selectedAccount     string
	selectedBlock       uint64
	selectedTransaction string
	inspectorAddress    string

	// State inspector state
	inspectorInput  textinput.Model
	inspectorResult *types.AccountState
	inspectorError  error

	// Dashboard state
	lastUpdate     int64 // Unix timestamp of last update
	autoRefresh    bool  // Whether to auto-refresh dashboard

	// Disassembly state
	disassemblyResult *bytecode.DisassemblyResult
	disassemblyError  error
	currentBlockIndex int
	instructionsTable table.Model

    // UI state
    showCopyFeedback         bool
    copyFeedbackMsg          string
    showPrivateKey           bool
    awaitingPrivateKeyConfirm bool
    awaitingRegenerateConfirm bool
}
