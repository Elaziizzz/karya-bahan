const fs = require("fs");
const path = require("path");

const files = [
  "D:/karya bahan app/src/app/globals.css",
  "D:/karya bahan app/src/app/layout.tsx",
  "D:/karya bahan app/src/app/page.tsx",
  "D:/karya bahan app/src/components/layout/Sidebar.tsx",
  "D:/bysca app/src/app/globals.css",
  "D:/bysca app/src/app/layout.tsx",
  "D:/bysca app/src/app/page.tsx",
  "D:/bysca app/src/components/layout/Sidebar.tsx"
];

for (const file of files) {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file, content.replace(/^\uFEFF/, ''));
    console.log(`Stripped BOM from ${file}`);
  }
}
