# Code Review: sonner.tsx

**File Path:** `/Users/williamcory/chop/ui/solid/components/ui/sonner.tsx`
**Review Date:** 2025-10-26
**Lines of Code:** 20

---

## 1. File Overview

The `sonner.tsx` file provides a thin wrapper around the `solid-sonner` library's `Toaster` component, applying custom styling to match the application's design system. It serves as the centralized toast notification renderer for the entire application.

**Purpose:** UI component wrapper for toast notifications
**Framework:** SolidJS
**Dependencies:**
- `solid-sonner` (external library for toast notifications)

**Key Features:**
- Wraps the solid-sonner `Toaster` component
- Applies CSS classes for theming (background, text, border, shadow)
- Configures toast options with consistent styling
- Forwards all props to the underlying `Sonner` component
- Uses design system tokens (background, foreground, border, primary, muted)

**Usage Pattern:**
```tsx
// In App.tsx
import { Toaster } from '~/components/ui/sonner'

function App() {
  return (
    <>
      <YourComponents />
      <Toaster />  {/* Renders all toast notifications */}
    </>
  )
}

// Anywhere in the app
import { toast } from 'solid-sonner'

toast.info('Operation completed')
toast.success('Data saved successfully')
toast.error('An error occurred')
```

---

## 2. Issues Found

### Critical Issues

None found. The component is minimal and serves its purpose correctly.

### High Issues

#### H1. Missing Theme Integration
**Severity:** HIGH
**Impact:** Toast notifications may not adapt to light/dark mode changes

**Current Implementation:**
```tsx
<Sonner
  class="toaster group"
  toastOptions={{
    classes: {
      toast: 'group toast group-[.toaster]:bg-background ...',
      // ...
    },
  }}
  {...props}
/>
```

**Problem:**
The component relies solely on CSS class-based theming without explicitly handling theme prop. The solid-sonner library supports a `theme` prop (light/dark/system), but it's not configured here.

**Observed in App.tsx (lines 123-128):**
```tsx
createEffect(() => {
  if (isDarkMode()) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
})
```

The app manages dark mode via CSS classes on `document.documentElement`, which should propagate to the toasts via the `bg-background` and `text-foreground` classes. However, this is implicit rather than explicit.

**Recommendation:**
Consider adding explicit theme support:
```tsx
export const Toaster = (props: Parameters<typeof Sonner>[0]) => {
  // Option 1: Let the library handle it
  return (
    <Sonner
      theme="system"  // or pass from props
      class="toaster group"
      toastOptions={{ /* ... */ }}
      {...props}
    />
  )
}

// Option 2: Sync with app theme
import { useContext } from 'solid-js'
import { ThemeContext } from '~/contexts/theme'  // if exists

export const Toaster = (props: Parameters<typeof Sonner>[0]) => {
  const theme = useContext(ThemeContext)
  return (
    <Sonner
      theme={theme}
      class="toaster group"
      toastOptions={{ /* ... */ }}
      {...props}
    />
  )
}
```

#### H2. No Position Configuration
**Severity:** HIGH
**Impact:** Toast position is hardcoded to library default (bottom-right), no flexibility

**Problem:**
The solid-sonner library supports positioning via the `position` prop:
- `top-left`, `top-center`, `top-right`
- `bottom-left`, `bottom-center`, `bottom-right`

Current implementation uses the library default without allowing customization.

**Recommendation:**
```tsx
export const Toaster = (props: Parameters<typeof Sonner>[0]) => {
  return (
    <Sonner
      position="bottom-right"  // Make explicit
      class="toaster group"
      toastOptions={{ /* ... */ }}
      {...props}
    />
  )
}

// Or allow override via props
export const Toaster = (props: Parameters<typeof Sonner>[0]) => {
  return (
    <Sonner
      position={props.position || 'bottom-right'}
      class="toaster group"
      toastOptions={{ /* ... */ }}
      {...props}
    />
  )
}
```

### Medium Issues

#### M1. Generic Parameter Type Usage
**Severity:** MEDIUM
**Impact:** Type inference could be more explicit and maintainable

**Current Implementation:**
```tsx
export const Toaster = (props: Parameters<typeof Sonner>[0]) => {
```

**Problems:**
1. `Parameters<typeof Sonner>[0]` is a utility type that extracts props but is not self-documenting
2. Harder to understand what props are available without checking source
3. Less IDE autocomplete support compared to explicit interface
4. Doesn't allow extending or constraining props easily

**Recommendation:**
```tsx
import { Toaster as Sonner, type ToasterProps } from 'solid-sonner'

export const Toaster = (props: ToasterProps) => {
  return (
    <Sonner
      class="toaster group"
      toastOptions={{
        classes: {
          toast: '...',
          description: '...',
          actionButton: '...',
          cancelButton: '...',
        },
      }}
      {...props}
    />
  )
}

// Or create custom interface
interface CustomToasterProps extends ToasterProps {
  // Add custom props if needed
}

export const Toaster = (props: CustomToasterProps) => {
  // ...
}
```

**Note:** If `ToasterProps` is not exported by solid-sonner, the current approach is acceptable but should be documented.

#### M2. Missing Props Defaults and Configuration
**Severity:** MEDIUM
**Impact:** Limited customization, requires direct component usage for advanced features

**Available Features Not Exposed:**
Based on solid-sonner documentation, these props are available but not explicitly configured:
- `richColors` - Makes error/success states more colorful
- `closeButton` - Adds close button to all toasts
- `duration` - Default toast duration (ms)
- `expand` - Whether toasts expand on hover
- `visibleToasts` - Max number of visible toasts
- `offset` - Viewport offset

**Current Usage in Codebase:**
Only basic `toast.info()` calls found:
```tsx
// Memory.tsx, Stack.tsx, Storage.tsx, LogsAndReturn.tsx
toast.info(<>Item at position <Code>{position}</Code> copied to clipboard</>)
```

**Recommendation:**
Add sensible defaults:
```tsx
export const Toaster = (props: Parameters<typeof Sonner>[0]) => {
  return (
    <Sonner
      richColors
      closeButton
      duration={4000}
      position="bottom-right"
      class="toaster group"
      toastOptions={{
        classes: {
          toast: 'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
      {...props}
    />
  )
}
```

#### M3. No TypeScript Documentation
**Severity:** MEDIUM
**Impact:** Reduced developer experience, unclear component contract

**Current State:**
No JSDoc comments, no inline documentation, no usage examples.

**Recommendation:** See Section 7 for detailed documentation examples.

#### M4. Tightly Coupled CSS Classes
**Severity:** MEDIUM
**Impact:** Hard to maintain, difficult to customize per-instance

**Current Implementation:**
```tsx
toast: 'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
```

**Problems:**
1. Long CSS class strings are hard to read and maintain
2. Uses Tailwind's arbitrary group selector syntax extensively
3. No way to override classes without replacing entire component
4. Mixing of structural and theme classes

