---
title: How to Merge Multiple CSV Files
category: Workflows
keywords: merge csv, combine files, join data, concatenate, append csv
difficulty: intermediate
---

# How to Merge Multiple CSV Files

## Complete Guide to Combining CSV Data

Learn how to merge multiple CSV files into a single dataset using Cutty's powerful file combination features.

## Understanding Merge Types

### Vertical Merge (Append/Stack)
Combine files with the same columns:
- Sales data from different months
- Customer lists from different regions
- Survey responses from multiple forms

### Horizontal Merge (Join)
Combine files with related data:
- Customer info + purchase history
- Product details + inventory levels
- Employee data + department info

## Method 1: Simple Append (Same Structure)

### Step 1: Prepare Your Files
1. Ensure all files have identical column names
2. Verify column order matches
3. Check data types are consistent
4. Note total expected row count

### Step 2: Upload All Files
1. Go to **Upload** page
2. Select multiple files at once (Ctrl/Cmd+Click)
3. Or drag and drop all files together
4. Wait for all files to process

### Step 3: Combine Files
1. Navigate to **File Management**
2. Select files to merge (checkbox each)
3. Click **Merge Files** button
4. Choose "Append" as merge type
5. Review preview of combined data

### Step 4: Handle Duplicates
1. Check "Remove duplicates" option if needed
2. Select columns to check for uniqueness
3. Choose which duplicate to keep (first/last)
4. Apply and review results

## Method 2: Join Files (Related Data)

### Step 1: Identify Join Key
Common join keys:
- Customer ID
- Product SKU
- Employee Number
- Date
- Email Address

### Step 2: Upload Base Files
1. Upload your primary file first
2. Upload secondary file(s)
3. Verify both files loaded correctly

### Step 3: Configure Join
1. Go to **Analysis** → **Join Files**
2. Select primary file (left table)
3. Select secondary file (right table)
4. Choose join column(s)
5. Select join type:
   - **Inner Join**: Only matching records
   - **Left Join**: All from primary, matching from secondary
   - **Right Join**: All from secondary, matching from primary
   - **Full Join**: All records from both

### Step 4: Select Columns
1. Check columns to include from each file
2. Rename columns if duplicates exist
3. Order columns as desired
4. Preview joined result

## Method 3: Batch Processing Multiple Files

### For Monthly Data
1. Name files consistently: `sales_2024_01.csv`, `sales_2024_02.csv`
2. Upload all files to same folder
3. Use **Batch Merge** feature
4. Select pattern: `sales_2024_*.csv`
5. Choose chronological order
6. Merge with single click

### For Regional Data
1. Structure: `customers_west.csv`, `customers_east.csv`
2. Add region column during merge
3. Auto-populate based on filename
4. Combine into master list

## Advanced Merging Techniques

### Union with Different Columns
When files have some different columns:
1. Cutty creates superset of all columns
2. Missing values filled with NULL
3. Map similar columns (e.g., "Email" → "EmailAddress")
4. Review column alignment

### Fuzzy Matching
For imperfect join keys:
1. Enable fuzzy matching option
2. Set similarity threshold (e.g., 90%)
3. Review match suggestions
4. Manually confirm edge cases

### Time-Series Merge
For time-based data:
1. Ensure consistent date formats
2. Sort by date before merging
3. Handle overlapping periods
4. Interpolate missing dates if needed

## Common Merge Scenarios

### Scenario 1: Monthly Sales Reports
```
Files: sales_jan.csv, sales_feb.csv, sales_mar.csv
Steps:
1. Upload all three files
2. Verify column names match
3. Append in chronological order
4. Add "Month" column from filename
5. Export combined yearly report
```

### Scenario 2: Customer Data Enhancement
```
Files: customers.csv, purchases.csv, support_tickets.csv
Steps:
1. Upload customer base file
2. Left join purchases on customer_id
3. Left join support tickets on customer_id
4. Calculate lifetime value
5. Export enriched customer file
```

### Scenario 3: Product Catalog Update
```
Files: current_products.csv, new_products.csv, discontinued.csv
Steps:
1. Upload current catalog
2. Append new products
3. Remove discontinued items
4. Check for duplicate SKUs
5. Export updated catalog
```

## Validation After Merging

### Check Row Counts
- Append: Should equal sum of all files (minus duplicates)
- Join: Depends on join type and key matches
- Verify no unexpected data loss

### Verify Column Alignment
- Check sample rows from each source file
- Ensure data mapped correctly
- Validate calculated fields

### Test Key Relationships
- Confirm join keys matched correctly
- Check for orphaned records
- Validate foreign key integrity

## Performance Tips

### For Large Files
- Merge in stages (don't combine 100 files at once)
- Process overnight for huge datasets
- Use sampling to test merge logic first
- Consider using API for automation

### Memory Management
- Close other browser tabs
- Clear cache before large merges
- Split very large files first
- Use Chrome for best performance

## Troubleshooting Common Issues

### Column Name Mismatches
**Problem**: "Column not found" error
**Solution**: 
1. Standardize column names first
2. Use column mapping feature
3. Export and fix in Excel if needed

### Data Type Conflicts
**Problem**: Numbers stored as text
**Solution**:
1. Convert types before merging
2. Use Cutty's type detection
3. Force type in column settings

### Duplicate Headers
**Problem**: Multiple header rows after merge
**Solution**:
1. Remove headers from all but first file
2. Use "Skip first row" option
3. Clean after merging

### Character Encoding Issues
**Problem**: Special characters corrupted
**Solution**:
1. Ensure all files use UTF-8
2. Convert encoding before upload
3. Use Cutty's encoding detection

## Export Options After Merging

### Single Combined File
- Export as CSV for maximum compatibility
- Include all columns or select subset
- Apply final filters if needed

### Split by Criteria
- Export by date range
- Separate by category
- Create regional files
- Generate department-specific views

### Multiple Formats
- CSV for data processing
- Excel for business users
- JSON for applications
- SQL for database import

## Best Practices

### File Naming Conventions
- Use consistent patterns
- Include dates in filename
- Avoid spaces and special characters
- Document naming scheme

### Documentation
- Record merge steps
- Note any data exclusions
- Document column mappings
- Save merge configuration

### Quality Assurance
- Always backup original files
- Verify merge on sample first
- Have colleague review results
- Test exported file opens correctly

## Next Steps

After merging your files:
1. Clean any inconsistencies
2. Create analysis visualizations
3. Build Cuttytabs for insights
4. Share merged dataset
5. Schedule regular merge jobs