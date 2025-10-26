# Textarea Component Review

**File:** `/Users/williamcory/chop/ui/solid/components/ui/textarea.tsx`
**Review Date:** 2025-10-26
**Component Type:** UI Component (Form Input)
**Dependencies:** @kobalte/core, solid-js, class-variance-authority utilities

---

## 1. File Overview

The `textarea.tsx` file provides a styled wrapper around Kobalte's `TextField.TextArea` primitive component. It's a minimal implementation (27 lines) that provides a single export: the `TextArea` component. The component is designed to work within SolidJS applications and integrates with the Kobalte UI library for accessible form controls.

**Key Characteristics:**
- Polymorphic component supporting custom element types
- Uses Kobalte's accessible TextField primitives
- Styled with Tailwind CSS classes
- Follows the project's pattern for UI components
- Minimal API surface with basic styling

**Current Usage:**
The component is used in `/Users/williamcory/chop/ui/solid/components/evm-debugger/BytecodeLoader.tsx` where it's wrapped in a `TextFieldRoot` component for bytecode input.

---

## 2. Issues Found

### Critical (Priority 1)
None identified.

### High (Priority 2)

#### H1. Incomplete Component Architecture
**Severity:** High
**Location:** Lines 1-27 (entire file)
**Issue:** The `TextArea` component is incomplete compared to its sibling `TextField` component. It only exports the textarea input element itself, but lacks the supporting components that make up a complete form field implementation:
- Missing `TextAreaRoot` equivalent to `TextFieldRoot`
- Missing `TextAreaLabel` for accessible labeling
- Missing `TextAreaErrorMessage` for validation feedback
- Missing `TextAreaDescription` for helper text

**Impact:**
- Users must manually wrap `TextArea` in `TextFieldRoot` (as seen in BytecodeLoader.tsx)
- Inconsistent API compared to `TextField` component
- Forces consumers to understand the underlying Kobalte structure
- Reduces component reusability and increases coupling

**Evidence:**
```tsx
// Current usage requires manual composition:
<TextFieldRoot>
  <TextArea ... />
</TextFieldRoot>

// Expected usage should be:
<TextAreaRoot>
  <TextAreaLabel>Label</TextAreaLabel>
  <TextArea ... />
  <TextAreaDescription>Helper text</TextAreaDescription>
  <TextAreaErrorMessage>Error message</TextAreaErrorMessage>
</TextAreaRoot>
```

#### H2. Missing Variants and Customization Options
**Severity:** High
**Location:** Lines 8-12, 14-26
**Issue:** The component lacks variant support (using `class-variance-authority`), unlike the `Button` component which demonstrates best practices with `cva()`. There are no size variants, no visual state variants, and limited customization beyond the class prop.

**Impact:**
- Limited flexibility for different use cases (small, medium, large sizes)
- No visual variants for different contexts (error state, success state)
- Every customization requires inline class overrides
- Inconsistent with the pattern established by other components (e.g., Button)

**Suggested Variants:**
```tsx
const textareaVariants = cva(
  'flex w-full rounded-sm border ...',
  {
    variants: {
      size: {
        sm: 'min-h-[40px] px-2 py-1 text-xs',
        md: 'min-h-[60px] px-3 py-2 text-sm',
        lg: 'min-h-[100px] px-4 py-3 text-base'
      },
      variant: {
        default: 'border-input bg-transparent',
        filled: 'border-input bg-muted/50',
        ghost: 'border-transparent'
      }
    },
    defaultVariants: {
      size: 'md',
      variant: 'default'
    }
  }
)
```

### Medium (Priority 3)

#### M1. Inconsistent Type Naming Convention
**Severity:** Medium
**Location:** Line 8
**Issue:** The type is named `textAreaProps` (camelCase) while the component is named `TextArea` (PascalCase). This is inconsistent with TypeScript naming conventions where types typically match their associated component names.

**Current:**
```tsx
type textAreaProps<T extends ValidComponent = 'textarea'> = VoidProps<...>
export const TextArea = <T ...>(props: PolymorphicProps<T, textAreaProps<T>>) => { }
```

**Expected:**
```tsx
type TextAreaProps<T extends ValidComponent = 'textarea'> = VoidProps<...>
export const TextArea = <T ...>(props: PolymorphicProps<T, TextAreaProps<T>>) => { }
```

**Impact:**
- Reduces code readability
- Inconsistent with standard TypeScript conventions
- Makes the codebase appear less professional
- Can confuse IDE auto-completion

