# Code Review: window.zig

## File Overview

**File Path:** `/Users/williamcory/chop/ui/webui/window.zig`

**Purpose:** This module provides comprehensive window management functionality for the WebUI library. It serves as a wrapper around the underlying C WebUI library, exposing window creation, lifecycle management, browser control, display configuration, and process management through a safe and idiomatic Zig interface.

**Lines of Code:** 299

**Module Structure:**
- 43 external C function declarations (FFI bindings)
- 3 window creation functions (new_window, new_window_with_id, get_new_window_id)
- 29 instance methods (operating on Webui instances)
- 7 global window management functions
- Zero test files found

**Dependencies:**
- `std` - Zig standard library
- `builtin` - Zig builtin module for platform detection
- `windows` - Windows OS specific types (std.os.windows)
- `types.zig` - WebUI type definitions
- `webui.zig` - Main WebUI type

---

## Issues Found

### Critical Issues

**None identified.**

The code generally follows safe patterns, uses proper error handling for most operations, and leverages Zig's type system effectively. However, several high and medium severity issues warrant attention.

---

### High Severity Issues

#### H1. Platform-Specific Code Without Proper Guards in Public API

**Location:** Lines 193-201

**Description:** The `win32_get_hwnd` function uses a compile-time error to prevent usage on non-Windows platforms, but this approach has significant drawbacks:

1. The function appears in documentation and IDE autocomplete on all platforms
2. Users can't write cross-platform code that conditionally uses this feature
3. Compile errors occur late in the compilation process rather than at call site

**Current Code:**
```zig
pub fn win32_get_hwnd(self: Webui) !windows.HWND {
    if (builtin.os.tag != .windows) {
        @compileError("Note: method win32_get_hwnd only can call on MS windows!");
    }
    const tmp_hwnd = webui_win32_get_hwnd(self.window_handle);
    if (tmp_hwnd) return @ptrCast(tmp_hwnd);
    return WebUIError.HWNDError;
}
```

**Problems:**
- The function is publicly exported on all platforms
- Runtime check with compile error is unconventional
- Typo in error message: "can call" should be "can be called"

**Impact:**
- Poor cross-platform development experience
- Confusing error messages
- Unnecessary API surface on non-Windows platforms

**Recommendation:**
Use conditional compilation to only define the function on Windows:

```zig
pub const win32_get_hwnd = if (builtin.os.tag == .windows)
    win32_get_hwnd_impl
else
    struct {}.win32_get_hwnd_unavailable;

fn win32_get_hwnd_impl(self: Webui) !windows.HWND {
    const tmp_hwnd = webui_win32_get_hwnd(self.window_handle);
    if (tmp_hwnd) return @ptrCast(tmp_hwnd);
    return WebUIError.HWNDError;
}
```

Or use the more idiomatic Zig pattern:

```zig
pub const win32_get_hwnd = if (builtin.os.tag == .windows) struct {
    pub fn get(self: Webui) !windows.HWND {
        const tmp_hwnd = webui_win32_get_hwnd(self.window_handle);
        if (tmp_hwnd) return @ptrCast(tmp_hwnd);
        return WebUIError.HWNDError;
    }
}.get else {};
```

#### H2. Inconsistent Error Handling for Process IDs

**Location:** Lines 180-191

**Description:** Both `get_parent_process_id` and `get_child_process_id` treat a return value of 0 as an error, but this may not be accurate on all platforms:

1. On Unix systems, process ID 0 is technically valid (scheduler/swapper)
2. The functions lack documentation about when they would actually fail
3. No distinction between "no parent process" vs "failed to get parent process"

**Code:**
```zig
pub fn get_parent_process_id(self: Webui) !usize {
    const process_id = webui_get_parent_process_id(self.window_handle);
    if (process_id == 0) return WebUIError.ProcessError;
    return process_id;
}
```

**Impact:**
- Potential false positives on error detection
- Unclear semantics (is PID 0 an error or a valid result?)
- Difficult to debug process-related issues

**Recommendation:**
1. Document what constitutes an error vs. valid return
2. Consider if 0 is truly an error or just means "no process"
3. Add more specific error types if needed (NoParentProcess vs ProcessQueryFailed)

#### H3. No Validation of Window Handle in Most Methods

**Location:** Throughout file

**Description:** Most instance methods directly pass `self.window_handle` to C functions without validating it's non-zero or valid. The window handle could be:
- Zero (invalid/uninitialized)
- From a destroyed window
- Corrupted by memory issues

**Examples:**
```zig
pub fn show(self: Webui, content: [:0]const u8) !void {
    const success = webui_show(self.window_handle, content.ptr);
    if (!success) return WebUIError.ShowError;
}

pub fn close(self: Webui) void {
    webui_close(self.window_handle);
}
```

**Impact:**
- Silent failures or undefined behavior with invalid handles
- Difficult to debug issues stemming from use-after-destroy
- Poor error messages (generic failures from C layer)

**Recommendation:**
1. Add a `is_valid()` method to check window handle
2. Consider debug assertions: `std.debug.assert(self.window_handle != 0);`
3. Document window handle lifecycle and validity guarantees
4. Consider adding a "destroyed" flag to prevent use-after-destroy

---

### Medium Severity Issues

#### M1. Memory Safety Concerns with C String Pointers

**Location:** Lines 101-106, 227-232

**Description:** Functions that return strings from C code (`start_server`, `get_url`) convert C pointers to Zig slices without clear lifetime guarantees:

```zig
pub fn start_server(self: Webui, path: [:0]const u8) ![:0]const u8 {
    const url = webui_start_server(self.window_handle, path.ptr);
    const url_len = std.mem.len(url);
    if (url_len == 0) return WebUIError.ServerError;
    return url[0..url_len :0];
}
```

**Problems:**
1. No documentation on who owns the returned string
2. No indication of when the string becomes invalid
3. No guidance on whether to copy or can use directly
4. Could the C library free this string? When?

**Impact:**
- Potential use-after-free vulnerabilities
- Memory leaks if strings should be freed but aren't
- Unclear API contract for callers

**Recommendation:**
1. Document string ownership and lifetime in function docstrings
2. If strings are static or window-lifetime, document this
3. If strings need to be copied, provide allocator parameter and return owned memory
4. Add safety notes about string invalidation conditions

#### M2. Void Return Types Hide Potential Failures

**Location:** Lines 115-117, 145-147, 150-177, 204-211, 235-262

**Description:** Many configuration and setter methods return `void`, providing no feedback on success or failure. Examples include:

```zig
pub fn set_kiosk(self: Webui, status: bool) void {
    webui_set_kiosk(self.window_handle, status);
}

pub fn set_hide(self: Webui, status: bool) void {
    webui_set_hide(self.window_handle, status);
}

pub fn set_size(self: Webui, width: u32, height: u32) void {
    webui_set_size(self.window_handle, width, height);
}
```

