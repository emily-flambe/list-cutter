---
title: Comparison Operators Guide
category: Features
subcategory: Query Builder
keywords: operators, comparison operators, filter operators, query conditions, data comparison
difficulty: intermediate
---

# Comparison Operators Guide

## Complete Reference for All Comparison Operators

Operators are the heart of data filtering in Cutty's Query Builder. This comprehensive guide covers every operator available, how to use them effectively, and when to choose each one for optimal results.

## Understanding Operators

### What are Comparison Operators?
Operators define how to compare column values against your filter criteria. They answer the question "How should this value be compared?" For example:
- **Equals**: Is the value exactly this?
- **Contains**: Does the value include this text?
- **Greater Than**: Is the number larger than this?

### Operator Categories
Operators are organized by data type and comparison style:
- **Equality Operators**: Exact matches and exclusions
- **Text Pattern Operators**: String matching and searching
- **Numeric Comparison Operators**: Mathematical comparisons
- **Range Operators**: Between and within boundaries
- **Date/Time Operators**: Temporal comparisons
- **List Operators**: Multiple value matching
- **Existence Operators**: Null and empty value handling

## Text and String Operators

### Equality Operators

#### Equals
**Purpose**: Exact text match
**Usage**: Find records with exactly the specified text
**Case Sensitivity**: Configurable (default: case-insensitive)

```
Example: Status equals "Active"
Matches: "Active"
Does not match: "active", "ACTIVE" (if case-sensitive), "Inactive"
```

**Best for**:
- Status values
- Category matching
- ID lookups
- Fixed vocabularies

**Performance**: Excellent (especially on indexed columns)

#### Not Equals
**Purpose**: Exclude exact matches
**Usage**: Find everything except the specified text
**Case Sensitivity**: Follows same rules as Equals

```
Example: Department not equals "Training"
Matches: "Sales", "Marketing", "Support"
Does not match: "Training"
```

**Best for**:
- Excluding test data
- Removing specific categories
- Data cleanup queries

**Performance**: Good (may scan non-indexed data)

### Pattern Matching Operators

#### Contains
**Purpose**: Text includes substring anywhere
**Usage**: Search for text that appears within larger strings
**Case Sensitivity**: Configurable

```
Example: Product Name contains "iPhone"
Matches: "iPhone 12", "Apple iPhone 13 Pro", "iPhone SE 2022"
Does not match: "iPad", "MacBook", "Samsung Galaxy"
```

**Best for**:
- Product searching
- Name filtering
- Description searching
- Keyword matching

**Performance**: Moderate (slower on large text fields)

#### Does Not Contain
**Purpose**: Text excludes substring
**Usage**: Filter out records containing specific text
**Case Sensitivity**: Configurable

```
Example: Email does not contain "test"
Matches: "user@company.com", "admin@example.org"
Does not match: "test@example.com", "user.test@company.com"
```

**Best for**:
- Excluding test accounts
- Removing development data
- Content filtering

**Performance**: Moderate (requires full text scan)

#### Starts With
**Purpose**: Text begins with specified string
**Usage**: Find records with specific prefixes
**Case Sensitivity**: Configurable

```
Example: Customer ID starts with "CUST"
Matches: "CUST001", "CUST123", "CUSTOMER_VIP"
Does not match: "USER001", "ADMIN_CUST001"
```

**Best for**:
- ID prefix matching
- Category codes
- Hierarchical data
- Organizational schemes

**Performance**: Good (can use prefix indexes)

#### Ends With
**Purpose**: Text concludes with specified string
**Usage**: Find records with specific suffixes
**Case Sensitivity**: Configurable

```
Example: Filename ends with ".pdf"
Matches: "document.pdf", "report_2024.pdf", "invoice.PDF"
Does not match: "document.doc", "report.pdf.backup"
```

**Best for**:
- File type filtering
- Domain matching
- Suffix-based categorization

**Performance**: Moderate (less optimizable than prefix)

### Advanced Text Operators

#### Matches Pattern (Regular Expression)
**Purpose**: Complex pattern matching using regex
**Usage**: Advanced text pattern recognition
**Case Sensitivity**: Configurable

```
Example: Phone Number matches pattern "^\d{3}-\d{3}-\d{4}$"
Matches: "123-456-7890", "555-123-4567"
Does not match: "123.456.7890", "12-34-56789", "(123) 456-7890"
```

**Best for**:
- Data validation
- Format verification
- Complex text patterns
- Field standardization

**Performance**: Slower (use sparingly on large datasets)

