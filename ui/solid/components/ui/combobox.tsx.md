# Combobox.tsx Code Review

**File Path:** `/Users/williamcory/chop/ui/solid/components/ui/combobox.tsx`
**Review Date:** 2025-10-26
**Lines of Code:** 138
**Framework:** SolidJS with Kobalte Core
**Purpose:** UI wrapper component for Kobalte Combobox primitive

---

## 1. File Overview

### Purpose
This file provides a set of styled wrapper components for the Kobalte Combobox primitive. It creates a consistent, reusable combobox implementation following the shadcn/ui design system patterns adapted for SolidJS.

### Component Architecture
The file exports the following components:
- **Combobox** - Re-export of `ComboboxPrimitive` (root component)
- **ComboboxDescription** - Re-export for description text
- **ComboboxErrorMessage** - Re-export for error display
- **ComboboxItemDescription** - Re-export for item descriptions
- **ComboboxHiddenSelect** - Re-export for accessibility/form integration
- **ComboboxInput** - Styled input field component
- **ComboboxTrigger** - Styled trigger button with chevron icon
- **ComboboxContent** - Styled dropdown content with portal
- **ComboboxItem** - Styled list item with selection indicator

### Dependencies
- `@kobalte/core/combobox` - Core accessibility primitives
- `@kobalte/core/polymorphic` - Polymorphic component types
- `solid-js` - SolidJS framework
- `~/lib/cn` - Utility for merging Tailwind classes

### Design Pattern
Follows the composition pattern where primitive components are wrapped with styling while maintaining full accessibility features from Kobalte. Uses TypeScript generics for polymorphic component support.

---

## 2. Issues Found

### Critical Severity

**CRIT-1: Production Bug - Component Not Rendering**
- **Location:** Entire component
- **Evidence:** `/Users/williamcory/chop/ui/solid/components/evm-debugger/BytecodeLoader.tsx` line 41 contains comment: "For some reason this Combobox is breaking the build. Currently it's not rendering at all"
- **Impact:** Component is broken in production use, blocking user functionality
- **Root Cause Analysis Needed:**
  1. Check if Kobalte version `@kobalte/core@0.13.11` has known issues
  2. Verify Portal mounting location exists in DOM
  3. Check for CSS conflicts with `z-50` positioning
  4. Review if `options` prop pattern matches Kobalte API
  5. Investigate if `itemComponent` pattern is correct
- **Immediate Action:** Add error boundary and detailed console logging to diagnose the issue
- **Recommendation:** HIGHEST PRIORITY - This is blocking user functionality

**CRIT-2: Missing Root Combobox Configuration**
- **Location:** Line 13
- **Description:** `Combobox` is a direct re-export without any default props or configuration
- **Impact:** Users must configure all props manually, leading to inconsistent behavior across usage sites
- **Comparison:** The `Popover` component (line 12-22 in `/Users/williamcory/chop/ui/solid/components/ui/popover.tsx`) provides sensible defaults using `mergeProps`
- **Missing Defaults:**
  - `gutter` - spacing between trigger and content
  - `flip` - behavior when dropdown doesn't fit viewport
  - `sameWidth` - whether content matches trigger width
  - `positioning` - placement strategy
- **Recommendation:** Create a wrapper component with sensible defaults like Popover does

### High Severity

**HIGH-1: Type Naming Convention Violation**
- **Location:** Lines 19, 41, 80, 104
- **Description:** Type names use camelCase (`comboboxInputProps`, `comboboxTriggerProps`, etc.) instead of PascalCase
- **Standard:** TypeScript convention is PascalCase for type names
- **Impact:**
  - Violates team conventions (other files use PascalCase: `selectTriggerProps` in select.tsx line 16)
  - Reduces code readability
  - May confuse IDE type hints
- **Affected Types:**
  - `comboboxInputProps` → should be `ComboboxInputProps`
  - `comboboxTriggerProps` → should be `ComboboxTriggerProps`
  - `comboboxContentProps` → should be `ComboboxContentProps`
  - `comboboxItemProps` → should be `ComboboxItemProps`
- **Recommendation:** Rename all type aliases to PascalCase

**HIGH-2: Inconsistent Component Pattern**
- **Location:** Lines 52-77 (ComboboxTrigger)
- **Description:** `ComboboxTrigger` wraps trigger in `ComboboxPrimitive.Control`, but usage in BytecodeLoader doesn't reflect this
- **Problem:** The API is confusing - Control wrapper is hidden from consumers
- **Impact:**
  - Users may not understand the Control/Trigger relationship
  - Cannot access Control props or customize Control behavior
  - Differs from standard Kobalte patterns
- **Comparison:** Select component exposes Control separately (can be verified by checking Kobalte docs)
- **Recommendation:** Either document this pattern clearly or expose Control as separate export

**HIGH-3: Hardcoded Icon SVG**
- **Location:** Lines 62-74 (ComboboxTrigger) and lines 121-133 (ComboboxItem)
- **Description:** SVG icons are hardcoded inline
- **Impact:**
  - Not reusable across components
  - Increases bundle size with duplicate SVG definitions
  - Hard to maintain/update icon styles
  - Cannot easily swap icons
- **Inconsistency:** BytecodeLoader uses `lucide-solid` for UploadIcon but can't replace combobox icons
- **Recommendation:** Accept icon components as props with sensible defaults

**HIGH-4: Missing Focus Styles**
- **Location:** ComboboxTrigger (line 55-58)
- **Description:** No explicit focus or focus-visible styles
- **Comparison:** SelectTrigger includes `focus:outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring` (select.tsx line 26)
- **Impact:**
  - Poor keyboard navigation experience
  - Accessibility issues for keyboard-only users
  - Fails WCAG 2.1 Success Criterion 2.4.7 (Focus Visible)
- **Recommendation:** Add focus-visible ring styles consistent with other components

**HIGH-5: Missing Disabled Styles**
- **Location:** ComboboxTrigger (line 55-58)
- **Description:** No disabled state styling
- **Comparison:** SelectTrigger includes `disabled:cursor-not-allowed disabled:opacity-50` (select.tsx line 26)
- **Impact:**
  - Disabled state not visually distinct
  - Poor UX - users don't know when combobox is disabled
- **Recommendation:** Add disabled styles matching other form components

### Medium Severity

**MED-1: Type Safety Issue with Polymorphic Props**
- **Location:** Lines 28, 50, 87, 111
- **Description:** Type assertion with `as` keyword to cast props
- **Examples:**
  - `const [local, rest] = splitProps(props as comboboxInputProps, ['class'])`
- **Problem:** Bypasses TypeScript's type checking, potential runtime errors
- **Impact:**
  - If PolymorphicProps type changes, these assertions may break silently
  - Reduces type safety benefits
- **Recommendation:** Use proper type guards or restructure to avoid assertions

**MED-2: Incomplete Accessibility - Missing Label Association**
- **Location:** ComboboxInput (lines 25-39)
- **Description:** Input has no mechanism to associate with a label
- **Problem:**
  - Users must remember to wrap in label or add aria-label
  - Easy to create inaccessible implementations
- **Current Usage:** BytecodeLoader adds `aria-label` manually (line 64)
- **Better Pattern:** Accept `aria-label` or `aria-labelledby` as required props
- **Recommendation:** Add TypeScript type to require accessibility props

**MED-3: Unclear Border Radius Inconsistency**
- **Location:** Multiple locations
- **Description:** Mixed border radius values
  - `rounded-md` in ComboboxTrigger (line 56) and ComboboxContent (line 93)
  - `rounded-sm` in ComboboxItem (line 116)
- **Comparison:** Select component uses `rounded-sm` consistently
- **Impact:** Visual inconsistency in UI design system
- **Recommendation:** Standardize on one border radius or document the reasoning

