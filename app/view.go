package app

import (
	"chop/config"
	logs "chop/core"
	"chop/tui"
	"chop/types"

	"github.com/charmbracelet/lipgloss"
)

func (m Model) View() string {
	if m.quitting {
		goodbyeStyle := lipgloss.NewStyle().
			Foreground(config.Amber).
			Bold(true).
			Padding(1, 2)
		return goodbyeStyle.Render(config.GoodbyeMessage)
	}

	if m.width == 0 || m.height == 0 {
		return config.LoadingMessage
	}

	layout := tui.Layout{Width: m.width, Height: m.height}

	// Render tab bar for new navigation
	var tabBar string
	if m.state >= types.StateDashboard {
		tabBar = tui.RenderTabBar(m.currentTab)
	}

	switch m.state {
	case types.StateDashboard:
		header := tui.RenderHeader("Chop Dashboard", "Local EVM Development Environment", config.TitleStyle, config.SubtitleStyle)
		dashboard := tui.RenderDashboard(nil, nil, nil)
		help := tui.RenderHelp(types.StateDashboard)
		content := layout.ComposeVertical(tabBar, header, dashboard, help)
		return layout.RenderWithBox(content)

	case types.StateAccountsList:
		header := tui.RenderHeader("Accounts", "Pre-funded Test Accounts", config.TitleStyle, config.SubtitleStyle)
		updateAccountsTable(&m)
		tableView := m.accountsTable.View()
		help := tui.RenderHelp(types.StateAccountsList)
		content := layout.ComposeVertical(tabBar, header, tableView, help)
		return layout.RenderWithBox(content)

	case types.StateAccountDetail:
		header := tui.RenderHeader("Account Detail", "Account Information", config.TitleStyle, config.SubtitleStyle)
		account, _ := m.accountManager.GetAccount(m.selectedAccount)
		detail := renderAccountDetail(account, m.showPrivateKey, m.width-4)
		help := tui.RenderHelp(types.StateAccountDetail)
		content := layout.ComposeVertical(tabBar, header, detail, help)
		return layout.RenderWithBox(content)

	case types.StateMainMenu:
		header := tui.RenderHeader(m.greeting, config.AppSubtitle, config.TitleStyle, config.SubtitleStyle)
		menu := tui.RenderMenu(m.choices, m.cursor)
		help := tui.RenderHelp(types.StateMainMenu)
		content := layout.ComposeVertical(header, menu, help)
		return layout.RenderWithBox(content)

	case types.StateCallParameterList:
		header := tui.RenderHeader(config.CallStateTitle, config.CallStateSubtitle, config.TitleStyle, config.SubtitleStyle)
		params := GetCallParams(m.callParams)
		callList := tui.RenderCallParameterList(params, m.callParamCursor, m.validationError)
		help := tui.RenderHelp(types.StateCallParameterList)
		content := layout.ComposeVertical(header, callList, help)
		return layout.RenderWithBox(content)

	case types.StateCallParameterEdit, types.StateCallTypeEdit:
		header := tui.RenderHeader(config.CallEditTitle, config.CallEditSubtitle, config.TitleStyle, config.SubtitleStyle)
		editView := tui.RenderCallEdit(m.editingParam, m.textInput, m.validationError, m.callTypeSelector)
		help := tui.RenderHelp(m.state)
		content := layout.ComposeVertical(header, editView, help)
		return layout.RenderWithBox(content)

	case types.StateCallExecuting:
		header := tui.RenderHeader(config.CallExecutingTitle, config.CallExecutingSubtitle, config.TitleStyle, config.SubtitleStyle)
		executing := tui.RenderCallExecuting()
		content := layout.ComposeVertical(header, executing, "")
		return layout.RenderWithBox(content)

	case types.StateCallResult:
		header := tui.RenderHeader(config.CallResultTitle, config.CallResultSubtitle, config.TitleStyle, config.SubtitleStyle)

		// Create pure log display data
		logDisplayData := tui.LogDisplayData{}
		if logs.HasLogs(m.callResult) {
			// Use a reasonable fixed height for logs that won't cause cropping
			maxLogHeight := (m.height / 2) // Use at most half of screen for logs
			availableHeight := maxLogHeight
			if availableHeight > 15 {
				availableHeight = 15
			}

			logDisplayData = tui.LogDisplayData{
				Logs:            m.callResult.Logs,
				SelectedIndex:   m.logsTable.Cursor(), // Get current selection from table
				AvailableHeight: availableHeight,
			}
		}

		result := tui.RenderCallResult(m.callResult, m.callParams, logDisplayData, m.width-4)
		hasLogs := logs.HasLogs(m.callResult)
		help := tui.RenderHelpWithLogs(types.StateCallResult, hasLogs)
		content := layout.ComposeVertical(header, result, help)
		return layout.RenderWithBox(content)

	case types.StateCallHistory:
		header := tui.RenderHeader(config.CallHistoryTitle, config.CallHistorySubtitle, config.TitleStyle, config.SubtitleStyle)
		tableView := m.historyTable.View()
		help := tui.RenderHelp(types.StateCallHistory)
		content := layout.ComposeVertical(header, tableView, help)
		return layout.RenderWithBox(content)

	case types.StateCallHistoryDetail:
		header := tui.RenderHeader(config.CallHistoryDetailTitle, config.CallHistoryDetailSubtitle, config.TitleStyle, config.SubtitleStyle)
		entry := m.historyManager.GetCall(m.selectedHistoryID)

		// Create pure log display data
		logDisplayData := tui.LogDisplayData{}
		if logs.HasHistoryLogs(entry) {
			// Use a conservative fixed height for logs in history detail view
			maxLogHeight := (m.height / 3) // Use at most 1/3 of screen for logs
			availableHeight := maxLogHeight
			if availableHeight > 10 {
				availableHeight = 10
			}

			logDisplayData = tui.LogDisplayData{
				Logs:            entry.Result.Logs,
				SelectedIndex:   m.logsTable.Cursor(),
				AvailableHeight: availableHeight,
			}
		}

		detail := tui.RenderHistoryDetail(entry, logDisplayData, m.width-4)
		hasLogs := logs.HasHistoryLogs(entry)
		help := tui.RenderHelpWithLogs(types.StateCallHistoryDetail, hasLogs)
		content := layout.ComposeVertical(header, detail, help)
		return layout.RenderWithBox(content)

	case types.StateContracts:
		header := tui.RenderHeader(config.ContractsTitle, config.ContractsSubtitle, config.TitleStyle, config.SubtitleStyle)
		tableView := m.contractsTable.View()
		help := tui.RenderHelp(types.StateContracts)
		content := layout.ComposeVertical(header, tableView, help)
		return layout.RenderWithBox(content)

	case types.StateTransactionsList:
		header := tui.RenderHeader("Transactions", "Transaction History", config.TitleStyle, config.SubtitleStyle)
		m.updateTransactionsTable()
		tableView := m.transactionsTable.View()
		help := tui.RenderHelp(types.StateTransactionsList)
		content := layout.ComposeVertical(tabBar, header, tableView, help)
		return layout.RenderWithBox(content)

	case types.StateContractDetail:
		header := tui.RenderHeader(config.ContractDetailTitle, config.ContractDetailSubtitle, config.TitleStyle, config.SubtitleStyle)
		contract := m.historyManager.GetContract(m.selectedContract)
		help := tui.RenderHelpForContractDetail(m.disassemblyResult != nil)

		// Calculate heights
		helpHeight := 3
		fullHeight := m.height - helpHeight - 4 // Full height from top to help

		// Left content: header + contract details
		leftContent := header + "\n" + tui.RenderContractDetail(contract, (m.width-4)*40/100, fullHeight-4)

		// Right content: disassembly if available
		var rightContent string
		hasDisassembly := m.disassemblyResult != nil || m.disassemblyError != nil
		if m.disassemblyError != nil {
			// Show error message
			rightContent = tui.RenderBytecodeDisassemblyError(m.disassemblyError)
		} else if m.disassemblyResult != nil {
			data := tui.DisassemblyDisplayData{
				Result:            m.disassemblyResult,
				CurrentBlockIndex: m.currentBlockIndex,
				Width:             ((m.width - 4) * 60 / 100) - 4,
				Height:            fullHeight,
			}
			rightContent = tui.RenderBytecodeDisassemblyWithTable(data, m.instructionsTable)
		}

		// Create split panel
		detail := tui.RenderContractDetailSplit(leftContent, rightContent, m.width-4, fullHeight, hasDisassembly)

		content := detail + "\n" + help
		return layout.RenderWithBox(content)

	case types.StateConfirmReset:
		header := tui.RenderHeader(config.ResetStateTitle, config.ResetStateSubtitle, config.TitleStyle, config.SubtitleStyle)
		confirmText := lipgloss.NewStyle().
			Bold(true).
			Foreground(config.Destructive).
			Render(config.ResetConfirmMessage)
		help := tui.RenderHelp(types.StateConfirmReset)
		content := layout.ComposeVertical(header, confirmText, help)
		return layout.RenderWithBox(content)

	case types.StateLogDetail:
		header := tui.RenderHeader(config.LogDetailTitle, config.LogDetailSubtitle, config.TitleStyle, config.SubtitleStyle)

		// Get log using core domain logic
		var selectedHistoryEntry *types.CallHistoryEntry
		if m.selectedHistoryID != "" {
			selectedHistoryEntry = m.historyManager.GetCall(m.selectedHistoryID)
		}

		log := logs.GetSelectedLog(m.callResult, selectedHistoryEntry, m.selectedLogIndex)
		detail := tui.RenderLogDetail(log, m.selectedLogIndex, m.width-4)
		help := tui.RenderHelp(types.StateLogDetail)
		content := layout.ComposeVertical(header, detail, help)
		return layout.RenderWithBox(content)

	case types.StateSettings:
		header := tui.RenderHeader("Settings", "Configuration & Options", config.TitleStyle, config.SubtitleStyle)
		settingsView := renderSettingsView(&m, m.width)
		help := tui.RenderHelp(types.StateSettings)
		content := layout.ComposeVertical(tabBar, header, settingsView, help)
		return layout.RenderWithBox(content)

	case types.StateStateInspector:
		header := tui.RenderHeader("State Inspector", "Query Blockchain State", config.TitleStyle, config.SubtitleStyle)

		// Initialize inspector input if it's empty
		if m.inspectorInput.Value() == "" && m.inspectorInput.Placeholder == "" {
			m.inspectorInput = initInspectorInput()
		}

		inspectorView := renderStateInspectorView(m.inspectorInput, m.inspectorResult, m.inspectorError, m.width-4)
		help := tui.RenderHelp(types.StateStateInspector)
		content := layout.ComposeVertical(tabBar, header, inspectorView, help)
		return layout.RenderWithBox(content)

	default:
		return "Invalid state"
	}
}
