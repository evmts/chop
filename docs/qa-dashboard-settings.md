# QA Test Checklist: Dashboard & Settings

## Test Environment
- **OS**: ___________________
- **Terminal**: ___________________
- **Terminal Size**: ___________________
- **Go Version**: ___________________
- **Date**: ___________________
- **Tester**: ___________________
- **Build Command**: `CGO_ENABLED=0 go build -o chop .`

## Prerequisites

### Build & Run Instructions
1. Navigate to `/Users/williamcory/chop`
2. Build the application:
   ```bash
   CGO_ENABLED=0 go build -o chop .
   ```
3. Run the application:
   ```bash
   ./chop
   ```
4. Application should launch directly into the Dashboard (Tab 1)

### Initial State Verification
- [ ] Application launches without errors
- [ ] Tab bar shows: Dashboard | Accounts | Blocks | Transactions | Contracts | State | Settings
- [ ] Dashboard (Tab 1) is selected by default
- [ ] No crashes or panics on startup

---

## Dashboard Tests (Tab 1)

### Test Status Legend
- [ ] = Not tested
- [x] = Pass
- [~] = Fail
- [-] = Skipped

### DS-001: Dashboard Display
- [ ] Dashboard displays "Chop Dashboard" header
- [ ] Subtitle shows "Local EVM Development Environment"
- [ ] Auto-refresh status line is visible
- [ ] Blockchain statistics section is displayed
- [ ] Recent blocks section is present (shows up to 5 blocks)
- [ ] Recent transactions section is present (shows up to 5 transactions)
- [ ] All text is readable and properly formatted

**Expected Behavior**: Dashboard should show comprehensive blockchain overview with stats, blocks, and transactions.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### DS-002: Blockchain Statistics
- [ ] Block height displays correctly (integer >= 0)
- [ ] Total transactions count is displayed
- [ ] Gas used statistics are shown
- [ ] Statistics update when blockchain state changes
- [ ] All numbers are properly formatted
- [ ] No placeholder or undefined values

**Expected Behavior**: Stats reflect current blockchain state accurately.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### DS-003: Recent Blocks Display
- [ ] Recent blocks section shows block list
- [ ] Each block shows: number, hash, timestamp
- [ ] Block hashes are truncated for readability
- [ ] Gas usage bar is displayed for each block
- [ ] Blocks are ordered by recency (newest first)
- [ ] Block display updates when new blocks are mined

**Expected Behavior**: Most recent blocks displayed in descending order with formatted data.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### DS-004: Recent Transactions Display
- [ ] Recent transactions section shows transaction list
- [ ] Each transaction shows: type, status icon, parties
- [ ] Success transactions show ✓ icon
- [ ] Failed transactions show ✗ icon
- [ ] Transaction hashes are truncated
- [ ] Transactions ordered by recency (newest first)

**Expected Behavior**: Recent transactions displayed with clear status indicators.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### DS-005: Auto-Refresh Indicator
- [ ] Auto-refresh line shows "Auto-refresh: Enabled" or "Disabled"
- [ ] When enabled, text is green/success colored
- [ ] When disabled, text is muted/gray colored
- [ ] Indicator updates immediately when toggled

**Expected Behavior**: Visual indicator clearly shows auto-refresh state.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### DS-006: Auto-Refresh Functionality (Enabled)
1. [ ] Navigate to Settings (Tab 7)
2. [ ] Press 't' to enable auto-refresh (if disabled)
3. [ ] Return to Dashboard (Tab 1)
4. [ ] Observe dashboard for 5 seconds
5. [ ] Statistics update automatically
6. [ ] Recent blocks list updates (if new blocks)
7. [ ] Recent transactions list updates (if new txs)
8. [ ] No visible flickering or UI issues

**Expected Behavior**: Dashboard automatically refreshes data every ~2 seconds when enabled.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### DS-007: Auto-Refresh Functionality (Disabled)
1. [ ] Navigate to Settings (Tab 7)
2. [ ] Press 't' to disable auto-refresh (if enabled)
3. [ ] Return to Dashboard (Tab 1)
4. [ ] Observe dashboard for 5 seconds
5. [ ] Statistics do NOT update automatically
6. [ ] Dashboard remains static until manual navigation

**Expected Behavior**: Dashboard remains static when auto-refresh is disabled.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### DS-008: Tab Switching Preservation
1. [ ] Start on Dashboard (Tab 1)
2. [ ] Note current blockchain height
3. [ ] Switch to Accounts (Tab 2)
4. [ ] Switch back to Dashboard (Tab 1)
5. [ ] Dashboard state is preserved/restored
6. [ ] Statistics still accurate
7. [ ] No loss of data or display corruption

**Expected Behavior**: Dashboard maintains coherent state across tab switches.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

---

## Settings Tests (Tab 7)

### ST-001: Settings Display
1. [ ] Press '7' or navigate to Settings tab
2. [ ] Settings page displays "Settings" header
3. [ ] "CURRENT SETTINGS" section visible
4. [ ] "AVAILABLE ACTIONS" section visible
5. [ ] All settings values are displayed