**Common Patterns**:
- Email: `^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`
- Phone (US): `^\(\d{3}\) \d{3}-\d{4}$`
- ZIP Code: `^\d{5}(-\d{4})?$`
- URL: `^https?://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(/.*)?$`

#### Wildcard Match
**Purpose**: Simple pattern matching with wildcards
**Usage**: Pattern matching without full regex complexity
**Wildcards**: `*` (any characters), `?` (single character)

```
Example: Product Code wildcard match "A*123"
Matches: "A001123", "AXYZ123", "ABC123"
Does not match: "B001123", "A12", "A1234"
```

**Best for**:
- Simple pattern matching
- User-friendly pattern entry
- Basic wildcard searches

**Performance**: Better than regex, slower than exact match

## Numeric Operators

### Basic Comparison Operators

#### Equals
**Purpose**: Exact numeric match
**Usage**: Find records with specific numeric values
**Precision**: Handles decimal precision automatically

```
Example: Quantity equals 100
Matches: 100, 100.0, 100.00
Does not match: 99, 101, 100.1
```

**Best for**:
- Exact quantities
- Specific amounts
- Status codes
- Count matching

**Performance**: Excellent

#### Not Equals
**Purpose**: Exclude specific numeric values
**Usage**: Find all values except the specified number

```
Example: Discount not equals 0
Matches: 0.1, 5, 10, 15.5, -5
Does not match: 0, 0.0
```

**Best for**:
- Excluding zero values
- Removing default values
- Non-standard amounts

**Performance**: Good

#### Greater Than
**Purpose**: Values above threshold
**Usage**: Find values larger than specified number

```
Example: Sales Amount greater than 1000
Matches: 1000.01, 1500, 2000, 10000
Does not match: 1000, 999.99, 500
```

**Best for**:
- Minimum thresholds
- High-value filtering
- Performance targets
- Age restrictions

**Performance**: Excellent (especially with indexes)

#### Greater Than or Equal
**Purpose**: Values at or above threshold
**Usage**: Find values equal to or larger than specified number

```
Example: Age greater than or equal 18
Matches: 18, 19, 25, 65
Does not match: 17, 16, 0
```

**Best for**:
- Inclusive minimum limits
- Qualification criteria
- Range boundaries

**Performance**: Excellent

#### Less Than
**Purpose**: Values below threshold
**Usage**: Find values smaller than specified number

```
Example: Response Time less than 500
Matches: 499, 100, 50, 0
Does not match: 500, 501, 1000
```

**Best for**:
- Maximum limits
- Performance requirements
- Size restrictions
- Quality thresholds

**Performance**: Excellent

#### Less Than or Equal
**Purpose**: Values at or below threshold
**Usage**: Find values equal to or smaller than specified number

```
Example: Score less than or equal 70
Matches: 70, 65, 50, 0
Does not match: 71, 75, 100
```

**Best for**:
- Inclusive maximum limits
- Failing grades
- Budget limits
- Capacity constraints

**Performance**: Excellent

### Range Operators

#### Between
**Purpose**: Values within inclusive range
**Usage**: Find values between two numbers (including endpoints)

```
Example: Price between 50 and 200
Matches: 50, 75, 125, 150, 200
Does not match: 49.99, 200.01, 25, 300
```

**Best for**:
- Price ranges
- Age groups
- Performance bands
- Date ranges (as numbers)

**Performance**: Excellent with proper indexing

#### Not Between
**Purpose**: Values outside specified range
**Usage**: Find values not within the specified range

```
Example: Temperature not between 32 and 212
Matches: 31, 25, 0, 213, 300
Does not match: 32, 100, 150, 212
```

**Best for**:
- Outlier detection
- Extreme value identification
- Safety limit violations
- Abnormal ranges

**Performance**: Good (may require multiple index scans)

### Statistical Operators

#### Above Average
**Purpose**: Values higher than column average
**Usage**: Find values above the calculated mean
**Calculation**: Automatically computed from column data

```
Example: Sales Performance above average
If average = 85.5
Matches: 86, 90, 100, 150
Does not match: 85, 80, 75, 50
```

**Best for**:
- Performance analysis
- Above-average identification
- Comparative analysis
- Benchmark comparisons

**Performance**: Moderate (requires average calculation)

#### Below Average
**Purpose**: Values lower than column average
**Usage**: Find values below the calculated mean

```
Example: Customer Satisfaction below average
If average = 7.2
Matches: 7, 6, 5, 3
Does not match: 8, 9, 10
```

**Best for**:
- Underperformance identification
- Improvement targeting
- Quality issues
- Risk assessment

**Performance**: Moderate

#### Top N
**Purpose**: Highest N values in the column
**Usage**: Find the top-performing or highest-value records
**Sorting**: Automatically sorts in descending order

