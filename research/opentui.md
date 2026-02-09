# OpenTUI Research Document

**Repository:** https://github.com/sst/opentui
**Website:** https://opentui.com
**npm:** `@opentui/core` (v0.1.77 as of Feb 2026)
**License:** MIT
**Stars:** 8,414
**Runtime:** Bun (>=1.2.0) -- does NOT support Node.js
**Zig version:** 0.15.2
**Created:** 2025-07-21
**Last updated:** 2026-02-09 (actively maintained)
**Weekly npm downloads:** ~31,000

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Installation and Setup](#installation-and-setup)
4. [Package Structure](#package-structure)
5. [Core API Surface](#core-api-surface)
6. [Component Model](#component-model)
7. [Layout System](#layout-system)
8. [Rendering Pipeline](#rendering-pipeline)
9. [Input Handling](#input-handling)
10. [Styling and Theming](#styling-and-theming)
11. [Animation System](#animation-system)
12. [Testing Infrastructure](#testing-infrastructure)
13. [React Integration](#react-integration)
14. [SolidJS Integration](#solidjs-integration)
15. [Tree-Sitter / Syntax Highlighting](#tree-sitter--syntax-highlighting)
16. [Advanced Features](#advanced-features)
17. [Environment Variables](#environment-variables)
18. [Performance Characteristics](#performance-characteristics)
19. [Maturity and Stability](#maturity-and-stability)
20. [Real-World Applications](#real-world-applications)
21. [Comparison with Alternatives](#comparison-with-alternatives)
22. [Dependencies](#dependencies)
23. [Integration with Existing TypeScript Libraries](#integration-with-existing-typescript-libraries)
24. [Key Limitations and Considerations](#key-limitations-and-considerations)

---

## Overview

OpenTUI is a TypeScript library for building terminal user interfaces (TUIs). It uses a dual-language architecture: TypeScript for the developer-facing API, component model, and framework integrations, while Zig handles performance-critical rendering operations through FFI (Foreign Function Interface) via Bun's native FFI.

OpenTUI is the foundational TUI framework for:
- **OpenCode** (https://opencode.ai) -- an AI coding agent built for the terminal
- **terminal.shop** (https://terminal.shop) -- a terminal-based e-commerce experience

The project is currently described as "in development and not ready for production use" but is actively maintained and used in production by the above projects.

---

## Architecture

### Dual-Language Design

```
+------------------------------------------+
|          TypeScript Layer                |
|  - Component model (Renderables/VNodes)  |
|  - Layout engine (Yoga/Flexbox)          |
|  - Input handling & event system         |
|  - Framework reconcilers (React/Solid)   |
+------------------------------------------+
            |  Bun FFI (bun:ffi)  |
+------------------------------------------+
|            Zig Layer                     |
|  - Frame buffer management               |
|  - Cell-level diffing                    |
|  - ANSI escape code generation           |
|  - UTF-8/grapheme processing             |
|  - Terminal capability detection         |
|  - Text buffer (rope data structure)     |
|  - Editor view (cursor, selection)       |
|  - Syntax highlighting engine            |
+------------------------------------------+
            |  stdout  |
+------------------------------------------+
|          Terminal Emulator               |
+------------------------------------------+
```

### Key Architectural Decisions

1. **Zig for rendering**: Frame diffing compares only changed cells. ANSI generation uses run-length encoding to combine adjacent cells with identical styling. This achieves sub-millisecond frame times.

2. **Yoga layout engine**: Uses `yoga-layout` (v3.2.1) for CSS Flexbox-like positioning -- the same engine used by React Native.

3. **Double buffering**: The Zig renderer maintains two `OptimizedBuffer` instances (`currentRenderBuffer` and `nextRenderBuffer`) for tear-free rendering.

4. **Platform binaries**: Precompiled native libraries for darwin-x64, darwin-arm64, linux-x64, linux-arm64, win32-x64, win32-arm64. The correct binary is loaded at runtime via optional dependencies (`@opentui/core-{platform}-{arch}`).

5. **Threading**: Optional threaded rendering (enabled by default on macOS, disabled on Linux) where the Zig renderer runs on a separate thread.

### Zig Source Structure

The Zig layer (`packages/core/src/zig/`) contains:

| File | Purpose |
|------|---------|
| `renderer.zig` | Core CliRenderer struct, double-buffered rendering, frame diffing, ANSI output |
| `buffer.zig` | OptimizedBuffer -- 2D cell grid with RGBA colors, text attributes, borders |
| `ansi.zig` | ANSI escape sequence generation, color encoding |
| `grapheme.zig` | Unicode grapheme cluster processing |
| `utf8.zig` | UTF-8 encoding/decoding, character width calculation |
| `terminal.zig` | Terminal capability detection, OSC queries |
| `text-buffer.zig` | Rope-based text storage for editor functionality |
| `text-buffer-view.zig` | Viewport into text buffer with line wrapping |
| `editor-view.zig` | Cursor management, selection, editing operations |
| `edit-buffer.zig` | Editable text buffer with undo/redo history |
| `syntax-style.zig` | Syntax highlighting style application |
| `rope.zig` | Rope data structure implementation |
| `event-bus.zig` | Cross-language event system |
| `link.zig` | OSC 8 hyperlink support |

### FFI Bridge

The TypeScript-to-Zig bridge (`packages/core/src/zig.ts`) uses `bun:ffi`'s `dlopen` to load the compiled Zig shared library. It exposes functions like:

```typescript
import { dlopen, type Pointer } from "bun:ffi"

const rawSymbols = dlopen(resolvedLibPath, {
  createRenderer: { args: ["u32", "u32", "bool", "bool"], returns: "ptr" },
  destroyRenderer: { args: ["ptr"], returns: "void" },
  // ... many more FFI functions
})
```

Structured data is passed between TS and Zig using `bun-ffi-structs` for zero-copy memory sharing.

---

## Installation and Setup

### Prerequisites

- **Bun** (>=1.2.0) -- https://bun.sh
- **Zig** (0.15.2) -- Only needed for building from source; prebuilt binaries are available via npm

### Quick Start

```bash
# Scaffold a new project
bun create tui

# Or manual setup
mkdir my-tui && cd my-tui
bun init -y
bun add @opentui/core
```

### Minimal Example

```typescript
import { createCliRenderer, TextRenderable, Text } from "@opentui/core"

const renderer = await createCliRenderer()

// Imperative API
const greeting = new TextRenderable(renderer, {
  id: "greeting",
  content: "Hello, OpenTUI!",
  fg: "#00FF00",
  position: "absolute",
  left: 10,
  top: 5,
})
renderer.root.add(greeting)

// Or declarative construct API
const greeting2 = Text({
  content: "Hello, OpenTUI!",
  fg: "#00FF00",
  position: "absolute",
  left: 10,
  top: 5,
})
renderer.root.add(greeting2)
```

### Build Commands

```bash
# Install dependencies
bun install

# Build (only needed when changing Zig code)
bun run build

# Run TypeScript tests
bun test

# Run native (Zig) tests
bun run test:native

# Run benchmarks
bun run bench:native
```

---

## Package Structure

OpenTUI is a monorepo with three packages:

### `@opentui/core` (v0.1.77)

The standalone core library. Provides:
- Imperative API with all rendering primitives
- Declarative VNode/Construct API
- Zig-based native rendering
- Layout engine integration
- Full input handling

**Exports:**
```typescript
// Main entry
import { ... } from "@opentui/core"

// 3D rendering (optional, requires bun-webgpu)
import { ... } from "@opentui/core/3d"

// Testing utilities
import { ... } from "@opentui/core/testing"

// Tree-sitter worker
import { ... } from "@opentui/core/parser.worker"
```

### `@opentui/react` (v0.1.77)

React reconciler for OpenTUI. Uses `react-reconciler` to bridge React's component model to OpenTUI renderables.

**Requires:** React >=19.0.0

### `@opentui/solid` (v0.1.77)

SolidJS reconciler for OpenTUI. Uses Babel + `babel-preset-solid` for compilation.

**Requires:** solid-js 1.9.9

---

## Core API Surface

### Renderer

The `CliRenderer` is the central orchestrator. It manages the terminal, handles input, and runs the rendering loop.

```typescript
import { createCliRenderer, type CliRendererConfig } from "@opentui/core"

const renderer = await createCliRenderer({
  exitOnCtrlC: true,       // Auto-exit on Ctrl+C
  targetFps: 60,           // Rendering FPS cap
  autoFocus: true,         // Auto-focus on left-click
  useAlternateScreen: true, // Use alternate screen buffer
  consoleOptions: {
    position: ConsolePosition.BOTTOM,
    sizePercent: 30,
  },
})

// Properties
renderer.terminalWidth   // Current terminal width
renderer.terminalHeight  // Current terminal height
renderer.root            // Root renderable (add children here)
renderer.keyInput        // KeyHandler EventEmitter
renderer.console         // Built-in console overlay

// Methods
renderer.start()         // Start the rendering loop
renderer.pause()         // Pause rendering
renderer.auto()          // Auto-render on changes only
renderer.requestRender() // Request a single render
renderer.destroy()       // Clean up and exit
renderer.suspend()       // Suspend terminal (resume later)
renderer.resume()        // Resume after suspend

renderer.setCursorPosition(x, y, visible)
renderer.setCursorStyle("block" | "line" | "underline", blinking)
renderer.setBackgroundColor("#000000")

// Events
renderer.on("resize", (width, height) => { ... })
```

### Available Renderables

| Renderable | Description |
|-----------|-------------|
| `TextRenderable` | Styled text with colors, attributes, selection support |
| `BoxRenderable` | Container with borders, backgrounds, layout capabilities |
| `InputRenderable` | Single-line text input with cursor, placeholder, focus states |
| `TextareaRenderable` | Multi-line text editor with undo/redo, syntax highlighting, line wrapping |
| `SelectRenderable` | List selection component (up/down/j/k navigation) |
| `TabSelectRenderable` | Horizontal tab selection (left/right navigation) |
| `ScrollBoxRenderable` | Scrollable container with scrollbars, viewport culling |
| `ASCIIFontRenderable` | ASCII art font text rendering |
| `FrameBufferRenderable` | Low-level 2D cell grid for custom graphics |
| `CodeRenderable` | Code viewer with syntax highlighting via tree-sitter |
| `MarkdownRenderable` | Markdown rendering with tables, code blocks, theme support |
| `DiffRenderable` | Unified and split diff views |
| `SliderRenderable` | Interactive slider components |
| `LineNumberRenderable` | Line number gutter for code/text views |
| `TextNodeRenderable` | Composable styled text nodes (like inline spans) |
| `GroupRenderable` | Invisible container for layout grouping |

### Construct (Declarative) API

Every renderable has a corresponding function-based construct:

```typescript
import { Box, Text, Input, Select, ScrollBox, Code, ASCIIFont, FrameBuffer } from "@opentui/core"

// Constructs return VNodes that are lazily instantiated
const ui = Box(
  { flexDirection: "column", padding: 1 },
  Text({ content: "Title", fg: "#FFFF00" }),
  Input({ placeholder: "Type here..." }),
  Box(
    { flexDirection: "row", gap: 1 },
    Text({ content: "Left" }),
    Text({ content: "Right" }),
  ),
)

// Add to renderer (auto-instantiates)
renderer.root.add(ui)
```

### VNode Method Chaining and Delegation

VNodes support method chaining that replays calls after instantiation:

```typescript
import { delegate, Box, Text, Input } from "@opentui/core"

function LabeledInput(props: { id: string; label: string }) {
  return delegate(
    { focus: `${props.id}-input` },  // Route .focus() to the input child
    Box(
      { flexDirection: "row" },
      Text({ content: props.label }),
      Input({ id: `${props.id}-input`, width: 20 }),
    ),
  )
}

const field = LabeledInput({ id: "name", label: "Name:" })
field.focus()  // Will focus the input, not the box
```

---

## Component Model

OpenTUI offers two primary approaches:

### 1. Imperative (Renderable instances)

- Create concrete `Renderable` instances with a `RenderContext`
- Compose via `.add()` method
- State/behavior mutated directly via setters/methods
- Events bubble upward through the tree

```typescript
const box = new BoxRenderable(renderer, {
  id: "my-box",
  width: 30,
  height: 10,
  backgroundColor: "#333",
  borderStyle: "rounded",
  border: true,
})

const text = new TextRenderable(renderer, {
  id: "my-text",
  content: "Hello",
  fg: "#FFF",
})

box.add(text)
renderer.root.add(box)

// Update directly
text.content = "Updated!"
box.backgroundColor = parseColor("#444")
```

### 2. Declarative (Constructs/VNodes)

- Build lightweight VNode graphs using functional constructs
- No instances exist until added to the tree
- Method calls on VNodes are queued and replayed on instantiation
- `delegate()` routes API calls to specific descendants

```typescript
const ui = Box(
  { width: 30, height: 10, backgroundColor: "#333", borderStyle: "rounded", border: true },
  Text({ content: "Hello", fg: "#FFF" }),
)

renderer.root.add(ui)  // Instantiation happens here
```

### 3. React Components (via `@opentui/react`)

```tsx
import { createCliRenderer, createRoot } from "@opentui/react"

function App() {
  return (
    <box borderStyle="rounded" padding={1} flexDirection="column">
      <text fg="#FFFF00">Welcome to OpenTUI</text>
      <box flexDirection="row" gap={1}>
        <text>Left panel</text>
        <text>Right panel</text>
      </box>
    </box>
  )
}

const renderer = await createCliRenderer()
createRoot(renderer).render(<App />)
```

### 4. SolidJS Components (via `@opentui/solid`)

Uses Solid's reactivity system with the same JSX component names.

### Renderable Lifecycle

```
constructor() -> add() to parent -> render loop -> destroy()
                    |
                 Layout computed (Yoga)
                    |
                 render() called each frame
                    |
                 Buffer cells written
```

Key properties on every Renderable:
- `id` -- unique identifier
- `visible` -- show/hide
- `zIndex` -- stacking order
- `opacity` -- 0.0 to 1.0
- `parent` -- reference to parent
- `isDirty` -- needs re-render
- `focused` / `focusable` -- focus management

---

## Layout System

OpenTUI uses **Yoga** (v3.2.1), the same flexbox engine used by React Native. This provides CSS Flexbox-like layout for terminal UIs.

### Layout Properties

```typescript
interface LayoutOptions {
  // Flex container
  flexDirection?: "row" | "column" | "row-reverse" | "column-reverse"
  flexWrap?: "no-wrap" | "wrap" | "wrap-reverse"
  justifyContent?: "flex-start" | "flex-end" | "center" | "space-between" | "space-around" | "space-evenly"
  alignItems?: "auto" | "flex-start" | "flex-end" | "center" | "baseline" | "stretch"

  // Flex item
  flexGrow?: number
  flexShrink?: number
  flexBasis?: number | "auto"
  alignSelf?: "auto" | "flex-start" | "flex-end" | "center" | "baseline" | "stretch"

  // Positioning
  position?: "relative" | "absolute" | "static"
  top?: number | "auto" | `${number}%`
  right?: number | "auto" | `${number}%`
  bottom?: number | "auto" | `${number}%`
  left?: number | "auto" | `${number}%`

  // Sizing
  width?: number | "auto" | `${number}%`
  height?: number | "auto" | `${number}%`
  minWidth?: number | "auto" | `${number}%`
  minHeight?: number | "auto" | `${number}%`
  maxWidth?: number | "auto" | `${number}%`
  maxHeight?: number | "auto" | `${number}%`

  // Spacing
  margin?: number | "auto" | `${number}%`
  marginX?: number  // horizontal shorthand
  marginY?: number  // vertical shorthand
  marginTop/Right/Bottom/Left?: number | "auto" | `${number}%`
  padding?: number | `${number}%`
  paddingX?: number
  paddingY?: number
  paddingTop/Right/Bottom/Left?: number | `${number}%`

  // Overflow
  overflow?: "visible" | "hidden" | "scroll"
}
```

### Layout Example

```typescript
import { GroupRenderable, BoxRenderable } from "@opentui/core"

const container = new GroupRenderable(renderer, {
  id: "container",
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  width: "100%",
  height: 10,
})

const leftPanel = new BoxRenderable(renderer, {
  id: "left",
  flexGrow: 1,
  height: 10,
  backgroundColor: "#444",
})

const rightPanel = new BoxRenderable(renderer, {
  id: "right",
  width: 20,
  height: 10,
  backgroundColor: "#666",
})

container.add(leftPanel)
container.add(rightPanel)
renderer.root.add(container)
```

### Responsive Layout

```typescript
renderer.on("resize", (width, height) => {
  // Percentage-based layouts auto-adjust
  // Or manually adjust for breakpoints:
  if (width < 80) {
    container.flexDirection = "column"
  } else {
    container.flexDirection = "row"
  }
})
```

---

## Rendering Pipeline

### Frame Loop

1. **Input Processing**: Stdin bytes parsed into key/mouse events
2. **Event Dispatch**: Events routed to focused/targeted renderables
3. **State Updates**: Renderables update their internal state
4. **Layout Calculation**: Yoga computes positions and sizes
5. **Buffer Writing**: Each renderable writes cells to the OptimizedBuffer
6. **Frame Diffing** (Zig): Compare current and next buffers cell-by-cell
7. **ANSI Generation** (Zig): Generate minimal escape sequences for changed cells
8. **Output**: Write ANSI bytes to stdout

### Render Modes

```typescript
// Live mode: Continuous rendering loop at target FPS
renderer.start()

// Auto mode: Only re-renders when tree/layout changes (default)
renderer.auto()

// Manual: Only renders when explicitly requested
renderer.requestRender()
```

### FrameBuffer (Low-Level Rendering)

For custom graphics and effects:

```typescript
import { FrameBufferRenderable, RGBA } from "@opentui/core"

const canvas = new FrameBufferRenderable(renderer, {
  id: "canvas",
  width: 50,
  height: 20,
})

// Direct cell manipulation
canvas.frameBuffer.fillRect(10, 5, 20, 8, RGBA.fromHex("#FF0000"))
canvas.frameBuffer.drawText("Custom Graphics", 12, 7, RGBA.fromHex("#FFFFFF"))
canvas.frameBuffer.setCell(x, y, char, fgColor, bgColor)
canvas.frameBuffer.setCellWithAlphaBlending(x, y, char, fgColor, bgColor)
canvas.frameBuffer.drawFrameBuffer(otherBuffer, offsetX, offsetY)
```

### Render Hooks

```typescript
const box = new BoxRenderable(renderer, {
  id: "custom",
  renderBefore: function(buffer, deltaTime) {
    // Custom rendering before children
  },
  renderAfter: function(buffer, deltaTime) {
    // Custom rendering after children
  },
})
```

---

## Input Handling

### Keyboard

```typescript
import { type KeyEvent } from "@opentui/core"

renderer.keyInput.on("keypress", (key: KeyEvent) => {
  console.log("Key name:", key.name)
  console.log("Sequence:", key.sequence)
  console.log("Ctrl:", key.ctrl)
  console.log("Shift:", key.shift)
  console.log("Alt/Meta:", key.meta)
  console.log("Option:", key.option)
  console.log("Repeated:", key.repeated)

  // Prevent further propagation
  key.preventDefault()

  if (key.name === "escape") { /* ... */ }
  if (key.ctrl && key.name === "c") { /* ... */ }
})

renderer.keyInput.on("keyrelease", (key: KeyEvent) => {
  // Key release events (Kitty keyboard protocol)
})

renderer.keyInput.on("paste", (event: PasteEvent) => {
  // Bracketed paste events
})
```

### Keyboard Protocols Supported

1. **Standard ANSI** -- basic terminal escape sequences
2. **Kitty Keyboard Protocol** -- full key disambiguation with release events
3. **modifyOtherKeys** -- xterm/iTerm2/Ghostty extended key reporting

### Per-Renderable Key Handling

```typescript
const myBox = new BoxRenderable(renderer, {
  id: "my-box",
  onKeyDown: (key: KeyEvent) => {
    // Only fires when this renderable is focused
  },
})
```

### Mouse

```typescript
// Global mouse events are parsed from stdin automatically
// Per-renderable mouse handlers:

const clickable = new BoxRenderable(renderer, {
  id: "button",
  onMouseDown: function(event) {
    console.log("Clicked at", event.x, event.y)
  },
  onMouseUp: function(event) { /* ... */ },
  onMouseMove: function(event) { /* ... */ },
  onMouseDrag: function(event) { /* ... */ },
  onMouseDragEnd: function(event) { /* ... */ },
  onMouseDrop: function(event) { /* ... */ },
  onMouseOver: function(event) { /* ... */ },
  onMouseOut: function(event) { /* ... */ },
  onMouseScroll: function(event) { /* ... */ },
  onMouse: function(event) {
    // Catch-all for any mouse event
  },
})
```

### Hit Grid

OpenTUI uses a "hit grid" for mouse event routing. Each renderable registers its bounds in the hit grid, and mouse events are dispatched to the topmost renderable at the event coordinates. Scissor rects support clipping for scroll containers.

### Focus Management

```typescript
renderable.focus()   // Focus this renderable
renderable.blur()    // Remove focus
renderable.focused   // Check if focused

// Auto-focus: left-click focuses nearest focusable renderable (configurable)
const renderer = await createCliRenderer({ autoFocus: true })

// Access current focus
renderer.currentFocusedRenderable
```

---

## Styling and Theming

### Colors

OpenTUI uses the `RGBA` class internally. Colors can be specified as:

```typescript
import { RGBA, parseColor } from "@opentui/core"

// Hex strings
const red = "#FF0000"
const redAlpha = "#FF000080"  // with alpha

// RGBA class
const blue = RGBA.fromInts(0, 0, 255, 255)      // 0-255 integers
const green = RGBA.fromValues(0.0, 1.0, 0.0, 1.0) // 0.0-1.0 floats
const white = RGBA.fromHex("#FFFFFF")

// CSS color names
const color = parseColor("red")
const transparent = parseColor("transparent")

// Semi-transparent
const overlay = RGBA.fromValues(0.0, 0.0, 0.0, 0.5)
```

### Text Attributes

```typescript
import { TextAttributes } from "@opentui/core"

// Bitwise combination
const attrs = TextAttributes.BOLD | TextAttributes.UNDERLINE | TextAttributes.ITALIC

// Available attributes:
TextAttributes.NONE           // 0
TextAttributes.BOLD           // 1
TextAttributes.DIM            // 2
TextAttributes.ITALIC         // 4
TextAttributes.UNDERLINE      // 8
TextAttributes.BLINK          // 16
TextAttributes.INVERSE        // 32
TextAttributes.HIDDEN         // 64
TextAttributes.STRIKETHROUGH  // 128
```

### Styled Text (Template Literals)

```typescript
import { t, bold, underline, fg, bg, italic, dim } from "@opentui/core"

const styledText = t`${bold("Important")} ${fg("#FF0000")(underline("Warning"))} normal text`

new TextRenderable(renderer, {
  id: "styled",
  content: styledText,
})
```

### VNode Style Helpers

```typescript
import { vstyles } from "@opentui/core"

// Style functions that create TextNodeRenderable instances
vstyles.bold("Bold text")
vstyles.italic("Italic text")
vstyles.underline("Underline text")
vstyles.boldItalic("Bold italic")
vstyles.color("#FF0000", "Red text")
vstyles.fg("#00FF00", "Green text")
vstyles.bg("#0000FF", "Blue background")
vstyles.styled(TextAttributes.BOLD | TextAttributes.DIM, "Custom styled")
```

### Border Styles

```typescript
const box = new BoxRenderable(renderer, {
  id: "box",
  border: true,
  borderStyle: "single" | "double" | "rounded" | "bold" | "none",
  borderColor: "#FFFFFF",
  focusedBorderColor: "#60A5FA",  // Color when focused

  // Partial borders
  border: ["top", "bottom"],  // Only top and bottom
  border: { top: true, right: false, bottom: true, left: false },

  // Custom border characters
  customBorderChars: {
    topLeft: "+", topRight: "+",
    bottomLeft: "+", bottomRight: "+",
    horizontal: "-", vertical: "|",
    topT: "+", bottomT: "+",
    leftT: "+", rightT: "+",
    cross: "+",
  },

  // Box titles
  title: "Settings Panel",
  titleAlignment: "left" | "center" | "right",
})
```

### Syntax Highlighting Themes

OpenTUI includes a `SyntaxStyle` system for code/markdown rendering themes:

```typescript
import { SyntaxStyle, type StyleDefinition } from "@opentui/core"

const syntaxStyle = new SyntaxStyle()
// Built-in themes are available for code rendering
// Custom styles can be defined per highlight capture group
```

---

## Animation System

### Timeline API

```typescript
import { Timeline, type AnimationOptions } from "@opentui/core"

const timeline = new Timeline(renderer, {
  duration: 2000,
  loop: true,
  autoplay: true,
  onComplete: () => console.log("Done"),
})

// Animate properties
timeline.add({
  target: [myBox],
  properties: { x: 50, y: 20 },
  duration: 1000,
  ease: "outElastic",
  onUpdate: (anim) => { /* per-frame callback */ },
})

// Chain animations
timeline
  .add({ target: [text1], properties: { opacity: 1 }, duration: 500, ease: "inOutSine" })
  .add({ target: [text2], properties: { opacity: 1 }, duration: 500, ease: "outBounce" })
```

### Easing Functions

Available easing functions:
- `linear`, `inQuad`, `outQuad`, `inOutQuad`
- `inExpo`, `outExpo`
- `inOutSine`
- `outBounce`, `inBounce`
- `outElastic`
- `inCirc`, `outCirc`, `inOutCirc`

### Frame Callbacks

For per-frame animation logic, use the renderer's frame callback system (demonstrated in the demo examples with `update()` functions that receive `deltaMs`).

---

## Testing Infrastructure

OpenTUI provides a comprehensive headless testing system. Tests run without an actual terminal, using mock stdin/stdout.

### Test Renderer

```typescript
import { createTestRenderer, createMockKeys, createMockMouse, createSpy, KeyCodes } from "@opentui/core/testing"
import { test, expect } from "bun:test"

test("component renders correctly", async () => {
  const { renderer, mockInput, mockMouse, renderOnce, captureCharFrame, resize } =
    await createTestRenderer({
      width: 80,
      height: 24,
      kittyKeyboard: false,
      otherModifiersMode: false,
    })

  const text = new TextRenderable(renderer, {
    id: "test",
    content: "Hello World",
  })
  renderer.root.add(text)

  await renderOnce()
  const frame = captureCharFrame()
  expect(frame).toContain("Hello World")
})
```

### Mock Keyboard Input

```typescript
const mockInput = createMockKeys(renderer)

// Type text
mockInput.typeText("hello world")
await mockInput.typeText("hello", 10)  // 10ms delay between keys

// Press keys
mockInput.pressKey("a")
mockInput.pressKey(KeyCodes.ENTER)
mockInput.pressKey("a", { ctrl: true })
mockInput.pressKey("f", { meta: true })
mockInput.pressKey("z", { ctrl: true, shift: true })

// Convenience methods
mockInput.pressEnter()
mockInput.pressEscape()
mockInput.pressTab()
mockInput.pressBackspace()
mockInput.pressArrow("up" | "down" | "left" | "right")
mockInput.pressCtrlC()
mockInput.pasteBracketedText("pasted content")
```

### Mock Mouse Input

```typescript
const mockMouse = createMockMouse(renderer)

await mockMouse.click(x, y)
await mockMouse.click(x, y, MouseButtons.RIGHT)
await mockMouse.click(x, y, MouseButtons.LEFT, {
  modifiers: { ctrl: true, shift: true, alt: true },
  delayMs: 10,
})
await mockMouse.doubleClick(x, y)
await mockMouse.drag(startX, startY, endX, endY)
await mockMouse.scroll(x, y, "up" | "down")
await mockMouse.moveTo(x, y)
```

### Frame Capture

```typescript
// Character-only frame (no ANSI codes)
const charFrame = captureCharFrame()

// Structured spans with styling info
const spanFrame = captureSpans()
// Returns: { cols, rows, cursor: [x, y], lines: SpanLine[] }
```

### Test Recorder

Record frames during rendering for analysis:

```typescript
import { TestRecorder } from "@opentui/core/testing"

const recorder = new TestRecorder(renderer)
recorder.rec()

// ... do rendering ...

recorder.stop()
const frames = recorder.recordedFrames
frames.forEach(frame => {
  console.log(`Frame ${frame.frameNumber} at ${frame.timestamp}ms:`)
  console.log(frame.frame)
})
```

### Spy Utility

```typescript
import { createSpy } from "@opentui/core/testing"

const spy = createSpy()
element.on("click", spy)

// After interaction
expect(spy.callCount()).toBe(1)
expect(spy.calledWith("expected-arg")).toBe(true)
spy.reset()
```

### Resize Testing

```typescript
resize(120, 40)  // Simulate terminal resize
await renderOnce()
const newFrame = captureCharFrame()
```

### What the Test Renderer Disables

- No real terminal setup (`setupTerminal()` not called)
- SIGWINCH handler removed
- Zig renderer created with `{ testing: true }`
- Console output capture disabled
- Manual render control only (`renderOnce()`)

---

## React Integration

### Setup

```bash
bun add @opentui/core @opentui/react react
```

### Creating a React App

```tsx
import { createCliRenderer } from "@opentui/core"
import { createRoot, useKeyboard, useRenderer, useOnResize } from "@opentui/react"

function App() {
  useKeyboard((key) => {
    if (key.name === "q") process.exit(0)
  })

  return (
    <box borderStyle="rounded" padding={1} flexDirection="column" gap={1}>
      <text fg="#FFFF00">Welcome to OpenTUI + React</text>
      <box flexDirection="row" gap={2}>
        <text>Column 1</text>
        <text>Column 2</text>
      </box>
    </box>
  )
}

const renderer = await createCliRenderer()
createRoot(renderer).render(<App />)
```

### Available JSX Elements

```tsx
<box>        // BoxRenderable
<text>       // TextRenderable
<code>       // CodeRenderable
<diff>       // DiffRenderable
<markdown>   // MarkdownRenderable
<input>      // InputRenderable
<select>     // SelectRenderable
<textarea>   // TextareaRenderable
<scrollbox>  // ScrollBoxRenderable
<ascii-font> // ASCIIFontRenderable
<tab-select> // TabSelectRenderable
<line-number> // LineNumberRenderable

// Text modifiers (inline)
<span>       // SpanRenderable
<br />       // LineBreakRenderable
<b> / <strong> // BoldSpanRenderable
<i> / <em>   // ItalicSpanRenderable
<u>          // UnderlineSpanRenderable
<a>          // LinkRenderable
```

### Extending Components

```tsx
import { extend } from "@opentui/react"

extend({
  consoleButton: ConsoleButtonRenderable,
  customWidget: CustomWidgetRenderable,
})

// Now usable in JSX:
<consoleButton onClick={handler} />
```

### React Hooks

```tsx
// Subscribe to keyboard events
useKeyboard((key: KeyEvent) => { ... })
useKeyboard((key) => { ... }, { release: true })  // Include release events

// Access the renderer instance
const renderer = useRenderer()

// React to terminal resize
useOnResize((width, height) => { ... })

// Access terminal dimensions
const { width, height } = useTerminalDimensions()

// Animation timeline
const timeline = useTimeline({ duration: 2000, loop: true })
```

### React DevTools Support

The React reconciler optionally supports React DevTools for debugging:

```bash
bun add react-devtools-core ws  # Optional peer deps
```

---

## SolidJS Integration

### Setup

```bash
bun add @opentui/core @opentui/solid solid-js
```

### Configuration

SolidJS requires a Bun plugin for JSX transformation:

```typescript
// bunfig.toml or runtime config
import { solidPlugin } from "@opentui/solid/bun-plugin"
```

The `@opentui/solid` package uses Babel with `babel-preset-solid` for compilation.

---

## Tree-Sitter / Syntax Highlighting

OpenTUI has built-in tree-sitter support for syntax highlighting using `web-tree-sitter` (WASM-based).

### Built-in Languages

JavaScript, TypeScript, Markdown, Zig (with highlight queries included).

### Adding Custom Languages

```typescript
import { addDefaultParsers, getTreeSitterClient } from "@opentui/core"

addDefaultParsers([
  {
    filetype: "python",
    wasm: "https://github.com/tree-sitter/tree-sitter-python/releases/download/v0.23.6/tree-sitter-python.wasm",
    queries: {
      highlights: [
        "https://raw.githubusercontent.com/tree-sitter/tree-sitter-python/master/queries/highlights.scm"
      ],
    },
  },
])

const client = getTreeSitterClient()
await client.initialize()

const result = await client.highlightOnce('def hello():\n    print("world")', "python")
```

### With CodeRenderable

```typescript
const codeBlock = new CodeRenderable(renderer, {
  id: "code",
  content: 'fn main() {\n    println!("Hello");\n}',
  filetype: "rust",
  syntaxStyle: new SyntaxStyle(),
  treeSitterClient: getTreeSitterClient(),
  width: 60,
  height: 20,
})
```

### Automated Parser Management

```json
// parsers-config.json
{
  "parsers": [
    {
      "filetype": "python",
      "wasm": "...",
      "queries": { "highlights": ["..."] }
    }
  ]
}
```

```bash
# In package.json scripts:
"prebuild": "bun node_modules/@opentui/core/lib/tree-sitter/assets/update.ts --config ./parsers-config.json --assets ./src/parsers --output ./src/parsers.ts"
```

---

## Advanced Features

### Console Overlay

Built-in debug console that captures `console.log/info/warn/error/debug`:

```typescript
const renderer = await createCliRenderer({
  consoleOptions: {
    position: ConsolePosition.BOTTOM,
    sizePercent: 30,
    colorInfo: "#00FFFF",
    colorWarn: "#FFFF00",
    colorError: "#FF0000",
  },
})

renderer.console.toggle()  // Toggle console visibility
// Press backtick (`) to toggle in-app
// Press +/- to resize
```

### ScrollBox

```typescript
const scrollBox = new ScrollBoxRenderable(renderer, {
  id: "scroll",
  width: 40,
  height: 20,
  scrollX: true,
  scrollY: true,
  stickyScroll: true,
  stickyStart: "bottom",
  viewportCulling: true,  // Only render visible children
  scrollAcceleration: new MacOSScrollAccel(),  // or LinearScrollAccel
})
```

### Text Selection

OpenTUI supports text selection across multiple renderables with mouse drag:

```typescript
renderer.on("selection", (selection) => {
  console.log("Selected text:", selection.getText())
})
```

### Clipboard

```typescript
import { Clipboard } from "@opentui/core"

// OSC 52 clipboard integration
```

### Hyperlinks (OSC 8)

```typescript
// Links are supported via OSC 8 escape sequences
// The LinkRenderable in the React integration handles this
```

### 3D Rendering

OpenTUI has experimental 3D rendering support using WebGPU (via `bun-webgpu`):

```typescript
import { ThreeRenderable, WGPURenderer } from "@opentui/core/3d"

// Requires: bun-webgpu, three.js
// Renders 3D scenes into terminal framebuffers
```

### Split Mode (Experimental)

Confine the TUI to a portion of the terminal while keeping normal stdout above:

```typescript
const renderer = await createCliRenderer({
  experimental_splitHeight: 20,  // TUI uses bottom 20 rows
})
```

### Suspend/Resume

```typescript
renderer.suspend()  // Restore terminal, pause rendering
// ... run external process ...
renderer.resume()   // Re-enter TUI mode
```

### Opacity and Alpha Blending

```typescript
const overlay = new BoxRenderable(renderer, {
  id: "overlay",
  opacity: 0.5,  // Semi-transparent
  backgroundColor: "#000000",
})
```

---

## Environment Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `OTUI_DEBUG_FFI` | boolean | false | Enable FFI debug logging |
| `OTUI_TRACE_FFI` | boolean | false | Enable FFI tracing |
| `OTUI_SHOW_STATS` | boolean | false | Show debug overlay at startup |
| `OTUI_NO_NATIVE_RENDER` | boolean | false | Disable native rendering (debug) |
| `OTUI_USE_ALTERNATE_SCREEN` | boolean | true | Use alternate screen buffer |
| `OTUI_OVERRIDE_STDOUT` | boolean | true | Override stdout stream |
| `OTUI_USE_CONSOLE` | boolean | true | Enable console output capture |
| `OTUI_DUMP_CAPTURES` | boolean | false | Dump captured output on exit |
| `OTUI_DEBUG` | boolean | false | Capture all raw input for debugging |
| `SHOW_CONSOLE` | boolean | false | Show console at startup |
| `OTUI_TS_STYLE_WARN` | string | false | Warn on missing syntax styles |
| `OTUI_TREE_SITTER_WORKER_PATH` | string | "" | Tree-sitter worker path |
| `OPENTUI_FORCE_WCWIDTH` | boolean | false | Use wcwidth for char widths |
| `OPENTUI_FORCE_UNICODE` | boolean | false | Force Mode 2026 Unicode |
| `OPENTUI_NO_GRAPHICS` | boolean | false | Disable Kitty graphics |
| `OPENTUI_FORCE_NOZWJ` | boolean | false | Disable ZWJ joining |
| `OPENTUI_FORCE_EXPLICIT_WIDTH` | string | - | Force explicit width on/off |

---

## Performance Characteristics

### Rendering Performance

- **Frame diffing in Zig**: Only changed cells are compared
- **ANSI run-length encoding**: Adjacent cells with identical styling are combined
- **Sub-millisecond frame times** for typical UIs
- **60+ FPS** rendering for complex UIs
- **Double buffering**: Tear-free rendering
- **Viewport culling**: ScrollBox only renders visible children

### Memory

- Zig renderer uses its own allocator with controlled heap usage
- `OptimizedBuffer` uses packed cell representations
- Grapheme pool for efficient Unicode handling
- Rope data structure for text buffers (efficient for large files)

### Benchmarks

Native benchmarks available:
```bash
cd packages/core
bun run bench:native  # Run Zig benchmarks
```

Benchmark areas:
- Buffer draw text
- Edit buffer operations
- Rope operations
- Styled text processing
- Text buffer coordinate calculations
- UTF-8 processing
- Text chunk grapheme iteration

---

## Maturity and Stability

### Current Status (Feb 2026)

- **Version**: 0.1.77 (pre-1.0, API may change)
- **Self-described**: "In development and not ready for production use"
- **In practice**: Used in production by OpenCode and terminal.shop
- **Activity**: Very active development (updated same day as this research)
- **Stars**: 8,414 GitHub stars
- **Downloads**: ~31,000 weekly on npm
- **Testing**: Comprehensive test suite (TS + Zig)
- **CI/CD**: Multiple GitHub Actions workflows
- **Platform support**: macOS, Linux, Windows (x64 and ARM64)

### Risks

1. Pre-1.0 API -- breaking changes possible
2. Bun-only runtime -- no Node.js support
3. Zig dependency for building from source
4. Some features marked "experimental" (split mode, 3D)
5. React/Solid packages marked `"private": true` (not published to npm yet)

---

## Real-World Applications

### Official

- **OpenCode** (https://opencode.ai) -- AI coding agent for the terminal (the primary consumer)
- **terminal.shop** (https://terminal.shop) -- Terminal-based e-commerce

### Community (from awesome-opentui)

| Project | Description |
|---------|-------------|
| [cftop](https://github.com/NWBY/cftop) | Terminal interface for Cloudflare Workers |
| [critique](https://github.com/remorses/critique) | Terminal interface for reviewing Git changes |
| [easiarr](https://github.com/muhammedaksam/easiarr) | Terminal interface for managing Arr applications |
| [opendocker](https://github.com/flat6solutions/opendocker) | Terminal interface for Docker containers |
| [red](https://github.com/evertdespiegeleer/red-cli) | Terminal interface for Redis |
| [tokscale](https://github.com/junhoyeo/tokscale) | Terminal token usage tracking |
| [waha-tui](https://github.com/muhammedaksam/waha-tui) | TUI for WhatsApp HTTP API |
| [restman](https://github.com/cadamsdev/restman) | Terminal REST API testing |
| [opentui-doom](https://github.com/muhammedaksam/opentui-doom) | DOOM in the terminal via framebuffer |
| [present-drop](https://github.com/msmps/present-drop) | Festive terminal game |

### Libraries

- [opentui-spinner](https://github.com/msmps/opentui-spinner) -- Spinner component
- [opentui-ui](https://github.com/msmps/opentui-ui) -- UI component library
- [opentui-skill](https://github.com/msmps/opentui-skill) -- AI assistant reference docs

### Tools

- [create-tui](https://github.com/msmps/create-tui) -- Project scaffolding (`bun create tui`)
- [pilotty](https://github.com/msmps/pilotty) -- AI agent automation for TUI apps

---

## Comparison with Alternatives

### OpenTUI vs Ink

| Feature | OpenTUI | Ink |
|---------|---------|-----|
| Runtime | Bun only | Node.js + Bun |
| Rendering | Zig FFI (native) | Pure JS |
| Layout | Yoga (flexbox) | Yoga (flexbox) |
| Component model | Imperative + VNode + React/Solid | React only |
| Performance | Sub-ms frames, 60+ FPS | Good, but JS-bound |
| Mouse support | Full (click, drag, scroll, hover) | Limited |
| Text editing | Built-in TextareaRenderable | No |
| Syntax highlighting | Tree-sitter (WASM) | No |
| 3D rendering | WebGPU (experimental) | No |
| Maturity | Pre-1.0 (8K stars) | Stable v4+ (27K+ stars) |
| Ecosystem | Growing | Large |
| Testing | Headless test renderer | ink-testing-library |

### OpenTUI vs Blessed/neo-blessed

| Feature | OpenTUI | Blessed |
|---------|---------|---------|
| Language | TypeScript | JavaScript |
| Architecture | Modern, actively maintained | Legacy, mostly unmaintained |
| Layout | Flexbox (Yoga) | Custom box model |
| Component model | Declarative + Imperative | Widget-based |
| Performance | Native Zig rendering | Pure JS |
| Unicode | Full grapheme cluster support | Basic |

### OpenTUI vs Bubbletea (Go) / Ratatui (Rust)

| Feature | OpenTUI | Bubbletea/Ratatui |
|---------|---------|-------------------|
| Language | TypeScript + Zig | Go / Rust |
| Paradigm | Component tree | Elm architecture / Immediate mode |
| Layout | Flexbox | Manual / Constraint-based |
| Ecosystem | npm/TypeScript | Go/Rust ecosystems |
| Performance | Very good (Zig FFI) | Excellent (native) |

---

## Dependencies

### Core Runtime Dependencies

```json
{
  "dependencies": {
    "bun-ffi-structs": "0.1.2",    // Zero-copy struct sharing via FFI
    "diff": "8.0.2",                // Text diffing algorithms
    "jimp": "1.6.0",                // Image processing (for sprites/textures)
    "marked": "17.0.1",             // Markdown parsing
    "yoga-layout": "3.2.1"          // CSS Flexbox layout engine
  },
  "peerDependencies": {
    "web-tree-sitter": "0.25.10"    // Tree-sitter WASM runtime
  }
}
```

### Platform Binaries (optional dependencies, auto-selected)

```
@opentui/core-darwin-x64
@opentui/core-darwin-arm64
@opentui/core-linux-x64
@opentui/core-linux-arm64
@opentui/core-win32-x64
@opentui/core-win32-arm64
```

### Optional Dependencies (for advanced features)

```json
{
  "optionalDependencies": {
    "@dimforge/rapier2d-simd-compat": "^0.17.3",  // 2D physics
    "bun-webgpu": "0.1.4",                         // WebGPU for 3D
    "planck": "^1.4.2",                             // 2D physics (Planck.js)
    "three": "0.177.0"                              // 3D rendering
  }
}
```

### React Integration Dependencies

```json
{
  "dependencies": {
    "@opentui/core": "workspace:*",
    "react-reconciler": "^0.32.0"
  },
  "peerDependencies": {
    "react": ">=19.0.0",
    "react-devtools-core": "^7.0.1",  // optional
    "ws": "^8.18.0"                    // optional (for devtools)
  }
}
```

### SolidJS Integration Dependencies

```json
{
  "dependencies": {
    "@babel/core": "7.28.0",
    "@babel/preset-typescript": "7.27.1",
    "@opentui/core": "workspace:*",
    "babel-plugin-module-resolver": "5.0.2",
    "babel-preset-solid": "1.9.9",
    "s-js": "^0.4.9"
  },
  "peerDependencies": {
    "solid-js": "1.9.9"
  }
}
```

---

## Integration with Existing TypeScript Libraries

### Using npm Libraries

Since OpenTUI runs on Bun, any npm package works. The key constraint is that rendering must go through OpenTUI's renderable system, not direct stdout writes.

```typescript
import { createCliRenderer, TextRenderable } from "@opentui/core"
import { formatDistance } from "date-fns"  // Any npm lib works

const renderer = await createCliRenderer()
const text = new TextRenderable(renderer, {
  id: "time",
  content: formatDistance(new Date(), new Date(2024, 0, 1)),
})
renderer.root.add(text)
```

### Console Output

OpenTUI captures `console.log` by default. To see console output, use the built-in console overlay (toggle with backtick key) or set `OTUI_USE_CONSOLE=false`.

### File Operations

Use Bun's built-in APIs (`Bun.file`, `Bun.write`, `bun:sqlite`, etc.) as per the project's AGENTS.md conventions.

### HTTP/WebSocket

Bun's built-in `Bun.serve()` and `WebSocket` work alongside OpenTUI for building connected TUI apps.

### Linking Local Development

To use a local OpenTUI checkout in your project:

```bash
./scripts/link-opentui-dev.sh /path/to/your/project
# Options:
#   --react   Also link React reconciler
#   --solid   Also link SolidJS reconciler
#   --dist    Link built dist directories
#   --copy    Copy instead of symlink
#   --subdeps Find and link sub-dependencies
```

---

## Key Limitations and Considerations

1. **Bun-only**: OpenTUI requires Bun as the runtime. It uses `bun:ffi` for the Zig bridge and Bun-specific APIs throughout. Node.js is not supported.

2. **Pre-1.0 API**: The API is still evolving. Breaking changes may occur between minor versions.

3. **Zig build requirement**: While prebuilt binaries are available, contributing to or modifying the native layer requires Zig 0.15.2.

4. **React/Solid packages not on npm**: As of v0.1.77, `@opentui/react` and `@opentui/solid` are marked `"private": true` and not published to npm. They work via the monorepo workspace or local linking.

5. **Console capture**: By default, `console.log` is intercepted. This can be confusing during development. Use the built-in console overlay or disable capture.

6. **Terminal compatibility**: Some features (OSC 66, Kitty keyboard protocol, graphics) require modern terminal emulators. Fallbacks exist but may show artifacts on older terminals.

7. **Documentation**: While the source code is well-organized and examples are plentiful, comprehensive API reference docs are still evolving at opentui.com.

---

## Quick Reference: Minimal App Template

```typescript
#!/usr/bin/env bun

import {
  createCliRenderer,
  Box,
  Text,
  type KeyEvent,
} from "@opentui/core"

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
  targetFps: 60,
})

renderer.keyInput.on("keypress", (key: KeyEvent) => {
  if (key.name === "q") {
    renderer.destroy()
  }
})

const app = Box(
  {
    flexDirection: "column",
    width: "100%",
    height: "100%",
    padding: 1,
  },
  Text({ content: "My TUI App", fg: "#FFFF00" }),
  Box(
    {
      flexDirection: "row",
      flexGrow: 1,
      gap: 1,
    },
    Box({
      flexGrow: 1,
      border: true,
      borderStyle: "rounded",
      title: "Panel 1",
    }),
    Box({
      flexGrow: 1,
      border: true,
      borderStyle: "rounded",
      title: "Panel 2",
    }),
  ),
  Text({
    content: "Press 'q' to quit",
    fg: "#888888",
    height: 1,
  }),
)

renderer.root.add(app)
```

---

## Sources

- [GitHub Repository](https://github.com/sst/opentui)
- [npm: @opentui/core](https://www.npmjs.com/package/@opentui/core)
- [Official Website](https://opentui.com)
- [DeepWiki Documentation](https://deepwiki.com/sst/opentui)
- [awesome-opentui](https://github.com/msmps/awesome-opentui)
- [opentui-examples](https://github.com/msmps/opentui-examples)
- [Development Guide](https://github.com/sst/opentui/blob/main/packages/core/docs/development.md)
- [Getting Started Guide](https://github.com/sst/opentui/blob/main/packages/core/docs/getting-started.md)
- [Environment Variables](https://github.com/sst/opentui/blob/main/packages/core/docs/env-vars.md)
- [Renderables vs Constructs](https://github.com/sst/opentui/blob/main/packages/core/docs/renderables-vs-constructs.md)
- [Tree-Sitter Guide](https://github.com/sst/opentui/blob/main/packages/core/docs/tree-sitter.md)
