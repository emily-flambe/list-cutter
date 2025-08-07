#!/usr/bin/env python3
"""
Create a clean NPORS demo dataset with the most relevant columns
KEEPING ALL ROWS - no filtering
"""

import pandas as pd

# Load the transformed dataset
df = pd.read_csv('NPORS_2025_demo_transformed.csv')

# Select the most interesting columns for crosstab analysis
demo_columns = [
    'Respondent_ID',
    'Gender', 
    'Age_Group',
    'Political_Party',
    'Education_Level', 
    'Race_Ethnicity',
    'Economic_Outlook',
    'National_Unity_View',
    'Financial_Situation',
    'Voter_Registration',
    'Voted_2024'
]

# Create clean demo dataset
demo_df = df[demo_columns].copy()

# Rename columns for even better readability
column_renames = {
    'Race_Ethnicity': 'Race_Ethnicity',
    'Economic_Outlook': 'Economic_View',
    'National_Unity_View': 'Unity_View', 
    'Financial_Situation': 'Financial_Status',
    'Voter_Registration': 'Registered_Voter',
    'Voted_2024': 'Voted_in_2024'
}

demo_df = demo_df.rename(columns=column_renames)

# Save clean demo dataset
output_file = 'NPORS_2025_Demo.csv'
demo_df.to_csv(output_file, index=False)

print(f"✅ Created clean demo dataset: {output_file}")
print(f"📊 Shape: {demo_df.shape}")
print(f"\n📋 Columns:")
for i, col in enumerate(demo_df.columns, 1):
    unique_count = demo_df[col].nunique()
    print(f"  {i:2d}. {col}: {unique_count} unique values")

print(f"\n🎯 Sample crosstab suggestions:")
print(f"  • Political_Party × Age_Group")
print(f"  • Education_Level × Economic_View") 
print(f"  • Gender × Unity_View")
print(f"  • Race_Ethnicity × Financial_Status")
print(f"  • Registered_Voter × Voted_in_2024")

# Show sample data
print(f"\n📄 Sample data:")
print(demo_df.head(3).to_string(index=False))