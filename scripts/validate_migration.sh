#!/bin/bash

# File Migration Validation Script Wrapper
# ========================================
# 
# This script provides a convenient wrapper for the Python validation script
# with configuration management and environment setup.
#
# Usage:
#   ./validate_migration.sh [OPTIONS]
#
# Examples:
#   ./validate_migration.sh --batch-id batch-123 --config validation_config.json
#   ./validate_migration.sh --full-validation --output-format human --verbose
#   ./validate_migration.sh --check-environment

set -e

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Default configuration
DEFAULT_CONFIG="${SCRIPT_DIR}/validation_config.json"
PYTHON_SCRIPT="${SCRIPT_DIR}/validate_migration.py"
REQUIREMENTS_FILE="${SCRIPT_DIR}/requirements.txt"
VENV_DIR="${SCRIPT_DIR}/.venv"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Usage information
show_usage() {
    cat << EOF
File Migration Validation Script Wrapper

USAGE:
    $(basename "$0") [OPTIONS]

OPTIONS:
    --batch-id BATCH_ID          Validate specific batch ID
    --full-validation            Validate complete migration
    --config CONFIG_FILE         Configuration file path (default: validation_config.json)
    --output-format FORMAT       Output format: json, csv, human (default: json)
    --output-file FILE           Output file path
    --max-workers N              Maximum concurrent workers (default: 10)
    --batch-size N               Batch size for processing (default: 100)
    --timeout N                  Request timeout in seconds (default: 30)
    --verbose                    Enable verbose logging
    --check-environment          Check environment setup and dependencies
    --setup-environment          Setup Python virtual environment and dependencies
    --help                       Show this help message

EXAMPLES:
    # Validate specific batch
    $(basename "$0") --batch-id batch-123 --config my_config.json

    # Full validation with human-readable output
    $(basename "$0") --full-validation --output-format human --verbose

    # Check environment setup
    $(basename "$0") --check-environment

    # Setup environment and run validation
    $(basename "$0") --setup-environment --full-validation

CONFIGURATION:
    The script uses a JSON configuration file. Copy validation_config.example.json
    to validation_config.json and update with your settings.

EOF
}

# Check if Python is available
check_python() {
    if ! command -v python3 &> /dev/null; then
        log_error "Python 3 is required but not installed"
        return 1
    fi
    
    local python_version
    python_version=$(python3 --version 2>&1 | awk '{print $2}')
    log_info "Python version: $python_version"
    
    return 0
}

# Setup virtual environment
setup_venv() {
    log_info "Setting up Python virtual environment..."
    
    if [ ! -d "$VENV_DIR" ]; then
        python3 -m venv "$VENV_DIR"
        log_success "Virtual environment created"
    else
        log_info "Virtual environment already exists"
    fi
    
    # Activate virtual environment
    source "$VENV_DIR/bin/activate"
    
    # Install/upgrade pip
    pip install --upgrade pip
    
    # Install requirements
    if [ -f "$REQUIREMENTS_FILE" ]; then
        log_info "Installing requirements..."
        pip install -r "$REQUIREMENTS_FILE"
        log_success "Requirements installed"
    else
        log_warning "Requirements file not found: $REQUIREMENTS_FILE"
    fi
}

