# QA Test Checklist: Accounts & State Inspector

## Test Environment
- **OS**: ___________________
- **Terminal**: ___________________
- **Terminal Size**: ___________________
- **Go Version**: ___________________
- **Clipboard Support**: ___________________
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
4. Application should launch into Dashboard (Tab 1)

### Initial State Verification
- [ ] Application launches without errors
- [ ] 10 pre-funded test accounts are created
- [ ] Navigate to Accounts (Tab 2) to verify accounts exist
- [ ] Navigate to State Inspector (Tab 6) to verify it loads

---

## Accounts Tests (Tab 2)

### Test Status Legend
- [ ] = Not tested
- [x] = Pass
- [~] = Fail
- [-] = Skipped

### ACC-001: Accounts List Display
1. [ ] Press '2' to navigate to Accounts tab
2. [ ] "Accounts" header displayed
3. [ ] Subtitle shows "Pre-funded Test Accounts"
4. [ ] Account list table is displayed
5. [ ] Table shows 10 accounts (indices 0-9 or 1-10)
6. [ ] Each row shows: address, balance
7. [ ] Addresses are properly formatted (0x...)
8. [ ] Balances show large initial amounts (e.g., 1000 ETH)

**Expected Behavior**: All 10 test accounts displayed in table format.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### ACC-002: Account List Navigation
1. [ ] Navigate to Accounts (Tab 2)
2. [ ] Press Down arrow key
3. [ ] Cursor moves to next account
4. [ ] Highlighted row changes
5. [ ] Press Down arrow repeatedly
6. [ ] Cursor moves through all accounts
7. [ ] Press Up arrow key
8. [ ] Cursor moves to previous account
9. [ ] At top of list, Up arrow doesn't crash
10. [ ] At bottom of list, Down arrow doesn't crash

