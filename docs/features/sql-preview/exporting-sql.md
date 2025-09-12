---
title: Exporting SQL Queries
description: How to copy and use generated SQL in other database tools
category: Features
subcategory: SQL Preview
order: 4
last_updated: 2024-09-09
---

# Exporting SQL Queries

Learn how to copy SQL queries from Cutty and use them in other database tools, business intelligence platforms, or data analysis applications.

## Copying SQL to Clipboard

### Basic Copy Operation

1. **Open SQL Preview**: Expand the SQL Preview panel below your filters
2. **Review the SQL**: Make sure the generated query matches your requirements
3. **Click Copy Button**: Use the "Copy SQL" button to copy the entire query
4. **Confirmation**: A green success message confirms the SQL was copied

### Copy Process

The copy operation:
- Copies the complete, formatted SQL query
- Includes proper line breaks and indentation
- Preserves all quotes and special characters
- Works with any query length

### Troubleshooting Copy Issues

If copying fails:
- **Browser Security**: Some browsers block clipboard access on non-HTTPS sites
- **Browser Extensions**: Ad blockers might interfere with clipboard operations
- **Manual Copy**: Select all text in the SQL preview and use Ctrl+C (Windows) or Cmd+C (Mac)

## Using Exported SQL

### Database Management Tools

The exported SQL works with most database tools:

#### MySQL Workbench
1. Open a new SQL tab
2. Paste the query
3. Replace table name if needed: `FROM your_table_name`
4. Execute the query

#### PostgreSQL (pgAdmin)
1. Open Query Tool
2. Paste the SQL
3. Modify for PostgreSQL syntax if needed
4. Run the query

#### SQLite Browser
1. Go to Execute SQL tab
2. Paste the query
3. Update table name to match your database
4. Execute

#### Microsoft SQL Server Management Studio
1. New Query window
2. Paste the SQL
3. Adjust for SQL Server syntax
4. Execute

### Modifications for Different Databases

While Cutty generates standard SQL, you may need minor adjustments:

#### Table Names
Replace the default table name with your actual table:
```sql
-- Cutty generates:
SELECT * FROM data WHERE "Name" = 'John'

-- Change to your table:
SELECT * FROM employees WHERE "Name" = 'John'
```

#### Column Quotes
Some databases prefer different quoting:
```sql
-- Cutty uses double quotes:
SELECT * FROM data WHERE "First Name" = 'John'

-- MySQL prefers backticks:
SELECT * FROM data WHERE `First Name` = 'John'

-- SQL Server uses square brackets:
SELECT * FROM data WHERE [First Name] = 'John'
```

## Business Intelligence Tools

### Power BI
1. **Get Data** → **Blank Query**
2. **Advanced Editor**
3. Paste SQL in the query editor
4. Configure data source connection

### Tableau
1. **Connect to Data** → **Custom SQL**
2. Paste the Cutty-generated SQL
3. Replace table references with your data source
4. Create visualizations

### Looker/LookML
Use the SQL as a base for creating LookML views:
```lookml
view: filtered_data {
  sql_table_name: (
    SELECT * FROM data 
    WHERE "Department" = 'Sales'
      AND "Active" = TRUE
  ) ;;
}
```

### Excel Power Query
1. **Data** → **Get Data** → **From Database**
2. Choose your database type
3. Use **Advanced Options** to paste custom SQL
4. Import the filtered data

## Programming Languages

### Python (pandas)
```python
import pandas as pd
import sqlite3

# Connect to database
conn = sqlite3.connect('your_database.db')

# Use Cutty-generated SQL
sql = """
SELECT * FROM data
WHERE "Age" > 25
  AND "Department" = 'Sales'
"""

# Execute and get results
df = pd.read_sql_query(sql, conn)
```

### R
```r
library(DBI)
library(RSQLite)

# Connect to database
con <- dbConnect(RSQLite::SQLite(), "your_database.db")

# Use Cutty-generated SQL
sql <- "
SELECT * FROM data
WHERE \"Age\" > 25
  AND \"Department\" = 'Sales'
"

# Execute query
result <- dbGetQuery(con, sql)
```

### Node.js
```javascript
const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('your_database.db');

// Cutty-generated SQL
const sql = `
  SELECT * FROM data
  WHERE "Age" > 25
    AND "Department" = 'Sales'
`;

// Execute query
db.all(sql, [], (err, rows) => {
  if (err) {
    throw err;
  }
  console.log(rows);
});
```

## Adapting for Different Data Sources

### CSV Files
If your original data is in CSV format:
1. Import CSV into a database first
2. Replace table name in the SQL
3. Ensure column names match exactly

### API Data
For REST APIs that support SQL-like queries:
1. Convert SQL WHERE conditions to API parameters
2. Use the filter logic as a reference
3. Implement the same filtering in your API calls

### Spreadsheet Applications

#### Google Sheets QUERY Function
Convert SQL to Google Sheets syntax:
```sql
-- Cutty SQL:
SELECT * FROM data WHERE "Age" > 25

-- Google Sheets:
=QUERY(A:Z, "SELECT * WHERE B > 25")
```

#### Excel Filters
Use the SQL logic to set up Excel AutoFilters:
1. Identify the filter conditions from the SQL
2. Apply equivalent filters in Excel
3. Use Advanced Filter for complex conditions

## Best Practices

### Before Exporting
1. **Test in Cutty**: Verify the results look correct
2. **Review SQL**: Check that the logic matches your requirements
3. **Note Special Characters**: Identify any unusual column names or values

### After Exporting
1. **Update Table Names**: Replace generic names with your actual table names
2. **Test Small**: Run the query on a subset of data first
3. **Validate Results**: Compare results with Cutty to ensure consistency
4. **Document Changes**: Note any modifications you made to the SQL

### Performance Considerations
- **Add Indexes**: Create database indexes on frequently filtered columns
- **Limit Results**: Add LIMIT clauses for large datasets
- **Monitor Performance**: Check query execution time in your target system

## Common Use Cases

### Data Migration
Export filter logic when moving data between systems:
1. Generate SQL for the subset you want to migrate
2. Modify for target database syntax
3. Use as part of ETL processes

### Report Automation
Create automated reports using Cutty's filter logic:
1. Export SQL for your standard report filters
2. Schedule the query in your reporting tool
3. Automate data refresh with the same criteria

### Documentation
Share precise data requirements:
1. Export SQL as documentation of your analysis criteria
2. Include in data requests to technical teams
3. Use as specification for custom development

The SQL export feature makes Cutty a powerful bridge between visual data exploration and technical database operations, allowing you to seamlessly move your filtering logic to any SQL-compatible system.