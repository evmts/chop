package app

import (
	"chop/internal/core/bytecode"
	"chop/internal/core/evm"
	"chop/internal/core/history"
	"chop/internal/types"

	"github.com/charmbracelet/bubbles/table"
	"github.com/charmbracelet/bubbles/textinput"
)

type Model struct {
	greeting string
	cursor   int
	choices  []string
	quitting bool
	width    int
	height   int

	// Call-related state
	state            types.AppState
	callParams       types.CallParametersStrings
	callParamCursor  int
	editingParam     string
	textInput        textinput.Model
	validationError  string
	callResult       *types.CallResult
	callTypeSelector int

	// Managers
	vmManager      *evm.VMManager
	historyManager *history.HistoryManager

	// View states
	historyTable      table.Model
	contractsTable    table.Model
	logsTable         table.Model
	selectedHistoryID string
	selectedContract  string
	selectedLogIndex  int

	// Disassembly state
	disassemblyResult *bytecode.DisassemblyResult
	disassemblyError  error
	currentBlockIndex int
	instructionsTable table.Model

	// UI state
	showCopyFeedback bool
	copyFeedbackMsg  string
}