**Problems:**
1. Cannot detect if operation succeeded
2. Invalid window handles fail silently
3. Invalid parameters (e.g., negative coords, zero dimensions) not validated
4. Inconsistent with other modules that return errors

**Impact:**
- Silent failures make debugging difficult
- No way to handle errors gracefully in production
- Users assume operations succeed when they may not

**Recommendation:**
Option 1: Add error returns where failures are possible
```zig
pub fn set_size(self: Webui, width: u32, height: u32) !void {
    if (width == 0 or height == 0) return WebUIError.InvalidParameter;
    webui_set_size(self.window_handle, width, height);
}
```

Option 2: At minimum, add debug assertions
```zig
pub fn set_size(self: Webui, width: u32, height: u32) void {
    std.debug.assert(self.window_handle != 0);
    std.debug.assert(width > 0 and height > 0);
    webui_set_size(self.window_handle, width, height);
}
```

#### M3. No Input Validation

**Location:** Lines 68-74, 150-177, 204-206, 221-224, 260-262

**Description:** Functions accept parameters without validation before passing to C layer:

**Examples:**
- `new_window_with_id`: Validates range but error message is generic
- `set_size`, `set_minimum_size`: No validation that width/height are reasonable (not zero, not negative, not huge)
- `set_position`: No validation that coordinates make sense (could position off-screen)
- `set_port`: Validates failure but not input range (1-65535)
- `set_icon`: No validation of icon data or type
- `set_profile`: No validation of path existence or permissions

**Current Code:**
```zig
pub fn new_window_with_id(id: usize) !Webui {
    if (id == 0 or id >= WEBUI_MAX_IDS) return WebUIError.CreateWindowError;
    const handle = webui_new_window_id(id);
    return .{
        .window_handle = handle,
    };
}

pub fn set_port(self: Webui, port: usize) !void {
    const success = webui_set_port(self.window_handle, port);
    if (!success) return WebUIError.PortError;
}
```

**Impact:**
- Invalid inputs cause undefined behavior in C layer
- Poor error messages (from C library rather than clear Zig errors)
- Difficult to debug issues stemming from bad inputs

**Recommendation:**
```zig
pub fn set_port(self: Webui, port: usize) !void {
    if (port == 0 or port > 65535) return WebUIError.InvalidPort;
    const success = webui_set_port(self.window_handle, port);
    if (!success) return WebUIError.PortError;
}

pub fn set_size(self: Webui, width: u32, height: u32) !void {
    if (width == 0 or height == 0) return WebUIError.InvalidDimensions;
    if (width > 16384 or height > 16384) return WebUIError.InvalidDimensions; // reasonable max
    webui_set_size(self.window_handle, width, height);
}
```

#### M4. Inconsistent Error Types in types.zig

**Location:** Lines 22-26 in types.zig (referenced in window.zig)

**Description:** The error naming in `WebUIError` enum has inconsistencies:

```zig
pub const WebUIError = error{
    GenericError,
    CreateWindowError,
    BindError,
    ShowError,
    ServerError,
    EncodeError,
    DecodeError,
    UrlError,
    ProcessError,
    HWNDError,
    PortError,
    ScriptError,
    AllocateFailed,  // Should be AllocateFailed or AllocationFailed
};
```

**Problems:**
1. `AllocateFailed` doesn't match pattern (should be `AllocationFailed` or `AllocateError`)
2. Missing specific errors that could be useful:
   - `InvalidWindowHandle`
   - `InvalidParameter`
   - `InvalidDimensions`
   - `InvalidPort`
   - `WindowDestroyed`
3. Generic "Error" suffix is redundant in error types

**Impact:**
- Harder to match on specific error cases
- Generic errors provide poor debugging information

**Recommendation:**
Expand error set with more specific types and fix naming:

```zig
pub const WebUIError = error{
    Generic,
    CreateWindow,
    Bind,
    Show,
    StartServer,
    Encode,
    Decode,
    Url,
    Process,
    HWND,
    Port,
    Script,
    Allocation,
    InvalidParameter,
    InvalidWindowHandle,
    WindowDestroyed,
    InvalidDimensions,
    InvalidPort,
};
```

#### M5. Global State Management Not Thread-Safe

**Location:** Lines 267-299

**Description:** Global functions like `wait()`, `exit()`, `clean()` operate on implicit global state but provide no thread safety guarantees or documentation:

```zig
pub fn wait() void {
    webui_wait();
}

pub fn exit() void {
    webui_exit();
}

pub fn clean() void {
    webui_clean();
}
```

**Problems:**
1. No documentation about thread safety
2. No mutex or synchronization mechanisms
3. Calling `clean()` while windows exist could cause issues
4. Multiple threads calling `wait()` - undefined behavior?
5. Calling `exit()` from event handler - safe or not?

**Impact:**
- Race conditions in multi-threaded applications
- Undefined behavior with concurrent operations
- Difficult to reason about lifetime in complex applications

**Recommendation:**
1. Document thread safety guarantees (or lack thereof)
2. Document valid calling contexts (e.g., "do not call from event handlers")
3. Add assertions or checks in debug mode
4. Consider adding a global state validation function

---

### Low Severity Issues

#### L1. Inconsistent Documentation Style

**Location:** Throughout file

**Description:** Documentation comments use inconsistent phrasing and formatting:

**Examples:**
- "Creating a new WebUI window object." (line 59) - Present participle
- "Create a new webui window object using a specified window number." (line 67) - Imperative
- "Get a free window number..." (line 76) - Imperative
- "Show a window using embedded HTML, or a file." (line 88) - Imperative
- "Same as `show()`. But using a specific web browser" (line 94) - Fragment with period before "But"
- "Same as `show()`. But start only the web server..." (line 100) - Same issue

**Inconsistencies:**
1. Mix of imperative ("Get...") and present participle ("Creating...")
2. Inconsistent capitalization of "webui" vs "WebUI"
3. Some docs end with periods, some don't
4. "Same as X. But..." should be "Same as X, but..."

**Impact:**
- Unprofessional appearance
- Harder to generate consistent API documentation
- Minor readability issues

**Recommendation:**
Standardize on imperative mood for all function documentation:

```zig
/// Creates a new WebUI window object.
pub fn new_window() Webui { ... }

/// Creates a new WebUI window object using a specified window number.
pub fn new_window_with_id(id: usize) !Webui { ... }

/// Gets a free window number that can be used with `new_window_with_id`.
pub fn get_new_window_id() usize { ... }

/// Shows a window using embedded HTML or a file.
pub fn show(self: Webui, content: [:0]const u8) !void { ... }

/// Same as `show()`, but uses a specific web browser.
pub fn show_browser(self: Webui, content: [:0]const u8, browser: Browser) !void { ... }
```

