#!/bin/bash

# Example usage script for the file migration assessment tool
# This script demonstrates various ways to use assess_file_migration.py

set -e

echo "============================================================"
echo "FILE MIGRATION ASSESSMENT TOOL - EXAMPLE USAGE"
echo "============================================================"
echo ""
echo "This script demonstrates various ways to use the assessment tool."
echo "Make sure to install dependencies first:"
echo "  pip install click tqdm psycopg2-binary pandas"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check if the assessment script exists
if [[ ! -f "scripts/assess_file_migration.py" ]]; then
    print_error "Assessment script not found. Make sure you're in the project root directory."
    exit 1
fi

# Make sure the script is executable
chmod +x scripts/assess_file_migration.py

print_step "Example 1: Show help and available options"
echo "Command: python scripts/assess_file_migration.py --help"
echo ""
# Uncomment the following line to actually run the help command
# python scripts/assess_file_migration.py --help

print_step "Example 2: Dry run (filesystem analysis only)"
echo "This analyzes the filesystem without connecting to the database."
echo "Useful for initial assessment or when database is unavailable."
echo ""
echo "Command: python scripts/assess_file_migration.py --dry-run --detailed"
echo ""
# Uncomment to run:
# python scripts/assess_file_migration.py --dry-run --detailed

print_step "Example 3: Basic assessment with database connection"
echo "This requires database credentials to be set."
echo ""
echo "Commands:"
echo "  export DB_PASSWORD=your_password"
echo "  python scripts/assess_file_migration.py"
echo ""
echo "Or with explicit database parameters:"
echo "  python scripts/assess_file_migration.py \\"
echo "    --db-host localhost \\"
echo "    --db-port 5432 \\"
echo "    --db-name list_cutter \\"
echo "    --db-user list_cutter \\"
echo "    --db-password your_password"
echo ""

print_step "Example 4: Detailed assessment with JSON output"
echo "This generates both text and JSON reports."
echo ""
echo "Command:"
echo "  python scripts/assess_file_migration.py \\"
echo "    --detailed \\"
echo "    --output-format both \\"
echo "    --output-file migration_report.json"
echo ""

print_step "Example 5: Custom batch configuration"
echo "Configure migration batches based on different strategies."
echo ""
echo "Size-based batching (largest files first):"
echo "  python scripts/assess_file_migration.py \\"
echo "    --batch-strategy size \\"
echo "    --batch-size 500"
echo ""
echo "Date-based batching (chronological):"
echo "  python scripts/assess_file_migration.py \\"
echo "    --batch-strategy date \\"
echo "    --batch-size 1000"
echo ""
echo "User-based batching (grouped by user):"
echo "  python scripts/assess_file_migration.py \\"
echo "    --batch-strategy user \\"
echo "    --batch-size 200"
echo ""

print_step "Example 6: Comprehensive assessment with checksums"
echo "This includes file integrity verification (slower but more thorough)."
echo ""
echo "Command:"
echo "  python scripts/assess_file_migration.py \\"
echo "    --detailed \\"
echo "    --calculate-checksums \\"
echo "    --output-format json \\"
echo "    --output-file comprehensive_report.json"
echo ""

print_step "Example 7: Custom media directory"
echo "If your media files are in a different location."
echo ""
echo "Command:"
echo "  python scripts/assess_file_migration.py \\"
echo "    --media-root /path/to/your/media \\"
echo "    --detailed"
echo ""

print_step "Example 8: Production environment assessment"
echo "Recommended approach for production analysis."
echo ""
echo "Commands:"
echo "  # Set environment variables"
echo "  export DB_PASSWORD=your_production_password"
echo "  export DB_HOST=your_production_host"
echo ""
echo "  # Run comprehensive assessment"
echo "  python scripts/assess_file_migration.py \\"
echo "    --db-host \$DB_HOST \\"
echo "    --db-name list_cutter_prod \\"
echo "    --db-user list_cutter_prod \\"
echo "    --media-root /var/www/media \\"
echo "    --batch-size 1000 \\"
echo "    --batch-strategy size \\"
echo "    --detailed \\"
echo "    --output-format both \\"
echo "    --output-file prod_migration_\$(date +%Y%m%d_%H%M%S).json \\"
echo "    --log-level INFO"
echo ""

print_step "Example 9: Debug mode for troubleshooting"
echo "Use when encountering issues or need detailed logging."
echo ""
echo "Command:"
echo "  python scripts/assess_file_migration.py \\"
echo "    --log-level DEBUG \\"
echo "    --detailed"
echo ""

print_step "Example 10: Remote database assessment"
echo "For assessing files on a remote database server."
echo ""
echo "Command:"
echo "  python scripts/assess_file_migration.py \\"
echo "    --db-host database.example.com \\"
echo "    --db-port 5432 \\"
echo "    --db-name list_cutter \\"
echo "    --db-user readonly_user \\"
echo "    --media-root /shared/media \\"
echo "    --batch-size 500 \\"
echo "    --output-format json"
echo ""

print_step "Example Docker Usage"
echo "Running the assessment tool in a Docker container."
echo ""
echo "Commands:"
echo "  # Build container with dependencies"
echo "  docker build -t migration-assessment ."
echo ""
echo "  # Run assessment"
echo "  docker run -v /path/to/media:/app/media \\"
echo "    -e DB_PASSWORD=your_password \\"
echo "    -e DB_HOST=host.docker.internal \\"
echo "    migration-assessment \\"
echo "    python scripts/assess_file_migration.py --detailed"
echo ""

print_step "Interpreting Results"
echo ""
echo "Key metrics to monitor:"
echo "  • Total files and size - Overall scope of migration"
echo "  • Missing files - Files in DB but not on filesystem"
echo "  • Orphaned files - Files on filesystem but not in DB"
echo "  • Estimated cost - Monthly R2 storage cost"
echo "  • Migration time - Expected duration for migration"
echo "  • Batch count - Number of migration batches needed"
echo ""
echo "Common issues and solutions:"
echo "  • High missing file count: Clean up database records"
echo "  • Many orphaned files: Decide whether to migrate or delete"
echo "  • Large file sizes: Consider compression or chunking"
echo "  • High user concentration: Balance batches across users"
echo ""

print_step "Next Steps After Assessment"
echo ""
echo "1. Review the generated report and recommendations"
echo "2. Address any identified issues (missing files, orphaned data)"
echo "3. Test migration with a small subset of files"
echo "4. Configure migration batches based on assessment results"
echo "5. Set up monitoring for costs and performance"
echo "6. Plan rollback strategy if needed"
echo "7. Execute migration in phases"
echo ""

print_step "Additional Resources"
echo ""
echo "Files created by this tool:"
echo "  • scripts/assess_file_migration.py - Main assessment script"
echo "  • scripts/MIGRATION_ASSESSMENT_README.md - Detailed documentation"
echo "  • scripts/demo_assessment.py - Demo without database"
echo "  • scripts/test_assessment.py - Unit tests"
echo ""
echo "For more information:"
echo "  • Run: python scripts/assess_file_migration.py --help"
echo "  • Read: scripts/MIGRATION_ASSESSMENT_README.md"
echo "  • Test: python scripts/demo_assessment.py"
echo ""

print_success "Example usage demonstration complete!"
echo ""
echo "Choose the appropriate example based on your needs:"
echo "  • Development/Testing: Use examples 1-3"
echo "  • Production Planning: Use examples 4-6"
echo "  • Troubleshooting: Use example 9"
echo "  • Remote/Docker: Use examples 10-11"