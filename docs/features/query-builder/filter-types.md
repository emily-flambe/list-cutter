---
title: Filter Types Guide
category: Features
subcategory: Query Builder
keywords: filter types, data filters, text filters, numeric filters, date filters, boolean filters
difficulty: intermediate
---

# Filter Types Guide

## Complete Reference for All Filter Types

The Query Builder supports different filter types optimized for different kinds of data. Understanding which filter type to use for your data will help you create more effective and efficient queries.

## Understanding Filter Types

### What are Filter Types?
Filter types are specialized filtering interfaces designed for specific data types. Each type provides operators and input methods optimized for that kind of data:
- **Text Filters**: For names, descriptions, categories, and string data
- **Numeric Filters**: For numbers, amounts, quantities, and measurements
- **Date Filters**: For timestamps, dates, and time periods
- **Boolean Filters**: For true/false, yes/no, and binary data
- **List Filters**: For selecting from predefined values

### Automatic Type Detection
Cutty automatically detects the best filter type for each column:
- **Content Analysis**: Examines sample values to determine type
- **Pattern Recognition**: Identifies dates, numbers, and text patterns
- **Manual Override**: Option to change detected type if needed
- **Mixed Data Handling**: Graceful handling of columns with multiple data types

## Text Filters

### Overview
Text filters are designed for working with string data like names, descriptions, categories, and identifiers.

### Available Operators

#### Equality Operators
**Equals**: Exact match
```
Column: Status
Operator: Equals
Value: "Active"
Result: Only rows where Status is exactly "Active"
```

**Not Equals**: Everything except exact match
```
Column: Department
Operator: Not Equals
Value: "Training"
Result: All departments except "Training"
```

#### Pattern Matching Operators
**Contains**: Text includes substring
```
Column: Product Name
Operator: Contains
Value: "iPhone"
Result: "iPhone 12", "iPhone 13 Pro", "iPhone SE"
```

**Does Not Contain**: Text excludes substring
```
Column: Email
Operator: Does Not Contain
Value: "test"
Result: Excludes test email addresses
```

**Starts With**: Text begins with specified string
```
Column: Customer ID
Operator: Starts With
Value: "CUST"
Result: "CUST001", "CUST002", "CUSTXYZ"
```

**Ends With**: Text concludes with specified string
```
Column: Filename
Operator: Ends With
Value: ".pdf"
Result: All PDF files
```

#### Advanced Pattern Operators
**Matches Pattern**: Regular expression matching
```
Column: Phone Number
Operator: Matches Pattern
Value: ^\d{3}-\d{3}-\d{4}$
Result: Phone numbers in XXX-XXX-XXXX format
```

**Wildcard Match**: Simple wildcard patterns
```
Column: Product Code
Operator: Wildcard Match
Value: "A*123"
Result: "A001123", "AXYZ123", "ABC123"
```

### Text Filter Options

#### Case Sensitivity
Control case matching behavior:
- **Case Sensitive**: "Active" ≠ "active"
- **Case Insensitive**: "Active" = "active" = "ACTIVE" (default)
- **Smart Case**: Case sensitive if any uppercase letters are provided

#### Whitespace Handling
Manage spaces and whitespace:
- **Trim Whitespace**: Ignore leading/trailing spaces
- **Normalize Spaces**: Convert multiple spaces to single spaces
- **Exact Whitespace**: Match spaces exactly as typed

#### Character Encoding
Handle special characters:
- **Unicode Normalization**: Handle accented characters consistently
- **ASCII Only**: Limit to basic ASCII characters
- **Full Unicode**: Support all Unicode characters

### Text List Filters

#### In List
Select from multiple specific values:
```
Column: Country
Operator: In List
Values: ["USA", "Canada", "Mexico"]
Result: Records from North America only
```

#### Not In List
Exclude multiple specific values:
```
Column: Status
Operator: Not In List
Values: ["Deleted", "Suspended", "Archived"]
Result: Active records only
```

#### Custom List Input
Methods for entering list values:
- **Comma Separated**: "USA, Canada, Mexico"
- **Line Separated**: One value per line
- **File Upload**: Import list from text file
- **Column Values**: Select from existing column values