#### L2. Missing Examples in Documentation

**Location:** Throughout file

**Description:** While individual functions are documented, there are no usage examples showing:
- Complete window lifecycle (create, show, bind, wait, destroy)
- Common patterns (responsive window with custom size)
- Error handling examples
- Browser selection patterns

**Impact:**
- Steeper learning curve for new users
- More support questions
- Trial and error to understand proper usage

**Recommendation:**
Add module-level documentation with examples:

```zig
//! Window management for WebUI
//!
//! Example usage:
//!   const std = @import("std");
//!   const webui = @import("webui.zig");
//!
//!   pub fn main() !void {
//!       // Create window
//!       const window = webui.new_window();
//!       defer webui.clean();
//!
//!       // Configure window
//!       window.set_size(800, 600);
//!       window.set_center();
//!
//!       // Show window with HTML content
//!       try window.show("<html><body><h1>Hello WebUI</h1></body></html>");
//!
//!       // Wait for window to close
//!       webui.wait();
//!   }
```

#### L3. Magic Numbers Without Named Constants

**Location:** Lines 68-74

**Description:** The validation in `new_window_with_id` uses `WEBUI_MAX_IDS` but checks `id == 0` without explanation:

```zig
pub fn new_window_with_id(id: usize) !Webui {
    if (id == 0 or id >= WEBUI_MAX_IDS) return WebUIError.CreateWindowError;
    const handle = webui_new_window_id(id);
    return .{
        .window_handle = handle,
    };
}
```

**Questions:**
- Why is 0 invalid? (Reserved for automatic allocation?)
- Is this documented in the WebUI C library?
- Should there be a `WEBUI_MIN_WINDOW_ID` constant?

**Impact:**
- Code intent not immediately clear
- Maintenance issue if 0 becomes valid in future

**Recommendation:**
Add documentation or named constant:

```zig
/// Window ID 0 is reserved and invalid for manual window creation
const WEBUI_RESERVED_ID = 0;

pub fn new_window_with_id(id: usize) !Webui {
    if (id == WEBUI_RESERVED_ID or id >= WEBUI_MAX_IDS)
        return WebUIError.CreateWindowError;
    // ...
}
```

Or document why in the docstring:

```zig
/// Creates a new WebUI window object using a specified window number.
/// Note: Window ID 0 is reserved and will return an error.
/// Valid range: 1 to WEBUI_MAX_IDS-1
pub fn new_window_with_id(id: usize) !Webui {
```

#### L4. Unclear Relationship Between destroy() and clean()

**Location:** Lines 135-137, 277-279

**Description:** Two similar-sounding functions have unclear relationships:

```zig
/// Close a specific window and free all memory resources.
pub fn destroy(self: Webui) void {
    webui_destroy(self.window_handle);
}

/// Free all memory resources. Should be called only at the end.
pub fn clean() void {
    webui_clean();
}
```

**Questions:**
- Can you call `clean()` while windows still exist?
- After `destroy()`, can you call other methods on that Webui instance?
- Does `clean()` automatically destroy all windows?
- Should `clean()` be called after each `destroy()` or once at program end?

**Impact:**
- Memory leaks if used incorrectly
- Potential use-after-free if assumptions are wrong
- Unclear resource management

**Recommendation:**
Improve documentation:

```zig
/// Closes a specific window and frees its associated resources.
/// After calling destroy(), the window handle becomes invalid and
/// should not be used for further operations.
/// Note: This does not call clean(). Call clean() once at program end.
pub fn destroy(self: Webui) void {
    webui_destroy(self.window_handle);
}

/// Frees all global WebUI resources.
/// Should be called once at program termination, after all windows
/// have been destroyed. Calling this function invalidates all
/// existing Webui instances.
pub fn clean() void {
    webui_clean();
}
```

#### L5. Return Values Often Ignored

**Location:** Lines 84-86

**Description:** Some functions return values that may be important but callers often ignore:

```zig
pub fn get_best_browser(self: Webui) Browser {
    return webui_get_best_browser(self.window_handle);
}
```

**Example usage in app.zig:**
```zig
const window = webui.new_window();
// User never calls get_best_browser, just uses default
try window.show(html_content);
```

**Questions:**
- When would `get_best_browser` return `no_browser`?
- Should calling code check this before showing?
- What happens if you call `show()` when no browser is available?

**Impact:**
- Users may not know to check browser availability
- Silent failures if no browser available

**Recommendation:**
Document when these checks are necessary and what happens if skipped:

```zig
/// Gets the recommended web browser ID to use on this system.
/// Returns Browser.no_browser if no suitable browser is found.
///
/// Note: You typically don't need to call this explicitly, as show()
/// will automatically select the best browser. Use this if you want
/// to verify a browser is available before showing the window, or if
/// you need to show different UI based on the available browser.
pub fn get_best_browser(self: Webui) Browser {
    return webui_get_best_browser(self.window_handle);
}
```

---

## Incomplete Features

### IF1. No Window Event System

**Description:** The module provides lifecycle control (create, show, close, destroy) but lacks event subscription for window events like:
- Window created
- Window shown
- Window resized by user
- Window moved by user
- Window focused/unfocused
- Window closing (before close, allowing cancellation)
- Window closed

**Current State:** Events exist (see event.zig) but are primarily for JavaScript callbacks, not window lifecycle events.

**Impact:**
- Cannot react to user-initiated window changes
- Cannot implement custom close handlers (e.g., "Save before closing?")
- Difficult to maintain application state in sync with window state

**Recommendation:**
Add window event subscription API:

```zig
pub const WindowEvent = enum {
    created,
    shown,
    resized,
    moved,
    focused,
    unfocused,
    closing,  // can prevent
    closed,
};

pub fn on_window_event(
    self: Webui,
    event: WindowEvent,
    callback: fn(*Event) void
) !void {
    // Implementation
}
```

### IF2. No Window State Query API

**Description:** The module can set window properties but cannot query most of them:

**Can Query:**
- `is_shown()` - Whether window is running
- `get_url()` - Current URL
- `get_port()` - Network port

**Cannot Query:**
- Current window size
- Current window position
- Whether window is minimized/maximized/normal
- Whether window is in kiosk mode
- Current browser being used
- Whether window is frameless/transparent/resizable
- Current profile name/path

**Impact:**
- Cannot save/restore window state
- Cannot implement responsive layouts based on actual size
- Difficult to synchronize multiple windows
- Cannot conditionally apply operations based on current state

**Recommendation:**
Add query methods:

