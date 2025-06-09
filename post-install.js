#!/usr/bin/env node

/**
 * Post-install script to verify dependency versions and consistency 
 * after npm install
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CRITICAL_DEPS = [
  { name: 'react', expectedVersion: '18.2.0' },
  { name: 'react-dom', expectedVersion: '18.2.0' },
  { name: '@types/react', expectedVersion: '18.2.21' },
  { name: '@types/react-dom', expectedVersion: '18.2.7' },
  { name: 'typescript', minVersion: '5.3.0', maxVersion: '5.4.0' },
  { name: 'obsidian', minVersion: '1.5.0', maxVersion: '1.6.0' },
  { name: 'obsidian-typings', required: true },
];

console.log('Verifying dependency versions...');

// Get installed dependencies 
function getActualVersion(packageName) {
  try {
    const packagePath = path.resolve('./node_modules', packageName, 'package.json');
    if (fs.existsSync(packagePath)) {
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      return pkg.version;
    }
  } catch (error) {
    console.error(`Error checking version for ${packageName}:`, error.message);
  }
  return null;
}

// Version comparison utilities
function compareVersions(v1, v2) {
  const v1Parts = v1.split('.').map(Number);
  const v2Parts = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
    const p1 = v1Parts[i] || 0;
    const p2 = v2Parts[i] || 0;
    if (p1 !== p2) return p1 - p2;
  }
  return 0;
}

// Check each critical dependency
let hasErrors = false;

CRITICAL_DEPS.forEach(dep => {
  const actualVersion = getActualVersion(dep.name);
  
  if (!actualVersion) {
    if (dep.required) {
      console.error(`❌ ERROR: Required dependency ${dep.name} is not installed`);
      hasErrors = true;
    } else {
      console.warn(`⚠️ WARNING: Dependency ${dep.name} not found`);
    }
    return;
  }
  
  if (dep.expectedVersion && actualVersion !== dep.expectedVersion) {
    console.error(`❌ ERROR: ${dep.name} version mismatch:
  Expected: ${dep.expectedVersion}
  Actual:   ${actualVersion}`);
    hasErrors = true;
  } else if (dep.minVersion && dep.maxVersion) {
    const aboveMin = compareVersions(actualVersion, dep.minVersion) >= 0;
    const belowMax = compareVersions(actualVersion, dep.maxVersion) < 0;
    
    if (!aboveMin || !belowMax) {
      console.error(`❌ ERROR: ${dep.name} version out of range:
  Expected: >=${dep.minVersion}, <${dep.maxVersion}
  Actual:   ${actualVersion}`);
      hasErrors = true;
    } else {
      console.log(`✅ ${dep.name}: ${actualVersion} (valid)`);
    }
  } else {
    console.log(`✅ ${dep.name}: ${actualVersion}`);
  }
});

if (hasErrors) {
  console.error('\n⛔ Dependency validation failed. Please check the errors above.');
  console.log('\nFix with: npm install react@18.2.0 react-dom@18.2.0 @types/react@18.2.21 @types/react-dom@18.2.7 typescript@5.3.3 obsidian@1.5.x obsidian-typings@3.4.0\n');
  
  // Make the script return with non-zero exit code but don't actually exit
  // This allows installation to complete while still showing errors
  process.exitCode = 1;
} else {
  console.log('\n✅ All critical dependencies validated successfully!');
}

// Verify TypeScript configuration
try {
  console.log('\nChecking TypeScript configuration...');
  if (fs.existsSync('./src/types/obsidian.d.ts')) {
    console.log('✅ Declaration merging file exists: src/types/obsidian.d.ts');
  } else {
    console.warn('⚠️ Warning: Declaration merging file not found: src/types/obsidian.d.ts');
  }
  
  // Run tsc --version (just for info)
  try {
    const tsVersion = execSync('npx tsc --version', { encoding: 'utf8' }).trim();
    console.log(`ℹ️  ${tsVersion}`);
  } catch (err) {
    console.warn('⚠️ Could not determine TypeScript version');
  }
} catch (error) {
  console.error('Error checking TypeScript configuration:', error.message);
}

console.log('\nPost-install checks completed.'); 