**MED-4: Portal Without Customization**
- **Location:** ComboboxContent (line 90)
- **Description:** `ComboboxPrimitive.Portal` used without props
- **Problem:** No way to customize portal mount point
- **Use Cases:**
  - Testing (may need to disable portal)
  - Nested modals/dialogs (may need custom mount point)
  - Shadow DOM scenarios
- **Recommendation:** Accept `mount` prop to allow portal customization

**MED-5: No Error Boundary**
- **Location:** Entire component
- **Description:** No error boundary wrapping Portal or Content
- **Impact:** If portal mounting fails (CRIT-1), error bubbles up and may crash parent
- **Recommendation:** Add error boundary or at least try-catch with fallback UI

**MED-6: Missing Data Attributes for Testing**
- **Location:** All components
- **Description:** No `data-testid` or `data-*` attributes
- **Impact:**
  - Hard to write reliable E2E tests
  - Cannot easily target components in test selectors
- **Recommendation:** Accept optional `data-testid` prop, or use consistent class-based selectors

### Low Severity

**LOW-1: Incomplete VoidProps Usage**
- **Location:** Line 19
- **Description:** `ComboboxInput` uses `VoidProps` but other components use `ParentProps`
- **Reasoning:** Input shouldn't have children (correct)
- **Issue:** Not documented why this is different
- **Impact:** Minor - may confuse future maintainers
- **Recommendation:** Add JSDoc comment explaining VoidProps choice

**LOW-2: Missing JSDoc Documentation**
- **Location:** All components
- **Description:** No JSDoc comments explaining component purpose, props, or usage
- **Impact:**
  - Poor IDE intellisense experience
  - New developers need to read source or examples
  - No usage guidance
- **Recommendation:** Add JSDoc for each exported component with examples

**LOW-3: Inconsistent Class Prop Naming**
- **Location:** All styled components
- **Description:** Using `class` prop (SolidJS convention) but no `className` alias
- **Impact:** May confuse React developers transitioning to SolidJS
- **Note:** This is correct for SolidJS, but worth documenting
- **Recommendation:** Add comment or doc that this is SolidJS `class`, not React `className`

**LOW-4: Magic Sizing Values**
- **Location:** Multiple locations
- **Examples:**
  - `h-9` (line 56) - trigger height
  - `h-3.5 w-3.5` (line 62, 121) - icon container size
  - `h-4 w-4` (line 63, 122) - icon size
  - `min-w-[8rem]` (line 93) - minimum content width
- **Problem:** No named constants or CSS variables
- **Impact:** Hard to maintain consistent sizing across theme
- **Recommendation:** Consider extracting to theme configuration

**LOW-5: Inline Title Tags in SVG**
- **Location:** Lines 72, 131
- **Description:** `<title>Arrow</title>` and `<title>Checked</title>` inline in SVG
- **Good Practice:** This improves accessibility
- **Issue:** Could be more descriptive
- **Recommendation:** Consider more contextual titles like "Toggle dropdown" and "Selected item indicator"

**LOW-6: Unclear Content Children Handling**
- **Location:** ComboboxContent (lines 84-102)
- **Description:** Content renders `<ComboboxPrimitive.Listbox class="p-1" />` but doesn't pass through children
- **Question:** How do ComboboxItems get rendered?
- **Answer:** Items are passed via Kobalte's context API, not as children
- **Issue:** This pattern is not obvious to consumers
- **Recommendation:** Add JSDoc explaining that items are provided via Combobox root's `options` and `itemComponent` props

---

## 3. Incomplete Features

### Feature 1: Virtualization Support
**Status:** Not implemented
**Description:** No support for virtualized lists with large option sets
**Impact:** Performance issues with 100+ options
**Use Case:** Large dataset selection (countries, products, users)
**Work Required:**
- Integrate with `@tanstack/solid-virtual` or similar
- Expose virtualizer configuration props
- Update ListBox to use virtual items
**Estimated Effort:** 1-2 days

### Feature 2: Multi-Select Mode
**Status:** Not implemented
**Description:** Only supports single selection
**Impact:** Cannot select multiple options
**Use Case:** Tag selection, multi-filter selection
**Kobalte Support:** Check if `@kobalte/core` supports multi-select
**Work Required:**
- Research Kobalte multi-select API
- Update types to support multiple selection
- Update ItemIndicator to show checkboxes instead of single check
- Handle array of selected values
**Estimated Effort:** 2-3 days

### Feature 3: Async/Searchable Options
**Status:** Not implemented
**Description:** No built-in support for async option loading or filtering
**Impact:** Cannot implement server-side search
**Use Case:** User search, API-driven options, autocomplete
**Work Required:**
- Accept `onInputChange` callback
- Expose loading state
- Add loading spinner UI
- Handle debouncing
**Estimated Effort:** 2-3 days

### Feature 4: Grouping/Sections
**Status:** Not implemented
**Description:** No support for grouped options
**Impact:** Cannot organize options into categories
**Use Case:** Categorized product selection, country by region
**Kobalte Support:** Check if Combobox supports sections like Select does (SelectSection)
**Work Required:**
- Research Kobalte sections API
- Create ComboboxSection component
- Update styling for section headers
**Estimated Effort:** 1 day

### Feature 5: Custom Trigger Content
**Status:** Partially implemented
**Description:** Trigger accepts children but structure is rigid (icon always on right)
**Impact:** Cannot fully customize trigger layout
**Use Case:** Trigger with avatar, multiple lines, custom positioning
**Work Required:**
- Make icon optional or accept as prop
- Expose ComboboxInput position customization
- Allow flexible trigger layout via render props or slots
**Estimated Effort:** 4-6 hours

### Feature 6: Empty State
**Status:** Not implemented
**Description:** No built-in empty state when no options match
**Impact:** Poor UX when search returns no results
**Work Required:**
- Accept `emptyContent` prop
- Render custom empty state in Listbox
- Default message like "No options found"
**Estimated Effort:** 2-4 hours

### Feature 7: Create New Option
**Status:** Not implemented
**Description:** No "create new" functionality when search doesn't match
**Impact:** Cannot add new options on the fly
**Use Case:** Tag creation, adding new categories
**Work Required:**
- Accept `onCreateOption` callback
- Detect when to show "Create ..." option
- Add creation UI to dropdown
**Estimated Effort:** 1 day

---

## 4. TODOs

### Explicit TODOs in Code
**None found** - No TODO, FIXME, HACK, XXX, or NOTE comments in this file

### Implicit TODOs (Derived from Issues)

#### Priority: CRITICAL
1. **Investigate and Fix Rendering Bug**
   - **Description:** Component not rendering in BytecodeLoader, breaking the build
   - **Action:** Debug portal mounting, Kobalte API usage, and CSS conflicts
   - **Owner:** Unassigned
   - **Estimated Effort:** 4-8 hours (investigation + fix)

2. **Add Default Props Configuration**
   - **Description:** Create wrapper like Popover to provide sensible defaults
   - **Action:** Add `mergeProps` with default gutter, flip, sameWidth, etc.
   - **Owner:** Unassigned
   - **Estimated Effort:** 1-2 hours

#### Priority: HIGH
3. **Fix Type Naming Conventions**
   - **Description:** Rename all camelCase types to PascalCase
   - **Action:** Global find/replace with type checking
   - **Owner:** Anyone
   - **Estimated Effort:** 30 minutes

4. **Add Focus Styles**
   - **Description:** Add focus-visible ring matching other components
   - **Action:** Update ComboboxTrigger className
   - **Owner:** Anyone
   - **Estimated Effort:** 15 minutes

5. **Add Disabled Styles**
   - **Description:** Add disabled state styling
   - **Action:** Update ComboboxTrigger className
   - **Owner:** Anyone
   - **Estimated Effort:** 15 minutes