#### M2. Missing Component Export Organization
**Severity:** Medium
**Location:** Entire file
**Issue:** Unlike `checkbox.tsx` which exports related primitives from Kobalte, this component doesn't re-export useful TextField primitives, forcing users to import from multiple locations.

**Example from checkbox.tsx:**
```tsx
export const CheckboxLabel = CheckboxPrimitive.Label
export const Checkbox = CheckboxPrimitive
export const CheckboxErrorMessage = CheckboxPrimitive.ErrorMessage
export const CheckboxDescription = CheckboxPrimitive.Description
```

#### M3. Hardcoded Minimum Height
**Severity:** Medium
**Location:** Line 20
**Issue:** The `min-h-[60px]` is hardcoded in the className without a way to override it semantically. This makes it difficult to create smaller or larger textareas without using arbitrary Tailwind classes.

```tsx
'flex min-h-[60px] w-full ...'
```

**Impact:**
- Reduced flexibility for different use cases
- Forces class override hacks like `class="min-h-[100px]"` which may conflict
- Not following responsive design principles (no responsive variants)

#### M4. Missing Resize Control
**Severity:** Medium
**Location:** Line 19-22
**Issue:** The component doesn't provide a way to control the `resize` CSS property. Textareas can be resizable, non-resizable, or resizable only vertically/horizontally. This is a common requirement that should be exposed via props or variants.

**Current state:** Browser default (usually `resize: both`)
**Expected:** Controlled via variant or prop
```tsx
variants: {
  resize: {
    none: 'resize-none',
    vertical: 'resize-y',
    horizontal: 'resize-x',
    both: 'resize'
  }
}
```

### Low (Priority 4)

#### L1. Missing JSDoc Documentation
**Severity:** Low
**Location:** Lines 8-26
**Issue:** No JSDoc comments explaining the component's purpose, props, or usage examples. This reduces developer experience and makes the component harder to discover and understand.

**Expected:**
```tsx
/**
 * TextArea component for multi-line text input
 *
 * @example
 * <TextFieldRoot>
 *   <TextArea placeholder="Enter text..." />
 * </TextFieldRoot>
 *
 * @see https://kobalte.dev/docs/core/components/text-field
 */
```

#### L2. No Accessibility Props Demonstration
**Severity:** Low
**Location:** Entire file
**Issue:** While the component likely inherits accessibility from Kobalte, there's no documentation or examples showing how to use `aria-label`, `aria-describedby`, or other a11y props.

#### L3. Missing Export for Type
**Severity:** Low
**Location:** Line 8-12
**Issue:** The `textAreaProps` type is not exported, preventing consumers from using it for type inference or composition.

**Impact:**
- Reduced TypeScript developer experience
- Can't create wrapper components with proper typing
- Forces type duplication in consuming code

#### L4. No Loading or Disabled State Styling
**Severity:** Low
**Location:** Line 20
**Issue:** While `disabled:cursor-not-allowed disabled:opacity-50` is present, there's no loading state or read-only state styling. The textfield component has similar limitations.

---

## 3. Incomplete Features

1. **Component Family Not Exported**
   - Missing: `TextAreaRoot`, `TextAreaLabel`, `TextAreaDescription`, `TextAreaErrorMessage`
   - Status: Critical gap in component API
   - Comparison: `textfield.tsx` exports all 5 components (Root, Label, Description, ErrorMessage, Input)

2. **Variant System**
   - Missing: Size variants (sm, md, lg)
   - Missing: Visual variants (default, filled, ghost, error)
   - Missing: Resize control variants (none, vertical, horizontal, both)
   - Status: No CVA implementation at all

3. **Character Count Feature**
   - Missing: Max length display (e.g., "150/200")
   - Missing: Visual indicator when approaching limit
   - Status: Common UX pattern not implemented

4. **Auto-resize Capability**
   - Missing: Ability to auto-grow height based on content
   - Status: Would require additional JavaScript/SolidJS logic

5. **Form Integration**
   - Missing: Native form validation display
   - Missing: Required field indicator
   - Status: Relies entirely on Kobalte's built-in support

---

## 4. TODOs

No explicit TODO comments found in the file.

**Implied TODOs (based on analysis):**
- TODO: Export complete component family (Root, Label, Description, ErrorMessage)
- TODO: Implement variant system using CVA
- TODO: Add JSDoc documentation
- TODO: Fix type naming convention (textAreaProps → TextAreaProps)
- TODO: Add character count feature
- TODO: Add auto-resize option
- TODO: Export types for consumers
- TODO: Add comprehensive examples or Storybook stories
- TODO: Add unit tests

---

## 5. Code Quality Issues

### Architecture Issues

