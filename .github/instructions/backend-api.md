---
title: "Backend API Review"
description: "Guidelines for reviewing backend API endpoints and services"
keywords: ["backend", "api", "server", "database", "endpoint", "service", "controller"]
scope: ["backend", "api", "server"]
fileTypes: [".ts", ".js", ".py", ".java"]
priority: 8
---

# Backend API Review Guidelines

## API Design
- **RESTful Conventions**: Follow REST principles for endpoint design
- **HTTP Status Codes**: Use appropriate status codes for different scenarios
- **Request/Response**: Consistent request and response structures
- **API Versioning**: Proper versioning strategy for breaking changes
- **Documentation**: Clear API documentation with examples

## Security Review
- **Authentication**: Proper authentication mechanisms
- **Authorization**: Role-based access control
- **Input Validation**: Validate all input parameters
- **SQL Injection**: Prevent SQL injection attacks
- **Rate Limiting**: Implement rate limiting for API endpoints

## Error Handling
- **Graceful Errors**: Handle errors gracefully with meaningful messages
- **Logging**: Proper logging for debugging and monitoring
- **Retry Logic**: Implement retry mechanisms for external dependencies
- **Circuit Breakers**: Use circuit breakers for external service calls

## Database Operations
- **Query Optimization**: Efficient database queries
- **Transactions**: Proper transaction handling
- **Data Validation**: Validate data before database operations
- **Migrations**: Safe database migration scripts

## Performance Considerations
- **Caching**: Implement appropriate caching strategies
- **Pagination**: Use pagination for large datasets
- **Async Operations**: Use async/await for I/O operations
- **Resource Management**: Proper resource cleanup and connection pooling

## Common Backend Issues
- Missing input validation
- Improper error handling
- Security vulnerabilities
- Performance bottlenecks
- Memory leaks
- Improper database queries
