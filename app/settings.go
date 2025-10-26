package app

import (
	"chop/config"
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
)

// renderSettingsView renders the settings view with current configuration
func renderSettingsView(m *Model, width int) string {
	var s strings.Builder

	// Section style
	sectionTitleStyle := lipgloss.NewStyle().
		Bold(true).
		Foreground(config.Primary).
		MarginTop(1)

	labelStyle := lipgloss.NewStyle().
		Bold(true).
		Width(15)

	valueStyle := lipgloss.NewStyle().
		Foreground(config.Amber)

	// Current Settings Section
	s.WriteString(sectionTitleStyle.Render("⚙  CURRENT SETTINGS"))
	s.WriteString("\n\n")

	// Gas Limit
	gasLimit := m.blockchainChain.GetGasLimit()
	s.WriteString(labelStyle.Render("Gas Limit:"))
	s.WriteString(" ")
	s.WriteString(valueStyle.Render(fmt.Sprintf("%d", gasLimit)))
	s.WriteString("\n")

	// Auto-refresh
	s.WriteString(labelStyle.Render("Auto-refresh:"))
	s.WriteString(" ")
	autoRefreshValue := "Disabled"
	if m.autoRefresh {
		autoRefreshValue = "Enabled"
	}
	s.WriteString(valueStyle.Render(autoRefreshValue))
	s.WriteString("\n")

	// Seed (truncated)
	seedHex := m.accountManager.GetSeedHex()
	truncatedSeed := seedHex
	if len(seedHex) > 20 {
		truncatedSeed = seedHex[:20] + "..."
	}
	s.WriteString(labelStyle.Render("Seed:"))
	s.WriteString(" ")
	s.WriteString(valueStyle.Render(truncatedSeed))
	s.WriteString("\n")

	// Number of Accounts
	accountCount := m.accountManager.GetAccountCount()
	s.WriteString(labelStyle.Render("Accounts:"))
	s.WriteString(" ")
	s.WriteString(valueStyle.Render(fmt.Sprintf("%d", accountCount)))
	s.WriteString("\n")

	// Options Section
	s.WriteString("\n")
	s.WriteString(sectionTitleStyle.Render("📝 AVAILABLE ACTIONS"))
	s.WriteString("\n\n")

	optionStyle := lipgloss.NewStyle().
		Foreground(config.Muted)

	keyStyle := lipgloss.NewStyle().
		Foreground(config.Primary).
		Bold(true)

	s.WriteString(optionStyle.Render("Press "))
	s.WriteString(keyStyle.Render("'r'"))
	s.WriteString(optionStyle.Render(" to reset blockchain"))
	s.WriteString("\n")

	s.WriteString(optionStyle.Render("Press "))
	s.WriteString(keyStyle.Render("'g'"))
	s.WriteString(optionStyle.Render(" to regenerate accounts"))
	s.WriteString("\n")

	s.WriteString(optionStyle.Render("Press "))
	s.WriteString(keyStyle.Render("'t'"))
	s.WriteString(optionStyle.Render(" to toggle auto-refresh"))
	s.WriteString("\n")

	return s.String()
}
