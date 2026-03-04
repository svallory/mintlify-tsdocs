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

# Publish the wrapper package (tolerate "already published" errors from npm race conditions)
npm publish --provenance --access public 2>&1 | tee /tmp/npm-publish-alias.log || {
  if grep -q "cannot publish over the previously published versions" /tmp/npm-publish-alias.log; then
    echo "Version $VERSION already published — treating as success"
  else
    exit 1
  fi
}

# Navigate back to the root directory
cd ../..

echo "✓ Published mintlify-tsdocs@$VERSION"
