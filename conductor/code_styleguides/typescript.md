# TypeScript Style Guide

## General Principles

- Enable strict mode in `tsconfig.json`
- Prefer explicit types over `any`
- Use type inference where types are obvious
- Export types and interfaces that are used across files

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Variables & Functions | camelCase | `userName`, `getUserById` |
| Types & Interfaces | PascalCase | `User`, `TrainingModule` |
| Enums | PascalCase | `UserRole` |
| Enum Members | UPPER_CASE or PascalCase | `UserRole.ADMIN` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT` |
| File names | camelCase or kebab-case | `userService.ts`, `user-service.ts` |

## Types vs Interfaces

```typescript
// Use interfaces for object shapes that may be extended
interface User {
  id: string;
  name: string;
}

interface AdminUser extends User {
  permissions: string[];
}

// Use types for unions, primitives, and computed types
type UserRole = 'admin' | 'manager' | 'new_hire';
type UserId = string;
```

## Function Typing

```typescript
// Explicit return types for public functions
function getUser(id: string): User | null {
  // ...
}

// Arrow functions with type annotations
const formatDate = (date: Date): string => {
  // ...
};

// Async functions
async function fetchUsers(): Promise<User[]> {
  // ...
}
```

## Enums

```typescript
// Prefer string enums for readability in debugging
enum UserRole {
  ADMIN = 'Admin',
  MANAGER = 'Manager',
  NEW_HIRE = 'New Hire'
}

// Use const enums for performance when values aren't needed at runtime
const enum Direction {
  Up,
  Down,
  Left,
  Right
}
```

## Null Handling

```typescript
// Use optional chaining
const userName = user?.profile?.name;

// Use nullish coalescing
const displayName = userName ?? 'Anonymous';

// Avoid non-null assertions (!) unless certain
```

## Generics

```typescript
// Use descriptive generic names for complex generics
function mergeObjects<TBase, TExtension>(
  base: TBase,
  extension: TExtension
): TBase & TExtension {
  return { ...base, ...extension };
}

// Single letter (T, K, V) acceptable for simple cases
function identity<T>(value: T): T {
  return value;
}
```

## Imports

```typescript
// Group imports: external, internal, types
import React, { useState } from 'react';

import { UserService } from './services/userService';
import { formatDate } from './utils/date';

import type { User, UserRole } from './types';
```

## Avoid

- Using `any` — use `unknown` if type is truly unknown
- Type assertions (`as`) without validation
- Ignoring TypeScript errors with `@ts-ignore`
- Overly complex conditional types in application code
