package app

import (
	"chop/config"
	"chop/core/blockchain"
	"chop/types"
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/table"
	"github.com/charmbracelet/lipgloss"
)

// updateBlocksTable populates the blocks table with blockchain data
func updateBlocksTable(m *Model) {
	blocks := m.blockchainChain.GetAllBlocks()

	// Reverse order to show newest first
	reversedBlocks := make([]*types.Block, len(blocks))
	for i := range blocks {
		reversedBlocks[i] = blocks[len(blocks)-1-i]
	}

	// Convert blocks to table rows
	rows := make([]table.Row, 0, len(reversedBlocks))
	for _, block := range reversedBlocks {
		// Get gas usage bar
		_, gasBar := blockchain.FormatGasUsage(block.GasUsed, block.GasLimit)

		row := table.Row{
			fmt.Sprintf("%d", block.Number),                                // Height
			blockchain.FormatBlockHash(block.Hash),                         // Hash
			fmt.Sprintf("%d", len(block.Transactions)),                     // Tx count
			fmt.Sprintf("%s %d/%d", gasBar, block.GasUsed, block.GasLimit), // Gas Used
			blockchain.FormatTimestamp(block.Timestamp),                    // Time
		}
		rows = append(rows, row)
	}

	m.blocksTable.SetRows(rows)
}

// renderBlockDetail renders detailed information for a single block
func renderBlockDetail(block *types.Block, transactions []*types.Transaction, width int) string {
	if block == nil {
		return lipgloss.NewStyle().
			Foreground(config.Error).
			Render("Block not found")
	}

	// Create styles
	labelStyle := lipgloss.NewStyle().
		Foreground(config.Primary).
		Bold(true).
		Width(15)

	valueStyle := lipgloss.NewStyle().
		Foreground(config.Text)

	sectionStyle := lipgloss.NewStyle().
		BorderStyle(lipgloss.RoundedBorder()).
		BorderForeground(config.Primary).
		Padding(1, 2).
		Width(width - 4)

	// Block information section
	var blockInfo strings.Builder
	blockInfo.WriteString(labelStyle.Render("Number:") + " " + valueStyle.Render(fmt.Sprintf("%d", block.Number)) + "\n")
	blockInfo.WriteString(labelStyle.Render("Hash:") + " " + valueStyle.Render(block.Hash) + "\n")
	blockInfo.WriteString(labelStyle.Render("Parent Hash:") + " " + valueStyle.Render(block.ParentHash) + "\n")
	blockInfo.WriteString(labelStyle.Render("Timestamp:") + " " + valueStyle.Render(block.Timestamp.Format("2006-01-02 15:04:05")) + "\n")
	blockInfo.WriteString(labelStyle.Render("Miner:") + " " + valueStyle.Render(block.Miner) + "\n")

	// Gas usage with bar
	percentage, gasBar := blockchain.FormatGasUsage(block.GasUsed, block.GasLimit)
	gasInfo := fmt.Sprintf("%s %.1f%% (%d / %d)", gasBar, percentage, block.GasUsed, block.GasLimit)
	blockInfo.WriteString(labelStyle.Render("Gas Used:") + " " + valueStyle.Render(gasInfo) + "\n")

	blockInfo.WriteString(labelStyle.Render("State Root:") + " " + valueStyle.Render(block.StateRoot) + "\n")
	blockInfo.WriteString(labelStyle.Render("Size:") + " " + valueStyle.Render(fmt.Sprintf("%d bytes", block.Size)) + "\n")

	blockSection := sectionStyle.Render(blockInfo.String())

	// Transaction information section
	var txInfo strings.Builder
	txInfo.WriteString(lipgloss.NewStyle().
		Foreground(config.Primary).
		Bold(true).
		Render(fmt.Sprintf("Transactions (%d)", len(transactions))) + "\n\n")

	if len(transactions) == 0 {
		txInfo.WriteString(lipgloss.NewStyle().
			Foreground(config.Muted).
			Render("No transactions in this block"))
	} else {
		// List transactions
		for i, tx := range transactions {
			status := "✓"
			statusColor := config.Success
			if !tx.Status {
				status = "✗"
				statusColor = config.Error
			}

			txLine := fmt.Sprintf("%s %s  From: %s  To: %s  Gas: %d",
				lipgloss.NewStyle().Foreground(statusColor).Render(status),
				blockchain.FormatBlockHash(tx.Hash),
				blockchain.FormatBlockHash(tx.From),
				blockchain.FormatBlockHash(tx.To),
				tx.GasUsed,
			)

			txInfo.WriteString(txLine)
			if i < len(transactions)-1 {
				txInfo.WriteString("\n")
			}
		}
	}

	txSection := sectionStyle.Render(txInfo.String())

	return blockSection + "\n\n" + txSection
}