**Expected Behavior**: Settings page shows complete configuration overview.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### ST-002: Current Settings Display
- [ ] Gas Limit: shows integer value (e.g., 30000000)
- [ ] Auto-refresh: shows "Enabled" or "Disabled"
- [ ] Seed: shows truncated hex value (20 chars + "...")
- [ ] Accounts: shows count (e.g., 10)
- [ ] All labels are bold and properly aligned
- [ ] All values are colored (amber/yellow)

**Expected Behavior**: Current configuration values clearly displayed.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### ST-003: Available Actions Display
- [ ] "Press 'r' to reset blockchain" option shown
- [ ] "Press 'g' to regenerate accounts" option shown
- [ ] "Press 't' to toggle auto-refresh" option shown
- [ ] "Press '['/']' to adjust gas limit" option shown
- [ ] Action keys are highlighted/bold
- [ ] Instructions are clear and readable

**Expected Behavior**: All available settings actions are clearly documented.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### ST-004: Reset Blockchain - Confirmation Prompt
1. [ ] Navigate to Settings (Tab 7)
2. [ ] Press 'r' to reset
3. [ ] Confirmation prompt appears
4. [ ] Prompt shows "Confirm reset?" or similar warning
5. [ ] Help text shows 'y' to confirm option
6. [ ] Help text shows other keys to cancel option

**Expected Behavior**: Reset requires explicit confirmation before proceeding.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### ST-005: Reset Blockchain - Confirm with 'y'
1. [ ] Navigate to Settings (Tab 7)
2. [ ] Note current block height from Dashboard
3. [ ] Press 'r' to reset
4. [ ] Press 'y' to confirm
5. [ ] Blockchain resets to genesis state
6. [ ] Block height returns to 0 or 1
7. [ ] Transaction history cleared
8. [ ] Account balances reset to initial values
9. [ ] No crashes or errors

**Expected Behavior**: Blockchain completely resets to initial state.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### ST-006: Reset Blockchain - Cancel with 'n'
1. [ ] Navigate to Settings (Tab 7)
2. [ ] Note current block height from Dashboard
3. [ ] Press 'r' to reset
4. [ ] Press 'n' or any other key to cancel
5. [ ] Returns to Settings view
6. [ ] Blockchain state unchanged
7. [ ] Block height same as before
8. [ ] No data loss

**Expected Behavior**: Cancel preserves all blockchain state.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### ST-007: Regenerate Accounts - Confirmation Prompt
1. [ ] Navigate to Settings (Tab 7)
2. [ ] Note current seed value (first 20 chars)
3. [ ] Press 'g' to regenerate
4. [ ] Confirmation prompt appears
5. [ ] Prompt shows "Confirm regenerate accounts?" message
6. [ ] Help text shows 'y' to confirm option

**Expected Behavior**: Regenerate requires explicit confirmation.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### ST-008: Regenerate Accounts - Confirm with 'y'
1. [ ] Navigate to Settings (Tab 7)
2. [ ] Note current seed value
3. [ ] Navigate to Accounts (Tab 2), note first account address
4. [ ] Return to Settings (Tab 7)
5. [ ] Press 'g' to regenerate
6. [ ] Press 'y' to confirm
7. [ ] New seed value displayed (different from before)
8. [ ] Account count remains 10
9. [ ] Navigate to Accounts (Tab 2)
10. [ ] Account addresses are different (new accounts)
11. [ ] All accounts have initial balances
12. [ ] No crashes or errors

**Expected Behavior**: New accounts generated with new seed, balances reset.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### ST-009: Regenerate Accounts - Cancel
1. [ ] Navigate to Settings (Tab 7)
2. [ ] Note current seed value
3. [ ] Press 'g' to regenerate
4. [ ] Press any key other than 'y' to cancel
5. [ ] Returns to Settings view
6. [ ] Seed value unchanged
7. [ ] Accounts unchanged

**Expected Behavior**: Cancel preserves existing accounts and seed.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### ST-010: Toggle Auto-Refresh
1. [ ] Navigate to Settings (Tab 7)
2. [ ] Note current auto-refresh status (e.g., "Disabled")
3. [ ] Press 't' to toggle
4. [ ] Auto-refresh status changes immediately (e.g., to "Enabled")
5. [ ] Press 't' again to toggle back
6. [ ] Status returns to original state
7. [ ] No confirmation prompt (immediate toggle)
8. [ ] Navigate to Dashboard to verify effect

**Expected Behavior**: Auto-refresh toggles immediately without confirmation.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### ST-011: Increase Gas Limit with ']'
1. [ ] Navigate to Settings (Tab 7)
2. [ ] Note current gas limit value (e.g., 30000000)
3. [ ] Press ']' to increase
4. [ ] Gas limit increases by 1,000,000
5. [ ] New value displayed immediately (e.g., 31000000)
6. [ ] Press ']' multiple times
7. [ ] Value continues to increase by 1,000,000 each time

