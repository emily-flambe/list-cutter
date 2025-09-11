---
title: Generation Limits and Guidelines
description: Understanding volume limits, performance considerations, and best practices
category: Features
subcategory: Synthetic Data
order: 4
last_updated: 2024-09-09
---

# Generation Limits and Guidelines

Understanding the limits and performance characteristics of Cutty's Synthetic Data Generator helps you plan effective data generation strategies and optimize your workflow for different use cases.

## Volume Limits and Boundaries

### Record Count Limits

#### Standard Volume Ranges
Cutty supports synthetic data generation across different scales:

**Minimum Volume: 1 record**
- **Use Case**: Single record testing, data format validation
- **Generation Time**: Instant (< 1 second)
- **Best For**: API endpoint testing, data structure validation

**Small Volume: 1-100 records**
- **Use Case**: Initial development, UI testing, proof of concepts
- **Generation Time**: 1-5 seconds
- **Best For**: Early-stage development, quick prototyping

**Medium Volume: 100-1,000 records**
- **Use Case**: Integration testing, feature development, demo datasets
- **Generation Time**: 5-30 seconds
- **Best For**: Most development and testing scenarios

**Large Volume: 1,000-10,000 records**
- **Use Case**: Performance testing, machine learning training, analytics
- **Generation Time**: 30 seconds - 5 minutes
- **Best For**: Production testing, comprehensive analysis

**Maximum Volume: 10,000 records**
- **Use Case**: Large-scale testing, statistical analysis, training datasets
- **Generation Time**: 2-10 minutes
- **Best For**: Maximum scale requirements, research datasets

#### Volume Selection Guidelines

**Choose Smaller Volumes When:**
- Testing new features or configurations
- Working with limited computational resources
- Needing quick turnaround times
- Developing user interfaces or simple workflows
- Validating data formats and structures

**Choose Larger Volumes When:**
- Testing system performance under load
- Training machine learning models
- Conducting statistical analysis requiring significance
- Simulating production-scale data scenarios
- Building comprehensive test datasets

### Geographic Complexity Impact

#### Single State Generation
- **Processing Impact**: Minimal
- **Generation Time**: Standard rates
- **Data Consistency**: Highest (all records from same region)
- **Use Cases**: Regional applications, state-specific testing

#### Multi-State Generation (2-10 states)
- **Processing Impact**: Low to moderate
- **Generation Time**: 10-25% increase
- **Data Consistency**: High (controlled regional diversity)
- **Use Cases**: Regional businesses, multi-state analysis

#### National Generation (All 50 states)
- **Processing Impact**: Moderate
- **Generation Time**: 25-50% increase
- **Data Consistency**: Moderate (maximum diversity)
- **Use Cases**: National businesses, comprehensive market analysis

### Performance Factors

#### Generation Speed Variables

**Primary Factors Affecting Speed:**
1. **Record Count**: Linear relationship with generation time
2. **Geographic Scope**: More states increase processing complexity
3. **Data Validation**: Quality checks add processing time
4. **Server Load**: Concurrent users may impact performance
5. **Network Conditions**: Download speed affects total time

**Secondary Factors:**
1. **Field Complexity**: Some fields require more processing
2. **Relationship Validation**: Ensuring data consistency takes time
3. **Statistical Accuracy**: Quality algorithms add overhead
4. **Export Format**: Different formats have varying processing requirements

#### Expected Performance Metrics

**Generation Time Estimates:**

| Records | Single State | 5 States | All States |
|---------|-------------|----------|------------|
| 100     | 2-5 sec     | 3-7 sec  | 5-10 sec   |
| 500     | 8-15 sec    | 12-25 sec| 20-40 sec  |
| 1,000   | 15-30 sec   | 25-50 sec| 45-90 sec  |
| 5,000   | 1-3 min     | 2-5 min  | 4-8 min    |
| 10,000  | 3-6 min     | 5-10 min | 8-15 min   |

*Times are estimates and may vary based on server load and network conditions*

## Resource Management

### Server Resource Allocation

#### Memory Usage Patterns
- **Base Memory**: 50-100 MB for system operations
- **Per Record**: Approximately 0.5-1 KB memory per record
- **Geographic Data**: Additional 10-50 MB for location validation
- **Peak Usage**: 2-3x normal usage during generation
- **Cleanup**: Automatic memory cleanup after generation

#### CPU Utilization
- **Generation Phase**: High CPU usage for data creation and validation
- **Validation Phase**: Moderate CPU for consistency checking
- **Export Phase**: Low CPU for file formatting and download preparation
- **Optimization**: Efficient algorithms minimize processing time

#### Storage Requirements
- **Temporary Storage**: Generated data stored temporarily during download
- **File Sizes**: Approximately 0.1-0.2 KB per record in CSV format
- **Cleanup Policy**: Temporary files removed after 1 hour
- **Download Window**: 24-hour download availability

### Concurrent User Management

#### Shared Resource Model
- **Fair Allocation**: Resources distributed among active users
- **Queue Management**: Requests processed in order during high load
- **Priority System**: Smaller requests may process faster during peak times
- **Load Balancing**: Automatic distribution across available servers

#### Peak Usage Considerations
- **Business Hours**: Higher usage during typical business hours (9 AM - 5 PM EST)
- **End of Week**: Increased usage on Fridays as developers prepare for testing
- **Beginning of Month**: Higher usage as teams start new development cycles
- **Planning Recommendation**: Schedule large generations during off-peak hours

