package tui

import (
    "chop/config"
    "chop/core/blockchain"
    "chop/core/state"
    "chop/types"
    "fmt"
    "strings"

    "github.com/charmbracelet/bubbles/table"
    "github.com/charmbracelet/bubbles/textinput"
    "github.com/charmbracelet/lipgloss"
    clip "github.com/atotto/clipboard"
)

// Layout helpers
type Layout struct {
	Width  int
	Height int
}

// ComposeVertical composes components vertically
func (l Layout) ComposeVertical(components ...string) string {
	return strings.Join(components, "\n")
}

// RenderWithBox renders content in a box
func (l Layout) RenderWithBox(content string) string {
	boxStyle := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(config.Primary).
		Padding(1, 2).
		Width(l.Width - 4)

	return boxStyle.Render(content)
}

// RenderHeader renders a header with title and subtitle
func RenderHeader(title, subtitle string, titleStyle, subtitleStyle lipgloss.Style) string {
	return titleStyle.Render(title) + "\n" + subtitleStyle.Render(subtitle)
}

// RenderMenu renders the main menu
func RenderMenu(choices []string, cursor int) string {
	var s strings.Builder

	for i, choice := range choices {
		cursorChar := " "
		if cursor == i {
			cursorChar = ">"
		}

		style := lipgloss.NewStyle()
		if cursor == i {
			style = style.Foreground(config.Primary).Bold(true)
		}

		s.WriteString(fmt.Sprintf("%s %s\n", cursorChar, style.Render(choice)))
	}

	return s.String()
}

// RenderHelp renders help text based on state
func RenderHelp(state types.AppState) string {
	helpStyle := lipgloss.NewStyle().Foreground(config.Muted)

	var helpText string
	switch state {
	case types.StateMainMenu:
		helpText = "↑/↓: navigate • enter: select • q: quit"
	case types.StateCallParameterList:
		helpText = "↑/↓: navigate • enter: edit • e: execute • r: reset param • R: reset all • esc: back"
	case types.StateCallParameterEdit:
		helpText = "enter: save • esc: cancel • r: reset • ctrl+v: paste"
	case types.StateCallTypeEdit:
		helpText = "↑/↓: navigate • enter: select • esc: cancel • r: reset"
	case types.StateCallResult:
		helpText = "esc: back"
	case types.StateCallHistory, types.StateContracts:
		helpText = "↑/↓: navigate • enter: view details • esc: back"
	case types.StateCallHistoryDetail, types.StateContractDetail:
		helpText = "esc: back"
	case types.StateConfirmReset:
		helpText = "enter: confirm • esc: cancel"
	case types.StateLogDetail:
		helpText = "esc: back"
	case types.StateDashboard:
		helpText = "1-7: switch tabs • q: quit"
	case types.StateAccountsList:
		helpText = "↑/↓: navigate • enter: view details • esc: back"
	case types.StateAccountDetail:
		helpText = "p: reveal private key • esc: back"
	case types.StateBlocksList:
		helpText = "↑/↓: navigate • enter: view details • esc: back"
	case types.StateBlockDetail:
		helpText = "esc: back"
    case types.StateTransactionsList:
        helpText = "↑/↓: navigate • enter: view details • esc: back"
    case types.StateTransactionDetail:
        helpText = "↑/↓: select log • enter: view log • b: open block • c: copy • esc: back"
	case types.StateStateInspector:
		helpText = "enter: inspect • esc: back"
    case types.StateSettings:
        helpText = "↑/↓: navigate • enter: select • r/g/t: shortcuts • [/]: gas limit • esc: back"
	default:
		helpText = "q: quit"
	}

	return helpStyle.Render(helpText)
}

// RenderHelpWithLogs renders help text with log navigation
func RenderHelpWithLogs(state types.AppState, hasLogs bool) string {
	helpStyle := lipgloss.NewStyle().Foreground(config.Muted)

	var helpText string
	if hasLogs {
		helpText = "↑/↓: navigate logs • enter: view log • esc: back"
	} else {
		helpText = "esc: back"
	}

	return helpStyle.Render(helpText)
}

// RenderHelpForContractDetail renders help for contract detail view
func RenderHelpForContractDetail(hasDisassembly bool) string {
	helpStyle := lipgloss.NewStyle().Foreground(config.Muted)

	var helpText string
	if hasDisassembly {
		helpText = "←/→: navigate blocks • ↑/↓: navigate instructions • c: copy address • esc: back"
	} else {
		helpText = "c: copy address • esc: back"
	}

	return helpStyle.Render(helpText)
}

