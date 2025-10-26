package app

import (
    "chop/core/accounts"
    "chop/config"
    "chop/core/bytecode"
    "chop/core/evm"
    "chop/core/state"
    "chop/core/utils"
    "chop/fixtures"
    "chop/tui"
    "chop/types"
    "fmt"
    "strconv"
    "strings"
    "time"

	tea "github.com/charmbracelet/bubbletea"
)

// Message types for tea commands
type resetCompleteMsg struct{}
type callResultMsg struct {
	result *types.CallResult
	params types.CallParametersStrings
}
type copyFeedbackMsg struct {
	message string
}
type disassemblyResultMsg struct {
	result *bytecode.DisassemblyResult
	error  error
}
type persistenceErrorMsg struct {
	error string
}
type feedbackMsg struct {
	message  string
	duration time.Duration
}

// handleMainMenuSelect handles menu item selection on the main menu
func (m Model) handleMainMenuSelect() (tea.Model, tea.Cmd) {
	switch m.choices[m.cursor] {
	case config.MenuMakeCall:
		m.state = types.StateCallParameterList
		m.callParamCursor = 0
		return m, nil
	case config.MenuCallHistory:
		m.state = types.StateCallHistory
		m.updateHistoryTable()
		return m, nil
	case config.MenuFixtures:
		m.state = types.StateFixturesList
		m.updateFixturesTable()
		return m, nil
	case config.MenuContracts:
		m.state = types.StateContracts
		m.updateContractsTable()
		return m, nil
	case config.MenuResetState:
		return m.handleResetState()
	case config.MenuExit:
		m.quitting = true
		// Perform cleanup before exiting
		if m.vmManager != nil {
			m.vmManager.Close()
		}
		return m, tea.Batch(tea.ExitAltScreen, tea.Quit)
	default:
		return m, nil
	}
}

// handleCallParamSelect handles selecting a call parameter for editing
func (m Model) handleCallParamSelect() (tea.Model, tea.Cmd) {
	params := GetCallParams(m.callParams)
	if m.callParamCursor >= len(params) {
		return m, nil
	}

	param := params[m.callParamCursor]
	m.editingParam = param.Name

	if param.Name == config.CallParamCallType {
		// Initialize call type selector with current value
		options := types.GetCallTypeOptions()
		m.callTypeSelector = 0
		for i, opt := range options {
			if opt == param.Value {
				m.callTypeSelector = i
				break
			}
		}
		m.state = types.StateCallTypeEdit
	} else {
		m.textInput = tui.CreateTextInput(param.Name, param.Value)
		m.state = types.StateCallParameterEdit
	}

	m.validationError = ""

	return m, nil
}

// handleCallEditSave handles saving an edited call parameter
func (m Model) handleCallEditSave() (tea.Model, tea.Cmd) {
	if m.editingParam == config.CallParamCallType {
		// Handle call type selection
		options := types.GetCallTypeOptions()
		if m.callTypeSelector >= 0 && m.callTypeSelector < len(options) {
			selectedType := options[m.callTypeSelector]
			SetCallParam(&m.callParams, m.editingParam, selectedType)
		}
		m.state = types.StateCallParameterList
		return m, nil
	}

	// Handle text input fields
	value := m.textInput.Value()

	// Field-specific validation
	validator := evm.NewCallValidator()
	if err := validator.ValidateField(m.editingParam, value); err != nil {
		// Use UIError for better user experience in UI context
		if inputErr, ok := err.(types.InputParamError); ok {
			m.validationError = inputErr.UIError()
		} else {
			m.validationError = err.Error()
		}
		return m, nil
	}

	SetCallParam(&m.callParams, m.editingParam, value)
	m.state = types.StateCallParameterList
	return m, nil
}

// handleCallExecute handles executing the EVM call
func (m Model) handleCallExecute() (tea.Model, tea.Cmd) {
	validator := evm.NewCallValidator()
	if err := validator.ValidateCallParameters(m.callParams); err != nil {
		m.validationError = err.Error()
		return m, nil
	}

	m.state = types.StateCallExecuting
	return m, m.executeCallCmd(m.callParams)
}

// executeCallCmd creates a command to execute an EVM call asynchronously
func (m *Model) executeCallCmd(params types.CallParametersStrings) tea.Cmd {
	return func() tea.Msg {
		result, err := evm.ExecuteCall(m.vmManager, params)
		if err != nil {
			result = &types.CallResult{
				Success:   false,
				ErrorInfo: err.Error(),
				GasLeft:   0,
			}
		}

		// Create timestamp once for both persistence and history
		executionTime := time.Now()

		// Persist call parameters after execution (best effort, errors shown as feedback)
		persistedCall := state.ConvertFromCallParameters(params, executionTime)
		if err := state.AppendCall(state.GetStateFilePath(), persistedCall); err != nil {
			// Don't block on persistence failure, just log (could add feedback message if needed)
			fmt.Printf("Warning: Failed to persist call: %v\n", err)
		}

		entry := types.CallHistoryEntry{
			Parameters: params,
			Result:     result,
			Timestamp:  executionTime,
		}
		m.historyManager.AddCall(entry)

		return callResultMsg{result: result, params: params}
	}
}