## Optimization Strategies

### Efficient Generation Practices

#### Batch Strategy
Instead of generating one large dataset, consider multiple smaller batches:

**Advantages of Batching:**
- Faster individual generation times
- Lower memory usage per generation
- Easier to manage and validate
- Reduced risk of timeout or failure
- More flexibility in data usage

**Batching Example:**
Instead of 10,000 records in one generation:
- Generate 10 batches of 1,000 records each
- Total time may be similar or faster
- Easier to validate and manage
- Can process different state combinations

#### Progressive Scaling
Start small and scale up based on actual needs:

1. **Prototype Phase**: 50-100 records for initial development
2. **Development Phase**: 500-1,000 records for feature testing
3. **Integration Phase**: 2,000-5,000 records for system testing
4. **Performance Phase**: 5,000-10,000 records for load testing

### Quality vs. Speed Trade-offs

#### Speed-Optimized Generation
For faster generation when detailed accuracy is less critical:

- **Single State**: Use one state for fastest generation
- **Standard Fields**: Stick to basic field combinations
- **Moderate Volume**: Use 500-2,000 records per generation
- **Simple Validation**: Accept standard quality levels

#### Quality-Optimized Generation
For highest data quality when speed is less critical:

- **Multiple States**: Use appropriate geographic diversity
- **Comprehensive Fields**: Include all relevant data fields
- **Larger Volumes**: Generate sufficient data for statistical validity
- **Enhanced Validation**: Allow extra time for quality checks

## Error Handling and Recovery

### Common Limitations

#### Timeout Scenarios
- **Large Requests**: Requests over 15 minutes may timeout
- **High Server Load**: Peak usage may cause slower generation
- **Network Issues**: Connection problems may interrupt downloads
- **Resource Limits**: Server capacity limits may delay processing

#### Recovery Strategies
1. **Reduce Volume**: Try smaller record counts
2. **Simplify Geography**: Use fewer states
3. **Retry During Off-Peak**: Attempt generation during low-usage periods
4. **Contact Support**: Reach out for assistance with persistent issues

### Error Prevention

#### Pre-Generation Checklist
1. **Reasonable Volume**: Stay within recommended limits
2. **Appropriate Timing**: Avoid peak usage periods for large requests
3. **Stable Connection**: Ensure reliable internet connection
4. **Resource Planning**: Account for generation and download time
5. **Backup Plans**: Have alternative approaches ready

## Best Practices for Different Use Cases

### Development Team Guidelines

#### Daily Development Work
- **Volume**: 100-500 records
- **Frequency**: Generate fresh data daily or as needed
- **States**: Focus on relevant geographic regions
- **Strategy**: Quick, focused datasets for rapid iteration

#### Weekly Integration Testing
- **Volume**: 1,000-2,000 records
- **Frequency**: Generate new datasets for comprehensive testing
- **States**: Broader geographic representation
- **Strategy**: Consistent datasets for repeatable testing

#### Monthly Performance Testing
- **Volume**: 5,000-10,000 records
- **Frequency**: Generate large datasets for capacity testing
- **States**: Full national representation
- **Strategy**: Maximum scale testing with advance planning

### Research and Analytics Guidelines

#### Pilot Studies
- **Volume**: 500-1,000 records
- **Purpose**: Initial methodology testing
- **Quality**: Standard quality sufficient
- **Timeline**: Quick generation for rapid iteration

#### Full Research Studies
- **Volume**: 2,000-10,000 records
- **Purpose**: Statistical significance and comprehensive analysis
- **Quality**: Highest quality settings
- **Timeline**: Plan for longer generation times

### Production System Testing

#### Load Testing
- **Volume**: 5,000-10,000 records
- **Purpose**: System capacity and performance validation
- **Approach**: Generate multiple datasets for different test scenarios
- **Planning**: Schedule during maintenance windows

#### User Acceptance Testing
- **Volume**: 1,000-3,000 records
- **Purpose**: Realistic user scenario testing
- **Quality**: High quality for realistic user experience
- **Diversity**: Appropriate geographic and demographic diversity

## Monitoring and Troubleshooting

### Performance Monitoring

#### Generation Progress Indicators
- **Status Updates**: Real-time progress during generation
- **Time Estimates**: Dynamic time estimation based on current progress
- **Queue Position**: Information about processing queue during peak times
- **Completion Notifications**: Alerts when generation is complete

#### Quality Indicators
- **Validation Status**: Information about data quality checks
- **Error Reports**: Notification of any data quality issues
- **Statistical Summary**: Basic statistics about generated dataset
- **Download Readiness**: Confirmation when file is ready for download

### Troubleshooting Common Issues

#### Slow Generation Times
1. **Check Server Load**: Monitor for peak usage notifications
2. **Reduce Complexity**: Try fewer states or smaller volume
3. **Retry Later**: Attempt generation during off-peak hours
4. **Contact Support**: Report persistent performance issues

#### Download Problems
1. **Check File Size**: Ensure browser can handle large downloads
2. **Stable Connection**: Use reliable internet connection
3. **Download Manager**: Consider using download manager for large files
4. **Alternative Formats**: Try different export formats if available

Understanding these limits and guidelines helps you plan effective synthetic data generation strategies that balance your quality requirements with performance considerations and resource constraints.