// RenderCallParameterList renders the call parameter list
func RenderCallParameterList(params []types.CallParameter, cursor int, validationError string) string {
	var s strings.Builder

	for i, param := range params {
		cursorChar := " "
		if cursor == i {
			cursorChar = ">"
		}

		nameStyle := lipgloss.NewStyle().Bold(true)
		valueStyle := lipgloss.NewStyle().Foreground(config.Amber)

		if cursor == i {
			nameStyle = nameStyle.Foreground(config.Primary)
		}

		s.WriteString(fmt.Sprintf("%s %s: %s\n",
			cursorChar,
			nameStyle.Render(param.Name),
			valueStyle.Render(param.Value),
		))
	}

	if validationError != "" {
		errorStyle := lipgloss.NewStyle().Foreground(config.Error).Bold(true)
		s.WriteString("\n" + errorStyle.Render("✗ "+validationError))
	}

	return s.String()
}

// RenderCallEdit renders the parameter edit view
func RenderCallEdit(paramName string, textInput textinput.Model, validationError string, callTypeSelector int) string {
	var s strings.Builder

	labelStyle := lipgloss.NewStyle().Bold(true).Foreground(config.Primary)
	s.WriteString(labelStyle.Render("Editing: "+paramName) + "\n\n")

	if paramName == config.CallParamCallType {
		// Render call type selector
		options := types.GetCallTypeOptions()
		for i, opt := range options {
			cursorChar := " "
			if callTypeSelector == i {
				cursorChar = ">"
			}

			style := lipgloss.NewStyle()
			if callTypeSelector == i {
				style = style.Foreground(config.Primary).Bold(true)
			}

			s.WriteString(fmt.Sprintf("%s %s\n", cursorChar, style.Render(opt)))
		}
	} else {
		// Render text input
		s.WriteString(textInput.View() + "\n")
	}

	if validationError != "" {
		errorStyle := lipgloss.NewStyle().Foreground(config.Error).Bold(true)
		s.WriteString("\n" + errorStyle.Render("✗ "+validationError))
	}

	return s.String()
}

// RenderCallExecuting renders the executing state
func RenderCallExecuting() string {
	style := lipgloss.NewStyle().Foreground(config.Amber).Bold(true)
	return style.Render("Executing call...")
}

// RenderCallResult renders the call result
func RenderCallResult(result *types.CallResult, params types.CallParametersStrings, logData LogDisplayData, width int) string {
	var s strings.Builder

	if result == nil {
		return "No result"
	}

	// Status
	statusStyle := lipgloss.NewStyle().Bold(true)
	if result.Success {
		statusStyle = statusStyle.Foreground(config.Success)
		s.WriteString(statusStyle.Render("✓ Success") + "\n\n")
	} else {
		statusStyle = statusStyle.Foreground(config.Error)
		s.WriteString(statusStyle.Render("✗ Failed") + "\n\n")
		if result.ErrorInfo != "" {
			s.WriteString(fmt.Sprintf("Error: %s\n\n", result.ErrorInfo))
		}
	}

	// Gas
	s.WriteString(fmt.Sprintf("Gas Left: %d\n", result.GasLeft))

	// Return data or deployed address
	if result.DeployedAddr != "" {
		s.WriteString(fmt.Sprintf("Deployed Address: %s\n", result.DeployedAddr))
	} else if len(result.ReturnData) > 0 {
		s.WriteString(fmt.Sprintf("Return Data: 0x%x\n", result.ReturnData))
	}

	// Logs
	if len(result.Logs) > 0 {
		s.WriteString(fmt.Sprintf("\nLogs (%d):\n", len(result.Logs)))
		s.WriteString(RenderLogsCompact(logData))
	}

	return s.String()
}

// LogDisplayData contains data for log display
type LogDisplayData struct {
	Logs            []types.Log
	SelectedIndex   int
	AvailableHeight int
}

// RenderLogsCompact renders logs in a compact format
func RenderLogsCompact(data LogDisplayData) string {
	var s strings.Builder

	for i, log := range data.Logs {
		cursorChar := " "
		if i == data.SelectedIndex {
			cursorChar = ">"
		}

		style := lipgloss.NewStyle()
		if i == data.SelectedIndex {
			style = style.Foreground(config.Primary)
		}

		addr := log.Address
		if len(addr) > 10 {
			addr = addr[:10] + "..."
		}

		s.WriteString(fmt.Sprintf("%s [%d] %s (%d topics)\n",
			cursorChar,
			i,
			style.Render(addr),
			len(log.Topics),
		))
	}

	return s.String()
}