**Recommendation:**
```tsx
// Extract to constants for maintainability
const TOAST_CLASSES = {
  toast: [
    'group toast',
    'group-[.toaster]:bg-background',
    'group-[.toaster]:text-foreground',
    'group-[.toaster]:border-border',
    'group-[.toaster]:shadow-lg',
  ].join(' '),
  description: 'group-[.toast]:text-muted-foreground',
  actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
  cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
} as const

export const Toaster = (props: Parameters<typeof Sonner>[0]) => {
  return (
    <Sonner
      class="toaster group"
      toastOptions={{
        classes: TOAST_CLASSES,
      }}
      {...props}
    />
  )
}

// Or allow class customization
export const Toaster = (props: Parameters<typeof Sonner>[0]) => {
  const defaultClasses = TOAST_CLASSES
  const customClasses = props.toastOptions?.classes || {}

  return (
    <Sonner
      class="toaster group"
      toastOptions={{
        ...props.toastOptions,
        classes: {
          ...defaultClasses,
          ...customClasses,
        },
      }}
      {...props}
    />
  )
}
```

### Low Issues

#### L1. No Export of toast Function
**Severity:** LOW
**Impact:** Minor inconvenience - users must import from solid-sonner directly

**Current Pattern:**
```tsx
// In any component
import { toast } from 'solid-sonner'  // Direct import from library
```

**Alternative Approach:**
```tsx
// In sonner.tsx
export { toast } from 'solid-sonner'

// In any component
import { toast } from '~/components/ui/sonner'  // Centralized import
```

**Pros of Re-exporting:**
- Centralized import path for consistency
- Easier to mock in tests
- Could add custom toast helpers

**Cons:**
- Adds another layer of indirection
- Standard pattern in SolidJS is direct library import

**Verdict:** Current approach is acceptable, but re-exporting would improve consistency with other UI components.

#### L2. Missing Component Display Name
**Severity:** LOW
**Impact:** Debugging experience - component shows as anonymous in dev tools

**Recommendation:**
```tsx
export const Toaster = (props: Parameters<typeof Sonner>[0]) => {
  return (
    <Sonner
      class="toaster group"
      toastOptions={{
        classes: {
          toast: '...',
          description: '...',
          actionButton: '...',
          cancelButton: '...',
        },
      }}
      {...props}
    />
  )
}

// Add display name for debugging
Toaster.displayName = 'Toaster'
```

**Note:** SolidJS doesn't require display names as much as React, but it can help with debugging.

#### L3. No Loading State Configuration
**Severity:** LOW
**Impact:** Missing feature - loading toasts not configured

**Feature Available:**
solid-sonner supports loading state toasts:
```tsx
const toastId = toast.loading('Loading...')
// Later
toast.success('Done!', { id: toastId })
```

**Recommendation:** Document this feature or provide helper:
```tsx
export const createLoadingToast = (message: string) => {
  return toast.loading(message)
}

export const updateToast = (id: string | number, message: string, type: 'success' | 'error') => {
  if (type === 'success') {
    toast.success(message, { id })
  } else {
    toast.error(message, { id })
  }
}
```

#### L4. No Toast Action Buttons Configured
**Severity:** LOW
**Impact:** Missing feature - action/cancel buttons not used

**Feature Available:**
solid-sonner supports action and cancel buttons:
```tsx
toast('Event created', {
  action: {
    label: 'Undo',
    onClick: () => console.log('Undo'),
  },
  cancel: {
    label: 'Dismiss',
    onClick: () => console.log('Dismissed'),
  },
})
```

**Current State:** CSS classes are configured (`actionButton`, `cancelButton`) but no documented usage.

**Recommendation:** Add examples or helpers in documentation.

---

## 3. Incomplete Features

### Rich Toast Types Not Utilized

**What's Missing:**
The component configures styling for action and cancel buttons but there's no usage in the codebase.

**Current Usage Pattern:**
```tsx
// Only basic info toasts found
toast.info('Message')
```

**Available But Unused:**
```tsx
toast.success('Success message')
toast.error('Error message')
toast.warning('Warning message')
toast.promise(promise, {
  loading: 'Loading...',
  success: 'Success!',
  error: 'Error occurred',
})
```

**Recommendation:** Document available toast types and create examples.

### No Custom Toast Component

**What's Missing:**
The ability to render custom JSX content in toasts is available but not utilized effectively.

**Current Usage:**
```tsx
toast.info(<>Item at position <Code>{position}</Code> copied to clipboard</>)
```

**Potential Enhancement:**
```tsx
// Create reusable toast components
export const CopySuccessToast = ({ position, item }: { position: string; item: string }) => (
  <div class="flex items-center gap-2">
    <CheckIcon class="h-4 w-4" />
    <div>
      Item at <Code>{position}</Code> copied
    </div>
  </div>
)

// Usage
toast.success(<CopySuccessToast position={pos} item={value} />)
```

### No Toast Queue Management

**What's Missing:**
Configuration for toast behavior when multiple toasts appear:
- Max visible toasts
- Queuing behavior
- Stacking/expanding options

**Recommendation:**
```tsx
export const Toaster = (props: Parameters<typeof Sonner>[0]) => {
  return (
    <Sonner
      visibleToasts={3}
      expand={true}
      class="toaster group"
      toastOptions={{ /* ... */ }}
      {...props}
    />
  )
}
```

### No Error Boundary Integration

**What's Missing:**
Integration with global error handling to automatically show error toasts.

**Potential Enhancement:**
```tsx
// In a global error handler or error boundary
window.addEventListener('unhandledrejection', (event) => {
  toast.error(`Unhandled error: ${event.reason.message}`)
})
```

---

## 4. TODOs

**Status:** No explicit TODO, FIXME, XXX, HACK, or BUG comments found in sonner.tsx.

**Implicit TODOs** (derived from analysis):

1. **TODO:** Add explicit theme prop integration (light/dark/system)
2. **TODO:** Expose position configuration with sensible default
3. **TODO:** Add richColors and closeButton props for better UX
4. **TODO:** Extract CSS classes to constants for maintainability
5. **TODO:** Add JSDoc documentation with usage examples
6. **TODO:** Re-export toast function for consistency
7. **TODO:** Add unit tests for component rendering
8. **TODO:** Add integration tests with toast functionality
9. **TODO:** Document available toast types and features
10. **TODO:** Consider creating toast helper utilities
11. **TODO:** Add examples of custom toast content
12. **TODO:** Configure toast queue management (visibleToasts, expand)

---

## 5. Code Quality Issues

### Architecture Issues

#### A1. Minimal Wrapper Without Value-Add
**Issue:** The component is essentially a pass-through with only styling configuration.