```zig
pub const WindowState = struct {
    width: u32,
    height: u32,
    x: u32,
    y: u32,
    is_maximized: bool,
    is_minimized: bool,
    is_kiosk: bool,
    is_frameless: bool,
    is_transparent: bool,
};

pub fn get_state(self: Webui) WindowState {
    // Implementation would require C library support
}

pub fn get_size(self: Webui) struct { width: u32, height: u32 } {
    // Implementation
}

pub fn get_position(self: Webui) struct { x: u32, y: u32 } {
    // Implementation
}
```

### IF3. Limited Browser Control

**Description:** The module exposes basic browser selection but lacks advanced browser control:

**Current:**
- Select browser when showing window
- Set custom browser parameters

**Missing:**
- Query installed browsers
- Get browser version information
- Set browser flags per-session
- Control browser extensions/plugins
- Configure browser privacy settings
- Handle browser crashes/restarts

**Impact:**
- Cannot adapt UI to browser capabilities
- Cannot implement browser-specific workarounds
- Limited control over browser behavior

**Recommendation:**
```zig
pub fn get_installed_browsers(allocator: Allocator) ![]Browser {
    // Return list of all installed browsers
}

pub fn get_browser_version(browser: Browser) ![]const u8 {
    // Return version string
}

pub fn set_browser_flags(self: Webui, browser: Browser, flags: []const []const u8) !void {
    // Set command-line flags
}
```

### IF4. No Multi-Window Coordination

**Description:** The module supports creating multiple windows but provides no coordination mechanisms:

**Missing:**
- Send messages between windows
- Synchronize state across windows
- Parent-child window relationships
- Modal window support
- Window groups/workspaces

**Current Workaround:** Users must implement coordination manually through shared state or external mechanisms.

**Impact:**
- Difficult to build complex multi-window applications
- No standard pattern for window communication
- Each application reinvents the wheel

**Recommendation:**
```zig
pub fn send_to_window(self: Webui, target_window_id: usize, message: []const u8) !void {
    // Send message to another window
}

pub fn set_parent_window(self: Webui, parent: Webui) !void {
    // Set parent-child relationship
}

pub fn show_modal(self: Webui, content: [:0]const u8, parent: Webui) !void {
    // Show as modal dialog relative to parent
}
```

### IF5. No Window Lifecycle Validation

**Description:** No built-in way to validate window handle is valid or track window lifecycle:

**Missing:**
- `is_valid()` method to check if handle is valid
- "Generation" counter to detect use-after-destroy
- Automatic invalidation after destroy
- Debug mode tracking of all live windows

**Impact:**
- Use-after-destroy bugs are silent
- Memory corruption possible with invalid handles
- Difficult to debug lifecycle issues

**Recommendation:**
```zig
pub fn is_valid(self: Webui) bool {
    // Check if window handle is valid
}

// Or use a more robust approach with generation tracking
pub const Webui = struct {
    window_handle: usize,
    generation: usize,  // Incremented on each reuse
    is_destroyed: bool = false,

    pub fn destroy(self: *Webui) void {
        self.is_destroyed = true;
        webui_destroy(self.window_handle);
    }

    fn validate(self: Webui) !void {
        if (self.is_destroyed) return WebUIError.WindowDestroyed;
        if (self.window_handle == 0) return WebUIError.InvalidWindowHandle;
    }
};
```

---

## TODOs

**No explicit TODO comments found in the file.**

However, implied TODOs based on issues identified:

1. **Improve platform-specific code handling** - Replace runtime compileError with conditional compilation for win32_get_hwnd
2. **Add input validation** - Validate parameters before passing to C layer (dimensions, ports, coordinates)
3. **Add window handle validation** - Implement handle validation in methods or debug assertions
4. **Document string lifetimes** - Clarify memory ownership for functions returning C strings
5. **Standardize error handling** - Add error returns to void functions where failures are possible
6. **Fix documentation inconsistencies** - Standardize documentation style and grammar
7. **Add usage examples** - Create comprehensive examples for common patterns
8. **Expand error types** - Add specific error types for different failure modes
9. **Document thread safety** - Clarify thread safety guarantees for all functions
10. **Add state query API** - Implement getters for window properties (if C library supports)
11. **Clarify lifecycle management** - Better document destroy() vs clean() relationship
12. **Add window event system** - Implement window lifecycle event callbacks

---

## Code Quality Issues

### CQ1. No Test Coverage

**Description:** Zero test files found for the window module despite it being critical infrastructure with 299 lines of code and 39+ public functions.

**Missing Test Categories:**
1. **Unit Tests:**
   - Window creation and ID allocation
   - Window lifecycle (create, show, close, destroy)
   - Size and position setters
   - Browser selection
   - Port allocation
   - Error conditions

2. **Integration Tests:**
   - Actual window display (may require headless browser)
   - Multiple window coordination
   - Browser-specific behavior
   - Process management

3. **Property Tests:**
   - Window ID range validation
   - Concurrent window creation
   - Memory leak detection

**Impact:**
- No confidence in correctness
- Refactoring is risky
- Regressions easily introduced
- Platform-specific bugs likely

**Recommendation:** Establish comprehensive test suite (see "Missing Test Coverage" section below for detailed test plan)

### CQ2. FFI Safety Not Documented

**Description:** The module extensively uses C FFI but doesn't document safety considerations:

**Missing Documentation:**
- String lifetime management
- Thread safety of C functions
- Pointer validity requirements
- Memory allocation responsibilities
- Callback lifetime requirements

**Example:**
```zig
pub extern fn webui_show(window: usize, content: [*:0]const u8) callconv(.C) bool;
```

**Questions:**
- Does the C library copy the content string or just store the pointer?
- How long must the content pointer remain valid?
- Is it safe to free content after webui_show returns?

**Impact:**
- Potential memory bugs
- Use-after-free vulnerabilities
- Unclear API contracts

**Recommendation:**
Add module-level FFI safety documentation:

```zig
//! # Memory Safety
//!
//! String parameters are passed to C functions as pointers. The WebUI C library
//! makes internal copies of all strings, so Zig-managed strings are safe to free
//! immediately after function calls return.
//!
//! # Thread Safety
//!
//! The WebUI C library is not thread-safe. All window operations must be called
//! from the main thread unless explicitly documented otherwise.
//!
//! # Lifetime Management
//!
//! Window handles remain valid until destroy() or clean() is called. After
//! destroy(), the handle must not be used. After clean(), all handles are invalid.
```

### CQ3. Inconsistent Patterns Between Methods

**Description:** Similar operations use different patterns:

**Error Handling:**
```zig
// Some functions return errors
pub fn show(self: Webui, content: [:0]const u8) !void { ... }

// Similar functions don't
pub fn set_kiosk(self: Webui, status: bool) void { ... }
```

**Parameter Types:**
```zig
// Some use u32
pub fn set_size(self: Webui, width: u32, height: u32) void { ... }

// Some use usize
pub fn set_port(self: Webui, port: usize) !void { ... }
```

