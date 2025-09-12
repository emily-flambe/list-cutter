---
title: Available Data Types
description: Comprehensive guide to synthetic data fields and formats
category: Features
subcategory: Synthetic Data
order: 2
last_updated: 2024-09-09
---

# Available Data Types

Cutty's Synthetic Data Generator provides a comprehensive range of data types that cover common business, demographic, and analytical needs. Each data type is designed to produce realistic, statistically accurate values while maintaining complete privacy safety.

## Personal Information

### Names and Identifiers

#### Full Names
**Format**: First Name + Last Name  
**Example**: Sarah Johnson, Michael Chen, David Rodriguez  
**Characteristics**:
- Diverse ethnic and cultural representation
- Gender-appropriate first names
- Common surname distributions
- Realistic name combinations
- No real person correspondence

#### Email Addresses
**Format**: username@domain.com  
**Example**: sarah.johnson@email.com, m.chen@testmail.org  
**Characteristics**:
- Professional and personal email patterns
- Common domain providers
- Username variations (firstname.lastname, first initial + lastname)
- Valid email format compliance
- No functional email addresses

#### Phone Numbers
**Format**: (XXX) XXX-XXXX  
**Example**: (555) 123-4567, (312) 987-6543  
**Characteristics**:
- Valid US phone number formats
- Area codes appropriate for selected states
- Exchange codes that follow telecom standards
- No real phone number conflicts
- Consistent formatting

### Geographic Information

#### Addresses
**Components**: Street Number, Street Name, Street Type, City, State, ZIP Code  
**Example**: 1234 Oak Street, Springfield, IL 62701  

##### Street Addresses
- **Street Numbers**: 1-9999 range with realistic distribution
- **Street Names**: Common street names (Oak, Main, First, etc.)
- **Street Types**: Road, Street, Avenue, Lane, Circle, Court, etc.
- **Apartment Numbers**: Unit/Apt designations when appropriate

##### Geographic Consistency
- **City-State Matching**: Cities that actually exist in specified states
- **ZIP Code Accuracy**: ZIP codes that match city and state combinations
- **Regional Patterns**: Address styles consistent with geographic regions
- **Urban/Rural Mix**: Appropriate distribution of address types

#### States and Regions
**Available States**: All 50 US states plus District of Columbia  
**Format**: Two-letter state codes (CA, NY, TX) and full names  
**Regional Groupings**:
- **Northeast**: ME, NH, VT, MA, RI, CT, NY, NJ, PA
- **Southeast**: DE, MD, DC, VA, WV, KY, TN, NC, SC, GA, FL, AL, MS
- **Midwest**: OH, IN, IL, MI, WI, MN, IA, MO, ND, SD, NE, KS
- **Southwest**: TX, OK, AR, LA, NM, AZ
- **West**: CO, WY, MT, ID, UT, NV, CA, OR, WA, AK, HI

#### Coordinates
**Format**: Decimal degrees (latitude, longitude)  
**Example**: 40.7128, -74.0060 (New York City area)  
**Characteristics**:
- Coordinates within specified state boundaries
- Realistic precision (4-6 decimal places)
- Land-based coordinates (not in water bodies)
- Urban and rural coordinate distributions

## Demographic Attributes

### Age and Life Stage

#### Age Groups
**Categories**: 
- **18-24**: Young adults, students, early career
- **25-34**: Young professionals, starting families
- **35-44**: Mid-career, family-focused
- **45-54**: Peak career, established families
- **55-64**: Pre-retirement, mature professionals
- **65+**: Retirees, seniors

#### Birth Dates
**Format**: YYYY-MM-DD  
**Range**: 1930-2005 (ages 18-93)  
**Characteristics**:
- Realistic age distributions by region
- Seasonal birth patterns
- Valid calendar dates only
- Age consistency with other demographic data

### Socioeconomic Information

#### Income Ranges
**Categories**:
- **Under $25,000**: Low income, entry-level positions
- **$25,000-$49,999**: Lower-middle income, skilled workers
- **$50,000-$74,999**: Middle income, professionals
- **$75,000-$99,999**: Upper-middle income, managers
- **$100,000-$149,999**: High income, executives
- **$150,000+**: Very high income, senior executives

#### Education Levels
**Categories**:
- **High School or Less**: Basic education completion
- **Some College**: Partial college education, certificates
- **Associate Degree**: Two-year college completion
- **Bachelor's Degree**: Four-year college graduation
- **Master's Degree**: Advanced degree completion
- **Doctoral Degree**: PhD, MD, JD, and other advanced degrees

#### Employment Status
**Categories**:
- **Employed Full-Time**: Standard full-time employment
- **Employed Part-Time**: Part-time or contract work
- **Self-Employed**: Business owners, freelancers
- **Unemployed**: Actively seeking employment
- **Retired**: No longer in workforce
- **Student**: Full-time students
- **Disabled**: Unable to work due to disability

