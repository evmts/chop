// Package utils provides utility functions for data manipulation and formatting.
// It includes helpers for cleaning input data and handling multi-line content.
package utils

import (
	"strings"
)

// CleanMultilineForInput cleans multi-line clipboard content for use in single-line input fields.
// It replaces newlines with spaces, collapses consecutive spaces into single spaces,
// and trims leading/trailing whitespace. This is useful for handling pasted content
// that may contain unwanted line breaks.
func CleanMultilineForInput(content string) string {
	// Replace newlines with spaces
	cleaned := strings.ReplaceAll(content, "\n", " ")
	cleaned = strings.ReplaceAll(cleaned, "\r", " ")

	// Collapse multiple spaces
	for strings.Contains(cleaned, "  ") {
		cleaned = strings.ReplaceAll(cleaned, "  ", " ")
	}

	return strings.TrimSpace(cleaned)
}
