package app

import (
    "chop/config"
    "chop/core/blockchain"
    "chop/core/state"
    "chop/types"
    "fmt"
    "strings"

    "github.com/charmbracelet/lipgloss"
)

// renderTransactionDetail renders detailed information for a single transaction
func renderTransactionDetail(tx *types.Transaction, width int) string {
    if tx == nil {
        return lipgloss.NewStyle().
            Foreground(config.Error).
            Render("Transaction not found")
    }

    // Styles similar to blocks.go
    labelStyle := lipgloss.NewStyle().
        Foreground(config.Primary).
        Bold(true).
        Width(18)

    valueStyle := lipgloss.NewStyle().
        Foreground(config.Text)

    sectionStyle := lipgloss.NewStyle().
        BorderStyle(lipgloss.RoundedBorder()).
        BorderForeground(config.Primary).
        Padding(1, 2).
        Width(width - 4)

    // Transaction info
    var info strings.Builder
    info.WriteString(labelStyle.Render("Hash:") + " " + valueStyle.Render(tx.Hash) + "\n")
    info.WriteString(labelStyle.Render("Type:") + " " + valueStyle.Render(types.CallTypeToString(tx.CallType)) + "\n")
    if tx.BlockNumber > 0 || tx.BlockHash != "" {
        info.WriteString(labelStyle.Render("Block #:") + " " + valueStyle.Render(fmt.Sprintf("%d", tx.BlockNumber)) + "\n")
        if tx.BlockHash != "" {
            info.WriteString(labelStyle.Render("Block Hash:") + " " + valueStyle.Render(blockchain.FormatBlockHash(tx.BlockHash)) + "\n")
        }
    }

    // Status
    statusStr := "✓ Success"
    statusStyle := lipgloss.NewStyle().Foreground(config.Success).Bold(true)
    if !tx.Status {
        statusStr = "✗ Failed"
        statusStyle = lipgloss.NewStyle().Foreground(config.Error).Bold(true)
    }
    info.WriteString(labelStyle.Render("Status:") + " " + statusStyle.Render(statusStr) + "\n")

    // Parties
    info.WriteString(labelStyle.Render("From:") + " " + valueStyle.Render(tx.From) + "\n")
    to := tx.To
    if to == "" {
        to = "CONTRACT"
    }
    info.WriteString(labelStyle.Render("To:") + " " + valueStyle.Render(to) + "\n")

    // Value and gas
    info.WriteString(labelStyle.Render("Value:") + " " + valueStyle.Render(state.FormatBalance(tx.Value)) + "\n")
    info.WriteString(labelStyle.Render("Gas Used/Limit:") + " " + valueStyle.Render(fmt.Sprintf("%d / %d", tx.GasUsed, tx.GasLimit)) + "\n")
    info.WriteString(labelStyle.Render("Nonce:") + " " + valueStyle.Render(fmt.Sprintf("%d", tx.Nonce)) + "\n")

    // Input/Return Data (truncated for readability)
    if len(tx.InputData) > 0 {
        in := fmt.Sprintf("0x%x", tx.InputData)
        if len(in) > 80 {
            in = in[:77] + "..."
        }
        info.WriteString(labelStyle.Render("Input:") + " " + valueStyle.Render(in) + "\n")
    }
    if len(tx.ReturnData) > 0 {
        out := fmt.Sprintf("0x%x", tx.ReturnData)
        if len(out) > 80 {
            out = out[:77] + "..."
        }
        info.WriteString(labelStyle.Render("Return:") + " " + valueStyle.Render(out) + "\n")
    }

    if tx.DeployedAddr != "" {
        info.WriteString(labelStyle.Render("Deployed:") + " " + valueStyle.Render(tx.DeployedAddr) + "\n")
    }

    if !tx.Status && tx.Error != "" {
        errStyle := lipgloss.NewStyle().Foreground(config.Error)
        info.WriteString(labelStyle.Render("Error:") + " " + errStyle.Render(tx.Error) + "\n")
    }

    infoSection := sectionStyle.Render(info.String())

    return infoSection
}

