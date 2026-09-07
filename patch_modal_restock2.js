const fs = require("fs");
let content = fs.readFileSync("src/app/restock/page.tsx", "utf8");

const modalRegex = /\{\/\* Edit Restock Transaction Modal \*\/\}[\s\S]*?\{editingTx && \([\s\S]*?\}\)[\s\S]*?<\/div>\s*\)\}/;
const match = content.match(modalRegex);
if (match) {
  let modalContent = match[0];
  content = content.replace(modalContent, "");
  
  const returnRegex = /return \(\s*<div className="p-4 md:p-8 max-w-7xl mx-auto animate-fade-in">/;
  const newReturn = `return (\n    <>\n      ${modalContent}\n      <div className="p-4 md:p-8 max-w-7xl mx-auto animate-fade-in">`;
  content = content.replace(returnRegex, newReturn);
  
  const endRegex = /<\/div>\s*\);\s*\}/;
  content = content.replace(endRegex, "</div>\n    </>\n  );\n}");

  fs.writeFileSync("src/app/restock/page.tsx", content);
  console.log("Restock Modal extracted!");
} else {
  console.log("Restock Modal not found");
}