**Expected Behavior**: Gas limit increases by 1M per press, updates instantly.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### ST-012: Decrease Gas Limit with '['
1. [ ] Navigate to Settings (Tab 7)
2. [ ] Ensure gas limit > 1,000,000 (use ']' if needed)
3. [ ] Note current gas limit value
4. [ ] Press '[' to decrease
5. [ ] Gas limit decreases by 1,000,000
6. [ ] New value displayed immediately
7. [ ] Press '[' multiple times
8. [ ] Value continues to decrease by 1,000,000 each time
9. [ ] Value cannot go below 1,000,000 (boundary check)

**Expected Behavior**: Gas limit decreases by 1M per press, minimum 1M enforced.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

---

## Navigation Tests

### NAV-001: Tab Key Navigation
1. [ ] Press '1' - navigates to Dashboard
2. [ ] Press '2' - navigates to Accounts
3. [ ] Press '3' - navigates to Blocks
4. [ ] Press '4' - navigates to Transactions
5. [ ] Press '5' - navigates to Contracts
6. [ ] Press '6' - navigates to State Inspector
7. [ ] Press '7' - navigates to Settings
8. [ ] Each tab shows correct content
9. [ ] Tab bar highlights current tab

**Expected Behavior**: Number keys 1-7 switch between main tabs.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### NAV-002: Help Text Accuracy
1. [ ] Navigate to Dashboard (Tab 1)
2. [ ] Help text shows available keys for Dashboard
3. [ ] Navigate to Settings (Tab 7)
4. [ ] Help text shows available keys for Settings
5. [ ] Help text updates for each tab/state
6. [ ] All mentioned keys actually work as described

**Expected Behavior**: Help text at bottom always matches available actions.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### NAV-003: Escape Key Behavior
1. [ ] From Settings (Tab 7), press Esc
2. [ ] Returns to Dashboard (Tab 1)
3. [ ] From any other tab, press Esc
4. [ ] Returns to Dashboard (Tab 1)
5. [ ] From Dashboard, press Esc
6. [ ] Application quits gracefully

**Expected Behavior**: Esc navigates back or quits from Dashboard.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### NAV-004: No Crashes During Navigation
1. [ ] Rapidly press tab keys 1-7 in random order
2. [ ] Press Esc multiple times
3. [ ] Alternate between Settings actions and tab switching
4. [ ] Toggle auto-refresh while switching tabs
5. [ ] Adjust gas limit while switching tabs
6. [ ] No crashes, panics, or UI corruption
7. [ ] Application remains responsive

**Expected Behavior**: Application handles all navigation smoothly.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

---

## Edge Cases & Error Handling

### EDGE-001: Gas Limit Boundaries
1. [ ] Navigate to Settings (Tab 7)
2. [ ] Press '[' repeatedly until gas limit = 1,000,000
3. [ ] Press '[' again - value stays at 1,000,000 (doesn't go negative)
4. [ ] Press ']' repeatedly (20+ times)
5. [ ] Gas limit increases without overflow
6. [ ] No crashes or display issues

**Expected Behavior**: Gas limit bounded at minimum, grows safely.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### EDGE-002: Reset During Auto-Refresh
1. [ ] Enable auto-refresh in Settings (Tab 7)
2. [ ] Navigate to Dashboard (Tab 1)
3. [ ] Observe auto-refresh working
4. [ ] Return to Settings (Tab 7)
5. [ ] Press 'r' to reset, confirm with 'y'
6. [ ] Return to Dashboard (Tab 1)
7. [ ] Auto-refresh continues working after reset
8. [ ] Dashboard shows genesis state correctly

**Expected Behavior**: Reset doesn't break auto-refresh functionality.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### EDGE-003: Regenerate During Active Session
1. [ ] Create some activity (if possible - deploy contract, send tx)
2. [ ] Navigate to Settings (Tab 7)
3. [ ] Press 'g' to regenerate, confirm with 'y'
4. [ ] Navigate to Accounts (Tab 2)
5. [ ] New accounts shown
6. [ ] Navigate to Dashboard (Tab 1)
7. [ ] Previous transactions/blocks may reference old accounts
8. [ ] No crashes or data corruption

**Expected Behavior**: Regenerate creates new accounts, doesn't corrupt history.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

---

## Known Issues
Document any bugs or unexpected behavior found during testing:

| Issue ID | Description | Severity | Steps to Reproduce |
|----------|-------------|----------|-------------------|
| KI-001   |             |          |                   |
| KI-002   |             |          |                   |
| KI-003   |             |          |                   |

---

## Test Summary

**Total Tests**: 32
**Passed**: ___
**Failed**: ___
**Skipped**: ___
**Pass Rate**: ___%

### Critical Issues Found
```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

### Tester Notes & Observations
```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

### Recommendations
```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

---

**Test Completed By**: ________________
**Date**: ________________
**Sign-off**: ________________