1. **Incomplete Component Pattern**
   - **Issue:** Only exports the textarea element, not the complete form field pattern
   - **Best Practice:** Components should be self-contained or clearly document their dependencies
   - **Fix:** Export the full component family or clearly document it's meant to be used with TextFieldRoot

2. **Lack of Separation of Concerns**
   - **Issue:** Styling is inline in JSX rather than extracted to CVA
   - **Best Practice:** Use CVA for variants and complex styling logic
   - **Example:** See `button.tsx` lines 10-34 for proper CVA usage

### TypeScript Issues

1. **Naming Inconsistency**
   - **Issue:** `textAreaProps` should be `TextAreaProps` (PascalCase for types)
   - **Standard:** TypeScript types should use PascalCase
   - **Impact:** Reduces code consistency and professionalism

2. **Type Not Exported**
   - **Issue:** Props type not exported for consumer use
   - **Standard:** Public component types should be exported
   - **Impact:** Prevents proper type composition in consuming code

### Styling Issues

1. **Hardcoded Values**
   - **Issue:** `min-h-[60px]` is hardcoded without semantic control
   - **Best Practice:** Use variants or tokens for dimensional values
   - **Impact:** Reduces flexibility and maintainability

2. **Missing Responsive Design**
   - **Issue:** No responsive variants for mobile/tablet/desktop
   - **Best Practice:** Consider different screen sizes
   - **Example:** Button component has size variants that could be responsive

3. **Inconsistent Border Radius**
   - **Issue:** Uses `rounded-sm` while some components might use different radii
   - **Note:** Check if this is consistent with design system
   - **Verification Needed:** Compare with button, textfield, other inputs

### Documentation Issues

1. **No JSDoc**
   - **Issue:** Zero documentation comments
   - **Impact:** Poor developer experience, no IDE hints
   - **Standard:** All public APIs should have JSDoc

2. **No Usage Examples**
   - **Issue:** No inline examples or reference to examples
   - **Impact:** Developers must reverse-engineer usage from other files
   - **Solution:** Add examples in JSDoc or link to Storybook/docs

3. **No README or Component Documentation**
   - **Issue:** No accompanying documentation file
   - **Note:** This is common for UI component libraries but reduces accessibility

---

## 6. Missing Test Coverage

### Current State
**Test Coverage:** 0%
**Test Files Found:** None
**Test Framework:** Not configured (no test scripts in package.json)

### Required Test Coverage

#### Unit Tests (Missing)

1. **Rendering Tests**
   - Should render without crashing
   - Should render with custom className
   - Should merge classes correctly using cn()
   - Should pass through all props to underlying primitive

2. **Props Tests**
   - Should accept and render placeholder
   - Should accept and render value
   - Should handle controlled input (value + onInput)
   - Should handle uncontrolled input (defaultValue)
   - Should accept custom id attribute
   - Should accept aria-* attributes

3. **Styling Tests**
   - Should apply base styles
   - Should merge custom className with base styles
   - Should maintain focus-visible ring styling
   - Should apply disabled styles when disabled
   - Should handle placeholder styling

4. **Type Safety Tests**
   - Should accept valid HTML textarea attributes
   - Should work with polymorphic component prop
   - Should enforce correct prop types

5. **Accessibility Tests**
   - Should have proper role (implicit textarea role)
   - Should support aria-label
   - Should support aria-describedby
   - Should support aria-invalid for error states
   - Should be keyboard navigable

#### Integration Tests (Missing)

1. **Form Integration**
   - Should work within TextFieldRoot
   - Should work with TextFieldLabel
   - Should work with TextFieldErrorMessage
   - Should work with TextFieldDescription
   - Should integrate with form submission

2. **User Interaction Tests**
   - Should handle typing input
   - Should handle paste events
   - Should handle focus/blur events
   - Should trigger onInput callback
   - Should handle keyboard navigation (Tab, Shift+Tab)

3. **State Management Tests**
   - Should work as controlled component
   - Should work as uncontrolled component
   - Should handle state changes correctly

#### Visual Regression Tests (Missing)

1. **Default State**
2. **Focused State**
3. **Disabled State**
4. **Error State (with TextFieldErrorMessage)**
5. **With Placeholder**
6. **With Content**
7. **Different Sizes (when implemented)**

### Testing Recommendations

1. **Add Vitest Configuration**
   ```json
   "scripts": {
     "test": "vitest",
     "test:ui": "vitest --ui",
     "test:coverage": "vitest --coverage"
   },
   "devDependencies": {
     "vitest": "^1.0.0",
     "@vitest/ui": "^1.0.0",
     "@solidjs/testing-library": "^0.8.0",
     "@testing-library/user-event": "^14.0.0"
   }
   ```

