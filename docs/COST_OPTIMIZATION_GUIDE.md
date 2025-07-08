# R2 Storage Cost Optimization Guide

## Overview

This guide provides comprehensive strategies to optimize your Cloudflare R2 storage costs while maintaining performance and reliability. The recommendations are based on usage patterns, pricing tiers, and best practices for cloud storage optimization.

## Understanding R2 Pricing

### Current Pricing Structure (2024)

#### Storage Costs
- **Standard Storage**: $0.015/GB/month (after 10 GB free tier)
- **Infrequent Access Storage**: $0.01/GB/month (33% savings)
- **Free Tier**: 10 GB storage per month

#### Operation Costs
- **Class A Operations** (PUT, COPY, POST, LIST): $4.50/million (after 1M free)
- **Class B Operations** (GET, HEAD, OPTIONS): $0.36/million (after 10M free)
- **Free Tier**: 1M Class A operations, 10M Class B operations per month

#### Data Transfer Costs
- **Data Transfer Out**: $0.09/GB (after 10 GB free)
- **Data Transfer In**: Free
- **Free Tier**: 10 GB egress per month

## Cost Optimization Strategies

### 1. Storage Class Optimization

#### Use Infrequent Access for Archived Data
```javascript
// Identify files older than 30 days with low access frequency
const optimizationCandidates = await analyzeFileAccess({
  olderThan: 30, // days
  maxAccessPerMonth: 2,
  storageClass: 'Standard'
});

// Migrate to Infrequent Access storage
for (const file of optimizationCandidates) {
  await migrateToInfrequentAccess(file.id);
}
```

**Potential Savings**: 33% reduction in storage costs for archived files

#### Recommended Migration Criteria
- Files not accessed in 30+ days
- Files accessed less than 2 times per month
- Archive/backup files
- Historical data and logs

### 2. Data Lifecycle Management

#### Implement Automated Cleanup Policies
```javascript
// Example cleanup policy
const cleanupPolicy = {
  // Delete temporary files after 7 days
  temporary: {
    maxAge: 7,
    action: 'delete'
  },
  // Move to Infrequent Access after 30 days
  standard: {
    maxAge: 30,
    action: 'migrate_to_ia'
  },
  // Delete old backups after 90 days
  backup: {
    maxAge: 90,
    action: 'delete'
  }
};
```

#### File Retention Strategies
- **Temporary Files**: 7-day retention
- **User Uploads**: 30-day migration to IA
- **Processed Files**: 60-day retention
- **Backups**: 90-day retention with 30-day IA migration

### 3. Operation Optimization

#### Reduce Unnecessary Operations

**Batch Operations**
```javascript
// Instead of individual uploads
for (const file of files) {
  await uploadFile(file); // Multiple Class A operations
}

// Use batch upload
await batchUpload(files); // Single Class A operation
```

**Optimize LIST Operations**
```javascript
// Expensive: List all files frequently
const allFiles = await listAllFiles();

// Optimized: Use pagination and caching
const cachedFiles = await getCachedFileList();
if (needsRefresh(cachedFiles)) {
  const recentFiles = await listFiles({ limit: 100 });
  updateCache(recentFiles);
}
```

#### Class A Operation Reduction
- Implement file upload batching
- Use efficient metadata queries
- Cache file listings
- Reduce unnecessary COPY operations

### 4. Data Transfer Optimization

#### Minimize Egress Costs
```javascript
// Implement CDN caching
const cdnConfig = {
  cacheTtl: 3600, // 1 hour
  compressFiles: true,
  enableGzip: true
};

// Use conditional requests
const fileResponse = await fetchFile(fileId, {
  ifModifiedSince: lastModified,
  ifNoneMatch: etag
});
```

#### Transfer Optimization Strategies
- Enable compression for text files
- Use CDN for frequently accessed content
- Implement client-side caching
- Optimize file formats (WebP for images, etc.)

### 5. File Optimization

