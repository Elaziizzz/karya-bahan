const fs = require('fs');
let content = fs.readFileSync('src/app/reports/page.tsx', 'utf8');
content = content.replace(/\(t\.materials\?\.code \? \`"\\\[\$\{t\.materials\.code\}\\\] "\` \+ t\.materials\.name : \(t\.materials\?\.name \|\| "Unknown"\)\)/g, 't.materials?.code ? `[${t.materials.code}] ${t.materials.name}` : (t.materials?.name || "Unknown")');
fs.writeFileSync('src/app/reports/page.tsx', content);
