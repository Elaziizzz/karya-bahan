const fs = require("fs");
let content = fs.readFileSync("src/app/reports/page.tsx", "utf8");

content = content.replace(
  /\{investors\.length > 0 && \(\s*<div>\s*<label className="block text-xs font-bold uppercase text-gray-500 mb-1">Pilih Investor<\/label>/,
  '<div>\n                    <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Pilih Investor</label>'
);
content = content.replace(
  /<\/select>\s*<\/div>\s*\)\}/,
  '</select>\n                  </div>'
);

fs.writeFileSync("src/app/reports/page.tsx", content);
console.log("Made investor filter always visible.");
