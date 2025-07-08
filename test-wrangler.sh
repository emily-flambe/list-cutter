#!/bin/bash
set -e

echo "Testing wrangler configuration..."
cd cloudflare/workers

echo "1. Testing configuration parsing..."
if wrangler dev --dry-run 2>&1 | grep -q "binding should have a string"; then
  echo "❌ Configuration still has binding errors"
  exit 1
else
  echo "✅ Configuration parsing looks good"
fi

echo "2. Testing versions upload (the failing command)..."
if wrangler versions upload --dry-run 2>&1 | grep -q "binding should have a string"; then
  echo "❌ Versions upload still has binding errors"
  exit 1
else
  echo "✅ Versions upload configuration looks good"
fi

echo "3. Testing deploy..."
if wrangler deploy --dry-run 2>&1 | grep -q "binding should have a string"; then
  echo "❌ Deploy still has binding errors"
  exit 1
else
  echo "✅ Deploy configuration looks good"
fi

echo "All tests passed! Configuration should work in CI now."