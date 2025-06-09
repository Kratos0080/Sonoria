import { readFileSync, writeFileSync } from 'fs';

const targetVersion = process.argv[2];
const manifestPath = 'manifest.json';
const versionsPath = 'versions.json';

// Read manifest.json
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

// Read versions.json
let versions = JSON.parse(readFileSync(versionsPath, 'utf8'));

// Update manifest version
manifest.version = targetVersion;
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

// Update versions.json
versions[targetVersion] = manifest.minAppVersion;
writeFileSync(versionsPath, JSON.stringify(versions, null, 2));

console.log(`Version bumped to ${targetVersion}`); 