---
title: Combining Filters with AND/OR Logic
category: Features
subcategory: Query Builder
keywords: combining filters, and or logic, filter groups, complex queries, boolean logic
difficulty: intermediate
---

# Combining Filters with AND/OR Logic

## Master Complex Query Logic

Combining filters with AND/OR logic is where the Query Builder's real power shines. This guide teaches you how to create sophisticated queries by combining multiple conditions using boolean logic.

## Understanding Filter Logic

### Boolean Logic Basics
Filter combinations use boolean logic to determine which records match your criteria:
- **AND**: All conditions must be true
- **OR**: At least one condition must be true
- **NOT**: Negates a condition (handled through operators like "not equals")

### Logic Flow in Plain English
Think of filter logic like everyday decision-making:
- **AND**: "I want customers who are VIP AND have purchased recently"
- **OR**: "I want items that are urgent OR high priority"
- **Complex**: "I want customers who are (VIP OR Premium) AND have purchased recently"

## Basic Filter Combinations

### AND Logic - All Conditions Must Match

#### Simple AND Example
```
Filter 1: Age >= 18
AND
Filter 2: Status = "Active"

Result: Adult active users only
SQL: WHERE age >= 18 AND status = 'Active'
```

#### Multiple AND Conditions
```
Filter 1: Department = "Sales"
AND
Filter 2: Performance Score > 80
AND  
Filter 3: Start Date >= 2023-01-01

Result: High-performing sales people hired since 2023
SQL: WHERE department = 'Sales' AND performance_score > 80 AND start_date >= '2023-01-01'
```

**When to Use AND**:
- All criteria must be met
- Narrowing down results
- Multiple requirements
- Qualification criteria

### OR Logic - Any Condition Can Match

#### Simple OR Example
```
Filter 1: Priority = "High"
OR
Filter 2: Priority = "Urgent"

Result: Items with either high or urgent priority
SQL: WHERE priority = 'High' OR priority = 'Urgent'
```

#### Multiple OR Conditions
```
Filter 1: Country = "USA"
OR
Filter 2: Country = "Canada"
OR
Filter 3: Country = "Mexico"

Result: North American customers
SQL: WHERE country = 'USA' OR country = 'Canada' OR country = 'Mexico'
```

**When to Use OR**:
- Alternative criteria
- Broadening results
- Multiple acceptable values
- Fallback conditions

## Advanced Filter Grouping

### Nested Groups with Parentheses
Complex logic requires grouping filters to control evaluation order:

#### Age and Status Example
```
Group 1: (Age >= 18 AND Age <= 65)
AND
Group 2: (Status = "Active" OR Status = "Trial")

Result: Working-age people who are active or on trial
SQL: WHERE (age >= 18 AND age <= 65) AND (status = 'Active' OR status = 'Trial')
```

#### Geographic and Value Example
```
Group 1: (Country = "USA" OR Country = "Canada")
AND
Group 2: (Premium Member = true OR Lifetime Value > 10000)

Result: North American high-value customers
SQL: WHERE (country = 'USA' OR country = 'Canada') AND (premium_member = true OR lifetime_value > 10000)
```

### Three-Level Nesting
For even more complex logic:

```
Main Group: Customer Segmentation
├── Group A: Demographics
│   ├── Age >= 25 AND Age <= 54
│   └── Income > 50000
└── Group B: Engagement (AND with Group A)
    ├── Last Purchase < 90 days ago
    └── OR Email Engagement > 50%

SQL: WHERE (age >= 25 AND age <= 54 AND income > 50000) 
     AND (last_purchase >= '2024-01-01' OR email_engagement > 0.5)
```

## Visual Query Builder Interface

### Filter Block Layout
The visual interface shows filter relationships clearly:

#### Linear Layout (Simple AND)
```
[Age >= 18] ——AND——> [Status = Active] ——AND——> [Country = USA]
```

#### Grouped Layout (Complex Logic)
```
Group 1: Demographics
├─ [Age >= 18]
└─ [Income > 50000]
     |
   AND
     |
Group 2: Engagement  
├─ [Last Login < 30 days]
└─ [OR Email Opens > 10]
```

### Visual Grouping Elements

#### Group Containers
- **Rounded rectangles** contain related filters
- **Color coding** distinguishes different groups
- **Nesting levels** show hierarchy through indentation
- **Group labels** provide descriptive names

#### Logic Connectors
- **Vertical lines** show AND relationships
- **Branching lines** show OR relationships within groups
- **Horizontal bridges** connect different groups
- **Logic labels** clearly mark AND/OR connections

#### Drag and Drop
- **Drag filters** between groups
- **Reorder conditions** within groups
- **Create new groups** by dragging filters to empty space
- **Merge groups** by dropping one group onto another

## Common Filter Patterns