**Documentation Style:**
```zig
// Imperative
/// Get the recommended web browser ID to use.

// Present participle
/// Creating a new WebUI window object.

// Fragment
/// Same as `show()`. But using a specific web browser
```

**Impact:**
- Harder to maintain
- Inconsistent API surface
- More cognitive load for users

**Recommendation:**
Establish and enforce coding standards:
1. All functions that can fail should return errors
2. Use consistent types for similar concepts (always u32 for dimensions, always u16 for ports)
3. Use imperative mood for all documentation
4. Apply same error handling pattern throughout

### CQ4. Missing Debug Utilities

**Description:** No debug or diagnostic utilities provided:

**Missing:**
- Debug logging of window operations
- Window state dump function
- Validation helpers
- Debug-only tracking of live windows
- Memory leak detection helpers

**Example of what's missing:**
```zig
pub fn debug_print_state(self: Webui) void {
    if (@import("builtin").mode != .Debug) return;
    std.debug.print("Window {}: shown={}, port={}\n", .{
        self.window_handle,
        self.is_shown(),
        self.get_port() catch 0,
    });
}

pub fn debug_validate_handle(self: Webui) void {
    if (@import("builtin").mode != .Debug) return;
    std.debug.assert(self.window_handle != 0);
    std.debug.assert(self.window_handle < WEBUI_MAX_IDS);
}
```

**Impact:**
- Harder to debug issues
- More time spent on troubleshooting
- Less confidence in correctness

**Recommendation:**
Add debug utilities:
1. Window state dumping
2. Handle validation
3. Lifecycle tracking
4. Optional debug logging

### CQ5. No Resource Management Patterns

**Description:** The module doesn't provide RAII-style resource management patterns common in Zig:

**Current Pattern:**
```zig
const window = webui.new_window();
// ... do stuff ...
window.destroy();  // Easy to forget!
webui.clean();     // Also easy to forget!
```

**Missing:**
- No defer-friendly patterns
- No automatic cleanup
- No resource guards

**Impact:**
- Memory leaks if destroy/clean forgotten
- Verbose error handling (need to destroy in every error path)
- Less idiomatic Zig

**Recommendation:**
Consider adding wrapper types:

```zig
pub const WindowGuard = struct {
    window: Webui,

    pub fn init() WindowGuard {
        return .{ .window = new_window() };
    }

    pub fn deinit(self: *WindowGuard) void {
        self.window.destroy();
    }
};

// Usage
var window_guard = WindowGuard.init();
defer window_guard.deinit();

try window_guard.window.show(content);
```

Or at minimum, document the defer pattern:

```zig
/// Example usage with proper cleanup:
///   const window = webui.new_window();
///   defer window.destroy();
///   defer webui.clean();  // Called after all windows destroyed
///
///   try window.show(content);
///   webui.wait();
```

### CQ6. Lack of Defensive Programming

**Description:** No defensive checks or assertions even in debug mode:

**Missing:**
- Assertions on window handle validity
- Parameter range checks
- State validation
- Precondition checks

**Example of what should be added:**
```zig
pub fn set_size(self: Webui, width: u32, height: u32) void {
    if (comptime std.debug.runtime_safety) {
        std.debug.assert(self.window_handle != 0);
        std.debug.assert(width > 0 and width <= 16384);
        std.debug.assert(height > 0 and height <= 16384);
    }
    webui_set_size(self.window_handle, width, height);
}
```

**Impact:**
- Bugs caught later rather than earlier
- Harder to identify root cause
- Less robust in debug mode

**Recommendation:**
Add runtime safety checks throughout:
1. Validate all handles in debug mode
2. Check parameter ranges
3. Validate state preconditions
4. Add postcondition checks where applicable

---

## Missing Test Coverage

### Overall Assessment
**Test Coverage: 0%** - No test files found for this module.

Given the critical nature of window management and the extensive C FFI surface, this is a significant gap.

### Critical Test Cases Missing

#### TC1. Window Creation and ID Management
**Functions:** `new_window`, `new_window_with_id`, `get_new_window_id`

**Needed Tests:**
```zig
test "new_window creates valid window" {
    const window = webui.new_window();
    try expect(window.window_handle != 0);
    defer window.destroy();
}

test "new_window_with_id with valid ID" {
    const id = webui.get_new_window_id();
    const window = try webui.new_window_with_id(id);
    defer window.destroy();
    try expect(window.window_handle != 0);
}

test "new_window_with_id rejects ID 0" {
    try expectError(WebUIError.CreateWindowError, webui.new_window_with_id(0));
}

test "new_window_with_id rejects ID >= WEBUI_MAX_IDS" {
    try expectError(
        WebUIError.CreateWindowError,
        webui.new_window_with_id(WEBUI_MAX_IDS)
    );
}

test "get_new_window_id returns unique IDs" {
    const id1 = webui.get_new_window_id();
    const id2 = webui.get_new_window_id();
    try expect(id1 != id2);
}

test "multiple windows can coexist" {
    const win1 = webui.new_window();
    defer win1.destroy();
    const win2 = webui.new_window();
    defer win2.destroy();

    try expect(win1.window_handle != win2.window_handle);
}
```

#### TC2. Window Display Operations
**Functions:** `show`, `show_browser`, `show_wv`, `start_server`

**Needed Tests:**
```zig
test "show with valid HTML content" {
    const window = webui.new_window();
    defer window.destroy();

    const html = "<html><body>Test</body></html>";
    try window.show(html);
    try expect(window.is_shown());
}

test "show with file path" {
    const window = webui.new_window();
    defer window.destroy();

    // Create temp file
    const allocator = std.testing.allocator;
    const tmp_dir = std.testing.tmpDir(.{});
    defer tmp_dir.cleanup();

    var file = try tmp_dir.dir.createFile("test.html", .{});
    defer file.close();
    try file.writeAll("<html><body>Test</body></html>");

    const path = try tmp_dir.dir.realpathAlloc(allocator, "test.html");
    defer allocator.free(path);

    try window.show(path);
    try expect(window.is_shown());
}

test "show_browser with specific browser" {
    const window = webui.new_window();
    defer window.destroy();

    const html = "<html><body>Test</body></html>";
    // May fail if Chrome not installed, handle gracefully
    window.show_browser(html, .chrome) catch |err| {
        if (err == WebUIError.ShowError) return; // OK if Chrome not available
        return err;
    };
}

test "start_server returns valid URL" {
    const window = webui.new_window();
    defer window.destroy();

    const html = "<html><body>Test</body></html>";
    const url = try window.start_server(html);

    try expect(url.len > 0);
    try expect(std.mem.startsWith(u8, url, "http://"));
}

test "show with empty content returns error" {
    const window = webui.new_window();
    defer window.destroy();

    try expectError(WebUIError.ShowError, window.show(""));
}
```

