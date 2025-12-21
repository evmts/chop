# Chop TUI Migration: Go/Bubble Tea → Zig/libvaxis

## Mission

Rewrite the Chop TUI application from Go (using Charmbracelet's Bubble Tea framework) to Zig (using rockorager/libvaxis). This is a complete rewrite, not a port - take advantage of Zig's strengths and libvaxis's design patterns.

---

## Current Implementation Summary

### What Chop Does

Chop is an **Interactive EVM Development Environment** - a terminal UI for local Ethereum development that provides:

1. **EVM Call Execution** - Execute bytecode with custom parameters (CALL, STATICCALL, CREATE, CREATE2, DELEGATECALL)
2. **Blockchain Simulation** - In-memory blockchain with blocks, transactions, accounts
3. **State Inspection** - Query balances, nonces, storage slots, contract code
4. **Bytecode Disassembly** - View EVM opcodes with basic block navigation and PC jumping
5. **Call History & Fixtures** - Track execution history, save/load test fixtures
6. **Dashboard** - Real-time blockchain stats, recent activity

### Current Tech Stack (Go)

- **Framework**: Bubble Tea (Elm-inspired MVU architecture)
- **Styling**: Lipgloss (declarative terminal styling)
- **Components**: Bubbles (table, textinput widgets)
- **CLI**: urfave/cli v2

### Architecture Pattern: Elm MVU

```
Model (state) → View (render) → Update (event handling) → Model...
```

- `Model` struct holds all application state
- `View()` returns string representation
- `Update(Msg)` handles events, returns new Model + Commands
- Commands for async operations (EVM execution, file I/O)

---

## Source Code Locations

### Current Go Implementation

| File | Lines | Purpose |
|------|-------|---------|
| `/app/model.go` | 106 | Central Model struct - all application state |
| `/app/view.go` | 388 | State-based rendering switch |
| `/app/handlers.go` | 1340 | Keyboard input handlers (18 handler functions) |
| `/app/update.go` | 157 | Event routing and message processing |
| `/app/init.go` | 101 | Initialization and async commands |
| `/tui/ui.go` | 984 | UI components and layout helpers |
| `/config/config.go` | 187 | Colors, keybindings, defaults |
| `/types/types.go` | 359 | Shared types (AppState enum, Tab, CallEntry, etc.) |
| `/core/blockchain/` | - | Blockchain simulation |
| `/core/accounts/` | - | Account management |
| `/core/evm/` | - | EVM execution |
| `/core/state/` | - | State persistence |

### libvaxis Reference

| Location | Purpose |
|----------|---------|
| `/libvaxis/src/vxfw/` | High-level framework (use this!) |
| `/libvaxis/src/vxfw/widgets/` | Built-in widgets (Button, TextField, Text, Table, etc.) |
| `/libvaxis/examples/` | Example applications |
| `/libvaxis/src/Vaxis.zig` | Core terminal handling |
| `/libvaxis/src/Cell.zig` | Cell (character + style) |
| `/libvaxis/src/Window.zig` | Window abstraction |

---

## State Management

### Current States (37 total in Go)

```
Main Flow:
  StateMainMenu → StateCallParameterList → StateCallParameterEdit → StateCallExecuting → StateCallResult

Dashboard Tabs (1-7 keys):
  Tab 1: StateDashboard
  Tab 2: StateCallHistory → StateCallHistoryDetail
  Tab 3: StateContracts → StateContractDetail (bytecode disassembly)
  Tab 4: StateAccountsList → StateAccountDetail
  Tab 5: StateBlocksList → StateBlockDetail
  Tab 6: StateTransactionsList → StateTransactionDetail
  Tab 7: StateSettings

Other:
  StateStateInspector (address query)
  StateGotoPC (jump to instruction)
  StateLogDetail, StateFixturesList, StateConfirmReset
```

### Navigation Model

1. **Tab Navigation**: Keys 1-7 switch major views
2. **Stack Navigation**: Enter pushes detail views, Esc pops
3. **Modal States**: Parameter editing, confirmation dialogs

---

## Component Mapping: Go → Zig

### Framework Concepts

| Bubble Tea (Go) | libvaxis/vxfw (Zig) |
|-----------------|---------------------|
| `Model` struct | Custom struct implementing `Widget` |
| `Init()` | `.init` event in `eventHandler` |
| `Update(Msg)` | `eventHandler` function |
| `View() string` | `drawFn` returning `Surface` |
| `tea.Cmd` | `EventContext.cmds` |
| `tea.Msg` | `vxfw.Event` union |

### UI Components

| Bubbles (Go) | libvaxis/vxfw (Zig) |
|--------------|---------------------|
| `table.Model` | `vxfw.Table` widget |
| `textinput.Model` | `vxfw.TextField` widget |
| Lipgloss styles | `vaxis.Style` struct |
| `lipgloss.JoinVertical` | `vxfw.FlexColumn` |
| `lipgloss.JoinHorizontal` | `vxfw.FlexRow` |
| Border rendering | `vxfw.Border` widget |
| Custom components | Structs with `widget()` method |

### Events

| Bubble Tea | libvaxis |
|------------|----------|
| `tea.KeyMsg` | `.key_press` / `.key_release` |
| `tea.MouseMsg` | `.mouse` |
| `tea.WindowSizeMsg` | `.winsize` |
| Custom messages | Custom event types or state changes |

---

## Keyboard Shortcuts to Implement

### Global
- `q` / `Ctrl+C` - Quit
- `c` - Copy (context-aware)
- `1-7` - Tab switching

### Navigation
- `↑/k`, `↓/j` - Cursor up/down
- `←/h`, `→/l` - Navigate (blocks in disassembly)
- `Enter` - Select/confirm
- `Esc` - Back/cancel

### Actions
- `e` - Execute EVM call
- `r` - Reset parameter
- `R` - Reset all parameters
- `Ctrl+V` - Paste
- `f` - Save fixture
- `g` - Jump to destination
- `G` - Open goto PC
- `p` - Reveal private key (account detail)

---

## Color Palette

```zig
const colors = struct {
    const primary = vaxis.Color{ .rgb = .{ 0x00, 0xD9, 0xFF } };     // Cyan - headings
    const secondary = vaxis.Color{ .rgb = .{ 0x7D, 0x56, 0xF4 } };   // Purple
    const amber = vaxis.Color{ .rgb = .{ 0xFF, 0xB8, 0x6C } };       // Orange - values
    const success = vaxis.Color{ .rgb = .{ 0x50, 0xFA, 0x7B } };     // Green
    const err = vaxis.Color{ .rgb = .{ 0xFF, 0x55, 0x55 } };         // Red
    const muted = vaxis.Color{ .rgb = .{ 0x62, 0x72, 0xA4 } };       // Gray - help text
    const text = vaxis.Color{ .rgb = .{ 0xF8, 0xF8, 0xF2 } };        // Light - default
};
```

---

## Recommended Architecture for Zig Implementation

### Directory Structure

```
src/
├── main.zig              # Entry point, app initialization
├── app/
│   ├── model.zig         # Central application state
│   ├── root.zig          # Root widget (routing, tab bar)
│   └── events.zig        # Custom event types
├── views/
│   ├── dashboard.zig     # Dashboard view
│   ├── history.zig       # Call history view
│   ├── contracts.zig     # Contracts/disassembly view
│   ├── accounts.zig      # Accounts view
│   ├── blocks.zig        # Blocks view
│   ├── transactions.zig  # Transactions view
│   ├── settings.zig      # Settings view
│   └── inspector.zig     # State inspector view
├── widgets/
│   ├── tab_bar.zig       # Tab navigation bar
│   ├── data_table.zig    # Reusable data table
│   ├── disassembly.zig   # Bytecode disassembly view
│   ├── param_editor.zig  # Call parameter editor
│   └── help_bar.zig      # Context-sensitive help
├── core/
│   ├── blockchain.zig    # Blockchain simulation
│   ├── accounts.zig      # Account management
│   ├── evm.zig           # EVM execution
│   └── state.zig         # State persistence
├── config.zig            # Colors, keys, defaults
└── types.zig             # Shared type definitions
```

### Widget Pattern

```zig
const MyView = struct {
    // State
    table: vxfw.Table,
    selected_index: usize = 0,

    // Parent reference for callbacks
    app: *AppModel,

    pub fn widget(self: *MyView) vxfw.Widget {
        return .{
            .userdata = self,
            .eventHandler = typeErasedEventHandler,
            .drawFn = typeErasedDrawFn,
        };
    }

    fn typeErasedEventHandler(ptr: *anyopaque, ctx: *vxfw.EventContext, event: vxfw.Event) anyerror!void {
        const self: *MyView = @ptrCast(@alignCast(ptr));
        return self.handleEvent(ctx, event);
    }

    fn handleEvent(self: *MyView, ctx: *vxfw.EventContext, event: vxfw.Event) !void {
        switch (event) {
            .key_press => |key| {
                if (key.matches('q', .{})) {
                    ctx.quit = true;
                } else if (key.matches(vaxis.Key.enter, .{})) {
                    // Handle selection
                    try ctx.consumeAndRedraw();
                }
            },
            else => {},
        }
    }

    fn typeErasedDrawFn(ptr: *anyopaque, ctx: vxfw.DrawContext) !vxfw.Surface {
        const self: *MyView = @ptrCast(@alignCast(ptr));
        return self.draw(ctx);
    }

    fn draw(self: *MyView, ctx: vxfw.DrawContext) !vxfw.Surface {
        // Use FlexColumn for vertical layout
        // Return Surface with children
    }
};
```

---

## Key Implementation Notes

### 1. Use vxfw (High-Level Framework)

Use `vaxis.vxfw` for the application - it handles:
- Event loop management
- Focus tracking
- Automatic redrawing
- Mouse handling

### 2. Arena Allocator Pattern

libvaxis provides a per-frame arena allocator (`ctx.arena`). Use it for temporary strings and layouts - they're automatically freed after rendering.

```zig
const label = try std.fmt.allocPrint(ctx.arena, "Block #{d}", .{block_num});
```

### 3. Surface Composition

Build UIs by composing Surfaces with children:

```zig
return .{
    .size = max_size,
    .widget = self.widget(),
    .buffer = &.{},  // Empty = just composition
    .children = children,  // SubSurface array with offsets
};
```

### 4. Table Widget

libvaxis has a built-in Table widget (`vxfw.Table`) that handles:
- Column layout and resizing
- Row selection and navigation
- Scrolling
- Custom cell rendering

### 5. Focus Management

Request focus explicitly:
```zig
try ctx.requestFocus(self.text_input.widget());
```

### 6. Async Operations

For EVM execution and file I/O, consider:
- Running in separate threads
- Using libvaxis's tick system for polling
- State machine for loading states

---

## Migration Priority

### Phase 1: Core Shell
1. Basic app structure with vxfw
2. Tab bar navigation (7 tabs)
3. Keyboard handling framework
4. Color/style configuration

### Phase 2: Views
1. Dashboard (stats display)
2. Accounts list/detail
3. Blocks list/detail
4. Transactions list/detail

### Phase 3: Core Features
1. Call history list/detail
2. Contract list with disassembly view
3. Settings view

### Phase 4: Advanced
1. Call parameter editor
2. EVM execution integration
3. State inspector
4. Fixture management

### Phase 5: Polish
1. Bytecode disassembly navigation (basic blocks, PC jumping)
2. Copy/paste integration
3. Help system
4. Error handling and feedback messages

---

## Files to Study First

1. **libvaxis examples**: `/libvaxis/examples/counter.zig` (simple vxfw app)
2. **Table example**: `/libvaxis/examples/table.zig`
3. **Current model**: `/app/model.go` (understand state structure)
4. **Current view**: `/app/view.go` (understand rendering logic)
5. **Current handlers**: `/app/handlers.go` (understand keyboard handling)

---

## Testing Strategy

1. Build incrementally - get each view working before moving on
2. Test keyboard navigation thoroughly
3. Verify color rendering in different terminals
4. Test with various terminal sizes
5. Ensure Esc always returns to previous state

---

## Questions to Consider

1. Should we keep the core domain logic (blockchain, accounts, EVM) in Go and call via FFI, or rewrite in Zig?
2. How should we handle file persistence (JSON files for state/fixtures)?
3. Should we support the existing config file format or create a new one?
4. What's the minimum terminal size we should support?

---

## Success Criteria

- [ ] All 7 tabs navigable with keyboard
- [ ] Data tables with selection and scrolling
- [ ] Call parameter editing with validation
- [ ] EVM execution with result display
- [ ] Bytecode disassembly with navigation
- [ ] State persistence (history, fixtures)
- [ ] Responsive layout
- [ ] Consistent color theming
- [ ] Context-sensitive help text
- [ ] Copy to clipboard functionality