## Business and Customer Data

### Customer Information

#### Customer IDs
**Format**: CU-XXXXXX (6-digit number)  
**Example**: CU-123456, CU-789012  
**Characteristics**:
- Unique identifier for each record
- Consistent formatting across dataset
- Sequential numbering patterns
- Professional ID format

#### Account Numbers
**Format**: Various business-standard formats  
**Examples**: 
- Bank-style: 1234567890
- Credit card-style: 4XXX-XXXX-XXXX-XXXX
- Customer account: AC-2023-001234
**Characteristics**:
- Realistic account number patterns
- Check-digit validation where appropriate
- Industry-standard formatting
- No real account conflicts

#### Registration Dates
**Format**: YYYY-MM-DD or MM/DD/YYYY  
**Range**: 2020-2024 (recent customer acquisition)  
**Characteristics**:
- Business day emphasis (fewer weekend registrations)
- Seasonal patterns (business cycles)
- Growth trend patterns
- Realistic date distributions

### Transaction and Behavioral Data

#### Purchase Behavior
**Metrics**:
- **Purchase Frequency**: Realistic shopping patterns
- **Order Values**: Statistical distribution of purchase amounts
- **Product Preferences**: Logical product category associations
- **Seasonal Patterns**: Holiday and seasonal buying trends

#### Customer Segments
**Categories**:
- **Premium**: High-value, loyal customers
- **Standard**: Regular, moderate-value customers
- **Basic**: Occasional, price-sensitive customers
- **New**: Recently acquired customers
- **At-Risk**: Customers showing decline patterns

#### Status Indicators
**Common Statuses**:
- **Active/Inactive**: Account status
- **Verified/Unverified**: Email or identity verification
- **Premium/Standard/Basic**: Service levels
- **Good Standing/Warning/Suspended**: Account health
- **Current/Past Due/Closed**: Payment status

## Technical and Operational Data

### System Information

#### Timestamps
**Formats**: 
- ISO 8601: 2024-01-15T10:30:00Z
- US Standard: 01/15/2024 10:30 AM
- Database: 2024-01-15 10:30:00
**Characteristics**:
- Business hours emphasis for business data
- Realistic temporal patterns
- Time zone consistency
- Sequential ordering where appropriate

#### Performance Metrics
**Types**:
- **Scores**: 0-100 rating scales
- **Percentages**: 0-100% performance metrics
- **Ratings**: 1-5 star ratings, 1-10 scales
- **Efficiency**: Processing times, response rates
- **Quality**: Defect rates, accuracy percentages

#### Identifiers and Codes
**Formats**:
- **Product Codes**: PRD-XXXX, SKU-123456
- **Transaction IDs**: TXN-2024-001234
- **Reference Numbers**: REF-ABC123
- **Category Codes**: CAT-01, TYPE-A
- **Status Codes**: STAT-001, CODE-SUCCESS

## Data Quality and Consistency

### Logical Relationships

#### Geographic Consistency
- State codes match state names
- Cities exist within specified states
- ZIP codes correspond to correct cities
- Area codes match geographic regions
- Coordinates fall within state boundaries

#### Demographic Coherence
- Age groups align with birth dates
- Income levels correlate with education and employment
- Employment status matches age patterns
- Family status aligns with age and demographics

#### Temporal Logic
- Registration dates precede transaction dates
- Account creation precedes first purchases
- Status changes follow logical sequences
- Date ranges maintain proper ordering

### Statistical Accuracy

#### Distribution Patterns
- Age distributions match census patterns
- Income distributions reflect economic data
- Geographic distributions follow population patterns
- Gender ratios approximate national averages
- Ethnic representation reflects diversity

#### Correlation Preservation
- Higher education correlates with higher income
- Urban areas show different patterns than rural
- Age groups show appropriate behavior patterns
- Regional differences in demographics and behavior

## Customization Options

### Geographic Targeting
- **Single State**: Generate data for one specific state
- **Multiple States**: Select several states for broader coverage
- **Regional Focus**: Target specific geographic regions
- **National Dataset**: Include all states with proper representation

### Volume Control
- **Small Samples**: 10-100 records for testing
- **Medium Datasets**: 100-1,000 records for development
- **Large Datasets**: 1,000-10,000 records for analysis
- **Custom Volumes**: Specify exact record counts needed

### Field Selection
- **Standard Package**: Common demographic and contact fields
- **Business Package**: Customer and transaction-focused fields
- **Extended Package**: Comprehensive field set with all options
- **Custom Fields**: Select specific fields for targeted use cases

### Format Options
- **CSV**: Comma-separated values for spreadsheet use
- **JSON**: JavaScript Object Notation for web applications
- **XML**: Extensible Markup Language for system integration
- **Database**: SQL insert statements for direct database loading

Understanding the available data types helps you select the right combination of fields for your specific use case, ensuring that your synthetic dataset provides realistic, useful data for development, testing, or analysis purposes.