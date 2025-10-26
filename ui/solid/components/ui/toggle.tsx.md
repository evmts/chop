# Code Review: toggle.tsx

**File Path:** `/Users/williamcory/chop/ui/solid/components/ui/toggle.tsx`
**Review Date:** 2025-10-26
**Lines of Code:** 46

---

## 1. File Overview

The `toggle.tsx` file implements a toggle button component using Kobalte's ToggleButton primitive and class-variance-authority for variant styling. This is a foundational UI component used in the EVM debugger interface for panel navigation controls.

**Purpose:**
- Provides a styled toggle button component with variants
- Wraps Kobalte's `@kobalte/core/toggle-button` primitive
- Supports size and variant customization via CVA (class-variance-authority)

**Current Usage:**
- Used in `/Users/williamcory/chop/ui/solid/components/evm-debugger/Header.tsx` (7 instances)
- Used in `/Users/williamcory/chop/ui/solid/components/evm-debugger/LogsAndReturn.tsx` (2 instances)

**Dependencies:**
- `@kobalte/core` v0.13.11
- `class-variance-authority` v0.7.1
- `solid-js` v1.9.7

---

## 2. Issues Found

### Critical Severity

**None identified**

### High Severity

#### H1. Missing Component Subexports
**Location:** Lines 1-46 (entire file)
**Description:** The component only exports `ToggleButton` and `toggleVariants`, but Kobalte's ToggleButton primitive includes several subcomponents that are not re-exported. Similar components in the codebase (like `switch.tsx` and `checkbox.tsx`) export the primitive itself and its subcomponents.

**Missing exports:**
- `ToggleButton.Label` (for accessible labels)
- `ToggleButton.ErrorMessage` (for validation feedback)
- `ToggleButton.Description` (for additional context)
- The base `ToggleButton` primitive itself (for composition)

**Impact:**
- Limited flexibility for consumers who need to compose toggle buttons with labels or descriptions
- Inconsistent with other component patterns in the codebase
- Accessibility concerns when labels are needed but not easily accessible

**Current Pattern in `checkbox.tsx`:**
```typescript
export const CheckboxLabel = CheckboxPrimitive.Label
export const Checkbox = CheckboxPrimitive
export const CheckboxErrorMessage = CheckboxPrimitive.ErrorMessage
export const CheckboxDescription = CheckboxPrimitive.Description
```

**Current Pattern in `switch.tsx`:**
```typescript
export const SwitchLabel = SwitchPrimitive.Label
export const Switch = SwitchPrimitive
export const SwitchErrorMessage = SwitchPrimitive.ErrorMessage
export const SwitchDescription = SwitchPrimitive.Description
```

### Medium Severity

#### M1. Inconsistent Naming Convention
**Location:** Line 31
**Description:** The type `toggleButtonProps` uses lowercase naming, which is inconsistent with TypeScript conventions and other similar components in the codebase.

**Current:**
```typescript
type toggleButtonProps<T extends ValidComponent = 'button'> = ...
```

**Expected (based on `button.tsx` pattern):**
```typescript
type buttonProps<T extends ValidComponent = 'button'> = ...
```

However, for consistency across the codebase, PascalCase would be more appropriate:
```typescript
type ToggleButtonProps<T extends ValidComponent = 'button'> = ...
```

**Impact:** Inconsistent code style may confuse developers and make the codebase harder to maintain.

#### M2. Transition Property Order Inconsistency
**Location:** Line 11
**Description:** The `transition-[box-shadow,color,background-color]` property order differs from similar components.

**Current (toggle.tsx):**
```typescript
transition-[box-shadow,color,background-color]
```

**Other components (button.tsx):**
```typescript
transition-[color,background-color,box-shadow]
```

**Impact:** Minor visual inconsistency in transition timing, though functionally equivalent.

#### M3. Missing Icon Size Variant
**Location:** Lines 18-22
**Description:** The component lacks an `icon` size variant that's present in the button component. This is useful for toggle buttons that only contain icons without text.

**Current sizes:**
- `default`: h-9 px-3
- `sm`: h-8 px-2
- `lg`: h-10 px-3

**Missing from button.tsx:**
- `icon`: h-9 w-9

**Impact:** Developers need to manually override classes when creating icon-only toggle buttons, leading to inconsistent sizing.

### Low Severity

#### L1. Limited Variant Options
**Location:** Lines 14-17
**Description:** The component only offers two variants (`default` and `outline`), while the button component offers six variants (default, destructive, outline, secondary, ghost, link).

**Current variants:**
- `default`: bg-transparent
- `outline`: border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground

**Potentially useful variants:**
- `ghost`: For subtle toggle buttons
- `destructive`: For dangerous/critical toggles
- `secondary`: For secondary actions

**Impact:** Limited styling options may require custom class overrides in consuming components.