### Customer Segmentation

#### High-Value Recent Customers
```
Demographics:
├─ Customer Type = "Premium"
└─ Account Value > 5000
AND
Recent Activity:
├─ Last Purchase < 90 days
└─ Last Login < 30 days

Business Logic: Premium customers who are actively engaged
```

#### At-Risk Customer Identification
```
Value Indicators:
├─ Lifetime Value > 1000
└─ Previous Purchase Frequency > monthly
AND
Risk Signals:
├─ Last Purchase > 180 days
└─ Support Tickets > 3 in last month

Business Logic: Valuable customers showing signs of disengagement
```

### Sales and Marketing

#### Qualified Leads
```
Demographics:
├─ Company Size > 100 employees
└─ Budget Authority = true
AND
Engagement:
├─ Downloaded Whitepaper = true
└─ OR Attended Webinar = true

Business Logic: Large companies with budget and demonstrated interest
```

#### Campaign Targeting
```
Targeting Criteria:
├─ Age BETWEEN 25 AND 54
└─ Income > 75000
AND
Engagement History:
├─ Email Subscriber = true
└─ Previous Campaign Response > 0

Business Logic: Affluent adults who engage with marketing
```

### Data Quality and Compliance

#### Data Completeness Check
```
Required Fields Missing:
├─ Email IS EMPTY
└─ OR Phone IS EMPTY
AND
Record Quality:
├─ Created Date > 2023-01-01
└─ Status ≠ "Deleted"

Business Logic: Recent records missing essential contact information
```

#### GDPR Compliance Filter
```
Geographic Scope:
├─ Country IN [EU Countries]
└─ Data Processing Location = "EU"
AND
Consent Status:
├─ Consent Date >= 2018-05-25
└─ Opt Out Status ≠ "Opted Out"

Business Logic: EU records with valid consent under GDPR
```

### Operational and Performance

#### System Performance Issues
```
Performance Metrics:
├─ Response Time > 1000ms
└─ Error Rate > 1%
AND
Context:
├─ Server Load > 80%
└─ OR Peak Hours = true

Business Logic: Performance problems during high-load periods
```

#### Inventory Management
```
Stock Conditions:
├─ Quantity < Reorder Point
└─ Lead Time > 7 days
AND
Business Factors:
├─ Demand Forecast > Current Stock
└─ Season = "High Demand"

Business Logic: Items needing urgent reorder during peak season
```

## Advanced Logic Patterns

### Exclusion Logic
Using NOT conditions effectively:

#### Clean Customer List
```
Include:
├─ Status = "Active"
└─ Email Verified = true
AND NOT:
├─ Email CONTAINS "test"
└─ OR Company Name = "Internal"

Business Logic: Real, verified customers excluding test accounts
```

### Conditional Logic
Different criteria based on context:

#### Pricing Tiers
```
IF Premium Customer:
├─ Account Type = "Premium"
└─ Discount >= 20%
OR IF Regular Customer:
├─ Account Type = "Regular"  
└─ Order Amount > 500

Business Logic: Different qualification criteria by customer type
```

### Time-Based Logic
Combining temporal conditions:

#### Recent Activity Analysis
```
Recent Engagement:
├─ Last Login < 7 days
└─ Last Purchase < 30 days
AND
Historical Pattern:
├─ Average Order Value > 100
└─ Purchase Frequency > monthly

Business Logic: Recently active customers with strong purchase history
```

## Performance Considerations

### Efficient Filter Ordering

#### Selectivity-Based Ordering
Place most selective filters first:
```
High Selectivity (10% of data):
└─ VIP Customer = true
AND
Medium Selectivity (40% of data):
├─ Last Purchase < 90 days
└─ Country = "USA"
AND  
Low Selectivity (80% of data):
└─ Age >= 18

Performance: Reduces data scanned at each step
```

#### Index-Friendly Patterns
Structure filters to use database indexes:
```
Indexed Columns First:
├─ Customer ID STARTS WITH "CUST"  (indexed)
└─ Created Date >= 2024-01-01      (indexed)
AND
Non-Indexed Later:
└─ Description CONTAINS "special"   (not indexed)
```

### Query Complexity Management

#### Reasonable Complexity Limits
- **Simple**: 2-5 filters with basic AND/OR
- **Moderate**: 5-10 filters with 2-3 groups
- **Complex**: 10+ filters with multiple nesting levels
- **Very Complex**: Consider breaking into multiple queries

#### Performance Monitoring
Track query performance metrics:
- **Execution time** for filter combinations
- **Data volume** processed at each step
- **Index usage** efficiency
- **Memory consumption** for complex queries

## Troubleshooting Logic Issues

### Common Logic Errors

#### Contradictory Conditions
**Problem**: No results due to impossible conditions
```
Bad Example:
Age > 65 AND Age < 18
(No person can be both over 65 and under 18)

Solution: Review logic for contradictions
```