```
Example: Revenue top 10
Matches: The 10 highest revenue values
```

**Best for**:
- Leaderboards
- High performers
- Largest values
- Priority ranking

**Performance**: Moderate (requires sorting)

#### Bottom N
**Purpose**: Lowest N values in the column
**Usage**: Find the lowest-performing or smallest-value records

```
Example: Response Time bottom 5
Matches: The 5 fastest response times
```

**Best for**:
- Best performers (for "lower is better" metrics)
- Smallest values
- Fastest times
- Most efficient

**Performance**: Moderate

#### Above Percentile
**Purpose**: Values above specified percentile
**Usage**: Find values in top percentage of data
**Percentiles**: 50th (median), 75th, 90th, 95th, 99th

```
Example: Income above 90th percentile
Matches: Top 10% of income values
```

**Best for**:
- Elite performance
- High earners
- Exceptional cases
- Statistical analysis

**Performance**: Moderate to slow (requires percentile calculation)

#### Below Percentile
**Purpose**: Values below specified percentile
**Usage**: Find values in bottom percentage of data

```
Example: Load Time below 25th percentile
Matches: Fastest 25% of load times
```

**Best for**:
- Top performance (for "lower is better")
- Fast responses
- Efficient operations
- Best practices

**Performance**: Moderate to slow

## Date and Time Operators

### Basic Date Comparison

#### Equals (Date)
**Purpose**: Exact date match
**Usage**: Find records from specific date
**Time Handling**: Can ignore time component if specified

```
Example: Order Date equals 2024-03-15
Matches: Any time on March 15, 2024
Does not match: March 14, 2024 or March 16, 2024
```

**Best for**:
- Specific date events
- Daily reports
- Anniversary dates
- Deadline matching

**Performance**: Excellent

#### After
**Purpose**: Dates later than specified date
**Usage**: Find records after specific date
**Inclusion**: Does not include the specified date

```
Example: Created Date after 2024-01-01
Matches: 2024-01-02, 2024-06-15, 2024-12-31
Does not match: 2024-01-01, 2023-12-31
```

**Best for**:
- Recent data
- Future events
- Data since cutoff
- Timeline filtering

**Performance**: Excellent

#### Before
**Purpose**: Dates earlier than specified date
**Usage**: Find records before specific date
**Inclusion**: Does not include the specified date

```
Example: Expiration Date before 2024-12-31
Matches: 2024-12-30, 2024-06-15, 2023-01-01
Does not match: 2024-12-31, 2025-01-01
```

**Best for**:
- Historical data
- Expired items
- Past events
- Cutoff filtering

**Performance**: Excellent

#### On or After
**Purpose**: Dates equal to or later than specified date
**Usage**: Inclusive later date comparison

```
Example: Start Date on or after 2024-06-01
Matches: 2024-06-01, 2024-06-15, 2024-12-31
Does not match: 2024-05-31, 2024-01-01
```

**Best for**:
- Inclusive date ranges
- Effective dates
- Start boundaries
- Policy dates

**Performance**: Excellent

#### On or Before
**Purpose**: Dates equal to or earlier than specified date
**Usage**: Inclusive earlier date comparison

```
Example: Deadline on or before 2024-05-31
Matches: 2024-05-31, 2024-05-15, 2024-01-01
Does not match: 2024-06-01, 2024-12-31
```

**Best for**:
- Deadline compliance
- End boundaries
- Cutoff dates
- Inclusive ranges

**Performance**: Excellent

### Date Range Operators

#### Between Dates
**Purpose**: Inclusive date range
**Usage**: Find dates within specified period
**Inclusion**: Includes both start and end dates

```
Example: Purchase Date between 2024-01-01 and 2024-03-31
Matches: 2024-01-01, 2024-02-15, 2024-03-31
Does not match: 2023-12-31, 2024-04-01
```

**Best for**:
- Quarterly reports
- Date ranges
- Seasonal analysis
- Period-based filtering

**Performance**: Excellent

### Relative Date Operators

#### Last N Days
**Purpose**: Rolling window of recent days
**Usage**: Find records from specified number of days ago until now
**Dynamic**: Updates automatically as current date changes

```
Example: Login Date last 30 days
If today is 2024-03-15
Matches: 2024-02-14 through 2024-03-15
```

**Best for**:
- Recent activity
- Rolling windows
- Dynamic reporting
- Activity monitoring

**Performance**: Good

#### Next N Days
**Purpose**: Rolling window of upcoming days
**Usage**: Find records from now until specified number of days in future

