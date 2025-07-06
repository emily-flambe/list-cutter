#!/bin/bash
# export_postgres_data.sh
# Export data from PostgreSQL for List Cutter Phase 4 migration

set -e  # Exit on any error

# Set connection parameters from environment or defaults
export PGHOST="${POSTGRES_HOST:-localhost}"
export PGPORT="${POSTGRES_PORT:-5432}"
export PGUSER="${POSTGRES_USER:-postgres}"
export PGPASSWORD="${POSTGRES_PASSWORD}"
export PGDATABASE="${POSTGRES_DB:-list_cutter}"

# Create export directory with timestamp
EXPORT_DIR="./data_export_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$EXPORT_DIR"
cd "$EXPORT_DIR"

echo "=== List Cutter PostgreSQL Data Export ==="
echo "Database: ${PGHOST}:${PGPORT}/${PGDATABASE}"
echo "Export Directory: $(pwd)"
echo "Timestamp: $(date)"
echo ""

# Function to check PostgreSQL connection
check_postgres_connection() {
    echo "Checking PostgreSQL connection..."
    if ! pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -q; then
        echo "ERROR: Cannot connect to PostgreSQL database"
        echo "Connection details:"
        echo "  Host: $PGHOST"
        echo "  Port: $PGPORT"
        echo "  User: $PGUSER"
        echo "  Database: $PGDATABASE"
        exit 1
    fi
    echo "✓ PostgreSQL connection successful"
}

# Function to get row counts
get_row_counts() {
    echo "Getting row counts..."
    psql -c "
        SELECT 'auth_user' as table_name, COUNT(*) as count FROM auth_user
        UNION ALL
        SELECT 'list_cutter_savedfile', COUNT(*) FROM list_cutter_savedfile
        UNION ALL
        SELECT 'contacts_person', COUNT(*) FROM contacts_person
        ORDER BY table_name;
    "
}

# Function to export users table
export_users() {
    echo "Exporting users table..."
    psql -c "COPY (
        SELECT 
            id,
            password,
            last_login,
            CASE WHEN is_superuser THEN 1 ELSE 0 END as is_superuser,
            username,
            first_name,
            last_name,
            email,
            CASE WHEN is_staff THEN 1 ELSE 0 END as is_staff,
            CASE WHEN is_active THEN 1 ELSE 0 END as is_active,
            date_joined
        FROM auth_user
        ORDER BY id
    ) TO STDOUT WITH (FORMAT CSV, HEADER TRUE, DELIMITER ',', QUOTE '\"')" > users.csv
    
    local row_count=$(wc -l < users.csv)
    echo "✓ Exported $((row_count - 1)) users (including header)"
}

# Function to export saved_files table
export_saved_files() {
    echo "Exporting saved_files table..."
    psql -c "COPY (
        SELECT 
            id,
            user_id,
            file_id,
            file_name,
            file_path,
            uploaded_at,
            CASE 
                WHEN system_tags IS NULL THEN '[]'
                ELSE array_to_json(system_tags)::text
            END as system_tags,
            CASE 
                WHEN user_tags IS NULL THEN '[]'
                ELSE array_to_json(user_tags)::text
            END as user_tags,
            CASE 
                WHEN metadata IS NULL THEN '{}'
                ELSE metadata::text
            END as metadata
        FROM list_cutter_savedfile
        ORDER BY id
    ) TO STDOUT WITH (FORMAT CSV, HEADER TRUE, DELIMITER ',', QUOTE '\"')" > saved_files.csv
    
    local row_count=$(wc -l < saved_files.csv)
    echo "✓ Exported $((row_count - 1)) saved files (including header)"
}