// resetParameter resets a parameter to its default value
func (m *Model) resetParameter(paramName string, updateInput bool) {
	defaults := config.GetCallDefaults()

	defaultValue := ""
	switch paramName {
	case config.CallParamCallType:
		defaultValue = types.CallTypeToString(defaults.CallType)
	case config.CallParamCaller:
		defaultValue = defaults.CallerAddr
	case config.CallParamTarget:
		defaultValue = defaults.TargetAddr
	case config.CallParamValue:
		defaultValue = defaults.Value
	case config.CallParamGasLimit:
		defaultValue = config.DefaultGasLimit
	case config.CallParamInput, config.CallParamInputDeploy:
		defaultValue = defaults.InputData
	case config.CallParamSalt:
		defaultValue = defaults.Salt
	}

	// Update the parameter value
	SetCallParam(&m.callParams, paramName, defaultValue)

	// Update UI inputs if requested
	if updateInput {
		if paramName == config.CallParamCallType {
			options := types.GetCallTypeOptions()
			for i, opt := range options {
				if opt == defaultValue {
					m.callTypeSelector = i
					break
				}
			}
		} else if m.textInput.Value() != "" {
			m.textInput.SetValue(defaultValue)
		}
	}

	m.validationError = ""
}

// handleResetParameter handles resetting the current parameter to default
func (m Model) handleResetParameter() (tea.Model, tea.Cmd) {
	params := GetCallParams(m.callParams)
	if m.callParamCursor >= len(params) {
		return m, nil
	}

	param := params[m.callParamCursor]
	m.resetParameter(param.Name, false)
	return m, nil
}

// handleResetCurrentParameter handles resetting the currently editing parameter
func (m Model) handleResetCurrentParameter() (tea.Model, tea.Cmd) {
	m.resetParameter(m.editingParam, true)
	return m, nil
}

// handleResetAllParameters handles resetting all parameters to defaults
func (m Model) handleResetAllParameters() (tea.Model, tea.Cmd) {
	m.callParams = NewCallParameters()
	return m, nil
}

// handleResetState handles the reset state menu option
func (m Model) handleResetState() (tea.Model, tea.Cmd) {
	m.state = types.StateConfirmReset
	return m, nil
}

// executeReset performs the actual state reset
func (m Model) executeReset() tea.Cmd {
	return func() tea.Msg {
		// Clear state file
		state.ClearStateFile(state.GetStateFilePath())

		// Create fresh VM manager
		newVmManager, err := evm.GetVMManager()
		if err == nil {
			// Clean up old VM
			if m.vmManager != nil {
				m.vmManager.Close()
			}
			m.vmManager = newVmManager
		}

		// Clear history
		m.historyManager.Clear()

		// Reset call parameters
		m.callParams = NewCallParameters()

		return resetCompleteMsg{}
	}
}

// getCopyContent returns the content to copy based on current state
func (m *Model) getCopyContent() string {
    switch m.state {
    case types.StateContractDetail:
        contract := m.historyManager.GetContract(m.selectedContract)
        if contract != nil {
            return contract.Address
        }
    case types.StateTransactionDetail:
        if m.selectedTransaction != "" {
            if tx, err := m.blockchainChain.GetTransaction(m.selectedTransaction); err == nil && tx != nil {
                return tx.Hash
            }
        }
    }

    return ""
}

// handleCopy handles copying content to clipboard based on current state
func (m Model) handleCopy() (tea.Model, tea.Cmd) {
	content := m.getCopyContent()

	if content != "" {
		msg, _ := tui.CopyWithFeedback(content)
		m.showCopyFeedback = true
		m.copyFeedbackMsg = msg
		return m, tea.Tick(time.Second*2, func(time.Time) tea.Msg {
			return copyFeedbackMsg{message: ""}
		})
	}

	return m, nil
}

// loadDisassemblyCmd creates a command to load bytecode disassembly
func (m Model) loadDisassemblyCmd(bc []byte) tea.Cmd {
	return func() tea.Msg {
		// Call the disassembly domain directly
		result, err := bytecode.AnalyzeBytecodeFromBytes(bc)
		return disassemblyResultMsg{
			result: result,
			error:  err,
		}
	}
}

// handleStateNavigation handles state-based navigation for keyboard input
func (m *Model) handleStateNavigation(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	msgStr := msg.String()

	// Handle quit
	if config.IsKey(msgStr, config.KeyQuit) {
		m.quitting = true
		return m, tea.Batch(tea.ExitAltScreen, tea.Quit)
	}

	// Handle clipboard shortcuts
	if config.IsKey(msgStr, config.KeyCopy) {
		return m.handleCopy()
	}

	// Handle navigation keys based on current state
	switch m.state {
	case types.StateMainMenu:
		return m.handleMainMenuNavigation(msgStr)

	case types.StateCallParameterList:
		return m.handleCallParamListNavigation(msgStr)

	case types.StateCallParameterEdit:
		return m.handleCallParamEditNavigation(msgStr, msg)

	case types.StateCallTypeEdit:
		return m.handleCallTypeEditNavigation(msgStr)

	case types.StateCallResult:
		return m.handleCallResultNavigation(msgStr, msg)

	case types.StateCallHistory:
		return m.handleCallHistoryNavigation(msgStr, msg)

	case types.StateCallHistoryDetail:
		return m.handleHistoryDetailNavigation(msgStr, msg)

	case types.StateLogDetail:
		return m.handleLogDetailNavigation(msgStr)

	case types.StateContracts:
		return m.handleContractsNavigation(msgStr, msg)

	case types.StateContractDetail:
		return m.handleContractDetailNavigation(msgStr, msg)

	case types.StateConfirmReset:
		return m.handleConfirmResetNavigation(msgStr)

	case types.StateFixturesList:
		return m.handleFixturesListNavigation(msgStr, msg)

	// New tab-based states
	case types.StateDashboard:
		return m.handleDashboardNavigation(msgStr)

	case types.StateAccountsList:
		return m.handleAccountsListNavigation(msgStr, msg)

	case types.StateBlocksList:
		return m.handleBlocksListNavigation(msgStr, msg)

	case types.StateTransactionsList:
		return m.handleTransactionsListNavigation(msgStr, msg)

	case types.StateStateInspector:
		return m.handleStateInspectorNavigation(msgStr, msg)

	case types.StateSettings:
		return m.handleSettingsNavigation(msgStr)

	case types.StateAccountDetail:
		return m.handleAccountDetailNavigation(msgStr)

	case types.StateBlockDetail:
		return m.handleBlockDetailNavigation(msgStr)

	case types.StateTransactionDetail:
		return m.handleTransactionDetailNavigation(msgStr, msg)

	case types.StateGotoPC:
		return m.handleGotoPCNavigation(msgStr, msg)
	}

	return m, nil
}

