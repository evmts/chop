package diff

import (
	"fmt"
	"strings"
)

// DivergenceReport contains detailed information about a test divergence
type DivergenceReport struct {
	TestName    string
	FixturePath string
	Expected    ExpectedResult
	Actual      ActualResult
	PreState    string   // Summary of pre-state
	Transaction string   // Transaction summary
	Context     []string // Additional context lines
}

// Format returns a formatted string representation of the divergence
func (r *DivergenceReport) Format() string {
	var b strings.Builder

	b.WriteString(fmt.Sprintf("=== Test: %s ===\n", r.TestName))
	if r.FixturePath != "" {
		b.WriteString(fmt.Sprintf("Fixture: %s\n", r.FixturePath))
	}
	b.WriteString("\n")

	b.WriteString("Expected:\n")
	b.WriteString(fmt.Sprintf("  Success: %v\n", r.Expected.Success))
	b.WriteString(fmt.Sprintf("  Gas Used: %d\n", r.Expected.GasUsed))
	if r.Expected.ReturnData != "" {
		b.WriteString(fmt.Sprintf("  Return Data: %s\n", r.Expected.ReturnData))
	}
	if r.Expected.StateRoot != "" {
		b.WriteString(fmt.Sprintf("  State Root: %s\n", r.Expected.StateRoot))
	}
	b.WriteString("\n")

	b.WriteString("Actual:\n")
	b.WriteString(fmt.Sprintf("  Success: %v\n", r.Actual.Success))
	b.WriteString(fmt.Sprintf("  Gas Used: %d\n", r.Actual.GasUsed))
	if r.Actual.ReturnData != "" {
		b.WriteString(fmt.Sprintf("  Return Data: %s\n", r.Actual.ReturnData))
	}
	if r.Actual.StateRoot != "" {
		b.WriteString(fmt.Sprintf("  State Root: %s\n", r.Actual.StateRoot))
	}
	b.WriteString("\n")

	if r.PreState != "" {
		b.WriteString(fmt.Sprintf("Pre-State: %s\n", r.PreState))
	}

	if r.Transaction != "" {
		b.WriteString(fmt.Sprintf("Transaction: %s\n", r.Transaction))
	}

	if len(r.Context) > 0 {
		b.WriteString("\nContext:\n")
		for _, line := range r.Context {
			b.WriteString(fmt.Sprintf("  %s\n", line))
		}
	}

	return b.String()
}

// PrintDivergence prints a simple divergence report
func PrintDivergence(div *Divergence) {
	if div == nil {
		return
	}

	fmt.Printf("  Divergence in: %s\n", div.Field)
	fmt.Printf("  Expected: %s\n", div.Expected)
	fmt.Printf("  Actual:   %s\n", div.Actual)

	if div.Context != "" {
		fmt.Printf("  Context: %s\n", div.Context)
	}
}

// FormatTestSummary formats a summary of test results
func FormatTestSummary(passed, failed, total int) string {
	var b strings.Builder

	b.WriteString("\n" + strings.Repeat("=", 50) + "\n")
	b.WriteString(fmt.Sprintf("Results: %d/%d passed", passed, total))

	if failed > 0 {
		b.WriteString(fmt.Sprintf(" (%d failed)", failed))
	}

	b.WriteString("\n")

	if passed == total {
		b.WriteString("All tests passed!\n")
	} else {
		percentage := float64(passed) / float64(total) * 100.0
		b.WriteString(fmt.Sprintf("Pass rate: %.1f%%\n", percentage))
	}

	b.WriteString(strings.Repeat("=", 50) + "\n")

	return b.String()
}

// CompactDivergenceReport provides a one-line summary of a failure
type CompactDivergenceReport struct {
	TestName string
	Field    string
	Expected string
	Actual   string
}

// Format returns a compact one-line format
func (r *CompactDivergenceReport) Format() string {
	return fmt.Sprintf("%s: %s mismatch (expected: %s, got: %s)",
		r.TestName, r.Field, r.Expected, r.Actual)
}