```
Example: Appointment Date next 7 days
If today is 2024-03-15
Matches: 2024-03-15 through 2024-03-22
```

**Best for**:
- Upcoming events
- Near-term planning
- Reminder systems
- Schedule management

**Performance**: Good

### Predefined Period Operators

#### Today
**Purpose**: Current day only
**Usage**: Find records from today
**Time Zone**: Uses user's local timezone

```
Example: Transaction Date today
Matches: Any time on current date
```

#### This Week
**Purpose**: Current week (Monday through Sunday)
**Usage**: Find records from current week

#### This Month
**Purpose**: Current calendar month
**Usage**: Find records from current month

#### This Quarter
**Purpose**: Current 3-month quarter
**Usage**: Find records from current quarter (Q1: Jan-Mar, Q2: Apr-Jun, etc.)

#### This Year
**Purpose**: Current calendar year
**Usage**: Find records from current year

#### Yesterday
**Purpose**: Previous day only
**Usage**: Find records from yesterday

#### Last Week
**Purpose**: Previous complete week
**Usage**: Find records from last complete Monday-Sunday period

#### Last Month
**Purpose**: Previous complete month
**Usage**: Find records from last complete calendar month

#### Last Quarter
**Purpose**: Previous complete quarter
**Usage**: Find records from last complete 3-month period

#### Last Year
**Purpose**: Previous complete year
**Usage**: Find records from last complete calendar year

## List and Set Operators

### Multiple Value Operators

#### In List
**Purpose**: Match any value from specified list
**Usage**: Find records where column value is one of several options
**Performance**: Optimized for small to medium lists

```
Example: Country in ["USA", "Canada", "Mexico"]
Matches: Records with Country = "USA" OR "Canada" OR "Mexico"
Does not match: "Brazil", "Germany", "Japan"
```

**Best for**:
- Multiple category selection
- Region grouping
- Status lists
- Allowed values

**List Size Recommendations**:
- **Small (1-10 items)**: Excellent performance
- **Medium (11-100 items)**: Good performance
- **Large (100+ items)**: Consider alternatives

#### Not In List
**Purpose**: Exclude any value from specified list
**Usage**: Find records where column value is not one of several options

```
Example: Status not in ["Deleted", "Suspended", "Archived"]
Matches: "Active", "Pending", "Trial", etc.
Does not match: "Deleted", "Suspended", "Archived"
```

**Best for**:
- Excluding multiple statuses
- Filtering out test data
- Removing multiple categories
- Blacklist filtering

### List Input Methods

#### Manual Entry
- **Comma Separated**: "USA, Canada, Mexico"
- **Line Separated**: One value per line
- **Space Separated**: "USA Canada Mexico"

#### File Upload
- **Text File**: Upload .txt file with values
- **CSV File**: Use first column of CSV
- **One Per Line**: Standard list format

#### Column Values
- **Unique Values**: Select from existing column values
- **Frequent Values**: Choose from most common values
- **All Values**: Complete list of column values

## Existence and Null Operators

### Null Value Operators

#### Is Empty / Is Null
**Purpose**: Find records with no value
**Usage**: Identify missing data
**Empty Definition**: Configurable (null, empty string, whitespace)

```
Example: Phone Number is empty
Matches: NULL, "", "   " (if whitespace counts as empty)
Does not match: "123-456-7890", "N/A", "Unknown"
```

**Best for**:
- Data quality auditing
- Missing information identification
- Required field validation
- Incomplete records

#### Is Not Empty / Is Not Null
**Purpose**: Find records with any value
**Usage**: Identify complete data

```
Example: Email Address is not empty
Matches: "user@example.com", "test@test.com", even "invalid"
Does not match: NULL, "", "   " (if whitespace counts as empty)
```

**Best for**:
- Complete records
- Data availability checks
- Required field compliance
- Contact filtering

#### Has Value
**Purpose**: Records with meaningful data
**Usage**: More strict than "not empty" - excludes placeholder values
**Exclusions**: Configurable list of placeholder values

```
Example: Company Name has value
Excludes: NULL, "", "N/A", "Unknown", "TBD", "None"
Matches: Any other non-placeholder value
```

**Best for**:
- Meaningful data filtering
- Excluding placeholders
- Quality data selection
- Business intelligence

## Operator Performance Guide

### High Performance Operators
These operators typically execute very quickly:
- **Equality operators** (=, ≠) on indexed columns
- **Numeric comparisons** (>, <, >=, <=) on indexed columns
- **Date comparisons** on indexed date columns
- **Between operators** on indexed ranges
- **In list** with small lists on indexed columns

