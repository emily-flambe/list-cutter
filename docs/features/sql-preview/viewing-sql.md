---
title: Viewing Generated SQL
description: How to access and view SQL queries generated from your filters
category: Features
subcategory: SQL Preview
order: 2
last_updated: 2024-09-09
---

# Viewing Generated SQL

This guide shows you how to access and view the SQL queries that Cutty generates from your visual filters.

## Accessing SQL Preview

The SQL Preview panel is available on any page where you can create filters:

1. **Query Builder Page**: Located below the filter controls
2. **File Analysis Pages**: Available when working with CSV data
3. **Cuttytabs Analysis**: Shows SQL for crosstab queries

### Opening the SQL Preview Panel

1. Look for the **"SQL Preview"** accordion panel below your filters
2. Click on the panel header to expand it
3. The SQL query will be displayed with syntax highlighting

## SQL Preview Interface

### Panel Components

- **Header**: Shows "SQL Preview" with an expand/collapse arrow
- **SQL Display Area**: Shows the formatted SQL with color syntax highlighting
- **Copy Button**: One-click copying to your clipboard
- **Update Notifications**: Screen reader announcements when SQL changes

### Visual Features

- **Dark Theme**: SQL is displayed on a dark background for better readability
- **Syntax Highlighting**: Keywords, strings, and operators are color-coded
- **Monospace Font**: Consistent character spacing for proper alignment
- **Scrollable**: Long queries can be scrolled horizontally and vertically

## Real-time Updates

The SQL Preview updates automatically whenever you:

- Add a new filter
- Modify an existing filter
- Change filter values
- Remove filters
- Switch between files

### Update Behavior

- SQL regenerates instantly as you type or change selections
- No manual refresh needed
- Previous SQL is replaced with updated version
- Screen readers announce "SQL query updated" for accessibility

## Reading the Generated SQL

### Basic Structure

All generated SQL follows this pattern:

```sql
SELECT * FROM table_name
WHERE condition1
  AND condition2
  AND condition3
```

### Column Names

- Column names are quoted with double quotes: `"column_name"`
- This handles columns with spaces or special characters
- Original column names from your CSV are preserved

### Table Names

- Default table name is `data`
- File-based table names use the filename (without extension)
- Table names with spaces or special characters are quoted

### Filter Conditions

Each visual filter becomes a WHERE clause condition:

- **Text filters**: Use LIKE patterns for contains/starts with/ends with
- **Number filters**: Use comparison operators (=, >, <, >=, <=)
- **Date filters**: Use date comparison with quoted values
- **Null checks**: Use IS NULL / IS NOT NULL

## Examples

### Single Text Filter

Visual Filter: `Name contains "John"`

Generated SQL:
```sql
SELECT * FROM data
WHERE "Name" LIKE '%John%'
```

### Multiple Filters

Visual Filters:
- `Age > 25`
- `Department equals "Sales"`
- `Active is true`

Generated SQL:
```sql
SELECT * FROM data
WHERE "Age" > 25
  AND "Department" = 'Sales'
  AND "Active" = TRUE
```

### Date Range Filter

Visual Filter: `Start Date between 2024-01-01 and 2024-12-31`

Generated SQL:
```sql
SELECT * FROM data
WHERE "Start Date" BETWEEN '2024-01-01' AND '2024-12-31'
```

## Troubleshooting

### No SQL Showing

If the SQL Preview is empty:

1. Make sure you have at least one filter created
2. Check that the filter has a column selected and a value entered
3. Expand the SQL Preview panel if it's collapsed

### SQL Looks Wrong

If the generated SQL doesn't match your expectations:

1. Review your filter settings in the visual query builder
2. Check that column names and values are correct
3. Verify that the correct operator is selected
4. Remember that empty filters are not included in the SQL

### Performance with Large Queries

For complex queries with many filters:

- SQL Preview handles up to 100 filters efficiently
- Very long queries may require horizontal scrolling
- The preview panel has a maximum height with scrolling for readability

The SQL Preview feature makes it easy to understand exactly what data selection logic you've created and export it for use in other tools.