// handleMainMenuNavigation handles navigation in main menu state
func (m *Model) handleMainMenuNavigation(msgStr string) (tea.Model, tea.Cmd) {
	if config.IsKey(msgStr, config.KeyUp) {
		if m.cursor > 0 {
			m.cursor--
		}
	} else if config.IsKey(msgStr, config.KeyDown) {
		if m.cursor < len(m.choices)-1 {
			m.cursor++
		}
	} else if config.IsKey(msgStr, config.KeySelect) {
		return m.handleMainMenuSelect()
	}
	return m, nil
}

// handleCallParamListNavigation handles navigation in call parameter list state
func (m *Model) handleCallParamListNavigation(msgStr string) (tea.Model, tea.Cmd) {
	if config.IsKey(msgStr, config.KeyUp) {
		if m.callParamCursor > 0 {
			m.callParamCursor--
		}
	} else if config.IsKey(msgStr, config.KeyDown) {
		params := GetCallParams(m.callParams)
		if m.callParamCursor < len(params)-1 {
			m.callParamCursor++
		}
	} else if config.IsKey(msgStr, config.KeySelect) {
		m.validationError = "" // Clear validation errors when navigating to edit
		return m.handleCallParamSelect()
	} else if config.IsKey(msgStr, config.KeyBack) {
		m.state = types.StateMainMenu
		return m, nil
	} else if config.IsKey(msgStr, config.KeyExecute) {
		return m.handleCallExecute()
	} else if config.IsKey(msgStr, config.KeyReset) {
		return m.handleResetParameter()
	} else if config.IsKey(msgStr, config.KeyResetAll) {
		return m.handleResetAllParameters()
	}
	return m, nil
}

// handleCallParamEditNavigation handles navigation in call parameter edit state
func (m *Model) handleCallParamEditNavigation(msgStr string, msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	// Handle paste specially to get clipboard content
	if config.IsKey(msgStr, config.KeyPaste) {
		if m.editingParam != config.CallParamCallType {
			if content, err := tui.GetClipboard(); err == nil {
				// Clean multi-line content for single-line input
				cleanedContent := utils.CleanMultilineForInput(content)
				m.textInput.SetValue(cleanedContent)
				// IMPORTANT: Also update the cursor position to the end
				m.textInput.CursorEnd()
			} else {
				// Show clipboard error feedback
				m.feedbackMessage = "Clipboard unavailable"
				m.feedbackTimer = time.Now().Add(2 * time.Second).Unix()
			}
		}
		return m, nil
	}

	if config.IsKey(msgStr, config.KeySelect) {
		return m.handleCallEditSave()
	} else if config.IsKey(msgStr, config.KeyBack) {
		m.state = types.StateCallParameterList
		return m, nil
	} else if config.IsKey(msgStr, config.KeyReset) {
		return m.handleResetCurrentParameter()
	} else {
		// Pass all other keys to text input
		var cmd tea.Cmd
		m.textInput, cmd = m.textInput.Update(msg)
		return m, cmd
	}
}

// handleCallTypeEditNavigation handles navigation in call type edit state
func (m *Model) handleCallTypeEditNavigation(msgStr string) (tea.Model, tea.Cmd) {
	if config.IsKey(msgStr, config.KeyUp) {
		if m.callTypeSelector > 0 {
			m.callTypeSelector--
		}
	} else if config.IsKey(msgStr, config.KeyDown) {
		options := types.GetCallTypeOptions()
		if m.callTypeSelector < len(options)-1 {
			m.callTypeSelector++
		}
	} else if config.IsKey(msgStr, config.KeySelect) {
		return m.handleCallEditSave()
	} else if config.IsKey(msgStr, config.KeyBack) {
		m.state = types.StateCallParameterList
		return m, nil
	} else if config.IsKey(msgStr, config.KeyReset) {
		return m.handleResetCurrentParameter()
	}
	return m, nil
}