#### Incorrect Precedence
**Problem**: Logic doesn't work as intended due to operator precedence
```
Problem:
A = 1 OR B = 2 AND C = 3
Evaluated as: A = 1 OR (B = 2 AND C = 3)
Intended as: (A = 1 OR B = 2) AND C = 3

Solution: Use explicit grouping
```

#### Over-Broad OR Conditions
**Problem**: OR conditions cancel out AND restrictions
```
Problem:
Status = "Active" AND (Type = "Premium" OR Type = "Any")
The OR condition includes everything

Solution: Be specific with OR conditions
```

### Debugging Strategies

#### Step-by-Step Testing
1. **Test each filter individually**
2. **Combine filters two at a time**
3. **Add groups incrementally**
4. **Verify results at each step**

#### Visual Logic Review
1. **Draw logic flow diagrams**
2. **Verify parentheses placement**
3. **Check AND/OR placement**
4. **Confirm group boundaries**

#### Sample Data Testing
1. **Test with known data values**
2. **Verify edge cases**
3. **Check null value handling**
4. **Confirm expected results**

## Query Builder Tips and Tricks

### Building Complex Queries

#### Start Simple Strategy
1. **Begin with one filter**
2. **Add filters one at a time**
3. **Test each addition**
4. **Group related filters**
5. **Add complexity gradually**

#### Template-Based Approach
1. **Create filter templates** for common patterns
2. **Save successful combinations**
3. **Reuse proven logic structures**
4. **Share templates with team**

### Visual Organization

#### Naming and Labeling
- **Name filter groups** descriptively
- **Add comments** to complex logic
- **Use consistent naming** conventions
- **Document business rules**

#### Color Coding
- **Demographics**: Blue groups
- **Behavior**: Green groups  
- **Performance**: Red groups
- **Geography**: Purple groups

#### Layout Management
- **Collapse complex groups** when not editing
- **Expand groups** to see detail
- **Reorder groups** for logical flow
- **Minimize screen scrolling**

## Integration with Other Features

### Column Selection
Combine filter logic with column management:
```
Filter Logic: High-value customers
Column Selection: Contact info + purchase history
Export: Customer outreach dataset
```

### Export and Reporting
Use complex filters for targeted exports:
```
Complex Filter: Multi-criteria customer segmentation
Export Format: Excel with multiple sheets
Delivery: Automated monthly report
```

### SQL Generation
Complex visual filters generate sophisticated SQL:
```
Visual: Nested groups with multiple conditions
SQL: Multi-table joins with complex WHERE clauses
Usage: Export for business intelligence tools
```

## Best Practices

### Logic Design
1. **Plan Before Building**: Sketch logic on paper first
2. **Use Meaningful Names**: Name groups and filters clearly
3. **Document Assumptions**: Note business rule interpretations
4. **Test Thoroughly**: Verify with known data samples

### Performance Optimization
1. **Selective First**: Most restrictive filters early
2. **Index Awareness**: Use indexed columns for primary filters  
3. **Complexity Limits**: Keep queries reasonable
4. **Monitor Performance**: Track execution times

### Maintenance and Collaboration
1. **Version Control**: Save important query versions
2. **Documentation**: Comment complex logic
3. **Sharing**: Export/import query definitions
4. **Training**: Teach logic patterns to team

## Common Use Cases by Industry

### E-commerce
```
Abandoned Cart Recovery:
├─ Cart Created < 24 hours ago
└─ Cart Value > $50
AND
├─ Purchase Completed = false
└─ Email Subscribed = true
```

### SaaS Applications
```
Churn Risk Analysis:
├─ Subscription Active = true
└─ Usage Decline > 50% last month
AND
├─ Support Tickets = 0 last month
└─ OR Last Login > 14 days ago
```

### Financial Services
```
Loan Qualification:
├─ Credit Score >= 650
└─ Income > $50,000
AND
├─ Debt to Income < 0.4
└─ Employment Verified = true
```

### Healthcare
```
Patient Follow-up:
├─ Last Visit > 6 months ago
└─ Chronic Condition = true
AND
├─ Insurance Active = true
└─ Contact Preference ≠ "No Contact"
```

## Related Features

Combining filters works with:
- **Filter Types**: Use appropriate types for each condition
- **Operators**: Choose optimal operators for each filter
- **Query Builder**: Visual interface for complex logic
- **SQL Preview**: See generated SQL for complex combinations

## Next Steps

- Practice with [Query Builder Overview](overview.md) for hands-on experience
- Review [Filter Types](filter-types.md) for optimal filter selection
- Study [Operators Guide](operators.md) for detailed operator usage
- Explore [SQL Preview](../sql-preview/overview.md) to understand generated queries