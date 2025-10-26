package app

import (
	"chop/config"
	"chop/core/evm"
	"chop/core/history"
	"chop/core/state"
	"chop/tui"
	"chop/types"
	"fmt"
	"time"

	tea "github.com/charmbracelet/bubbletea"

	"chop/core/accounts"
	"chop/core/blockchain"
	"chop/core/events"
)

func InitialModel() Model {
	vmMgr, err := evm.GetVMManager()
	if err != nil {
		panic(fmt.Sprintf("Failed to initialize VM: %v", err))
	}

	historyMgr := history.NewHistoryManager(1000)

	// Initialize new managers
	accountMgr, err := accounts.NewManager()
	if err != nil {
		panic(fmt.Sprintf("Failed to initialize account manager: %v", err))
	}

	blockchainChain := blockchain.NewChain()
	eventBus := events.NewBus()
	stateInspector := state.NewInspector(accountMgr)

	// Load and replay state
	if stateFile, err := state.LoadStateFile(state.GetStateFilePath()); err == nil {
		stateReplayer := state.NewStateReplayer(vmMgr, historyMgr)
		if err := stateReplayer.ReplayState(stateFile.Calls); err != nil {
			fmt.Printf("Warning: Failed to replay some calls: %v\n", err)
		}
	}

	return Model{
		greeting:       config.AppTitle,
		choices:        config.GetMenuItems(),
		state:          types.StateDashboard, // Start with dashboard instead of main menu
		currentTab:     types.TabDashboard,
		callParams:     NewCallParameters(),
		vmManager:      vmMgr,
		historyManager: historyMgr,
		historyTable:   tui.CreateHistoryTable(),
		contractsTable: tui.CreateContractsTable(),
		logsTable:      tui.CreateLogsTable(10),

		// New managers
		accountManager:  accountMgr,
		blockchainChain: blockchainChain,
		eventBus:        eventBus,
		stateInspector:  stateInspector,

		// New tables (will be created on demand)
		accountsTable:     tui.CreateAccountsTable(),
		blocksTable:       tui.CreateBlocksTable(),
		transactionsTable: tui.CreateTransactionsTable(),

		// Dashboard state
		autoRefresh: true,
		lastUpdate:  time.Now().Unix(),
	}
}

func (m Model) Init() tea.Cmd {
	return tea.Batch(
		tea.EnterAltScreen,
		tea.ClearScreen,
		tickCmd(), // Start auto-refresh ticker
	)
}

// tickCmd returns a command that triggers every second for dashboard updates
func tickCmd() tea.Cmd {
	return tea.Tick(time.Second, func(t time.Time) tea.Msg {
		return tickMsg(t)
	})
}

// tickMsg is a message sent every second for auto-refresh
type tickMsg time.Time
