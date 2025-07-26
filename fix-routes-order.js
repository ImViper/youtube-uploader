// Script to fix route ordering in routes.ts
// This will move specific routes before parameterized routes to prevent 404 errors

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/api/routes.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Find the position of router.get('/accounts/:id'
const accountsIdRouteRegex = /\/\/ Get single account\s*\n\s*router\.get\('\/accounts\/:id'/;
const match = content.match(accountsIdRouteRegex);

if (match) {
  const insertPosition = match.index;
  
  // Extract the routes that need to be moved
  // 1. Extract /accounts/stats route
  const statsRouteRegex = /\/\/ Account stats[\s\S]*?router\.get\('\/accounts\/stats'[\s\S]*?\}\);/;
  const statsMatch = content.match(statsRouteRegex);
  
  // 2. Extract /accounts/export route  
  const exportRouteRegex = /router\.get\('\/accounts\/export'[\s\S]*?\}\s*\}\s*\}\);/;
  const exportMatch = content.match(exportRouteRegex);
  
  if (statsMatch && exportMatch) {
    // Remove the routes from their current positions
    content = content.replace(statsRouteRegex, '');
    content = content.replace(exportRouteRegex, '');
    
    // Clean up extra newlines
    content = content.replace(/\n{3,}/g, '\n\n');
    
    // Insert routes before the /:id route
    const routesToInsert = `
  // Account stats - must be before /:id route
${statsMatch[0]}

  // Export accounts - must be before /:id route
${exportMatch[0]}

`;
    
    // Insert at the correct position
    content = content.slice(0, insertPosition) + routesToInsert + content.slice(insertPosition);
    
    // Write back to file
    fs.writeFileSync(filePath, content);
    console.log('Routes reordered successfully!');
  } else {
    console.log('Could not find routes to move');
  }
} else {
  console.log('Could not find /accounts/:id route');
}