## Numeric Filters

### Overview
Numeric filters are optimized for working with numbers, quantities, measurements, and calculated values.

### Basic Comparison Operators

#### Equality
**Equals**: Exact numeric match
```
Column: Quantity
Operator: Equals
Value: 100
Result: Orders with exactly 100 items
```

**Not Equals**: All values except specified number
```
Column: Discount Percent
Operator: Not Equals
Value: 0
Result: Orders with any discount applied
```

#### Comparison Operators
**Greater Than**: Values above threshold
```
Column: Sales Amount
Operator: Greater Than
Value: 1000
Result: High-value sales above $1,000
```

**Greater Than or Equal**: Values at or above threshold
```
Column: Age
Operator: Greater Than or Equal
Value: 18
Result: Adults (18 and older)
```

**Less Than**: Values below threshold
```
Column: Response Time
Operator: Less Than
Value: 500
Result: Fast responses under 500ms
```

**Less Than or Equal**: Values at or below threshold
```
Column: Score
Operator: Less Than or Equal
Value: 70
Result: Scores of 70 or below
```

### Range Operators

#### Between
Values within inclusive range:
```
Column: Price
Operator: Between
Min Value: 50
Max Value: 200
Result: Products priced $50-$200
```

#### Not Between
Values outside specified range:
```
Column: Temperature
Operator: Not Between
Min Value: 32
Max Value: 212
Result: Temperatures outside water's liquid range (Fahrenheit)
```

### Advanced Numeric Operators

#### Statistical Operators
**Above Average**: Values higher than column average
```
Column: Sales Performance
Operator: Above Average
Result: Above-average performing sales reps
```

**Below Average**: Values lower than column average
```
Column: Processing Time
Operator: Below Average
Result: Faster-than-average processing times
```

**Top N**: Highest N values
```
Column: Revenue
Operator: Top N
Value: 10
Result: Top 10 revenue-generating records
```

**Bottom N**: Lowest N values
```
Column: Customer Satisfaction
Operator: Bottom N
Value: 5
Result: 5 lowest satisfaction scores
```

#### Percentile Filters
**Above Percentile**: Values above specified percentile
```
Column: Income
Operator: Above 90th Percentile
Result: Top 10% of income earners
```

**Below Percentile**: Values below specified percentile
```
Column: Load Time
Operator: Below 25th Percentile
Result: Fastest 25% of load times
```

### Numeric Filter Options

#### Precision Handling
Control decimal precision:
- **Exact Match**: Must match precisely
- **Rounded Match**: Round to specified decimal places
- **Tolerance**: Allow small differences (+/- tolerance)

#### Number Format Recognition
Handle different number formats:
- **Decimal Point**: 1234.56
- **Thousands Separator**: 1,234.56
- **Currency Symbols**: $1,234.56
- **Percentage**: 12.5%
- **Scientific Notation**: 1.23E+4

## Date and Time Filters

### Overview
Date filters provide specialized handling for dates, times, and datetime values with support for various date formats and relative date expressions.

### Basic Date Operators

#### Exact Date Matching
**Equals**: Specific date
```
Column: Order Date
Operator: Equals
Value: 2024-03-15
Result: Orders placed on March 15, 2024
```

**Not Equals**: All dates except specified
```
Column: Holiday Date
Operator: Not Equals
Value: 2024-12-25
Result: All non-Christmas dates
```

#### Date Comparison
**After**: Dates later than specified date
```
Column: Created Date
Operator: After
Value: 2024-01-01
Result: Records created after New Year's Day 2024
```

**Before**: Dates earlier than specified date
```
Column: Expiration Date
Operator: Before
Value: 2024-12-31
Result: Items expiring before end of 2024
```

**On or After**: Inclusive later date comparison
```
Column: Start Date
Operator: On or After
Value: 2024-06-01
Result: Events starting June 1st or later
```

**On or Before**: Inclusive earlier date comparison
```
Column: Deadline
Operator: On or Before
Value: 2024-05-31
Result: Deadlines by end of May 2024
```

### Date Range Operators