// handleCallResultNavigation handles navigation in call result state
func (m *Model) handleCallResultNavigation(msgStr string, msg tea.KeyMsg) (tea.Model, tea.Cmd) {
    hasLogs := m.callResult != nil && len(m.callResult.Logs) > 0

	if hasLogs {
		// Direct log navigation - no activation needed
		if config.IsKey(msgStr, config.KeySelect) {
			if m.logsTable.Cursor() < len(m.callResult.Logs) {
				m.selectedLogIndex = m.logsTable.Cursor()
				m.state = types.StateLogDetail
				return m, nil
			}
		}

		// Let table handle navigation
		if config.IsKey(msgStr, config.KeyUp) || config.IsKey(msgStr, config.KeyDown) {
			var cmd tea.Cmd
			m.logsTable, cmd = m.logsTable.Update(msg)
			return m, cmd
		}
	}

    // Save current result as fixture
    if msgStr == "f" && m.callResult != nil {
        // Create a simple name with timestamp if none selected; here we prompt-less save with timestamp
        name := fmt.Sprintf("fixture-%d", time.Now().Unix())

        // Prepare fixture
        gasLimit := m.blockchainChain.GetGasLimit()
        // Prefer input data as call/calldata or deployment bytecode
        bytecodeHex := m.callParams.InputData

        fx := fixtures.Fixture{
            Name:     name,
            Bytecode: bytecodeHex,
            Calldata: m.callParams.InputData,
            Caller:   m.callParams.Caller,
            Value:    m.callParams.Value,
            GasLimit: gasLimit,
        }
        if m.callResult != nil {
            used := uint64(0)
            if gasLimit > 0 && m.callResult.GasLeft <= gasLimit {
                used = gasLimit - m.callResult.GasLeft
            }
            fx.ExpectedResult = &fixtures.FixtureExpectedResult{Success: m.callResult.Success, GasUsed: used}
        }
        if path, err := fixtures.Save(fx); err != nil {
            m.feedbackMessage = "Failed to save fixture: " + err.Error()
        } else {
            m.feedbackMessage = "Fixture saved: " + path
        }
        m.feedbackTimer = time.Now().Add(3 * time.Second).Unix()
        return m, nil
    }

    // Non-log navigation (only back is allowed)
    if config.IsKey(msgStr, config.KeyBack) {
        m.state = types.StateCallParameterList
        return m, nil
    }

	return m, nil
}

// handleCallHistoryNavigation handles navigation in call history state
func (m *Model) handleCallHistoryNavigation(msgStr string, msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	if config.IsKey(msgStr, config.KeySelect) {
		history := m.historyManager.GetAllCalls()
		selectedRow := m.historyTable.SelectedRow()
		if len(selectedRow) > 0 && m.historyTable.Cursor() < len(history) {
			m.selectedHistoryID = history[m.historyTable.Cursor()].ID
			m.state = types.StateCallHistoryDetail

			// Populate logs table for the history entry
			entry := &history[m.historyTable.Cursor()]
			if entry.Result != nil && len(entry.Result.Logs) > 0 {
				rows := tui.ConvertLogsToRows(entry.Result.Logs)
				m.logsTable.SetRows(rows)
			}
		}
		return m, nil
	} else if config.IsKey(msgStr, config.KeyBack) {
		m.state = types.StateMainMenu
		return m, nil
	} else {
		// Let table handle navigation
		var cmd tea.Cmd
		m.historyTable, cmd = m.historyTable.Update(msg)
		return m, cmd
	}
}

// handleHistoryDetailNavigation handles navigation in history detail state
func (m *Model) handleHistoryDetailNavigation(msgStr string, msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	// Get the selected history entry to check for logs
	entry := m.historyManager.GetCall(m.selectedHistoryID)
	hasLogs := entry != nil && entry.Result != nil && len(entry.Result.Logs) > 0

	if hasLogs {
		// Direct log navigation - no activation needed
		if config.IsKey(msgStr, config.KeySelect) {
			if m.logsTable.Cursor() < len(entry.Result.Logs) {
				m.selectedLogIndex = m.logsTable.Cursor()
				m.state = types.StateLogDetail
				return m, nil
			}
		}

		// Let table handle navigation
		if config.IsKey(msgStr, config.KeyUp) || config.IsKey(msgStr, config.KeyDown) {
			var cmd tea.Cmd
			m.logsTable, cmd = m.logsTable.Update(msg)
			return m, cmd
		}
	}

	if config.IsKey(msgStr, config.KeyBack) {
		m.state = types.StateCallHistory
		m.updateHistoryTable()
		return m, nil
	}

	return m, nil
}

// handleContractsNavigation handles navigation in contracts state
func (m *Model) handleContractsNavigation(msgStr string, msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	if config.IsKey(msgStr, config.KeySelect) {
		contracts := m.historyManager.GetContracts()
		selectedRow := m.contractsTable.SelectedRow()
		if len(selectedRow) > 0 && m.contractsTable.Cursor() < len(contracts) {
			m.selectedContract = contracts[m.contractsTable.Cursor()].Address
			m.state = types.StateContractDetail
			// Load disassembly for the selected contract
			contract := m.historyManager.GetContract(m.selectedContract)
			if contract != nil && len(contract.Bytecode) > 0 {
				return m, m.loadDisassemblyCmd(contract.Bytecode)
			}
		}
		return m, nil
	} else if config.IsKey(msgStr, config.KeyBack) {
		m.state = types.StateMainMenu
		return m, nil
	} else {
		// Let table handle navigation
		var cmd tea.Cmd
		m.contractsTable, cmd = m.contractsTable.Update(msg)
		return m, cmd
	}
}

// handleContractDetailNavigation handles navigation in contract detail state
func (m *Model) handleContractDetailNavigation(msgStr string, msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	// Handle disassembly navigation if available
	if m.disassemblyResult != nil {
		// Jump to destination when 'g' is pressed on a jump instruction
		if config.IsKey(msgStr, config.KeyJumpToDestination) {
			m.handleJumpToDestination()
			return m, nil
		}

		// Goto PC prompt when 'G' is pressed (shift+g)
		if msgStr == "G" {
			m.gotoPCInput = tui.CreateTextInput("Enter PC (hex or decimal)", "")
			m.state = types.StateGotoPC
			return m, nil
		}

		// Left/Right to navigate between blocks
		if config.IsKey(msgStr, config.KeyLeft) {
			if m.currentBlockIndex > 0 {
				m.currentBlockIndex--
				// Update table with new block's instructions
				m.updateInstructionsTable()
			}
		} else if config.IsKey(msgStr, config.KeyRight) {
			if m.currentBlockIndex < len(m.disassemblyResult.Analysis.BasicBlocks)-1 {
				m.currentBlockIndex++
				// Update table with new block's instructions
				m.updateInstructionsTable()
			}
		}

		// Up/Down handled by the table component
		if config.IsKey(msgStr, config.KeyUp) || config.IsKey(msgStr, config.KeyDown) {
			var cmd tea.Cmd
			m.instructionsTable, cmd = m.instructionsTable.Update(msg)
			return m, cmd
		}
	}

	if config.IsKey(msgStr, config.KeyBack) {
		m.state = types.StateContracts
		m.disassemblyResult = nil // Clear disassembly when going back
		m.disassemblyError = nil  // Clear error state
		m.currentBlockIndex = 0   // Reset block index
		m.updateContractsTable()
		return m, nil
	}
	return m, nil
}

