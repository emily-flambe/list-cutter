---
title: Row Filtering Guide
category: Features
subcategory: CSV Cutting
keywords: row filtering, data filtering, conditional logic, query conditions, data selection
difficulty: intermediate
---

# Row Filtering Guide

## Complete Guide to Filtering Rows

Row filtering allows you to select specific rows from your CSV data based on conditions you define. This powerful feature helps you extract exactly the data you need by applying logical conditions to your dataset.

## Understanding Row Filtering

### What is Row Filtering?
Row filtering is the process of selecting rows that meet specific criteria while excluding rows that don't. It's like having a smart search that can:
- Find rows with specific values
- Match patterns in text fields
- Compare numeric values
- Filter by date ranges
- Combine multiple conditions

### Why Filter Rows?
- **Reduce Data Volume**: Work with only relevant records
- **Focus Analysis**: Extract specific time periods, categories, or segments
- **Remove Outliers**: Exclude invalid or extreme values
- **Create Subsets**: Generate targeted datasets for specific purposes
- **Improve Performance**: Smaller datasets load and process faster

## Basic Filtering Concepts

### Filter Components
Every filter consists of:
1. **Column**: Which field to examine
2. **Operator**: How to compare the values
3. **Value**: What to compare against
4. **Logic**: How to combine with other filters (AND/OR)

### Filter Logic Flow
```
IF [Column] [Operator] [Value] 
THEN include row in results
ELSE exclude row from results
```

### Example Filter
```
Column: "Age" 
Operator: "greater than" 
Value: "18"
Result: Only rows where Age > 18
```

## Creating Basic Filters

### Step 1: Add a Filter
1. Click **Add Filter** button
2. Select the column to filter on
3. Choose comparison operator
4. Enter the value to compare against
5. Preview results immediately

### Step 2: Choose Your Column
Select from available columns:
- **Text Columns**: Names, descriptions, categories
- **Numeric Columns**: Ages, amounts, quantities, scores
- **Date Columns**: Created dates, timestamps, deadlines
- **Boolean Columns**: True/false, yes/no values

### Step 3: Select Operator
Choose the appropriate comparison:
- **Equals**: Exact match
- **Not Equals**: Everything except exact match
- **Contains**: Text includes specified substring
- **Starts With**: Text begins with specified string
- **Ends With**: Text concludes with specified string
- **Greater Than**: Numeric values above threshold
- **Less Than**: Numeric values below threshold
- **Between**: Values within specified range

### Step 4: Enter Value
Provide the comparison value:
- **Text Values**: Enter text to match
- **Numeric Values**: Enter numbers
- **Date Values**: Use date picker or enter YYYY-MM-DD format
- **List Values**: Select from dropdown of unique values

## Text Filtering

### Exact Text Matching

#### Equals Filter
Find rows with exact text match:
```
Column: Status
Operator: Equals
Value: "Active"
Result: Only rows where Status is exactly "Active"
```

#### Case Sensitivity
Text matching options:
- **Case Sensitive**: "Active" ≠ "active"
- **Case Insensitive**: "Active" = "active" = "ACTIVE"
- **Default**: Case insensitive for user-friendly searching

### Pattern Matching

#### Contains Filter
Find rows containing specific text:
```
Column: Product Name
Operator: Contains
Value: "iPhone"
Result: "iPhone 12", "iPhone 13 Pro", "iPhone SE"
```

#### Starts With Filter
Find rows beginning with specific text:
```
Column: Customer ID
Operator: Starts With
Value: "CUST"
Result: "CUST001", "CUST002", "CUSTXYZ"
```

#### Ends With Filter
Find rows ending with specific text:
```
Column: Email
Operator: Ends With
Value: "@company.com"
Result: All company email addresses
```

### Advanced Text Filtering

#### Wildcard Patterns
Use wildcards for flexible matching:
- **\* (asterisk)**: Matches any number of characters
- **? (question mark)**: Matches exactly one character

Examples:
```
"A*" → Matches "Apple", "Amazon", "A"
"?at" → Matches "cat", "bat", "hat" but not "that"
"test*data" → Matches "test_data", "testingdata", "test123data"
```

#### Regular Expressions
For complex pattern matching:
```
Column: Phone Number
Pattern: ^\d{3}-\d{3}-\d{4}$
Result: Matches "123-456-7890" format only
```