#### L2. No JSDoc Documentation
**Location:** Lines 10-45
**Description:** The exported `toggleVariants`, type `toggleButtonProps`, and component `ToggleButton` lack JSDoc comments explaining their purpose, props, and usage.

**Impact:** Reduced developer experience; developers must read implementation or examples to understand usage.

#### L3. Hardcoded Border Radius
**Location:** Line 11
**Description:** The component uses `rounded-sm` hardcoded in the base styles. The button component also uses `rounded-sm` in base styles but allows size variants to override it.

**Current:**
```typescript
'inline-flex items-center justify-center rounded-sm text-sm font-medium ...'
```

**Impact:** Minimal - border radius is consistent across sizes, but reduces flexibility if different radii are needed per size.

---

## 3. Incomplete Features

### F1. Toggle Group Support
**Status:** Not implemented
**Description:** Kobalte provides a `ToggleGroup` component for managing groups of toggle buttons (radio-like or multi-select behavior). This is not implemented or re-exported.

**Use Case:** The Header.tsx file currently manually manages toggle button groups using individual `pressed` states and `onChange` handlers. A ToggleGroup wrapper could simplify this pattern.

**Current workaround in Header.tsx:**
```typescript
<ToggleButton
    pressed={props.activePanel === 'all'}
    onChange={() => props.setActivePanel('all')}
    size="sm"
>
    All panels
</ToggleButton>
<ToggleButton
    pressed={props.activePanel === 'stack'}
    onChange={() => props.setActivePanel('stack')}
    size="sm"
>
    Stack
</ToggleButton>
// ... 5 more similar buttons
```

**What's missing:**
- No `ToggleGroup` component export
- No `ToggleGroupItem` component
- No built-in single/multiple selection management

### F2. Accessibility Features
**Status:** Partially implemented
**Description:** While Kobalte provides excellent accessibility primitives, this component doesn't expose them.

**Missing features:**
- No Label component export for accessible labeling
- No Description component for `aria-describedby`
- No ErrorMessage component for validation states
- No easy way to add ARIA attributes

**Current accessibility:**
- Focus-visible ring: Implemented
- Disabled state: Implemented via `disabled:pointer-events-none disabled:opacity-50`
- Pressed state: Implemented via `data-[pressed]:bg-accent`

**Missing accessibility:**
- Label association (must be done manually)
- Description association
- Error state communication
- Help text

### F3. Loading State Support
**Status:** Not implemented
**Description:** No built-in support for loading/pending states, which are common in toggle buttons that trigger async operations.

**Use case:** When a toggle triggers an API call or async state change, a loading state provides user feedback.

**What's missing:**
- No `loading` prop or variant
- No spinner/loading indicator integration
- No disabled-during-loading behavior

---

## 4. TODOs

**Result:** No TODO, FIXME, XXX, HACK, or NOTE comments found in the file.

---

## 5. Code Quality Issues

### CQ1. Prop Splitting Verbosity
**Location:** Line 37
**Severity:** Low
**Description:** The type assertion `props as toggleButtonProps` is necessary but creates slight verbosity.

**Current:**
```typescript
const [local, rest] = splitProps(props as toggleButtonProps, ['class', 'variant', 'size'])
```

**Note:** This pattern is consistent with other components in the codebase, so it's more of a TypeScript limitation than a code quality issue.

### CQ2. No Input Validation
**Location:** Lines 36-45
**Severity:** Low
**Description:** The component doesn't validate or provide defaults for edge cases (e.g., invalid variant names, undefined values).

**Impact:** Invalid props will be passed through to CVA, which handles them gracefully with defaults, so this is minimal risk.

### CQ3. Generic Component Naming
**Location:** Line 36
**Severity:** Low
**Description:** The component is named `ToggleButton` which is quite generic. In the context of UI libraries, this might conflict with other toggle button implementations.

**Current usage:** The component is imported as `ToggleButton` in consuming files, which is clear enough in context.

**Consideration:** Could be aliased to `Toggle` for brevity, as is common in UI libraries (e.g., Radix UI, shadcn/ui).

---

## 6. Missing Test Coverage

### Test Status: No Tests Found

**Search performed:**
- Pattern: `**/*toggle*.test.{ts,tsx,js,jsx}`
- Pattern: `**/*toggle*.spec.{ts,tsx,js,jsx}`
- Result: No test files found

### Test Infrastructure
**Status:** No testing framework configured
**Evidence:**
- No test scripts in `/Users/williamcory/chop/ui/package.json`
- No testing dependencies (vitest, @solidjs/testing-library, etc.)
- No test files found in the entire `/Users/williamcory/chop/ui/solid` directory

### Recommended Test Coverage

#### Unit Tests Needed:

1. **Rendering Tests**
   - Component renders without errors
   - Component renders with children text
   - Component renders with different variants (default, outline)
   - Component renders with different sizes (default, sm, lg)

