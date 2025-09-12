---
title: Real World Examples with Sample Data
category: Examples
keywords: examples, sample data, use cases, tutorials, real world
difficulty: beginner
---

# Real World Examples with Sample Data

## Practical Examples Using Cutty

Learn how to use Cutty with real-world scenarios and sample data patterns.

## Example 1: Sales Data Analysis

### Scenario
You have monthly sales data and need to analyze performance by region and product.

### Sample Data Structure
```csv
Date,Region,Product,Sales_Rep,Units_Sold,Revenue
2024-01-15,North,Widget A,John Smith,45,2250.00
2024-01-16,South,Widget B,Jane Doe,32,1920.00
2024-01-17,East,Widget A,Bob Johnson,28,1400.00
2024-01-18,West,Widget C,Alice Brown,55,4125.00
```

### Step-by-Step Process

#### 1. Upload the File
- Navigate to **File Upload**
- Drag your sales CSV file
- Verify preview shows correct columns

#### 2. Create Regional Summary with Cuttytabs
- Go to **Cuttytabs**
- Select your uploaded file
- Row Variable: `Region`
- Column Variable: `Product`
- View counts of sales by region and product

#### 3. Filter High-Value Sales with Query Builder
- Open **Query Builder**
- Add filter: `Revenue > 2000`
- Add filter: `Units_Sold > 30`
- Combine with AND logic
- Export filtered results

#### 4. Results
You'll have:
- Crosstab showing product distribution by region
- List of high-value transactions
- Exportable data for reporting

## Example 2: Customer List Cleanup

### Scenario
Clean and standardize a messy customer list for email marketing.

### Sample Data (Messy)
```csv
name,EMAIL,phone_number,signup_date,status
John SMITH,john.smith@email.com,(555) 123-4567,01/15/2024,active
jane doe,JANE.DOE@GMAIL.COM,555.987.6543,2024-01-20,Active
Bob Johnson,bob@company.com,555-555-5555,Jan 25 2024,ACTIVE
,test@test.com,123,yesterday,test
Alice Brown,alice.brown@email,invalid-phone,2024/01/30,active
```

### Cleaning Process

#### 1. Upload and Assess
- Upload file to Cutty
- Use **Analysis** to see data quality issues
- Note: Mixed case, invalid emails, test data

#### 2. Filter Out Invalid Data
Using Query Builder:
- Filter: `name IS NOT NULL`
- Filter: `EMAIL NOT LIKE '%test%'`
- Filter: `status = 'active'` (case insensitive)

#### 3. Select Clean Columns
In CSV Cutter:
- Select only: name, EMAIL, signup_date
- Deselect problematic phone column
- Export clean list

#### 4. Results
Clean customer list ready for:
- Email campaigns
- CRM import
- Further analysis

## Example 3: Survey Response Analysis

### Scenario
Analyze survey responses to understand customer satisfaction patterns.

### Sample Survey Data
```csv
ResponseID,Date,Age_Group,Product_Used,Satisfaction,Would_Recommend,Comments
1001,2024-01-15,25-34,Widget A,5,Yes,Great product!
1002,2024-01-15,35-44,Widget B,3,Maybe,Could be better
1003,2024-01-16,18-24,Widget A,4,Yes,Good value
1004,2024-01-16,45-54,Widget C,2,No,Too expensive
1005,2024-01-17,25-34,Widget B,5,Yes,Excellent!
```

### Analysis Steps

#### 1. Overall Satisfaction by Product
Using Cuttytabs:
- Row: `Product_Used`
- Column: `Satisfaction`
- See satisfaction distribution per product

#### 2. Recommendation Analysis
Using Query Builder:
- Group by `Would_Recommend`
- Count responses
- Filter by `Age_Group` for demographic insights

#### 3. Export for Presentation
- Export crosstab as CSV
- Export filtered data for charts
- Save queries for monthly updates

## Example 4: Inventory Management

### Scenario
Track inventory levels and identify items needing reorder.

