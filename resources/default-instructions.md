## Review Output Format

### Review Result File Structure

```markdown
# Code Review Report

**Review Date**: {Current Date}  
**Reviewer**: {Reviewer Name}  
**Commit Range**: {From Commit} → {To Commit} (if applicable)  
**Branch/PR**: {Branch or PR information}  
**Files Reviewed**: {Number} files

## Summary

Brief overview of the changes and overall assessment.

## Issues Found

### 🔴 HIGH Priority Issues
Critical issues that must be fixed before merge:

- **File**: `path/to/file.cs`
  - **Line**: 42
  - **Issue**: Description of the critical issue
  - **Impact**: Security/Performance/Breaking change
  - **Recommendation**: How to fix it

### 🟡 MEDIUM Priority Issues
Important issues that should be addressed:

- **File**: `path/to/file.cs`
  - **Line**: 15
  - **Issue**: Description of the issue
  - **Impact**: Code quality/Maintainability concern
  - **Recommendation**: Suggested improvement

### 🟢 LOW Priority Issues
Minor issues and suggestions for improvement:

- **File**: `path/to/file.cs`
  - **Line**: 98
  - **Issue**: Description of minor issue
  - **Impact**: Code style/Minor optimization
  - **Recommendation**: Optional improvement

## Architecture Review

- ✅ **CQRS Pattern**: Correctly implemented
- ✅ **Repository Pattern**: Following standards
- ⚠️ **Dependency Injection**: Minor issues found
- ✅ **Entity Framework**: Proper usage

## Positive Highlights

List any particularly well-written code or good practices observed.

## Recommendations

Overall recommendations for the development team based on this review.

## Review Metrics

- **Total Issues**: {count}
- **High Priority**: {count}
- **Medium Priority**: {count}
- **Low Priority**: {count}
- **Files with Issues**: {count}/{total}
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