// updateInstructionsTable updates the instructions table with current block data
func (m *Model) updateInstructionsTable() {
	if m.disassemblyResult == nil {
		return
	}

	instructions, _, err := bytecode.GetInstructionsForBlock(m.disassemblyResult, m.currentBlockIndex)
	if err != nil {
		// Handle error case - could log or show error state
		return
	}

	if len(instructions) > 0 {
		rows := tui.ConvertInstructionsToRows(instructions, m.disassemblyResult.Analysis.JumpDests)
		m.instructionsTable.SetRows(rows)
		// Reset cursor to top when changing blocks
		m.instructionsTable.SetCursor(0)
	}
}

// handleConfirmResetNavigation handles navigation in confirm reset state
func (m *Model) handleConfirmResetNavigation(msgStr string) (tea.Model, tea.Cmd) {
	if config.IsKey(msgStr, config.KeySelect) {
		return m, m.executeReset()
	} else if config.IsKey(msgStr, config.KeyBack) {
		m.state = types.StateMainMenu
		return m, nil
	}
	return m, nil
}

// handleLogDetailNavigation handles navigation in log detail state
func (m *Model) handleLogDetailNavigation(msgStr string) (tea.Model, tea.Cmd) {
	if config.IsKey(msgStr, config.KeyBack) {
		// Use navigation stack for proper back navigation
		if prevState, _ := m.navStack.Pop(); prevState != types.AppState(0) {
			m.state = prevState
		} else {
			// Fallback: determine which state to return to based on context
			if m.selectedTransaction != "" {
				m.state = types.StateTransactionDetail
			} else if m.selectedHistoryID != "" {
				m.state = types.StateCallHistoryDetail
			} else {
				m.state = types.StateCallResult
			}
		}
		return m, nil
	}
	return m, nil
}

// handleJumpToDestination navigates to the jump destination of the currently selected instruction
func (m *Model) handleJumpToDestination() {
	if m.disassemblyResult == nil {
		return
	}

	// Get current block's instructions
	instructions, _, err := bytecode.GetInstructionsForBlock(m.disassemblyResult, m.currentBlockIndex)
	if err != nil {
		return
	}

	// Get the cursor position in the table
	cursorPos := m.instructionsTable.Cursor()
	if cursorPos < 0 || cursorPos >= len(instructions) {
		return
	}

	// Check if current instruction is a jump and get its destination
	jumpDest := bytecode.GetJumpDestination(instructions, cursorPos)
	if jumpDest == nil {
		return
	}

	// Find which block contains the jump destination
	targetBlockIndex := bytecode.FindBlockContainingPC(m.disassemblyResult.Analysis, *jumpDest)
	if targetBlockIndex == -1 {
		return
	}

	// Navigate to the target block
	m.currentBlockIndex = targetBlockIndex
	m.updateInstructionsTable()

	// Try to position the cursor at the jump destination instruction
	targetInstructions, _, _ := bytecode.GetInstructionsForBlock(m.disassemblyResult, targetBlockIndex)
	if targetInstructions != nil {
		targetInstIndex := bytecode.FindInstructionIndexByPC(targetInstructions, *jumpDest)
		if targetInstIndex >= 0 {
			m.instructionsTable.SetCursor(targetInstIndex)
		}
	}
}

// handleDashboardNavigation handles navigation in dashboard state
func (m *Model) handleDashboardNavigation(msgStr string) (tea.Model, tea.Cmd) {
	if config.IsKey(msgStr, config.KeyBack) {
		m.quitting = true
		return m, tea.Batch(tea.ExitAltScreen, tea.Quit)
	}
	return m, nil
}

// handleAccountsListNavigation handles navigation in accounts list state
func (m *Model) handleAccountsListNavigation(msgStr string, msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	if config.IsKey(msgStr, config.KeySelect) {
		selectedRow := m.accountsTable.SelectedRow()
		if len(selectedRow) > 0 && m.accountsTable.Cursor() < len(selectedRow) {
			// Extract address from first column
			m.selectedAccount = selectedRow[0]
			m.navStack.Push(types.StateAccountsList, nil)
			m.state = types.StateAccountDetail
			return m, nil
		}
		return m, nil
	} else if config.IsKey(msgStr, config.KeyBack) {
		m.currentTab = types.TabDashboard
		m.state = types.StateDashboard
		return m, nil
	} else if config.IsKey(msgStr, config.KeyUp) || config.IsKey(msgStr, config.KeyDown) {
		// Let table handle navigation
		var cmd tea.Cmd
		m.accountsTable, cmd = m.accountsTable.Update(msg)
		return m, cmd
	}
	return m, nil
}

