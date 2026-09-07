const fs = require("fs");
let content = fs.readFileSync("src/app/materials/page.tsx", "utf8");

// We need to move the modal outside the main div.
// Currently the render starts with:
//   return (
//     <div className="p-4 md:p-8 max-w-7xl mx-auto animate-fade-in">

// And the modal is somewhere inside.
const modalRegex = /\{\/\* --- MANUAL ADD \/ EDIT MODAL --- \*\/\}[\s\S]*?\{\/\* --- INVENTORY TABLE --- \*\/\}/;
const match = content.match(modalRegex);
if (match) {
  let modalContent = match[0].replace("{/* --- INVENTORY TABLE --- */}", "");
  
  // Remove it from its current position
  content = content.replace(modalContent, "");
  
  // Inject it at the very top of the return block, wrapping everything in a Fragment
  const returnRegex = /return \(\s*<div className="p-4 md:p-8 max-w-7xl mx-auto animate-fade-in">/;
  const newReturn = `return (\n    <>\n      ${modalContent}\n      <div className="p-4 md:p-8 max-w-7xl mx-auto animate-fade-in">`;
  content = content.replace(returnRegex, newReturn);
  
  // Also close the fragment at the very end of the component
  const endRegex = /<\/div>\s*\);\s*\}/;
  content = content.replace(endRegex, "</div>\n    </>\n  );\n}");

  fs.writeFileSync("src/app/materials/page.tsx", content);
  console.log("Modal extracted!");
} else {
  console.log("Modal not found");
}
