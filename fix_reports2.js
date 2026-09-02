const fs = require('fs');
let content = fs.readFileSync('src/app/reports/page.tsx', 'utf8');

// Replace all instances of `t.materials.name` with `t.materials.name.replace(/-\s*\[.*?\]$/, '').trim()` inside the formatting ternaries
content = content.replace(/t\.materials\.name(?!.)/g, "t.materials.name.replace(/-\\\\s*\\\\[.*?\\\\]$$/, '').trim()");
fs.writeFileSync('src/app/reports/page.tsx', content);