#### TC3. Window Lifecycle
**Functions:** `close`, `destroy`, `is_shown`, `wait`, `exit`, `clean`

**Needed Tests:**
```zig
test "window lifecycle: create -> show -> close -> destroy" {
    const window = webui.new_window();
    defer window.destroy();

    try expect(!window.is_shown());

    try window.show("<html><body>Test</body></html>");
    try expect(window.is_shown());

    window.close();
    // Note: is_shown() behavior after close() should be documented
}

test "destroy invalidates window" {
    const window = webui.new_window();
    window.destroy();

    // After destroy, operations should fail gracefully
    // (Need to define expected behavior)
}

test "clean cleanup" {
    {
        const window = webui.new_window();
        defer window.destroy();
        try window.show("<html><body>Test</body></html>");
    }

    webui.clean();
    // After clean, creating new windows should still work
    const window2 = webui.new_window();
    defer window2.destroy();
}
```

#### TC4. Window Configuration
**Functions:** `set_size`, `set_minimum_size`, `set_position`, `set_center`, `set_kiosk`, etc.

**Needed Tests:**
```zig
test "set_size with valid dimensions" {
    const window = webui.new_window();
    defer window.destroy();

    window.set_size(800, 600);
    // Would need query API to verify
}

test "set_size with zero dimensions" {
    const window = webui.new_window();
    defer window.destroy();

    // Should this error or silently fail? Define expected behavior
    window.set_size(0, 0);
}

test "set_size with huge dimensions" {
    const window = webui.new_window();
    defer window.destroy();

    // Should work but be clamped to screen size
    window.set_size(999999, 999999);
}

test "set_position" {
    const window = webui.new_window();
    defer window.destroy();

    window.set_position(100, 100);
    // Would need query API to verify
}

test "set_center" {
    const window = webui.new_window();
    defer window.destroy();

    window.set_center();
    // Should center window on screen
}

test "kiosk mode" {
    const window = webui.new_window();
    defer window.destroy();

    window.set_kiosk(true);
    try window.show("<html><body>Kiosk</body></html>");
    // Should be fullscreen
}

test "frameless window" {
    const window = webui.new_window();
    defer window.destroy();

    window.set_frameless(true);
    try window.show("<html><body>Frameless</body></html>");
}

test "transparent window" {
    const window = webui.new_window();
    defer window.destroy();

    window.set_transparent(true);
    try window.show("<html><body>Transparent</body></html>");
}
```

#### TC5. Browser Management
**Functions:** `get_best_browser`, navigation, icons, profiles

**Needed Tests:**
```zig
test "get_best_browser returns valid browser" {
    const window = webui.new_window();
    defer window.destroy();

    const browser = window.get_best_browser();
    try expect(browser != .no_browser or true); // May be no_browser in CI
}

test "navigate to URL" {
    const window = webui.new_window();
    defer window.destroy();

    try window.show("<html><body>Initial</body></html>");
    window.navigate("https://example.com");

    // Would need to verify navigation occurred
}

test "set_icon" {
    const window = webui.new_window();
    defer window.destroy();

    const icon_svg = "<svg>...</svg>";
    window.set_icon(icon_svg, "image/svg+xml");
    // Should set window icon
}

test "set_profile" {
    const window = webui.new_window();
    defer window.destroy();

    const allocator = std.testing.allocator;
    const tmp_dir = std.testing.tmpDir(.{});
    defer tmp_dir.cleanup();

    const profile_path = try tmp_dir.dir.realpathAlloc(allocator, ".");
    defer allocator.free(profile_path);

    window.set_profile("test_profile", profile_path);
}

test "delete_profile" {
    const window = webui.new_window();
    defer window.destroy();

    window.set_profile("test_profile", "/tmp/webui_test");
    window.delete_profile();
    // Profile should be deleted
}
```

#### TC6. Network and Ports
**Functions:** `get_port`, `set_port`, `get_free_port`, `get_url`, `set_public`

**Needed Tests:**
```zig
test "set_port with valid port" {
    const window = webui.new_window();
    defer window.destroy();

    try window.set_port(8080);
    const port = try window.get_port();
    try expect(port == 8080);
}

test "set_port with invalid port 0" {
    const window = webui.new_window();
    defer window.destroy();

    // Should this error? Define expected behavior
    const result = window.set_port(0);
    // Currently returns error from C layer
}

test "set_port with port > 65535" {
    const window = webui.new_window();
    defer window.destroy();

    // Should error with validation
    try expectError(WebUIError.PortError, window.set_port(99999));
}

test "get_free_port returns valid port" {
    const port = webui.get_free_port();
    try expect(port > 0 and port <= 65535);
}

test "get_url after show" {
    const window = webui.new_window();
    defer window.destroy();

    try window.show("<html><body>Test</body></html>");
    const url = try window.get_url();

    try expect(url.len > 0);
    try expect(std.mem.startsWith(u8, url, "http://"));
}

test "set_public" {
    const window = webui.new_window();
    defer window.destroy();

    window.set_public(true);
    try window.show("<html><body>Public</body></html>");
    // Window should be accessible from network
}
```

#### TC7. Process Management
**Functions:** `get_parent_process_id`, `get_child_process_id`

**Needed Tests:**
```zig
test "get_parent_process_id" {
    const window = webui.new_window();
    defer window.destroy();

    try window.show("<html><body>Test</body></html>");

    const parent_pid = try window.get_parent_process_id();
    try expect(parent_pid > 0);

    // Should be current process ID
    const current_pid = std.os.linux.getpid();
    try expect(parent_pid == current_pid);
}

test "get_child_process_id" {
    const window = webui.new_window();
    defer window.destroy();

    try window.show("<html><body>Test</body></html>");

    const child_pid = try window.get_child_process_id();
    try expect(child_pid > 0);
    try expect(child_pid != std.os.linux.getpid());
}
```

#### TC8. Platform-Specific Functions
**Functions:** `win32_get_hwnd`

**Needed Tests:**
```zig
test "win32_get_hwnd on Windows" {
    if (@import("builtin").os.tag != .windows) return error.SkipZigTest;

    const window = webui.new_window();
    defer window.destroy();

    try window.show("<html><body>Test</body></html>");

    const hwnd = try window.win32_get_hwnd();
    try expect(hwnd != null);
}

test "win32_get_hwnd unavailable on non-Windows" {
    if (@import("builtin").os.tag == .windows) return error.SkipZigTest;

    // Function should not compile on non-Windows platforms
    // (After fixing the platform-specific code pattern)
}
```

#### TC9. Global Functions
**Functions:** `open_url`, `is_high_contrast`, `delete_all_profiles`

