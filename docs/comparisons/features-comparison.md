---
title: Feature Comparison Guide
category: Comparisons
keywords: comparison, when to use, features, decision guide, choosing tools
difficulty: intermediate
---

# Feature Comparison Guide

## When to Use Each Cutty Feature

Understanding which tool to use for your specific data task will save time and produce better results.

## CSV Cutter vs CSV Cutter Plus vs Query Builder

### CSV Cutter (Basic)
**Best for**: Simple column selection and basic filtering
**Use when**:
- You need to quickly select/deselect columns
- Applying simple text filters
- One-time data extraction
- Learning Cutty basics

**Features**:
- Column selection checkboxes
- Basic text filtering
- Quick export to CSV
- No login required

**Example use case**: Extract email and name columns from customer list

### CSV Cutter Plus
**Best for**: Advanced filtering with multiple conditions
**Use when**:
- Need complex filter logic
- Combining AND/OR conditions
- Saving filter configurations
- Regular data processing

**Features**:
- Advanced filter builder
- AND/OR logic combinations
- Save filter sets
- Batch processing

**Example use case**: Filter customers by state AND purchase date range

### Query Builder (Do Stuff → Cut)
**Best for**: Visual SQL generation and complex data operations
**Use when**:
- Need to see/export SQL
- Complex multi-table operations
- Learning SQL
- Reproducible queries

**Features**:
- Visual query construction
- Live SQL preview
- Export SQL code
- Query history
- Multiple filter types

**Example use case**: Build complex customer segmentation with multiple criteria

## Cuttytabs vs Analysis vs Manual Filtering

### Cuttytabs (Crosstabs)
**Best for**: Summarizing data relationships
**Use when**:
- Creating pivot table-like summaries
- Analyzing two variables together
- Generating frequency tables
- Quick statistical overview

**Features**:
- Row/column variable selection
- Automatic counting
- Percentage calculations
- Export crosstab results

**Example use case**: Analyze sales by region and product category

### Analysis
**Best for**: Data profiling and statistics
**Use when**:
- Need column statistics
- Data quality assessment
- Finding patterns
- Pre-analysis exploration

**Features**:
- Automatic data profiling
- Column statistics
- Data type detection
- Missing value analysis

**Example use case**: Understand data quality before processing

### Manual Filtering
**Best for**: Step-by-step data exploration
**Use when**:
- Exploring unfamiliar data
- Testing filter combinations
- One-off investigations
- Learning the data

**Features**:
- Interactive filtering
- Immediate results
- Trial and error approach
- No saved configurations

**Example use case**: Explore new dataset to understand structure

## File Upload vs Manage Files vs Synthetic Data

### File Upload
**Best for**: Getting new data into Cutty
**Use when**:
- First time uploading a file
- Processing external data
- One-time analysis
- Testing Cutty features

**Features**:
- Drag and drop upload
- Multiple file support
- Auto-detection of format
- Preview before processing

**Example use case**: Upload monthly sales report for analysis

### Manage Files
**Best for**: Working with saved files
**Use when**:
- Reprocessing previous uploads
- Organizing multiple files
- Tracking file history
- Sharing with team

**Features**:
- File listing
- Delete/rename options
- File metadata
- Access history

**Example use case**: Re-analyze last month's data with new filters

### Synthetic Data Generator
**Best for**: Creating test data
**Use when**:
- Testing workflows
- Demo purposes
- Learning Cutty features
- No real data available

**Features**:
- Multiple data types
- Configurable volumes
- Realistic patterns
- Instant generation

**Example use case**: Generate test customer data for workflow testing

## Export Formats Comparison

### CSV Export
**Best for**: Excel and spreadsheet compatibility
**Use when**:
- Opening in Excel/Google Sheets
- Maximum compatibility needed
- Further processing required
- Sharing with non-technical users

### JSON Export
**Best for**: Application integration
**Use when**:
- Feeding data to applications
- API responses
- JavaScript processing
- Preserving data types

### SQL Export
**Best for**: Database operations
**Use when**:
- Recreating queries elsewhere
- Learning SQL
- Documentation purposes
- Database migration

## Authentication Options

### Anonymous Usage
**Best for**: Quick one-time tasks
**Limitations**:
- Cannot save files
- No file history
- Limited to single session
- Basic features only

**Use when**:
- Testing Cutty
- One-time data processing
- No need to save work
- Privacy concerns

### Email Registration
**Best for**: Regular users
**Benefits**:
- Save and manage files
- Access history
- Full feature access
- Secure account

**Use when**:
- Regular data processing
- Need file persistence
- Team collaboration
- Advanced features

### Google OAuth
**Best for**: Quick secure access
**Benefits**:
- No password to remember
- Quick sign-in
- Secure authentication
- Linked to Google account

**Use when**:
- Already use Google
- Want quick access
- Prefer OAuth security
- Avoid password management

## Processing Methods

### Real-time Processing
**Best for**: Small to medium files
**Characteristics**:
- Immediate results
- Interactive feedback
- Browser-based
- Limited by browser memory

**Use when**:
- Files under 10MB
- Need immediate results
- Interactive exploration
- Testing filters

### Batch Processing
**Best for**: Large files or multiple operations
**Characteristics**:
- Background processing
- Can handle larger files
- Multiple files at once
- Results when complete

**Use when**:
- Files over 10MB
- Multiple files
- Complex operations
- Can wait for results

## Decision Trees

### "I need to filter data"
1. Simple column filter? → **CSV Cutter**
2. Complex conditions? → **Query Builder**
3. Statistical summary? → **Cuttytabs**

### "I need to analyze patterns"
1. Two-variable relationship? → **Cuttytabs**
2. Data quality check? → **Analysis**
3. Visual query building? → **Query Builder**

### "I need to process multiple files"
1. Same structure? → **Batch process in Manage Files**
2. Different structures? → **Process individually**
3. Need to combine? → **Query Builder with joins**

### "I need to share results"
1. With Excel users? → **Export as CSV**
2. With developers? → **Export as JSON**
3. With database? → **Export SQL**

## Pro Tips

### Combining Features
- Use Analysis first to understand data
- Then Query Builder for complex filtering
- Finally Cuttytabs for summary statistics
- Export in appropriate format

### Workflow Optimization
- Save commonly used queries
- Use Manage Files for repeat processing
- Create templates with Synthetic Data
- Document your process

### Performance Considerations
- Use CSV Cutter for quick tasks
- Query Builder for complex but reproducible
- Cuttytabs for statistical summaries
- Analysis for data understanding