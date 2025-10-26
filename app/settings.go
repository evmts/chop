package app

import (
    "chop/config"
    "fmt"
    "strings"
    "time"

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

	// Define styles for options
	normalStyle := lipgloss.NewStyle().
		Foreground(config.Muted)

	selectedStyle := lipgloss.NewStyle().
		Foreground(config.Primary).
		Bold(true)

	keyStyle := lipgloss.NewStyle().
		Foreground(config.Primary).
		Bold(true)

	// Render each option with cursor and highlighting
    options := []struct {
        key         string
        description string
    }{
        {"r", "Reset blockchain to genesis"},
        {"g", "Regenerate accounts (new seed)"},
        {"t", "Toggle auto-refresh"},
        {"[/]", "Adjust gas limit (±1M)"},
        {"s", "Save config (write chop.config.json)"},
    }

    for i, opt := range options {
        cursor := "  "
        style := normalStyle
        if i == m.settingsSelectedOption {
            cursor = "> "
            style = selectedStyle
        }

		s.WriteString(cursor)
		s.WriteString(keyStyle.Render(opt.key))
		s.WriteString(" - ")
		s.WriteString(style.Render(opt.description))
		s.WriteString("\n")
    }

    // Feedback line (ephemeral)
    if m.feedbackMessage != "" && time.Now().Unix() < m.feedbackTimer {
        feedbackStyle := lipgloss.NewStyle().Foreground(config.Amber).Bold(true)
        s.WriteString("\n")
        s.WriteString(feedbackStyle.Render(m.feedbackMessage))
        s.WriteString("\n")
    }

    // Confirmation prompts
    if m.awaitingRegenerateConfirm {
        confirmStyle := lipgloss.NewStyle().Foreground(config.Amber).Bold(true)
        s.WriteString("\n")
        s.WriteString(confirmStyle.Render("⚠  Regenerate accounts? This will create a new seed and reset all test accounts. (y/n)"))
        s.WriteString("\n")
    }

    if m.awaitingResetConfirm {
        confirmStyle := lipgloss.NewStyle().Foreground(config.Amber).Bold(true)
        s.WriteString("\n")
        s.WriteString(confirmStyle.Render("⚠  Reset blockchain? This will delete all blocks and transaction history. (y/n)"))
        s.WriteString("\n")
    }

    return s.String()
}
