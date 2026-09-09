const fs = require("fs");
let content = fs.readFileSync("src/app/materials/page.tsx", "utf8");

// 1. Add createPortal import
if (!content.includes('import { createPortal }')) {
  content = content.replace('import { useState, useEffect, useRef } from "react";', 'import { useState, useEffect, useRef } from "react";\nimport { createPortal } from "react-dom";');
}

// 2. Add investor to initial state type
content = content.replace(
  "packCost: '',\n      name:",
  "packCost: '', investor: '',\n      name:"
);
content = content.replace(
  "buyQty: '', packCost: '',",
  "buyQty: '', packCost: '', investor: '',"
);

fs.writeFileSync("src/app/materials/page.tsx", content);
console.log("Materials TS fixed.");