// CreateTextInput creates a text input for parameter editing
func CreateTextInput(label, value string) textinput.Model {
	ti := textinput.New()
	ti.Placeholder = label
	ti.SetValue(value)
	ti.CharLimit = 256
	ti.Width = 60
	ti.Focus()
	return ti
}

// CreateHistoryTable creates a table for call history
func CreateHistoryTable() table.Model {
	columns := []table.Column{
		{Title: "Time", Width: 15},
		{Title: "Type", Width: 12},
		{Title: "Caller", Width: 15},
		{Title: "Target", Width: 15},
		{Title: "Status", Width: 8},
		{Title: "Gas Used", Width: 12},
	}

	t := table.New(
		table.WithColumns(columns),
		table.WithFocused(true),
		table.WithHeight(10),
	)

	s := table.DefaultStyles()
	s.Header = s.Header.
		BorderStyle(lipgloss.NormalBorder()).
		BorderForeground(config.Primary).
		BorderBottom(true).
		Bold(false)
	s.Selected = s.Selected.
		Foreground(config.Primary).
		Bold(true)
	t.SetStyles(s)

	return t
}

// CreateContractsTable creates a table for deployed contracts
func CreateContractsTable() table.Model {
	columns := []table.Column{
		{Title: "Address", Width: 42},
		{Title: "Deployed At", Width: 20},
	}

	t := table.New(
		table.WithColumns(columns),
		table.WithFocused(true),
		table.WithHeight(10),
	)

	s := table.DefaultStyles()
	s.Header = s.Header.
		BorderStyle(lipgloss.NormalBorder()).
		BorderForeground(config.Primary).
		BorderBottom(true).
		Bold(false)
	s.Selected = s.Selected.
		Foreground(config.Primary).
		Bold(true)
	t.SetStyles(s)

	return t
}

// CreateLogsTable creates a table for logs
func CreateLogsTable(height int) table.Model {
	columns := []table.Column{
		{Title: "Index", Width: 8},
		{Title: "Address", Width: 42},
		{Title: "Topics", Width: 10},
	}

	t := table.New(
		table.WithColumns(columns),
		table.WithFocused(true),
		table.WithHeight(height),
	)

	s := table.DefaultStyles()
	s.Header = s.Header.
		BorderStyle(lipgloss.NormalBorder()).
		BorderForeground(config.Primary).
		BorderBottom(true).
		Bold(false)
	s.Selected = s.Selected.
		Foreground(config.Primary).
		Bold(true)
	t.SetStyles(s)

	return t
}

// ConvertLogsToRows converts logs to table rows
func ConvertLogsToRows(logs []types.Log) []table.Row {
	rows := []table.Row{}
	for i, log := range logs {
		rows = append(rows, table.Row{
			fmt.Sprintf("%d", i),
			log.Address,
			fmt.Sprintf("%d", len(log.Topics)),
		})
	}
	return rows
}

// RenderHistoryDetail renders detailed view of a history entry
func RenderHistoryDetail(entry *types.CallHistoryEntry, logData LogDisplayData, width int) string {
	if entry == nil {
		return "Entry not found"
	}

	var s strings.Builder

	s.WriteString(fmt.Sprintf("Timestamp: %s\n", entry.Timestamp.Format("2006-01-02 15:04:05")))
	s.WriteString(fmt.Sprintf("Call Type: %s\n", entry.Parameters.CallType))
	s.WriteString(fmt.Sprintf("Caller: %s\n", entry.Parameters.Caller))
	s.WriteString(fmt.Sprintf("Target: %s\n", entry.Parameters.Target))
	s.WriteString(fmt.Sprintf("Value: %s\n", entry.Parameters.Value))
	s.WriteString(fmt.Sprintf("Gas Limit: %s\n\n", entry.Parameters.GasLimit))

	if entry.Result != nil {
		statusStyle := lipgloss.NewStyle().Bold(true)
		if entry.Result.Success {
			statusStyle = statusStyle.Foreground(config.Success)
			s.WriteString(statusStyle.Render("✓ Success") + "\n")
		} else {
			statusStyle = statusStyle.Foreground(config.Error)
			s.WriteString(statusStyle.Render("✗ Failed") + "\n")
			if entry.Result.ErrorInfo != "" {
				s.WriteString(fmt.Sprintf("Error: %s\n", entry.Result.ErrorInfo))
			}
		}

		if entry.Result.DeployedAddr != "" {
			s.WriteString(fmt.Sprintf("Deployed: %s\n", entry.Result.DeployedAddr))
		}

		if len(entry.Result.Logs) > 0 {
			s.WriteString(fmt.Sprintf("\nLogs (%d):\n", len(entry.Result.Logs)))
			s.WriteString(RenderLogsCompact(logData))
		}
	}

	return s.String()
}

