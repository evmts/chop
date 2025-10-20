package utils

import (
	"strings"
)

// CleanMultilineForInput cleans multi-line clipboard content for single-line input
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
