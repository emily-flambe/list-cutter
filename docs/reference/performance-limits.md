---
title: Performance Limits and Expectations
category: Reference
keywords: performance, limits, speed, capacity, specifications
difficulty: all
---

# Performance Limits and Expectations

## System Capabilities and Constraints

Understanding Cutty's performance characteristics helps you work efficiently and avoid issues.

## File Size Limits

### Upload Limits
- **Maximum file size**: 50MB
- **Recommended size**: Under 10MB for best performance
- **Large file handling**: Split files over 25MB for optimal processing

### Row and Column Limits
- **Maximum rows**: ~1,000,000 (depends on column count)
- **Maximum columns**: 1,000
- **Optimal range**: 10,000-100,000 rows with 10-50 columns
- **Cell content**: 32,768 characters per cell

### Memory Considerations
Browser memory limits affect processing:
- **Chrome**: Best performance, up to 4GB
- **Firefox**: Good performance, up to 2GB
- **Safari**: Moderate performance, up to 1GB
- **Mobile browsers**: Limited to 512MB-1GB

## Processing Speed Expectations

### Upload Times
File Size | Good Connection | Average Connection | Slow Connection
----------|----------------|-------------------|----------------
1 MB      | 1-2 seconds   | 3-5 seconds       | 10-15 seconds
10 MB     | 5-10 seconds  | 15-30 seconds     | 1-2 minutes
50 MB     | 30-60 seconds | 2-5 minutes       | 5-10 minutes

### Processing Times
Operation | Small File (<1MB) | Medium File (1-10MB) | Large File (10-50MB)
----------|------------------|---------------------|--------------------
Parse CSV | <1 second        | 1-5 seconds         | 5-30 seconds
Apply Filters | <1 second    | 1-3 seconds         | 3-10 seconds
Generate Crosstab | 1-2 seconds | 2-10 seconds     | 10-60 seconds
Export Results | <1 second   | 1-5 seconds         | 5-20 seconds

### Query Complexity Impact
- **Simple filter** (1 condition): Minimal impact
- **Complex filter** (5+ conditions): 2-3x slower
- **AND logic**: Faster than OR logic
- **Text search**: Slower than exact match
- **Date comparisons**: Similar to numeric

## Concurrent Operations

### User Limits
- **Simultaneous uploads**: 5 files
- **Concurrent processing**: 10 operations
- **Active sessions**: Unlimited
- **API rate limit**: 100 requests/minute

### System-Wide Limits
- **Total concurrent users**: Unlimited (edge-based)
- **Global throughput**: Auto-scales with demand
- **Regional performance**: Sub-50ms response globally

## Browser-Specific Performance

### Chrome (Recommended)
- **Max file size**: 50MB
- **Best for**: Large files, complex operations
- **Memory efficiency**: Excellent
- **JavaScript performance**: Fastest

### Firefox
- **Max file size**: 40MB practical limit
- **Best for**: Privacy-conscious users
- **Memory efficiency**: Good
- **JavaScript performance**: Very good

### Safari
- **Max file size**: 30MB practical limit
- **Best for**: Mac ecosystem integration
- **Memory efficiency**: Moderate
- **JavaScript performance**: Good

### Edge
- **Max file size**: 50MB
- **Best for**: Windows integration
- **Memory efficiency**: Excellent
- **JavaScript performance**: Fastest (Chromium-based)

### Mobile Browsers
- **Max file size**: 10MB recommended
- **Best for**: Quick edits, viewing
- **Memory efficiency**: Limited
- **JavaScript performance**: Varies by device

## Network Requirements

### Minimum Requirements
- **Bandwidth**: 1 Mbps download/upload
- **Latency**: <500ms to Cloudflare edge
- **Stability**: Consistent connection required
- **Protocol**: HTTPS (TLS 1.2+)

### Recommended Requirements
- **Bandwidth**: 10+ Mbps
- **Latency**: <100ms
- **Connection**: Wired or strong WiFi
- **Browser**: Latest version

## Data Type Performance

### Fast Operations
- **Integer filtering**: Fastest
- **Boolean checks**: Very fast
- **Exact text match**: Fast
- **Date comparisons**: Fast

### Slower Operations
- **Text pattern matching**: Moderate
- **Case-insensitive search**: Slower
- **Complex calculations**: Slowest
- **Large text fields**: Memory intensive

## Optimization Tips

