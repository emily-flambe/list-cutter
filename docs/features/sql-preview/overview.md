---
title: SQL Preview Overview
description: Real-time SQL generation from visual query builder
category: Features
subcategory: SQL Preview
order: 1
last_updated: 2024-09-09
---

# SQL Preview Overview

The SQL Preview feature in Cutty automatically generates SQL queries from your visual query builder selections, making it easy to understand what's happening behind the scenes and export your logic to other database tools.

## What is SQL Preview?

SQL Preview translates your visual filter selections into standard SQL SELECT statements in real-time. As you build filters using the visual query builder, Cutty automatically generates the equivalent SQL query that represents your data selection criteria.

## Key Features

- **Real-time Generation**: SQL updates automatically as you modify filters
- **Syntax Highlighting**: Color-coded SQL display for better readability
- **Copy to Clipboard**: One-click copying of generated SQL
- **Multiple Data Types**: Support for text, number, date, and boolean operations
- **Proper Escaping**: SQL injection protection with proper string escaping
- **Formatted Output**: Clean, readable SQL with proper indentation

## Supported Operations

The SQL Preview feature supports all filter operations available in the visual query builder:

### Text Operations
- Equals / Not Equals
- Contains / Not Contains  
- Starts With / Ends With
- Is Empty / Is Not Empty

### Number Operations
- Equals / Not Equals
- Greater Than / Less Than
- Greater Than or Equal / Less Than or Equal
- Between (range)

### Date Operations
- Equals / Before / After
- Between (date range)
- Greater/Less than or equal

### Boolean Operations
- Is True / Is False
- Null checks

## How It Works

1. **Visual Filter Creation**: Build filters using the drag-and-drop query builder
2. **Automatic Translation**: Cutty compiles your filters into SQL in real-time
3. **SQL Display**: View the generated SQL in the expandable preview panel
4. **Export Options**: Copy the SQL to use in other database tools

## Use Cases

- **Learning SQL**: Understand how visual filters translate to SQL syntax
- **Data Migration**: Export your filter logic to other database systems
- **Documentation**: Share precise data selection criteria with technical teams
- **Debugging**: Verify that your visual filters produce the expected SQL logic
- **Integration**: Use generated SQL in business intelligence tools or reports

## Technical Details

- Generated SQL uses standard ANSI SQL syntax
- Table names and column names are properly quoted for special characters
- String values are escaped to prevent SQL injection
- Complex filters are combined using AND logic
- NULL handling follows SQL standard practices

The SQL Preview feature bridges the gap between visual data exploration and technical database operations, making Cutty accessible to both technical and non-technical users.