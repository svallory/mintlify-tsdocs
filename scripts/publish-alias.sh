#!/bin/bash
set -e

# Save original package.json
cp package.json package.json.backup

# Update package name to mint-ts
node -e "const pkg=require('./package.json'); pkg.name='mint-ts'; require('fs').writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')"

# Publish as mint-ts
npm publish

# Restore original package.json
mv package.json.backup package.json

echo "✓ Published as mint-ts"