### For Large Files
1. **Pre-process locally**: Remove unnecessary columns
2. **Split by date**: Process monthly/weekly batches
3. **Filter early**: Reduce data volume quickly
4. **Use sampling**: Test on subset first

### For Better Performance
1. **Close other tabs**: Free up browser memory
2. **Use wired connection**: More stable than WiFi
3. **Update browser**: Latest versions perform better
4. **Clear cache**: If experiencing issues
5. **Disable extensions**: Ad blockers can interfere

### For Complex Operations
1. **Break into steps**: Don't combine everything
2. **Save intermediate results**: Checkpoint your work
3. **Process off-peak**: Less server load
4. **Use simpler conditions**: When possible

## Timeout Limits

### Operation Timeouts
- **File upload**: 5 minutes
- **Processing**: 2 minutes
- **Export generation**: 3 minutes
- **API calls**: 30 seconds
- **Session idle**: 24 hours

### Recovery Options
- **Auto-save**: Every 30 seconds
- **Resume upload**: Supported for auth users
- **Retry logic**: Automatic 3 retries
- **Error recovery**: Graceful degradation

## Storage Limits

### Per User
- **Total storage**: Unlimited (fair use)
- **File retention**: Until deleted
- **File history**: Last 100 operations
- **Saved queries**: 50 maximum

### Anonymous Users
- **Session storage**: Duration of session
- **File retention**: 24 hours
- **No permanent storage**: Login required
- **Limited features**: Basic operations only

## API Limits

### Rate Limiting
- **Requests per minute**: 100
- **Requests per hour**: 2,000
- **Requests per day**: 20,000
- **Burst allowance**: 10 requests/second

### Payload Limits
- **Request size**: 50MB
- **Response size**: 100MB
- **Batch operations**: 100 items
- **Concurrent connections**: 10

## Synthetic Data Limits

### Generation Limits
- **Maximum rows**: 10,000
- **Maximum columns**: 50
- **Generation time**: 1-30 seconds
- **Complexity impact**: More columns = slower

### Data Type Limits
- **Text length**: 1,000 characters
- **Number range**: -1 trillion to 1 trillion
- **Date range**: 1900-2100
- **Categories**: 100 unique values

## Crosstab Limits

### Dimension Limits
- **Row categories**: 1,000 maximum
- **Column categories**: 100 maximum
- **Cell count**: 100,000 maximum
- **Optimal range**: <100 x <50

### Performance Impact
- **Small crosstabs** (<10x10): Instant
- **Medium crosstabs** (50x20): 1-5 seconds
- **Large crosstabs** (100x50): 5-30 seconds
- **Very large**: May timeout or fail

## Export Limits

### Format-Specific Limits
- **CSV**: No practical limit
- **JSON**: 100MB maximum
- **SQL**: 10,000 statements

### Download Limits
- **Single file**: 100MB
- **Batch export**: 500MB total
- **Concurrent downloads**: 3

## Performance Monitoring

### Client-Side Metrics
- Processing time displayed
- Progress indicators
- Memory usage warnings
- Network speed detection

### Server-Side Metrics
- Request processing time
- Queue depth
- Error rates
- Resource utilization

## Troubleshooting Performance

### Slow Upload
1. Check network speed
2. Reduce file size
3. Try different browser
4. Upload during off-peak

### Slow Processing
1. Simplify filters
2. Reduce columns selected
3. Process smaller batches
4. Clear browser cache

### Memory Errors
1. Close other tabs
2. Restart browser
3. Use smaller file
4. Try different device

### Timeout Errors
1. Reduce operation complexity
2. Process smaller dataset
3. Check network stability
4. Retry operation

## Future Improvements

### Planned Enhancements
- Streaming uploads for larger files
- Background processing queue
- Incremental processing
- WebAssembly acceleration
- GPU acceleration for analytics

### Under Consideration
- Desktop application
- Batch processing API
- Distributed processing
- Real-time collaboration
- Offline mode

## Best Practices Summary

### Do's
- Test with small samples first
- Save work frequently
- Monitor file sizes
- Use appropriate browser
- Keep software updated

### Don'ts
- Don't upload files over 50MB
- Don't process during uploads
- Don't use outdated browsers
- Don't ignore memory warnings
- Don't run multiple heavy operations

## Getting Help

If experiencing performance issues:
1. Note file size and operation
2. Check browser console for errors
3. Try recommended optimizations
4. Contact support with details
5. Include performance metrics