#### Between Dates
**Between**: Inclusive date range
```
Column: Purchase Date
Operator: Between
Start Date: 2024-01-01
End Date: 2024-03-31
Result: Q1 2024 purchases
```

#### Relative Date Ranges
**Last N Days**: Rolling day window
```
Column: Login Date
Operator: Last N Days
Value: 30
Result: Users who logged in within last 30 days
```

**Next N Days**: Future day window
```
Column: Appointment Date
Operator: Next N Days
Value: 7
Result: Appointments in the next week
```

### Predefined Date Ranges

#### Current Period Filters
**Today**: Current day only
```
Column: Transaction Date
Operator: Today
Result: Today's transactions
```

**This Week**: Current week (Monday-Sunday)
```
Column: Activity Date
Operator: This Week
Result: This week's activities
```

**This Month**: Current calendar month
```
Column: Sales Date
Operator: This Month
Result: Current month's sales
```

**This Quarter**: Current 3-month quarter
```
Column: Report Date
Operator: This Quarter
Result: Current quarter's reports
```

**This Year**: Current calendar year
```
Column: Hire Date
Operator: This Year
Result: Employees hired this year
```

#### Previous Period Filters
**Yesterday**: Previous day only
```
Column: Log Date
Operator: Yesterday
Result: Yesterday's log entries
```

**Last Week**: Previous complete week
```
Column: Event Date
Operator: Last Week
Result: Last week's events
```

**Last Month**: Previous complete month
```
Column: Invoice Date
Operator: Last Month
Result: Last month's invoices
```

**Last Quarter**: Previous complete quarter
```
Column: Performance Date
Operator: Last Quarter
Result: Last quarter's performance data
```

**Last Year**: Previous complete year
```
Column: Annual Review Date
Operator: Last Year
Result: Last year's annual reviews
```

### Time-Specific Filters

#### Time of Day
**During Hours**: Specific time range within days
```
Column: Timestamp
Operator: During Hours
Start Time: 09:00
End Time: 17:00
Result: Business hours activity
```

**Time Equals**: Specific time
```
Column: Scheduled Time
Operator: Time Equals
Value: 14:30
Result: 2:30 PM appointments
```

#### Day of Week
**Day of Week**: Specific weekdays
```
Column: Activity Date
Operator: Day of Week
Values: ["Monday", "Wednesday", "Friday"]
Result: Activities on MWF
```

### Date Format Options

#### Input Formats
Support for various date formats:
- **ISO 8601**: 2024-03-15 (recommended)
- **US Format**: 03/15/2024 or 3/15/24
- **European Format**: 15/03/2024 or 15.03.24
- **Long Format**: March 15, 2024
- **Timestamp**: 2024-03-15 14:30:00

#### Timezone Handling
Manage timezone considerations:
- **UTC**: Universal Coordinated Time
- **Local Time**: User's local timezone
- **Specific Timezone**: Designated timezone
- **Timezone Conversion**: Automatic conversion

## Boolean Filters

### Overview
Boolean filters handle true/false, yes/no, and binary data with simple true/false selection.

### Boolean Operators

#### Is True
```
Column: Email Verified
Operator: Is True
Result: Users with verified email addresses
```

#### Is False
```
Column: Deleted
Operator: Is False
Result: Non-deleted records
```

#### Equals
```
Column: Active Status
Operator: Equals
Value: True
Result: Active records
```

### Boolean Value Recognition
Automatic recognition of boolean patterns:
- **True Values**: true, True, TRUE, 1, yes, Yes, YES, y, Y
- **False Values**: false, False, FALSE, 0, no, No, NO, n, N
- **Null Handling**: Empty values treated as configurable default

## Null and Empty Value Filters

### Overview
Special filters for handling missing, empty, or null data across all data types.

### Null Value Operators

#### Is Empty/Null
```
Column: Phone Number
Operator: Is Empty
Result: Records without phone numbers
```

#### Is Not Empty/Null
```
Column: Email Address
Operator: Is Not Empty
Result: Records with email addresses
```

#### Has Value
```
Column: Middle Name
Operator: Has Value
Result: People with middle names provided
```

### Empty Value Options