2. **Add Testing Library**
   - Use `@solidjs/testing-library` for component testing
   - Use `@testing-library/user-event` for interaction testing
   - Use `vitest-axe` for accessibility testing

3. **Create Test File Structure**
   ```
   /Users/williamcory/chop/ui/solid/components/ui/__tests__/
     textarea.test.tsx
     textarea.accessibility.test.tsx
     textarea.integration.test.tsx
   ```

4. **Add Visual Testing**
   - Consider Storybook + Chromatic for visual regression
   - Or use Playwright for E2E visual testing

---

## 7. Recommendations

### Immediate (High Priority)

1. **Complete the Component Family** [CRITICAL]
   - Export `TextAreaRoot`, `TextAreaLabel`, `TextAreaDescription`, `TextAreaErrorMessage`
   - Follow the pattern established by `textfield.tsx`
   - Maintain consistency across the component library
   - Estimated effort: 2-3 hours

2. **Fix Type Naming Convention** [HIGH]
   - Rename `textAreaProps` → `TextAreaProps`
   - Export the type for consumer use
   - Update any internal references
   - Estimated effort: 15 minutes

3. **Add Variant System** [HIGH]
   - Implement CVA for size variants (sm, md, lg)
   - Add resize control variants (none, vertical, horizontal, both)
   - Consider visual variants (default, filled, ghost)
   - Follow the button.tsx pattern
   - Estimated effort: 1-2 hours

### Short-term (Medium Priority)

4. **Add Comprehensive Documentation** [MEDIUM]
   - Add JSDoc comments with examples
   - Document all props and their effects
   - Add usage examples
   - Link to Kobalte documentation
   - Estimated effort: 1 hour

5. **Improve Flexibility** [MEDIUM]
   - Remove hardcoded min-height or make it a variant
   - Add responsive design considerations
   - Consider auto-resize feature (optional)
   - Estimated effort: 2-3 hours

6. **Add Test Coverage** [MEDIUM]
   - Set up Vitest configuration
   - Add unit tests (80%+ coverage target)
   - Add accessibility tests
   - Add integration tests with TextFieldRoot
   - Estimated effort: 4-6 hours

### Long-term (Low Priority)

7. **Add Advanced Features** [LOW]
   - Character count display
   - Auto-resize capability
   - Syntax highlighting support (for code input)
   - Markdown preview mode
   - Estimated effort: Variable (2-8 hours depending on scope)

8. **Create Storybook Stories** [LOW]
   - Add interactive examples
   - Document all variants and states
   - Enable visual testing
   - Estimated effort: 2-3 hours

9. **Performance Optimization** [LOW]
   - Profile render performance with large text
   - Consider virtualization for very large content
   - Optimize class merging
   - Estimated effort: 1-2 hours (if needed)

### Code Example: Recommended Complete Implementation