6. **Make Icons Customizable**
   - **Description:** Accept icon components as props
   - **Action:** Add optional icon props with default SVGs
   - **Owner:** Unassigned
   - **Estimated Effort:** 1-2 hours

#### Priority: MEDIUM
7. **Improve Type Safety**
   - **Description:** Remove `as` type assertions
   - **Action:** Restructure splitProps usage or add proper guards
   - **Owner:** Unassigned
   - **Estimated Effort:** 1-2 hours

8. **Add Accessibility Props Validation**
   - **Description:** Require aria-label or similar on Input
   - **Action:** Update types to make a11y props required
   - **Owner:** Unassigned
   - **Estimated Effort:** 30 minutes

9. **Standardize Border Radius**
   - **Description:** Document or fix border-radius inconsistency
   - **Action:** Align with design system standards
   - **Owner:** Design system team
   - **Estimated Effort:** 30 minutes

10. **Add Portal Customization**
    - **Description:** Allow custom portal mount point
    - **Action:** Accept and forward `mount` prop
    - **Owner:** Unassigned
    - **Estimated Effort:** 30 minutes

#### Priority: LOW
11. **Add JSDoc Documentation**
    - **Description:** Document all exported components
    - **Action:** Add JSDoc comments with usage examples
    - **Owner:** Anyone
    - **Estimated Effort:** 2-3 hours

12. **Add Testing Data Attributes**
    - **Description:** Support data-testid props
    - **Action:** Accept and forward data-testid
    - **Owner:** QA/Testing team
    - **Estimated Effort:** 1 hour

---

## 5. Code Quality Issues

### Architecture & Design

**Issue 1: Inconsistent Export Pattern**
- **Description:** Mix of direct re-exports and wrapped components
- **Lines:** 13-17 (direct), 25-137 (wrapped)
- **Problem:** Unclear which components are styled vs. pure re-exports
- **Impact:** Consumer confusion about which components to use
- **Better Approach:** Namespace or clear naming convention
- **Example:**
  ```typescript
  // Option 1: Namespace
  export const ComboboxUnstyled = {
    Root: ComboboxPrimitive,
    Description: ComboboxPrimitive.Description,
    // ...
  }

  // Option 2: Suffix
  export const ComboboxDescriptionBase = ComboboxPrimitive.Description
  ```

**Issue 2: Missing Composition Example**
- **Description:** No example or test showing full component composition
- **Problem:** Consumers must guess how pieces fit together
- **Evidence:** BytecodeLoader implementation has issues (component not rendering)
- **Impact:** High learning curve, likely misuse
- **Better Approach:** Include usage example in JSDoc or companion `.example.tsx` file

**Issue 3: Tight Coupling to Kobalte Version**
- **Description:** Direct dependency on specific Kobalte API
- **Problem:** Breaking changes in Kobalte require updates here
- **Current Version:** `@kobalte/core@0.13.11`
- **Risk:** Version 0.x indicates unstable API
- **Mitigation:** Pin version, add integration tests, consider abstraction layer

**Issue 4: No Controlled/Uncontrolled Mode Documentation**
- **Description:** Unclear if Combobox supports both modes
- **Problem:** Users don't know how to manage state
- **Impact:** Potential state management bugs
- **Better Approach:** Document state management patterns with examples

### Code Style & Consistency

**Issue 1: Inconsistent Props Destructuring**
- **Location:** Lines 28, 50, 87, 111
- **Description:** Some components split `['class']`, others `['class', 'children']`
- **Reasoning:** Depends on whether component uses children
- **Problem:** Pattern not immediately obvious
- **Recommendation:** Add comments explaining destructuring choices

**Issue 2: Mixed String Literals for Classes**
- **Location:** Throughout
- **Description:** Long multi-line class strings without organization
- **Example:** Line 93-94 has 3-line class string
- **Impact:** Hard to read and maintain
- **Better Approach:** Use template literals with line breaks, or class array pattern:
  ```typescript
  const classes = [
    'data-[closed]:fade-out-0',
    'data-[expanded]:fade-in-0',
    'data-[closed]:zoom-out-95',
    // ...
  ]
  cn(classes, local.class)
  ```

**Issue 3: No Explicit Component Display Names**
- **Location:** All function components
- **Description:** Components don't have `displayName` set
- **Impact:** Harder to debug in React DevTools (if applicable)
- **SolidJS Note:** SolidJS may not use displayName, but worth checking
- **Recommendation:** Set displayName for better debugging

### Type Safety

**Issue 1: Overly Permissive Generic Default**
- **Location:** All generic components
- **Description:** Generic type `T extends ValidComponent` with liberal defaults
- **Example:** `ComboboxInput<T extends ValidComponent = 'input'>`
- **Problem:** Consumers can pass invalid component types
- **Impact:** Runtime errors instead of compile-time errors
- **Recommendation:** Consider stricter type constraints or validation

**Issue 2: Missing Prop Validation**
- **Location:** All components
- **Description:** No runtime prop validation (TypeScript only)
- **Problem:** Props can be invalid at runtime (JS consumers, dynamic props)
- **Impact:** Potential runtime errors
- **Recommendation:** Consider using runtime validation library (e.g., Zod) for critical props

**Issue 3: Class Prop Type Too Permissive**
- **Location:** All styled components
- **Description:** `class?: string` accepts any string
- **Problem:** Typos in class names not caught
- **Note:** Tailwind CSS IntelliSense plugin helps, but not enforced
- **Recommendation:** Document that Tailwind classes are expected

### Performance Considerations

**Issue 1: No Memoization**
- **Location:** All components
- **Description:** No use of `createMemo` or similar
- **Impact:** Potentially unnecessary re-renders
- **SolidJS Note:** SolidJS has fine-grained reactivity, so this may not be an issue
- **Recommendation:** Profile and add memoization if needed

**Issue 2: Inline Object/Array Creation**
- **Location:** Lines 93-94
- **Description:** Long class string created on every render
- **Impact:** Minor - string concatenation is fast
- **Recommendation:** Monitor if this becomes a bottleneck

### Security Considerations

**Issue 1: SVG Injection Risk**
- **Location:** Lines 62-74, 121-133
- **Description:** Inline SVG without sanitization
- **Current State:** Hardcoded, so safe
- **Risk:** If SVGs become dynamic props, need sanitization
- **Recommendation:** If accepting custom SVGs, validate and sanitize

---

## 6. Missing Test Coverage

### Current State
**Test Files Found:** None
**Coverage:** 0%
**Test Framework:** Unknown (likely Vitest based on SolidJS + Vite stack)
**Testing Library:** Likely `@solidjs/testing-library`

### Test Infrastructure Needed

**Setup Required:**
1. Install testing dependencies:
   ```json
   {
     "devDependencies": {
       "@solidjs/testing-library": "^0.8.x",
       "@testing-library/jest-dom": "^6.x",
       "@testing-library/user-event": "^14.x",
       "vitest": "^1.x",
       "jsdom": "^24.x"
     }
   }
   ```

2. Configure Vitest:
   ```typescript
   // vitest.config.ts
   export default defineConfig({
     plugins: [solidPlugin()],
     test: {
       environment: 'jsdom',
       globals: true,
       setupFiles: ['./vitest.setup.ts'],
     },
   })
   ```

3. Setup file:
   ```typescript
   // vitest.setup.ts
   import '@testing-library/jest-dom'
   ```

### Critical Test Gaps

#### Unit Tests

