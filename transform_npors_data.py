#!/usr/bin/env python3
"""
NPORS Survey Data Transformer

This script transforms the coded NPORS survey data into human-readable labels
using the codebook, and creates a smaller demo-friendly dataset.
"""

import pandas as pd
import sys
from pathlib import Path

def load_codebook(codebook_path):
    """Load and parse the codebook into a mapping dictionary"""
    codebook = pd.read_csv(codebook_path)
    
    # Create mapping dictionary: {variable: {code: label}}
    mappings = {}
    
    for _, row in codebook.iterrows():
        variable = row['Variable']
        value = row['Values']
        label = row['Value_Labels']
        
        # Skip non-numeric values and special cases
        if pd.isna(value) or pd.isna(label):
            continue
            
        # Skip min/max value rows
        if str(label).strip() in ['Min. Val.', 'Max. Val']:
            continue
            
        try:
            value = int(float(value))  # Handle potential float strings
        except (ValueError, TypeError):
            continue
            
        if variable not in mappings:
            mappings[variable] = {}
            
        mappings[variable][value] = str(label).strip()
    
    return mappings

def transform_survey_data(input_path, output_path, codebook_mappings, sample_size=None):
    """Transform coded survey data to readable labels"""
    
    print(f"Loading survey data from {input_path}...")
    df = pd.read_csv(input_path)
    
    print(f"Loaded {len(df)} total rows - keeping ALL rows for comprehensive demo")
    # Keep ALL rows - no sampling
    
    # Select key variables for demo
    demo_variables = [
        'RESPID',           # ID
        'GENDER',           # Gender
        'AGECAT',           # Age categories  
        'AGEGRP',           # Detailed age groups
        'PARTY',            # Political party
        'PARTYSUM',         # Party summary (with leaners)
        'EDUCCAT',          # Education
        'RACECMB',          # Race combined
        'RACETHN',          # Race/ethnicity
        'ECON1MOD',         # Economic views
        'UNITY',            # National unity
        'CRIMESAFE',        # Crime/safety
        'GOVPROTCT',        # Government protection
        'FIN_SIT',          # Financial situation
        'REGISTRATION',     # Voter registration
        'VOTED2024',        # 2024 voting
    ]
    
    # Keep only available variables
    available_vars = [var for var in demo_variables if var in df.columns]
    df_demo = df[available_vars].copy()
    
    print(f"Selected {len(available_vars)} variables for demo dataset")
    
    # Transform coded values to labels - keep ALL rows including nulls/missing
    transformed_df = df_demo.copy()
    
    for variable in available_vars:
        if variable in codebook_mappings:
            print(f"Transforming {variable}...")
            
            # Create a new column with readable labels
            readable_col = f"{variable}_Label"
            
            # Map numeric codes to labels - preserve nulls and missing values
            transformed_df[readable_col] = transformed_df[variable].map(
                codebook_mappings[variable]
            ).fillna(transformed_df[variable].astype(str))  # Keep original values if no mapping
            
            # Keep both coded and labeled versions for flexibility
            
    # Rename columns for better readability
    column_renames = {
        'RESPID': 'Respondent_ID',
        'GENDER_Label': 'Gender',
        'AGECAT_Label': 'Age_Group',
        'PARTY_Label': 'Political_Party', 
        'PARTYSUM_Label': 'Party_Affiliation',
        'EDUCCAT_Label': 'Education_Level',
        'RACETHN_Label': 'Race_Ethnicity',
        'RACECMB_Label': 'Race',
        'ECON1MOD_Label': 'Economic_Outlook',
        'UNITY_Label': 'National_Unity_View',
        'CRIMESAFE_Label': 'Crime_Safety_View',
        'GOVPROTCT_Label': 'Government_Protection_View',
        'FIN_SIT_Label': 'Financial_Situation',
        'REGISTRATION_Label': 'Voter_Registration',
        'VOTED2024_Label': 'Voted_2024'
    }
    
    # Create final demo dataset with clean column names
    demo_columns = []
    for col in transformed_df.columns:
        if col.endswith('_Label') or col == 'RESPID':
            demo_columns.append(col)
    
    final_df = transformed_df[demo_columns].copy()
    final_df = final_df.rename(columns=column_renames)
    
    # NO DATA FILTERING - Keep ALL rows including refused/missing responses
    print("Preserving ALL rows including refused/missing responses for complete dataset")
    
    # Save the transformed dataset
    final_df.to_csv(output_path, index=False)
    print(f"\nTransformed dataset saved to: {output_path}")
    print(f"Final dataset shape: {final_df.shape}")
    print(f"\nColumn summary:")
    for col in final_df.columns:
        unique_vals = final_df[col].nunique()
        print(f"  {col}: {unique_vals} unique values")
        
    # Show sample of unique values for key columns
    print(f"\nSample values:")
    for col in ['Gender', 'Age_Group', 'Political_Party', 'Education_Level']:
        if col in final_df.columns:
            unique_vals = final_df[col].unique()[:5]  # First 5 unique values
            print(f"  {col}: {', '.join(map(str, unique_vals))}")
    
    return final_df

def main():
    # File paths
    downloads_dir = Path("/Users/emilycogsdill/Downloads/2025-NPORS-Dataset")
    
    codebook_path = downloads_dir / "2025-NPORS-Dataset-codebook.csv"
    survey_path = downloads_dir / "NPORS_2025.csv"
    output_path = "NPORS_2025_demo_transformed.csv"
    
    # Check if files exist
    if not codebook_path.exists():
        print(f"Error: Codebook file not found at {codebook_path}")
        return 1
        
    if not survey_path.exists():
        print(f"Error: Survey data file not found at {survey_path}")
        return 1
    
    try:
        # Load codebook mappings
        print("Loading codebook...")
        codebook_mappings = load_codebook(codebook_path)
        print(f"Loaded mappings for {len(codebook_mappings)} variables")
        
        # Transform survey data - keep ALL rows
        transformed_df = transform_survey_data(
            survey_path, output_path, codebook_mappings
        )
        
        print(f"\n✅ Success! Demo dataset created with {len(transformed_df)} responses")
        print(f"📁 Output file: {output_path}")
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return 1
        
    return 0

if __name__ == "__main__":
    sys.exit(main())