### Moderate Performance Operators
These operators have reasonable performance:
- **Text contains** on moderate-length text
- **Starts with** on text columns
- **Date range** operators
- **Statistical operators** (average, percentile) on smaller datasets
- **In list** with medium-sized lists

### Lower Performance Operators
Use these carefully on large datasets:
- **Text pattern matching** with wildcards or regex
- **Ends with** on large text fields
- **Statistical operators** on large datasets
- **Complex calculations** (percentiles, top/bottom N)
- **In list** with very large lists

### Performance Optimization Tips

#### Index Strategy
- Ensure frequently filtered columns have database indexes
- Use composite indexes for multi-column filters
- Consider covering indexes for complex queries

#### Filter Ordering
- Apply most selective filters first
- Use high-performance operators before low-performance ones
- Combine multiple conditions to increase selectivity

#### Data Type Matching
- Use appropriate data types (numeric for numbers, dates for dates)
- Avoid text operations on numeric data
- Ensure consistent data formats

## Common Operator Combinations

### Customer Segmentation
```
Age >= 18 AND Age <= 65                    (Working age)
AND Income > 50000                         (High income)
AND Status in ["Active", "Premium"]       (Good standing)
AND Last Purchase >= Last 90 days         (Recent activity)
```

### Data Quality Auditing
```
Email not contains "@"                     (Invalid email)
OR Phone is empty                          (Missing phone)
OR Created Date > Today                    (Future dates)
OR Age < 0                                 (Invalid age)
```

### Sales Performance Analysis
```
Sale Date this quarter                     (Current period)
AND Amount > 1000                          (High value)
AND Sales Rep not in ["Training", "Demo"] (Real sales)
AND Product Category = "Software"         (Specific product)
```

### Compliance and Security
```
Country in [EU_Countries_List]             (Geographic scope)
AND Consent Date >= 2018-05-25           (GDPR compliance)
AND Marketing Opt In = true               (Permission)
AND Data Subject Rights ≠ "Delete"       (Active consent)
```

## Troubleshooting Operators

### Common Issues and Solutions

#### No Results When Expected
**Problem**: Filter returns no results but data should exist
**Causes & Solutions**:
1. **Case sensitivity**: Check case-sensitive settings
2. **Data type mismatch**: Ensure proper data type usage
3. **Hidden characters**: Check for leading/trailing spaces
4. **Date format**: Verify date format consistency
5. **Logic errors**: Review AND/OR combinations

#### Too Many Results
**Problem**: Filter returns more results than expected
**Causes & Solutions**:
1. **Case insensitivity**: Enable case-sensitive matching
2. **Partial matching**: Use exact operators instead of contains
3. **OR instead of AND**: Review filter logic
4. **Missing conditions**: Add additional filter criteria

#### Performance Issues
**Problem**: Filter takes too long to execute
**Causes & Solutions**:
1. **Missing indexes**: Add database indexes
2. **Inefficient operators**: Use simpler operators when possible
3. **Large datasets**: Apply more selective filters first
4. **Complex patterns**: Simplify regex or wildcard patterns

#### Unexpected Results
**Problem**: Filter returns unexpected data
**Causes & Solutions**:
1. **Data quality**: Check source data for inconsistencies
2. **Operator understanding**: Verify operator behavior
3. **Logic precedence**: Use parentheses to clarify logic
4. **Null handling**: Configure null value treatment

## Best Practices

### Operator Selection
1. **Match Purpose**: Choose operators that match your intent
2. **Consider Performance**: Use efficient operators when possible
3. **Data Type Alignment**: Use appropriate operators for data types
4. **Test Thoroughly**: Verify operators work with your data

### Query Design
1. **Start Simple**: Begin with basic operators, add complexity gradually
2. **Test Incrementally**: Verify each operator addition
3. **Document Logic**: Comment complex operator combinations
4. **Consider Maintenance**: Choose operators that are easy to understand

### Performance Optimization
1. **Index-Friendly**: Prefer operators that can use indexes
2. **Selectivity First**: Use most selective operators early
3. **Avoid Expensive Operations**: Minimize regex and complex calculations
4. **Monitor Performance**: Track query execution times

## Related Features

Operators work with:
- **Filter Types**: Appropriate operators for each data type
- **Query Builder**: Visual interface for operator selection
- **Combining Filters**: AND/OR logic with multiple operators
- **SQL Preview**: See how operators translate to SQL

## Next Steps

- Learn about [Combining Filters](combining-filters.md) for complex logic
- Explore [Filter Types](filter-types.md) to understand data-specific operators
- Check [Query Builder Overview](overview.md) for the complete visual interface
- Review [Performance Optimization](../advanced-querying/performance.md) for efficient queries