**1. ComboboxInput Rendering**
```typescript
describe('ComboboxInput', () => {
  it('renders input element', () => {
    render(() => <ComboboxInput />)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('applies custom class', () => {
    render(() => <ComboboxInput class="custom-class" />)
    expect(screen.getByRole('combobox')).toHaveClass('custom-class')
  })

  it('merges default classes with custom classes', () => {
    render(() => <ComboboxInput class="custom-class" />)
    const input = screen.getByRole('combobox')
    expect(input).toHaveClass('bg-transparent', 'custom-class')
  })

  it('forwards all props to underlying input', () => {
    render(() => <ComboboxInput placeholder="Search..." disabled />)
    const input = screen.getByRole('combobox')
    expect(input).toHaveAttribute('placeholder', 'Search...')
    expect(input).toBeDisabled()
  })

  it('applies disabled styles', () => {
    render(() => <ComboboxInput disabled />)
    expect(screen.getByRole('combobox')).toHaveClass('disabled:cursor-not-allowed')
  })
})
```

**2. ComboboxTrigger Rendering**
```typescript
describe('ComboboxTrigger', () => {
  it('renders trigger button', () => {
    render(() => (
      <Combobox>
        <ComboboxTrigger>Select...</ComboboxTrigger>
      </Combobox>
    ))
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('renders children content', () => {
    render(() => (
      <Combobox>
        <ComboboxTrigger>Custom Content</ComboboxTrigger>
      </Combobox>
    ))
    expect(screen.getByText('Custom Content')).toBeInTheDocument()
  })

  it('renders chevron icon', () => {
    render(() => (
      <Combobox>
        <ComboboxTrigger>Select...</ComboboxTrigger>
      </Combobox>
    ))
    const svg = screen.getByTitle('Arrow')
    expect(svg).toBeInTheDocument()
  })

  it('applies custom class', () => {
    render(() => (
      <Combobox>
        <ComboboxTrigger class="w-64">Select...</ComboboxTrigger>
      </Combobox>
    ))
    expect(screen.getByRole('button')).toHaveClass('w-64')
  })

  it('wraps trigger in Control component', () => {
    const { container } = render(() => (
      <Combobox>
        <ComboboxTrigger>Select...</ComboboxTrigger>
      </Combobox>
    ))
    // Verify Control wrapper exists in DOM
    expect(container.querySelector('[data-kb-combobox-control]')).toBeInTheDocument()
  })
})
```

**3. ComboboxContent Rendering**
```typescript
describe('ComboboxContent', () => {
  it('renders content in portal', async () => {
    render(() => (
      <Combobox open>
        <ComboboxTrigger>Select...</ComboboxTrigger>
        <ComboboxContent />
      </Combobox>
    ))
    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument()
    })
  })

  it('applies custom class', async () => {
    render(() => (
      <Combobox open>
        <ComboboxTrigger>Select...</ComboboxTrigger>
        <ComboboxContent class="custom-dropdown" />
      </Combobox>
    ))
    await waitFor(() => {
      expect(screen.getByRole('listbox').parentElement).toHaveClass('custom-dropdown')
    })
  })

  it('renders listbox inside content', async () => {
    render(() => (
      <Combobox open>
        <ComboboxTrigger>Select...</ComboboxTrigger>
        <ComboboxContent />
      </Combobox>
    ))
    await waitFor(() => {
      const listbox = screen.getByRole('listbox')
      expect(listbox).toHaveClass('p-1')
    })
  })

  it('not visible when closed', () => {
    render(() => (
      <Combobox open={false}>
        <ComboboxTrigger>Select...</ComboboxTrigger>
        <ComboboxContent />
      </Combobox>
    ))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
```

**4. ComboboxItem Rendering**
```typescript
describe('ComboboxItem', () => {
  it('renders item with label', () => {
    render(() => (
      <Combobox open options={['Option 1']}>
        <ComboboxTrigger>Select...</ComboboxTrigger>
        <ComboboxContent>
          <ComboboxItem item="Option 1">Option 1</ComboboxItem>
        </ComboboxContent>
      </Combobox>
    ))
    expect(screen.getByText('Option 1')).toBeInTheDocument()
  })

  it('applies custom class', () => {
    render(() => (
      <Combobox open options={['Option 1']}>
        <ComboboxTrigger>Select...</ComboboxTrigger>
        <ComboboxContent>
          <ComboboxItem item="Option 1" class="custom-item">Option 1</ComboboxItem>
        </ComboboxContent>
      </Combobox>
    ))
    expect(screen.getByText('Option 1').closest('li')).toHaveClass('custom-item')
  })

  it('shows indicator when selected', async () => {
    render(() => (
      <Combobox open value="Option 1" options={['Option 1']}>
        <ComboboxTrigger>Select...</ComboboxTrigger>
        <ComboboxContent>
          <ComboboxItem item="Option 1">Option 1</ComboboxItem>
        </ComboboxContent>
      </Combobox>
    ))
    const indicator = screen.getByTitle('Checked')
    expect(indicator).toBeInTheDocument()
  })

  it('hides indicator when not selected', () => {
    render(() => (
      <Combobox open value="Option 2" options={['Option 1', 'Option 2']}>
        <ComboboxTrigger>Select...</ComboboxTrigger>
        <ComboboxContent>
          <ComboboxItem item="Option 1">Option 1</ComboboxItem>
        </ComboboxContent>
      </Combobox>
    ))
    // Indicator should not be visible for unselected item
    // Implementation detail: may still be in DOM but hidden
  })
})
```

**5. Class Merging Logic**
```typescript
describe('class merging with cn utility', () => {
  it('merges custom classes without conflicts', () => {
    render(() => <ComboboxInput class="text-lg text-red-500" />)
    const input = screen.getByRole('combobox')
    // Should have text-lg (custom) and NOT text-sm (default)
    expect(input).toHaveClass('text-lg')
    expect(input).not.toHaveClass('text-sm')
  })

  it('preserves default classes when no conflict', () => {
    render(() => <ComboboxInput class="text-lg" />)
    const input = screen.getByRole('combobox')
    expect(input).toHaveClass('bg-transparent') // default preserved
    expect(input).toHaveClass('text-lg') // custom added
  })
})
```

#### Integration Tests

**1. Full Combobox Interaction Flow**
```typescript
describe('Combobox integration', () => {
  it('allows selecting an option', async () => {
    const handleChange = vi.fn()
    const user = userEvent.setup()

    render(() => (
      <Combobox
        options={['Apple', 'Banana', 'Cherry']}
        onChange={handleChange}
      >
        <ComboboxTrigger>Select fruit</ComboboxTrigger>
        <ComboboxContent />
      </Combobox>
    ))

    // Open combobox
    await user.click(screen.getByRole('button'))

    // Select option
    await user.click(screen.getByText('Banana'))

    // Verify callback
    expect(handleChange).toHaveBeenCalledWith('Banana')
  })

  it('filters options by input', async () => {
    const user = userEvent.setup()

    render(() => (
      <Combobox
        options={['Apple', 'Banana', 'Cherry']}
      >
        <ComboboxTrigger>
          <ComboboxInput />
        </ComboboxTrigger>
        <ComboboxContent />
      </Combobox>
    ))

    const input = screen.getByRole('combobox')

    // Type to filter
    await user.type(input, 'ban')

    // Verify only Banana shows
    expect(screen.getByText('Banana')).toBeInTheDocument()
    expect(screen.queryByText('Apple')).not.toBeInTheDocument()
    expect(screen.queryByText('Cherry')).not.toBeInTheDocument()
  })

  it('closes on selection', async () => {
    const user = userEvent.setup()

    render(() => (
      <Combobox options={['Option 1']}>
        <ComboboxTrigger>Select...</ComboboxTrigger>
        <ComboboxContent />
      </Combobox>
    ))

    await user.click(screen.getByRole('button'))
    await user.click(screen.getByText('Option 1'))

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })
  })

  it('reopens after closing', async () => {
    const user = userEvent.setup()

    render(() => (
      <Combobox options={['Option 1']}>
        <ComboboxTrigger>Select...</ComboboxTrigger>
        <ComboboxContent />
      </Combobox>
    ))

    // Open, close, open again
    await user.click(screen.getByRole('button'))
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button'))

    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })
})
```

