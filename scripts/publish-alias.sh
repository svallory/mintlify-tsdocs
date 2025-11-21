#!/bin/bash
set -e

echo "Publishing mintlify-tsdocs wrapper..."

# Get the version from the main package.json
VERSION=$(node -p "require('./package.json').version")

echo "Syncing wrapper to version $VERSION..."

# Navigate to the wrapper package directory
cd scripts/mintlify-tsdocs-wrapper

# Update the wrapper package.json with the current version
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '$VERSION';
pkg.dependencies['mint-tsdocs'] = '$VERSION';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# Publish the wrapper package
bun publish

# Navigate back to the root directory
cd ../..

echo "✓ Published mintlify-tsdocs@$VERSION"
