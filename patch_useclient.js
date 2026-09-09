const fs = require("fs");
let content = fs.readFileSync("src/app/materials/page.tsx", "utf8");
content = content.replace(
  'import { createPortal } from "react-dom";\n"use client";',
  '"use client";\nimport { createPortal } from "react-dom";'
);
fs.writeFileSync("src/app/materials/page.tsx", content);
console.log("Fixed use client position.");