**2. BytecodeLoader Integration**
```typescript
describe('Combobox in BytecodeLoader', () => {
  it('loads sample contract on selection', async () => {
    // This test would help diagnose the current rendering bug
    const user = userEvent.setup()

    render(() => <BytecodeLoader {...mockProps} />)

    // Try to open combobox
    const trigger = screen.getByLabelText('Select sample contract')
    await user.click(trigger)

    // Verify dropdown opens (currently fails)
    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument()
    }, { timeout: 3000 })

    // Select contract
    await user.click(screen.getByText('Simple Storage'))

    // Verify bytecode loaded
    expect(mockProps.setBytecode).toHaveBeenCalled()
  })
})
```

#### Accessibility Tests

**1. Keyboard Navigation**
```typescript
describe('keyboard navigation', () => {
  it('opens on Enter key', async () => {
    const user = userEvent.setup()

    render(() => (
      <Combobox options={['Option 1']}>
        <ComboboxTrigger>Select...</ComboboxTrigger>
        <ComboboxContent />
      </Combobox>
    ))

    const trigger = screen.getByRole('button')
    trigger.focus()
    await user.keyboard('{Enter}')

    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('navigates options with arrow keys', async () => {
    const user = userEvent.setup()

    render(() => (
      <Combobox options={['Option 1', 'Option 2', 'Option 3']}>
        <ComboboxTrigger>Select...</ComboboxTrigger>
        <ComboboxContent />
      </Combobox>
    ))

    await user.click(screen.getByRole('button'))
    await user.keyboard('{ArrowDown}')
    await user.keyboard('{ArrowDown}')

    // Option 2 should be highlighted
    const option2 = screen.getByText('Option 2')
    expect(option2).toHaveAttribute('data-highlighted', 'true')
  })

  it('selects on Enter key', async () => {
    const handleChange = vi.fn()
    const user = userEvent.setup()

    render(() => (
      <Combobox
        options={['Option 1', 'Option 2']}
        onChange={handleChange}
      >
        <ComboboxTrigger>Select...</ComboboxTrigger>
        <ComboboxContent />
      </Combobox>
    ))

    await user.click(screen.getByRole('button'))
    await user.keyboard('{ArrowDown}')
    await user.keyboard('{Enter}')

    expect(handleChange).toHaveBeenCalledWith('Option 1')
  })

  it('closes on Escape key', async () => {
    const user = userEvent.setup()

    render(() => (
      <Combobox options={['Option 1']}>
        <ComboboxTrigger>Select...</ComboboxTrigger>
        <ComboboxContent />
      </Combobox>
    ))

    await user.click(screen.getByRole('button'))
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('maintains focus management', async () => {
    const user = userEvent.setup()

    render(() => (
      <Combobox options={['Option 1']}>
        <ComboboxTrigger>Select...</ComboboxTrigger>
        <ComboboxContent />
      </Combobox>
    ))

    const trigger = screen.getByRole('button')

    await user.click(trigger)
    await user.keyboard('{Escape}')

    // Focus should return to trigger
    expect(trigger).toHaveFocus()
  })
})
```

**2. ARIA Attributes**
```typescript
describe('ARIA attributes', () => {
  it('has correct role on trigger', () => {
    render(() => (
      <Combobox>
        <ComboboxTrigger>Select...</ComboboxTrigger>
      </Combobox>
    ))
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('has correct role on listbox', async () => {
    render(() => (
      <Combobox open options={['Option 1']}>
        <ComboboxTrigger>Select...</ComboboxTrigger>
        <ComboboxContent />
      </Combobox>
    ))
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('has correct role on options', async () => {
    render(() => (
      <Combobox open options={['Option 1']}>
        <ComboboxTrigger>Select...</ComboboxTrigger>
        <ComboboxContent />
      </Combobox>
    ))
    expect(screen.getByRole('option')).toBeInTheDocument()
  })

  it('has aria-expanded on trigger', () => {
    const { rerender } = render(() => (
      <Combobox open={false}>
        <ComboboxTrigger>Select...</ComboboxTrigger>
      </Combobox>
    ))
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false')

    rerender(() => (
      <Combobox open={true}>
        <ComboboxTrigger>Select...</ComboboxTrigger>
      </Combobox>
    ))
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true')
  })

  it('has aria-selected on selected option', () => {
    render(() => (
      <Combobox open value="Option 1" options={['Option 1', 'Option 2']}>
        <ComboboxTrigger>Select...</ComboboxTrigger>
        <ComboboxContent />
      </Combobox>
    ))
    const option1 = screen.getByText('Option 1')
    expect(option1).toHaveAttribute('aria-selected', 'true')
  })

  it('announces changes to screen readers', async () => {
    // Use aria-live region testing
    const { container } = render(() => (
      <Combobox options={['Option 1']}>
        <ComboboxTrigger>Select...</ComboboxTrigger>
        <ComboboxContent />
      </Combobox>
    ))

    // Check for aria-live regions
    const liveRegion = container.querySelector('[aria-live]')
    expect(liveRegion).toBeInTheDocument()
  })
})
```

**3. Screen Reader Testing**
```typescript
describe('screen reader support', () => {
  it('provides accessible name for trigger', () => {
    render(() => (
      <Combobox>
        <ComboboxTrigger aria-label="Select country">
          Select...
        </ComboboxTrigger>
      </Combobox>
    ))
    expect(screen.getByLabelText('Select country')).toBeInTheDocument()
  })

  it('associates label with input', () => {
    render(() => (
      <Combobox>
        <label for="country-select">Country</label>
        <ComboboxTrigger>
          <ComboboxInput id="country-select" />
        </ComboboxTrigger>
      </Combobox>
    ))
    expect(screen.getByLabelText('Country')).toBeInTheDocument()
  })

  it('announces number of options available', async () => {
    const { container } = render(() => (
      <Combobox open options={['A', 'B', 'C']}>
        <ComboboxTrigger>Select...</ComboboxTrigger>
        <ComboboxContent />
      </Combobox>
    ))

    // Kobalte should set aria-setsize on options
    const option = screen.getByText('A')
    expect(option).toHaveAttribute('aria-setsize', '3')
  })
})
```

#### Visual Regression Tests

**Using Playwright or similar:**
```typescript
describe('visual regression', () => {
  it('matches snapshot - default state', async () => {
    await expect(page).toHaveScreenshot('combobox-default.png')
  })

  it('matches snapshot - open state', async () => {
    await page.click('button')
    await expect(page).toHaveScreenshot('combobox-open.png')
  })

  it('matches snapshot - selected state', async () => {
    await page.click('button')
    await page.click('text=Option 1')
    await expect(page).toHaveScreenshot('combobox-selected.png')
  })

  it('matches snapshot - disabled state', async () => {
    // Test with disabled prop
    await expect(page).toHaveScreenshot('combobox-disabled.png')
  })

  it('matches snapshot - with error', async () => {
    // Test error state if applicable
    await expect(page).toHaveScreenshot('combobox-error.png')
  })
})
```

### Test Utilities Needed

**Mock Helpers:**
```typescript
// test-utils/combobox-helpers.ts
export const mockComboboxProps = {
  options: ['Option 1', 'Option 2', 'Option 3'],
  value: null,
  onChange: vi.fn(),
  placeholder: 'Select an option',
}

export const renderCombobox = (props = {}) => {
  const defaultProps = {
    ...mockComboboxProps,
    ...props,
  }

  return render(() => (
    <Combobox {...defaultProps}>
      <ComboboxTrigger>
        <ComboboxInput placeholder={defaultProps.placeholder} />
      </ComboboxTrigger>
      <ComboboxContent />
    </Combobox>
  ))
}

export const openCombobox = async () => {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button'))
  await waitFor(() => {
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })
}
```

