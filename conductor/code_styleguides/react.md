# React Style Guide

## Component Structure

### File Organization
```
components/
├── ComponentName.tsx      # Component with its logic
├── ComponentName.test.tsx # Tests (if applicable)
└── index.ts              # Re-export (optional)
```

### Component Template
```tsx
import React from 'react';
import type { ComponentProps } from './types';

interface Props {
  // Props interface defined inline or imported
}

const ComponentName: React.FC<Props> = ({ prop1, prop2 }) => {
  // Hooks first
  const [state, setState] = useState();

  // Derived values
  const computedValue = useMemo(() => /* ... */, [dependency]);

  // Event handlers
  const handleClick = () => { /* ... */ };

  // Early returns for loading/error states
  if (loading) return <LoadingSpinner />;

  // Main render
  return (
    <div>
      {/* JSX */}
    </div>
  );
};

export default ComponentName;
```

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `UserProfile`, `AdminDashboard` |
| Props interfaces | PascalCase + Props | `UserProfileProps` |
| Event handlers | handle + Event | `handleClick`, `handleSubmit` |
| Boolean props | is/has/can prefix | `isLoading`, `hasError`, `canEdit` |
| Render functions | render + Name | `renderHeader`, `renderListItem` |

## Hooks

### Hook Rules
- Only call hooks at the top level
- Only call hooks from React functions
- Custom hooks must start with `use`

### Common Patterns
```tsx
// useState with explicit type
const [user, setUser] = useState<User | null>(null);

// useEffect with cleanup
useEffect(() => {
  const subscription = subscribe();
  return () => subscription.unsubscribe();
}, [dependency]);

// useMemo for expensive computations
const sortedItems = useMemo(
  () => items.sort((a, b) => a.name.localeCompare(b.name)),
  [items]
);

// useCallback for stable function references
const handleUpdate = useCallback((id: string) => {
  updateItem(id);
}, [updateItem]);
```

## Props

### Destructuring
```tsx
// Destructure props in function signature
const UserCard: React.FC<Props> = ({ name, email, avatar }) => {
  // ...
};

// Use rest operator for pass-through props
const Button: React.FC<ButtonProps> = ({ children, variant, ...rest }) => {
  return <button className={variant} {...rest}>{children}</button>;
};
```

### Default Props
```tsx
// Use default parameters
const Alert: React.FC<AlertProps> = ({
  type = 'info',
  dismissible = false,
  children
}) => {
  // ...
};
```

## Conditional Rendering

```tsx
// Short-circuit for simple conditions
{isVisible && <Modal />}

// Ternary for if-else
{isLoading ? <Spinner /> : <Content />}

// Early return for complex conditions
if (!user) return <LoginPrompt />;
if (error) return <ErrorMessage error={error} />;
return <Dashboard user={user} />;
```

## Event Handling

```tsx
// Type event handlers properly
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  setValue(e.target.value);
};

const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  // ...
};

// Inline handlers for simple cases
<button onClick={() => setOpen(true)}>Open</button>

// Named handlers for complex logic or reuse
<button onClick={handleSubmit}>Submit</button>
```

## Performance

- Use `React.memo()` for components that render often with same props
- Use `useMemo` for expensive calculations
- Use `useCallback` for functions passed to optimized child components
- Avoid creating objects/arrays in render (move to useMemo or outside component)

## Avoid

- Mutating state directly
- Using array index as key for dynamic lists
- Inline function definitions in dependency arrays
- Over-optimization (profile first)
- Deeply nested ternaries in JSX
