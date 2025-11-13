## Review Output Format

### Review Result File Structure

```markdown
# Code Review Report

**Review Date**: {Current Date}  
**Reviewer**: {Reviewer Name}  
**Files Reviewed**: {Number} files

## Summary

Brief overview of the changes and overall assessment.

## Issues Found

### 🔴 HIGH Priority Issues
Critical issues that must be fixed before merge:

- **File**: `path/to/file.cs`
  - **Line**: 42
  - **Issue**: Description of the critical issue
  - **Code**:
    ```
    // Paste the problematic code here
    ```
  - **Impact**: Security/Performance/Breaking change
  - **Recommendation**: How to fix it

> When reporting a HIGH Priority issue, always include:
> - The file and line number
> - A description of the issue
> - The relevant code snippet in a markdown code block
> - The impact and recommendation

Example:

- **File**: `src/controllers/UserController.cs`
  - **Line**: 42
  - **Issue**: SQL Injection vulnerability
  - **Code**:
    ```
    string query = "SELECT * FROM Users WHERE name = '" + userName + "'";
    ```
  - **Impact**: Security risk
  - **Recommendation**: Use parameterized queries to prevent SQL injection

### 🟡 MEDIUM Priority Issues
Important issues that should be addressed:

- **File**: `path/to/file.cs`
  - **Line**: 15
  - **Issue**: Description of the issue
  - **Code**:
    ```
    // Paste the problematic code here
    ```
  - **Impact**: Code quality/Maintainability concern
  - **Recommendation**: Suggested improvement

> When reporting a HIGH Priority issue, always include:
> - The file and line number
> - A description of the issue
> - The relevant code snippet in a markdown code block
> - The impact and recommendation

Example:

- **File**: `src/controllers/UserController.cs`
  - **Line**: 42
  - **Issue**: SQL Injection vulnerability
  - **Code**:
    ```
    string query = "SELECT * FROM Users WHERE name = '" + userName + "'";
    ```
  - **Impact**: Security risk
  - **Recommendation**: Use parameterized queries to prevent SQL injection

### 🟢 LOW Priority Issues
Minor issues and suggestions for improvement:

- **File**: `path/to/file.cs`
  - **Line**: 98
  - **Issue**: Description of minor issue
  - **Impact**: Code style/Minor optimization
  - **Recommendation**: Optional improvement

```

### Priority Classification Guidelines

**🔴 HIGH Priority** (Must Fix):
- Security vulnerabilities
- Performance bottlenecks
- Breaking changes
- Data corruption risks
- Architecture violations that affect system stability

**🟡 MEDIUM Priority** (Should Fix):
- Code quality issues
- Maintainability concerns
- SOLID principle violations
- Missing error handling
- Inconsistent patterns

**🟢 LOW Priority** (Nice to Have):
- Code style improvements
- Minor optimizations
- Documentation enhancements
- Naming convention improvements
- Non-critical refactoring suggestions