**Analysis:**
While this is acceptable for a simple wrapper, it doesn't provide much value beyond applying CSS classes. Consider whether additional features (theme management, helper functions, standardized toast patterns) would justify the wrapper.

**Current Value:**
- Applies consistent styling
- Centralizes toast configuration
- Single import point (if used consistently)

**Potential Value:**
- Theme integration
- Custom toast helpers
- Error handling integration
- Analytics tracking
- Toast history/debugging

#### A2. No Separation Between Style and Logic
**Issue:** Styling and component logic are mixed in a single file.

**Impact:** Minor - the file is small, but for larger components, this would be problematic.

**Recommendation:** For consistency with larger UI components, consider:
```tsx
// sonner.styles.ts
export const TOAST_CLASSES = {
  toast: '...',
  description: '...',
  actionButton: '...',
  cancelButton: '...',
} as const

// sonner.tsx
import { TOAST_CLASSES } from './sonner.styles'
```

### Code Smells

#### CS1. Magic String: "toaster group"
**Location:** Line 6
```tsx
class="toaster group"
```

**Issue:** Hardcoded class string that's essential for the group selector pattern.

**Impact:** Low - changing this would break the entire styling system.

**Recommendation:** Extract to constant:
```tsx
const TOASTER_CONTAINER_CLASS = 'toaster group'

export const Toaster = (props: Parameters<typeof Sonner>[0]) => {
  return (
    <Sonner
      class={TOASTER_CONTAINER_CLASS}
      toastOptions={{ /* ... */ }}
      {...props}
    />
  )
}
```

#### CS2. Deep Tailwind Group Selectors
**Location:** Lines 9-13
```tsx
'group-[.toaster]:bg-background'
'group-[.toast]:text-muted-foreground'
```

**Issue:** Uses Tailwind's arbitrary variant syntax which can be fragile and hard to understand.

**Analysis:**
This is necessary for the nested theming pattern but makes the code less readable. The pattern is:
- `.toaster` is the container class
- `.toast` is each individual toast
- `group-[.toaster]` targets elements within .toaster
- `group-[.toast]` targets elements within .toast

**Recommendation:** Add comments explaining the pattern:
```tsx
toastOptions={{
  classes: {
    // Individual toast styling - uses .toaster container context
    toast: 'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground ...',

    // Description text - uses .toast context
    description: 'group-[.toast]:text-muted-foreground',

    // Action button - primary styling within toast
    actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',

    // Cancel button - muted styling within toast
    cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
  },
}}
```

### Best Practice Violations

#### BP1. No Component Documentation
**Issue:** Missing JSDoc comments explaining purpose, usage, and props.

**Impact:** Developers must read source code or library documentation to understand usage.

**Recommendation:** See Section 7 for complete JSDoc example.

#### BP2. No Prop Validation
**Issue:** Accepts all props from library without validation or documentation.

**Impact:** Low - TypeScript provides compile-time safety, but runtime validation could catch issues.

**Note:** This is typical for wrapper components in TypeScript projects.

#### BP3. Not Following shadcn/ui Patterns Consistently
**Issue:** Compared to other UI components (Button, Card, Badge), this component:
- Doesn't split props using `splitProps`
- Doesn't use `cn()` utility for class merging
- Doesn't define variant patterns

**Analysis:**
The Toaster component is different from typical UI primitives:
- It's a singleton (one instance per app)
- It's not directly styled via props
- Styling happens via `toastOptions.classes`

**Recommendation:** This is acceptable given the component's nature, but document why it differs from the pattern.

### Performance Considerations

#### Positive Aspects
- Extremely lightweight component
- No state management
- No expensive computations
- Renders once at app root
- No re-renders (no reactive dependencies)

#### Potential Issues

**None identified.** The component is optimal from a performance perspective.

### Type Safety

#### Positive Aspects
- Strong typing via TypeScript
- Uses library's type definitions
- Type-safe prop spreading

#### Potential Issues

1. **Implicit Type from Parameters Utility**
```tsx
props: Parameters<typeof Sonner>[0]
```

While type-safe, this is not self-documenting. Developers need to check the library source to see available props.

**Recommendation:** If `ToasterProps` is exported by solid-sonner, use it explicitly:
```tsx
import { Toaster as Sonner, type ToasterProps } from 'solid-sonner'

export const Toaster = (props: ToasterProps) => {
  // ...
}
```

2. **No Custom Prop Constraints**

If you wanted to restrict certain props or add custom ones, the current type doesn't allow it easily.

**Example Enhancement:**
```tsx
type CustomToasterProps = Omit<Parameters<typeof Sonner>[0], 'theme'> & {
  theme?: 'light' | 'dark'  // Restrict to specific values
}

export const Toaster = (props: CustomToasterProps) => {
  // ...
}
```

### Consistency Issues

#### Comparison with Other UI Components

**Button.tsx Pattern:**
```tsx
export const Button = <T extends ValidComponent = 'button'>(
  props: PolymorphicProps<T, buttonProps<T>>
) => {
  const [local, rest] = splitProps(props as buttonProps, ['class', 'variant', 'size'])
  return <ButtonPrimitive class={cn(buttonVariants({ ... }), local.class)} {...rest} />
}
```

**Badge.tsx Pattern:**
```tsx
export const Badge = (props: ComponentProps<'div'> & VariantProps<typeof badgeVariants>) => {
  const [local, rest] = splitProps(props, ['class', 'variant'])
  return <div class={cn(badgeVariants({ variant: local.variant }), local.class)} {...rest} />
}
```

**Card.tsx Pattern:**
```tsx
export const Card = (props: ComponentProps<'div'>) => {
  const [local, rest] = splitProps(props, ['class'])
  return <div class={cn('rounded-sm border bg-card ...', local.class)} {...rest} />
}
```

**Sonner.tsx Pattern:**
```tsx
export const Toaster = (props: Parameters<typeof Sonner>[0]) => {
  return <Sonner class="toaster group" toastOptions={{ classes: { ... } }} {...props} />
}
```

**Analysis:**
- Button, Badge, Card: Use `splitProps` to extract and handle specific props
- Button, Badge: Use `cva` (class-variance-authority) for variant management
- Button, Badge, Card: Use `cn()` utility for class merging
- **Sonner: Uses none of these patterns**