### Coverage Goals

| Category | Current | Target | Priority |
|----------|---------|--------|----------|
| Statements | 0% | 95%+ | HIGH |
| Branches | 0% | 90%+ | HIGH |
| Functions | 0% | 95%+ | HIGH |
| Lines | 0% | 95%+ | HIGH |

### Test Priority

1. **P0 - Critical (This Sprint)**
   - Basic rendering tests for all components
   - Integration test for selection flow
   - Keyboard navigation tests
   - ARIA compliance tests

2. **P1 - High (Next Sprint)**
   - Class merging tests
   - Polymorphic component tests
   - Error boundary tests
   - Focus management tests

3. **P2 - Medium (Backlog)**
   - Visual regression tests
   - Performance tests
   - Edge case tests
   - Cross-browser tests

4. **P3 - Low (Nice to Have)**
   - Snapshot tests
   - Animation tests
   - Stress tests (100+ options)

---

## 7. Recommendations

### Immediate Actions (This Sprint - 3-5 days)

#### 1. Fix Critical Rendering Bug (P0 - 1 day)
**Owner:** Frontend Lead
**Deadline:** Immediate

**Investigation Checklist:**
```bash
# 1. Check browser console
- Open BytecodeLoader in browser
- Look for errors related to Portal, Kobalte, or Combobox
- Note any CSS-related warnings

# 2. Verify Kobalte version
npm list @kobalte/core
# Check changelog for breaking changes between versions

# 3. Test in isolation
# Create test file: combobox-test.tsx
import { Combobox, ComboboxTrigger, ComboboxInput, ComboboxContent, ComboboxItem } from './combobox'

const TestCombobox = () => (
  <Combobox
    options={['Test 1', 'Test 2']}
    itemComponent={(props) => (
      <ComboboxItem item={props.item}>{props.item.rawValue}</ComboboxItem>
    )}
  >
    <ComboboxTrigger>
      <ComboboxInput placeholder="Test" />
    </ComboboxTrigger>
    <ComboboxContent />
  </Combobox>
)

# 4. Check Portal mounting
# Verify <div id="root"> or similar exists in HTML
# Check if Portal needs explicit mount prop

# 5. CSS conflicts
# Temporarily disable global CSS
# Check if z-50 conflicts with other z-index values
# Verify overflow properties on parent elements

# 6. Kobalte API verification
# Review Kobalte docs: https://kobalte.dev/docs/core/components/combobox
# Verify itemComponent pattern is correct
# Check if options prop format matches expected type
```

**Temporary Workaround (while debugging):**
```typescript
// In BytecodeLoader.tsx, replace Combobox with:
<select
  value={selectedContract()}
  onChange={(e) => {
    setSelectedContract(e.currentTarget.value)
    const contract = sampleContracts.find(c => c.name === e.currentTarget.value)
    if (contract) props.setBytecode(contract.bytecode)
  }}
  class="w-[250px] h-9 rounded-md border border-input px-3 bg-transparent"
  aria-label="Select sample contract"
>
  {sampleContracts.map(c => (
    <option value={c.name}>
      {c.name} - {c.description}
    </option>
  ))}
</select>
```

**Expected Outcome:**
- Root cause identified and documented
- Fix implemented and tested
- BytecodeLoader functional again

---

#### 2. Add Default Props Wrapper (P0 - 2 hours)
**Owner:** Any frontend developer
**Rationale:** Consistency with Popover pattern, better DX

**Implementation:**
```typescript
// At top of file, replace line 13:
// export const Combobox = ComboboxPrimitive

// With:
export const Combobox = (props: ComboboxRootProps) => {
  const merged = mergeProps<ComboboxRootProps[]>(
    {
      gutter: 4,
      sameWidth: true,
      flip: false,
      positioning: {
        placement: 'bottom-start',
      },
    },
    props,
  )

  return <ComboboxPrimitive {...merged} />
}
```

**Testing:**
- Verify defaults work in BytecodeLoader
- Test that props can override defaults
- Ensure TypeScript types still work

---

#### 3. Fix Type Naming Conventions (P0 - 30 minutes)
**Owner:** Anyone
**Automated Fix Available:** Yes

**Steps:**
```bash
# 1. Search and replace (verify each change):
# comboboxInputProps → ComboboxInputProps
# comboboxTriggerProps → ComboboxTriggerProps
# comboboxContentProps → ComboboxContentProps
# comboboxItemProps → ComboboxItemProps

# 2. Run TypeScript compiler
npm run typecheck

# 3. Verify no breaking changes
npm run build
```

**Changes Required:**
```typescript
// Line 19
type ComboboxInputProps<T extends ValidComponent = 'input'> = VoidProps<
  ComboboxInputProps<T> & {
    class?: string
  }
>

// Line 28
const [local, rest] = splitProps(props as ComboboxInputProps, ['class'])

// Repeat for all type names
```

---

#### 4. Add Focus and Disabled Styles (P0 - 30 minutes)
**Owner:** Anyone

**Changes:**
```typescript
// Line 55-58, update ComboboxTrigger className:
class={cn(
  'flex h-9 w-full items-center justify-between rounded-md border border-input px-3 shadow-sm',
  'focus:outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring focus-visible:ring-offset-2',
  'disabled:cursor-not-allowed disabled:opacity-50',
  'transition-shadow ring-offset-background',
  local.class,
)}
```

**Testing:**
- Manually test keyboard navigation
- Test disabled state
- Verify focus ring appears on keyboard navigation
- Ensure no focus ring on mouse click (focus-visible)

---

### Short-term Improvements (Next Sprint - 1-2 weeks)

#### 5. Add Comprehensive Test Suite (P1 - 3 days)
**Owner:** QA + Frontend team
**Deliverables:**
- Test setup (Vitest + Testing Library)
- Unit tests for all components (90%+ coverage)
- Integration tests for user flows
- Accessibility tests
- CI/CD integration

**Phases:**
1. **Day 1:** Setup + Input/Trigger tests
2. **Day 2:** Content/Item tests + Integration tests
3. **Day 3:** Accessibility tests + CI setup

**Success Metrics:**
- 90%+ line coverage
- All keyboard navigation works
- ARIA attributes validated
- No accessibility violations (axe-core)

---

#### 6. Add JSDoc Documentation (P1 - 3 hours)
**Owner:** Component author or technical writer

**Template:**
```typescript
/**
 * A combobox input component for searchable selection from a list of options.
 *
 * @example
 * ```tsx
 * <Combobox options={['Apple', 'Banana']} value={fruit()} onChange={setFruit}>
 *   <ComboboxTrigger>
 *     <ComboboxInput placeholder="Select fruit..." />
 *   </ComboboxTrigger>
 *   <ComboboxContent />
 * </Combobox>
 * ```
 *
 * @see https://kobalte.dev/docs/core/components/combobox
 */
export const Combobox = (props: ComboboxRootProps) => {
  // ...
}

/**
 * The styled input field for the combobox.
 * Allows users to type and filter options.
 *
 * @param props.class - Additional CSS classes to apply
 * @param props.placeholder - Placeholder text
 *
 * @example
 * ```tsx
 * <ComboboxInput
 *   placeholder="Search..."
 *   aria-label="Search countries"
 * />
 * ```
 */
export const ComboboxInput = <T extends ValidComponent = 'input'>(
  props: PolymorphicProps<T, ComboboxInputProps<T>>,
) => {
  // ...
}

// Continue for all exported components...
```

---

#### 7. Make Icons Customizable (P1 - 2 hours)
**Owner:** Component author

