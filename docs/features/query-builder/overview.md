---
title: Query Builder Overview
category: Features
subcategory: Query Builder
keywords: query builder, visual query, sql generation, filter builder, data query interface
difficulty: beginner
---

# Query Builder Overview

## Visual Query Construction Made Simple

The Query Builder is Cutty's visual interface for creating complex data queries without writing SQL code. It provides an intuitive, drag-and-drop experience for building sophisticated filters and data selections.

## What is the Query Builder?

### Visual Query Interface
The Query Builder transforms complex data filtering into a visual, point-and-click experience:
- **Drag-and-Drop**: Add filters by dragging columns
- **Visual Logic**: See AND/OR relationships clearly
- **Real-Time Preview**: Instant results as you build
- **SQL Generation**: Automatic SQL query creation
- **No Coding Required**: Build complex queries visually

### Bridge to SQL
For users learning SQL or needing to use queries elsewhere:
- **Live SQL Preview**: See generated SQL in real-time
- **Copy SQL**: Export queries for use in other tools
- **Learn by Example**: Understand SQL through visual examples
- **Validation**: Ensure SQL syntax is correct

## Why Use the Query Builder?

### Accessibility
Make data querying accessible to everyone:
- **No SQL Knowledge**: Create complex queries without programming
- **Visual Learning**: Understand query logic through visual representation
- **Error Prevention**: Avoid syntax errors and typos
- **Guided Interface**: Step-by-step query construction

### Power and Flexibility
Build sophisticated queries:
- **Complex Logic**: Combine multiple conditions with AND/OR
- **Nested Conditions**: Create grouped filter logic
- **Multiple Data Types**: Work with text, numbers, dates, and booleans
- **Advanced Operators**: Use contains, ranges, comparisons, and more

### Productivity
Speed up your data analysis:
- **Quick Iteration**: Rapidly test different filter combinations
- **Reusable Queries**: Save and reuse common filter patterns
- **Template Library**: Start with predefined query templates
- **Instant Results**: See filtered data immediately

## Query Builder Interface

### Main Components

#### Column Panel
Left sidebar showing available columns:
- **Data Type Icons**: Visual indicators for text, number, date types
- **Sample Values**: Preview actual data in each column
- **Search**: Find columns quickly in large datasets
- **Favorites**: Mark frequently used columns

#### Query Canvas
Central area for building your query:
- **Filter Blocks**: Visual representations of each condition
- **Logic Connectors**: AND/OR connections between filters
- **Grouping**: Visual groups for complex logic
- **Drag Zones**: Areas for dropping new filters

#### Preview Panel
Right sidebar showing results:
- **Live Preview**: Real-time filtered data
- **Row Count**: Number of matching records
- **Sample Data**: Preview of actual results
- **Export Options**: Direct export from preview

### Visual Elements

#### Filter Blocks
Each filter appears as a visual block showing:
- **Column Name**: Which field is being filtered
- **Operator**: How the comparison is made
- **Value**: What to compare against
- **Logic**: Connection to other filters (AND/OR)

#### Logic Flow
Visual representation of query logic:
- **Vertical Lines**: Show AND connections
- **Brackets**: Indicate OR groupings
- **Indentation**: Nested logic levels
- **Color Coding**: Different logic types

#### Group Containers
Visual containers for complex logic:
- **Rounded Rectangles**: Group related conditions
- **Nested Groups**: Groups within groups
- **Group Labels**: Descriptive names for logic groups
- **Collapse/Expand**: Hide complex groups when not needed

## Building Your First Query

### Step 1: Start Simple
Begin with a single filter:
1. Drag a column from the left panel
2. Drop it onto the query canvas
3. Choose your operator (equals, contains, etc.)
4. Enter your filter value
5. See results appear in preview

### Step 2: Add Conditions
Build complexity gradually:
1. Drag another column to the canvas
2. Choose AND or OR logic
3. Configure the new filter
4. Preview updates automatically

### Step 3: Test and Refine
Verify your query works:
1. Check row count in preview
2. Sample a few result records
3. Adjust filters as needed
4. Test edge cases

### Step 4: Save or Export
Preserve your work:
1. Save query for reuse
2. Export filtered data
3. Copy SQL for other tools
4. Share with team members