**Verdict:**
This inconsistency is **acceptable** because:
1. Toaster is not a typical UI primitive (it's a singleton container)
2. Styling is applied via `toastOptions.classes`, not directly on the component
3. No variant system is needed (toasts themselves have variants, not the container)
4. The `class` prop is used for the container, not for dynamic styling

However, it would be helpful to document why this component differs from the standard pattern.

---

## 6. Missing Test Coverage

### Current State
- **Unit Tests:** None (0% coverage)
- **Integration Tests:** None
- **E2E Tests:** Unknown (likely tests toast usage in larger app tests)
- **Test Files Found:** No test files found in `/Users/williamcory/chop/ui/solid/components/ui/` or `/Users/williamcory/chop/ui/solid/` directories

### Required Test Cases

#### Unit Tests (Component Behavior)

```typescript
import { render } from '@solidjs/testing-library'
import { describe, it, expect, vi } from 'vitest'
import { Toaster } from './sonner'

describe('Toaster Component', () => {
  describe('Rendering', () => {
    it('should render without crashing', () => {
      const { container } = render(() => <Toaster />)
      expect(container).toBeTruthy()
    })

    it('should apply toaster group class', () => {
      const { container } = render(() => <Toaster />)
      const toaster = container.querySelector('.toaster')
      expect(toaster).toBeTruthy()
      expect(toaster?.classList.contains('group')).toBe(true)
    })

    it('should apply custom class from props', () => {
      const { container } = render(() => <Toaster class="custom-class" />)
      // Note: This depends on how solid-sonner handles the class prop
      // May need to check differently
    })

    it('should forward props to Sonner component', () => {
      const { container } = render(() => <Toaster position="top-right" />)
      // Verify position is applied (implementation-dependent)
    })
  })

  describe('Toast Options', () => {
    it('should configure toast classes', () => {
      // This is tricky to test since classes are applied to toasts, not the container
      // May need to trigger a toast and check its classes
      const { container } = render(() => <Toaster />)

      // Trigger a test toast
      const { toast } = await import('solid-sonner')
      toast.info('Test message')

      // Wait for toast to appear
      await waitFor(() => {
        const toastElement = container.querySelector('.toast')
        expect(toastElement).toBeTruthy()
      })

      const toastElement = container.querySelector('.toast')
      expect(toastElement?.classList.contains('group')).toBe(true)
    })

    it('should apply background color class to toasts', () => {
      // Similar to above, trigger toast and verify styling
    })

    it('should apply text color class to toasts', () => {
      // Trigger toast and verify text styling
    })

    it('should apply border class to toasts', () => {
      // Trigger toast and verify border styling
    })

    it('should apply shadow class to toasts', () => {
      // Trigger toast and verify shadow styling
    })
  })

  describe('Props Forwarding', () => {
    it('should forward position prop', () => {
      render(() => <Toaster position="top-center" />)
      // Verify position is set correctly
    })

    it('should forward theme prop', () => {
      render(() => <Toaster theme="dark" />)
      // Verify theme is applied
    })

    it('should forward richColors prop', () => {
      render(() => <Toaster richColors />)
      // Verify rich colors are enabled
    })

    it('should forward closeButton prop', () => {
      render(() => <Toaster closeButton />)
      // Trigger toast and verify close button appears
    })

    it('should forward duration prop', () => {
      render(() => <Toaster duration={5000} />)
      // Trigger toast and verify custom duration
    })
  })

  describe('Edge Cases', () => {
    it('should handle undefined props gracefully', () => {
      expect(() => render(() => <Toaster />)).not.toThrow()
    })

    it('should handle null props gracefully', () => {
      // @ts-expect-error - testing runtime behavior
      expect(() => render(() => <Toaster class={null} />)).not.toThrow()
    })

    it('should handle empty toastOptions override', () => {
      render(() => <Toaster toastOptions={{}} />)
      // Verify default classes are still applied
    })
  })
})
```

#### Integration Tests (With Toast Functionality)

```typescript
import { render, screen, waitFor } from '@solidjs/testing-library'
import { describe, it, expect, vi } from 'vitest'
import { Toaster } from './sonner'
import { toast } from 'solid-sonner'

describe('Toaster Integration', () => {
  describe('Toast Display', () => {
    it('should display info toast', async () => {
      render(() => <Toaster />)

      toast.info('Test info message')

      await waitFor(() => {
        expect(screen.getByText('Test info message')).toBeInTheDocument()
      })
    })

    it('should display success toast', async () => {
      render(() => <Toaster />)

      toast.success('Success message')

      await waitFor(() => {
        expect(screen.getByText('Success message')).toBeInTheDocument()
      })
    })

    it('should display error toast', async () => {
      render(() => <Toaster />)

      toast.error('Error message')

      await waitFor(() => {
        expect(screen.getByText('Error message')).toBeInTheDocument()
      })
    })

    it('should display warning toast', async () => {
      render(() => <Toaster />)

      toast.warning('Warning message')

      await waitFor(() => {
        expect(screen.getByText('Warning message')).toBeInTheDocument()
      })
    })

    it('should display loading toast', async () => {
      render(() => <Toaster />)

      const loadingId = toast.loading('Loading...')

      await waitFor(() => {
        expect(screen.getByText('Loading...')).toBeInTheDocument()
      })

      toast.success('Done!', { id: loadingId })

      await waitFor(() => {
        expect(screen.getByText('Done!')).toBeInTheDocument()
      })
    })
  })

  describe('Custom Content', () => {
    it('should display JSX content', async () => {
      render(() => <Toaster />)

      toast.info(<div data-testid="custom-content">Custom JSX</div>)

      await waitFor(() => {
        expect(screen.getByTestId('custom-content')).toBeInTheDocument()
        expect(screen.getByText('Custom JSX')).toBeInTheDocument()
      })
    })

    it('should display complex JSX with components', async () => {
      render(() => <Toaster />)

      const Code = ({ children }) => <code>{children}</code>

      toast.info(
        <>
          Item at <Code>0x00</Code> copied
        </>
      )

      await waitFor(() => {
        expect(screen.getByText('Item at')).toBeInTheDocument()
        expect(screen.getByText('0x00')).toBeInTheDocument()
      })
    })
  })

  describe('Toast Actions', () => {
    it('should display action button', async () => {
      render(() => <Toaster />)

      const onAction = vi.fn()

      toast('Message', {
        action: {
          label: 'Undo',
          onClick: onAction,
        },
      })

      await waitFor(() => {
        expect(screen.getByText('Undo')).toBeInTheDocument()
      })

      screen.getByText('Undo').click()
      expect(onAction).toHaveBeenCalledTimes(1)
    })

    it('should display cancel button', async () => {
      render(() => <Toaster />)

      const onCancel = vi.fn()

      toast('Message', {
        cancel: {
          label: 'Dismiss',
          onClick: onCancel,
        },
      })

      await waitFor(() => {
        expect(screen.getByText('Dismiss')).toBeInTheDocument()
      })

      screen.getByText('Dismiss').click()
      expect(onCancel).toHaveBeenCalledTimes(1)
    })
  })

  describe('Multiple Toasts', () => {
    it('should display multiple toasts simultaneously', async () => {
      render(() => <Toaster />)

      toast.info('First toast')
      toast.info('Second toast')
      toast.info('Third toast')

      await waitFor(() => {
        expect(screen.getByText('First toast')).toBeInTheDocument()
        expect(screen.getByText('Second toast')).toBeInTheDocument()
        expect(screen.getByText('Third toast')).toBeInTheDocument()
      })
    })

    it('should limit visible toasts when visibleToasts is set', async () => {
      render(() => <Toaster visibleToasts={2} />)

      toast.info('Toast 1')
      toast.info('Toast 2')
      toast.info('Toast 3')

      await waitFor(() => {
        const toasts = screen.queryAllByText(/Toast \d/)
        expect(toasts.length).toBeLessThanOrEqual(2)
      })
    })
  })

  describe('Theming', () => {
    it('should apply light theme classes', async () => {
      render(() => <Toaster theme="light" />)

      toast.info('Test')

      await waitFor(() => {
        const toast = screen.getByText('Test').closest('.toast')
        expect(toast?.classList.contains('bg-background')).toBeTruthy()
      })
    })

    it('should apply dark theme classes', async () => {
      // Add dark class to document for testing
      document.documentElement.classList.add('dark')

      render(() => <Toaster theme="dark" />)

      toast.info('Test')

      await waitFor(() => {
        const toast = screen.getByText('Test').closest('.toast')
        expect(toast?.classList.contains('bg-background')).toBeTruthy()
      })

      // Cleanup
      document.documentElement.classList.remove('dark')
    })
  })

  describe('Real-world Usage Patterns', () => {
    it('should handle copy-to-clipboard pattern from Memory.tsx', async () => {
      render(() => <Toaster />)

      const Code = ({ children }) => <code>{children}</code>
      const position = '0x00'

      toast.info(
        <>
          Item at position <Code>{position}</Code> copied to clipboard
        </>
      )

      await waitFor(() => {
        expect(screen.getByText('Item at position')).toBeInTheDocument()
        expect(screen.getByText(position)).toBeInTheDocument()
        expect(screen.getByText('copied to clipboard')).toBeInTheDocument()
      })
    })
  })
})
```

#### E2E Tests (User Workflows)

```typescript
import { test, expect } from '@playwright/test'

test.describe('Toast Notifications E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should display toast when copying from Memory component', async ({ page }) => {
    // Load bytecode and execute to get memory
    await page.getByRole('button', { name: 'Step' }).click()

    // Find and click copy button in Memory component
    await page.locator('[aria-label="Copy to clipboard"]').first().click()

    // Verify toast appears
    await expect(page.getByText(/copied to clipboard/i)).toBeVisible()

    // Verify toast disappears after duration
    await expect(page.getByText(/copied to clipboard/i)).toBeHidden({ timeout: 5000 })
  })

  test('should display toast when copying from Stack component', async ({ page }) => {
    // Execute instructions to populate stack
    await page.getByRole('button', { name: 'Step' }).click()

    // Click copy button
    await page.locator('[aria-label="Copy to clipboard"]').first().click()

    // Verify toast
    await expect(page.getByText(/copied/i)).toBeVisible()
  })

  test('should display toast when copying from Storage component', async ({ page }) => {
    // Execute SSTORE instruction
    // ...

    // Copy from storage
    await page.locator('[aria-label="Copy key"]').first().click()

    // Verify toast
    await expect(page.getByText(/copied/i)).toBeVisible()
  })

  test('should stack multiple toasts', async ({ page }) => {
    // Trigger multiple copy operations quickly
    const copyButtons = await page.locator('[aria-label="Copy to clipboard"]').all()

    await copyButtons[0].click()
    await copyButtons[1].click()
    await copyButtons[2].click()

    // Verify multiple toasts are visible
    const toasts = await page.locator('.toast').all()
    expect(toasts.length).toBeGreaterThan(1)
  })

  test('should display toasts in correct position', async ({ page }) => {
    // Trigger a toast
    await page.locator('[aria-label="Copy to clipboard"]').first().click()

    // Verify toast position (bottom-right by default)
    const toast = page.locator('.toast').first()
    const box = await toast.boundingBox()
    const viewport = page.viewportSize()

    expect(box.x + box.width).toBeGreaterThan(viewport.width * 0.7)
    expect(box.y + box.height).toBeGreaterThan(viewport.height * 0.7)
  })

  test('should adapt to light/dark theme', async ({ page }) => {
    // Get initial theme
    const isDark = await page.locator('html').evaluate(el => el.classList.contains('dark'))

    // Trigger toast
    await page.locator('[aria-label="Copy to clipboard"]').first().click()

    // Get toast background color
    const toast = page.locator('.toast').first()
    const bgColor = await toast.evaluate(el => getComputedStyle(el).backgroundColor)

    // Toggle theme
    await page.getByRole('button', { name: /theme/i }).click()

    // Trigger another toast
    await page.locator('[aria-label="Copy to clipboard"]').nth(1).click()

    // Verify new toast has different background
    const newToast = page.locator('.toast').last()
    const newBgColor = await newToast.evaluate(el => getComputedStyle(el).backgroundColor)

    expect(bgColor).not.toEqual(newBgColor)
  })
})
```

### Testing Tools Needed

Based on project structure and SolidJS ecosystem:

**Unit & Integration Testing:**
- `vitest` - Test framework (fast, Vite-integrated)
- `@solidjs/testing-library` - SolidJS component testing utilities
- `@testing-library/user-event` - User interaction simulation
- `happy-dom` or `jsdom` - DOM environment

**E2E Testing:**
- `@playwright/test` - Modern E2E testing framework
- Or `cypress` - Alternative E2E framework

**Mocking:**
- `vitest` built-in mocking
- Mock `solid-sonner` library for unit tests

### Installation Commands

```bash
# Unit/Integration testing
pnpm add -D vitest @solidjs/testing-library @testing-library/user-event happy-dom

# E2E testing
pnpm add -D @playwright/test

# Initialize Playwright
pnpm exec playwright install
```

### Test File Structure

```
ui/solid/components/ui/
├── sonner.tsx
├── sonner.test.tsx              # Unit tests
├── sonner.integration.test.tsx  # Integration tests with toast
└── __tests__/
    └── sonner.e2e.test.ts       # E2E tests
```

### Test Configuration

**vitest.config.ts:**
```typescript
import { defineConfig } from 'vitest/config'
import solidPlugin from 'vite-plugin-solid'

export default defineConfig({
  plugins: [solidPlugin()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
  },
})
```

**test/setup.ts:**
```typescript
import { beforeEach, afterEach, vi } from 'vitest'
import '@testing-library/jest-dom'

// Mock solid-sonner if needed
vi.mock('solid-sonner', async () => {
  const actual = await vi.importActual('solid-sonner')
  return {
    ...actual,
    toast: {
      info: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      loading: vi.fn(),
    },
  }
})

beforeEach(() => {
  // Reset mocks before each test
  vi.clearAllMocks()
})

afterEach(() => {
  // Cleanup after each test
  document.body.innerHTML = ''
})
```

---

## 7. Recommendations

### Immediate Actions (Priority: CRITICAL)

None - the component is functional and serves its purpose.

### Short-term Improvements (Priority: HIGH)

#### 1. Add Explicit Configuration Options

```tsx
import { Toaster as Sonner, type ToasterProps } from 'solid-sonner'

/**
 * Toast notification container for the application.
 *
 * Wraps solid-sonner's Toaster component with custom styling that matches
 * the application's design system. Provides consistent toast notifications
 * across the entire app.
 *
 * @component
 * @example
 * ```tsx
 * // In App.tsx
 * import { Toaster } from '~/components/ui/sonner'
 *
 * function App() {
 *   return (
 *     <>
 *       <YourComponents />
 *       <Toaster />
 *     </>
 *   )
 * }
 *
 * // Anywhere in the app
 * import { toast } from 'solid-sonner'
 *
 * toast.info('Operation completed')
 * toast.success('Data saved')
 * toast.error('An error occurred')
 * ```
 *
 * @param props - Toaster configuration props
 * @param props.position - Toast position on screen (default: 'bottom-right')
 * @param props.theme - Color theme: 'light', 'dark', or 'system' (default: inherits from CSS)
 * @param props.richColors - Enable colorful error/success states (default: true)
 * @param props.closeButton - Show close button on all toasts (default: true)
 * @param props.duration - Default toast duration in milliseconds (default: 4000)
 * @param props.visibleToasts - Maximum number of visible toasts (default: 3)
 *
 * @see {@link https://github.com/wobsoriano/solid-sonner} solid-sonner documentation
 */
export const Toaster = (props: ToasterProps) => {
  return (
    <Sonner
      position="bottom-right"
      richColors
      closeButton
      duration={4000}
      visibleToasts={3}
      class="toaster group"
      toastOptions={{
        classes: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
      {...props}
    />
  )
}
```

#### 2. Extract CSS Classes to Constants

```tsx
import { Toaster as Sonner, type ToasterProps } from 'solid-sonner'

/**
 * CSS classes for toast styling.
 * Uses Tailwind's group selector pattern to apply theme-aware styles.
 */
const TOAST_CLASSES = {
  // Individual toast container - inherits theme from .toaster parent
  toast: [
    'group toast',
    'group-[.toaster]:bg-background',
    'group-[.toaster]:text-foreground',
    'group-[.toaster]:border-border',
    'group-[.toaster]:shadow-lg',
  ].join(' '),

  // Description/subtitle text
  description: 'group-[.toast]:text-muted-foreground',

  // Primary action button
  actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',

  // Cancel/dismiss button
  cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
} as const

/**
 * Container class for the toast portal.
 * Must be 'toaster group' for the group selector pattern to work.
 */
const TOASTER_CONTAINER_CLASS = 'toaster group'

export const Toaster = (props: ToasterProps) => {
  return (
    <Sonner
      position="bottom-right"
      richColors
      closeButton
      duration={4000}
      class={TOASTER_CONTAINER_CLASS}
      toastOptions={{
        classes: TOAST_CLASSES,
      }}
      {...props}
    />
  )
}
```

#### 3. Re-export Toast Function for Consistency

```tsx
import { Toaster as Sonner, toast, type ToasterProps } from 'solid-sonner'

// ... component code ...

/**
 * Re-export toast function for centralized imports.
 *
 * @example
 * ```tsx
 * import { toast } from '~/components/ui/sonner'
 *
 * toast.info('Info message')
 * toast.success('Success message')
 * toast.error('Error message')
 * toast.warning('Warning message')
 * toast.loading('Loading...')
 *
 * // With custom options
 * toast.success('Saved!', {
 *   description: 'Your changes have been saved.',
 *   action: {
 *     label: 'Undo',
 *     onClick: () => console.log('Undo'),
 *   },
 * })
 * ```
 */
export { toast }
```

#### 4. Add Basic Unit Tests

Create `/Users/williamcory/chop/ui/solid/components/ui/sonner.test.tsx`:

```tsx
import { render, screen, waitFor } from '@solidjs/testing-library'
import { describe, it, expect } from 'vitest'
import { Toaster, toast } from './sonner'

describe('Toaster Component', () => {
  it('should render without crashing', () => {
    const { container } = render(() => <Toaster />)
    expect(container).toBeTruthy()
  })

  it('should display info toast', async () => {
    render(() => <Toaster />)

    toast.info('Test message')

    await waitFor(() => {
      expect(screen.getByText('Test message')).toBeInTheDocument()
    })
  })

  it('should display JSX content', async () => {
    render(() => <Toaster />)

    toast.info(<div data-testid="custom">Custom content</div>)

    await waitFor(() => {
      expect(screen.getByTestId('custom')).toBeInTheDocument()
    })
  })

  it('should apply toaster group class', () => {
    const { container } = render(() => <Toaster />)
    const toaster = container.querySelector('.toaster.group')
    expect(toaster).toBeTruthy()
  })
})
```

### Medium-term Enhancements (Priority: MEDIUM)

#### 5. Create Toast Helper Utilities

Create `/Users/williamcory/chop/ui/solid/components/ui/toast-helpers.tsx`:

```tsx
import { toast } from 'solid-sonner'
import Code from '~/components/Code'

/**
 * Helper for showing copy-to-clipboard success toasts.
 * Used consistently across Memory, Stack, Storage components.
 */
export const toastCopySuccess = (position: string, itemType: string = 'item') => {
  toast.info(
    <>
      {itemType} at position <Code>{position}</Code> copied to clipboard
    </>
  )
}

/**
 * Helper for showing loading toasts that can be updated.
 */
export const toastLoading = (message: string) => {
  return toast.loading(message)
}

/**
 * Helper for updating a loading toast to success.
 */
export const toastLoadingSuccess = (id: string | number, message: string) => {
  toast.success(message, { id })
}

/**
 * Helper for updating a loading toast to error.
 */
export const toastLoadingError = (id: string | number, message: string) => {
  toast.error(message, { id })
}

/**
 * Helper for showing error toasts with consistent formatting.
 */
export const toastError = (error: Error | string, title?: string) => {
  const message = error instanceof Error ? error.message : error

  toast.error(title || 'Error', {
    description: message,
  })
}

/**
 * Helper for showing success toasts with optional action.
 */
export const toastSuccess = (
  message: string,
  options?: {
    description?: string
    action?: {
      label: string
      onClick: () => void
    }
  }
) => {
  toast.success(message, {
    description: options?.description,
    action: options?.action,
  })
}
```

**Usage in Memory.tsx:**
```tsx
import { toastCopySuccess } from '~/components/ui/toast-helpers'

const handleCopy = (chunk: string, index: number) => {
  const position = `0x${(index * 32).toString(16).padStart(4, '0')}`
  copyToClipboard(`0x${chunk}`)
  toastCopySuccess(position, 'Memory chunk')
}
```

#### 6. Add Theme Integration

```tsx
import { Toaster as Sonner, type ToasterProps } from 'solid-sonner'
import { createEffect, createSignal } from 'solid-js'

/**
 * Toaster with automatic theme detection.
 * Syncs with document dark mode class.
 */
export const Toaster = (props: ToasterProps) => {
  const [theme, setTheme] = createSignal<'light' | 'dark'>(
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  )

  // Watch for theme changes
  createEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(
        document.documentElement.classList.contains('dark') ? 'dark' : 'light'
      )
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    return () => observer.disconnect()
  })

  return (
    <Sonner
      theme={theme()}
      position="bottom-right"
      richColors
      closeButton
      duration={4000}
      class="toaster group"
      toastOptions={{
        classes: TOAST_CLASSES,
      }}
      {...props}
    />
  )
}
```

#### 7. Add Integration Tests

Create `/Users/williamcory/chop/ui/solid/components/ui/sonner.integration.test.tsx`:

```tsx
import { render, screen, waitFor } from '@solidjs/testing-library'
import { describe, it, expect, vi } from 'vitest'
import { Toaster, toast } from './sonner'

describe('Toaster Integration Tests', () => {
  it('should display multiple toast types', async () => {
    render(() => <Toaster />)

    toast.info('Info')
    toast.success('Success')
    toast.error('Error')

    await waitFor(() => {
      expect(screen.getByText('Info')).toBeInTheDocument()
      expect(screen.getByText('Success')).toBeInTheDocument()
      expect(screen.getByText('Error')).toBeInTheDocument()
    })
  })

  it('should handle action buttons', async () => {
    render(() => <Toaster />)

    const onAction = vi.fn()

    toast('Message', {
      action: {
        label: 'Undo',
        onClick: onAction,
      },
    })

    await waitFor(() => {
      expect(screen.getByText('Undo')).toBeInTheDocument()
    })

    screen.getByText('Undo').click()
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('should limit visible toasts', async () => {
    render(() => <Toaster visibleToasts={2} />)

    toast.info('Toast 1')
    toast.info('Toast 2')
    toast.info('Toast 3')

    await waitFor(() => {
      const toasts = screen.queryAllByText(/Toast \d/)
      expect(toasts.length).toBeLessThanOrEqual(2)
    })
  })
})
```

### Long-term Improvements (Priority: LOW)

#### 8. Create Usage Documentation

Create `/Users/williamcory/chop/ui/solid/components/ui/sonner.md`:

````markdown
# Toaster Component

Toast notification system for the application using solid-sonner.

## Setup

Add `<Toaster />` to your app root (only once):

```tsx
import { Toaster } from '~/components/ui/sonner'

function App() {
  return (
    <>
      <YourComponents />
      <Toaster />
    </>
  )
}
```

## Usage

Import and use the `toast` function anywhere in your app:

```tsx
import { toast } from '~/components/ui/sonner'

// Basic toasts
toast.info('Info message')
toast.success('Success message')
toast.error('Error message')
toast.warning('Warning message')

// With description
toast.success('Saved!', {
  description: 'Your changes have been saved successfully.',
})

// Loading toast
const toastId = toast.loading('Loading...')
// Later update it
toast.success('Done!', { id: toastId })

// With action button
toast('Event created', {
  action: {
    label: 'Undo',
    onClick: () => console.log('Undo'),
  },
})

// With cancel button
toast('Are you sure?', {
  cancel: {
    label: 'Cancel',
    onClick: () => console.log('Cancelled'),
  },
})

// Custom JSX content
toast.info(
  <>
    Copied <code>0x1234</code> to clipboard
  </>
)

// Promise-based (for async operations)
const myPromise = fetch('/api/data')

toast.promise(myPromise, {
  loading: 'Loading data...',
  success: 'Data loaded!',
  error: 'Failed to load data',
})
```

## Configuration

The Toaster is pre-configured with sensible defaults:

- **Position:** bottom-right
- **Rich colors:** Enabled (colorful success/error states)
- **Close button:** Enabled
- **Duration:** 4000ms (4 seconds)
- **Visible toasts:** 3 max

Override any of these via props:

```tsx
<Toaster
  position="top-right"
  duration={5000}
  visibleToasts={5}
  richColors={false}
  closeButton={false}
/>
```

## Styling

Toasts automatically adapt to your app's light/dark theme using CSS custom properties:

- `--background` - Toast background color
- `--foreground` - Toast text color
- `--border` - Toast border color
- `--primary` - Action button color
- `--muted` - Cancel button color

These are defined in your global CSS and applied via Tailwind classes.

## Helper Functions

Use helper functions for common toast patterns:

```tsx
import {
  toastCopySuccess,
  toastError,
  toastSuccess,
} from '~/components/ui/toast-helpers'

// Copy success (used in Memory, Stack, Storage components)
toastCopySuccess('0x00', 'Memory chunk')

// Error with stack trace
try {
  throw new Error('Something went wrong')
} catch (error) {
  toastError(error, 'Operation Failed')
}

// Success with action
toastSuccess('Data saved', {
  description: 'Your changes are now live.',
  action: {
    label: 'View',
    onClick: () => navigate('/view'),
  },
})
```

## Best Practices

1. **Don't overuse toasts** - They interrupt users, use sparingly
2. **Keep messages concise** - Aim for 5-10 words
3. **Use appropriate types** - info, success, error, warning
4. **Provide actions when useful** - Undo, view, retry, etc.
5. **Test toast behavior** - Ensure they don't block important UI

## Examples

### Copy to Clipboard (from Memory.tsx)

```tsx
const handleCopy = (chunk: string, index: number) => {
  const position = `0x${(index * 32).toString(16).padStart(4, '0')}`

  copyToClipboard(`0x${chunk}`)

  toast.info(
    <>
      Item at position <Code>{position}</Code> copied to clipboard
    </>
  )
}
```

### Async Operation with Loading State

```tsx
const handleSave = async () => {
  const toastId = toast.loading('Saving changes...')

  try {
    await saveData()
    toast.success('Changes saved successfully!', { id: toastId })
  } catch (error) {
    toast.error('Failed to save changes', { id: toastId })
  }
}
```

### Form Validation Error

```tsx
const handleSubmit = (data) => {
  if (!data.email) {
    toast.error('Validation Error', {
      description: 'Email is required',
    })
    return
  }

  // Submit form...
}
```

## Accessibility

The toast system is accessible out of the box:

- ARIA live regions for screen reader announcements
- Keyboard navigable (Tab, Enter, Escape)
- Respects prefers-reduced-motion
- Focus management for action buttons

## API Reference

See [solid-sonner documentation](https://github.com/wobsoriano/solid-sonner) for full API details.
````

#### 9. Add E2E Tests

See Section 6 for comprehensive E2E test examples.

#### 10. Consider Advanced Features

```tsx
/**
 * Advanced Toaster with analytics, error boundaries, and custom features.
 */
import { Toaster as Sonner, type ToasterProps } from 'solid-sonner'
import { createEffect, createSignal, onCleanup } from 'solid-js'

interface CustomToasterProps extends ToasterProps {
  /** Enable analytics tracking for toast events */
  enableAnalytics?: boolean
  /** Custom error handler for toast errors */
  onError?: (error: Error) => void
}

export const Toaster = (props: CustomToasterProps) => {
  const [toastCount, setToastCount] = createSignal(0)

  // Track toast analytics
  createEffect(() => {
    if (!props.enableAnalytics) return

    const handleToastEvent = (event: CustomEvent) => {
      console.log('Toast event:', event.detail)
      setToastCount(c => c + 1)

      // Send to analytics service
      // analytics.track('toast_shown', { type: event.detail.type })
    }

    window.addEventListener('toast:show', handleToastEvent)

    onCleanup(() => {
      window.removeEventListener('toast:show', handleToastEvent)
    })
  })

  return (
    <Sonner
      position="bottom-right"
      richColors
      closeButton
      duration={4000}
      class="toaster group"
      toastOptions={{
        classes: TOAST_CLASSES,
      }}
      {...props}
    />
  )
}
```

---

## Summary

**Overall Assessment:** The sonner.tsx component is a minimal, functional wrapper around solid-sonner that applies consistent styling. It serves its purpose but lacks advanced configuration and documentation.

**Code Health:** 7/10
- ✅ Simple, focused component
- ✅ Correct prop forwarding
- ✅ Proper TypeScript usage
- ✅ Uses design system tokens
- ⚠️ No explicit configuration (relies on defaults)
- ⚠️ Generic parameter type (not self-documenting)
- ⚠️ Missing theme integration
- ❌ No tests (0% coverage)
- ❌ No documentation

**Maintainability:** 6/10
- ✅ Minimal code footprint
- ✅ Clear purpose
- ✅ Type-safe
- ⚠️ Long CSS class strings
- ⚠️ No inline documentation
- ❌ No usage examples
- ❌ No tests

**Functionality:** 7/10
- ✅ Core toast functionality works
- ✅ Proper styling integration
- ✅ Used successfully in app
- ⚠️ Default configuration only
- ⚠️ No explicit theme handling
- ⚠️ No position configuration
- ❌ Missing helper utilities
- ❌ Missing advanced features

**Developer Experience:** 5/10
- ✅ Easy to use once set up
- ✅ Simple API (via solid-sonner)
- ⚠️ Generic type inference
- ❌ No usage documentation
- ❌ No examples in code
- ❌ No JSDoc comments
- ❌ No TypeScript hints for available props

**Comparison with Other UI Components:**

| Aspect | Sonner | Button | Badge | Card |
|--------|--------|--------|-------|------|
| Documentation | ❌ None | ⚠️ Minimal | ⚠️ Minimal | ⚠️ Minimal |
| Tests | ❌ None | ❌ None | ❌ None | ❌ None |
| Type Safety | ✅ Good | ✅ Excellent | ✅ Good | ✅ Good |
| Variants | N/A | ✅ cva | ✅ cva | ❌ None |
| Props handling | ⚠️ Pass-through | ✅ splitProps | ✅ splitProps | ✅ splitProps |
| Class merging | ❌ No cn() | ✅ cn() | ✅ cn() | ✅ cn() |

**Key Findings:**

1. **Functional but Minimal** - Component works but provides little abstraction over the library
2. **Inconsistent with Patterns** - Doesn't follow splitProps/cn() patterns (but this is acceptable for this use case)
3. **No Testing** - Critical gap across entire UI component library
4. **No Documentation** - Significant DX issue for new developers
5. **Limited Configuration** - Relies entirely on library defaults

**Risk Assessment:**
- **Low risk** - Component is stable and simple
- **Low impact** from changes - Isolated component
- **Medium risk** for future maintenance - No tests or docs
- **Low risk** for bugs - Minimal logic

---

## Related Files

**Primary:**
- `/Users/williamcory/chop/ui/solid/components/ui/sonner.tsx` - This component

**Usage:**
- `/Users/williamcory/chop/ui/solid/App.tsx` - Renders Toaster (line 147)
- `/Users/williamcory/chop/ui/solid/components/evm-debugger/Memory.tsx` - Uses toast.info (line 24)
- `/Users/williamcory/chop/ui/solid/components/evm-debugger/Stack.tsx` - Uses toast.info (line 23)
- `/Users/williamcory/chop/ui/solid/components/evm-debugger/Storage.tsx` - Uses toast.info (line 28, 33)
- `/Users/williamcory/chop/ui/solid/components/evm-debugger/LogsAndReturn.tsx` - Uses toast.info

**Related UI Components:**
- `/Users/williamcory/chop/ui/solid/components/ui/button.tsx` - Similar UI primitive pattern
- `/Users/williamcory/chop/ui/solid/components/ui/card.tsx` - Similar UI primitive pattern
- `/Users/williamcory/chop/ui/solid/components/ui/badge.tsx` - Similar UI primitive pattern

**External Dependencies:**
- `solid-sonner` - Core toast notification library
- `solid-js` - Framework

**Testing (to be created):**
- `/Users/williamcory/chop/ui/solid/components/ui/sonner.test.tsx` - Unit tests
- `/Users/williamcory/chop/ui/solid/components/ui/sonner.integration.test.tsx` - Integration tests
- `/Users/williamcory/chop/ui/solid/components/ui/__tests__/sonner.e2e.test.ts` - E2E tests

**Documentation (to be created):**
- `/Users/williamcory/chop/ui/solid/components/ui/sonner.md` - Usage guide
- `/Users/williamcory/chop/ui/solid/components/ui/toast-helpers.tsx` - Helper utilities

---

**Review completed by:** Claude Code
**Review date:** 2025-10-26
**Next review recommended:** After implementing tests and documentation, or in 60 days

**Action Priority:**
1. **High:** Add JSDoc documentation and usage examples
2. **High:** Add explicit configuration (theme, position, richColors)
3. **High:** Create basic unit tests
4. **Medium:** Extract CSS classes to constants
5. **Medium:** Create toast helper utilities
6. **Medium:** Add integration tests
7. **Low:** Create usage documentation file
8. **Low:** Add E2E tests for real-world usage

**Estimated Effort:**
- Documentation: 2-3 hours
- Basic tests: 4-5 hours
- Helper utilities: 2-3 hours
- Integration tests: 3-4 hours
- E2E tests: 4-5 hours
- **Total for production-ready:** 15-20 hours