#### Definition of "Empty"
Configure what counts as empty:
- **Null Values**: Database NULL values
- **Empty Strings**: "" (zero-length strings)
- **Whitespace Only**: Strings with only spaces/tabs
- **Default Values**: Specified placeholder values

## Filter Performance Considerations

### Optimized Filter Types

#### Fast Filters
Generally high-performance:
- **Exact equality** on indexed columns
- **Numeric comparisons** on indexed columns
- **Date ranges** on indexed date columns
- **Boolean filters** on indexed boolean columns

#### Moderate Performance
Reasonable performance with some cost:
- **Text contains** on moderate-length text
- **List membership** with small lists
- **Date ranges** on non-indexed columns
- **Numeric ranges** on non-indexed columns

#### Potentially Slow Filters
Use carefully with large datasets:
- **Text pattern matching** with wildcards
- **Regular expressions** on large text fields
- **Complex statistical** calculations
- **Large list membership** tests

### Performance Optimization Tips

#### Index-Friendly Filtering
- Use exact matches on indexed columns when possible
- Prefer range queries on indexed numeric/date columns
- Combine multiple filters to increase selectivity
- Test filter performance on representative data

#### Filter Ordering
- Apply most selective filters first
- Use faster filter types before slower ones
- Consider filter combination efficiency
- Monitor query execution times

## Common Filter Combinations

### Customer Segmentation
```
Text Filter: Customer Type = "Premium"
AND Numeric Filter: Lifetime Value > 10000
AND Date Filter: Last Purchase < 90 days ago
Result: High-value recent premium customers
```

### Data Quality Auditing
```
Text Filter: Email Does Not Contain "@"
OR Text Filter: Phone Number Is Empty
OR Date Filter: Created Date > Today
Result: Records with data quality issues
```

### Sales Analysis
```
Date Filter: Sale Date This Quarter
AND Numeric Filter: Amount > 1000
AND Text Filter: Region In ["North", "South"]
Result: High-value regional sales this quarter
```

### Compliance Filtering
```
Text Filter: Country In [EU Countries List]
AND Date Filter: Consent Date >= 2018-05-25
AND Boolean Filter: Marketing Opt In = True
Result: GDPR-compliant marketing contacts
```

## Troubleshooting Filter Types

### Common Issues

#### Wrong Data Type Detected
**Problem**: Column detected as wrong type
**Solution**: 
1. Check sample data in column
2. Use manual type override
3. Clean data before upload
4. Use text filter for mixed-type columns

#### Filter Not Working as Expected
**Problem**: Filter produces wrong results
**Solution**:
1. Verify operator selection
2. Check case sensitivity settings
3. Test with known data values
4. Review data format consistency

#### Poor Performance
**Problem**: Filter is very slow
**Solution**:
1. Use more selective filters first
2. Consider adding database indexes
3. Simplify complex patterns
4. Test with smaller data samples

## Best Practices

### Filter Design
1. **Match Data Type**: Use appropriate filter type for your data
2. **Start Simple**: Begin with basic operators, add complexity gradually
3. **Test Thoroughly**: Verify filters work with edge cases
4. **Consider Performance**: Choose efficient filter combinations

### Data Preparation
1. **Consistent Formats**: Standardize data formats before filtering
2. **Clean Data**: Remove or fix data quality issues
3. **Document Types**: Understand your data types and patterns
4. **Index Strategy**: Consider database indexing for frequently filtered columns

### Query Optimization
1. **Selective First**: Apply most selective filters early
2. **Fast Operations**: Use equality and range filters when possible
3. **Avoid Patterns**: Minimize wildcard and regex use
4. **Monitor Performance**: Track filter execution times

## Related Features

Filter types work with:
- **Query Builder**: Visual interface for creating filters
- **Operators Guide**: Detailed operator documentation
- **Combining Filters**: AND/OR logic for complex queries
- **SQL Preview**: See generated SQL for your filters

## Next Steps

- Learn about [Operators Guide](operators.md) for detailed operator usage
- Explore [Combining Filters](combining-filters.md) for complex filter logic
- Check [Query Builder Overview](overview.md) for the complete visual interface
- Review performance tips in [Advanced Querying](../advanced-querying/overview.md)