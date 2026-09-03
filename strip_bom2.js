const fs = require("fs");

const files = [
  "D:/karya bahan app/src/app/api/sheets/sync/route.ts",
  "D:/karya bahan app/src/app/page.tsx",
  "D:/karya bahan app/src/app/reports/page.tsx",
  "D:/karya bahan app/src/app/trash/page.tsx",
  "D:/bysca app/src/app/api/sheets/sync/route.ts",
  "D:/bysca app/src/app/page.tsx",
  "D:/bysca app/src/app/reports/page.tsx",
  "D:/bysca app/src/app/trash/page.tsx"
];

for (const file of files) {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file, content.replace(/^\uFEFF/, ''));
    console.log(`Stripped BOM from ${file}`);
  }
}
