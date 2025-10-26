package app

import (
	"chop/config"
	"chop/core/state"
	"chop/types"
	"fmt"

	"github.com/charmbracelet/bubbles/table"
	"github.com/charmbracelet/lipgloss"
)

// updateAccountsTable populates the accounts table with current account data
func updateAccountsTable(m *Model) {
	accounts := m.accountManager.GetAllAccounts()

	rows := []table.Row{}
	for _, account := range accounts {
		// Format: Index, Address, Balance, Nonce, Tx count
		rows = append(rows, table.Row{
			fmt.Sprintf("%d", account.Index),
			account.Address,
			state.FormatBalanceShort(account.Balance) + " ETH",
			fmt.Sprintf("%d", account.Nonce),
			"0", // Tx count - always 0 for now
		})
	}

	m.accountsTable.SetRows(rows)
}

// renderAccountDetail renders the account detail view
func renderAccountDetail(account *types.Account, showPrivateKey bool, width int) string {
	if account == nil {
		return "Account not found"
	}

	var s string

	// Title style
	labelStyle := lipgloss.NewStyle().
		Bold(true).
		Foreground(config.Primary)

	valueStyle := lipgloss.NewStyle().
		Foreground(config.Amber)

	// Account details
	s += labelStyle.Render("Index: ") + valueStyle.Render(fmt.Sprintf("%d", account.Index)) + "\n\n"
	s += labelStyle.Render("Address: ") + valueStyle.Render(account.Address) + "\n\n"
	s += labelStyle.Render("Balance: ") + valueStyle.Render(state.FormatBalance(account.Balance)) + "\n\n"
	s += labelStyle.Render("Nonce: ") + valueStyle.Render(fmt.Sprintf("%d", account.Nonce)) + "\n\n"
	s += labelStyle.Render("Code Size: ") + valueStyle.Render(fmt.Sprintf("%d bytes", len(account.Code))) + "\n\n"

	// Private key section
	if account.PrivateKey != "" {
		s += labelStyle.Render("Private Key: ")
		if showPrivateKey {
			s += valueStyle.Render(account.PrivateKey) + "\n"
		} else {
			mutedStyle := lipgloss.NewStyle().Foreground(config.Muted)
			s += mutedStyle.Render("[Press 'p' to reveal private key]") + "\n"
		}
	}

	return s
}
