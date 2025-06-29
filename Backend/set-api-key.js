#!/usr/bin/env node

// Script to set new Gemini API key
// Usage: node set-api-key.js YOUR_NEW_API_KEY

const fs = require('fs');
const path = require('path');

const apiKey = process.argv[2];

if (!apiKey) {
  console.error('❌ Please provide an API key');
  console.log('Usage: node set-api-key.js YOUR_NEW_API_KEY');
  console.log('Get your API key from: https://aistudio.google.com/app/apikey');
  process.exit(1);
}

// Create or update .env file
const envPath = path.join(__dirname, '.env');
let envContent = '';

// Read existing .env if it exists
if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf8');
}

// Update or add GEMINI_API_KEY
const lines = envContent.split('\n');
let keyUpdated = false;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith('GEMINI_API_KEY=')) {
    lines[i] = `GEMINI_API_KEY=${apiKey}`;
    keyUpdated = true;
    break;
  }
}

if (!keyUpdated) {
  lines.push(`GEMINI_API_KEY=${apiKey}`);
}

// Write back to .env
fs.writeFileSync(envPath, lines.join('\n'));

console.log('✅ API key updated successfully!');
console.log('🔄 Please restart the backend server');
console.log('💡 Run: npm start'); 