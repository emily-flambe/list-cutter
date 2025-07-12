# R2 Storage Performance Tests

This directory contains performance tests for R2 storage operations with specific performance targets:

## Performance Targets
- **10MB File Upload**: < 5 seconds
- **100MB File Upload**: < 30 seconds  
- **File Download**: < 2 seconds (with caching)
- **Multipart Upload**: Efficient for large files with concurrent parts
- **Concurrent Operations**: Test parallel file operations

## Test Structure
- `benchmark-utils.ts` - Core performance measurement utilities
- `file-upload-performance.test.ts` - Single and multipart upload tests
- `file-download-performance.test.ts` - Download with caching tests
- `concurrent-operations.test.ts` - Parallel operation tests

## Running Tests
```bash
npm run test:performance
```

Each test measures response times, throughput, and resource utilization.