**Implementation:**
```typescript
// Update ComboboxTrigger:
type ComboboxTriggerProps<T extends ValidComponent = 'button'> = ParentProps<
  ComboboxTriggerProps<T> & {
    class?: string
    icon?: JSX.Element // Add icon prop
  }
>

export const ComboboxTrigger = <T extends ValidComponent = 'button'>(
  props: PolymorphicProps<T, ComboboxTriggerProps<T>>,
) => {
  const [local, rest] = splitProps(props as ComboboxTriggerProps, [
    'class',
    'children',
    'icon', // Add to split
  ])

  return (
    <ComboboxPrimitive.Control>
      <ComboboxPrimitive.Trigger
        class={cn(/* ... */)}
        {...rest}
      >
        {local.children}
        <ComboboxPrimitive.Icon class="flex h-3.5 w-3.5 items-center justify-center">
          {local.icon ?? (
            // Default chevron SVG
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="h-4 w-4 opacity-50">
              {/* ... */}
            </svg>
          )}
        </ComboboxPrimitive.Icon>
      </ComboboxPrimitive.Trigger>
    </ComboboxPrimitive.Control>
  )
}

// Usage:
<ComboboxTrigger icon={<ChevronDownIcon />}>
  Select...
</ComboboxTrigger>
```

**Do same for ComboboxItem indicator.**

---

#### 8. Improve Type Safety (P2 - 2 hours)
**Owner:** TypeScript expert

**Remove type assertions:**
```typescript
// Before:
const [local, rest] = splitProps(props as ComboboxInputProps, ['class'])

// After - Option 1: Use type parameter
export const ComboboxInput = <T extends ValidComponent = 'input'>(
  props: PolymorphicProps<T, ComboboxInputProps<T>>,
) => {
  type Props = ComboboxInputProps<T>
  const [local, rest] = splitProps(props as Props, ['class'])
  // ...
}

// After - Option 2: Restructure to avoid assertion
// This requires deeper changes to how polymorphic props work
```

---

#### 9. Enhance Accessibility (P2 - 4 hours)
**Owner:** Accessibility specialist

**Improvements:**

1. **Require accessibility props:**
```typescript
type ComboboxInputProps<T extends ValidComponent = 'input'> = VoidProps<
  ComboboxInputProps<T> & {
    class?: string
    'aria-label'?: string
    'aria-labelledby'?: string
  }
> & (
  | { 'aria-label': string }
  | { 'aria-labelledby': string }
  | { 'aria-label': string; 'aria-labelledby': string }
)
// Ensures at least one accessibility prop is provided
```

2. **Add live region for feedback:**
```typescript
export const ComboboxContent = <T extends ValidComponent = 'div'>(
  props: PolymorphicProps<T, ComboboxContentProps<T>>,
) => {
  const [local, rest] = splitProps(props as ComboboxContentProps, ['class'])

  return (
    <ComboboxPrimitive.Portal>
      <div role="status" aria-live="polite" class="sr-only">
        {/* Announce option count, selection changes */}
      </div>
      <ComboboxPrimitive.Content
        class={cn(/* ... */)}
        {...rest}
      >
        <ComboboxPrimitive.Listbox class="p-1" />
      </ComboboxPrimitive.Content>
    </ComboboxPrimitive.Portal>
  )
}
```

3. **Test with screen readers:**
   - NVDA (Windows)
   - JAWS (Windows)
   - VoiceOver (macOS/iOS)

---

#### 10. Standardize Border Radius (P2 - 30 minutes)
**Owner:** Design system lead

**Decision Required:**
- Should all combobox elements use `rounded-sm` (2px)?
- Or should they use `rounded-md` (6px)?

**Current State:**
- Trigger: `rounded-md`
- Content: `rounded-md`
- Item: `rounded-sm`

**Recommendation:**
- Use `rounded-md` for outer elements (Trigger, Content)
- Use `rounded-sm` for inner elements (Items)
- Document in design system

**Update:**
```typescript
// Ensure consistency, add comment:
class={cn(
  // Using rounded-md for content container per design system
  'rounded-md border bg-popover',
  local.class,
)}
```

---

### Long-term Enhancements (Backlog - 2-4 weeks)

#### 11. Add Virtualization Support (P3 - 2 days)
**Owner:** Performance team
**Use Case:** Dropdowns with 1000+ options

**Dependencies:**
```json
{
  "@tanstack/solid-virtual": "^3.x"
}
```

**Implementation:**
```typescript
import { createVirtualizer } from '@tanstack/solid-virtual'

type ComboboxContentProps = {
  virtualizer?: boolean
  estimateSize?: number
}

export const ComboboxContent = (props) => {
  const parentRef = createSignal<HTMLDivElement>()

  const virtualizer = createMemo(() => {
    if (!props.virtualizer) return null

    return createVirtualizer({
      count: options.length,
      getScrollElement: () => parentRef(),
      estimateSize: () => props.estimateSize ?? 35,
    })
  })

  // Render virtual items...
}
```

---

#### 12. Add Multi-Select Support (P3 - 3 days)
**Owner:** Feature team
**Design:** Requires UX review

**API Design:**
```typescript
<Combobox
  multiple
  value={selectedTags()}
  onChange={setSelectedTags}
  options={allTags}
>
  <ComboboxTrigger>
    {selectedTags().map(tag => (
      <Badge>{tag}</Badge>
    ))}
    <ComboboxInput />
  </ComboboxTrigger>
  <ComboboxContent />
</Combobox>
```

---

#### 13. Add Async/Searchable Support (P3 - 3 days)
**Owner:** Feature team

**API Design:**
```typescript
<Combobox
  onInputChange={(value) => fetchOptions(value)}
  loading={isLoading()}
  options={searchResults()}
>
  <ComboboxTrigger>
    <ComboboxInput />
  </ComboboxTrigger>
  <ComboboxContent>
    {isLoading() && <div>Loading...</div>}
  </ComboboxContent>
</Combobox>
```

---

#### 14. Add Grouping Support (P3 - 1 day)
**Owner:** Component author

**Check Kobalte support first, then:**
```typescript
export const ComboboxGroup = ComboboxPrimitive.Group
export const ComboboxGroupLabel = ComboboxPrimitive.GroupLabel

// Usage:
<ComboboxContent>
  <ComboboxGroup>
    <ComboboxGroupLabel>Fruits</ComboboxGroupLabel>
    <ComboboxItem>Apple</ComboboxItem>
    <ComboboxItem>Banana</ComboboxItem>
  </ComboboxGroup>
  <ComboboxGroup>
    <ComboboxGroupLabel>Vegetables</ComboboxGroupLabel>
    <ComboboxItem>Carrot</ComboboxItem>
  </ComboboxGroup>
</ComboboxContent>
```

---

#### 15. Create Example/Documentation Page (P2 - 1 day)
**Owner:** Documentation team

**Create file:** `/Users/williamcory/chop/ui/solid/components/ui/combobox.example.tsx`

**Content:**
```typescript
/**
 * Combobox Component Examples
 *
 * This file demonstrates various usage patterns of the Combobox component.
 */

// Example 1: Basic usage
export const BasicExample = () => {
  const [value, setValue] = createSignal('')

  return (
    <Combobox
      value={value()}
      onChange={setValue}
      options={['Apple', 'Banana', 'Cherry']}
    >
      <ComboboxTrigger>
        <ComboboxInput placeholder="Select fruit..." />
      </ComboboxTrigger>
      <ComboboxContent />
    </Combobox>
  )
}

// Example 2: With custom item rendering
export const CustomItemExample = () => {
  const fruits = [
    { name: 'Apple', emoji: '🍎', color: 'red' },
    { name: 'Banana', emoji: '🍌', color: 'yellow' },
  ]

  return (
    <Combobox
      options={fruits}
      optionValue="name"
      itemComponent={(props) => (
        <ComboboxItem item={props.item}>
          <span class="mr-2">{props.item.rawValue.emoji}</span>
          <span>{props.item.rawValue.name}</span>
        </ComboboxItem>
      )}
    >
      <ComboboxTrigger>
        <ComboboxInput placeholder="Select fruit..." />
      </ComboboxTrigger>
      <ComboboxContent />
    </Combobox>
  )
}

// Add 5-10 more examples...
```