#### Multiple Value Matching
Filter for multiple specific values:
```
Column: Department
Operator: In List
Values: ["Sales", "Marketing", "Support"]
Result: Rows where Department is any of the three values
```

## Numeric Filtering

### Basic Numeric Comparisons

#### Greater Than
```
Column: Salary
Operator: Greater Than
Value: 50000
Result: All salaries above $50,000
```

#### Less Than or Equal
```
Column: Age
Operator: Less Than or Equal
Value: 65
Result: All ages 65 and under
```

#### Between Range
```
Column: Score
Operator: Between
Min Value: 80
Max Value: 95
Result: Scores from 80 to 95 (inclusive)
```

### Advanced Numeric Filtering

#### Not Equal
Exclude specific values:
```
Column: Quantity
Operator: Not Equal
Value: 0
Result: All non-zero quantities
```

#### Top/Bottom N Values
Filter for extreme values:
```
Column: Revenue
Operator: Top N
Value: 10
Result: Top 10 highest revenue records
```

#### Percentile Filtering
Filter by statistical ranges:
```
Column: Response Time
Operator: Above 95th Percentile
Result: Slowest 5% of responses
```

## Date and Time Filtering

### Date Range Filtering

#### Specific Date Range
```
Column: Order Date
Operator: Between
Start Date: 2024-01-01
End Date: 2024-03-31
Result: Q1 2024 orders
```

#### Relative Date Ranges
```
Column: Created Date
Operator: Last N Days
Value: 30
Result: Records created in the last 30 days
```

### Date Comparison Operators

#### Before/After Dates
```
Column: Due Date
Operator: After
Value: 2024-12-31
Result: Items due after end of 2024
```

#### Date Equality
```
Column: Event Date
Operator: Equals
Value: 2024-07-04
Result: Events on July 4th, 2024
```

### Relative Date Filters

#### Time-Based Ranges
- **Today**: Records from today only
- **Yesterday**: Records from yesterday only
- **This Week**: Current week (Monday-Sunday)
- **This Month**: Current calendar month
- **This Quarter**: Current 3-month quarter
- **This Year**: Current calendar year

#### Dynamic Ranges
- **Last 7 Days**: Rolling 7-day window
- **Last 30 Days**: Rolling 30-day window
- **Last 90 Days**: Rolling 90-day window
- **Last 12 Months**: Rolling 12-month period

## Combining Multiple Filters

### AND Logic
All conditions must be true:
```
Filter 1: Age > 18
AND
Filter 2: Department = "Sales"
Result: Adult sales employees only
```

### OR Logic
Any condition can be true:
```
Filter 1: Status = "VIP"
OR
Filter 2: Purchase Amount > 10000
Result: VIP customers OR high-value purchases
```

### Complex Logic Groups
Combine AND and OR logic:
```
(Age > 18 AND Age < 65) 
AND 
(Department = "Sales" OR Department = "Marketing")
Result: Working-age employees in Sales or Marketing
```

### Nested Filter Groups
Create sophisticated filter logic:
```
Group 1: (Country = "USA" OR Country = "Canada")
AND
Group 2: (Premium Member = true OR Lifetime Value > 5000)
Result: North American high-value customers
```

## Filter Management

### Saving Filters
Save commonly used filters:
1. Create your filter combination
2. Click **Save Filter**
3. Give it a descriptive name
4. Access from **Saved Filters** menu

### Filter Templates
Common filter patterns:
- **Active Customers**: Status = "Active" AND Last Purchase > Last 90 Days
- **High Value**: Purchase Amount > $1000 OR Lifetime Value > $10000
- **Recent Activity**: Created Date > Last 30 Days
- **Problem Records**: Status = "Error" OR Missing Required Fields

### Sharing Filters
Share filter configurations:
- Export filter as JSON
- Share filter URL with parameters
- Copy filter to other files
- Create team filter library

## Performance Optimization

### Filter Efficiency

#### Indexed Columns
Faster filtering on:
- Primary key columns
- Date columns
- Status/category columns
- Numeric ID fields

#### Slow Filter Types
Be cautious with:
- Text pattern matching with wildcards
- Complex regular expressions
- Multiple OR conditions
- Filters on calculated fields

### Best Practices

