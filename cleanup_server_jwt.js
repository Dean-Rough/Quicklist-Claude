#!/usr/bin/env node

/**
 * Cleanup Script: Remove all JWT and legacy OAuth code from server.js
 *
 * This script removes:
 * - Legacy Google OAuth client initialization
 * - All Google OAuth endpoints
 * - validatePassword function
 * - All jwt.sign and bcrypt references
 *
 * Usage: node cleanup_server_jwt.js
 */

const fs = require('fs');
const path = require('path');

const SERVER_FILE = path.join(__dirname, 'server.js');
const BACKUP_FILE = path.join(__dirname, 'server.js.backup');

console.log('🧹 Cleaning up server.js...\n');

// Backup original file
console.log('📦 Creating backup: server.js.backup');
fs.copyFileSync(SERVER_FILE, BACKUP_FILE);

// Read file
let content = fs.readFileSync(SERVER_FILE, 'utf8');
const lines = content.split('\n');

console.log(`📄 Original file: ${lines.length} lines\n`);

// Track removals
const removals = [];

// 1. Remove conditional Google OAuth client (lines ~9-19)
console.log('🔍 Removing conditional Google OAuth client initialization...');
const oauthClientStart = lines.findIndex(line => line.includes('// Conditional Google OAuth'));
if (oauthClientStart !== -1) {
    const oauthClientEnd = lines.findIndex((line, idx) => idx > oauthClientStart && line.includes('const { v4: uuidv4 }'));
    if (oauthClientEnd !== -1) {
        removals.push({ start: oauthClientStart, end: oauthClientEnd - 1, name: 'Conditional Google OAuth client' });
    }
}

// 2. Remove validatePassword function
console.log('🔍 Removing validatePassword function...');
const validatePasswordStart = lines.findIndex(line => line.includes('function validatePassword'));
if (validatePasswordStart !== -1) {
    const validatePasswordEnd = lines.findIndex((line, idx) => idx > validatePasswordStart && line === '}');
    if (validatePasswordEnd !== -1) {
        removals.push({ start: validatePasswordStart, end: validatePasswordEnd + 1, name: 'validatePassword function' });
    }
}

// 3. Remove Legacy Google OAuth endpoints section
console.log('🔍 Removing legacy Google OAuth endpoints...');
const legacyOAuthStart = lines.findIndex(line => line.includes('// Legacy Google OAuth endpoints'));
if (legacyOAuthStart !== -1) {
    // Find the end (look for next major section or end of OAuth code)
    let legacyOAuthEnd = -1;
    let braceCount = 0;
    let inOAuthBlock = false;

    for (let i = legacyOAuthStart; i < lines.length; i++) {
        const line = lines[i];

        if (line.includes('if (googleClient)')) {
            inOAuthBlock = true;
        }

        if (inOAuthBlock) {
            // Count braces to find end of block
            braceCount += (line.match(/{/g) || []).length;
            braceCount -= (line.match(/}/g) || []).length;

            if (braceCount === 0 && line.includes('}')) {
                legacyOAuthEnd = i + 1;

                // Check if next line is also part of OAuth
                if (i + 1 < lines.length && (lines[i + 1].includes('if (googleClient)') || lines[i + 1].includes('// Legacy'))) {
                    inOAuthBlock = false;
                    continue;
                } else {
                    break;
                }
            }
        }
    }

    if (legacyOAuthEnd !== -1) {
        removals.push({ start: legacyOAuthStart, end: legacyOAuthEnd, name: 'Legacy Google OAuth endpoints' });
    }
}

// Sort removals by start line (descending) to remove from bottom up
removals.sort((a, b) => b.start - a.start);

console.log(`\n📊 Found ${removals.length} sections to remove:\n`);
removals.forEach((r, idx) => {
    console.log(`${idx + 1}. ${r.name} (lines ${r.start + 1}-${r.end + 1})`);
});

// Apply removals
let newLines = [...lines];
removals.forEach(r => {
    console.log(`\n✂️  Removing ${r.name}...`);
    newLines.splice(r.start, r.end - r.start + 1);
});

// Write cleaned file
const newContent = newLines.join('\n');
fs.writeFileSync(SERVER_FILE, newContent, 'utf8');

console.log(`\n✅ Cleanup complete!`);
console.log(`📄 New file: ${newLines.length} lines (removed ${lines.length - newLines.length} lines)`);
console.log(`\n💾 Backup saved as: server.js.backup`);
console.log(`\n🔄 To rollback: mv server.js.backup server.js`);

console.log(`\n📝 Next steps:`);
console.log(`   1. Review server.js for any remaining JWT/OAuth code`);
console.log(`   2. Search for: bcrypt, jwt.sign, jwt.verify, validatePassword`);
console.log(`   3. Remove Google OAuth references from .env`);
console.log(`   4. Update package.json (npm uninstall bcryptjs jsonwebtoken)`);
console.log(`   5. Test: npm run dev`);