2. **Prop Tests**
   - Custom `class` prop merges correctly with variant styles
   - `pressed` prop applies correct data attribute
   - `disabled` prop applies correct styles and prevents interaction

3. **Interaction Tests**
   - Click toggles pressed state
   - `onChange` callback is called with correct arguments
   - Disabled button doesn't trigger onChange
   - Keyboard interaction (Space/Enter) works correctly

4. **Accessibility Tests**
   - Has correct ARIA attributes
   - Focus-visible ring appears on keyboard navigation
   - Screen reader announces pressed/unpressed state
   - Disabled state is announced

5. **Style Tests**
   - Variant classes apply correctly
   - Size classes apply correctly
   - Hover states apply correctly
   - Pressed state styles apply correctly
   - Custom classes don't override critical functionality

#### Integration Tests Needed:

1. **Toggle Group Behavior** (when implemented)
   - Multiple toggles work independently by default
   - Toggle groups enforce single selection when configured
   - Toggle groups allow multi-selection when configured

2. **Form Integration**
   - Works within form contexts
   - Value synchronizes with form state
   - Validation states display correctly

#### Visual Regression Tests Needed:

1. Default variant in all sizes
2. Outline variant in all sizes
3. Pressed state for all variants
4. Disabled state for all variants
5. Focus-visible state
6. Hover state

---

## 7. Recommendations

### High Priority

1. **Add Missing Subcomponent Exports**
   - Export `ToggleButtonPrimitive` as `Toggle` or `ToggleButton` for composition
   - Export `ToggleButton.Label` as `ToggleButtonLabel`
   - Export `ToggleButton.Description` as `ToggleButtonDescription`
   - Export `ToggleButton.ErrorMessage` as `ToggleButtonErrorMessage`
   - Follow the pattern established in `checkbox.tsx` and `switch.tsx`

2. **Fix Type Naming Convention**
   - Rename `toggleButtonProps` to `ToggleButtonProps` (PascalCase)
   - Update internal usage accordingly

3. **Add Icon Size Variant**
   - Add `icon: 'h-9 w-9'` to size variants for consistency with button component

### Medium Priority

4. **Implement ToggleGroup Component**
   - Create `toggle-group.tsx` component file
   - Wrap Kobalte's ToggleGroup primitive
   - Provide similar styling and variant support
   - Update Header.tsx to use ToggleGroup for cleaner code

5. **Add JSDoc Documentation**
   - Document `toggleVariants` with usage examples
   - Document `ToggleButtonProps` type with prop descriptions
   - Document `ToggleButton` component with usage examples
   - Include accessibility notes

6. **Expand Variant Options**
   - Add `ghost` variant for subtle toggles
   - Add `destructive` variant for critical actions
   - Consider `secondary` variant for hierarchy

7. **Standardize Transition Order**
   - Change to `transition-[color,background-color,box-shadow]` to match button component

### Low Priority

8. **Add Loading State Support**
   - Add optional `loading` prop
   - Show loading indicator when true
   - Disable interaction during loading
   - Consider using lucide-solid's Loader2 icon

9. **Create Example/Demo File**
   - Create examples showing all variants and sizes
   - Demonstrate toggle groups when implemented
   - Show accessibility patterns with labels
   - Include form integration examples

10. **Set Up Testing Infrastructure**
    - Add `vitest` for unit testing
    - Add `@solidjs/testing-library` for component testing
    - Add `@testing-library/user-event` for interaction testing
    - Configure test scripts in package.json
    - Create test file: `toggle.test.tsx`

11. **Consider Aliasing Export**
    - Export as both `ToggleButton` and `Toggle` for flexibility
    - Update imports in consuming components if brevity is preferred

### Future Considerations

12. **Variant Composition**
    - Consider using `compoundVariants` in CVA for variant combinations
    - Example: Different hover colors per variant

13. **Theme Integration**
    - Consider adding theme-aware variants if design system expands
    - Ensure dark mode styles are consistent

14. **Performance Optimization**
    - Current implementation is performant for typical usage
    - If toggle groups become large (>50 items), consider virtualization

---

## 8. Code Pattern Comparison

### Current Implementation Quality: Good

The implementation follows solid patterns established in the codebase:
- Consistent use of CVA for variant management
- Proper use of SolidJS splitProps pattern
- Good integration with Kobalte primitives
- Proper TypeScript typing with generics

### Comparison with Similar Components

| Feature | toggle.tsx | button.tsx | checkbox.tsx | switch.tsx |
|---------|-----------|------------|--------------|------------|
| Variants | 2 | 6 | N/A (styling only) | N/A (styling only) |
| Sizes | 3 | 4 (includes icon) | N/A | N/A |
| Subcomponent Exports | No | No | Yes (4 exports) | Yes (4 exports) |
| Base Primitive Export | No | No | Yes | Yes |
| Documentation | No | No | No | No |
| Tests | No | No | No | No |

