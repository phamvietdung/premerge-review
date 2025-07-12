# Review Instructions

## Code Review Guidelines

### General Principles
- Focus on code quality, maintainability, and performance
- Check for proper error handling and edge cases
- Ensure code follows project conventions and best practices
- Look for potential security vulnerabilities

### TypeScript/JavaScript Specific
- Verify proper type definitions
- Check for any `any` types that should be more specific
- Ensure proper async/await usage
- Look for potential memory leaks or performance issues

### Git & Version Control
- Verify commit messages are descriptive
- Check for proper branch naming conventions
- Ensure no sensitive data is committed

### Testing
- Verify that new features have appropriate tests
- Check test coverage for critical paths
- Ensure tests are meaningful and not just for coverage

### Documentation
- Check that public APIs are documented
- Verify README updates if needed
- Ensure inline comments explain complex logic

### Performance Considerations
- Look for unnecessary re-renders or computations
- Check for proper caching strategies
- Verify efficient data structures are used

### Security
- Check for input validation
- Verify proper authentication/authorization
- Look for potential XSS or injection vulnerabilities

## Review Process
1. Read the entire PR description
2. Review changes file by file
3. Test locally if significant changes
4. Provide constructive feedback
5. Approve when all concerns are addressed
