---
title: How to Prepare Data for Analysis
category: Workflows
keywords: data preparation, analysis ready, data preprocessing, analytics, data transformation
difficulty: intermediate
---

# How to Prepare Data for Analysis

## Transform Raw Data into Analysis-Ready Datasets

Learn the complete workflow for preparing your data for meaningful analysis, visualization, and reporting in Cutty.

## Pre-Analysis Checklist

### Data Quality Assessment
Before starting analysis, verify:
- [ ] Data is complete (no critical missing values)
- [ ] Formats are consistent (dates, numbers, text)
- [ ] No duplicate records (unless intended)
- [ ] Column names are clear and descriptive
- [ ] Data types are correct
- [ ] Outliers are identified and handled

## Step 1: Profile Your Data

### Quick Statistics Overview
1. Navigate to **Analysis** tab
2. Click **Data Profile**
3. Review automatic statistics:
   - Row count and column count
   - Data types per column
   - Missing value percentages
   - Unique value counts
   - Basic statistical measures

### Identify Issues
Look for:
- Columns with >50% missing values
- Unexpected data types
- Suspicious patterns (all same value)
- Extreme outliers
- Date range problems

## Step 2: Structure Your Data

### Wide to Long Format
Transform for time-series analysis:
1. Identify pivot columns
2. Use **Reshape** feature
3. Convert columns to rows
4. Create date and value columns

Example:
```
Before: Product | Jan_Sales | Feb_Sales | Mar_Sales
After:  Product | Month | Sales
```

### Long to Wide Format
Transform for cross-tabulation:
1. Select row identifiers
2. Choose pivot column
3. Select value column
4. Apply transformation

Example:
```
Before: Date | Metric | Value
After:  Date | Revenue | Costs | Profit
```

## Step 3: Create Calculated Fields

### Common Calculations

#### Ratios and Percentages
1. Click **Add Column** → **Calculate**
2. Examples:
   - Profit Margin: `(Revenue - Cost) / Revenue * 100`
   - Growth Rate: `(Current - Previous) / Previous * 100`
   - Conversion Rate: `Conversions / Visitors * 100`

#### Date Calculations
1. Extract date components:
   - Year: `YEAR(date_column)`
   - Month: `MONTH(date_column)`
   - Quarter: `QUARTER(date_column)`
   - Day of Week: `DAYOFWEEK(date_column)`
2. Calculate differences:
   - Days Between: `DATEDIFF(end_date, start_date)`
   - Age: `DATEDIFF(TODAY(), birth_date) / 365`

#### Categorical Binning
1. Create groups from continuous data:
   - Age Groups: `CASE WHEN age < 18 THEN 'Minor' WHEN age < 65 THEN 'Adult' ELSE 'Senior' END`
   - Revenue Tiers: Based on quartiles or custom ranges
   - Risk Categories: Based on score thresholds

## Step 4: Handle Categorical Data

### Standardize Categories
1. Identify all unique values
2. Map variations to standard:
   - "USA", "US", "United States" → "United States"
   - "M", "Male", "male" → "Male"
3. Create mapping table
4. Apply transformation

### Create Dummy Variables
For statistical analysis:
1. Select categorical column
2. Choose **One-Hot Encode**
3. Create binary columns for each category
4. Remove original column if needed

### Ordinal Encoding
For ordered categories:
1. Define order (Low → Medium → High)
2. Assign numeric values (1 → 2 → 3)
3. Preserve ordering relationship

## Step 5: Aggregate Data

### Time-Based Aggregation
1. Group by time period:
   - Daily → Weekly
   - Weekly → Monthly
   - Monthly → Quarterly
2. Choose aggregation method:
   - Sum for totals
   - Average for rates
   - Count for frequencies
   - Min/Max for ranges

### Hierarchical Aggregation
1. Define hierarchy:
   - Store → Region → Country
   - Product → Category → Department
2. Calculate roll-ups
3. Include subtotals
4. Add grand totals

## Step 6: Create Analysis-Ready Features

### For Trends Analysis
1. **Moving Averages**:
   - 7-day moving average for daily data
   - 3-month moving average for monthly data
2. **Period Comparisons**:
   - Year-over-year change
   - Month-over-month growth
   - Week-over-week variance
3. **Cumulative Metrics**:
   - Running total
   - Cumulative percentage

### For Segmentation
1. **RFM Analysis** (for customers):
   - Recency: Days since last purchase
   - Frequency: Number of purchases
   - Monetary: Total spend
2. **Cohort Assignment**:
   - Sign-up month cohort
   - First purchase cohort
   - Geographic cohort

### For Predictive Analysis
1. **Lag Features**:
   - Previous period value
   - Multiple period lags
2. **Rolling Statistics**:
   - Rolling mean
   - Rolling standard deviation
   - Rolling min/max

## Step 7: Data Validation

### Statistical Validation
1. Check distributions:
   - Normal distribution for continuous
   - Expected frequencies for categorical
2. Identify outliers:
   - Z-score > 3
   - IQR method
   - Domain knowledge

### Business Logic Validation
1. Verify constraints:
   - Dates in valid range
   - Percentages between 0-100
   - Positive values where expected
2. Cross-field validation:
   - Start date before end date
   - Total equals sum of parts
   - Ratios make sense

## Step 8: Create Analysis Views

### Dashboard Views
1. Select KPI columns
2. Add calculated metrics
3. Include period comparisons
4. Apply relevant filters
5. Save as dashboard view

### Report Views
1. Structure for reporting:
   - Summary statistics at top
   - Detailed data below
   - Groupings and subtotals
2. Format for presentation:
   - Round numbers appropriately
   - Add percentage formatting
   - Include variance indicators

### Export Views
1. Different views for different audiences:
   - Executive summary (aggregated)
   - Analyst view (detailed)
   - Operations view (actionable)
2. Set appropriate filters
3. Order columns logically

## Common Analysis Preparations

### Sales Analysis Prep
1. Calculate revenue (price × quantity)
2. Add profit margins
3. Create product categories
4. Add time dimensions
5. Include customer segments

### Customer Analysis Prep
1. Calculate lifetime value
2. Segment by behavior
3. Add demographic bins
4. Create churn indicators
5. Include satisfaction scores

### Operational Analysis Prep
1. Calculate efficiency metrics
2. Add performance indicators
3. Create time buckets
4. Include resource utilization
5. Add quality metrics

## Performance Optimization

### For Large Datasets
- Filter early to reduce volume
- Aggregate before joining
- Use indexed columns for joins
- Sample for initial exploration
- Process in batches

### For Complex Calculations
- Break into steps
- Save intermediate results
- Use simple formulas when possible
- Validate on small sample first
- Document calculation logic

## Best Practices

### Documentation
- Record all transformations
- Note assumptions made
- Document business rules
- Keep audit trail
- Version control changes

### Reproducibility
- Save transformation steps
- Create reusable templates
- Use consistent naming
- Parameterize filters
- Test on new data

### Collaboration
- Share preparation notes
- Use standard definitions
- Create data dictionary
- Get stakeholder sign-off
- Regular review cycles

## Next Steps

With prepared data:
1. Create visualizations in Analysis tab
2. Build interactive Cuttytabs
3. Generate automated reports
4. Share with stakeholders
5. Schedule regular updates