// handleBlocksListNavigation handles navigation in blocks list state
func (m *Model) handleBlocksListNavigation(msgStr string, msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	if config.IsKey(msgStr, config.KeySelect) {
		selectedRow := m.blocksTable.SelectedRow()
		if len(selectedRow) > 0 && m.blocksTable.Cursor() < len(selectedRow) {
			// Extract block number from first column
			// Note: Will need proper parsing in actual implementation
			m.selectedBlock = uint64(m.blocksTable.Cursor())
			m.navStack.Push(types.StateBlocksList, nil)
			m.state = types.StateBlockDetail
			return m, nil
		}
		return m, nil
	} else if config.IsKey(msgStr, config.KeyBack) {
		m.currentTab = types.TabDashboard
		m.state = types.StateDashboard
		return m, nil
	} else if config.IsKey(msgStr, config.KeyUp) || config.IsKey(msgStr, config.KeyDown) {
		// Let table handle navigation
		var cmd tea.Cmd
		m.blocksTable, cmd = m.blocksTable.Update(msg)
		return m, cmd
	}
	return m, nil
}

// handleTransactionsListNavigation handles navigation in transactions list state
func (m *Model) handleTransactionsListNavigation(msgStr string, msg tea.KeyMsg) (tea.Model, tea.Cmd) {
    if config.IsKey(msgStr, config.KeySelect) {
        // Use cursor to map to underlying transaction slice
        idx := m.transactionsTable.Cursor()
        txs := m.blockchainChain.GetAllTransactions()
        if idx >= 0 && idx < len(txs) {
            m.selectedTransaction = txs[idx].ID
            m.navStack.Push(types.StateTransactionsList, nil)
            m.state = types.StateTransactionDetail
            // Populate logs table for the selected transaction
            tx := txs[idx]
            if tx != nil && len(tx.Logs) > 0 {
                rows := tui.ConvertLogsToRows(tx.Logs)
                m.logsTable.SetRows(rows)
                m.logsTable.SetCursor(0)
            }
        }
        return m, nil
    } else if config.IsKey(msgStr, config.KeyBack) {
        m.currentTab = types.TabDashboard
        m.state = types.StateDashboard
        return m, nil
    } else if config.IsKey(msgStr, config.KeyUp) || config.IsKey(msgStr, config.KeyDown) {
        // Let table handle navigation
        var cmd tea.Cmd
        m.transactionsTable, cmd = m.transactionsTable.Update(msg)
        return m, cmd
    }
    return m, nil
}

// handleStateInspectorNavigation handles navigation in state inspector state
func (m *Model) handleStateInspectorNavigation(msgStr string, msg tea.KeyMsg) (tea.Model, tea.Cmd) {
    if config.IsKey(msgStr, config.KeyBack) {
        m.currentTab = types.TabDashboard
        m.state = types.StateDashboard
        return m, nil
    }
    // Paste support into inspector input
    if config.IsKey(msgStr, config.KeyPaste) {
        if content, err := tui.GetClipboard(); err == nil {
            cleanedContent := utils.CleanMultilineForInput(content)
            m.inspectorInput.SetValue(cleanedContent)
            m.inspectorInput.CursorEnd()
        } else {
            // Show clipboard error feedback
            m.feedbackMessage = "Clipboard unavailable"
            m.feedbackTimer = time.Now().Add(2 * time.Second).Unix()
        }
        return m, nil
    }
    // Pass key events to text input (except Enter and Escape)
    if !config.IsKey(msgStr, config.KeySelect) && !config.IsKey(msgStr, config.KeyBack) {
        var cmd tea.Cmd
        m.inspectorInput, cmd = m.inspectorInput.Update(msg)
        return m, cmd
    }

    // Enter triggers inspection
    if config.IsKey(msgStr, config.KeySelect) {
        address := strings.TrimSpace(m.inspectorInput.Value())
        if address != "" {
            // Optional validation
            if !(len(address) == 42 && len(address) > 1 && address[:2] == "0x") {
                m.inspectorResult = nil
                m.inspectorError = fmt.Errorf("invalid address: must start with 0x and be 42 characters")
                return m, nil
            }

            // Inspect the address
            result, err := m.stateInspector.InspectAddress(address)
            m.inspectorResult = result
            m.inspectorError = err
        }
        return m, nil
    }
    return m, nil
}