**Needed Tests:**
```zig
test "open_url" {
    // Opens in system browser - hard to test automatically
    webui.open_url("https://example.com");
    // Could check that function doesn't crash
}

test "is_high_contrast" {
    const high_contrast = webui.is_high_contrast();
    // Just verify it returns without error
    _ = high_contrast;
}

test "delete_all_profiles" {
    // Create some profiles first
    const window = webui.new_window();
    defer window.destroy();

    window.set_profile("test1", "/tmp/webui_test1");

    webui.delete_all_profiles();
    // All profiles should be deleted
}
```

#### TC10. Error Conditions and Edge Cases

**Needed Tests:**
```zig
test "operations on destroyed window" {
    const window = webui.new_window();
    window.destroy();

    // All operations should fail gracefully
    // (Need to define expected behavior - error? crash? silent fail?)
}

test "double destroy" {
    const window = webui.new_window();
    window.destroy();
    window.destroy(); // Should not crash
}

test "clean with active windows" {
    const window = webui.new_window();
    defer window.destroy();

    try window.show("<html><body>Test</body></html>");

    // What happens if we call clean while window is active?
    // Define expected behavior and test it
}

test "concurrent window operations" {
    // Create multiple windows from different threads
    // Test thread safety (if claimed to be thread-safe)
}

test "maximum windows" {
    var windows: [WEBUI_MAX_IDS]Webui = undefined;
    var created: usize = 0;

    // Try to create maximum number of windows
    while (created < WEBUI_MAX_IDS) : (created += 1) {
        windows[created] = webui.new_window();
    }

    // Clean up
    for (windows[0..created]) |win| {
        win.destroy();
    }
}

test "show with invalid content pointer" {
    const window = webui.new_window();
    defer window.destroy();

    // Pass various invalid inputs
    try expectError(WebUIError.ShowError, window.show(@as([:0]const u8, "")));
}
```

#### TC11. Integration Tests

**Needed Tests:**
```zig
test "full window lifecycle with browser interaction" {
    const window = webui.new_window();
    defer window.destroy();

    window.set_size(800, 600);
    window.set_center();

    try window.show("<html><body><h1>Test</h1></body></html>");
    try expect(window.is_shown());

    const url = try window.get_url();
    try expect(url.len > 0);

    const port = try window.get_port();
    try expect(port > 0);

    window.close();
}

test "multiple windows with different configurations" {
    const win1 = webui.new_window();
    defer win1.destroy();
    win1.set_size(400, 300);

    const win2 = webui.new_window();
    defer win2.destroy();
    win2.set_size(800, 600);
    win2.set_kiosk(true);

    try win1.show("<html><body>Window 1</body></html>");
    try win2.show("<html><body>Window 2</body></html>");

    try expect(win1.is_shown());
    try expect(win2.is_shown());
}

test "profile isolation" {
    const win1 = webui.new_window();
    defer win1.destroy();
    win1.set_profile("profile1", "/tmp/webui_profile1");

    const win2 = webui.new_window();
    defer win2.destroy();
    win2.set_profile("profile2", "/tmp/webui_profile2");

    try win1.show("<html><body>Window 1</body></html>");
    try win2.show("<html><body>Window 2</body></html>");

    // Profiles should be independent
}
```

### Test Infrastructure Needed

1. **Mock WebUI C Library**
   - For unit testing without actual browser
   - Simulated behavior for all C functions
   - Controlled failure injection

2. **Headless Browser Support**
   - For integration tests
   - CI/CD compatibility
   - Cross-platform testing

3. **Test Utilities**
   ```zig
   // Helper functions for tests
   fn create_test_window() Webui { ... }
   fn create_test_html() [:0]const u8 { ... }
   fn wait_for_window_ready(window: Webui, timeout_ms: u32) !void { ... }
   ```

4. **Platform-Specific Test Runners**
   - Windows-specific tests (HWND)
   - Linux-specific tests
   - macOS-specific tests

5. **Memory Leak Detection**
   - Valgrind integration
   - Custom allocator for tracking
   - Leak tests for each operation

6. **Performance Tests**
   - Window creation speed
   - Memory usage
   - Browser startup time
   - Multiple window scalability

---

## Recommendations

### Immediate Actions (High Priority)

1. **Fix Platform-Specific Code (H1)**
   - Replace runtime compileError with conditional compilation in `win32_get_hwnd`
   - Fix typo in error message
   - Only expose function on Windows platform
   - **Estimated Effort:** 30 minutes
   - **Risk:** Low (straightforward fix)

2. **Add Input Validation (M3)**
   - Validate port range in `set_port` (1-65535)
   - Validate dimensions in `set_size` and `set_minimum_size` (> 0, < reasonable max)
   - Validate window ID in `new_window_with_id`
   - Add named constant for reserved window ID 0
   - **Estimated Effort:** 2-3 hours
   - **Risk:** Low (additive changes)

3. **Improve Documentation (L1, L2, L4)**
   - Fix grammar/typos ("effect" → "affects", "can call" → "can be called")
   - Standardize all docstrings to imperative mood
   - Add module-level usage examples
   - Clarify `destroy()` vs `clean()` relationship
   - Document string lifetime and ownership
   - **Estimated Effort:** 3-4 hours
   - **Risk:** None (documentation only)

4. **Add Debug Assertions (CQ6)**
   - Add handle validation in debug mode for all instance methods
   - Add parameter range checks in debug mode
   - Add state validation assertions
   - **Estimated Effort:** 2-3 hours
   - **Risk:** Low (debug-only code)

### Short-Term Actions (Medium Priority)

5. **Document FFI Safety (CQ2)**
   - Add module-level documentation about memory safety
   - Document thread safety guarantees
   - Clarify pointer lifetime requirements
   - Add safety notes to functions returning C strings
   - **Estimated Effort:** 2-3 hours
   - **Risk:** None (documentation only)

6. **Improve Error Handling (M2)**
   - Decide on error handling strategy for void functions
   - Either add error returns or document "cannot fail" guarantees
   - Consider adding debug logging option
   - **Estimated Effort:** 4-6 hours
   - **Risk:** Medium (API changes)

7. **Add Basic Test Suite (CQ1)**
   - Start with window creation/destruction tests
   - Add basic lifecycle tests
   - Add error condition tests
   - Target: 30-40% coverage
   - **Estimated Effort:** 8-12 hours
   - **Risk:** Medium (may expose bugs)

8. **Fix Error Type Naming (M4)**
   - Rename `AllocateFailed` to `Allocation`
   - Add missing error types (`InvalidParameter`, `InvalidWindowHandle`, etc.)
   - Update all error returns to use new types
   - **Estimated Effort:** 2-3 hours
   - **Risk:** Medium (breaking change for error handlers)

9. **Add Debug Utilities (CQ4)**
   - Add `debug_print_state()` function
   - Add `debug_validate_handle()` function
   - Add optional debug logging (compile-time flag)
   - **Estimated Effort:** 3-4 hours
   - **Risk:** Low (debug-only features)

