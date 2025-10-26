# QA Test Checklist: Blocks, Transactions & Contracts

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

### Test Data Setup
For comprehensive testing, you may need to create blockchain activity:
- Deploy contracts (if test environment supports it)
- Send transactions between accounts
- Generate multiple blocks with transactions
- Create both successful and failed transactions

### Initial State Verification
- [ ] Application launches without errors
- [ ] Genesis block exists (block #0 or #1)
- [ ] Can navigate to Blocks (Tab 3)
- [ ] Can navigate to Transactions (Tab 4)
- [ ] Can navigate to Contracts (Tab 5)

---

## Blocks Tests (Tab 3)

### Test Status Legend
- [ ] = Not tested
- [x] = Pass
- [~] = Fail
- [-] = Skipped

### BLK-001: Blocks List Display
1. [ ] Press '3' to navigate to Blocks tab
2. [ ] "Blocks" header displayed
3. [ ] Subtitle shows "Block Explorer"
4. [ ] Block list table is displayed
5. [ ] At least genesis block shown (block #0 or #1)
6. [ ] Each row shows: block number, hash, timestamp
7. [ ] Block hashes are formatted (0x prefix)
8. [ ] Gas usage bar/indicator displayed for each block

**Expected Behavior**: All blocks displayed in table with formatted data.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### BLK-002: Block List Ordering
1. [ ] Navigate to Blocks (Tab 3)
2. [ ] Verify blocks are ordered (newest first recommended)
3. [ ] Block numbers are sequential or reverse sequential
4. [ ] Genesis block is present
5. [ ] Most recent block appears at top or bottom (consistent)

**Expected Behavior**: Blocks listed in logical order (newest first or oldest first).

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### BLK-003: Block List Navigation
1. [ ] Navigate to Blocks (Tab 3)
2. [ ] Press Down arrow key
3. [ ] Cursor moves to next block
4. [ ] Highlighted row changes
5. [ ] Press Down arrow repeatedly
6. [ ] Cursor moves through all blocks
7. [ ] Press Up arrow key
8. [ ] Cursor moves to previous block
9. [ ] At boundaries (top/bottom), arrow keys don't crash

**Expected Behavior**: Arrow keys navigate through block list smoothly.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### BLK-004: Gas Usage Bar Display
1. [ ] Navigate to Blocks (Tab 3)
2. [ ] Examine gas usage bars for multiple blocks
3. [ ] Empty blocks show minimal/no gas bar
4. [ ] Full blocks show full or near-full gas bar
5. [ ] Gas bar is visually proportional to usage
6. [ ] Gas bar has clear visual style (color, width)

**Expected Behavior**: Gas usage bars visually represent block gas consumption.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### BLK-005: Block Selection
1. [ ] Navigate to Blocks (Tab 3)
2. [ ] Use arrow keys to select a block
3. [ ] Press Enter to view details
4. [ ] Block detail view opens
5. [ ] Correct block information displayed
6. [ ] Block number matches selected block

**Expected Behavior**: Enter opens detail view for selected block.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### BLK-006: Block Detail Display - Basic Info
1. [ ] Navigate to Blocks (Tab 3)
2. [ ] Select a block with transactions (if available)
3. [ ] Press Enter
4. [ ] Block detail page displays "Block Detail" header
5. [ ] Following fields shown:
   - [ ] Number (integer)
   - [ ] Hash (64 hex chars with 0x prefix)
   - [ ] Parent Hash (64 hex chars with 0x prefix)
   - [ ] Timestamp (formatted date/time)
   - [ ] Miner address (42 chars with 0x prefix)
   - [ ] Gas usage (used/limit with percentage)
6. [ ] All values properly formatted
7. [ ] Layout is clear and readable

**Expected Behavior**: Block detail shows comprehensive block metadata.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### BLK-007: Block Detail - Gas Usage Display
1. [ ] Navigate to block detail view
2. [ ] Gas usage shows format like "2,000,000 / 30,000,000"
3. [ ] Percentage calculated correctly (e.g., "6.67%")
4. [ ] Visual gas bar displayed
5. [ ] Gas bar proportional to percentage
6. [ ] Empty blocks show 0 or minimal usage

**Expected Behavior**: Gas usage clearly displayed with percentage and visual bar.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### BLK-008: Block Detail - Transactions List
1. [ ] Navigate to block detail for block with transactions
2. [ ] "Transactions" section displayed
3. [ ] All transactions in block are listed
4. [ ] Each transaction shows:
   - [ ] Status icon (✓ for success, ✗ for failure)
   - [ ] Transaction hash (truncated for readability)
   - [ ] Transaction type (CALL, CREATE, etc.)
5. [ ] Transaction hashes truncated to ~10-15 chars + "..."
6. [ ] List is readable and well-formatted

**Expected Behavior**: All block transactions listed with status icons.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### BLK-009: Block Detail - Empty Block
1. [ ] Navigate to Blocks (Tab 3)
2. [ ] Select genesis block or another empty block
3. [ ] Press Enter to view details
4. [ ] Block detail shows all metadata
5. [ ] Transactions section shows "No transactions" or empty list
6. [ ] Gas used is 0 or minimal
7. [ ] No errors or crashes

**Expected Behavior**: Empty blocks display correctly with no transactions.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### BLK-010: Return to Block List
1. [ ] Navigate to block detail view
2. [ ] Press Esc to return
3. [ ] Returns to block list (Tab 3)
4. [ ] Previously selected block still highlighted (cursor preserved)
5. [ ] Block list unchanged
6. [ ] Can navigate and select other blocks

**Expected Behavior**: Esc returns to block list, preserves cursor position.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

---

## Transactions Tests (Tab 4)

### TXN-001: Transactions List Display
1. [ ] Press '4' to navigate to Transactions tab
2. [ ] "Transactions" header displayed
3. [ ] Subtitle shows "Transaction History"
4. [ ] Transaction list table is displayed
5. [ ] Each row shows: type, status, parties (from/to)
6. [ ] Transaction types labeled (CALL, CREATE, etc.)
7. [ ] Status icons shown (✓ for success, ✗ for failure)

**Expected Behavior**: All transactions displayed in table with clear status.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### TXN-002: Transaction List Ordering
1. [ ] Navigate to Transactions (Tab 4)
2. [ ] Verify transactions are ordered (newest first recommended)
3. [ ] Most recent transactions appear at top
4. [ ] Ordering is consistent

**Expected Behavior**: Transactions listed in reverse chronological order.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### TXN-003: Transaction List Navigation
1. [ ] Navigate to Transactions (Tab 4)
2. [ ] Press Down arrow key
3. [ ] Cursor moves to next transaction
4. [ ] Highlighted row changes
5. [ ] Press Down arrow repeatedly
6. [ ] Cursor moves through all transactions
7. [ ] Press Up arrow key
8. [ ] Cursor moves to previous transaction
9. [ ] At boundaries, arrow keys don't crash

**Expected Behavior**: Arrow keys navigate through transaction list smoothly.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### TXN-004: Transaction Status Icons
1. [ ] Navigate to Transactions (Tab 4)
2. [ ] Identify successful transactions
3. [ ] Verify ✓ icon displayed for successful txs
4. [ ] Identify failed transactions (if any)
5. [ ] Verify ✗ icon displayed for failed txs
6. [ ] Icons are clearly visible and colored
7. [ ] Success icons are green/success colored
8. [ ] Failure icons are red/error colored

**Expected Behavior**: Status icons clearly differentiate success/failure.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### TXN-005: Transaction Selection
1. [ ] Navigate to Transactions (Tab 4)
2. [ ] Use arrow keys to select a transaction
3. [ ] Press Enter to view details
4. [ ] Transaction detail view opens
5. [ ] Correct transaction information displayed
6. [ ] Transaction hash matches

**Expected Behavior**: Enter opens detail view for selected transaction.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### TXN-006: Transaction Detail Display - Basic Info
1. [ ] Navigate to Transactions (Tab 4)
2. [ ] Select a transaction
3. [ ] Press Enter
4. [ ] Transaction detail page displays "Transaction Detail" header
5. [ ] Following fields shown:
   - [ ] Hash (64 hex chars with 0x prefix)
   - [ ] Type (CALL, CREATE, CREATE2, DELEGATECALL, STATICCALL)
   - [ ] Block # (integer)
   - [ ] Status (✓ Success or ✗ Failed with styling)
   - [ ] From address (42 chars with 0x)
   - [ ] To address (42 chars with 0x, or "CONTRACT" for CREATE)
   - [ ] Value (formatted in ETH units)
   - [ ] Gas Used/Limit (e.g., "21000 / 30000000")
   - [ ] Nonce (integer)
6. [ ] All values properly formatted
7. [ ] Layout is clear and readable

**Expected Behavior**: Transaction detail shows comprehensive transaction data.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### TXN-007: Transaction Detail - Input Data Display
1. [ ] Navigate to transaction detail
2. [ ] If transaction has input data:
   - [ ] Input field is shown
   - [ ] Data displayed as hex (0x prefix)
   - [ ] Long input is truncated (e.g., ~80 chars + "...")
   - [ ] Truncation is clear (ends with "...")
3. [ ] If no input data:
   - [ ] Input field shows "0x" or is omitted

**Expected Behavior**: Input data shown, truncated if long for readability.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### TXN-008: Transaction Detail - Return Data Display
1. [ ] Navigate to transaction detail
2. [ ] If transaction has return data:
   - [ ] Return field is shown
   - [ ] Data displayed as hex (0x prefix)
   - [ ] Long return data is truncated (e.g., ~80 chars + "...")
   - [ ] Truncation is clear (ends with "...")
3. [ ] If no return data:
   - [ ] Return field shows "0x" or is omitted

**Expected Behavior**: Return data shown, truncated if long for readability.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### TXN-009: Transaction Detail - Deployed Address
1. [ ] Find or create a CREATE/CREATE2 transaction
2. [ ] Navigate to its transaction detail
3. [ ] "Deployed" or "Deployed Address" field is shown
4. [ ] Shows 42-char contract address with 0x prefix
5. [ ] Address is valid and properly formatted
6. [ ] For non-CREATE transactions, field is absent

**Expected Behavior**: CREATE transactions show deployed contract address.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### TXN-010: Transaction Detail - Error Display
1. [ ] Find or create a failed transaction
2. [ ] Navigate to its transaction detail
3. [ ] Status shows ✗ Failed (red/error styling)
4. [ ] "Error" field is displayed
5. [ ] Error message is shown (e.g., "out of gas", "revert")
6. [ ] Error message is styled (red/error color)
7. [ ] Error message is readable

**Expected Behavior**: Failed transactions show error message clearly.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### TXN-011: Transaction Detail - Logs Section
1. [ ] Find transaction with logs (e.g., contract interaction)
2. [ ] Navigate to its transaction detail
3. [ ] "Logs" section is displayed
4. [ ] Shows log count (e.g., "LOGS (3)")
5. [ ] Each log entry shows:
   - [ ] Index [0], [1], [2], etc.
   - [ ] Contract address
   - [ ] Number of topics
6. [ ] Logs formatted as table or list
7. [ ] For transaction with no logs, section absent or shows "No logs"

**Expected Behavior**: Transaction logs displayed if present.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### TXN-012: Transaction Detail - Navigate to Logs
**Note**: This test assumes log navigation is implemented based on code review.

1. [ ] Navigate to transaction detail with logs
2. [ ] Logs table/list is displayed
3. [ ] Press Down/Up arrow keys
4. [ ] Cursor navigates through logs
5. [ ] Press Enter on a log
6. [ ] Log detail view opens (if implemented)
7. [ ] Log detail shows expanded information
8. [ ] OR: If not implemented, Enter has no effect

**Expected Behavior**: Can navigate logs, potentially view log details.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### TXN-013: Transaction Detail - Copy Hash
1. [ ] Navigate to transaction detail
2. [ ] Press 'c' to copy transaction hash
3. [ ] Feedback message appears (e.g., "Copied to clipboard")
4. [ ] Message is visible for ~2 seconds
5. [ ] Paste hash elsewhere to verify (external editor)
6. [ ] Hash is correct and complete

**Expected Behavior**: 'c' key copies transaction hash to clipboard.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### TXN-014: Transaction Detail - View Block
1. [ ] Navigate to transaction detail
2. [ ] Note the block number displayed
3. [ ] Press 'b' to view block
4. [ ] Navigates to block detail view for that block
5. [ ] Block number matches transaction's block
6. [ ] Block detail shows all information
7. [ ] Transaction is listed in block's transactions

**Expected Behavior**: 'b' key navigates to transaction's containing block.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### TXN-015: Transaction to Block and Back
1. [ ] Navigate to Transactions (Tab 4)
2. [ ] Select a transaction, press Enter
3. [ ] Transaction detail opens
4. [ ] Press 'b' to view block
5. [ ] Block detail opens
6. [ ] Press Esc to go back
7. [ ] Returns to transaction detail (back navigation preserved)
8. [ ] Press Esc again
9. [ ] Returns to transactions list

**Expected Behavior**: Navigation stack preserves back history correctly.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### TXN-016: Return to Transaction List
1. [ ] Navigate to transaction detail view
2. [ ] Press Esc to return
3. [ ] Returns to transaction list (Tab 4)
4. [ ] Previously selected transaction still highlighted (cursor preserved)
5. [ ] Transaction list unchanged
6. [ ] Can navigate and select other transactions

**Expected Behavior**: Esc returns to transaction list, preserves cursor.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

---

## Contracts Tests (Tab 5)

### CNT-001: Contracts List Display
1. [ ] Press '5' to navigate to Contracts tab
2. [ ] "Contracts" header displayed
3. [ ] Subtitle shows contract-related text
4. [ ] Contract list table is displayed
5. [ ] Each row shows: contract address, code size
6. [ ] Addresses are formatted with 0x prefix
7. [ ] Code size shown in bytes

**Expected Behavior**: All deployed contracts listed with address and size.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### CNT-002: Contracts List Ordering
1. [ ] Navigate to Contracts (Tab 5)
2. [ ] Verify contracts are ordered logically
3. [ ] Newest or oldest contracts first (consistent)
4. [ ] Ordering is clear

**Expected Behavior**: Contracts listed in consistent order.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### CNT-003: Contracts List Navigation
1. [ ] Navigate to Contracts (Tab 5)
2. [ ] Press Down arrow key
3. [ ] Cursor moves to next contract
4. [ ] Highlighted row changes
5. [ ] Press Down arrow repeatedly
6. [ ] Cursor moves through all contracts
7. [ ] Press Up arrow key
8. [ ] Cursor moves to previous contract

**Expected Behavior**: Arrow keys navigate through contract list smoothly.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### CNT-004: Contract Selection
1. [ ] Navigate to Contracts (Tab 5)
2. [ ] Use arrow keys to select a contract
3. [ ] Press Enter to view details
4. [ ] Contract detail view opens
5. [ ] Correct contract information displayed
6. [ ] Contract address matches

**Expected Behavior**: Enter opens detail view for selected contract.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### CNT-005: Contract Detail Display - Split Layout
1. [ ] Navigate to contract detail view
2. [ ] "Contract Detail" header displayed
3. [ ] Layout is split into two panels:
   - [ ] Left panel (~40% width): Contract info
   - [ ] Right panel (~60% width): Disassembly
4. [ ] Split is visually clear (border or spacing)
5. [ ] Both panels visible simultaneously
6. [ ] Layout fits within terminal width

**Expected Behavior**: Contract detail uses split panel layout (40%/60%).

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### CNT-006: Contract Detail - Info Panel
1. [ ] Navigate to contract detail view
2. [ ] Left panel (info) shows:
   - [ ] Address (42 chars with 0x)
   - [ ] Code Size (bytes)
   - [ ] Deployment timestamp (formatted date/time)
   - [ ] Other metadata as applicable
3. [ ] All fields properly labeled
4. [ ] Values properly formatted

**Expected Behavior**: Contract info panel shows metadata clearly.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### CNT-007: Contract Detail - Disassembly Loading
1. [ ] Navigate to contract detail view
2. [ ] Observe right panel (disassembly)
3. [ ] Loading indicator appears (e.g., "Loading..." or spinner)
4. [ ] Disassembly loads asynchronously
5. [ ] After loading, disassembly content displayed
6. [ ] OR: If disassembly fails, error message shown
7. [ ] Loading doesn't block UI (can press Esc during load)

**Expected Behavior**: Disassembly loads asynchronously with loading indicator.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### CNT-008: Contract Detail - Disassembly Display
1. [ ] Navigate to contract detail view
2. [ ] Wait for disassembly to load
3. [ ] Right panel shows disassembly content
4. [ ] Disassembly organized into basic blocks
5. [ ] Each block shows:
   - [ ] Block label/index (e.g., "Block 0", "Block 1")
   - [ ] Instructions within block
6. [ ] Each instruction shows:
   - [ ] PC (program counter)
   - [ ] Opcode name (PUSH1, ADD, JUMPI, etc.)
   - [ ] Argument (if applicable, e.g., "0x60" for PUSH1)
   - [ ] Jump destinations (if applicable, e.g., "→ 0x45")
7. [ ] Instructions formatted in table or aligned columns

**Expected Behavior**: Disassembly shows basic blocks with formatted instructions.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### CNT-009: Contract Detail - Basic Block Navigation
1. [ ] Navigate to contract detail with disassembly loaded
2. [ ] Current basic block is highlighted/displayed
3. [ ] Press Right arrow key
4. [ ] Navigates to next basic block
5. [ ] Block label updates (e.g., "Block 0" → "Block 1")
6. [ ] Instructions table updates to show new block's instructions
7. [ ] Press Left arrow key
8. [ ] Navigates to previous basic block
9. [ ] At first block, Left arrow doesn't crash
10. [ ] At last block, Right arrow doesn't crash

**Expected Behavior**: Left/Right arrows navigate between basic blocks.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### CNT-010: Contract Detail - Instruction Navigation
1. [ ] Navigate to contract detail with disassembly loaded
2. [ ] Focus on instructions table (current basic block)
3. [ ] Press Down arrow key
4. [ ] Cursor moves to next instruction in block
5. [ ] Highlighted row changes
6. [ ] Press Down arrow repeatedly
7. [ ] Cursor moves through all instructions in block
8. [ ] Press Up arrow key
9. [ ] Cursor moves to previous instruction
10. [ ] At boundaries, arrow keys don't crash

**Expected Behavior**: Up/Down arrows navigate instructions within block.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### CNT-011: Contract Detail - Jump Destination Display
1. [ ] Navigate to contract detail with disassembly loaded
2. [ ] Find a JUMP or JUMPI instruction
3. [ ] Instruction shows jump destination (e.g., "→ 0x45" or "JUMPDEST: 69")
4. [ ] Jump destination is clearly formatted
5. [ ] Jump destination is correct PC value

**Expected Behavior**: Jump instructions show their destination addresses.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### CNT-012: Contract Detail - Jump to Destination ('g' key)
1. [ ] Navigate to contract detail with disassembly loaded
2. [ ] Navigate to a JUMP or JUMPI instruction
3. [ ] Note the jump destination (e.g., "→ 0x45")
4. [ ] Press 'g' to jump to destination
5. [ ] Navigates to the basic block containing that PC
6. [ ] Cursor positioned at or near the destination instruction
7. [ ] Block view updates correctly
8. [ ] Instruction is highlighted

**Expected Behavior**: 'g' key navigates to jump destination instruction.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### CNT-013: Contract Detail - Jump to Non-Existent PC
1. [ ] Navigate to contract detail with disassembly loaded
2. [ ] Navigate to instruction without jump destination (e.g., ADD, MUL)
3. [ ] Press 'g' to attempt jump
4. [ ] No navigation occurs OR appropriate message shown
5. [ ] No crash or error
6. [ ] Can continue navigating normally

**Expected Behavior**: Jump on non-jump instruction is handled gracefully.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### CNT-014: Contract Detail - Copy Address
1. [ ] Navigate to contract detail view
2. [ ] Press 'c' to copy contract address
3. [ ] Feedback message appears (e.g., "Copied to clipboard")
4. [ ] Message is visible for ~2 seconds
5. [ ] Paste address elsewhere to verify (external editor)
6. [ ] Address is correct and complete (42 chars with 0x)

**Expected Behavior**: 'c' key copies contract address to clipboard.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### CNT-015: Contract Detail - Disassembly Error Handling
1. [ ] If possible, create scenario with disassembly error
2. [ ] OR: Manually test with malformed bytecode (if test setup allows)
3. [ ] Navigate to contract detail
4. [ ] Right panel shows error message
5. [ ] Error message is clear (e.g., "Failed to disassemble")
6. [ ] Error is styled (red/error color)
7. [ ] Left panel (info) still shows correctly
8. [ ] Application doesn't crash
9. [ ] Can press Esc to return

**Expected Behavior**: Disassembly errors displayed clearly without crashing.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### CNT-016: Return to Contract List
1. [ ] Navigate to contract detail view
2. [ ] Press Esc to return
3. [ ] Returns to contract list (Tab 5)
4. [ ] Previously selected contract still highlighted (cursor preserved)
5. [ ] Contract list unchanged
6. [ ] Disassembly state is cleared (doesn't persist)
7. [ ] Can select and view another contract

**Expected Behavior**: Esc returns to contract list, clears disassembly state.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

---

## Integration Tests

### INT-001: Block to Transaction Workflow
1. [ ] Navigate to Blocks (Tab 3)
2. [ ] Select a block with transactions
3. [ ] Press Enter to view block detail
4. [ ] Note a transaction hash from the transactions list
5. [ ] Navigate to Transactions (Tab 4)
6. [ ] Find the same transaction in list
7. [ ] Press Enter to view transaction detail
8. [ ] Verify block number matches original block
9. [ ] Press 'b' to view block
10. [ ] Returns to original block detail
11. [ ] All data is consistent

**Expected Behavior**: Block and transaction data is consistent across views.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### INT-002: Transaction to Contract Workflow
1. [ ] Find or create a CREATE transaction
2. [ ] Navigate to transaction detail
3. [ ] Note the deployed contract address
4. [ ] Navigate to Contracts (Tab 5)
5. [ ] Find the contract with matching address
6. [ ] Press Enter to view contract detail
7. [ ] Verify address matches transaction's deployed address
8. [ ] All data is consistent

**Expected Behavior**: Deployed contracts can be found and inspected.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### INT-003: Complex Navigation Flow
1. [ ] Start at Dashboard (Tab 1)
2. [ ] Navigate to Blocks (Tab 3)
3. [ ] Select block, view detail
4. [ ] Navigate to Transactions (Tab 4)
5. [ ] Select transaction, view detail
6. [ ] Press 'b' to view block
7. [ ] Press Esc to return to transaction detail
8. [ ] Press Esc to return to transaction list
9. [ ] Navigate to Contracts (Tab 5)
10. [ ] Select contract, view detail
11. [ ] Press Esc to return to contract list
12. [ ] Press Esc to return to Dashboard
13. [ ] No crashes throughout entire flow
14. [ ] Navigation stack works correctly

**Expected Behavior**: Complex navigation flows handled smoothly.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

---

## Edge Cases & Error Handling

### EDGE-001: Empty Blockchain State
1. [ ] Reset blockchain in Settings (Tab 7)
2. [ ] Navigate to Blocks (Tab 3)
3. [ ] Only genesis block shown (if any)
4. [ ] Navigate to Transactions (Tab 4)
5. [ ] "No transactions" or empty list shown
6. [ ] Navigate to Contracts (Tab 5)
7. [ ] "No contracts" or empty list shown
8. [ ] No crashes or errors
9. [ ] UI remains functional

**Expected Behavior**: Empty state handled gracefully in all views.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### EDGE-002: Large Bytecode Disassembly
1. [ ] Deploy contract with large bytecode (if test setup allows)
2. [ ] Navigate to contract detail
3. [ ] Disassembly loads without crash
4. [ ] Can navigate through many basic blocks
5. [ ] Can navigate through many instructions per block
6. [ ] Performance is acceptable (no freezing)
7. [ ] Memory usage is reasonable

**Expected Behavior**: Large bytecode handled efficiently.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### EDGE-003: Rapid Tab Switching Between All Views
1. [ ] Press '3' (Blocks)
2. [ ] Immediately press '4' (Transactions)
3. [ ] Immediately press '5' (Contracts)
4. [ ] Immediately press '3' (Blocks)
5. [ ] Repeat rapidly 10+ times in random order
6. [ ] No crashes or UI corruption
7. [ ] Application remains responsive
8. [ ] Data displays correctly

**Expected Behavior**: Rapid navigation between explorer tabs is smooth.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### EDGE-004: Truncation and Formatting
1. [ ] Find block with very long hash
2. [ ] Verify hash is truncated in list view
3. [ ] Verify full hash shown in detail view
4. [ ] Find transaction with very long input data
5. [ ] Verify input is truncated (~80 chars + "...")
6. [ ] Truncation ends with "..." to indicate more data
7. [ ] All truncation is readable and consistent

**Expected Behavior**: Long data truncated for readability with clear indicators.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### EDGE-005: Clipboard Unavailable
1. [ ] Test on system with no clipboard support (if possible)
2. [ ] Navigate to transaction detail
3. [ ] Press 'c' to copy
4. [ ] Error message shown OR silent failure
5. [ ] Application doesn't crash
6. [ ] Can continue using application normally
7. [ ] Same for contract detail copy address

**Expected Behavior**: Clipboard unavailable doesn't crash application.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### EDGE-006: Log Detail Navigation
1. [ ] Find transaction with multiple logs
2. [ ] Navigate to transaction detail
3. [ ] Navigate through logs with Up/Down
4. [ ] Press Enter on each log
5. [ ] If log detail implemented:
   - [ ] Log detail view opens
   - [ ] Shows expanded log data (topics, data)
   - [ ] Press Esc to return
   - [ ] Returns to transaction detail
6. [ ] If not implemented, Enter has no effect

**Expected Behavior**: Log navigation works as implemented, no crashes.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

---

## Help Text & Usability

### HELP-001: Help Text Accuracy - Blocks
1. [ ] Navigate to Blocks list (Tab 3)
2. [ ] Help text shows available keys (e.g., "↑↓: navigate, Enter: details, Esc: back")
3. [ ] Verify all mentioned keys work
4. [ ] Navigate to block detail
5. [ ] Help text updates (e.g., "Esc: back")
6. [ ] Verify all mentioned keys work

**Expected Behavior**: Help text always matches available actions.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### HELP-002: Help Text Accuracy - Transactions
1. [ ] Navigate to Transactions list (Tab 4)
2. [ ] Help text shows available keys
3. [ ] Verify all mentioned keys work
4. [ ] Navigate to transaction detail
5. [ ] Help text shows 'b': block, 'c': copy, Esc: back
6. [ ] Verify all mentioned keys work

**Expected Behavior**: Help text accurate for all transaction states.

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
```

### HELP-003: Help Text Accuracy - Contracts
1. [ ] Navigate to Contracts list (Tab 5)
2. [ ] Help text shows available keys
3. [ ] Verify all mentioned keys work
4. [ ] Navigate to contract detail
5. [ ] Help text shows disassembly navigation keys
6. [ ] Help text shows 'g': jump, 'c': copy, arrows, Esc
7. [ ] Verify all mentioned keys work

**Expected Behavior**: Help text accurate for all contract states.

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

**Total Tests**: 61
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