// handleSettingsNavigation handles navigation in settings state
func (m *Model) handleSettingsNavigation(msgStr string) (tea.Model, tea.Cmd) {
    // Awaiting confirm for regenerate accounts
    if m.awaitingRegenerateConfirm {
        if msgStr == "y" || msgStr == "Y" {
            // Confirm regenerate
            if newMgr, err := accounts.NewManager(); err == nil {
                m.accountManager = newMgr
                // Recreate inspector with new manager
                m.stateInspector = state.NewInspector(newMgr)
                // Clear dependent selections/results
                m.selectedAccount = ""
                m.inspectorResult = nil
                m.inspectorError = nil
            }
        }
        m.awaitingRegenerateConfirm = false
        return m, nil
    }

    // Awaiting confirm for reset blockchain
    if m.awaitingResetConfirm {
        if msgStr == "y" || msgStr == "Y" {
            // Confirm reset
            m.blockchainChain.Reset()
            m.historyManager.Clear()
        }
        m.awaitingResetConfirm = false
        return m, nil
    }

    // Handle up/down navigation
    if config.IsKey(msgStr, config.KeyUp) {
        if m.settingsSelectedOption > 0 {
            m.settingsSelectedOption--
        } else {
            m.settingsSelectedOption = 4 // Wrap to bottom (0-4 = 5 options)
        }
        return m, nil
    } else if config.IsKey(msgStr, config.KeyDown) {
        if m.settingsSelectedOption < 4 {
            m.settingsSelectedOption++
        } else {
            m.settingsSelectedOption = 0 // Wrap to top
        }
        return m, nil
    }

    // Handle Enter to select highlighted option
    if config.IsKey(msgStr, config.KeySelect) {
        switch m.settingsSelectedOption {
        case 0: // Reset blockchain
            m.awaitingResetConfirm = true
            return m, nil
        case 1: // Regenerate accounts
            m.awaitingRegenerateConfirm = true
            return m, nil
        case 2: // Toggle auto-refresh
            wasDisabled := !m.autoRefresh
            m.autoRefresh = !m.autoRefresh
            if wasDisabled && m.autoRefresh {
                return m, tickCmd()
            }
            return m, nil
        case 3: // Gas limit (just show feedback, adjust with [/])
            // No action on Enter for gas limit
            return m, nil
        case 4: // Save config
            // Build config snapshot from current model state
            cfg := types.DefaultAppConfig()
            // Persist current gas limit
            cfg.GasLimit = m.blockchainChain.GetGasLimit()
            // Retain default hardfork; could be made dynamic in future
            // Accounts settings
            cfg.Accounts.Count = m.accountManager.GetAccountCount()
            // Keep default 100 ETH balance unless customized

            if path, err := config.Save(cfg); err != nil {
                m.feedbackMessage = "Failed to save config: " + err.Error()
            } else {
                m.feedbackMessage = "Config saved to: " + path
            }
            m.feedbackTimer = time.Now().Add(3 * time.Second).Unix()
            return m, nil
        }
    }

    // Legacy keyboard shortcuts still work
    if msgStr == "r" {
        m.awaitingResetConfirm = true
        return m, nil
    }

    if msgStr == "g" {
        m.awaitingRegenerateConfirm = true
        return m, nil
    }

    if msgStr == "t" {
        wasDisabled := !m.autoRefresh
        m.autoRefresh = !m.autoRefresh
        if wasDisabled && m.autoRefresh {
            return m, tickCmd()
        }
        return m, nil
    }

    // Adjust gas limit with '[' / ']' by ±1,000,000
    if msgStr == "]" {
        gl := m.blockchainChain.GetGasLimit()
        m.blockchainChain.SetGasLimit(gl + 1_000_000)
        return m, nil
    }
    if msgStr == "[" {
        gl := m.blockchainChain.GetGasLimit()
        if gl > 1_000_000 {
            m.blockchainChain.SetGasLimit(gl - 1_000_000)
        }
        return m, nil
    }

    if config.IsKey(msgStr, config.KeyBack) {
        m.currentTab = types.TabDashboard
        m.state = types.StateDashboard
        return m, nil
    }
    return m, nil
}

// handleAccountDetailNavigation handles navigation in account detail state
func (m *Model) handleAccountDetailNavigation(msgStr string) (tea.Model, tea.Cmd) {
	// Validate that an account is selected
	if m.selectedAccount == "" {
		return m, nil
	}

	// Handle private key reveal confirmation workflow
	if m.awaitingPrivateKeyConfirm {
		if msgStr == "y" || msgStr == "Y" {
			// Confirm reveal
			m.showPrivateKey = true
			m.awaitingPrivateKeyConfirm = false
			return m, nil
		}
		// Any other key cancels
		m.awaitingPrivateKeyConfirm = false
		return m, nil
	}

	// Handle 'p' key to reveal/hide private key
	if msgStr == "p" {
		if m.showPrivateKey {
			// If already showing, hide immediately (no confirmation needed to hide)
			m.showPrivateKey = false
		} else {
			// Request confirmation before revealing
			m.awaitingPrivateKeyConfirm = true
		}
		return m, nil
	}

	if config.IsKey(msgStr, config.KeyBack) {
		m.showPrivateKey = false // Reset when going back
		m.awaitingPrivateKeyConfirm = false // Reset confirmation state
		// Use navigation stack for proper back navigation
		if prevState, _ := m.navStack.Pop(); prevState != types.AppState(0) {
			m.state = prevState
		} else {
			// Fallback if stack is empty
			m.state = types.StateAccountsList
		}
		return m, nil
	}

	return m, nil
}

// handleBlockDetailNavigation handles navigation in block detail state
func (m *Model) handleBlockDetailNavigation(msgStr string) (tea.Model, tea.Cmd) {
	if config.IsKey(msgStr, config.KeyBack) {
		// Use navigation stack for proper back navigation
		if prevState, _ := m.navStack.Pop(); prevState != types.AppState(0) {
			m.state = prevState
		} else {
			// Fallback if stack is empty
			m.state = types.StateBlocksList
		}
		return m, nil
	}

	return m, nil
}