# Function to export persons table
export_persons() {
    echo "Exporting persons table..."
    psql -c "COPY (
        SELECT 
            cuttyid,
            created_by_id,
            firstname,
            middlename,
            lastname,
            dob,
            sex,
            version,
            CASE WHEN deceased THEN 1 ELSE 0 END as deceased,
            CASE WHEN active THEN 1 ELSE 0 END as active,
            precinctname,
            countyname,
            created_at,
            updated_at,
            email,
            secondary_email,
            phone,
            secondary_phone,
            mailing_address_line1,
            mailing_address_line2,
            city,
            statecode,
            postal_code,
            country,
            race,
            ethnicity,
            income_range,
            CASE 
                WHEN model_scores IS NULL THEN '{}'
                ELSE model_scores::text
            END as model_scores,
            CASE 
                WHEN system_tags IS NULL THEN '[]'
                ELSE array_to_json(system_tags)::text
            END as system_tags,
            CASE 
                WHEN user_tags IS NULL THEN '[]'
                ELSE array_to_json(user_tags)::text
            END as user_tags,
            notes
        FROM contacts_person
        ORDER BY cuttyid
    ) TO STDOUT WITH (FORMAT CSV, HEADER TRUE, DELIMITER ',', QUOTE '\"')" > persons.csv
    
    local row_count=$(wc -l < persons.csv)
    echo "✓ Exported $((row_count - 1)) persons (including header)"
}

# Function to run pre-export validation
run_validation() {
    echo "Running pre-export validation..."
    psql -c "
        -- Check for NULL values in required fields
        SELECT 'users_null_check' as check_type, count(*) as count
        FROM auth_user 
        WHERE username IS NULL OR password IS NULL;

        -- Check for NULL values in saved files
        SELECT 'saved_files_null_check' as check_type, count(*) as count
        FROM list_cutter_savedfile 
        WHERE file_id IS NULL OR user_id IS NULL;

        -- Check for array field issues
        SELECT 'array_fields_check' as check_type, count(*) as count
        FROM list_cutter_savedfile 
        WHERE system_tags IS NOT NULL AND array_length(system_tags, 1) IS NULL;

        -- Check JSON field validity in persons
        SELECT 'json_fields_check' as check_type, count(*) as count
        FROM contacts_person 
        WHERE model_scores IS NOT NULL AND NOT (model_scores::text ~ '^{.*}$');
    "
    echo "✓ Pre-export validation completed"
}

# Function to create export summary
create_summary() {
    echo "Creating export summary..."
    
    cat > export_summary.txt << EOF
List Cutter PostgreSQL Data Export Summary
==========================================

Export Date: $(date)
Database: ${PGHOST}:${PGPORT}/${PGDATABASE}
Export Directory: $(pwd)

Files Created:
- users.csv ($(wc -l < users.csv) lines including header)
- saved_files.csv ($(wc -l < saved_files.csv) lines including header)
- persons.csv ($(wc -l < persons.csv) lines including header)

Total Records Exported:
- Users: $(($(wc -l < users.csv) - 1))
- Saved Files: $(($(wc -l < saved_files.csv) - 1))
- Persons: $(($(wc -l < persons.csv) - 1))

File Sizes:
$(ls -lh *.csv)

Data Integrity Notes:
- Boolean fields converted to 1/0 for SQLite compatibility
- PostgreSQL arrays converted to JSON strings
- All timestamps preserved in ISO format
- NULL values handled appropriately

Next Steps:
1. Run transform_data.py to prepare data for D1 import
2. Validate transformed data with validate_transformed_data.py
3. Import to D1 using import_to_d1.sh
EOF

    echo "✓ Export summary created: export_summary.txt"
}

# Main execution
main() {
    check_postgres_connection
    get_row_counts
    run_validation
    
    echo ""
    echo "Starting data export..."
    export_users
    export_saved_files
    export_persons
    
    echo ""
    create_summary
    
    echo ""
    echo "=== Export Complete ==="
    echo "✓ All PostgreSQL data exported successfully"
    echo "✓ Files created in: $(pwd)"
    echo "✓ Ready for data transformation phase"
    echo ""
    echo "Files created:"
    ls -la *.csv *.txt
}

# Execute main function
main