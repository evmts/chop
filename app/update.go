package app

import (
	logs "chop/core"
	"chop/core/bytecode"
	"chop/tui"
	"chop/types"
	"time"

	tea "github.com/charmbracelet/bubbletea"
)

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		// Update table dimensions
		tableHeight := m.height - 10 // Leave room for header and help
		if tableHeight < 5 {
			tableHeight = 5
		}
		m.historyTable.SetHeight(tableHeight)
		m.contractsTable.SetHeight(tableHeight)
		return m, nil

    case tickMsg:
        // Only process/continue ticks when autoRefresh is enabled
        if m.autoRefresh {
            if m.state == types.StateDashboard {
                m.lastUpdate = time.Now().Unix()
            }
            // Keep ticker running
            return m, tickCmd()
        }
        return m, nil

	case callResultMsg:
		m.callResult = msg.result
		m.state = types.StateCallResult

		// Populate logs table if there are logs
		if logs.HasLogs(msg.result) {
			rows := tui.ConvertLogsToRows(msg.result.Logs)
			m.logsTable.SetRows(rows)
		}

		return m, nil

	case resetCompleteMsg:
		m.state = types.StateMainMenu
		return m, nil

    case tea.KeyMsg:
        msgStr := msg.String()

        // Handle tab navigation with number keys
        switch msgStr {
        case "1":
            m.navStack.Clear()
            m.selectedAccount = ""
            m.selectedBlock = 0
            m.selectedTransaction = ""
            m.currentTab = types.TabDashboard
            m.state = types.TabToState(types.TabDashboard)
            return m, nil
        case "2":
            m.navStack.Clear()
            m.selectedAccount = ""
            m.selectedBlock = 0
            m.selectedTransaction = ""
            m.currentTab = types.TabAccounts
            m.state = types.TabToState(types.TabAccounts)
            return m, nil
        case "3":
            m.navStack.Clear()
            m.selectedAccount = ""
            m.selectedBlock = 0
            m.selectedTransaction = ""
            m.currentTab = types.TabBlocks
            m.state = types.TabToState(types.TabBlocks)
            return m, nil
        case "4":
            m.navStack.Clear()
            m.selectedAccount = ""
            m.selectedBlock = 0
            m.selectedTransaction = ""
            m.currentTab = types.TabTransactions
            m.state = types.TabToState(types.TabTransactions)
            return m, nil
        case "5":
            m.navStack.Clear()
            m.selectedAccount = ""
            m.selectedBlock = 0
            m.selectedTransaction = ""
            m.currentTab = types.TabContracts
            m.state = types.TabToState(types.TabContracts)
            return m, nil
        case "6":
            m.navStack.Clear()
            m.selectedAccount = ""
            m.selectedBlock = 0
            m.selectedTransaction = ""
            m.currentTab = types.TabStateInspector
            m.state = types.TabToState(types.TabStateInspector)
            return m, nil
        case "7":
            m.navStack.Clear()
            m.selectedAccount = ""
            m.selectedBlock = 0
            m.selectedTransaction = ""
            m.currentTab = types.TabSettings
            m.state = types.TabToState(types.TabSettings)
            return m, nil
		default:
			// Delegate all other keyboard handling to handlers.go
			return m.handleStateNavigation(msg)
		}

	case disassemblyResultMsg:
		if msg.error != nil {
			// Store error message for display
			m.disassemblyResult = nil
			m.disassemblyError = msg.error
		} else {
			m.disassemblyError = nil
			m.disassemblyResult = msg.result
			m.currentBlockIndex = 0

			// Initialize the instructions table with the first block's instructions
			if m.disassemblyResult != nil {
				// Calculate available height for disassembly area
				headerHeight := 4 // Header height
				helpHeight := 3   // Help height
				boxPadding := 4   // Box padding
				availableHeight := m.height - headerHeight - helpHeight - boxPadding

				// Account for: title (1), stats box (4), spacing (2), block indicator (2), box borders (2)
				tableHeight := availableHeight - 11
				if tableHeight < 8 {
					tableHeight = 8
				}
				m.instructionsTable = tui.CreateInstructionsTable(tableHeight)

				// Load instructions for the first block
				instructions, _, err := bytecode.GetInstructionsForBlock(m.disassemblyResult, m.currentBlockIndex)
				if err == nil && len(instructions) > 0 {
					rows := tui.ConvertInstructionsToRows(instructions, m.disassemblyResult.Analysis.JumpDests)
					m.instructionsTable.SetRows(rows)
				}
			}
		}
		return m, nil
	}

	return m, nil
}
