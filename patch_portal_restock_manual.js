const fs = require("fs");
let content = fs.readFileSync("src/app/restock/page.tsx", "utf8");

// Remove Fragment if it's there but unnecessary (or just keep it and add createPortal).
if (!content.includes("createPortal")) {
  content = content.replace('import { useState, useEffect, useRef } from "react";', 'import { useState, useEffect, useRef } from "react";\nimport { createPortal } from "react-dom";');
}

// Just match {editingTx && ( ... <div className="fixed ... ) }
let newContent = content.replace(
  /\{editingTx && \(\s*<div className="fixed inset-0/,
  "{editingTx && typeof document !== 'undefined' ? createPortal(\n        <div className=\"fixed inset-0"
);

// find where it closes (before </div>\n    </>\n  );\n})
newContent = newContent.replace(
  /\}\)\s*<\/div>\s*<\/>\s*\);\s*\}/,
  "), document.body) : null}\n</div>\n    </>\n  );\n}"
);

fs.writeFileSync("src/app/restock/page.tsx", newContent);
console.log("Restock Portal fixed.");