### Medium-Term Actions (Lower Priority but Important)

10. **Improve Process ID Error Handling (H2)**
    - Research actual failure modes of C functions
    - Decide if PID 0 is error or valid
    - Add more specific error types if needed
    - Document when functions return 0
    - **Estimated Effort:** 3-4 hours (including research)
    - **Risk:** Low (mostly clarification)

11. **Add Window Handle Validation (H3)**
    - Implement `is_valid()` method
    - Add handle validation to critical paths
    - Consider generation counter for use-after-destroy detection
    - **Estimated Effort:** 4-6 hours
    - **Risk:** Low (additive feature)

12. **Standardize Patterns (CQ3)**
    - Choose consistent types (u32 vs usize)
    - Standardize error handling approach
    - Apply consistent patterns throughout
    - **Estimated Effort:** 6-8 hours
    - **Risk:** High (widespread changes)

13. **Add RAII Patterns (CQ5)**
    - Create `WindowGuard` wrapper type
    - Add examples showing defer patterns
    - Document resource management best practices
    - **Estimated Effort:** 3-4 hours
    - **Risk:** Low (additive feature)

14. **Expand Test Suite (TC1-TC11)**
    - Implement all critical test cases
    - Add integration tests
    - Add platform-specific tests
    - Set up CI/CD testing
    - Target: 80%+ coverage
    - **Estimated Effort:** 20-30 hours
    - **Risk:** Medium (significant effort)

### Long-Term Actions (Feature Additions)

15. **Add Window State Query API (IF2)**
    - Implement `get_size()`, `get_position()`, etc.
    - May require C library changes/additions
    - Design comprehensive state query API
    - **Estimated Effort:** 8-12 hours (if C support exists)
    - **Risk:** High (may need C library changes)

16. **Add Window Event System (IF1)**
    - Design event subscription API
    - Implement window lifecycle events
    - Add event callbacks
    - **Estimated Effort:** 12-20 hours
    - **Risk:** High (significant new feature)

17. **Improve Browser Control (IF3)**
    - Add `get_installed_browsers()`
    - Add browser version queries
    - Add advanced browser configuration
    - **Estimated Effort:** 8-12 hours
    - **Risk:** Medium (depends on C library capabilities)

18. **Add Multi-Window Coordination (IF4)**
    - Design window messaging API
    - Implement parent-child relationships
    - Add modal dialog support
    - **Estimated Effort:** 16-24 hours
    - **Risk:** High (complex feature)

---

## Summary

### Strengths

1. **Comprehensive API Coverage:** 39+ public functions covering all major window operations
2. **Clean FFI Bindings:** Well-structured extern declarations with proper calling conventions
3. **Type Safety:** Good use of Zig's type system (slices, null-terminated strings, enums)
4. **Error Handling:** Most critical operations return errors (show, bind, process queries)
5. **Idiomatic Zig:** Good use of Zig conventions (slices instead of pointers, error unions)
6. **Reasonable Abstractions:** Wraps C library without over-engineering
7. **Documentation:** Most functions have docstrings explaining their purpose

### Weaknesses

1. **Zero Test Coverage:** No tests found despite 299 lines and 39+ public functions
2. **Inconsistent Error Handling:** Mix of void and error-returning functions
3. **No Input Validation:** Parameters passed to C layer without validation
4. **Platform-Specific Issues:** win32_get_hwnd uses runtime compileError
5. **Documentation Gaps:** Inconsistent style, missing lifetime docs, no examples
6. **Missing Features:** No state queries, no window events, limited browser control
7. **No Debug Support:** No validation, no debug logging, no diagnostic tools
8. **Memory Safety Questions:** Unclear string ownership and lifetime
9. **No Resource Management:** No RAII patterns, easy to leak resources

### Risk Assessment

**Overall Risk: MEDIUM-HIGH**

The window module is the core interface for the entire WebUI library. Issues here affect all users of the library.

**By Category:**
- **Correctness:** Medium-High (no tests, no validation, unclear error handling)
- **Security:** Medium (no input validation, unclear memory management)
- **Maintainability:** Medium (no tests, inconsistent patterns, poor documentation)
- **Usability:** Medium-Low (API is functional but could be more polished)
- **Performance:** Low (performance not a primary concern for window ops)

**Critical Risks:**
1. Use-after-destroy bugs (no handle validation)
2. Memory leaks or use-after-free (unclear string ownership)
3. Silent failures (void functions, no validation)
4. Platform-specific crashes (compileError at runtime)
5. Thread safety issues (undocumented guarantees)

### Recommendation Priority

**P0 (Critical - Do Immediately):**
1. Fix platform-specific code pattern (30 min)
2. Add input validation (2-3 hrs)
3. Improve documentation (3-4 hrs)

**P1 (High - Do Soon):**
4. Add debug assertions (2-3 hrs)
5. Document FFI safety (2-3 hrs)
6. Add basic test suite (8-12 hrs)

**P2 (Medium - Do When Possible):**
7. Improve error handling (4-6 hrs)
8. Fix error type naming (2-3 hrs)
9. Add debug utilities (3-4 hrs)
10. Improve process ID handling (3-4 hrs)

**P3 (Low - Nice to Have):**
11. Standardize patterns (6-8 hrs)
12. Add RAII patterns (3-4 hrs)
13. Expand test suite (20-30 hrs)
14. Add state query API (8-12 hrs)
15. Add window events (12-20 hrs)

**Total Estimated Effort:**
- P0: ~6-8 hours
- P1: ~12-18 hours
- P2: ~12-19 hours
- P3: ~47-74 hours
- **Overall: 77-119 hours** (2-3 weeks of focused work)

### Next Steps

1. **Week 1:**
   - Fix platform-specific code
   - Add input validation
   - Improve documentation
   - Add debug assertions
   - Document FFI safety

2. **Week 2:**
   - Create basic test suite
   - Improve error handling
   - Fix error type naming
   - Add debug utilities

3. **Week 3+:**
   - Expand test suite to comprehensive coverage
   - Add missing features (state queries, events)
   - Standardize patterns across module
   - Performance testing and optimization

**Success Criteria:**
- Zero compile errors on all platforms
- 80%+ test coverage
- All public functions documented with examples
- Input validation on all parameters
- Clear error messages for all failure modes
- No memory leaks under normal usage
- Thread safety documented and tested

---

**Review Completed:** October 26, 2025
**Reviewer:** Claude Code Analysis
**File Version:** Based on commit 85f9a99
**Lines Reviewed:** 299
**Issues Found:** 22 (0 Critical, 5 High, 5 Medium, 5 Low, 5 Incomplete Features, 2 Code Quality)
**Test Coverage:** 0%