// handleGotoPCNavigation handles navigation in goto PC input state
func (m *Model) handleGotoPCNavigation(msgStr string, msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	// Handle Enter key - process the PC input
	if config.IsKey(msgStr, config.KeySelect) {
		inputStr := strings.TrimSpace(m.gotoPCInput.Value())
		if inputStr == "" {
			m.feedbackMessage = "Please enter a PC value"
			m.feedbackTimer = time.Now().Add(2 * time.Second).Unix()
			return m, nil
		}

		// Parse as hex (0x...) or decimal
		var pc int
		var parseErr error
		if strings.HasPrefix(inputStr, "0x") || strings.HasPrefix(inputStr, "0X") {
			// Parse as hex
			hexStr := strings.TrimPrefix(strings.TrimPrefix(inputStr, "0x"), "0X")
			var parsed int64
			parsed, parseErr = strconv.ParseInt(hexStr, 16, 64)
			pc = int(parsed)
		} else {
			// Parse as decimal
			var parsed int64
			parsed, parseErr = strconv.ParseInt(inputStr, 10, 64)
			pc = int(parsed)
		}

		if parseErr != nil {
			m.feedbackMessage = "Invalid PC format. Use decimal (e.g., 42) or hex (e.g., 0x2a)"
			m.feedbackTimer = time.Now().Add(3 * time.Second).Unix()
			return m, nil
		}

		// Find block containing PC
		if m.disassemblyResult == nil {
			m.feedbackMessage = "No disassembly available"
			m.feedbackTimer = time.Now().Add(2 * time.Second).Unix()
			m.state = types.StateContractDetail
			return m, nil
		}

		blockIndex := bytecode.FindBlockContainingPC(m.disassemblyResult.Analysis, pc)
		if blockIndex == -1 {
			m.feedbackMessage = fmt.Sprintf("PC %d not found in bytecode", pc)
			m.feedbackTimer = time.Now().Add(3 * time.Second).Unix()
			return m, nil
		}

		// Get instructions for the block to find the exact instruction
		instructions, _, err := bytecode.GetInstructionsForBlock(m.disassemblyResult, blockIndex)
		if err != nil {
			m.feedbackMessage = "Error loading block instructions"
			m.feedbackTimer = time.Now().Add(2 * time.Second).Unix()
			m.state = types.StateContractDetail
			return m, nil
		}

		instIndex := bytecode.FindInstructionIndexByPC(instructions, pc)
		if instIndex == -1 {
			m.feedbackMessage = fmt.Sprintf("PC %d not found in block", pc)
			m.feedbackTimer = time.Now().Add(3 * time.Second).Unix()
			return m, nil
		}

		// Navigate to the target block and instruction
		m.currentBlockIndex = blockIndex
		m.updateInstructionsTable()
		m.instructionsTable.SetCursor(instIndex)
		m.state = types.StateContractDetail
		return m, nil
	}

	// Handle Escape key - cancel
	if config.IsKey(msgStr, config.KeyBack) {
		m.state = types.StateContractDetail
		return m, nil
	}

	// Pass all other keys to text input
	var cmd tea.Cmd
	m.gotoPCInput, cmd = m.gotoPCInput.Update(msg)
	return m, cmd
}

// handleTransactionDetailNavigation handles navigation in transaction detail state
func (m *Model) handleTransactionDetailNavigation(msgStr string, msg tea.KeyMsg) (tea.Model, tea.Cmd) {
    // Get transaction to check for logs
    var tx *types.Transaction
    if m.selectedTransaction != "" {
        tx, _ = m.blockchainChain.GetTransaction(m.selectedTransaction)
    }
    hasLogs := tx != nil && len(tx.Logs) > 0

    // Handle log navigation if logs exist
    if hasLogs {
        if config.IsKey(msgStr, config.KeyUp) || config.IsKey(msgStr, config.KeyDown) {
            var cmd tea.Cmd
            m.logsTable, cmd = m.logsTable.Update(msg)
            return m, cmd
        }

        // Enter on a log opens log detail
        if config.IsKey(msgStr, config.KeySelect) {
            if m.logsTable.Cursor() < len(tx.Logs) {
                m.selectedLogIndex = m.logsTable.Cursor()
                m.navStack.Push(types.StateTransactionDetail, nil)
                m.state = types.StateLogDetail
                return m, nil
            }
        }
    }

    // Navigate to block detail
    if msgStr == "b" {
        if tx != nil {
            m.selectedBlock = tx.BlockNumber
            m.navStack.Push(types.StateTransactionDetail, nil)
            m.state = types.StateBlockDetail
            return m, nil
        }
    }

    if config.IsKey(msgStr, config.KeyBack) {
        // Use navigation stack for proper back navigation
        if prevState, _ := m.navStack.Pop(); prevState != types.AppState(0) {
            m.state = prevState
        } else {
            // Fallback if stack is empty
            m.state = types.StateTransactionsList
        }
        return m, nil
    }

    return m, nil
}

// handleFixturesListNavigation handles navigation in fixtures list state
func (m *Model) handleFixturesListNavigation(msgStr string, msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	if config.IsKey(msgStr, config.KeySelect) {
		// Get selected fixture name
		selectedRow := m.fixturesTable.SelectedRow()
		if len(selectedRow) == 0 {
			return m, nil
		}

		fixtureName := selectedRow[0]

		// Load fixture
		fx, err := fixtures.Load(fixtureName)
		if err != nil {
			m.feedbackMessage = fmt.Sprintf("Failed to load fixture: %s", err.Error())
			m.feedbackTimer = time.Now().Add(3 * time.Second).Unix()
			return m, nil
		}

		// Convert fixture to CallParametersStrings
		m.callParams = fixtureToCallParams(fx)

		// Execute the call
		m.state = types.StateCallExecuting
		return m, m.executeCallCmd(m.callParams)

	} else if config.IsKey(msgStr, config.KeyBack) {
		m.state = types.StateMainMenu
		return m, nil
	} else {
		// Let table handle up/down navigation
		var cmd tea.Cmd
		m.fixturesTable, cmd = m.fixturesTable.Update(msg)
		return m, cmd
	}
}

// fixtureToCallParams converts a fixture to call parameters
func fixtureToCallParams(fx fixtures.Fixture) types.CallParametersStrings {
	// Use bytecode for CREATE calls, calldata for regular calls
	inputData := fx.Bytecode
	if fx.Calldata != "" && fx.Calldata != "0x" {
		inputData = fx.Calldata
	}

	return types.CallParametersStrings{
		CallType:  "CALL",
		Caller:    fx.Caller,
		Target:    config.DefaultTarget,
		Value:     fx.Value,
		GasLimit:  fmt.Sprintf("%d", fx.GasLimit),
		InputData: inputData,
		Salt:      "",
	}
}
