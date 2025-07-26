import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to fix MSW v2 syntax in a file
function fixMSWv2Syntax(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Replace rest.get with http.get
  if (content.includes('rest.get')) {
    content = content.replace(/rest\.get\('([^']+)',\s*\(req,\s*res,\s*ctx\)\s*=>\s*{\s*return\s*res\(\s*ctx\.json\(/g, 
      "http.get('$1', () => {\n    return HttpResponse.json(");
    modified = true;
  }
  
  // Replace rest.post with http.post
  if (content.includes('rest.post')) {
    content = content.replace(/rest\.post\('([^']+)',\s*\(req,\s*res,\s*ctx\)\s*=>\s*{\s*return\s*res\(\s*ctx\.json\(/g,
      "http.post('$1', () => {\n    return HttpResponse.json(");
    modified = true;
  }
  
  // Replace rest.patch with http.patch
  if (content.includes('rest.patch')) {
    content = content.replace(/rest\.patch\('([^']+)',\s*\(req,\s*res,\s*ctx\)\s*=>\s*{\s*return\s*res\(\s*ctx\.json\(/g,
      "http.patch('$1', () => {\n    return HttpResponse.json(");
    modified = true;
  }
  
  // Replace rest.put with http.put
  if (content.includes('rest.put')) {
    content = content.replace(/rest\.put\('([^']+)',\s*\(req,\s*res,\s*ctx\)\s*=>\s*{\s*return\s*res\(\s*ctx\.json\(/g,
      "http.put('$1', () => {\n    return HttpResponse.json(");
    modified = true;
  }
  
  // Replace rest.delete with http.delete
  if (content.includes('rest.delete')) {
    content = content.replace(/rest\.delete\('([^']+)',\s*\(req,\s*res,\s*ctx\)\s*=>\s*{\s*return\s*res\(\s*ctx\.json\(/g,
      "http.delete('$1', () => {\n    return HttpResponse.json(");
    modified = true;
  }
  
  // Fix closing brackets
  content = content.replace(/\}\),\s*\);\s*\}\),/g, '});\n  }),');
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Fixed ${filePath}`);
  }
}

// Find all test files
const testFiles = [
  'src/__tests__/integration/SettingsManagement.test.tsx',
  'src/__tests__/integration/AccountManagement.test.tsx', 
  'src/__tests__/integration/UploadFlow.test.tsx'
];

console.log('Fixing MSW v2 syntax in test files...\n');

testFiles.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    fixMSWv2Syntax(filePath);
  } else {
    console.log(`✗ File not found: ${file}`);
  }
});

console.log('\nDone!');