## Query Types and Patterns

### Simple Filters
Basic single-condition queries:
```
Visual: [Status] [equals] [Active]
SQL: WHERE status = 'Active'
Use Case: Find all active records
```

### Multiple Conditions (AND)
All conditions must be true:
```
Visual: [Age] [greater than] [18] AND [Status] [equals] [Active]
SQL: WHERE age > 18 AND status = 'Active'
Use Case: Adult active users
```

### Alternative Conditions (OR)
Any condition can be true:
```
Visual: [Priority] [equals] [High] OR [Priority] [equals] [Urgent]
SQL: WHERE priority = 'High' OR priority = 'Urgent'
Use Case: High-priority items
```

### Grouped Logic
Complex combinations:
```
Visual: ([Age] [greater than] [18] AND [Age] [less than] [65]) 
        AND 
        ([Status] [equals] [Active] OR [Status] [equals] [Trial])
SQL: WHERE (age > 18 AND age < 65) AND (status = 'Active' OR status = 'Trial')
Use Case: Working-age active or trial users
```

### Range Queries
Values within specific ranges:
```
Visual: [Date] [between] [2024-01-01] [and] [2024-12-31]
SQL: WHERE date BETWEEN '2024-01-01' AND '2024-12-31'
Use Case: Records from specific year
```

## Advanced Query Features

### Nested Groups
Create sophisticated logic structures:
- **Multiple Levels**: Groups within groups
- **Clear Hierarchy**: Visual indentation shows structure
- **Easy Editing**: Modify nested logic without confusion
- **Performance**: Optimized SQL generation

### Dynamic Values
Use dynamic placeholders in queries:
- **Today's Date**: Always use current date
- **User Variables**: Reference current user information
- **Calculated Values**: Use computed values in filters
- **Relative Dates**: "Last 30 days", "This month", etc.

### Query Templates
Start with predefined patterns:
- **Customer Analysis**: Common customer segmentation queries
- **Sales Reports**: Typical sales filtering patterns
- **Data Quality**: Standard data validation queries
- **Compliance**: Regulatory filtering requirements

### Advanced Operators
Beyond basic comparisons:
- **Pattern Matching**: Contains, starts with, ends with
- **List Membership**: In list, not in list
- **Null Checking**: Is empty, is not empty
- **Fuzzy Matching**: Approximate string matching

## SQL Preview and Learning

### Live SQL Generation
See SQL as you build:
- **Real-Time Updates**: SQL changes as you modify query
- **Syntax Highlighting**: Color-coded SQL for readability
- **Formatted Output**: Pretty-printed SQL structure
- **Copy Function**: One-click copy for external use

### Learning SQL
Use Query Builder to understand SQL:
- **Visual to Code**: See how visual elements become SQL
- **Pattern Recognition**: Learn common SQL patterns
- **Experimentation**: Try different visual combinations
- **Reference Guide**: Built-in SQL operator reference

### SQL Export Options
Multiple SQL format options:
- **Standard SQL**: ANSI SQL compatible
- **Database-Specific**: MySQL, PostgreSQL, SQL Server formats
- **Embedded**: SQL ready for application code
- **Parameterized**: SQL with parameter placeholders

## Performance and Optimization

### Query Efficiency
The Query Builder helps create efficient queries:
- **Index-Friendly**: Suggests indexed columns for filtering
- **Selectivity Ordering**: Places most selective filters first
- **Join Optimization**: Optimizes multi-table relationships
- **Resource Monitoring**: Shows query performance metrics

### Large Dataset Handling
Optimize for big data:
- **Progressive Filtering**: Apply broad filters first
- **Sampling**: Test queries on data samples
- **Parallel Processing**: Utilize multiple CPU cores
- **Memory Management**: Stream results for large datasets

### Query Validation
Ensure query quality:
- **Syntax Checking**: Validate SQL before execution
- **Logic Verification**: Check for contradictory conditions
- **Performance Estimation**: Predict query execution time
- **Result Validation**: Verify output makes sense

## Common Use Cases

### Customer Segmentation
Build customer analysis queries:
```
Goal: High-value recent customers
Visual Query:
- Customer Since > Last 12 Months
- AND Total Purchases > $1000
- AND Status = Active
- AND Email Contains "@"
```