# Check environment setup
check_environment() {
    log_info "Checking environment setup..."
    
    # Check Python
    if ! check_python; then
        return 1
    fi
    
    # Check virtual environment
    if [ -d "$VENV_DIR" ]; then
        log_success "Virtual environment exists"
        
        # Check if requirements are installed
        source "$VENV_DIR/bin/activate"
        local missing_deps=0
        
        while IFS= read -r requirement; do
            # Skip comments and empty lines
            if [[ "$requirement" =~ ^#.*$ ]] || [[ -z "$requirement" ]]; then
                continue
            fi
            
            local package_name
            package_name=$(echo "$requirement" | sed 's/[>=<].*//')
            
            if ! pip show "$package_name" &> /dev/null; then
                log_warning "Missing dependency: $package_name"
                missing_deps=1
            fi
        done < "$REQUIREMENTS_FILE"
        
        if [ $missing_deps -eq 0 ]; then
            log_success "All dependencies are installed"
        else
            log_warning "Some dependencies are missing. Run with --setup-environment to install them."
        fi
    else
        log_warning "Virtual environment not found. Run with --setup-environment to create it."
    fi
    
    # Check configuration file
    if [ -f "$DEFAULT_CONFIG" ]; then
        log_success "Configuration file exists"
        
        # Validate JSON syntax
        if python3 -m json.tool "$DEFAULT_CONFIG" &> /dev/null; then
            log_success "Configuration file is valid JSON"
        else
            log_error "Configuration file has invalid JSON syntax"
            return 1
        fi
    else
        log_warning "Configuration file not found: $DEFAULT_CONFIG"
        log_info "Copy validation_config.example.json to validation_config.json and update with your settings"
    fi
    
    # Check Python script
    if [ -f "$PYTHON_SCRIPT" ]; then
        log_success "Python validation script exists"
    else
        log_error "Python validation script not found: $PYTHON_SCRIPT"
        return 1
    fi
    
    return 0
}

# Parse command line arguments
parse_args() {
    local config_file=""
    local batch_id=""
    local full_validation=false
    local output_format="json"
    local output_file=""
    local max_workers=10
    local batch_size=100
    local timeout=30
    local verbose=false
    local check_env=false
    local setup_env=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --batch-id)
                batch_id="$2"
                shift 2
                ;;
            --full-validation)
                full_validation=true
                shift
                ;;
            --config)
                config_file="$2"
                shift 2
                ;;
            --output-format)
                output_format="$2"
                shift 2
                ;;
            --output-file)
                output_file="$2"
                shift 2
                ;;
            --max-workers)
                max_workers="$2"
                shift 2
                ;;
            --batch-size)
                batch_size="$2"
                shift 2
                ;;
            --timeout)
                timeout="$2"
                shift 2
                ;;
            --verbose)
                verbose=true
                shift
                ;;
            --check-environment)
                check_env=true
                shift
                ;;
            --setup-environment)
                setup_env=true
                shift
                ;;
            --help)
                show_usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    # Handle special commands
    if [ "$check_env" = true ]; then
        check_environment
        exit $?
    fi
    
    if [ "$setup_env" = true ]; then
        setup_venv
        if [ "$full_validation" = false ] && [ -z "$batch_id" ]; then
            log_info "Environment setup complete. You can now run validation commands."
            exit 0
        fi
    fi
    
    # Use default config if not specified
    if [ -z "$config_file" ]; then
        config_file="$DEFAULT_CONFIG"
    fi
    
    # Validate configuration file exists
    if [ ! -f "$config_file" ]; then
        log_error "Configuration file not found: $config_file"
        log_info "Copy validation_config.example.json to validation_config.json and update with your settings"
        exit 1
    fi
    
    # Ensure virtual environment is activated
    if [ ! -d "$VENV_DIR" ]; then
        log_error "Virtual environment not found. Run with --setup-environment first."
        exit 1
    fi
    
    source "$VENV_DIR/bin/activate"
    
    # Build Python command
    local python_cmd="python3 $PYTHON_SCRIPT"
    
    # Load configuration from JSON file
    local postgres_dsn
    local d1_api_endpoint
    local d1_api_token
    local r2_api_endpoint
    local r2_api_token
    local workers_api_endpoint
    local workers_api_token
    local django_media_root
    
    postgres_dsn=$(python3 -c "import json; print(json.load(open('$config_file'))['postgres_dsn'])")
    d1_api_endpoint=$(python3 -c "import json; print(json.load(open('$config_file'))['d1_api_endpoint'])")
    d1_api_token=$(python3 -c "import json; print(json.load(open('$config_file'))['d1_api_token'])")
    r2_api_endpoint=$(python3 -c "import json; print(json.load(open('$config_file'))['r2_api_endpoint'])")
    r2_api_token=$(python3 -c "import json; print(json.load(open('$config_file'))['r2_api_token'])")
    workers_api_endpoint=$(python3 -c "import json; print(json.load(open('$config_file'))['workers_api_endpoint'])")
    workers_api_token=$(python3 -c "import json; print(json.load(open('$config_file'))['workers_api_token'])")
    django_media_root=$(python3 -c "import json; print(json.load(open('$config_file'))['django_media_root'])")
    
    # Add required parameters
    python_cmd="$python_cmd --postgres-dsn \"$postgres_dsn\""
    python_cmd="$python_cmd --d1-api-endpoint \"$d1_api_endpoint\""
    python_cmd="$python_cmd --d1-api-token \"$d1_api_token\""
    python_cmd="$python_cmd --r2-api-endpoint \"$r2_api_endpoint\""
    python_cmd="$python_cmd --r2-api-token \"$r2_api_token\""
    python_cmd="$python_cmd --workers-api-endpoint \"$workers_api_endpoint\""
    python_cmd="$python_cmd --workers-api-token \"$workers_api_token\""
    python_cmd="$python_cmd --django-media-root \"$django_media_root\""
    
    # Add optional parameters
    if [ -n "$batch_id" ]; then
        python_cmd="$python_cmd --batch-id \"$batch_id\""
    fi
    
    python_cmd="$python_cmd --output-format \"$output_format\""
    
    if [ -n "$output_file" ]; then
        python_cmd="$python_cmd --output-file \"$output_file\""
    fi
    
    python_cmd="$python_cmd --max-workers $max_workers"
    python_cmd="$python_cmd --batch-size $batch_size"
    python_cmd="$python_cmd --timeout $timeout"
    
    if [ "$verbose" = true ]; then
        python_cmd="$python_cmd --verbose"
    fi
    
    # Execute the command
    log_info "Starting validation..."
    log_info "Configuration: $config_file"
    
    if [ -n "$batch_id" ]; then
        log_info "Validating batch: $batch_id"
    else
        log_info "Validating full migration"
    fi
    
    # Run the Python script
    eval "$python_cmd"
    local exit_code=$?
    
    # Report results
    if [ $exit_code -eq 0 ]; then
        log_success "Validation completed successfully"
    elif [ $exit_code -eq 1 ]; then
        log_error "Validation failed with errors"
    elif [ $exit_code -eq 2 ]; then
        log_warning "Validation completed with warnings"
    else
        log_error "Validation failed with unexpected error (exit code: $exit_code)"
    fi
    
    exit $exit_code
}

# Main execution
main() {
    # Check if no arguments provided
    if [ $# -eq 0 ]; then
        show_usage
        exit 1
    fi
    
    # Parse and execute
    parse_args "$@"
}

# Run main function
main "$@"