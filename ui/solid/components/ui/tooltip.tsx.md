# Tooltip.tsx - Code Review

**File Path:** `/Users/williamcory/chop/ui/solid/components/ui/tooltip.tsx`
**Review Date:** 2025-10-26
**Component Type:** UI Component (Tooltip)
**Lines of Code:** 42
**Dependencies:** `@kobalte/core`, `solid-js`

---

## 1. File Overview

The `tooltip.tsx` file provides a SolidJS wrapper around Kobalte's Tooltip component. It exports styled and configured tooltip primitives for use throughout the application. The component consists of:

- **Tooltip (Root)**: Main container with default configuration (gutter: 4, flip: false)
- **TooltipTrigger**: Re-exported from Kobalte primitive (no customization)
- **TooltipContent**: Styled content wrapper with portal rendering

**Current Usage:**
- Used in `InfoTooltip.tsx` component for desktop help tooltips (switches to Popover on mobile)
- Used across multiple EVM debugger components (Stack, Storage, Memory, LogsAndReturn, ExecutionStepsView)
- Part of the UI component library alongside Button, Select, Combobox, Popover, etc.

**Architecture Pattern:**
- Follows the shadcn/ui pattern of wrapping headless UI primitives (Kobalte) with Tailwind styling
- Uses Tailwind CSS via `cn()` utility for class merging
- Leverages Kobalte's polymorphic component pattern for flexible HTML element rendering

---

## 2. Issues Found

### Critical Issues

**None identified.**

### High Severity Issues

#### H1: Type naming convention inconsistency
**Location:** Line 21
**Issue:** The type `tooltipContentProps` uses lowercase naming, which violates TypeScript/JavaScript conventions. While this pattern appears in other components in the codebase (Select, Combobox, Popover), it's inconsistent with TypeScript best practices and style guides.

```tsx
type tooltipContentProps<T extends ValidComponent = 'div'> = TooltipContentProps<T> & {
  class?: string
}
```

**Impact:**
- Reduces code readability
- Makes it harder to distinguish between types and values at a glance
- Inconsistent with TypeScript style guides (PascalCase for types)
- Can cause confusion for developers expecting standard TypeScript conventions

**Recommendation:** Rename to `TooltipContentPropsExtended` or `TooltipContentComponentProps` to follow PascalCase convention and avoid naming conflicts with imported types.

#### H2: Missing ParentProps type wrapper
**Location:** Line 21
**Issue:** Unlike the `Popover` component which uses `ParentProps<...>` wrapper, the tooltip's `tooltipContentProps` type directly extends `TooltipContentProps`. This means the `children` prop is not properly typed.

**Comparison:**
```tsx
// Popover (correct)
type popoverContentProps<T extends ValidComponent = 'div'> = ParentProps<
  PopoverContentProps<T> & {
    class?: string
  }
>

// Tooltip (missing ParentProps)
type tooltipContentProps<T extends ValidComponent = 'div'> = TooltipContentProps<T> & {
  class?: string
}
```

**Impact:**
- `children` prop may not have proper TypeScript inference
- Inconsistent with similar components in the codebase
- Could lead to type errors when passing children to TooltipContent
- Missing explicit typing for the children prop pattern

**Recommendation:** Wrap the type definition with `ParentProps` to match the pattern used in Popover and ensure proper children typing.

### Medium Severity Issues

#### M1: Missing exported subcomponents
**Location:** Lines 1-42 (entire file)
**Issue:** The Tooltip component doesn't export all available Kobalte subcomponents that might be useful:
- `TooltipArrow` - For adding visual arrow pointing to trigger
- No obvious close mechanism (though tooltips typically close on hover out)

**Comparison with Popover:**
```tsx
// Popover exports multiple subcomponents
export const PopoverTrigger = PopoverPrimitive.Trigger
export const PopoverTitle = PopoverPrimitive.Title
export const PopoverDescription = PopoverPrimitive.Description

// Tooltip only exports Trigger
export const TooltipTrigger = TooltipPrimitive.Trigger
```