// RenderContractDetail renders contract details
func RenderContractDetail(contract *types.Contract, width, height int) string {
	if contract == nil {
		return "Contract not found"
	}

	var s strings.Builder
	s.WriteString(fmt.Sprintf("Address: %s\n", contract.Address))
	s.WriteString(fmt.Sprintf("Deployed: %s\n", contract.Timestamp.Format("2006-01-02 15:04:05")))
	s.WriteString(fmt.Sprintf("Bytecode Size: %d bytes\n", len(contract.Bytecode)))

	return s.String()
}

// RenderContractDetailSplit renders contract detail in split view
func RenderContractDetailSplit(leftContent, rightContent string, width, height int, hasRight bool) string {
	if !hasRight {
		return leftContent
	}

	leftWidth := width * 40 / 100
	rightWidth := width - leftWidth - 2

	leftStyle := lipgloss.NewStyle().
		Width(leftWidth).
		Height(height).
		Border(lipgloss.RoundedBorder()).
		BorderForeground(config.Primary)

	rightStyle := lipgloss.NewStyle().
		Width(rightWidth).
		Height(height).
		Border(lipgloss.RoundedBorder()).
		BorderForeground(config.Secondary)

	return lipgloss.JoinHorizontal(
		lipgloss.Top,
		leftStyle.Render(leftContent),
		rightStyle.Render(rightContent),
	)
}

// RenderBytecodeDisassemblyError renders disassembly error
func RenderBytecodeDisassemblyError(err error) string {
	errorStyle := lipgloss.NewStyle().Foreground(config.Error).Bold(true)
	return errorStyle.Render(fmt.Sprintf("Disassembly Error: %v", err))
}

// DisassemblyDisplayData contains data for disassembly display
type DisassemblyDisplayData struct {
	Result            interface{} // Will be *bytecode.DisassemblyResult
	CurrentBlockIndex int
	Width             int
	Height            int
}

// RenderBytecodeDisassemblyWithTable renders bytecode disassembly (stubbed)
func RenderBytecodeDisassemblyWithTable(data DisassemblyDisplayData, instructionsTable table.Model) string {
	var s strings.Builder
	s.WriteString("Disassembly\n\n")
	s.WriteString(fmt.Sprintf("Block: %d\n", data.CurrentBlockIndex))
	s.WriteString(instructionsTable.View())
	return s.String()
}

// CreateInstructionsTable creates a table for instructions
func CreateInstructionsTable(height int) table.Model {
	columns := []table.Column{
		{Title: "PC", Width: 6},
		{Title: "OpCode", Width: 12},
		{Title: "Operand", Width: 20},
	}

	t := table.New(
		table.WithColumns(columns),
		table.WithFocused(true),
		table.WithHeight(height),
	)

	s := table.DefaultStyles()
	s.Header = s.Header.
		BorderStyle(lipgloss.NormalBorder()).
		BorderForeground(config.Primary).
		BorderBottom(true).
		Bold(false)
	s.Selected = s.Selected.
		Foreground(config.Primary).
		Bold(true)
	t.SetStyles(s)

	return t
}

// ConvertInstructionsToRows converts instructions to table rows (stubbed)
func ConvertInstructionsToRows(instructions interface{}, jumpDests map[int]bool) []table.Row {
	// TODO: Implement actual conversion
	return []table.Row{
		{"0", "PUSH1", "0x00"},
		{"2", "PUSH1", "0x00"},
		{"4", "RETURN", ""},
	}
}

// RenderLogDetail renders detailed view of a log
func RenderLogDetail(log *types.Log, index int, width int) string {
	if log == nil {
		return "Log not found"
	}

	var s strings.Builder

	s.WriteString(fmt.Sprintf("Log Index: %d\n\n", index))
	s.WriteString(fmt.Sprintf("Address: %s\n\n", log.Address))

	s.WriteString(fmt.Sprintf("Topics (%d):\n", len(log.Topics)))
	for i, topic := range log.Topics {
		s.WriteString(fmt.Sprintf("  [%d] %s\n", i, topic))
	}

	s.WriteString(fmt.Sprintf("\nData (%d bytes):\n", len(log.Data)))
	s.WriteString(fmt.Sprintf("  0x%x\n", log.Data))

	return s.String()
}