```tsx
import type { PolymorphicProps } from '@kobalte/core/polymorphic'
import type {
  TextFieldDescriptionProps,
  TextFieldErrorMessageProps,
  TextFieldLabelProps,
  TextFieldRootProps,
  TextFieldTextAreaProps,
} from '@kobalte/core/text-field'
import { TextArea as TextFieldPrimitive } from '@kobalte/core/text-field'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ValidComponent, VoidProps } from 'solid-js'
import { splitProps } from 'solid-js'
import { cn } from '~/lib/cn'

// Export TextField primitives for convenience
export const TextFieldPrimitive as TextAreaPrimitive

// Root component
type TextAreaRootProps<T extends ValidComponent = 'div'> = TextFieldRootProps<T> & {
  class?: string
}

/**
 * Root container for TextArea component group
 */
export const TextAreaRoot = <T extends ValidComponent = 'div'>(
  props: PolymorphicProps<T, TextAreaRootProps<T>>
) => {
  const [local, rest] = splitProps(props as TextAreaRootProps, ['class'])
  return <TextFieldPrimitive class={cn('space-y-1', local.class)} {...rest} />
}

// Label component
type TextAreaLabelProps<T extends ValidComponent = 'label'> = TextFieldLabelProps<T> & {
  class?: string
}

export const textareaLabel = cva(
  'text-sm data-[disabled]:cursor-not-allowed data-[disabled]:opacity-70 font-medium',
  {
    variants: {
      label: {
        true: 'data-[invalid]:text-destructive',
      },
      error: {
        true: 'text-destructive text-xs',
      },
      description: {
        true: 'font-normal text-muted-foreground',
      },
    },
    defaultVariants: {
      label: true,
    },
  }
)

/**
 * Label for TextArea component
 */
export const TextAreaLabel = <T extends ValidComponent = 'label'>(
  props: PolymorphicProps<T, TextAreaLabelProps<T>>
) => {
  const [local, rest] = splitProps(props as TextAreaLabelProps, ['class'])
  return <TextFieldPrimitive.Label class={cn(textareaLabel(), local.class)} {...rest} />
}

// Error message component
type TextAreaErrorMessageProps<T extends ValidComponent = 'div'> = TextFieldErrorMessageProps<T> & {
  class?: string
}

/**
 * Error message for TextArea validation
 */
export const TextAreaErrorMessage = <T extends ValidComponent = 'div'>(
  props: PolymorphicProps<T, TextAreaErrorMessageProps<T>>
) => {
  const [local, rest] = splitProps(props as TextAreaErrorMessageProps, ['class'])
  return (
    <TextFieldPrimitive.ErrorMessage
      class={cn(textareaLabel({ error: true }), local.class)}
      {...rest}
    />
  )
}

// Description component
type TextAreaDescriptionProps<T extends ValidComponent = 'div'> = TextFieldDescriptionProps<T> & {
  class?: string
}

/**
 * Helper text/description for TextArea
 */
export const TextAreaDescription = <T extends ValidComponent = 'div'>(
  props: PolymorphicProps<T, TextAreaDescriptionProps<T>>
) => {
  const [local, rest] = splitProps(props as TextAreaDescriptionProps, ['class'])
  return (
    <TextFieldPrimitive.Description
      class={cn(textareaLabel({ description: true, label: false }), local.class)}
      {...rest}
    />
  )
}

// Main TextArea component with variants
export const textareaVariants = cva(
  'flex w-full rounded-sm border border-input bg-transparent text-sm shadow-sm transition-shadow placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      size: {
        sm: 'min-h-[40px] px-2 py-1 text-xs',
        md: 'min-h-[60px] px-3 py-2 text-sm',
        lg: 'min-h-[100px] px-4 py-3 text-base',
      },
      resize: {
        none: 'resize-none',
        vertical: 'resize-y',
        horizontal: 'resize-x',
        both: 'resize',
      },
    },
    defaultVariants: {
      size: 'md',
      resize: 'vertical',
    },
  }
)

type TextAreaProps<T extends ValidComponent = 'textarea'> = VoidProps<
  TextFieldTextAreaProps<T> &
    VariantProps<typeof textareaVariants> & {
      class?: string
    }
>

/**
 * Multi-line text input component
 *
 * @example
 * <TextAreaRoot>
 *   <TextAreaLabel>Description</TextAreaLabel>
 *   <TextArea placeholder="Enter description..." />
 *   <TextAreaDescription>Provide a detailed description</TextAreaDescription>
 * </TextAreaRoot>
 *
 * @see https://kobalte.dev/docs/core/components/text-field
 */
export const TextArea = <T extends ValidComponent = 'textarea'>(
  props: PolymorphicProps<T, TextAreaProps<T>>
) => {
  const [local, rest] = splitProps(props as TextAreaProps, ['class', 'size', 'resize'])

  return (
    <TextFieldPrimitive
      class={cn(
        textareaVariants({
          size: local.size,
          resize: local.resize,
        }),
        local.class
      )}
      {...rest}
    />
  )
}

// Export types for consumers
export type {
  TextAreaProps,
  TextAreaRootProps,
  TextAreaLabelProps,
  TextAreaErrorMessageProps,
  TextAreaDescriptionProps,
}
```

---

## Summary

The `textarea.tsx` component is a minimal but functional implementation that wraps Kobalte's TextField.TextArea primitive. While it works for basic use cases, it has several significant gaps:

**Strengths:**
- Clean, simple implementation
- Proper integration with Kobalte
- Good base styling with Tailwind
- Accessibility support through Kobalte

**Critical Weaknesses:**
- Incomplete component family (missing Root, Label, Description, ErrorMessage)
- No variant system implementation
- Poor naming conventions (camelCase type name)
- Zero test coverage
- No documentation

**Priority Actions:**
1. Complete the component family exports (CRITICAL)
2. Fix type naming and export types (HIGH)
3. Implement CVA variant system (HIGH)
4. Add comprehensive tests (MEDIUM)
5. Add JSDoc documentation (MEDIUM)

**Estimated Total Effort for Full Remediation:** 12-20 hours

This component requires moderate refactoring to bring it up to production quality standards and consistency with the rest of the component library. The good news is that the foundation is solid, and the Kobalte integration provides excellent accessibility out of the box. The main work is expanding the API surface and adding proper testing and documentation.
