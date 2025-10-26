package server

import (
	"sync"
	"time"
)

// LogEntry represents a single JSON-RPC request/response pair
type LogEntry struct {
	ID        string
	Request   *JSONRPCRequest
	Response  *JSONRPCResponse
	Timestamp time.Time
	Duration  time.Duration
	Error     error
}

// Logger manages JSON-RPC request/response logging
// It maintains a circular buffer of the most recent log entries
type Logger struct {
	entries []LogEntry
	maxSize int
	mu      sync.RWMutex
}

// NewLogger creates a new Logger with the specified maximum number of entries
func NewLogger(maxSize int) *Logger {
	return &Logger{
		entries: make([]LogEntry, 0, maxSize),
		maxSize: maxSize,
	}
}

// Log adds a new log entry to the logger
// If the logger is at maximum capacity, the oldest entry is removed
func (l *Logger) Log(entry LogEntry) {
	l.mu.Lock()
	defer l.mu.Unlock()

	// Add new entry
	l.entries = append(l.entries, entry)

	// Remove oldest entry if we exceed max size
	if len(l.entries) > l.maxSize {
		l.entries = l.entries[1:]
	}
}

// GetEntries returns a copy of all log entries, newest first
func (l *Logger) GetEntries() []LogEntry {
	l.mu.RLock()
	defer l.mu.RUnlock()

	// Return a copy in reverse order (newest first)
	entries := make([]LogEntry, len(l.entries))
	for i, entry := range l.entries {
		entries[len(l.entries)-1-i] = entry
	}

	return entries
}

// GetRecentEntries returns the N most recent log entries
func (l *Logger) GetRecentEntries(count int) []LogEntry {
	l.mu.RLock()
	defer l.mu.RUnlock()

	if count > len(l.entries) {
		count = len(l.entries)
	}

	// Return the most recent entries in reverse order
	entries := make([]LogEntry, count)
	for i := 0; i < count; i++ {
		entries[i] = l.entries[len(l.entries)-1-i]
	}

	return entries
}

// Clear removes all log entries
func (l *Logger) Clear() {
	l.mu.Lock()
	defer l.mu.Unlock()

	l.entries = make([]LogEntry, 0, l.maxSize)
}

// Count returns the current number of log entries
func (l *Logger) Count() int {
	l.mu.RLock()
	defer l.mu.RUnlock()

	return len(l.entries)
}
