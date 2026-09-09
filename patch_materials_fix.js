const fs = require("fs");
let content = fs.readFileSync("src/app/materials/page.tsx", "utf8");

// First, find the bogus portal closure and revert it to )}
content = content.replace(
  /\), document\.body\) : null\}\s*\{\/\* --- INVENTORY TABLE --- \*\/\}/,
  ")}\n\n        {/* --- INVENTORY TABLE --- */}"
);

// Then, find the actual closure for isModalOpen which is right before the sticky header.
content = content.replace(
  / {8}\)\}\s*<div className="sticky top-0 z-40 bg-\[#f8f9fa\] border-b-2 border-black shadow-sm px-4 md:px-8 py-4 mb-4">/,
  "        ), document.body) : null}\n\n      <div className=\"sticky top-0 z-40 bg-[#f8f9fa] border-b-2 border-black shadow-sm px-4 md:px-8 py-4 mb-4\">"
);

fs.writeFileSync("src/app/materials/page.tsx", content);
console.log("Materials portal logic fixed.");