// RenderDashboard renders the dashboard view with live stats
func RenderDashboard(stats *types.BlockchainStats, recentBlocks []*types.Block, recentTxs []*types.Transaction) string {
	var s strings.Builder

	// Header with network stats
	s.WriteString(lipgloss.NewStyle().Bold(true).Foreground(config.Primary).Render("⛓  NETWORK"))
	s.WriteString("\n\n")

	// Network Stats
	if stats != nil {
		s.WriteString("Block Height: ")
		s.WriteString(lipgloss.NewStyle().Foreground(config.Amber).Render(fmt.Sprintf("%d", stats.BlockHeight)))
		s.WriteString("\n")

		s.WriteString("Total Gas Used: ")
		s.WriteString(lipgloss.NewStyle().Foreground(config.Amber).Render(fmt.Sprintf("%d", stats.TotalGasUsed)))
		s.WriteString("\n")

		s.WriteString("Accounts: ")
		s.WriteString(lipgloss.NewStyle().Foreground(config.Amber).Render(fmt.Sprintf("%d", stats.TotalAccounts)))
		s.WriteString("\n\n")
	} else {
		s.WriteString("Block Height: ")
		s.WriteString(lipgloss.NewStyle().Foreground(config.Amber).Render("0"))
		s.WriteString("\n")

		s.WriteString("Total Gas Used: ")
		s.WriteString(lipgloss.NewStyle().Foreground(config.Amber).Render("0"))
		s.WriteString("\n")

		s.WriteString("Accounts: ")
		s.WriteString(lipgloss.NewStyle().Foreground(config.Amber).Render("10"))
		s.WriteString("\n\n")
	}

	// Recent activity section
	s.WriteString(lipgloss.NewStyle().Bold(true).Foreground(config.Primary).Render("📊 RECENT ACTIVITY"))
	s.WriteString("\n\n")

	// Recent Blocks
	if len(recentBlocks) > 0 {
		s.WriteString(lipgloss.NewStyle().Foreground(config.Primary).Render("Recent Blocks:"))
		s.WriteString("\n\n")

		for _, block := range recentBlocks {
			if block == nil {
				continue
			}

			// Format block hash
			hashStr := blockchain.FormatBlockHash(block.Hash)
			hashStyle := lipgloss.NewStyle().Foreground(config.Muted)

			// Format timestamp
			timeStr := blockchain.FormatTimestamp(block.Timestamp)
			timeStyle := lipgloss.NewStyle().Foreground(config.Muted)

			// Format gas usage
			percentage, bar := blockchain.FormatGasUsage(block.GasUsed, block.GasLimit)
			gasStyle := lipgloss.NewStyle()
			if percentage > 80 {
				gasStyle = gasStyle.Foreground(config.Error)
			} else if percentage > 50 {
				gasStyle = gasStyle.Foreground(config.Amber)
			} else {
				gasStyle = gasStyle.Foreground(config.Success)
			}

			// Render block line
			s.WriteString(fmt.Sprintf("  Block #%d  %s  %s\n",
				block.Number,
				hashStyle.Render(hashStr),
				timeStyle.Render(timeStr),
			))
			s.WriteString(fmt.Sprintf("    Gas: %s %s (%.1f%%)\n",
				gasStyle.Render(bar),
				gasStyle.Render(fmt.Sprintf("%d/%d", block.GasUsed, block.GasLimit)),
				percentage,
			))
			s.WriteString(fmt.Sprintf("    Txs: %d\n\n", len(block.Transactions)))
		}
	} else {
		s.WriteString(lipgloss.NewStyle().Foreground(config.Muted).Render("No recent blocks yet"))
		s.WriteString("\n\n")
	}

	// Recent Transactions
	if len(recentTxs) > 0 {
		s.WriteString(lipgloss.NewStyle().Foreground(config.Primary).Render("Recent Transactions:"))
		s.WriteString("\n\n")

		for _, tx := range recentTxs {
			if tx == nil {
				continue
			}

			// Status indicator
			statusIcon := "✓"
			statusStyle := lipgloss.NewStyle().Foreground(config.Success)
			if !tx.Status {
				statusIcon = "✗"
				statusStyle = lipgloss.NewStyle().Foreground(config.Error)
			}

			// Format addresses
			fromAddr := blockchain.FormatBlockHash(tx.From)
			toAddr := "CREATE"
			if tx.To != "" {
				toAddr = blockchain.FormatBlockHash(tx.To)
			}

			// Format value
			valueStr := state.FormatBalanceShort(tx.Value)
			valueStyle := lipgloss.NewStyle().Foreground(config.Amber)

			// Format time
			timeStr := blockchain.FormatTimestamp(tx.Timestamp)
			timeStyle := lipgloss.NewStyle().Foreground(config.Muted)

			// Render transaction line
			s.WriteString(fmt.Sprintf("  %s %s → %s  %s ETH  %s\n",
				statusStyle.Render(statusIcon),
				fromAddr,
				toAddr,
				valueStyle.Render(valueStr),
				timeStyle.Render(timeStr),
			))
		}
		s.WriteString("\n")
	} else {
		s.WriteString(lipgloss.NewStyle().Foreground(config.Muted).Render("No recent transactions yet"))
		s.WriteString("\n")
	}

	return s.String()
}

