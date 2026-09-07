const fs = require("fs");
let content = fs.readFileSync("src/app/materials/page.tsx", "utf8");
content = content.replace(
  /<div className="fixed inset-0 bg-black\/50 flex items-center justify-center p-4 z-50">/,
  '<div className="fixed inset-0 bg-black/50 flex items-start md:items-center justify-center p-4 z-50 overflow-y-auto py-12">'
);
fs.writeFileSync("src/app/materials/page.tsx", content);
