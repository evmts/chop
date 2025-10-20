package core

import (
	"chop/types"
)

// HasLogs checks if a call result has logs
func HasLogs(result *types.CallResult) bool {
	return result != nil && len(result.Logs) > 0
}

// HasHistoryLogs checks if a history entry has logs
func HasHistoryLogs(entry *types.CallHistoryEntry) bool {
	return entry != nil && entry.Result != nil && len(entry.Result.Logs) > 0
}

// GetSelectedLog returns the selected log from either call result or history entry
func GetSelectedLog(callResult *types.CallResult, historyEntry *types.CallHistoryEntry, index int) *types.Log {
	if historyEntry != nil && historyEntry.Result != nil {
		if index >= 0 && index < len(historyEntry.Result.Logs) {
			return &historyEntry.Result.Logs[index]
		}
	} else if callResult != nil {
		if index >= 0 && index < len(callResult.Logs) {
			return &callResult.Logs[index]
		}
	}
	return nil
}
