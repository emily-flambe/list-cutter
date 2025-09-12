---
title: Understanding SQL for Beginners
description: Learn how visual filters translate to SQL queries
category: Features
subcategory: SQL Preview
order: 3
last_updated: 2024-09-09
---

# Understanding SQL for Beginners

This guide explains how your visual filters translate into SQL (Structured Query Language) and helps you understand the generated queries.

## What is SQL?

SQL (Structured Query Language) is the standard language for working with databases. It allows you to ask questions about your data using specific commands and conditions.

Think of SQL as a way to write precise instructions for finding specific rows in a spreadsheet, but much more powerful.

## Basic SQL Structure

Every SQL query that Cutty generates follows the same basic pattern:

```sql
SELECT * FROM table_name
WHERE conditions
```

### Breaking It Down

- **SELECT \***: "Show me all columns"
- **FROM table_name**: "Look in this specific table/file"  
- **WHERE conditions**: "But only rows that match these rules"

## How Visual Filters Become SQL

### Simple Example

**Visual Filter**: "Show me rows where Age equals 30"

**Generated SQL**:
```sql
SELECT * FROM data
WHERE "Age" = 30
```

**In Plain English**: "Show me all columns from the data table, but only for rows where the Age column equals 30"

### Multiple Filters

**Visual Filters**:
- Age equals 30
- Name contains "John"

**Generated SQL**:
```sql
SELECT * FROM data
WHERE "Age" = 30
  AND "Name" LIKE '%John%'
```

**In Plain English**: "Show me rows where Age is 30 AND the Name contains 'John'"

## Common SQL Operators

Understanding the operators that Cutty uses in generated SQL:

### Equality and Comparison

| Visual Filter | SQL Operator | Example |
|--------------|--------------|---------|
| equals | = | `"Age" = 25` |
| not equals | != | `"Status" != 'Active'` |
| greater than | > | `"Score" > 100` |
| less than | < | `"Price" < 50` |
| greater or equal | >= | `"Count" >= 10` |
| less or equal | <= | `"Limit" <= 100` |

### Text Pattern Matching

| Visual Filter | SQL Pattern | Example | Meaning |
|--------------|-------------|---------|---------|
| contains | LIKE '%text%' | `"Name" LIKE '%John%'` | Name has "John" anywhere |
| starts with | LIKE 'text%' | `"Name" LIKE 'John%'` | Name begins with "John" |
| ends with | LIKE '%text' | `"Name" LIKE '%son'` | Name ends with "son" |
| not contains | NOT LIKE '%text%' | `"Name" NOT LIKE '%test%'` | Name doesn't have "test" |

### Special Cases

| Visual Filter | SQL | Example | Meaning |
|--------------|-----|---------|---------|
| is empty | IS NULL | `"Email" IS NULL` | Email column is empty |
| is not empty | IS NOT NULL | `"Phone" IS NOT NULL` | Phone column has a value |
| between | BETWEEN | `"Age" BETWEEN 18 AND 65` | Age is from 18 to 65 |

## Understanding Quotes

SQL uses different types of quotes for different purposes:

### Double Quotes (") - Column Names
```sql
"First Name", "Email Address", "Phone Number"
```
- Used for column names that have spaces or special characters
- Cutty always uses double quotes for column names to be safe

### Single Quotes (') - Text Values
```sql
WHERE "Name" = 'John Smith'
WHERE "Status" = 'Active'
```
- Used for text/string values
- Required for any text you're searching for

### No Quotes - Numbers and Booleans
```sql
WHERE "Age" = 30
WHERE "Price" = 99.99
WHERE "Active" = TRUE
```
- Numbers and booleans (TRUE/FALSE) don't need quotes

## Combining Multiple Conditions

### AND Logic
When you have multiple filters, SQL uses AND to combine them:

```sql
SELECT * FROM data
WHERE "Age" > 25
  AND "Department" = 'Sales'
  AND "Active" = TRUE
```

**Meaning**: Find rows where ALL three conditions are true:
- Age is greater than 25 AND
- Department is Sales AND  
- Active is true

### Reading Complex Queries

For a query like this:
```sql
SELECT * FROM employees
WHERE "Age" BETWEEN 25 AND 55
  AND "Department" = 'Engineering'
  AND "Salary" > 50000
  AND "Email" IS NOT NULL
```

**In Plain English**: 
"Show me all information about employees who are:
- Between 25 and 55 years old
- Work in Engineering  
- Make more than $50,000
- Have an email address on file"

## Common Patterns

### Finding Partial Matches
```sql
WHERE "Product Name" LIKE '%laptop%'
```
Finds products with "laptop" anywhere in the name (laptop, gaming laptop, laptop case, etc.)

### Excluding Certain Values
```sql
WHERE "Status" != 'Deleted'
```
Shows everything except deleted records

### Date Ranges
```sql
WHERE "Order Date" BETWEEN '2024-01-01' AND '2024-12-31'
```
Shows orders from the year 2024

### Finding Empty Fields
```sql
WHERE "Phone Number" IS NULL
```
Finds records where phone number is missing

## Tips for Reading SQL

1. **Start with the FROM clause** - This tells you which table/file the data comes from
2. **Look at the WHERE clause** - Each line after WHERE is a filter condition  
3. **Read AND as "also"** - "Age > 25 AND Department = Sales" means "Age over 25 ALSO in Sales"
4. **Remember quotes** - Double quotes = column names, Single quotes = text values
5. **Break down complex conditions** - Read each condition separately, then combine them

## Why This Matters

Understanding the SQL that Cutty generates helps you:

- **Verify your filters** - Make sure the SQL matches what you intended
- **Learn SQL gradually** - See how visual filters translate to code
- **Export your logic** - Use the SQL in other database tools
- **Communicate with technical teams** - Share precise requirements
- **Debug issues** - Understand why certain results appear

The SQL Preview feature is a great learning tool that shows you the "language" behind your visual data filtering, making database concepts more accessible and transparent.