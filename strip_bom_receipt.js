const fs = require("fs");
const files = [
  "D:/karya bahan app/src/app/page.tsx",
  "D:/karya bahan app/src/components/layout/Sidebar.tsx"
];
for (const file of files) {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file, content.replace(/^\uFEFF/, ''));
  }
}
