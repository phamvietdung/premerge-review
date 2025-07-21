---
title: "Frontend React/TypeScript Review"
description: "Specific guidelines for reviewing React/TypeScript frontend code"
keywords: ["react", "typescript", "frontend", "ui", "component", "jsx", "tsx", "css"]
scope: ["frontend", "ui", "react"]
fileTypes: [".tsx", ".jsx", ".ts", ".js", ".css", ".scss"]
priority: 8
---

# Frontend React/TypeScript Review Guidelines

## React Component Review
- **Component Structure**: Check for proper component composition and single responsibility
- **Props Interface**: Ensure proper TypeScript interfaces for props
- **State Management**: Verify efficient state usage and avoid unnecessary re-renders
- **Hooks Usage**: Proper use of React hooks (useEffect, useState, useMemo, etc.)
- **Key Props**: Ensure proper key props in lists

## TypeScript Specific
- **Type Safety**: All props, state, and functions should be properly typed
- **Interface Design**: Use interfaces for component props and data structures
- **Generic Types**: Use generics where appropriate for reusable components
- **Strict Mode**: Ensure code works with TypeScript strict mode

## UI/UX Considerations
- **Accessibility**: Check for proper ARIA attributes and keyboard navigation
- **Responsive Design**: Ensure components work on different screen sizes
- **Performance**: Watch for unnecessary re-renders and heavy computations
- **User Experience**: Smooth interactions and proper loading states

## Common React Issues
- Missing dependency arrays in useEffect
- Mutating state directly
- Not cleaning up side effects
- Improper event handler binding
- Missing keys in rendered lists
- Not handling loading and error states

## CSS/Styling
- **CSS Modules**: Use CSS modules or styled-components for scoped styling
- **Responsive**: Mobile-first approach with proper breakpoints
- **Performance**: Avoid inline styles for dynamic content
- **Consistency**: Follow design system guidelines
