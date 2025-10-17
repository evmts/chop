package config

import (
	"chop/internal/types"

	"github.com/charmbracelet/lipgloss"
)

// Application info
const (
	AppTitle    = "Chop"
	AppSubtitle = "Guillotine EVM CLI"
	AppVersion  = "0.1.0"
)

// UI Messages
const (
	LoadingMessage        = "Loading..."
	GoodbyeMessage        = "Thanks for using Chop!"
	CallStateTitle        = "Configure EVM Call"
	CallStateSubtitle     = "Set parameters for your call"
	CallEditTitle         = "Edit Parameter"
	CallEditSubtitle      = "Modify the value"
	CallExecutingTitle    = "Executing Call"
	CallExecutingSubtitle = "Please wait..."
	CallResultTitle       = "Call Result"
	CallResultSubtitle    = "Execution complete"
	CallHistoryTitle      = "Call History"
	CallHistorySubtitle   = "View past executions"
	CallHistoryDetailTitle    = "Call Details"
	CallHistoryDetailSubtitle = "Detailed view of call"
	ContractsTitle        = "Deployed Contracts"
	ContractsSubtitle     = "View contract deployments"
	ContractDetailTitle   = "Contract Details"
	ContractDetailSubtitle = "View contract information"
	ResetStateTitle       = "Reset State"
	ResetStateSubtitle    = "Clear all data"
	ResetConfirmMessage   = "Press Enter to confirm reset, or Esc to cancel"
	LogDetailTitle        = "Log Details"
	LogDetailSubtitle     = "View log event data"
)

// Menu items
const (
	MenuMakeCall    = "Make EVM Call"
	MenuCallHistory = "Call History"
	MenuContracts   = "Deployed Contracts"
	MenuResetState  = "Reset State"
	MenuExit        = "Exit"
)

// Call parameter names
const (
	CallParamCallType     = "Call Type"
	CallParamCaller       = "Caller"
	CallParamTarget       = "Target"
	CallParamValue        = "Value"
	CallParamGasLimit     = "Gas Limit"
	CallParamInput        = "Input Data"
	CallParamInputDeploy  = "Bytecode"
	CallParamSalt         = "Salt"
)

// Default values
const (
	DefaultGasLimit   = "30000000"
	DefaultCaller     = "0x0000000000000000000000000000000000000001"
	DefaultTarget     = "0x0000000000000000000000000000000000000002"
	DefaultValue      = "0"
	DefaultInputData  = "0x"
	DefaultSalt       = "0x0000000000000000000000000000000000000000000000000000000000000000"
)

// Keyboard shortcuts
const (
	KeyUp                = "up"
	KeyDown              = "down"
	KeyLeft              = "left"
	KeyRight             = "right"
	KeySelect            = "enter"
	KeyBack              = "esc"
	KeyQuit              = "ctrl+c"
	KeyExecute           = "e"
	KeyReset             = "r"
	KeyResetAll          = "R"
	KeyCopy              = "c"
	KeyPaste             = "ctrl+v"
	KeyJumpToDestination = "g"
)

// Color scheme
var (
	Primary     = lipgloss.Color("#00D9FF")
	Secondary   = lipgloss.Color("#7D56F4")
	Amber       = lipgloss.Color("#FFB86C")
	Success     = lipgloss.Color("#50FA7B")
	Error       = lipgloss.Color("#FF5555")
	Destructive = lipgloss.Color("#FF0000")
	Muted       = lipgloss.Color("#6272A4")
	Text        = lipgloss.Color("#F8F8F2")
)

// Styles
var (
	TitleStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(Primary).
			PaddingTop(1).
			PaddingBottom(1)

	SubtitleStyle = lipgloss.NewStyle().
			Foreground(Muted).
			Italic(true)
)

// GetMenuItems returns the main menu items
func GetMenuItems() []string {
	return []string{
		MenuMakeCall,
		MenuCallHistory,
		MenuContracts,
		MenuResetState,
		MenuExit,
	}
}

// CallDefaults holds default values for call parameters
type CallDefaults struct {
	CallType   types.CallType
	CallerAddr string
	TargetAddr string
	Value      string
	InputData  string
	Salt       string
}

// GetCallDefaults returns the default call parameters
func GetCallDefaults() CallDefaults {
	return CallDefaults{
		CallType:   types.CallTypeCall,
		CallerAddr: DefaultCaller,
		TargetAddr: DefaultTarget,
		Value:      DefaultValue,
		InputData:  DefaultInputData,
		Salt:       DefaultSalt,
	}
}

// IsKey checks if a key message matches a configured key
func IsKey(msg, key string) bool {
	switch key {
	case KeyUp:
		return msg == "up" || msg == "k"
	case KeyDown:
		return msg == "down" || msg == "j"
	case KeyLeft:
		return msg == "left" || msg == "h"
	case KeyRight:
		return msg == "right" || msg == "l"
	case KeySelect:
		return msg == "enter"
	case KeyBack:
		return msg == "esc"
	case KeyQuit:
		return msg == "ctrl+c" || msg == "q"
	case KeyExecute:
		return msg == "e"
	case KeyReset:
		return msg == "r"
	case KeyResetAll:
		return msg == "R"
	case KeyCopy:
		return msg == "c"
	case KeyPaste:
		return msg == "ctrl+v"
	case KeyJumpToDestination:
		return msg == "g"
	default:
		return msg == key
	}
}