---

### Risk Mitigation

#### Risk 1: Kobalte Breaking Changes
**Probability:** Medium (currently on v0.x)
**Impact:** High (all combobox functionality breaks)

**Mitigation:**
1. Pin exact version in package.json: `"@kobalte/core": "0.13.11"`
2. Add integration tests that will fail if API changes
3. Subscribe to Kobalte changelog/releases
4. When upgrading:
   - Review changelog thoroughly
   - Test in isolated branch
   - Run full test suite
   - Manual QA testing

---

#### Risk 2: Portal Mounting Issues
**Probability:** Medium (already happening)
**Impact:** High (component doesn't render)

**Mitigation:**
1. Add error boundary around Portal
2. Add fallback render without portal
3. Add detailed error logging
4. Document portal requirements in README
5. Test in various DOM structures

**Fallback Implementation:**
```typescript
export const ComboboxContent = (props) => {
  const [portalError, setPortalError] = createSignal(false)

  const content = (
    <ComboboxPrimitive.Content {...restProps}>
      <ComboboxPrimitive.Listbox class="p-1" />
    </ComboboxPrimitive.Content>
  )

  if (portalError()) {
    // Render without portal as fallback
    return content
  }

  return (
    <ErrorBoundary
      fallback={(err) => {
        console.error('Portal error:', err)
        setPortalError(true)
        return content
      }}
    >
      <ComboboxPrimitive.Portal>
        {content}
      </ComboboxPrimitive.Portal>
    </ErrorBoundary>
  )
}
```

---

#### Risk 3: Browser Compatibility Issues
**Probability:** Low
**Impact:** Medium (some users can't use component)

**Mitigation:**
1. Test in target browsers:
   - Chrome (latest 2 versions)
   - Firefox (latest 2 versions)
   - Safari (latest 2 versions)
   - Edge (latest 2 versions)
2. Add browser compatibility notes to docs
3. Use feature detection for advanced features
4. Add fallbacks for unsupported features

---

### Success Metrics

**Define success criteria for combobox improvements:**

#### Functionality Metrics
- [ ] Component renders without errors in BytecodeLoader
- [ ] All keyboard interactions work (Arrow keys, Enter, Escape, Tab)
- [ ] Filtering works correctly
- [ ] Selection updates properly
- [ ] No console errors or warnings

#### Quality Metrics
- [ ] 90%+ test coverage (statements)
- [ ] 85%+ test coverage (branches)
- [ ] 0 ESLint errors
- [ ] 0 TypeScript errors
- [ ] 0 accessibility violations (axe-core)

#### Performance Metrics
- [ ] Renders in <100ms (100 options)
- [ ] Filters in <50ms (100 options)
- [ ] Opens dropdown in <200ms
- [ ] Bundle size increase <10KB

#### Documentation Metrics
- [ ] JSDoc on all public components
- [ ] At least 5 usage examples
- [ ] README with getting started guide
- [ ] Migration guide (if breaking changes)

#### User Experience Metrics
- [ ] Passes WCAG 2.1 Level AA
- [ ] Works with keyboard only
- [ ] Works with screen readers
- [ ] Mobile responsive
- [ ] Touch friendly (44px minimum touch target)

---

## Summary

### Critical Findings

1. **BLOCKING BUG:** Component not rendering in production (BytecodeLoader)
   - Requires immediate investigation and fix
   - Temporary workaround: use native `<select>` element

2. **Type Safety Issues:** camelCase type names, type assertions
   - Quick fix, should be done immediately
   - Improves code quality and maintainability

3. **Missing Accessibility:** No focus styles, incomplete ARIA
   - Fails WCAG compliance
   - Affects keyboard and screen reader users

4. **Zero Test Coverage:** No tests exist
   - High risk for regressions
   - Hard to refactor with confidence

5. **Missing Documentation:** No JSDoc or examples
   - High learning curve
   - Likely causing the usage issues in BytecodeLoader

### Health Score

| Category | Score | Weight | Weighted Score |
|----------|-------|--------|----------------|
| Functionality | 3/10 | 25% | 0.75 |
| Code Quality | 6/10 | 20% | 1.20 |
| Type Safety | 5/10 | 15% | 0.75 |
| Test Coverage | 0/10 | 20% | 0.00 |
| Accessibility | 4/10 | 10% | 0.40 |
| Documentation | 2/10 | 10% | 0.20 |
| **TOTAL** | **-** | **-** | **3.30/10** |

**Overall Grade: D (Needs Significant Work)**

### Effort Estimation

| Priority | Tasks | Estimated Time |
|----------|-------|----------------|
| P0 (Critical) | 4 tasks | 2-3 days |
| P1 (High) | 6 tasks | 5-7 days |
| P2 (Medium) | 4 tasks | 3-5 days |
| P3 (Low) | 5 tasks | 10-15 days |
| **TOTAL** | **19 tasks** | **20-30 days** |

### Recommended Roadmap

**Week 1: Critical Fixes**
- Fix rendering bug
- Add default props
- Fix type naming
- Add focus/disabled styles
- Add basic tests

**Week 2-3: Quality Improvements**
- Comprehensive test suite
- JSDoc documentation
- Make icons customizable
- Improve type safety
- Enhance accessibility

**Week 4-6: Feature Additions (Optional)**
- Virtualization support
- Multi-select mode
- Async/searchable
- Grouping support
- Example documentation

### Next Steps

1. **Immediate:** Assign P0 tasks to developers
2. **This Sprint:** Fix critical bugs, add tests
3. **Next Sprint:** Improve quality, add docs
4. **Backlog:** Consider feature additions

---

## Appendix

### Related Files for Context

**Dependencies:**
- `/Users/williamcory/chop/ui/solid/components/ui/select.tsx` - Similar component pattern
- `/Users/williamcory/chop/ui/solid/components/ui/popover.tsx` - Shows default props pattern
- `/Users/williamcory/chop/ui/solid/lib/cn.ts` - Class merging utility
- `/Users/williamcory/chop/ui/package.json` - Dependency versions

**Usage:**
- `/Users/williamcory/chop/ui/solid/components/evm-debugger/BytecodeLoader.tsx` - Current (broken) usage
- `/Users/williamcory/chop/ui/solid/components/evm-debugger/BytecodeLoader.tsx.md` - Detailed review of usage

### External Resources

**Kobalte Documentation:**
- Combobox API: https://kobalte.dev/docs/core/components/combobox
- Accessibility: https://kobalte.dev/docs/core/overview/accessibility

**SolidJS Resources:**
- Testing Library: https://github.com/solidjs/solid-testing-library
- Vitest: https://vitest.dev/
- SolidJS Guide: https://www.solidjs.com/guides/testing

**Accessibility Standards:**
- WCAG 2.1: https://www.w3.org/WAI/WCAG21/quickref/
- ARIA Combobox: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
- axe-core: https://github.com/dequelabs/axe-core

### Code Quality Tools

**Recommended Setup:**
```json
{
  "devDependencies": {
    "@solidjs/testing-library": "^0.8.7",
    "@testing-library/jest-dom": "^6.2.0",
    "@testing-library/user-event": "^14.5.2",
    "@vitest/coverage-v8": "^1.2.0",
    "vitest": "^1.2.0",
    "jsdom": "^24.0.0",
    "axe-core": "^4.8.0",
    "eslint-plugin-jsx-a11y": "^6.8.0"
  }
}
```

---

**Review Complete**

This review was conducted on 2025-10-26 and reflects the state of the codebase at that time. For questions or clarifications, please contact the development team.