// RenderTabBar renders the tab navigation bar
func RenderTabBar(currentTab types.Tab) string {
	tabs := []types.Tab{
		types.TabDashboard,
		types.TabAccounts,
		types.TabBlocks,
		types.TabTransactions,
		types.TabContracts,
		types.TabStateInspector,
		types.TabSettings,
	}

	var s strings.Builder
	for i, tab := range tabs {
		if i > 0 {
			s.WriteString(" ")
		}

		label := fmt.Sprintf("[%d] %s", i+1, types.TabToString(tab))

		style := lipgloss.NewStyle().Padding(0, 1)
		if tab == currentTab {
			style = style.Background(config.Primary).Foreground(lipgloss.Color("#000000")).Bold(true)
		} else {
			style = style.Foreground(config.Muted)
		}

		s.WriteString(style.Render(label))
	}

	return s.String()
}

// CreateAccountsTable creates a table for accounts
func CreateAccountsTable() table.Model {
	columns := []table.Column{
		{Title: "#", Width: 4},
		{Title: "Address", Width: 42},
		{Title: "Balance", Width: 15},
		{Title: "Nonce", Width: 8},
		{Title: "Txs", Width: 6},
	}

	t := table.New(
		table.WithColumns(columns),
		table.WithFocused(true),
		table.WithHeight(12),
	)

	s := table.DefaultStyles()
	s.Header = s.Header.
		BorderStyle(lipgloss.NormalBorder()).
		BorderForeground(config.Primary).
		BorderBottom(true).
		Bold(false)
	s.Selected = s.Selected.
		Foreground(config.Primary).
		Bold(true)
	t.SetStyles(s)

	return t
}

// CreateBlocksTable creates a table for blocks
func CreateBlocksTable() table.Model {
	columns := []table.Column{
		{Title: "Height", Width: 8},
		{Title: "Hash", Width: 18},
		{Title: "Txs", Width: 6},
		{Title: "Gas Used", Width: 20},
		{Title: "Time", Width: 15},
	}

	t := table.New(
		table.WithColumns(columns),
		table.WithFocused(true),
		table.WithHeight(12),
	)

	s := table.DefaultStyles()
	s.Header = s.Header.
		BorderStyle(lipgloss.NormalBorder()).
		BorderForeground(config.Primary).
		BorderBottom(true).
		Bold(false)
	s.Selected = s.Selected.
		Foreground(config.Primary).
		Bold(true)
	t.SetStyles(s)

	return t
}

// CreateTransactionsTable creates a table for transactions
func CreateTransactionsTable() table.Model {
	columns := []table.Column{
		{Title: "Type", Width: 10},
		{Title: "From", Width: 18},
		{Title: "To", Width: 18},
		{Title: "Value", Width: 12},
		{Title: "Gas", Width: 10},
		{Title: "Status", Width: 8},
	}

	t := table.New(
		table.WithColumns(columns),
		table.WithFocused(true),
		table.WithHeight(12),
	)

	s := table.DefaultStyles()
	s.Header = s.Header.
		BorderStyle(lipgloss.NormalBorder()).
		BorderForeground(config.Primary).
		BorderBottom(true).
		Bold(false)
	s.Selected = s.Selected.
		Foreground(config.Primary).
		Bold(true)
	t.SetStyles(s)

	return t
}

// Clipboard helpers (stubbed for now)
func GetClipboard() (string, error) {
    return clip.ReadAll()
}

func CopyWithFeedback(content string) (string, error) {
    if err := clip.WriteAll(content); err != nil {
        return "", err
    }
    return "Copied to clipboard!", nil
}
