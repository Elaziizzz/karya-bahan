const fs = require("fs");
const files = [
  "D:/karya bahan app/src/middleware.ts",
  "D:/bysca app/src/middleware.ts"
];
for (const file of files) {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file, content.replace(/^\uFEFF/, ''));
  }
}
