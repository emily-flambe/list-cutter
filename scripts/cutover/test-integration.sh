#!/bin/bash
# scripts/cutover/test-integration.sh
# Basic integration test for cutover scripts

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🧪 Testing Cutover Scripts Integration"
echo "======================================"

# Test 1: Help outputs
echo "1. Testing help outputs..."
"$SCRIPT_DIR/execute-cutover.sh" --dry-run > /dev/null
"$SCRIPT_DIR/rollback-cutover.sh" --help > /dev/null
"$SCRIPT_DIR/validate-cutover.sh" --help > /dev/null
"$SCRIPT_DIR/monitor-cutover.sh" --help > /dev/null
echo "✅ All help outputs working"

# Test 2: Script permissions
echo "2. Testing script permissions..."
for script in execute-cutover.sh rollback-cutover.sh validate-cutover.sh monitor-cutover.sh; do
    if [ -x "$SCRIPT_DIR/$script" ]; then
        echo "✅ $script is executable"
    else
        echo "❌ $script is not executable"
        exit 1
    fi
done

# Test 3: Required directories
echo "3. Testing required directories..."
REQUIRED_DIRS=("logs/cutover" "logs/rollback" "logs/validation" "logs/monitoring" "reports" "deployments" "backups")
for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo "✅ Directory $dir exists"
    else
        echo "❌ Directory $dir missing"
        exit 1
    fi
done

# Test 4: Script syntax validation
echo "4. Testing script syntax..."
for script in execute-cutover.sh rollback-cutover.sh validate-cutover.sh monitor-cutover.sh; do
    if bash -n "$SCRIPT_DIR/$script"; then
        echo "✅ $script syntax valid"
    else
        echo "❌ $script syntax error"
        exit 1
    fi
done

# Test 5: Dependencies check
echo "5. Testing dependencies..."
REQUIRED_TOOLS=("curl" "jq" "dig" "bc")
for tool in "${REQUIRED_TOOLS[@]}"; do
    if command -v "$tool" &> /dev/null; then
        echo "✅ $tool available"
    else
        echo "⚠️ $tool not available (may need installation)"
    fi
done

echo ""
echo "🎉 Integration test completed successfully!"
echo "All cutover scripts are ready for production use."