---
title: "General Code Review"
description: "General code review guidelines for all types of code changes"
keywords: ["general", "code", "review", "quality", "standards"]
scope: ["general"]
fileTypes: []
priority: 10
---

# General Code Review Guidelines

## Core Principles
- **Readability**: Code should be easy to read and understand
- **Maintainability**: Changes should make the codebase easier to maintain
- **Performance**: Consider performance implications of changes
- **Security**: Always check for security vulnerabilities

## What to Review
1. **Code Quality**: Clean, readable, and well-structured code
2. **Logic**: Ensure the logic is correct and handles edge cases
3. **Error Handling**: Proper error handling and user feedback
4. **Testing**: Adequate test coverage for new functionality
5. **Documentation**: Clear comments and documentation for complex logic

## Common Issues to Flag
- Hard-coded values that should be configurable
- Missing error handling
- Potential memory leaks
- Security vulnerabilities
- Performance bottlenecks
- Code duplication
- Missing type safety

## Best Practices
- Follow established coding standards
- Use meaningful variable and function names
- Keep functions small and focused
- Add comments for complex business logic
- Ensure proper resource cleanup
