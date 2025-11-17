#!/bin/bash
set -e

echo "Publishing mintlify-tsdocs wrapper..."

# Navigate to the wrapper package directory
cd scripts/mintlify-tsdocs-wrapper

# Publish the wrapper package
npm publish

# Navigate back to the root directory
cd ../..

echo "✓ Published mintlify-tsdocs"
