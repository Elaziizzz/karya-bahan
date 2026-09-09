const fs = require("fs");
let content = fs.readFileSync("src/app/page.tsx", "utf8");

content = content.replace(
  /\{item\.material\.name\.replace\(\/-\\s\*\\\[\.\*\?\\\]\$\/, ''\)\.trim\(\)\}/g,
  "{displayMaterialName(item.material.name).replace(/-\\s*\\[.*?\\]$/, '').trim()}"
);

fs.writeFileSync("src/app/page.tsx", content);
console.log("Kasir receipt and cart item names patched.");
