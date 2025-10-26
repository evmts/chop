package app

import (
	"chop/config"
	"chop/core/state"
	"chop/types"
	"fmt"

	"github.com/charmbracelet/bubbles/textinput"
	"github.com/charmbracelet/lipgloss"
)

// initInspectorInput creates and configures the text input for address entry
func initInspectorInput() textinput.Model {
	ti := textinput.New()
	ti.Placeholder = "Enter address (0x...)"
	ti.Width = 50
	ti.CharLimit = 42
	ti.Focus()
	return ti
}

// renderStateInspectorView renders the state inspector view
func renderStateInspectorView(input textinput.Model, result *types.AccountState, err error, width int) string {
	var s string

	// Title and input box
	labelStyle := lipgloss.NewStyle().Bold(true).Foreground(config.Primary)
	s += labelStyle.Render("Address:") + "\n"
	s += input.View() + "\n\n"

	// Show error if present
	if err != nil {
		errorStyle := lipgloss.NewStyle().Foreground(config.Error).Bold(true)
		s += errorStyle.Render(fmt.Sprintf("✗ Error: %v", err)) + "\n"
		return s
	}

	// Show result if present
	if result != nil {
		// Create a styled box for the results
		resultStyle := lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(config.Secondary).
			Padding(1, 2).
			Width(width - 8)

		var resultContent string

		// Address
		fieldStyle := lipgloss.NewStyle().Bold(true).Foreground(config.Primary)
		valueStyle := lipgloss.NewStyle().Foreground(config.Amber)

		resultContent += fieldStyle.Render("Address:") + " " + valueStyle.Render(result.Address) + "\n"

		// Balance
		balanceStr := state.FormatBalance(result.Balance)
		resultContent += fieldStyle.Render("Balance:") + " " + valueStyle.Render(balanceStr) + "\n"

		// Nonce
		resultContent += fieldStyle.Render("Nonce:") + " " + valueStyle.Render(fmt.Sprintf("%d", result.Nonce)) + "\n"

        // Is Contract
        isContractStr := "No"
        isContractStyle := lipgloss.NewStyle().Foreground(config.Error)
        if result.IsContract {
            isContractStr = "Yes"
            isContractStyle = lipgloss.NewStyle().Foreground(config.Success)
        }
        resultContent += fieldStyle.Render("Is Contract:") + " " + isContractStyle.Bold(true).Render(isContractStr) + "\n"

		// Code Size (if it's a contract)
		if result.CodeSize > 0 {
			resultContent += fieldStyle.Render("Code Size:") + " " + valueStyle.Render(fmt.Sprintf("%d bytes", result.CodeSize)) + "\n"
		}

		// Storage Slots count
		storageCount := len(result.StorageSlots)
		resultContent += fieldStyle.Render("Storage Slots:") + " " + valueStyle.Render(fmt.Sprintf("%d", storageCount)) + "\n"

		s += resultStyle.Render(resultContent)
	}

	return s
}