### Sample Inventory Data
```csv
SKU,Product_Name,Category,Current_Stock,Reorder_Level,Unit_Cost,Supplier
A001,Widget Alpha,Electronics,45,50,25.00,Supplier1
A002,Widget Beta,Electronics,120,30,15.00,Supplier1
B001,Gadget Pro,Accessories,5,20,45.00,Supplier2
B002,Gadget Mini,Accessories,200,100,8.00,Supplier2
C001,Tool Deluxe,Tools,15,25,65.00,Supplier3
```

### Inventory Analysis

#### 1. Find Items to Reorder
Query Builder:
- Filter: `Current_Stock < Reorder_Level`
- Sort by: `Category`
- Export reorder list

#### 2. Category Summary
Cuttytabs:
- Row: `Category`
- Column: `Supplier`
- Understand supplier distribution

#### 3. Value Analysis
Add calculated field:
- `Stock_Value = Current_Stock * Unit_Cost`
- Filter high-value inventory
- Focus on expensive items

## Example 5: Event Registration Processing

### Scenario
Process event registrations to manage attendance and dietary requirements.

### Sample Registration Data
```csv
RegistrationID,Name,Email,Event_Date,Session,Dietary_Restrictions,Paid
R001,John Smith,john@email.com,2024-02-15,Morning,None,Yes
R002,Jane Doe,jane@email.com,2024-02-15,Afternoon,Vegetarian,Yes
R003,Bob Wilson,bob@email.com,2024-02-16,Morning,Gluten-Free,No
R004,Alice Lee,alice@email.com,2024-02-15,Morning,Vegan,Yes
R005,Charlie Brown,charlie@email.com,2024-02-16,Afternoon,None,Yes
```

### Processing Steps

#### 1. Confirmed Attendees
Query Builder:
- Filter: `Paid = 'Yes'`
- Sort by: `Event_Date, Session`
- Export attendee list

#### 2. Dietary Requirements Summary
Cuttytabs:
- Row: `Event_Date`
- Column: `Dietary_Restrictions`
- Plan catering accordingly

#### 3. Session Capacity Check
Analysis:
- Count by `Session`
- Check against room capacity
- Identify overbooked sessions

## Example 6: Financial Transaction Categorization

### Scenario
Categorize and analyze monthly financial transactions.

### Sample Transaction Data
```csv
Date,Description,Amount,Type,Category,Account
2024-01-01,Coffee Shop,-4.50,Debit,Food,Checking
2024-01-02,Salary Deposit,3500.00,Credit,Income,Checking
2024-01-03,Electric Bill,-125.00,Debit,Utilities,Checking
2024-01-04,Grocery Store,-85.50,Debit,Food,Checking
2024-01-05,Gas Station,-45.00,Debit,Transport,Credit Card
```

### Analysis Process

#### 1. Expense Summary
Cuttytabs:
- Row: `Category`
- Column: `Type`
- See spending patterns

#### 2. Large Transactions
Query Builder:
- Filter: `ABS(Amount) > 100`
- Sort by: `Amount DESC`
- Review significant transactions

#### 3. Monthly Budget Analysis
- Filter by date range
- Sum by category
- Compare to budget targets

## Tips for Working with Your Own Data

### Data Preparation
1. **Consistent Headers**: Use clear, consistent column names
2. **Date Formats**: Standardize dates (YYYY-MM-DD recommended)
3. **Clean Values**: Remove extra spaces and special characters
4. **Backup Original**: Always keep original file unchanged

### Using Cutty Effectively
1. **Start with Analysis**: Understand your data structure first
2. **Test Filters**: Try filters on small samples before full dataset
3. **Save Important Queries**: Use Query Builder to save complex filters
4. **Document Process**: Note steps for reproducibility

### Common Patterns
1. **Segmentation**: Group customers/products into categories
2. **Time Analysis**: Compare periods (monthly, quarterly)
3. **Outlier Detection**: Find unusual values needing attention
4. **Relationship Analysis**: Use Cuttytabs for correlations

### Export Strategies
1. **CSV for Excel**: Universal compatibility
2. **Filtered Exports**: Only export what you need
3. **Multiple Views**: Create different exports for different audiences
4. **Regular Updates**: Schedule regular processing for recurring reports

## Next Steps

After these examples:
1. Try with your own data
2. Combine multiple features
3. Create standard workflows
4. Share insights with team
5. Automate regular processes