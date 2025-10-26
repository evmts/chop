package utils

import (
	"testing"
)

func TestCleanMultilineForInput(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "single line unchanged",
			input:    "hello world",
			expected: "hello world",
		},
		{
			name:     "single line with leading whitespace",
			input:    "  hello world",
			expected: "hello world",
		},
		{
			name:     "single line with trailing whitespace",
			input:    "hello world  ",
			expected: "hello world",
		},
		{
			name:     "single line with leading and trailing whitespace",
			input:    "  hello world  ",
			expected: "hello world",
		},
		{
			name:     "multiple lines with newlines",
			input:    "line1\nline2\nline3",
			expected: "line1 line2 line3",
		},
		{
			name:     "multiple lines with carriage returns",
			input:    "line1\rline2\rline3",
			expected: "line1 line2 line3",
		},
		{
			name:     "multiple lines with CRLF",
			input:    "line1\r\nline2\r\nline3",
			expected: "line1 line2 line3",
		},
		{
			name:     "mixed newlines",
			input:    "line1\nline2\r\nline3\rline4",
			expected: "line1 line2 line3 line4",
		},
		{
			name:     "multiple consecutive newlines",
			input:    "line1\n\n\nline2",
			expected: "line1 line2",
		},
		{
			name:     "newlines with spaces",
			input:    "line1\n  line2\n    line3",
			expected: "line1 line2 line3",
		},
		{
			name:     "multiple spaces collapsed",
			input:    "hello    world",
			expected: "hello world",
		},
		{
			name:     "multiple spaces and newlines",
			input:    "hello    world\n  foo    bar",
			expected: "hello world foo bar",
		},
		{
			name:     "empty string",
			input:    "",
			expected: "",
		},
		{
			name:     "only whitespace",
			input:    "   \n   \r\n   ",
			expected: "",
		},
		{
			name:     "only newlines",
			input:    "\n\n\n",
			expected: "",
		},
		{
			name:     "tabs and newlines",
			input:    "line1\tline2\nline3",
			expected: "line1\tline2 line3",
		},
		{
			name:     "realistic ethereum address paste",
			input:    "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb\n",
			expected: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
		},
		{
			name: "realistic multi-line code paste",
			input: `function transfer(address to, uint256 amount) public {
    balances[msg.sender] -= amount;
    balances[to] += amount;
}`,
			expected: "function transfer(address to, uint256 amount) public { balances[msg.sender] -= amount; balances[to] += amount; }",
		},
		{
			name: "realistic bytecode paste with newlines",
			input: `0x608060405234801561001057600080fd5b50
0x61012c806100206000396000f3fe`,
			expected: "0x608060405234801561001057600080fd5b50 0x61012c806100206000396000f3fe",
		},
		{
			name:     "single character",
			input:    "a",
			expected: "a",
		},
		{
			name:     "single space",
			input:    " ",
			expected: "",
		},
		{
			name:     "single newline",
			input:    "\n",
			expected: "",
		},
		{
			name:     "text with preserved internal spaces",
			input:    "hello world foo bar",
			expected: "hello world foo bar",
		},
		{
			name:     "numbers and symbols",
			input:    "123\n456\n789",
			expected: "123 456 789",
		},
		{
			name:     "hex values on multiple lines",
			input:    "0xabcd\n0xef01\n0x2345",
			expected: "0xabcd 0xef01 0x2345",
		},
		{
			name: "realistic JSON paste (should flatten)",
			input: `{
  "name": "test",
  "value": 123
}`,
			expected: `{ "name": "test", "value": 123 }`,
		},
		{
			name:     "windows line endings",
			input:    "line1\r\nline2\r\nline3\r\n",
			expected: "line1 line2 line3",
		},
		{
			name:     "mixed content with special chars",
			input:    "0x123\nvalue: 1000\ndata: []",
			expected: "0x123 value: 1000 data: []",
		},
		{
			name: "indented code block",
			input: `    function foo() {
        return bar;
    }`,
			expected: "function foo() { return bar; }",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := CleanMultilineForInput(tc.input)

			if result != tc.expected {
				t.Errorf("\nInput:    %q\nExpected: %q\nGot:      %q", tc.input, tc.expected, result)
			}
		})
	}
}

func TestCleanMultilineForInputConsistency(t *testing.T) {
	t.Parallel()

	// Test that running the function multiple times produces the same result
	input := "line1\n\nline2\r\nline3\n"
	firstResult := CleanMultilineForInput(input)
	secondResult := CleanMultilineForInput(input)

	if firstResult != secondResult {
		t.Errorf("Function is not consistent: first=%q, second=%q", firstResult, secondResult)
	}
}

func TestCleanMultilineForInputIdempotent(t *testing.T) {
	t.Parallel()

	// Test that cleaning an already-cleaned string doesn't change it
	input := "hello world foo bar"
	firstResult := CleanMultilineForInput(input)
	secondResult := CleanMultilineForInput(firstResult)

	if firstResult != secondResult {
		t.Errorf("Function is not idempotent: first=%q, second=%q", firstResult, secondResult)
	}
}

func TestCleanMultilineForInputPreservesNoWhitespace(t *testing.T) {
	t.Parallel()

	// Test that strings without whitespace are preserved
	testCases := []string{
		"hello",
		"0x123456",
		"abc123",
		"test",
	}

	for _, input := range testCases {
		result := CleanMultilineForInput(input)
		if result != input {
			t.Errorf("Input without whitespace was modified: input=%q, result=%q", input, result)
		}
	}
}

func TestCleanMultilineForInputLongContent(t *testing.T) {
	t.Parallel()

	// Test with long content to ensure performance is reasonable
	longInput := ""
	for i := 0; i < 100; i++ {
		longInput += "line" + string(rune('0'+i%10)) + "\n"
	}

	result := CleanMultilineForInput(longInput)

	// Verify no newlines in output
	for i := 0; i < len(result); i++ {
		if result[i] == '\n' || result[i] == '\r' {
			t.Errorf("Output contains newline at position %d", i)
			break
		}
	}

	// Verify output is not empty
	if result == "" {
		t.Error("Long input produced empty output")
	}
}

func TestCleanMultilineForInputUnicode(t *testing.T) {
	t.Parallel()

	// Test with unicode characters
	testCases := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "unicode characters single line",
			input:    "hello 世界",
			expected: "hello 世界",
		},
		{
			name:     "unicode with newlines",
			input:    "hello\n世界\ntest",
			expected: "hello 世界 test",
		},
		{
			name:     "emojis",
			input:    "test\n😀\ndata",
			expected: "test 😀 data",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := CleanMultilineForInput(tc.input)
			if result != tc.expected {
				t.Errorf("Expected %q, got %q", tc.expected, result)
			}
		})
	}
}

// Benchmark tests
func BenchmarkCleanMultilineForInput(b *testing.B) {
	input := "line1\nline2\r\nline3\nline4\n"
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		CleanMultilineForInput(input)
	}
}

func BenchmarkCleanMultilineForInputLong(b *testing.B) {
	// Create a longer input for benchmarking
	longInput := ""
	for i := 0; i < 100; i++ {
		longInput += "line" + string(rune('0'+i%10)) + "\n"
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		CleanMultilineForInput(longInput)
	}
}

func BenchmarkCleanMultilineForInputNoNewlines(b *testing.B) {
	// Benchmark with input that has no newlines
	input := "this is a simple string with no newlines but multiple    spaces"
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		CleanMultilineForInput(input)
	}
}