#### Order Filters by Selectivity
Place most selective filters first:
1. **High Selectivity**: Status = "Active" (if rare)
2. **Medium Selectivity**: Date ranges
3. **Low Selectivity**: Text contains patterns

#### Use Appropriate Data Types
- Filter dates as dates, not text
- Filter numbers as numbers, not text
- Use boolean filters for yes/no fields

#### Limit Complex Patterns
- Simple contains is faster than regex
- Exact matches are faster than patterns
- Multiple simple filters often better than one complex filter

## Common Filtering Scenarios

### Customer Analysis
```
Goal: Find high-value recent customers
Filters:
- Customer Since > 2023-01-01 (recent)
- Total Purchases > $5000 (high-value)
- Status = "Active" (current customers)
- Email Contains "@" (valid email)
```

### Sales Reporting
```
Goal: Q4 sales performance
Filters:
- Sale Date Between 2024-10-01 AND 2024-12-31
- Amount > 0 (exclude refunds)
- Sales Rep ≠ "Training Account"
- Product Category In ["Electronics", "Software"]
```

### Data Quality
```
Goal: Find incomplete records
Filters:
- Name = "" (empty names)
- OR Phone = "" (empty phone)
- OR Email Not Contains "@" (invalid email)
- OR Created Date > Tomorrow (future dates)
```

### Compliance Filtering
```
Goal: GDPR compliance subset
Filters:
- Country In ["Germany", "France", "Italy", "Spain"]
- Consent Date > 2018-05-25 (GDPR effective date)
- Opt Out ≠ "Yes"
- Data Subject Rights ≠ "Deletion Requested"
```

## Troubleshooting Filters

### No Results Returned

#### Check Filter Logic
- Verify AND/OR logic is correct
- Ensure filters aren't contradictory
- Test each filter individually

#### Verify Data Values
- Check for typos in filter values
- Verify data exists in selected columns
- Look for data type mismatches

#### Review Filter Conditions
- Ensure date formats are correct
- Check numeric values for decimals
- Verify text case sensitivity

### Too Many Results

#### Add More Specific Filters
- Narrow date ranges
- Add additional conditions
- Use more specific text matches

#### Check Filter Combinations
- Verify AND logic where OR was intended
- Add missing filter conditions
- Review filter group logic

### Performance Issues

#### Simplify Complex Filters
- Break down complex regex patterns
- Use multiple simple filters instead
- Avoid wildcards at beginning of text

#### Optimize Filter Order
- Put most selective filters first
- Use indexed columns when possible
- Consider pre-filtering large datasets

## Advanced Filtering Techniques

### Null Value Handling
Filter for missing data:
```
Column: Phone Number
Operator: Is Empty
Result: Records without phone numbers

Column: Last Login
Operator: Is Not Empty
Result: Users who have logged in
```

### Statistical Filtering
Use statistical measures:
```
Column: Response Time
Operator: Above Average
Result: Above-average response times

Column: Sales Amount
Operator: Within 2 Standard Deviations
Result: Normal sales amounts (exclude outliers)
```

### Dynamic Value Filtering
Filter based on calculated values:
```
Column: Days Since Last Purchase
Operator: Greater Than
Value: 90
Result: Customers inactive for 90+ days
```

## Filter Export and Documentation

### Documenting Filters
Keep track of your filtering logic:
- Save filter descriptions
- Document business logic
- Note any data quality assumptions
- Record performance considerations

### Exporting Filter Configurations
Save and share filter setups:
```json
{
  "filterName": "Active High-Value Customers",
  "filters": [
    {
      "column": "status",
      "operator": "equals",
      "value": "active",
      "logic": "AND"
    },
    {
      "column": "lifetime_value",
      "operator": "greater_than",
      "value": 10000,
      "logic": "AND"
    }
  ]
}
```

## Related Features

Row filtering integrates with:
- **Column Selection**: Filter rows, then select specific columns
- **Query Builder**: Visual interface for complex filter combinations
- **Export Options**: Apply filters before export
- **SQL Preview**: See the SQL generated by your filters

## Next Steps

- Explore [Export Options](export-options.md) to customize your filtered output
- Learn about the [Query Builder](../query-builder/overview.md) for visual filter creation
- Check [Combining Filters](../query-builder/combining-filters.md) for advanced logic
- Review [Operators Guide](../query-builder/operators.md) for all available comparisons