**Expected Behavior**: Arrow keys navigate through account list smoothly.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### ACC-003: Account Selection
1. [ ] Navigate to Accounts (Tab 2)
2. [ ] Use arrow keys to select an account (e.g., account #5)
3. [ ] Press Enter to view details
4. [ ] Account detail view opens
5. [ ] Correct account information displayed
6. [ ] Address matches the selected account

**Expected Behavior**: Enter opens detail view for selected account.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### ACC-004: Account Detail Display
1. [ ] Navigate to Accounts (Tab 2)
2. [ ] Select first account (index 0 or 1)
3. [ ] Press Enter
4. [ ] Account detail page displays "Account Detail" header
5. [ ] Following fields shown:
   - [ ] Index (0-9 or 1-10)
   - [ ] Address (42 characters, 0x prefix)
   - [ ] Balance (formatted with ETH units)
   - [ ] Nonce (integer, initially 0)
   - [ ] Code Size (0 for regular accounts)
6. [ ] All values properly formatted
7. [ ] Layout is clear and readable

**Expected Behavior**: Account detail shows comprehensive account information.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### ACC-005: Private Key Reveal - Initial State
1. [ ] Navigate to account detail view
2. [ ] Private key is NOT displayed initially
3. [ ] Help text shows 'p' key available
4. [ ] Help text mentions "reveal private key" or similar
5. [ ] No private key visible in plain text

**Expected Behavior**: Private key hidden by default for security.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### ACC-006: Private Key Reveal - Confirmation Prompt
1. [ ] Navigate to account detail view
2. [ ] Press 'p' to reveal private key
3. [ ] Confirmation prompt appears
4. [ ] Prompt asks "Confirm private key reveal?" or similar warning
5. [ ] Help text shows 'y' to confirm
6. [ ] Help text shows other keys to cancel
7. [ ] Private key NOT yet visible

**Expected Behavior**: Revealing private key requires explicit confirmation.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### ACC-007: Private Key Reveal - Confirm with 'y'
1. [ ] Navigate to account detail view
2. [ ] Press 'p' to reveal
3. [ ] Press 'y' to confirm
4. [ ] Private key is now displayed
5. [ ] Private key is 64 hex characters (without 0x) or 66 (with 0x)
6. [ ] Private key is clearly labeled
7. [ ] Private key is styled differently (possibly highlighted/colored)
8. [ ] Account still shows all other info (address, balance, etc.)

**Expected Behavior**: Private key revealed after confirmation.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### ACC-008: Private Key Reveal - Cancel
1. [ ] Navigate to account detail view
2. [ ] Press 'p' to reveal
3. [ ] Press 'n' or any key other than 'y'
4. [ ] Confirmation prompt disappears
5. [ ] Returns to account detail view
6. [ ] Private key remains hidden
7. [ ] No changes to display

**Expected Behavior**: Cancel returns to normal view without revealing key.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### ACC-009: Private Key Hide - Press 'p' Again
1. [ ] Navigate to account detail view
2. [ ] Press 'p', confirm with 'y' to reveal private key
3. [ ] Private key is displayed
4. [ ] Press 'p' again
5. [ ] NO confirmation prompt appears this time
6. [ ] Private key is hidden immediately
7. [ ] Account detail view still shown
8. [ ] All other information unchanged

**Expected Behavior**: Hiding private key is immediate, no confirmation needed.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### ACC-010: Private Key Toggle Multiple Times
1. [ ] Navigate to account detail view
2. [ ] Press 'p', confirm with 'y' - key revealed
3. [ ] Press 'p' again - key hidden
4. [ ] Press 'p', confirm with 'y' - key revealed again
5. [ ] Press 'p' again - key hidden again
6. [ ] Repeat 2-3 more times
7. [ ] Toggle works consistently
8. [ ] No UI corruption or crashes

**Expected Behavior**: Private key can be toggled on/off repeatedly.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### ACC-011: Return to Account List
1. [ ] Navigate to account detail view
2. [ ] Press Esc to return
3. [ ] Returns to account list (Tab 2)
4. [ ] Previously selected account still highlighted (cursor preserved)
5. [ ] Account list unchanged
6. [ ] Can navigate and select other accounts

**Expected Behavior**: Esc returns to account list, preserves cursor position.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### ACC-012: Private Key State Reset on Exit
1. [ ] Navigate to account detail view
2. [ ] Press 'p', confirm with 'y' to reveal private key
3. [ ] Private key displayed
4. [ ] Press Esc to return to list
5. [ ] Select same account again, press Enter
6. [ ] Private key is hidden again (reset)
7. [ ] Must press 'p' and confirm 'y' to reveal again

**Expected Behavior**: Private key reveal state resets when exiting detail view.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### ACC-013: Multiple Account Details
1. [ ] Navigate to account detail for account #0
2. [ ] Note the address
3. [ ] Press Esc to return
4. [ ] Select account #5
5. [ ] Press Enter to view details
6. [ ] Account #5 details shown (different address)
7. [ ] Press Esc to return
8. [ ] Select account #9
9. [ ] Press Enter to view details
10. [ ] Account #9 details shown
11. [ ] Each account shows correct, unique information

**Expected Behavior**: Can view details for any account, each shows correct data.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

---

## State Inspector Tests (Tab 6)

### INS-001: State Inspector Display
1. [ ] Press '6' to navigate to State Inspector tab
2. [ ] "State Inspector" header displayed
3. [ ] Subtitle shows "Query Blockchain State"
4. [ ] Text input field is displayed
5. [ ] Placeholder text shows "Enter address (0x...)"
6. [ ] Input field is focused (cursor blinking)
7. [ ] No results shown initially

**Expected Behavior**: State Inspector shows input field ready for address entry.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### INS-002: Text Input - Typing
1. [ ] Navigate to State Inspector (Tab 6)
2. [ ] Type characters: "0x1234567890"
3. [ ] Characters appear in input field
4. [ ] Cursor moves as you type
5. [ ] Type additional characters
6. [ ] Input continues to work smoothly

**Expected Behavior**: Text input accepts keyboard input normally.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### INS-003: Text Input - Cursor Navigation
1. [ ] Navigate to State Inspector (Tab 6)
2. [ ] Type "0x1234567890abcdef"
3. [ ] Press Left arrow key multiple times
4. [ ] Cursor moves left through text
5. [ ] Press Right arrow key
6. [ ] Cursor moves right through text
7. [ ] Press Home key (if available)
8. [ ] Cursor moves to beginning
9. [ ] Press End key (if available)
10. [ ] Cursor moves to end

**Expected Behavior**: Cursor navigation works within input field.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### INS-004: Text Input - Backspace/Delete
1. [ ] Navigate to State Inspector (Tab 6)
2. [ ] Type "0x1234567890"
3. [ ] Press Backspace
4. [ ] Last character deleted
5. [ ] Press Backspace multiple times
6. [ ] Characters deleted one by one
7. [ ] Position cursor in middle of text
8. [ ] Press Delete key (if available)
9. [ ] Character after cursor deleted

**Expected Behavior**: Backspace and Delete remove characters correctly.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### INS-005: Paste Support - Ctrl+V
1. [ ] Copy a valid address to clipboard: `0x0000000000000000000000000000000000000001`
2. [ ] Navigate to State Inspector (Tab 6)
3. [ ] Press Ctrl+V (or Cmd+V on macOS)
4. [ ] Address pastes into input field
5. [ ] Cursor positioned at end of pasted text
6. [ ] Text is complete and correct

**Expected Behavior**: Ctrl+V pastes clipboard content into input field.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### INS-006: Paste Support - Multiline Cleanup
1. [ ] Copy multiline text to clipboard (e.g., address with newlines):
   ```
   0x0000000000000000000000000000
   000000000001
   ```
2. [ ] Navigate to State Inspector (Tab 6)
3. [ ] Press Ctrl+V to paste
4. [ ] Pasted content is cleaned (newlines removed)
5. [ ] Appears as single line: `0x0000000000000000000000000000000000000001`
6. [ ] Spaces replaced or removed appropriately

**Expected Behavior**: Multiline paste is cleaned to single line for input.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### INS-007: Clipboard Unavailable Error
1. [ ] Test on system with no clipboard support (if possible)
2. [ ] OR disconnect from X11/display (if applicable)
3. [ ] Navigate to State Inspector (Tab 6)
4. [ ] Press Ctrl+V to paste
5. [ ] Error message shown OR paste silently fails
6. [ ] Application doesn't crash
7. [ ] Error is non-fatal
8. [ ] Can continue typing manually

**Expected Behavior**: Clipboard unavailable doesn't crash application.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### INS-008: Valid Address Inspection
1. [ ] Navigate to Accounts (Tab 2)
2. [ ] Note first account's address (e.g., `0xabc...123`)
3. [ ] Navigate to State Inspector (Tab 6)
4. [ ] Enter the account address (type or paste)
5. [ ] Press Enter
6. [ ] State information is displayed
7. [ ] Shows: Address, Balance, Nonce, Contract flag, Code size
8. [ ] Balance matches account balance from Accounts tab
9. [ ] "Contract: No" displayed (or "Is Contract: No")
10. [ ] Code size is 0

**Expected Behavior**: Valid address inspection shows complete account state.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### INS-009: Contract Account Inspection
1. [ ] Deploy a contract (if test setup allows) OR use known contract address
2. [ ] Navigate to State Inspector (Tab 6)
3. [ ] Enter contract address
4. [ ] Press Enter
5. [ ] State information displayed
6. [ ] "Contract: Yes" shown (or "Is Contract: Yes")
7. [ ] "Contract: Yes" is colored (e.g., green/success color)
8. [ ] Code size > 0 (shows bytecode length)
9. [ ] All other fields populated correctly

**Expected Behavior**: Contract accounts clearly identified with code size.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### INS-010: Regular Account Inspection
1. [ ] Navigate to State Inspector (Tab 6)
2. [ ] Enter a pre-funded account address
3. [ ] Press Enter
4. [ ] State information displayed
5. [ ] "Contract: No" shown
6. [ ] "Contract: No" is colored (e.g., red/error color or neutral)
7. [ ] Code size is 0 or not shown
8. [ ] Balance and nonce shown correctly

**Expected Behavior**: Regular accounts show "Contract: No" distinction.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### INS-011: Invalid Address - Empty Input
1. [ ] Navigate to State Inspector (Tab 6)
2. [ ] Leave input field empty
3. [ ] Press Enter
4. [ ] Validation error displayed
5. [ ] Error message is clear (e.g., "Address required" or "Invalid address")
6. [ ] Error is red/error colored
7. [ ] Application doesn't crash
8. [ ] Can continue to type and try again

**Expected Behavior**: Empty input shows helpful validation error.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### INS-012: Invalid Address - Wrong Length (Too Short)
1. [ ] Navigate to State Inspector (Tab 6)
2. [ ] Enter "0x123" (too short)
3. [ ] Press Enter
4. [ ] Validation error displayed
5. [ ] Error mentions address length requirement (42 characters)
6. [ ] Error is clear and helpful

**Expected Behavior**: Short address rejected with helpful error message.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### INS-013: Invalid Address - Wrong Length (Too Long)
1. [ ] Navigate to State Inspector (Tab 6)
2. [ ] Enter "0x00000000000000000000000000000000000000001234" (too long)
3. [ ] Press Enter
4. [ ] Validation error displayed
5. [ ] Error mentions address length requirement

**Expected Behavior**: Long address rejected with validation error.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### INS-014: Invalid Address - Missing 0x Prefix
1. [ ] Navigate to State Inspector (Tab 6)
2. [ ] Enter "0000000000000000000000000000000000000001" (no 0x)
3. [ ] Press Enter
4. [ ] Validation error displayed
5. [ ] Error mentions "must start with 0x" or similar
6. [ ] Error is helpful and specific

**Expected Behavior**: Address without 0x prefix rejected with clear error.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### INS-015: Invalid Address - Non-Hex Characters
1. [ ] Navigate to State Inspector (Tab 6)
2. [ ] Enter "0x00000000000000000000000000000000000000XYZ"
3. [ ] Press Enter
4. [ ] Validation error displayed
5. [ ] Error mentions invalid hex characters or invalid format
6. [ ] Error is clear

**Expected Behavior**: Non-hex characters rejected with validation error.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### INS-016: Multiple Inspections
1. [ ] Navigate to State Inspector (Tab 6)
2. [ ] Enter first account address, press Enter
3. [ ] Results displayed for account 1
4. [ ] Clear input field (select all, delete)
5. [ ] Enter second account address, press Enter
6. [ ] Results update to show account 2 info
7. [ ] Repeat with 2-3 more addresses
8. [ ] Each inspection updates correctly
9. [ ] No lingering data from previous inspections

**Expected Behavior**: Can inspect multiple addresses sequentially.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### INS-017: Storage Slots Display
1. [ ] Inspect an account with storage (contract with state variables)
2. [ ] State information shows "Storage Slots" count
3. [ ] Count is 0 for regular accounts
4. [ ] Count > 0 for contracts with storage
5. [ ] Number is accurate

**Expected Behavior**: Storage slot count displayed for all accounts.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### INS-018: Return from State Inspector
1. [ ] Navigate to State Inspector (Tab 6)
2. [ ] Enter an address and inspect it
3. [ ] Results displayed
4. [ ] Press Esc
5. [ ] Returns to Dashboard (Tab 1)
6. [ ] No errors or crashes

**Expected Behavior**: Esc returns to Dashboard from State Inspector.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

---

## Integration Tests

### INT-001: Account to Inspector Workflow
1. [ ] Navigate to Accounts (Tab 2)
2. [ ] Select an account, view details
3. [ ] Copy account address (manually or via clipboard)
4. [ ] Navigate to State Inspector (Tab 6)
5. [ ] Paste address
6. [ ] Press Enter to inspect
7. [ ] Balance matches between Accounts and Inspector
8. [ ] Nonce matches
9. [ ] All data consistent

**Expected Behavior**: Same account shows consistent data across views.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### INT-002: Private Key Reveal Security
1. [ ] Navigate to account detail view
2. [ ] Reveal private key (press 'p', confirm 'y')
3. [ ] Take note that confirmation is required (security measure)
4. [ ] Test that key can be hidden quickly (press 'p')
5. [ ] Verify state resets on exit (return to list, re-enter)
6. [ ] Confirm private key is never logged to console/files

**Expected Behavior**: Private key handling prioritizes security.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### INT-003: Account State After Transactions
1. [ ] Note an account's balance and nonce in Accounts (Tab 2)
2. [ ] Perform a transaction from that account (if test setup allows)
3. [ ] Return to Accounts (Tab 2)
4. [ ] Verify balance decreased (gas + value sent)
5. [ ] Verify nonce increased by 1
6. [ ] Navigate to State Inspector (Tab 6)
7. [ ] Inspect same account address
8. [ ] Balance and nonce match Accounts tab

**Expected Behavior**: Account state updates reflected in both views.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

---

## Edge Cases & Error Handling

### EDGE-001: Character Limit on Input
1. [ ] Navigate to State Inspector (Tab 6)
2. [ ] Try to type more than 42 characters
3. [ ] Input stops accepting at character limit (42)
4. [ ] No overflow or buffer issues
5. [ ] Can still navigate and edit within limit

**Expected Behavior**: Input field enforces 42 character limit.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### EDGE-002: Special Characters in Input
1. [ ] Navigate to State Inspector (Tab 6)
2. [ ] Try to enter special characters: !@#$%^&*()
3. [ ] Input field behavior is reasonable
4. [ ] Validation catches non-hex characters
5. [ ] No crashes or unexpected behavior

**Expected Behavior**: Special characters handled gracefully.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### EDGE-003: Rapid Tab Switching
1. [ ] Press '2' to Accounts
2. [ ] Immediately press '6' to State Inspector
3. [ ] Immediately press '2' to Accounts
4. [ ] Repeat rapidly 10 times
5. [ ] No crashes or UI corruption
6. [ ] Application remains responsive

**Expected Behavior**: Rapid navigation handled smoothly.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### EDGE-004: Non-Existent Address Inspection
1. [ ] Navigate to State Inspector (Tab 6)
2. [ ] Enter a valid format but non-existent address:
   `0x9999999999999999999999999999999999999999`
3. [ ] Press Enter
4. [ ] Results show address with zero balance
5. [ ] Nonce is 0
6. [ ] Contract: No
7. [ ] Code size: 0
8. [ ] No error (it's valid to inspect non-existent address)

**Expected Behavior**: Non-existent addresses show zero state.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### EDGE-005: Case Sensitivity
1. [ ] Navigate to State Inspector (Tab 6)
2. [ ] Enter address with uppercase hex: `0xABCDEF0123456789ABCDEF0123456789ABCDEF01`
3. [ ] Press Enter
4. [ ] Address is accepted
5. [ ] Results displayed correctly
6. [ ] Try same address with lowercase
7. [ ] Both work (case-insensitive for hex)

**Expected Behavior**: Address inspection is case-insensitive for hex.

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

**Total Tests**: 46
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