#### Compression Strategies
```javascript
// Compress files before upload
const compressedFile = await compressFile(originalFile, {
  quality: 0.8,
  format: 'webp' // for images
});

// Use gzip for text files
const gzippedContent = await gzip(textContent);
```

#### Deduplication
```javascript
// Implement file deduplication
const fileHash = await calculateHash(fileContent);
const existingFile = await findFileByHash(fileHash);

if (existingFile) {
  // Create reference instead of duplicate
  await createFileReference(existingFile.id, newFileName);
} else {
  await uploadFile(fileContent, fileHash);
}
```

### 6. Monitoring and Alerting

#### Cost Monitoring Setup
```javascript
// Set up cost alerts
const costAlerts = [
  {
    threshold: 50, // $50 monthly
    severity: 'warning',
    action: 'email'
  },
  {
    threshold: 100, // $100 monthly
    severity: 'critical',
    action: 'email_and_slack'
  }
];

// Monitor usage patterns
const usageAnalysis = await analyzeUsagePatterns({
  period: '30days',
  metrics: ['storage', 'operations', 'transfer']
});
```

#### Key Metrics to Monitor
- Monthly storage costs by class
- Operation costs by type
- Data transfer costs
- Cost per user/department
- Cost trends and projections

## Cost Optimization Recommendations by Usage Pattern

### High-Volume Upload Applications

#### Challenges
- High Class A operation costs
- Large storage requirements
- Frequent data access

#### Solutions
```javascript
// Implement upload batching
const uploadBatch = new UploadBatch({
  maxBatchSize: 100,
  maxWaitTime: 30000, // 30 seconds
  compressionEnabled: true
});

// Use multipart uploads for large files
const multipartConfig = {
  partSize: 5 * 1024 * 1024, // 5MB parts
  maxConcurrency: 3
};
```

**Estimated Savings**: 60-80% reduction in Class A operations

### Archive/Backup Applications

#### Challenges
- Large storage volumes
- Infrequent access patterns
- Long retention requirements

#### Solutions
```javascript
// Immediate IA storage for archives
const archiveConfig = {
  storageClass: 'InfrequentAccess',
  compressionLevel: 9,
  encryptionEnabled: true
};

// Implement tiered storage
const tieringPolicy = {
  hot: { maxAge: 7, storageClass: 'Standard' },
  warm: { maxAge: 30, storageClass: 'InfrequentAccess' },
  cold: { maxAge: 365, action: 'delete' }
};
```

**Estimated Savings**: 40-60% reduction in storage costs

### Content Delivery Applications

#### Challenges
- High egress costs
- Frequent GET operations
- Global access requirements

#### Solutions
```javascript
// Implement CDN integration
const cdnConfig = {
  provider: 'cloudflare',
  cacheTtl: 86400, // 24 hours
  compressionEnabled: true,
  webpConversion: true
};

// Use edge caching
const edgeCache = {
  staticAssets: '7d',
  dynamicContent: '1h',
  userContent: '24h'
};
```

**Estimated Savings**: 70-90% reduction in egress costs

## Implementation Roadmap

### Phase 1: Quick Wins (Week 1-2)
1. **Enable file compression** for all uploads
2. **Implement basic caching** for frequently accessed files
3. **Set up cost monitoring** and alerts
4. **Identify large files** for optimization

### Phase 2: Process Optimization (Week 3-4)
1. **Implement upload batching** for high-volume operations
2. **Configure lifecycle policies** for automatic cleanup
3. **Migrate old files** to Infrequent Access storage
4. **Optimize file formats** and compression

### Phase 3: Advanced Optimization (Week 5-8)
1. **Implement deduplication** logic
2. **Set up automated tiering** based on access patterns
3. **Optimize data transfer** with CDN integration
4. **Create cost dashboards** and reporting

## Cost Calculation Examples

