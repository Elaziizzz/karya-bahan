const fs = require("fs");
let content = fs.readFileSync("src/app/restock/page.tsx", "utf8");

if (!content.includes("createPortal")) {
  content = content.replace('import { useState, useEffect } from "react";', 'import { useState, useEffect } from "react";\nimport { createPortal } from "react-dom";');
}

let newContent = content.replace(
  /\{editingTx && \(/,
  "{editingTx && typeof document !== 'undefined' ? createPortal("
);

// We need to replace the last `)}` that matches this modal.
// The modal ends just before `</div>\n  );\n}` usually, but let's look for `)}` right before `    </div>\n  );\n}`.

newContent = newContent.replace(
  /\)\}\n\s*<\/div>\n\s*\);\n\}/,
  "), document.body) : null}\n    </div>\n  );\n}"
);

fs.writeFileSync("src/app/restock/page.tsx", newContent);
console.log("Restock Portal injected correctly.");