**Impact:**
- Developers cannot add tooltip arrows for better visual indication
- Limited customization options compared to other similar components
- May need to import directly from Kobalte primitives, bypassing the component wrapper

**Recommendation:** Consider exporting `TooltipArrow` with appropriate styling to maintain consistency with the design system.

#### M2: Inconsistent children handling
**Location:** Lines 30-40
**Issue:** The `TooltipContent` component doesn't explicitly handle `children` in `splitProps`, unlike `PopoverContent` which does split and explicitly render children.

**Comparison:**
```tsx
// Popover (explicit children handling)
const [local, rest] = splitProps(props as popoverContentProps, ['class', 'children'])
return (
  <PopoverPrimitive.Content {...rest}>
    {local.children}
    {/* ... */}
  </PopoverPrimitive.Content>
)

// Tooltip (implicit children via spread)
const [local, rest] = splitProps(props as tooltipContentProps, ['class'])
return (
  <TooltipPrimitive.Content {...rest} />
)
```

**Impact:**
- Children are passed implicitly via `{...rest}` spread
- Less explicit and harder to understand data flow
- Inconsistent pattern with similar components
- Could cause issues if children need special handling

**Recommendation:** Explicitly handle children in splitProps and render them separately for consistency and clarity, even if functionally equivalent.

#### M3: Missing closeDelay configuration option
**Location:** Lines 9-19 (Tooltip root component)
**Issue:** The `Tooltip` component sets default `gutter` and `flip` props but doesn't expose other useful Kobalte tooltip options like `closeDelay`, `openDelay`, or `skipDelayDuration` at the component level.

```tsx
export const Tooltip = (props: TooltipRootProps) => {
  const merge = mergeProps<TooltipRootProps[]>(
    {
      gutter: 4,
      flip: false,
    },
    props,
  )
  return <TooltipPrimitive {...merge} />
}
```

**Current Usage Example:**
```tsx
// From InfoTooltip.tsx - users can still pass these directly
<Tooltip openDelay={0}>
  <TooltipTrigger>...</TooltipTrigger>
  <TooltipContent>...</TooltipContent>
</Tooltip>
```