### Example 1: Small Business (50 GB, 10K operations/month)
```
Current Costs:
- Storage: (50 - 10) * $0.015 = $0.60
- Operations: (10K - 1M) * $4.50/M = $0.00 (within free tier)
- Total: $0.60/month

Optimized Costs (30 GB Standard, 20 GB IA):
- Storage: (30 - 10) * $0.015 + 20 * $0.01 = $0.50
- Operations: Same
- Total: $0.50/month
- Savings: 17% ($0.10/month)
```

### Example 2: Medium Business (500 GB, 100K operations/month)
```
Current Costs:
- Storage: (500 - 10) * $0.015 = $7.35
- Operations: (100K - 1M) * $4.50/M = $0.00 (within free tier)
- Total: $7.35/month

Optimized Costs (200 GB Standard, 300 GB IA):
- Storage: (200 - 10) * $0.015 + 300 * $0.01 = $5.85
- Operations: Same
- Total: $5.85/month
- Savings: 20% ($1.50/month)
```

### Example 3: Enterprise (5 TB, 1M operations/month)
```
Current Costs:
- Storage: (5000 - 10) * $0.015 = $74.85
- Operations: (1M - 1M) * $4.50/M = $0.00 (at free tier limit)
- Total: $74.85/month

Optimized Costs (1 TB Standard, 4 TB IA):
- Storage: (1000 - 10) * $0.015 + 4000 * $0.01 = $54.85
- Operations: Same
- Total: $54.85/month
- Savings: 27% ($20.00/month)
```

## Monitoring and Measurement

### Key Performance Indicators (KPIs)
- **Cost per GB**: Total monthly cost / total storage
- **Cost per operation**: Total operation cost / total operations
- **Optimization ratio**: IA storage / total storage
- **Savings percentage**: (Previous cost - current cost) / previous cost

### Automated Reporting
```javascript
// Generate monthly cost optimization report
const report = await generateCostReport({
  period: 'monthly',
  includeProjections: true,
  includeRecommendations: true
});

// Key metrics to track
const metrics = {
  totalCost: report.totalCost,
  savingsAchieved: report.savingsAchieved,
  optimizationOpportunities: report.opportunities,
  projectedSavings: report.projectedSavings
};
```

## Best Practices

### 1. Regular Review and Optimization
- Monthly cost reviews
- Quarterly optimization assessments
- Annual strategy reviews

### 2. Automated Policies
- Implement lifecycle management
- Set up automatic cleanup
- Configure cost alerts

### 3. Team Education
- Train developers on cost-conscious practices
- Share cost optimization guidelines
- Regular cost awareness sessions

### 4. Continuous Monitoring
- Real-time cost tracking
- Usage pattern analysis
- Anomaly detection

## Troubleshooting Common Issues

### High Storage Costs
**Symptoms**: Unexpectedly high monthly storage bills
**Solutions**:
- Audit large files and duplicates
- Implement file compression
- Migrate old files to IA storage
- Set up automated cleanup

### High Operation Costs
**Symptoms**: Exceeding free tier limits frequently
**Solutions**:
- Implement operation batching
- Optimize LIST operations
- Reduce unnecessary COPY operations
- Cache frequently accessed data

### High Egress Costs
**Symptoms**: High data transfer charges
**Solutions**:
- Implement CDN caching
- Enable compression
- Optimize file formats
- Use conditional requests

## Support and Resources

### Getting Help
- **Dashboard**: Monitor costs in real-time
- **Alerts**: Set up automated notifications
- **Support**: Contact technical support for optimization advice
- **Community**: Share best practices with other users

### Additional Resources
- [Cloudflare R2 Pricing Calculator](https://developers.cloudflare.com/r2/platform/pricing/)
- [R2 Best Practices Guide](https://developers.cloudflare.com/r2/learning/best-practices/)
- [Cost Optimization Webinars](https://www.cloudflare.com/learning/)

---

*This guide is updated regularly to reflect the latest pricing and features. Last updated: 2024*