**Pattern Inconsistency:** Toggle follows the button pattern (single component export) rather than the checkbox/switch pattern (multiple subcomponent exports). Given that Kobalte's ToggleButton has similar composition capabilities to Checkbox and Switch, it should follow the checkbox/switch pattern.

---

## 9. Usage Analysis

### Current Usage Patterns

#### Header.tsx (7 instances)
- All instances use `size="sm"`
- All instances use custom `class` overrides for amber hover/pressed colors
- All instances manually manage `pressed` state
- All instances use `onChange` for state management

**Pattern observed:**
```typescript
<ToggleButton
    pressed={props.activePanel === 'panelName'}
    onChange={() => props.setActivePanel('panelName')}
    size="sm"
    class="whitespace-nowrap hover:bg-amber-100 data-[pressed]:bg-amber-100 dark:data-[pressed]:bg-amber-950 dark:hover:bg-amber-950"
>
    Panel Name
</ToggleButton>
```

**Issues with current usage:**
1. Repetitive custom class overrides (could be a variant)
2. Manual state management (could use ToggleGroup)
3. No labels for accessibility
4. Color customization not part of variant system

#### LogsAndReturn.tsx (2 instances)
- Similar pattern to Header.tsx
- Manual state management
- Custom class overrides

### Suggestions for Usage Patterns

1. **Create an "amber" variant** to avoid repetitive class overrides:
   ```typescript
   variant: {
       default: 'bg-transparent',
       outline: '...',
       amber: 'hover:bg-amber-100 data-[pressed]:bg-amber-100 dark:data-[pressed]:bg-amber-950 dark:hover:bg-amber-950'
   }
   ```

2. **Implement ToggleGroup** for panel navigation:
   ```typescript
   <ToggleGroup value={props.activePanel} onChange={props.setActivePanel}>
       <ToggleGroupItem value="all" size="sm" variant="amber">All panels</ToggleGroupItem>
       <ToggleGroupItem value="stack" size="sm" variant="amber">Stack</ToggleGroupItem>
       // ...
   </ToggleGroup>
   ```

---

## 10. Security Considerations

**Status:** No security issues identified

The component:
- Properly sanitizes classes through `cn()` utility (twMerge + clsx)
- Doesn't handle user input directly
- Doesn't perform any unsafe operations
- Relies on Kobalte's security-audited primitives
- Uses SolidJS's built-in XSS protection

---

## 11. Performance Considerations

**Status:** Good performance characteristics

- Component is lightweight (~46 lines)
- Uses SolidJS's efficient reactivity system
- `splitProps` is optimally used
- CVA compilation is done at build time
- No unnecessary re-renders expected

**Potential optimization:** None needed for current usage scale (9 instances across 2 files)

---

## 12. Accessibility Review

### Current Accessibility: Basic (3/5)

**What's Working:**
- ✅ Focus-visible ring for keyboard navigation
- ✅ Disabled state with pointer-events-none
- ✅ Pressed state communicated via `data-pressed` attribute (handled by Kobalte)
- ✅ Uses semantic button element by default

**What's Missing:**
- ❌ No easy way to add labels (accessibility concern for icon-only buttons)
- ❌ No description or help text support
- ❌ No error message support for validation
- ❌ Current usage in Header.tsx lacks labels for icon-less buttons

**WCAG 2.1 Compliance:**
- **Level A:** Likely compliant (needs testing)
- **Level AA:** Needs labels for full compliance
- **Level AAA:** Additional testing required

**Recommendations:**
1. Export Label component for accessible labeling
2. Add `aria-label` or `aria-labelledby` to examples
3. Document accessibility best practices
4. Add screen reader testing to test suite

---

## Summary

The `toggle.tsx` component is a solid, functional implementation that serves its current purpose well. However, it has several areas for improvement:

**Strengths:**
- Clean, concise implementation
- Good integration with Kobalte primitives
- Consistent with some codebase patterns
- Performant and secure

**Key Weaknesses:**
- Missing subcomponent exports (inconsistent with checkbox/switch patterns)
- Limited variants compared to button component
- No test coverage (no tests exist for any components)
- Lacks documentation
- Accessibility could be enhanced

**Immediate Action Items:**
1. Add missing subcomponent exports for consistency
2. Fix type naming convention
3. Add icon size variant
4. Add JSDoc documentation

**Follow-up Actions:**
1. Implement ToggleGroup component
2. Set up testing infrastructure
3. Create comprehensive test suite
4. Add more variants as needed

**Overall Code Quality Rating: 7/10**

The component is production-ready for its current use case but would benefit from the improvements outlined above to match the quality and flexibility of similar UI libraries.
