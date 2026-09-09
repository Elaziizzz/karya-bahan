const fs = require("fs");
let content = fs.readFileSync("src/app/page.tsx", "utf8");

content = content.replace(
  /setSearchQuery\(m\.code \? \`\[\$\{m\.code\}\] \$\{m\.name\}\` : m\.name\);/g,
  'setSearchQuery(m.code ? `[${m.code}] ${displayMaterialName(m.name)}` : displayMaterialName(m.name));'
);

content = content.replace(
  /<span>\{m\.name\}<\/span>/g,
  '<span>{displayMaterialName(m.name)}</span>'
);

content = content.replace(
  /\{item\.materials\?\.name\}/g,
  '{displayMaterialName(item.materials?.name)}'
);

fs.writeFileSync("src/app/page.tsx", content);
console.log("Fixed more Kasir displays.");