**Impact:**
- Users can still pass these props directly (they're in `TooltipRootProps`)
- However, there's no guidance on recommended defaults
- Inconsistent tooltip timing across the app if developers don't know the options
- `openDelay={0}` is used in InfoTooltip but not set as default

**Recommendation:** Consider adding sensible defaults for `openDelay` and `closeDelay` to ensure consistent UX across the application.

### Low Severity Issues

#### L1: No JSDoc documentation
**Location:** Lines 9-41 (all exported components)
**Issue:** None of the exported components have JSDoc comments explaining their purpose, props, or usage examples.

**Impact:**
- Reduced developer experience when using the component
- No IntelliSense documentation in IDEs
- New developers may not understand how to use the component properly

**Recommendation:** Add JSDoc comments to all exported components with usage examples:
```tsx
/**
 * Tooltip root component. Wraps tooltip trigger and content.
 * @example
 * <Tooltip>
 *   <TooltipTrigger>Hover me</TooltipTrigger>
 *   <TooltipContent>Tooltip text</TooltipContent>
 * </Tooltip>
 */
```

#### L2: Hardcoded z-index value
**Location:** Line 34
**Issue:** The `z-50` class is hardcoded in the TooltipContent component, which could cause z-index conflicts if the design system's z-index scale changes.

```tsx
class={cn(
  'data-[closed]:fade-out-0 ... z-50 overflow-hidden ...',
  local.class,
)}
```

**Impact:**
- If Tailwind's z-index scale changes, this would need manual updates
- No centralized z-index management
- Could conflict with modals, dialogs, or other overlays

**Recommendation:** Consider extracting z-index values into a shared constant or Tailwind theme configuration for easier maintenance.

#### L3: flip: false default may cause positioning issues
**Location:** Line 13
**Issue:** The tooltip is configured with `flip: false` by default, which means it won't automatically flip to stay in viewport when space is constrained.

```tsx
const merge = mergeProps<TooltipRootProps[]>(
  {
    gutter: 4,
    flip: false, // This prevents automatic repositioning
  },
  props,
)
```

**Impact:**
- Tooltips may render partially off-screen near viewport edges
- Poor UX on small screens or constrained layouts
- Users would need to manually override this for better behavior

**Recommendation:** Consider changing default to `flip: true` or remove the default entirely to use Kobalte's default behavior, which likely handles this better.

---

## 3. Incomplete Features

### Missing Arrow Support
**Status:** Not implemented
**Description:** Kobalte tooltips support visual arrows that point from the tooltip to the trigger element. This component doesn't export or style the `TooltipArrow` component.

**Missing Implementation:**
```tsx
// Should be added:
export const TooltipArrow = TooltipPrimitive.Arrow
```

**Usage Example:**
```tsx
<Tooltip>
  <TooltipTrigger>Hover me</TooltipTrigger>
  <TooltipContent>
    Tooltip text
    <TooltipArrow /> {/* Visual arrow pointing to trigger */}
  </TooltipContent>
</Tooltip>
```

**Impact:** Users cannot add visual arrows to tooltips without importing directly from Kobalte.

### Missing Delay Configuration Defaults
**Status:** Partially implemented
**Description:** While users can pass `openDelay` and `closeDelay` props, there are no sensible defaults set in the wrapper component. The codebase shows `openDelay={0}` being used in InfoTooltip, suggesting this might be a desired default.

**Current Behavior:** Uses Kobalte's defaults (unknown without checking their docs)
**Expected Behavior:** Provide consistent, tested delay values as defaults

### Missing Animation Presets
**Status:** Only one animation style implemented
**Description:** The component only provides one animation style (fade + zoom). There's no option for different animation types or directions.

**Current Animation:**
```tsx
'data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95'
```

**Impact:** All tooltips look the same; no variation for different contexts or importance levels.

---

## 4. TODOs

**No explicit TODO comments found in the code.**

However, based on the analysis, here are implicit TODOs:

1. Fix type naming convention (tooltipContentProps → TooltipContentProps)
2. Add ParentProps wrapper to type definition
3. Export TooltipArrow component with styling
4. Add explicit children handling in TooltipContent
5. Add JSDoc documentation to all exports
6. Consider flip: true default or document why flip: false is preferred
7. Add animation variants or document customization approach
8. Consider adding default delay values based on usage patterns

---

## 5. Code Quality Issues

### TypeScript Issues

#### Issue: Type naming doesn't follow conventions
**Severity:** Medium
**Location:** Line 21
```tsx
type tooltipContentProps<T extends ValidComponent = 'div'> = ...
```
**Fix:** Use PascalCase for type names

#### Issue: Missing ParentProps wrapper
**Severity:** Medium
**Location:** Line 21
**Details:** Should wrap type with `ParentProps` like Popover does

### Pattern Consistency Issues

#### Issue: Inconsistent with Popover component pattern
**Severity:** Low
**Details:**
- Popover explicitly handles children, Tooltip doesn't
- Popover exports multiple subcomponents (Title, Description), Tooltip only exports Trigger
- Both use similar patterns but with subtle differences

**Recommendation:** Standardize the pattern across all similar components (Tooltip, Popover, Select, Combobox)

### Code Organization

**Strengths:**
- Clean separation of concerns (Root, Trigger, Content)
- Good use of composition pattern
- Proper use of Kobalte's Portal for overlay rendering
- Consistent with other UI components in the project

**Weaknesses:**
- No documentation comments
- Type naming inconsistency
- Missing some useful Kobalte features

---

## 6. Missing Test Coverage

### Current State
**Test Coverage:** 0% (No test files found)

The project has NO test files for any UI components. A search for `**/*tooltip*.{test,spec}.{ts,tsx,js,jsx}` and general test patterns found no test files in the entire `/Users/williamcory/chop/ui` directory.

### Critical Test Gaps

#### 1. Component Rendering Tests
**Missing Tests:**
- Tooltip renders with trigger and content
- Tooltip content appears on hover
- Tooltip content disappears on mouse leave
- Tooltip respects openDelay and closeDelay props
- Tooltip renders children correctly
- TooltipContent accepts and applies custom className

#### 2. Accessibility Tests
**Missing Tests:**
- ARIA attributes are properly set (aria-describedby, role, etc.)
- Keyboard navigation (focus on trigger shows tooltip)
- Screen reader compatibility
- Focus management (tooltip doesn't trap focus)

#### 3. Configuration Tests
**Missing Tests:**
- Default gutter value (4) is applied
- Default flip value (false) is applied
- Props can override defaults
- Custom props are passed through to Kobalte primitive

#### 4. Portal Rendering Tests
**Missing Tests:**
- Tooltip content renders in portal
- Portal content is appended to document body
- Multiple tooltips don't conflict

#### 5. Animation Tests
**Missing Tests:**
- Fade-in animation plays on open
- Fade-out animation plays on close
- Zoom animations work correctly
- Animation classes are applied based on data attributes

#### 6. Edge Cases
**Missing Tests:**
- Tooltip with very long content
- Tooltip near viewport edges (with flip: false)
- Multiple tooltips open simultaneously
- Tooltip with custom components as trigger
- Tooltip with polymorphic component types

### Testing Infrastructure Gap
**Issue:** No testing framework appears to be set up
**Impact:**
- No quality assurance through automated tests
- Regression risks when making changes
- No confidence in component behavior
- Difficult to refactor safely

**Recommendations:**
1. Set up testing infrastructure (Vitest + Solid Testing Library recommended for SolidJS)
2. Add test scripts to package.json
3. Create test files for all UI components starting with most-used ones
4. Implement snapshot tests for visual regression detection
5. Add integration tests for InfoTooltip (tooltip + popover switching)

---

## 7. Recommendations

### Immediate Actions (High Priority)

1. **Fix Type Naming Convention**
   - Rename `tooltipContentProps` to `TooltipContentProps` or `TooltipContentPropsExtended`
   - Update all references
   - Maintain consistency with TypeScript conventions

2. **Add ParentProps Wrapper**
   - Wrap type definition with `ParentProps` to match Popover pattern
   - Ensures proper children prop typing
   - Prevents potential type errors

3. **Export TooltipArrow**
   - Add `export const TooltipArrow = TooltipPrimitive.Arrow`
   - Add appropriate Tailwind styling for the arrow
   - Document usage in JSDoc

4. **Add JSDoc Documentation**
   - Document all exported components
   - Include usage examples
   - Describe all props and their defaults

### Short-term Improvements (Medium Priority)

5. **Explicit Children Handling**
   - Split `children` from props in `splitProps`
   - Render children explicitly for consistency
   - Match pattern used in Popover component

6. **Review flip: false Default**
   - Test tooltip behavior at viewport edges
   - Consider changing to `flip: true` for better UX
   - Document reasoning in code comments if keeping false

7. **Add Delay Defaults**
   - Consider adding `openDelay: 0` as default based on InfoTooltip usage
   - Add sensible `closeDelay` default
   - Document these choices

8. **Set Up Testing Infrastructure**
   - Install Vitest and Solid Testing Library
   - Create test setup files
   - Write tests for Tooltip component
   - Add test scripts to package.json

### Long-term Enhancements (Low Priority)

9. **Create Component Variants**
   - Add variant prop for different tooltip styles
   - Consider size variants (sm, md, lg)
   - Document all variants in storybook or similar

10. **Standardize Component Patterns**
    - Review all similar components (Tooltip, Popover, Select, Combobox)
    - Create a standard pattern for wrapper components
    - Apply pattern consistently across all components

11. **Improve Z-index Management**
    - Extract z-index values to theme configuration
    - Create z-index scale documentation
    - Use CSS custom properties for dynamic z-index

12. **Add Animation Customization**
    - Support different animation types via props
    - Consider adding `animationVariant` prop
    - Maintain backward compatibility

### Code Example: Recommended Improvements

```tsx
import type { PolymorphicProps } from '@kobalte/core/polymorphic'
import type { TooltipContentProps, TooltipRootProps } from '@kobalte/core/tooltip'
import { Tooltip as TooltipPrimitive } from '@kobalte/core/tooltip'
import { mergeProps, splitProps, type ParentProps, type ValidComponent } from 'solid-js'
import { cn } from '~/lib/cn'

/**
 * Re-exported Kobalte Tooltip trigger component
 * @see https://kobalte.dev/docs/core/components/tooltip
 */
export const TooltipTrigger = TooltipPrimitive.Trigger

/**
 * Re-exported Kobalte Tooltip arrow component for visual indication
 * @see https://kobalte.dev/docs/core/components/tooltip
 */
export const TooltipArrow = TooltipPrimitive.Arrow

/**
 * Tooltip root component that wraps trigger and content.
 *
 * @example
 * <Tooltip>
 *   <TooltipTrigger>Hover me</TooltipTrigger>
 *   <TooltipContent>Tooltip text</TooltipContent>
 * </Tooltip>
 *
 * @param props - TooltipRootProps from Kobalte
 * @see https://kobalte.dev/docs/core/components/tooltip
 */
export const Tooltip = (props: TooltipRootProps) => {
	const merge = mergeProps<TooltipRootProps[]>(
		{
			gutter: 4,
			openDelay: 0, // Immediate tooltip display
			closeDelay: 0, // Immediate tooltip hide
			flip: true, // Allow repositioning to stay in viewport
		},
		props,
	)

	return <TooltipPrimitive {...merge} />
}

/**
 * Extended props for TooltipContent component
 */
type TooltipContentProps<T extends ValidComponent = 'div'> = ParentProps<
	TooltipContentProps<T> & {
		class?: string
	}
>

/**
 * Tooltip content component with portal rendering and animations.
 * Renders inside a portal to avoid z-index issues.
 *
 * @example
 * <TooltipContent class="max-w-xs">
 *   Custom tooltip content with <strong>formatting</strong>
 * </TooltipContent>
 *
 * @param props - TooltipContentProps with optional class
 */
export const TooltipContent = <T extends ValidComponent = 'div'>(
	props: PolymorphicProps<T, TooltipContentProps<T>>,
) => {
	const [local, rest] = splitProps(props as TooltipContentProps, ['class', 'children'])

	return (
		<TooltipPrimitive.Portal>
			<TooltipPrimitive.Content
				class={cn(
					'data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95 z-50 overflow-hidden rounded-sm bg-primary px-3 py-1.5 text-primary-foreground text-xs data-[closed]:animate-out data-[expanded]:animate-in',
					local.class,
				)}
				{...rest}
			>
				{local.children}
			</TooltipPrimitive.Content>
		</TooltipPrimitive.Portal>
	)
}
```

---

## Summary

The `tooltip.tsx` component is functional and follows the project's established patterns, but has several areas for improvement:

**Strengths:**
- Clean, minimal implementation
- Good integration with Kobalte primitives
- Consistent styling with Tailwind
- Proper portal rendering for z-index management

**Key Issues:**
- Type naming doesn't follow TypeScript conventions
- Missing ParentProps wrapper for proper children typing
- No test coverage (0%)
- Missing JSDoc documentation
- Incomplete feature set (no Arrow export)
- Inconsistent children handling compared to similar components

**Priority Actions:**
1. Fix type naming (High Priority - quick fix)
2. Add ParentProps wrapper (High Priority - affects type safety)
3. Add JSDoc documentation (High Priority - improves DX)
4. Export TooltipArrow (Medium Priority - feature completeness)
5. Set up testing infrastructure (Medium Priority - quality assurance)

**Overall Assessment:** The component works but needs polish and testing before being considered production-ready. The issues found are mostly about consistency, documentation, and testing rather than critical bugs.