### Sales Analysis
Create sales performance queries:
```
Goal: Q4 performance by region
Visual Query:
- Sale Date BETWEEN Oct 1 AND Dec 31
- AND Amount > 0
- AND Region IN [North, South, East, West]
- AND Sales Rep ≠ Training Account
```

### Data Quality Auditing
Find data quality issues:
```
Goal: Incomplete customer records
Visual Query:
- Name IS EMPTY
- OR Phone IS EMPTY  
- OR Email NOT CONTAINS "@"
- OR Created Date > TODAY
```

### Compliance Reporting
Generate compliance datasets:
```
Goal: GDPR-relevant European customers
Visual Query:
- Country IN [EU Country List]
- AND Consent Date >= 2018-05-25
- AND Opt Out ≠ Yes
- AND Data Subject Rights ≠ Deletion Requested
```

## Query Management

### Saving Queries
Preserve your query designs:
- **Named Queries**: Give descriptive names
- **Query Description**: Document purpose and logic
- **Tag System**: Organize queries by category
- **Version Control**: Track query changes over time

### Sharing and Collaboration
Work with team members:
- **Share Links**: Send query URLs to colleagues
- **Export/Import**: Share query definitions
- **Team Libraries**: Organization-wide query collections
- **Permission Control**: Manage who can view/edit queries

### Query History
Track your query evolution:
- **Execution History**: See past query runs
- **Performance Metrics**: Compare query performance over time
- **Result Caching**: Reuse recent query results
- **Rollback**: Return to previous query versions

## Integration with Other Features

### Column Selection
Combine with column management:
- **Pre-Select Columns**: Choose columns before building query
- **Dynamic Column Selection**: Change columns based on query results
- **Column Dependencies**: Show which columns are needed for query

### Export Workflows
Seamless export integration:
- **Direct Export**: Export query results immediately
- **Scheduled Exports**: Run queries automatically
- **Format Options**: Export in various formats
- **Delivery Methods**: Send results via email, API, etc.

### File Management
Organize query-based files:
- **Query-Generated Files**: Track files created from queries
- **Lineage Tracking**: See which queries generated which files
- **Automated Naming**: Generate filenames from query criteria

## Troubleshooting Query Builder

### Common Issues

#### No Results Returned
**Causes**: Overly restrictive filters, contradictory logic
**Solutions**:
1. Test each filter individually
2. Check for AND vs OR logic errors
3. Verify data values exist
4. Use preview to debug step-by-step

#### Slow Query Performance
**Causes**: Complex logic, large datasets, inefficient filters
**Solutions**:
1. Apply most selective filters first
2. Use indexed columns when possible
3. Break complex queries into stages
4. Consider data sampling for testing

#### Unexpected Results
**Causes**: Logic errors, data type mismatches, case sensitivity
**Solutions**:
1. Review filter logic carefully
2. Check data types in preview
3. Test with known data values
4. Verify case sensitivity settings

## Best Practices

### Query Design
1. **Start Simple**: Begin with basic filters, add complexity gradually
2. **Test Incrementally**: Verify each addition works correctly
3. **Use Meaningful Names**: Give queries descriptive names
4. **Document Logic**: Add comments explaining complex conditions

### Performance Optimization
1. **Filter Early**: Apply selective filters first
2. **Use Indexed Columns**: Prefer columns with indexes for filtering
3. **Avoid Wildcards**: Minimize use of starts-with patterns
4. **Test with Samples**: Verify performance on smaller datasets

### Collaboration
1. **Share Knowledge**: Document and share useful query patterns
2. **Use Templates**: Create reusable query templates
3. **Version Control**: Track important query changes
4. **Training**: Help team members learn query building

## Related Features

Query Builder works seamlessly with:
- **CSV Cutting**: Use queries to filter data for cutting
- **SQL Preview**: See and copy generated SQL code
- **File Management**: Save and organize query results
- **Export Options**: Configure output format for query results

## Next Steps

- Learn about [Filter Types](filter-types.md) available in the Query Builder
- Explore [Operators Guide](operators.md) for all comparison options
- Master [Combining Filters](combining-filters.md) for complex logic
- Check out [SQL Preview](../sql-preview/overview.md) to understand generated queries